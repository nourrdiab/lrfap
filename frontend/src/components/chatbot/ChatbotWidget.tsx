import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { MessageCircle, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ChatbotPanel } from './ChatbotPanel';
import { useChatbot } from './useChatbot';
import type { User } from '../../types';

/**
 * Floating chatbot launcher + panel, mounted once per authenticated /
 * public layout.
 *
 * Positioning is fixed bottom-right on every viewport. On narrow
 * screens (<640px) the open panel covers the whole viewport; on wider
 * screens it floats as a 400×620 panel anchored bottom-right.
 *
 * First-visit tease bubble is gated by sessionStorage — one appearance
 * per browser-session per tab. Clicking the bubble, clicking the main
 * widget, or the 6-second auto-dismiss timer all count as "seen", so
 * re-opening a second time in the same session won't show it again.
 */

const TEASE_KEY = 'lrfap-chatbot-teased-v1';
const TEASE_APPEAR_DELAY_MS = 1200;
const TEASE_AUTO_DISMISS_MS = 6000;

function buildWelcome(user: User | null, isAuthenticated: boolean): string {
  // Widget is only mounted on landing / public / applicant surfaces, so
  // these two branches cover every real caller. The fallback mirrors
  // the logged-out copy for safety if this ever renders elsewhere —
  // the bot explains platform concepts, it doesn't look up personal
  // data, so we don't promise role-specific workflow help.
  if (isAuthenticated && user && user.role === 'applicant') {
    const firstName = user.firstName?.trim() || 'there';
    return `Hi ${firstName}! I can help you understand how LRFAP works. Ask me about programs, the matching algorithm, or application steps.`;
  }
  return "Hi! I can help explain how LRFAP works. Ask me about programs, the matching process, or how to apply.";
}

function readTeaseSeen(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.sessionStorage.getItem(TEASE_KEY) === '1';
  } catch {
    return true;
  }
}

function markTeaseSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(TEASE_KEY, '1');
  } catch {
    // Storage unavailable (private mode, quota) — tease won't re-appear
    // within this component's lifetime anyway because we track it in
    // state; losing the sessionStorage write is harmless.
  }
}

export function ChatbotWidget() {
  const { user, isAuthenticated } = useAuth();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [teaseVisible, setTeaseVisible] = useState(false);

  const welcomeText = useMemo(
    () => buildWelcome(user, isAuthenticated),
    [user, isAuthenticated],
  );

  const chat = useChatbot({ welcomeText, open });

  // Lock body scroll while the panel is open on mobile viewports.
  // Desktop (≥640px) floats alongside page content and doesn't need
  // to lock scroll.
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia('(max-width: 639px)');
    if (!mq.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Show tease bubble once per session on first render.
  useEffect(() => {
    if (readTeaseSeen()) return;
    const tAppear = setTimeout(() => {
      setTeaseVisible(true);
      markTeaseSeen();
    }, TEASE_APPEAR_DELAY_MS);
    return () => clearTimeout(tAppear);
  }, []);

  // Auto-dismiss the tease after it's been visible long enough.
  useEffect(() => {
    if (!teaseVisible) return;
    const tDismiss = setTimeout(() => {
      setTeaseVisible(false);
    }, TEASE_AUTO_DISMISS_MS);
    return () => clearTimeout(tDismiss);
  }, [teaseVisible]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    setTeaseVisible(false);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <>
      {/* Open panel.
          - Mobile (<640px wide): full-screen overlay, edge-to-edge.
          - Desktop (≥640px wide): 400×620 floating at bottom-right,
            height capped at calc(100dvh - 48px) so the top can't
            overflow the viewport on shorter windows.
          transformOrigin is bottom-right so the open/close scale
          animation grows out of the launcher button's corner rather
          than from the panel's center (which would pan off-screen on
          tall panels). */}
      <AnimatePresence>
        {open ? (
          <motion.div
            key="chatbot-panel"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
            animate={
              reduceMotion
                ? { opacity: 1, transition: { duration: 0.15, ease: 'easeOut' } }
                : { opacity: 1, scale: 1, transition: { duration: 0.22, ease: 'easeOut' } }
            }
            exit={
              reduceMotion
                ? { opacity: 0, transition: { duration: 0.12, ease: 'easeIn' } }
                : { opacity: 0, scale: 0.85, transition: { duration: 0.18, ease: 'easeIn' } }
            }
            style={{ transformOrigin: 'bottom right' }}
            className="fixed left-0 right-0 top-0 bottom-0 z-40 sm:left-auto sm:top-auto sm:right-[24px] sm:bottom-[24px] sm:h-[min(620px,calc(100dvh-48px))] sm:w-[400px]"
          >
            <ChatbotPanel
              open={open}
              messages={chat.messages}
              isThinking={chat.isThinking}
              rateLimit={chat.rateLimit}
              isBlocked={chat.isBlocked}
              onClose={handleClose}
              onSend={chat.send}
              onRetry={chat.retry}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Launcher + tease. Hidden when panel is open (panel owns its own close). */}
      {open ? null : (
        <div className="fixed bottom-[16px] right-[16px] z-40 flex items-center gap-[10px] sm:bottom-[24px] sm:right-[24px]">
          <AnimatePresence>
            {teaseVisible ? (
              <motion.div
                key="chatbot-tease"
                initial={{ opacity: 0, x: 6, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 6, scale: 0.96 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="relative hidden sm:block"
              >
                <button
                  type="button"
                  onClick={handleOpen}
                  className="relative block rounded-lg bg-white px-[14px] py-[8px] pr-[36px] font-sans text-[13px] font-medium text-lrfap-navy shadow-[0_8px_28px_rgba(38,43,102,0.45)] transition-colors hover:bg-lrfap-ghost/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy"
                >
                  Ask me anything
                  <span
                    aria-hidden="true"
                    className="absolute -right-[5px] top-1/2 h-[10px] w-[10px] -translate-y-1/2 rotate-45 bg-white shadow-[0_8px_28px_rgba(38,43,102,0.45)]"
                  />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTeaseVisible(false);
                  }}
                  aria-label="Dismiss"
                  className="absolute right-[6px] top-[4px] inline-flex h-[18px] w-[18px] items-center justify-center text-slate-400 transition-colors hover:text-lrfap-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy"
                >
                  <X aria-hidden="true" className="h-3 w-3" />
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <button
            type="button"
            onClick={handleOpen}
            aria-label="Open LRFAP assistant"
            aria-expanded={open}
            className="relative inline-flex h-[56px] w-[56px] items-center justify-center rounded-full bg-lrfap-navy text-white shadow-[0_10px_24px_-8px_rgba(38,43,102,0.45),0_0_12px_2px_rgba(255,255,255,0.35)] transition-transform hover:scale-[1.04] hover:bg-lrfap-navy/95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lrfap-sky"
          >
            <MessageCircle
              aria-hidden="true"
              className="h-6 w-6"
              strokeWidth={1.75}
            />
          </button>
        </div>
      )}
    </>
  );
}
