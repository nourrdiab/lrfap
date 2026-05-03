import { apiClient } from './client';
import type { ChatbotAskResponse, ChatbotTurn } from '../types';

/**
 * Wraps `POST /api/chatbot/ask` and surfaces the backend's rate-limit
 * headers alongside the response body. The UI needs `Ratelimit-Reset`
 * to drive the "slow down — try again in Ns" countdown, which means we
 * can't use the thin apiPost helper that only returns res.data.
 */

export interface ChatbotAskPayload {
  message: string;
  history?: ChatbotTurn[];
}

export interface ChatbotRateLimit {
  limit: number | null;
  remaining: number | null;
  /** Seconds until the current rate-limit window resets. */
  resetSeconds: number | null;
}

export interface ChatbotAskResult {
  data: ChatbotAskResponse;
  rateLimit: ChatbotRateLimit;
}

function readRateLimit(headers: unknown): ChatbotRateLimit {
  const h = (headers ?? {}) as Record<string, string | undefined>;
  const pick = (key: string): number | null => {
    const raw = h[key] ?? h[key.toLowerCase()];
    if (raw === undefined || raw === null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  return {
    limit: pick('ratelimit-limit'),
    remaining: pick('ratelimit-remaining'),
    resetSeconds: pick('ratelimit-reset'),
  };
}

export const chatbotApi = {
  async ask(body: ChatbotAskPayload): Promise<ChatbotAskResult> {
    const res = await apiClient.post<ChatbotAskResponse>('/chatbot/ask', body);
    return {
      data: res.data,
      rateLimit: readRateLimit(res.headers),
    };
  },
};
