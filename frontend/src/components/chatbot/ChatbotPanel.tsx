import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Send, X } from 'lucide-react';
import { ChatbotMessage } from './ChatbotMessage';
import { ChatbotTypingIndicator } from './ChatbotTypingIndicator';
import type { ChatbotUIMessage } from '../../types';
import type { RateLimitState } from './useChatbot';

/**
 * Chat panel (the "expanded" state of the widget). Owns:
 *   - keyboard shortcuts: Esc closes, Enter sends, Shift+Enter newline
 *   - auto-scroll to bottom on new message, but suspended when the
 *     user has scrolled up (they're reading — don't yank them back)
 *   - textarea autogrow up to ~4 rows, disabled while the rate-limit
 *     countdown is active
 *
 * Does NOT own message state — the parent hook does. This component is
 * presentational and event-forwarding only, so the same hook instance
 * can persist across open/close without state being tied to panel
 * lifetime.
 */

const MAX_MESSAGE_LENGTH = 2000;
const AUTOSCROLL_SLOP_PX = 48;

interface ChatbotPanelProps {
  open: boolean;
  messages: ChatbotUIMessage[];
  isThinking: boolean;
  rateLimit: RateLimitState;
  isBlocked: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
  onRetry: (id: string) => void;
}

export function ChatbotPanel({
  open,
  messages,
  isThinking,
  rateLimit,
  isBlocked,
  onClose,
  onSend,
  onRetry,
}: ChatbotPanelProps) {
  const [draft, setDraft] = useState('');
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const pinnedToBottomRef = useRef(true);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Autofocus input when opening.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  // Track whether the user is scrolled to (near) bottom. If they are,
  // auto-scroll on new content. If they've scrolled up to read, leave
  // them alone.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    pinnedToBottomRef.current = distanceFromBottom <= AUTOSCROLL_SLOP_PX;
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    if (!pinnedToBottomRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [open, messages.length, isThinking]);

  // Always pin-to-bottom when opening fresh.
  useEffect(() => {
    if (!open) return;
    pinnedToBottomRef.current = true;
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [open]);

  // Autogrow textarea to content, capped at ~4 rows.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitDraft();
    }
  }

  function submitDraft() {
    const text = draft.trim();
    if (!text) return;
    if (isBlocked || isThinking) return;
    onSend(text);
    setDraft('');
  }

  const blockedHint =
    rateLimit.secondsUntilUnblocked > 0
      ? `Rate limit. Try again in ${rateLimit.secondsUntilUnblocked}s.`
      : null;

  const sendDisabled =
    draft.trim().length === 0 || isBlocked || isThinking;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="LRFAP assistant"
      className="flex h-full w-full flex-col overflow-hidden bg-white shadow-[0_24px_72px_-12px_rgba(38,43,102,0.5)] will-change-transform sm:rounded-xl"
    >
      <header className="flex items-center justify-between gap-[12px] bg-lrfap-navy px-[16px] py-[14px] text-white sm:rounded-t-xl">
        <div className="flex items-center gap-[8px]">
          <img
            src="/logos/favicon-white.png"
            alt=""
            aria-hidden="true"
            className="h-[24px] w-[24px]"
          />
          <span className="font-display text-[16px] font-bold uppercase tracking-wide text-white">
            LRFAP
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="inline-flex h-[32px] w-[32px] shrink-0 items-center justify-center text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </header>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className="flex-1 overflow-y-auto bg-white px-[16px] py-[14px]"
      >
        <ul className="flex flex-col gap-[10px]" role="list">
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.li
                key={m.id}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <ChatbotMessage message={m} onRetry={onRetry} />
              </motion.li>
            ))}
            {isThinking ? (
              <motion.li
                key="typing"
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <ChatbotTypingIndicator />
              </motion.li>
            ) : null}
          </AnimatePresence>
        </ul>
      </div>

      <div className="bg-white px-[12px] pb-[12px] pt-[10px]">
        {blockedHint ? (
          <p
            role="status"
            className="mb-[8px] font-sans text-[11px] font-medium text-amber-700"
          >
            {blockedHint}
          </p>
        ) : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitDraft();
          }}
          className="flex items-end gap-[8px]"
        >
          <label htmlFor="chatbot-input" className="sr-only">
            Message
          </label>
          <textarea
            id="chatbot-input"
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isBlocked}
            placeholder={
              isBlocked
                ? 'Please wait…'
                : 'Type a message…'
            }
            maxLength={MAX_MESSAGE_LENGTH}
            className="min-h-[38px] max-h-[120px] flex-1 resize-none rounded-xl bg-lrfap-ghost/40 px-[12px] py-[8px] font-sans text-[13px] leading-[1.5] text-slate-900 transition-colors placeholder:text-slate-400 focus:bg-lrfap-ghost/60 focus:outline-none focus:ring-2 focus:ring-lrfap-sky/60 disabled:cursor-not-allowed disabled:bg-slate-50"
          />
          <button
            type="submit"
            disabled={sendDisabled}
            aria-label="Send message"
            className="inline-flex h-[38px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-lrfap-navy text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            <Send aria-hidden="true" className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
