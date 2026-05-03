import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AxiosError } from 'axios';
import {
  AlertCircle,
  Award,
  CheckCircle,
  FolderOpen,
  GraduationCap,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { applicationsApi } from '../../api/applications';
import { cyclesApi } from '../../api/cycles';
import { getApiErrorMessage } from '../../utils/apiError';
import type {
  Application,
  ApplicationStatus,
  Cycle,
  ID,
  Program,
  Track,
} from '../../types';

/**
 * My Applications — entry point for creating new applications and
 * jumping back into drafts or viewing submitted applications.
 *
 * Handles the create flow (residency/fellowship modal → POST /applications
 * → redirect to draft edit), duplicate redirect (if a draft already
 * exists for the active cycle + chosen track, jump straight there),
 * discard of drafts (DELETE /applications/:id), and error surfacing from
 * other pages via the ?error= query param (e.g. the wizard 404s a
 * missing draft).
 */

type FetchStatus = 'idle' | 'loading' | 'loaded' | 'error';

// eslint-disable-next-line no-console
const devWarn: typeof console.warn = import.meta.env.DEV
  ? console.warn.bind(console)
  : () => {};

function idOf(ref: ID | { _id: ID } | null | undefined): ID | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref._id;
}

function populated<T extends { _id: ID }>(ref: ID | T | null | undefined): T | null {
  if (!ref || typeof ref === 'string') return null;
  return ref;
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface StatusPresentation {
  label: string;
  badgeCls: string;
}

function presentStatus(status: ApplicationStatus): StatusPresentation {
  switch (status) {
    case 'draft':
      return { label: 'Draft', badgeCls: 'bg-slate-100 text-slate-700 border-slate-200' };
    case 'submitted':
      return { label: 'Submitted', badgeCls: 'bg-sky-50 text-sky-700 border-sky-200' };
    case 'under_review':
      return {
        label: 'Under Review',
        badgeCls: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    case 'matched':
      return { label: 'Matched', badgeCls: 'bg-green-50 text-green-700 border-green-200' };
    case 'unmatched':
      return { label: 'Unmatched', badgeCls: 'bg-slate-50 text-slate-700 border-slate-200' };
    case 'withdrawn':
      return { label: 'Withdrawn', badgeCls: 'bg-slate-50 text-slate-500 border-slate-200' };
    default:
      return { label: status, badgeCls: 'bg-slate-50 text-slate-700 border-slate-200' };
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  'application-not-found':
    "We couldn't find that application. It may have been removed or its URL was incorrect.",
};

export default function ApplicantMyApplicationsPage() {
  useDocumentTitle('My applications');
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationsStatus, setApplicationsStatus] = useState<FetchStatus>('idle');
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cyclesStatus, setCyclesStatus] = useState<FetchStatus>('idle');

  const [newModalOpen, setNewModalOpen] = useState(false);
  const [discardTarget, setDiscardTarget] = useState<Application | null>(null);

  const errorCode = searchParams.get('error');

  useEffect(() => {
    let cancelled = false;
    setApplicationsStatus('loading');
    applicationsApi
      .list()
      .then((res) => {
        if (cancelled) return;
        setApplications(res);
        setApplicationsStatus('loaded');
      })
      .catch(() => {
        if (!cancelled) setApplicationsStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCyclesStatus('loading');
    cyclesApi
      .list()
      .then((res) => {
        if (cancelled) return;
        setCycles(res);
        setCyclesStatus('loaded');
      })
      .catch(() => {
        if (!cancelled) setCyclesStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeCycle = useMemo<Cycle | null>(() => {
    const open = cycles.filter((c) => c.status === 'open');
    if (open.length > 1) {
      devWarn(
        `[MyApplications] Multiple open cycles detected; using the first: ${open[0].name}`,
      );
    }
    return open[0] ?? null;
  }, [cycles]);

  // Backend enforces one application per applicant per cycle regardless of
  // track. Look up whatever the applicant already has for the active cycle
  // (any status, any track) so we can block the create flow up front.
  const existingCycleApp = useMemo<Application | null>(() => {
    if (!activeCycle) return null;
    return (
      applications.find((a) => idOf(a.cycle) === activeCycle._id) ?? null
    );
  }, [applications, activeCycle]);

  // Sort: drafts for the active cycle first (by createdAt desc), then
  // everything else by createdAt desc. Keeps the applicant's primary
  // action on top.
  const sortedApplications = useMemo(() => {
    const activeCycleId = activeCycle?._id;
    const keyOf = (a: Application) =>
      a.status === 'draft' && idOf(a.cycle) === activeCycleId ? 0 : 1;
    return applications.slice().sort((a, b) => {
      const ka = keyOf(a);
      const kb = keyOf(b);
      if (ka !== kb) return ka - kb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [applications, activeCycle]);

  const handleDismissError = useCallback(() => {
    navigate(location.pathname, { replace: true });
  }, [navigate, location.pathname]);

  const handleApplicationCreated = useCallback(
    (created: Application) => {
      setApplications((prev) => [created, ...prev]);
      setNewModalOpen(false);
      navigate(`/applicant/applications/${created._id}/edit/profile`);
    },
    [navigate],
  );

  const handleDiscardConfirm = useCallback(async () => {
    if (!discardTarget)
      return { ok: false as const, error: 'Nothing selected to discard.' };
    try {
      await applicationsApi.remove(discardTarget._id);
      setApplications((prev) => prev.filter((a) => a._id !== discardTarget._id));
      setDiscardTarget(null);
      return { ok: true as const };
    } catch (err) {
      return {
        ok: false as const,
        error: getApiErrorMessage(err, 'Couldn’t discard draft. Please try again.'),
      };
    }
  }, [discardTarget]);

  const isLoading =
    applicationsStatus === 'loading' || cyclesStatus === 'loading';
  const isError = applicationsStatus === 'error';
  const hasApplications = applications.length > 0;
  const canStartNew = !!activeCycle && !existingCycleApp;
  const existingCycleAppTrack =
    existingCycleApp?.track === 'fellowship' ? 'fellowship' : 'residency';
  const cycleBlockMessage = existingCycleApp
    ? `You already have a ${existingCycleAppTrack} application for this cycle.`
    : null;

  return (
    <div className="mx-auto w-full max-w-[1366px] px-6 py-[40px] md:px-[58px]">
      {errorCode && ERROR_MESSAGES[errorCode] ? (
        <div
          role="alert"
          className="mb-[24px] flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
        >
          <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
          <span className="flex-1">{ERROR_MESSAGES[errorCode]}</span>
          <button
            type="button"
            onClick={handleDismissError}
            aria-label="Dismiss"
            className="shrink-0 text-red-700 hover:text-red-900"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <header className="mb-[32px] flex flex-col gap-[16px] md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-display text-[40px] font-extrabold leading-[1.1] text-lrfap-navy">
            MY APPLICATIONS
          </h1>
          <p className="mt-[8px] max-w-[620px] font-sans text-[15px] leading-relaxed text-slate-600">
            Manage your residency and fellowship drafts and submitted
            applications.
          </p>
        </div>
        <div className="flex flex-col items-end gap-[6px] md:pt-[6px]">
          <button
            type="button"
            onClick={() => setNewModalOpen(true)}
            disabled={!canStartNew || isLoading}
            title={cycleBlockMessage ?? undefined}
            className="inline-flex h-[44px] shrink-0 items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[22px] font-sans text-[14px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Start New Application
          </button>
          {cycleBlockMessage ? (
            <p className="font-sans text-[12px] text-slate-500">
              {cycleBlockMessage}
            </p>
          ) : !activeCycle && cyclesStatus === 'loaded' ? (
            <p className="font-sans text-[12px] text-slate-500">
              No cycle is currently open for applications.
            </p>
          ) : null}
        </div>
      </header>

      {isLoading ? (
        <SkeletonList />
      ) : isError ? (
        <div
          role="alert"
          className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
        >
          <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
          <span>
            Couldn&apos;t load your applications. Refresh the page to try again.
          </span>
        </div>
      ) : !hasApplications ? (
        <EmptyState
          canStartNew={canStartNew}
          onStartNew={() => setNewModalOpen(true)}
        />
      ) : (
        <ul role="list" className="flex flex-col gap-[16px]">
          {sortedApplications.map((app) => (
            <li key={app._id}>
              <ApplicationCard
                application={app}
                onDiscardRequest={(target) => setDiscardTarget(target)}
              />
            </li>
          ))}
        </ul>
      )}

      <StartApplicationModal
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        activeCycle={activeCycle}
        applications={applications}
        onApplicationCreated={handleApplicationCreated}
      />

      <ConfirmDiscardDialog
        draft={discardTarget}
        onConfirm={handleDiscardConfirm}
        onCancel={() => setDiscardTarget(null)}
      />
    </div>
  );
}

// ---- Application card -------------------------------------------------

interface ApplicationCardProps {
  application: Application;
  onDiscardRequest: (target: Application) => void;
}

function ApplicationCard({ application, onDiscardRequest }: ApplicationCardProps) {
  const { label: statusLabel, badgeCls } = presentStatus(application.status);
  const cycle = populated<Cycle>(application.cycle);
  const yearLabel = cycle?.year ? String(cycle.year) : '—';
  const trackLabel = application.track === 'fellowship' ? 'Fellowship' : 'Residency';
  const isDraft = application.status === 'draft';

  const selectionsCount = application.selections.length;
  const progressLabel = selectionsCount > 0 ? 'In progress' : 'Not started';

  const matchedProgram = populated<Program>(application.matchedProgram ?? null);
  const matchedLabel = matchedProgram
    ? `${populated(matchedProgram.specialty)?.name ?? 'Program'} at ${
        populated(matchedProgram.university)?.name ?? '—'
      }`
    : null;

  return (
    <article
      role="article"
      className="border-[0.91px] border-lrfap-ghost bg-white shadow-[0_4px_24px_-12px_rgba(38,43,102,0.1)]"
    >
      <div className="flex flex-col gap-[16px] px-[24px] py-[20px] md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-[12px]">
            <h2 className="font-display text-[18px] font-bold uppercase tracking-wide text-lrfap-navy">
              {yearLabel} · {trackLabel.toUpperCase()}
            </h2>
            <span
              role="status"
              aria-label={`Status: ${statusLabel}`}
              className={`inline-flex items-center border px-[10px] py-[2px] font-sans text-[11px] font-medium uppercase tracking-wide ${badgeCls}`}
            >
              {statusLabel}
            </span>
          </div>

          <dl className="mt-[12px] flex flex-col gap-[6px] font-sans text-[13px] text-slate-600">
            {isDraft ? (
              <>
                <Row label="Programs selected" value={String(selectionsCount)} />
                <Row label="Progress" value={progressLabel} />
                <Row label="Updated" value={relativeTime(application.updatedAt)} />
              </>
            ) : (
              <>
                {application.submissionReference ? (
                  <Row
                    label="Reference"
                    value={application.submissionReference}
                    mono
                  />
                ) : null}
                <Row label="Programs selected" value={String(selectionsCount)} />
                {matchedLabel ? (
                  <Row label="Matched to" value={matchedLabel} />
                ) : null}
                <Row
                  label={
                    application.status === 'withdrawn' ? 'Withdrawn' : 'Submitted'
                  }
                  value={formatLongDate(
                    application.submittedAt ?? application.updatedAt,
                  )}
                />
              </>
            )}
          </dl>
        </div>

        <div className="flex flex-col items-end gap-[8px] md:shrink-0">
          {isDraft ? (
            <>
              <Link
                to={`/applicant/applications/${application._id}/edit`}
                className="inline-flex h-[40px] items-center justify-center border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[20px] font-sans text-[13px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
              >
                Continue Editing
              </Link>
              <button
                type="button"
                onClick={() => onDiscardRequest(application)}
                className="font-sans text-[12px] font-medium text-red-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
              >
                Discard draft
              </button>
            </>
          ) : (
            <Link
              to={`/applicant/applications/${application._id}`}
              className="inline-flex h-[40px] items-center justify-center border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[20px] font-sans text-[13px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
            >
              View Application
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-x-[12px]">
      <dt className="shrink-0 font-medium text-slate-500">{label}:</dt>
      <dd className={mono ? 'font-mono font-semibold text-slate-700' : 'text-slate-700'}>
        {value}
      </dd>
    </div>
  );
}

// ---- Empty state ------------------------------------------------------

function EmptyState({
  canStartNew,
  onStartNew,
}: {
  canStartNew: boolean;
  onStartNew: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-[16px] border border-dashed border-lrfap-ghost bg-white/60 px-6 py-[80px] text-center">
      <FolderOpen
        aria-hidden="true"
        className="h-[64px] w-[64px] text-slate-300"
        strokeWidth={1.5}
      />
      <h2 className="font-display text-[24px] font-bold text-lrfap-navy">
        No applications yet
      </h2>
      <p className="max-w-[440px] font-sans text-[14px] text-slate-600">
        Start your first application — choose residency or fellowship to get
        going.
      </p>
      <button
        type="button"
        onClick={onStartNew}
        disabled={!canStartNew}
        className="mt-[8px] inline-flex h-[48px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[28px] font-sans text-[14px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
        Start New Application
      </button>
      {!canStartNew ? (
        <p className="font-sans text-[12px] text-slate-500">
          No cycle is currently open for applications.
        </p>
      ) : null}
    </div>
  );
}

// ---- Skeleton ---------------------------------------------------------

function SkeletonList() {
  return (
    <ul role="list" aria-busy="true" className="flex flex-col gap-[16px]">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="h-[144px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50"
        />
      ))}
    </ul>
  );
}

// ---- Start New Application modal --------------------------------------

interface StartApplicationModalProps {
  open: boolean;
  onClose: () => void;
  activeCycle: Cycle | null;
  applications: Application[];
  onApplicationCreated: (application: Application) => void;
}

type StartState = 'picking' | 'creating' | 'duplicate';

function StartApplicationModal({
  open,
  onClose,
  activeCycle,
  applications,
  onApplicationCreated,
}: StartApplicationModalProps) {
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<StartState>('picking');
  const [track, setTrack] = useState<Track | null>(null);
  const [duplicateDraft, setDuplicateDraft] = useState<Application | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset modal internal state each time it opens.
  useEffect(() => {
    if (open) {
      setState('picking');
      setTrack(null);
      setDuplicateDraft(null);
      setErrorMessage(null);
    }
  }, [open]);

  // Focus trap + Escape + body-scroll lock.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled])',
      );
      first?.focus();
    });

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && state !== 'creating') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
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
  }, [open, state, onClose]);

  const canContinue = !!track && !!activeCycle && state === 'picking';

  // Backend policy: one application per applicant per cycle regardless of
  // track. Match any application for the active cycle — not just drafts of
  // the clicked track.
  function findExistingCycleApp(): Application | null {
    if (!activeCycle) return null;
    return (
      applications.find((a) => idOf(a.cycle) === activeCycle._id) ?? null
    );
  }

  async function handleContinue() {
    if (!track || !activeCycle) return;

    // Local pre-check: any existing app for the cycle blocks creation.
    const local = findExistingCycleApp();
    if (local) {
      setDuplicateDraft(local);
      setState('duplicate');
      return;
    }

    setState('creating');
    setErrorMessage(null);
    try {
      const created = await applicationsApi.create({
        cycleId: activeCycle._id,
        track,
      });
      onApplicationCreated(created);
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 409) {
        // Race: another tab created an application between our list-load
        // and this create. Refetch and surface whatever exists for the
        // cycle — panel copy handles same-track vs cross-track cases.
        try {
          const refreshed = await applicationsApi.list();
          const dupe = refreshed.find(
            (a) => idOf(a.cycle) === activeCycle._id,
          );
          if (dupe) {
            setDuplicateDraft(dupe);
            setState('duplicate');
            return;
          }
        } catch {
          // fall through
        }
        setErrorMessage(
          getApiErrorMessage(
            err,
            'Applicants may only apply to one track per cycle.',
          ),
        );
        setState('picking');
        return;
      }
      setErrorMessage(
        getApiErrorMessage(err, 'Couldn’t create application. Please try again.'),
      );
      setState('picking');
    }
  }

  function handleContinueExisting() {
    if (!duplicateDraft) return;
    onClose();
    navigate(`/applicant/applications/${duplicateDraft._id}/edit`);
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="start-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={state === 'creating' ? undefined : onClose}
          className="fixed inset-0 z-40 bg-black/40"
        >
          <div className="flex min-h-full items-center justify-center p-6">
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="start-dialog-title"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[560px] border-[0.91px] border-lrfap-ghost bg-white shadow-[0_10px_40px_-12px_rgba(38,43,102,0.25)]"
            >
              {state === 'duplicate' && duplicateDraft ? (
                <DuplicateExistingPanel
                  existingApplication={duplicateDraft}
                  clickedTrack={track}
                  activeCycle={activeCycle}
                  onContinue={handleContinueExisting}
                  onCancel={onClose}
                />
              ) : (
                <PickTrackPanel
                  activeCycle={activeCycle}
                  track={track}
                  onTrackChange={setTrack}
                  onContinue={() => void handleContinue()}
                  onCancel={onClose}
                  canContinue={canContinue}
                  isCreating={state === 'creating'}
                  errorMessage={errorMessage}
                />
              )}
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

interface PickTrackPanelProps {
  activeCycle: Cycle | null;
  track: Track | null;
  onTrackChange: (t: Track) => void;
  onContinue: () => void;
  onCancel: () => void;
  canContinue: boolean;
  isCreating: boolean;
  errorMessage: string | null;
}

function PickTrackPanel({
  activeCycle,
  track,
  onTrackChange,
  onContinue,
  onCancel,
  canContinue,
  isCreating,
  errorMessage,
}: PickTrackPanelProps) {
  const cycleYear = activeCycle?.year ? String(activeCycle.year) : 'the current';
  return (
    <>
      <div className="px-[28px] py-[24px]">
        <h2
          id="start-dialog-title"
          className="font-display text-[20px] font-bold uppercase tracking-wide text-lrfap-navy"
        >
          Start a new application
        </h2>
        <p className="mt-[10px] font-sans text-[14px] leading-relaxed text-slate-600">
          Choose a track to begin. You can prepare drafts for residency and
          fellowship separately.
        </p>

        <div
          role="radiogroup"
          aria-label="Application track"
          className="mt-[20px] flex flex-col gap-[12px]"
        >
          <TrackTile
            id="track-residency"
            label="Residency"
            description={`Apply for a residency program through the ${cycleYear} cycle.`}
            icon={<GraduationCap aria-hidden="true" className="h-5 w-5" />}
            selected={track === 'residency'}
            onSelect={() => onTrackChange('residency')}
            disabled={isCreating}
          />
          <TrackTile
            id="track-fellowship"
            label="Fellowship"
            description="Apply for a subspecialty fellowship."
            icon={<Award aria-hidden="true" className="h-5 w-5" />}
            selected={track === 'fellowship'}
            onSelect={() => onTrackChange('fellowship')}
            disabled={isCreating}
          />
        </div>

        {errorMessage ? (
          <p
            role="alert"
            className="mt-[16px] flex items-center gap-[8px] font-sans text-[12px] font-medium text-red-600"
          >
            <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
            {errorMessage}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-[12px] border-t border-lrfap-ghost bg-lrfap-ghost/30 px-[28px] py-[16px]">
        <button
          type="button"
          disabled={isCreating}
          onClick={onCancel}
          className="inline-flex h-[40px] items-center justify-center border-[0.91px] border-lrfap-navy px-[18px] font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue || isCreating}
          className="inline-flex h-[40px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-sky bg-lrfap-sky px-[22px] font-sans text-[13px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-[#3a86bd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCreating ? (
            <>
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              Creating…
            </>
          ) : (
            'Continue'
          )}
        </button>
      </div>
    </>
  );
}

interface TrackTileProps {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
}

function TrackTile({
  id,
  label,
  description,
  icon,
  selected,
  onSelect,
  disabled,
}: TrackTileProps) {
  const selectedCls = selected
    ? 'border-lrfap-sky bg-sky-50/50'
    : 'border-lrfap-ghost bg-white hover:border-slate-300';
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-[14px] border-2 px-[18px] py-[14px] transition-colors ${selectedCls} ${
        disabled ? 'cursor-not-allowed opacity-60' : ''
      }`}
    >
      <input
        id={id}
        type="radio"
        name="track"
        checked={selected}
        disabled={disabled}
        onChange={onSelect}
        className="mt-[2px] h-[18px] w-[18px] shrink-0 cursor-pointer accent-lrfap-sky disabled:cursor-not-allowed"
      />
      <span
        aria-hidden="true"
        className={`flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full ${
          selected ? 'bg-lrfap-sky text-white' : 'bg-lrfap-ghost text-lrfap-navy'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-sans text-[14px] font-semibold uppercase tracking-wide text-lrfap-navy">
          {label}
        </span>
        <span className="mt-[2px] block font-sans text-[12px] leading-relaxed text-slate-600">
          {description}
        </span>
      </span>
    </label>
  );
}

interface DuplicateExistingPanelProps {
  existingApplication: Application;
  clickedTrack: Track | null;
  activeCycle: Cycle | null;
  onContinue: () => void;
  onCancel: () => void;
}

function DuplicateExistingPanel({
  existingApplication,
  clickedTrack,
  activeCycle,
  onContinue,
  onCancel,
}: DuplicateExistingPanelProps) {
  const existingTrack = existingApplication.track;
  const existingTrackLabel =
    existingTrack === 'fellowship' ? 'fellowship' : 'residency';
  const cycleYear = activeCycle?.year ? ` ${activeCycle.year}` : '';
  const sameTrack = clickedTrack === existingTrack;
  const isDraft = existingApplication.status === 'draft';
  // "Continue editing" only makes sense when the existing application is
  // a draft for the same track the applicant just clicked. Anything else
  // (different track, or already-submitted app) must dead-end at Cancel.
  const canContinueEdit = sameTrack && isDraft;

  const heading = canContinueEdit
    ? 'You already have a draft for this track'
    : `You already have a ${existingTrackLabel} application for this cycle`;
  const body = canContinueEdit
    ? `You've started a ${existingTrackLabel} application for the${cycleYear} cycle. Continue editing it instead of starting a new one.`
    : `You already have a ${existingTrackLabel} application for the${cycleYear} cycle. Applicants may only apply to one track per cycle.`;

  return (
    <>
      <div className="px-[28px] py-[24px]">
        <div className="flex items-start gap-[12px]">
          <CheckCircle
            aria-hidden="true"
            className="mt-[2px] h-6 w-6 shrink-0 text-lrfap-sky"
          />
          <div className="min-w-0">
            <h2
              id="start-dialog-title"
              className="font-display text-[20px] font-bold uppercase tracking-wide text-lrfap-navy"
            >
              {heading}
            </h2>
            <p className="mt-[10px] font-sans text-[14px] leading-relaxed text-slate-600">
              {body}
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-[12px] border-t border-lrfap-ghost bg-lrfap-ghost/30 px-[28px] py-[16px]">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-[40px] items-center justify-center border-[0.91px] border-lrfap-navy px-[18px] font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy"
        >
          Cancel
        </button>
        {canContinueEdit ? (
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex h-[40px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[22px] font-sans text-[13px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
          >
            Continue Editing
          </button>
        ) : null}
      </div>
    </>
  );
}

// ---- Confirm Discard Dialog -----------------------------------------

interface ConfirmDiscardDialogProps {
  draft: Application | null;
  onConfirm: () => Promise<{ ok: true } | { ok: false; error?: string }>;
  onCancel: () => void;
}

function ConfirmDiscardDialog({
  draft,
  onConfirm,
  onCancel,
}: ConfirmDiscardDialogProps) {
  const open = !!draft;
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) {
      setIsDiscarding(false);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelBtnRef.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isDiscarding) {
        e.preventDefault();
        onCancel();
      }
    }
    window.document.addEventListener('keydown', handleKey);
    const prevOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';
    return () => {
      window.document.removeEventListener('keydown', handleKey);
      window.document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, isDiscarding, onCancel]);

  async function runConfirm() {
    setIsDiscarding(true);
    setError(null);
    const result = await onConfirm();
    setIsDiscarding(false);
    if (!result.ok) setError(result.error ?? 'Something went wrong.');
  }

  return (
    <AnimatePresence>
      {open && draft ? (
        <motion.div
          key="discard-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={isDiscarding ? undefined : onCancel}
          className="fixed inset-0 z-40 bg-black/40"
        >
          <div className="flex min-h-full items-center justify-center p-6">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="discard-dialog-title"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[520px] border-[0.91px] border-lrfap-ghost bg-white shadow-[0_10px_40px_-12px_rgba(38,43,102,0.25)]"
            >
              <div className="px-[28px] py-[24px]">
                <h2
                  id="discard-dialog-title"
                  className="font-display text-[20px] font-bold uppercase tracking-wide text-lrfap-navy"
                >
                  Discard Draft?
                </h2>
                <p className="mt-[12px] font-sans text-[14px] leading-relaxed text-slate-600">
                  Discard this draft? This action cannot be undone. You&apos;ll
                  lose your profile progress, uploaded documents, and program
                  selections for this application.
                </p>
                {error ? (
                  <p
                    role="alert"
                    className="mt-[12px] flex items-center gap-[8px] font-sans text-[12px] font-medium text-red-600"
                  >
                    <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
                    {error}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center justify-end gap-[12px] border-t border-lrfap-ghost bg-lrfap-ghost/30 px-[28px] py-[16px]">
                <button
                  ref={cancelBtnRef}
                  type="button"
                  disabled={isDiscarding}
                  onClick={onCancel}
                  className="inline-flex h-[40px] items-center justify-center border-[0.91px] border-lrfap-navy px-[18px] font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDiscarding}
                  onClick={() => void runConfirm()}
                  className="inline-flex h-[40px] items-center justify-center gap-[8px] border-[0.91px] border-red-600 bg-red-600 px-[18px] font-sans text-[13px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDiscarding ? (
                    <>
                      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                      Discarding…
                    </>
                  ) : (
                    'Discard'
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
