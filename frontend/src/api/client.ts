import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

// eslint-disable-next-line no-console
const devLog: typeof console.log = import.meta.env.DEV
  ? console.log.bind(console)
  : () => {};

const DEFAULT_BASE_URL = 'http://localhost:5000/api';

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? DEFAULT_BASE_URL;

// Access token lives in memory only (per security requirements).
// The refresh token is an HTTP-only cookie handled by the backend, so we always
// send credentials with every request.
let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function registerUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

// De-duplicate concurrent refresh attempts: all 401s that land while a refresh
// is in flight await the same promise and then retry with the fresh token.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<{ accessToken: string }>(
        `${API_BASE_URL}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      .then((res) => {
        const token = res.data?.accessToken ?? null;
        setAccessToken(token);
        devLog('[auth/client] refresh OK — token rotated');
        return token;
      })
      .catch((err: unknown) => {
        // Do NOT clear the in-memory token here. Refresh can fail for
        // reasons unrelated to session validity (cross-origin cookie
        // blocked by backend sameSite=strict, transient network blip).
        // If the caller needs to react, they can check getAccessToken().
        devLog('[auth/client] refresh FAILED — keeping in-memory token if any', err);
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const url = original?.url ?? '';

    const isAuthEndpoint =
      url.includes('/auth/refresh') ||
      url.includes('/auth/login') ||
      url.includes('/auth/register');

    if (status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      devLog('[auth/client] 401 intercepted for', url, '— attempting refresh');
      const token = await refreshAccessToken();
      if (token) {
        original.headers.set('Authorization', `Bearer ${token}`);
        return apiClient(original);
      }
      // Refresh failed. Only mark the session dead if we have NO token at
      // all. If we still have an in-memory token from a prior login, keep
      // the user signed in — the 401 was on one endpoint, not proof the
      // session is gone, and the refresh may be failing for cookie
      // reasons (backend sameSite=strict) rather than auth reasons.
      if (!accessToken) {
        devLog('[auth/client] no in-memory token after refresh failure — signaling unauthorized');
        onUnauthorized?.();
      } else {
        devLog('[auth/client] refresh failed but token still in memory — staying signed in');
      }
    }
    return Promise.reject(error);
  },
);

// Convenience wrappers used by resource modules — keeps per-module code thin.
export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await apiClient.get<T>(url, config);
  return res.data;
}
export async function apiPost<T, B = unknown>(
  url: string,
  body?: B,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await apiClient.post<T>(url, body, config);
  return res.data;
}
export async function apiPut<T, B = unknown>(
  url: string,
  body?: B,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await apiClient.put<T>(url, body, config);
  return res.data;
}
export async function apiPatch<T, B = unknown>(
  url: string,
  body?: B,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await apiClient.patch<T>(url, body, config);
  return res.data;
}
export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await apiClient.delete<T>(url, config);
  return res.data;
}
