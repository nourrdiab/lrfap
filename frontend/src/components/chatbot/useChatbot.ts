import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AxiosError } from 'axios';
import { useReducedMotion } from 'framer-motion';
import { chatbotApi, type ChatbotRateLimit } from '../../api/chatbot';
import type { ChatbotTurn, ChatbotUIMessage } from '../../types';

/**
 * State + effects for the chatbot panel. Owns:
 *   - the rendered message list (welcome + user/model turns)
 *   - the in-flight `isThinking` flag used to render the typing dots
 *   - rate-limit state (only blocks on an actual 429, not on `Remaining=0`
 *     — the server is authoritative, no point pre-emptively disabling send)
 *
 * History sent back to the server is derived from messages: only turns
 * with status === 'sent', and never the synthetic welcome bubble
 * (`id === 'welcome'`). The welcome is rendered as a model bubble
 * purely for UX — sending it as history would confuse the model.
 */

const WELCOME_ID = 'welcome';

export interface UseChatbotOptions {
  welcomeText: string;
  open: boolean;
}

export interface RateLimitState {
  /** Epoch ms at which the server-imposed block expires. null when not blocked. */
  blockedUntilMs: number | null;
  /** Most recently observed remaining-request count from headers. null if unknown. */
  remaining: number | null;
  /** The window size the backend advertises. null until first response. */
  limit: number | null;
  /** Live countdown of seconds until block expires. 0 when not blocked. */
  secondsUntilUnblocked: number;
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function mapErrorToText(err: unknown): {
  userText: string;
  blockSeconds: number | null;
  rateLimit: ChatbotRateLimit | null;
} {
  if (err instanceof AxiosError) {
    const status = err.response?.status;
    const headers = err.response?.headers;
    const rl = headers
      ? {
          limit: numericHeader(headers, 'ratelimit-limit'),
          remaining: numericHeader(headers, 'ratelimit-remaining'),
          resetSeconds: numericHeader(headers, 'ratelimit-reset'),
        }
      : null;

    if (status === 400) {
      return {
        userText: 'Your message was invalid. Please try rephrasing.',
        blockSeconds: null,
        rateLimit: rl,
      };
    }
    if (status === 429) {
      const reset =
        numericHeader(headers ?? {}, 'ratelimit-reset') ?? 60;
      return {
        userText: `Too many messages. Try again in ${reset}s.`,
        blockSeconds: reset,
        rateLimit: rl,
      };
    }
    if (status === 503) {
      return {
        userText: 'The assistant is temporarily unavailable. Please try again later.',
        blockSeconds: null,
        rateLimit: rl,
      };
    }
    if (typeof status === 'number' && status >= 500) {
      return {
        userText: 'The assistant couldn’t respond. Please try again.',
        blockSeconds: null,
        rateLimit: rl,
      };
    }
    if (!err.response) {
      return {
        userText:
          'Couldn’t reach the assistant. Check your connection and try again.',
        blockSeconds: null,
        rateLimit: null,
      };
    }
  }
  return {
    userText: 'Something went wrong. Please try again.',
    blockSeconds: null,
    rateLimit: null,
  };
}

function numericHeader(headers: unknown, key: string): number | null {
  const h = (headers ?? {}) as Record<string, string | undefined>;
  const raw = h[key] ?? h[key.toLowerCase()];
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function useChatbot({ welcomeText, open }: UseChatbotOptions) {
  const welcomeMessage: ChatbotUIMessage = useMemo(
    () => ({
      id: WELCOME_ID,
      role: 'model',
      text: welcomeText,
      createdAt: new Date().toISOString(),
      status: 'sent',
    }),
    [welcomeText],
  );

  const reduceMotion = useReducedMotion();

  const [messages, setMessages] = useState<ChatbotUIMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [rate, setRate] = useState<{
    limit: number | null;
    remaining: number | null;
    blockedUntilMs: number | null;
  }>({ limit: null, remaining: null, blockedUntilMs: null });

  // Seed the welcome message when the panel first opens (and re-seed if
  // welcome text changes mid-session, e.g. user logs in). The brief
  // "typing" indicator before the greeting fires on the first open per
  // welcome — closing and reopening preserves the conversation and
  // does not re-type.
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (!open) return;
    if (seededFor.current === welcomeText) return;

    if (reduceMotion) {
      setMessages([welcomeMessage]);
      setIsThinking(false);
      seededFor.current = welcomeText;
      return;
    }

    setMessages([]);
    setIsThinking(true);
    const t = setTimeout(() => {
      setMessages([welcomeMessage]);
      setIsThinking(false);
      seededFor.current = welcomeText;
    }, 1000);
    return () => clearTimeout(t);
  }, [open, welcomeText, welcomeMessage, reduceMotion]);

  // Tick for the countdown while blocked.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!rate.blockedUntilMs) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [rate.blockedUntilMs]);

  const secondsUntilUnblocked =
    rate.blockedUntilMs && rate.blockedUntilMs > now
      ? Math.ceil((rate.blockedUntilMs - now) / 1000)
      : 0;

  // Clear the block once the countdown hits zero.
  useEffect(() => {
    if (!rate.blockedUntilMs) return;
    if (rate.blockedUntilMs > now) return;
    setRate((r) => ({ ...r, blockedUntilMs: null }));
  }, [rate.blockedUntilMs, now]);

  const rateLimit: RateLimitState = {
    blockedUntilMs: rate.blockedUntilMs,
    remaining: rate.remaining,
    limit: rate.limit,
    secondsUntilUnblocked,
  };

  const isBlocked = rateLimit.secondsUntilUnblocked > 0;

  const sendableHistory = useMemo<ChatbotTurn[]>(
    () =>
      messages
        .filter((m) => m.id !== WELCOME_ID && m.status === 'sent')
        .map((m) => ({ role: m.role, text: m.text })),
    [messages],
  );

  const send = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text) return;
      if (isBlocked) return;

      const userMsg: ChatbotUIMessage = {
        id: genId('user'),
        role: 'user',
        text,
        createdAt: new Date().toISOString(),
        status: 'sending',
      };

      // Snapshot history BEFORE the user message so the server sees the
      // prior exchange only — the current message goes in `message`,
      // not in `history`.
      const history = sendableHistory;

      setMessages((prev) => [...prev, userMsg]);
      setIsThinking(true);

      try {
        const res = await chatbotApi.ask({ message: text, history });
        setMessages((prev) =>
          prev
            .map((m) =>
              m.id === userMsg.id ? { ...m, status: 'sent' as const } : m,
            )
            .concat({
              id: genId('model'),
              role: 'model',
              text: res.data.response ?? '',
              createdAt: new Date().toISOString(),
              status: 'sent',
            }),
        );
        setRate((r) => ({
          limit: res.rateLimit.limit ?? r.limit,
          remaining: res.rateLimit.remaining ?? r.remaining,
          blockedUntilMs: r.blockedUntilMs,
        }));
      } catch (err) {
        const mapped = mapErrorToText(err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === userMsg.id
              ? {
                  ...m,
                  status: 'error' as const,
                  errorText: mapped.userText,
                }
              : m,
          ),
        );
        const blockSeconds = mapped.blockSeconds;
        if (blockSeconds && blockSeconds > 0) {
          setRate((r) => ({
            limit: mapped.rateLimit?.limit ?? r.limit,
            remaining: mapped.rateLimit?.remaining ?? 0,
            blockedUntilMs: Date.now() + blockSeconds * 1000,
          }));
        } else if (mapped.rateLimit) {
          setRate((r) => ({
            limit: mapped.rateLimit?.limit ?? r.limit,
            remaining: mapped.rateLimit?.remaining ?? r.remaining,
            blockedUntilMs: r.blockedUntilMs,
          }));
        }
      } finally {
        setIsThinking(false);
      }
    },
    [sendableHistory, isBlocked],
  );

  const retry = useCallback(
    (messageId: string) => {
      const target = messages.find((m) => m.id === messageId);
      if (!target || target.role !== 'user') return;
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      void send(target.text);
    },
    [messages, send],
  );

  return {
    messages,
    isThinking,
    rateLimit,
    isBlocked,
    send,
    retry,
  };
}
