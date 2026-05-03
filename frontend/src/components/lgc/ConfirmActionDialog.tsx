import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Loader2 } from 'lucide-react';

/**
 * Generic confirmation modal for LGC destructive/one-way actions
 * (advance cycle, run matching, publish results). Same shell as the
 * University SubmitConfirmDialog — backdrop, focus trap, Escape to
 * cancel unless currently working.
 *
 * Tone controls the accent color of the confirm button. "navy" is the
 * default for committed-but-reversible actions; "danger" for final or
 * destructive states (publish is effectively final, for example).
 */

export type ConfirmTone = 'navy' | 'danger';

interface ConfirmActionDialogProps {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  isWorking: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmActionDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'navy',
  isWorking,
  errorMessage,
  onCancel,
  onConfirm,
}: ConfirmActionDialogProps) {
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

  const confirmCls =
    tone === 'danger'
      ? 'border-red-600 bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600'
      : 'border-lrfap-navy bg-lrfap-navy text-white hover:bg-lrfap-navy/90 focus-visible:outline-lrfap-sky';

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="lgc-confirm-backdrop"
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
              aria-labelledby="lgc-confirm-title"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[520px] border-[0.91px] border-lrfap-ghost bg-white shadow-[0_10px_40px_-12px_rgba(38,43,102,0.25)]"
            >
              <div className="px-[28px] py-[24px]">
                <h2
                  id="lgc-confirm-title"
                  className="font-display text-[20px] font-bold uppercase tracking-wide text-lrfap-navy"
                >
                  {title}
                </h2>
                <div className="mt-[12px] font-sans text-[14px] leading-relaxed text-slate-600">
                  {body}
                </div>
                {errorMessage ? (
                  <p
                    role="alert"
                    className="mt-[14px] flex items-start gap-[8px] font-sans text-[13px] text-red-700"
                  >
                    <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </p>
                ) : null}
              </div>
              <div className="flex items-center justify-end gap-[12px] border-t border-lrfap-ghost bg-lrfap-ghost/30 px-[28px] py-[16px]">
                <button
                  ref={cancelBtnRef}
                  type="button"
                  disabled={isWorking}
                  onClick={onCancel}
                  className="inline-flex h-[40px] items-center justify-center border-[0.91px] border-lrfap-navy px-[18px] font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  disabled={isWorking}
                  onClick={onConfirm}
                  className={`inline-flex h-[40px] items-center justify-center gap-[8px] border-[0.91px] px-[22px] font-sans text-[13px] font-medium uppercase tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${confirmCls}`}
                >
                  {isWorking ? (
                    <>
                      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                      Working…
                    </>
                  ) : (
                    confirmLabel
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
