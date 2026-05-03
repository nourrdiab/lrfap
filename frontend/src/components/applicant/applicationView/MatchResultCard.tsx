import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle, Loader2, XCircle } from 'lucide-react';
import { applicationsApi } from '../../../api/applications';
import { getApiErrorMessage } from '../../../utils/apiError';
import type {
  Application,
  ID,
  OfferStatus,
  Program,
  Specialty,
  University,
} from '../../../types';

/**
 * Match Result card shown on the Application Detail page when the
 * applicant has been matched. Owns the accept / decline flow with
 * confirmation modals; lifts the updated application back to the page
 * via `onApplicationUpdated` so cached status / offerStatus stay fresh
 * without requiring a refetch.
 */

interface MatchResultCardProps {
  application: Application;
  onApplicationUpdated: (next: Application) => void;
}

function populated<T extends { _id: ID }>(ref: ID | T | null | undefined): T | null {
  if (!ref || typeof ref === 'string') return null;
  return ref;
}

function formatOfferDeadline(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function offerStatusLabel(status: OfferStatus): string {
  switch (status) {
    case 'accepted':
      return 'Offer accepted';
    case 'declined':
      return 'Offer declined';
    case 'expired':
      return 'Offer expired';
    case 'pending':
      return 'Offer pending';
    default:
      return '';
  }
}

export function MatchResultCard({
  application,
  onApplicationUpdated,
}: MatchResultCardProps) {
  const program = populated<Program>(application.matchedProgram ?? null);
  const uni = program ? populated<University>(program.university) : null;
  const spec = program ? populated<Specialty>(program.specialty) : null;
  const trackLabel = program?.track === 'fellowship' ? 'Fellowship' : 'Residency';

  const [confirm, setConfirm] = useState<'accept' | 'decline' | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canDecide = application.offerStatus === 'pending';

  async function runDecision(kind: 'accept' | 'decline') {
    setIsWorking(true);
    setErrorMessage(null);
    try {
      const updated =
        kind === 'accept'
          ? await applicationsApi.acceptOffer(application._id)
          : await applicationsApi.declineOffer(application._id);
      onApplicationUpdated(updated);
      setConfirm(null);
    } catch (err) {
      setErrorMessage(
        getApiErrorMessage(
          err,
          kind === 'accept'
            ? 'Couldn’t accept the offer. Please try again.'
            : 'Couldn’t decline the offer. Please try again.',
        ),
      );
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section
      aria-labelledby="match-result-heading"
      className="border-[0.91px] border-lrfap-sky bg-sky-50/60 p-[24px] shadow-[0_4px_24px_-12px_rgba(38,43,102,0.1)]"
    >
      <div className="flex items-start gap-[12px]">
        <CheckCircle
          aria-hidden="true"
          className="mt-[2px] h-6 w-6 shrink-0 text-lrfap-sky"
        />
        <div className="min-w-0 flex-1">
          <h2
            id="match-result-heading"
            className="font-display text-[18px] font-bold uppercase tracking-wide text-lrfap-navy"
          >
            Match Result
          </h2>
          <p className="mt-[6px] font-sans text-[13px] text-slate-600">
            You&apos;ve been matched to the following program.
          </p>

          <dl className="mt-[16px] grid grid-cols-[auto_1fr] gap-x-[16px] gap-y-[6px] font-sans text-[13px]">
            <dt className="text-slate-500">Program:</dt>
            <dd className="font-semibold text-lrfap-navy">
              {spec?.name ?? 'Program'}
              {spec && program ? ` (${trackLabel})` : null}
            </dd>
            <dt className="text-slate-500">Institution:</dt>
            <dd className="font-semibold text-lrfap-navy">
              {uni?.name ?? '—'}
            </dd>
            {application.offerStatus !== 'none' ? (
              <>
                <dt className="text-slate-500">Status:</dt>
                <dd className="font-semibold text-lrfap-navy">
                  {offerStatusLabel(application.offerStatus)}
                </dd>
              </>
            ) : null}
            {canDecide && application.offerExpiresAt ? (
              <>
                <dt className="text-slate-500">Decision deadline:</dt>
                <dd className="font-semibold text-lrfap-navy">
                  {formatOfferDeadline(application.offerExpiresAt)}
                </dd>
              </>
            ) : null}
          </dl>

          {errorMessage ? (
            <p
              role="alert"
              className="mt-[14px] flex items-center gap-[8px] font-sans text-[12px] font-medium text-red-600"
            >
              <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
              {errorMessage}
            </p>
          ) : null}

          {canDecide ? (
            <div className="mt-[20px] flex flex-col gap-[12px] md:flex-row">
              <button
                type="button"
                onClick={() => setConfirm('accept')}
                className="inline-flex h-[44px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-sky bg-lrfap-sky px-[24px] font-sans text-[13px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-[#3a86bd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
              >
                <CheckCircle aria-hidden="true" className="h-4 w-4" />
                Accept Offer
              </button>
              <button
                type="button"
                onClick={() => setConfirm('decline')}
                className="inline-flex h-[44px] items-center justify-center gap-[8px] border-[0.91px] border-red-600 bg-white px-[24px] font-sans text-[13px] font-medium uppercase tracking-wide text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                <XCircle aria-hidden="true" className="h-4 w-4" />
                Decline Offer
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmDecisionDialog
        kind={confirm}
        isWorking={isWorking}
        onCancel={() => {
          if (isWorking) return;
          setConfirm(null);
          setErrorMessage(null);
        }}
        onConfirm={() => {
          if (!confirm) return;
          void runDecision(confirm);
        }}
      />
    </section>
  );
}

interface ConfirmDecisionDialogProps {
  kind: 'accept' | 'decline' | null;
  isWorking: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDecisionDialog({
  kind,
  isWorking,
  onCancel,
  onConfirm,
}: ConfirmDecisionDialogProps) {
  const open = !!kind;
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

  const heading = kind === 'accept' ? 'Accept this offer?' : 'Decline this offer?';
  const body =
    kind === 'accept'
      ? 'Accepting will confirm your match with this program and close your application for the current cycle. This action cannot be undone.'
      : 'Declining releases this match. You will not be offered another program in this cycle. This action cannot be undone.';
  const confirmLabel = kind === 'accept' ? 'Accept Offer' : 'Decline Offer';
  const confirmBtnCls =
    kind === 'accept'
      ? 'border-lrfap-sky bg-lrfap-sky text-white hover:bg-[#3a86bd] focus-visible:outline-lrfap-sky'
      : 'border-red-600 bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-700';

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="offer-decision-backdrop"
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
              aria-labelledby="offer-decision-title"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[520px] border-[0.91px] border-lrfap-ghost bg-white shadow-[0_10px_40px_-12px_rgba(38,43,102,0.25)]"
            >
              <div className="px-[28px] py-[24px]">
                <h2
                  id="offer-decision-title"
                  className="font-display text-[20px] font-bold uppercase tracking-wide text-lrfap-navy"
                >
                  {heading}
                </h2>
                <p className="mt-[12px] font-sans text-[14px] leading-relaxed text-slate-600">
                  {body}
                </p>
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
                  className={`inline-flex h-[40px] items-center justify-center gap-[8px] border-[0.91px] px-[22px] font-sans text-[13px] font-medium uppercase tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${confirmBtnCls}`}
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
