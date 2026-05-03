import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

/**
 * Confirmation modal for submitting a program ranking. Mirrors the
 * MatchResultCard's ConfirmDecisionDialog: backdrop, focus trap, Escape
 * to cancel (when not working), click-outside to cancel. Kept local to
 * the ranking bundle — if a third caller shows up, lift this to shared.
 */

interface SubmitConfirmDialogProps {
  open: boolean;
  rankedCount: number;
  unrankedCount: number;
  isWorking: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SubmitConfirmDialog({
  open,
  rankedCount,
  unrankedCount,
  isWorking,
  onCancel,
  onConfirm,
}: SubmitConfirmDialogProps) {
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelBtnRef.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isWorking) {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, isWorking, onCancel]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="submit-ranking-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={isWorking ? undefined : onCancel}
          className="fixed inset-0 z-40 bg-black/40"
        >
          <div className="flex min-h-full items-center justify-center p-6">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="submit-ranking-title"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[560px] border-[0.91px] border-lrfap-ghost bg-white shadow-[0_10px_40px_-12px_rgba(38,43,102,0.25)]"
            >
              <div className="px-[28px] py-[24px]">
                <h2
                  id="submit-ranking-title"
                  className="font-display text-[20px] font-bold uppercase tracking-wide text-lrfap-navy"
                >
                  Submit Rankings?
                </h2>
                <p className="mt-[12px] font-sans text-[14px] leading-relaxed text-slate-600">
                  This action is final and cannot be undone. Your ranking will
                  be used in the matching algorithm.
                </p>
                <ul
                  role="list"
                  className="mt-[14px] flex flex-col gap-[4px] border-l-[3px] border-lrfap-sky bg-lrfap-sky/5 px-[14px] py-[10px] font-sans text-[13px] text-lrfap-navy"
                >
                  <li>
                    <strong className="font-semibold">{rankedCount}</strong>{' '}
                    {rankedCount === 1 ? 'applicant' : 'applicants'} will be
                    submitted in your ranking.
                  </li>
                  {unrankedCount > 0 ? (
                    <li>
                      <strong className="font-semibold">{unrankedCount}</strong>{' '}
                      eligible {unrankedCount === 1 ? 'applicant' : 'applicants'}{' '}
                      will <em>not</em> be matched to this program.
                    </li>
                  ) : null}
                </ul>
              </div>
              <div className="flex items-center justify-end gap-[12px] border-t border-lrfap-ghost bg-lrfap-ghost/30 px-[28px] py-[16px]">
                <button
                  ref={cancelBtnRef}
                  type="button"
                  disabled={isWorking}
                  onClick={onCancel}
                  className="inline-flex h-[40px] items-center justify-center border-[0.91px] border-lrfap-navy px-[18px] font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isWorking}
                  onClick={onConfirm}
                  className="inline-flex h-[40px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[22px] font-sans text-[13px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isWorking ? (
                    <>
                      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    'Submit Rankings'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
