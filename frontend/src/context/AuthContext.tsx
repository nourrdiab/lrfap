import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AxiosError } from 'axios';
import { authApi } from '../api/auth';
import {
  registerUnauthorizedHandler,
  setAccessToken as setClientAccessToken,
} from '../api/client';
import type { User } from '../types';

// eslint-disable-next-line no-console
const devLog: typeof console.log = import.meta.env.DEV
  ? console.log.bind(console)
  : () => {};

export interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const hasBootstrapped = useRef(false);

  const applyToken = useCallback((token: string | null) => {
    setClientAccessToken(token);
    setAccessTokenState(token);
    devLog('[auth/context] applyToken:', token ? 'SET' : 'CLEARED');
  }, []);

  const clearSession = useCallback(() => {
    devLog('[auth/context] clearSession() CALLED — stack:', new Error().stack);
    applyToken(null);
    setUser(null);
  }, [applyToken]);

  // On app load, try to silently refresh — best-effort rehydration of the
  // previous session. Must NOT clear an in-memory session established by a
  // concurrent register/login call, and must NEVER leave isBootstrapping
  // stuck at true (which would hang every protected route behind a spinner).
  //
  // Known backend limitation: the refresh cookie is set with sameSite=strict,
  // which the browser blocks on cross-origin requests (localhost:5173 →
  // lrfap-backend.vercel.app). That's tracked as a backend fix (sameSite
  // must be 'none' + secure in production). Until that ships, this call
  // will 401 on page reload for most users and they'll need to re-login
  // if their in-memory access token has expired. Within a single session
  // (register/login → use app), the in-memory token is sufficient.
  useEffect(() => {
    if (hasBootstrapped.current) {
      devLog('[auth/context] bootstrap skipped — already ran this session');
      return;
    }
    hasBootstrapped.current = true;
    devLog('[auth/context] bootstrap START — calling authApi.refresh()');

    (async () => {
      try {
        const res = await authApi.refresh();
        applyToken(res.accessToken);
        const maybeUser = (res as unknown as { user?: User }).user;
        if (maybeUser) setUser(maybeUser);
        devLog('[auth/context] bootstrap SUCCESS — session hydrated');
      } catch {
        // Intentionally no clearSession(): if an in-memory token exists
        // from a concurrent register/login it must survive. With no token
        // in memory, isAuthenticated is already false — nothing to clear.
        devLog('[auth/context] bootstrap refresh failed — leaving state as-is');
      } finally {
        setIsBootstrapping(false);
        devLog('[auth/context] bootstrap COMPLETE — isBootstrapping = false');
      }
    })();
  }, [applyToken]);

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      clearSession();
    });
  }, [clearSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login({ email, password });
      applyToken(res.accessToken);
      setUser(res.user);
      return res.user;
    },
    [applyToken],
  );

  const register = useCallback(
    async (payload: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    }) => {
      const res = await authApi.register(payload);
      applyToken(res.accessToken);
      setUser(res.user);
      return res.user;
    },
    [applyToken],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      // Swallow network errors — worst case the refresh cookie stays until expiry.
      if (!(err instanceof AxiosError)) throw err;
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isAuthenticated: !!accessToken,
      isBootstrapping,
      login,
      register,
      logout,
    }),
    [user, accessToken, isBootstrapping, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
