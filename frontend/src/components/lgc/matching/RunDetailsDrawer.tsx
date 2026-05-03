import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, Users, X } from 'lucide-react';
import { matchApi } from '../../../api/match';
import { getApiErrorMessage } from '../../../utils/apiError';
import { formatRelativeShort } from '../../../utils/relativeTime';
import { RunStatusPill } from './RunStatusPill';
import type {
  ID,
  MatchRun,
  Program,
  Specialty,
  University,
  User,
} from '../../../types';

/**
 * Slide-in drawer for inspecting one MatchRun. Fires
 * `GET /match/runs/:id` when opened so we get the deeply populated
 * matches (applicant names + program docs). Fill rates and unmatched
 * applicants aren't deep-populated by the backend — we resolve
 * program names through the `programsById` map the parent already has
 * from `programsApi.list({cycle})`, and render unmatched as a count
 * with a small note (backend could populate applicant names here too
 * in a future improvement).
 */

interface RunDetailsDrawerProps {
  open: boolean;
  runId: ID | null;
  programsById: Map<ID, Program>;
  onClose: () => void;
}

type FetchStatus = 'idle' | 'loading' | 'loaded' | 'error';

function idOf(ref: ID | { _id: ID } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref._id;
}

function applicantName(ref: ID | User | null | undefined): string {
  if (!ref) return 'Unknown applicant';
  if (typeof ref === 'string') return 'Unknown applicant';
  if (ref.firstName || ref.lastName) {
    return `${ref.firstName ?? ''} ${ref.lastName ?? ''}`.trim();
  }
  return ref.email ?? 'Unknown applicant';
}

function describeProgram(
  ref: ID | Program | null | undefined,
  programsById: Map<ID, Program>,
): { title: string; subtitle: string } {
  const id = idOf(ref);
  const fallback = {
    title: 'Unknown program',
    subtitle: id ? `ID: ${id.slice(-6)}` : '',
  };
  if (!id) return fallback;
  // Prefer the catalog entry (from programsApi.list) — it populates
  // specialty + university deeply. The match endpoint's populated
  // `programId` is only shallow: the Program doc comes back but its
  // nested `specialty` and `university` stay as raw ObjectIds, so
  // using that as the primary source gave us "Program" / empty subtitle.
  const catalog = programsById.get(id);
  const refObj = typeof ref === 'object' && ref !== null ? ref : null;
  const source: Program | null = catalog ?? refObj ?? null;
  if (!source) return fallback;
  const spec = source.specialty as Specialty | null | undefined;
  const uni = source.university as University | null | undefined;
  const title = typeof spec === 'object' && spec?.name ? spec.name : 'Program';
  const subtitle = typeof uni === 'object' && uni?.name ? uni.name : '';
  return { title, subtitle };
}

export function RunDetailsDrawer({
  open,
  runId,
  programsById,
  onClose,
}: RunDetailsDrawerProps) {
  const [run, setRun] = useState<MatchRun | null>(null);
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open || !runId) return;
    let cancelled = false;
    setStatus('loading');
    setError(null);
    setRun(null);
    matchApi
      .getRun(runId)
      .then((r) => {
        if (cancelled) return;
        setRun(r);
        setStatus('loaded');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(getApiErrorMessage(err, 'Couldn’t load this run.'));
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [open, runId]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="run-drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40"
        >
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Match run details"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col border-l-[0.91px] border-lrfap-ghost bg-white shadow-[-10px_0_40px_-12px_rgba(38,43,102,0.25)]"
          >
            <header className="flex items-start justify-between gap-[12px] border-b border-lrfap-ghost px-[24px] py-[18px]">
              <div className="min-w-0">
                <h2 className="font-display text-[18px] font-bold uppercase tracking-wide text-lrfap-navy">
                  Match run details
                </h2>
                {run ? (
                  <p className="mt-[4px] font-sans text-[12px] text-slate-500">
                    {run.track} ·{' '}
                    {typeof run.cycle === 'object' && run.cycle
                      ? `${run.cycle.name} · ${run.cycle.year}`
                      : 'Unknown cycle'}{' '}
                    · {formatRelativeShort(run.createdAt)}
                  </p>
                ) : null}
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="inline-flex h-[32px] w-[32px] shrink-0 items-center justify-center text-slate-500 hover:text-lrfap-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-[24px] py-[20px]">
              {status === 'loading' ? (
                <div className="flex flex-col gap-[10px]">
                  <div className="h-[64px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50" />
                  <div className="h-[120px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50" />
                  <div className="h-[200px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50" />
                </div>
              ) : null}

              {status === 'error' ? (
                <div
                  role="alert"
                  className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
                >
                  <AlertCircle
                    aria-hidden="true"
                    className="mt-[2px] h-4 w-4 shrink-0"
                  />
                  <span>{error ?? 'Couldn’t load this run.'}</span>
                </div>
              ) : null}

              {run ? (
                <RunDetailsBody run={run} programsById={programsById} />
              ) : null}
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

interface RunDetailsBodyProps {
  run: MatchRun;
  programsById: Map<ID, Program>;
}

function RunDetailsBody({ run, programsById }: RunDetailsBodyProps) {
  const res = run.results;
  const matched = res?.totalMatched ?? 0;
  const unmatched = res?.totalUnmatched ?? 0;
  const iterations = res?.iterations ?? 0;
  const totalApplicants =
    run.inputsSnapshot?.applicantCount ?? matched + unmatched;
  const totalPrograms = run.inputsSnapshot?.programCount ?? 0;

  return (
    <div className="flex flex-col gap-[20px]">
      {run.runType === 'dry_run' ? (
        <div
          role="note"
          className="flex items-start gap-[8px] border-[0.91px] border-amber-200 bg-amber-50 px-[12px] py-[10px] font-sans text-[12px] text-amber-900"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-[1px] h-4 w-4 shrink-0 text-amber-700"
          />
          <span>
            Preview only — no applications or cycle state were modified by
            this run.
          </span>
        </div>
      ) : null}

      {run.status === 'failed' ? (
        <div
          role="alert"
          className="flex items-start gap-[8px] border-[0.91px] border-red-200 bg-red-50 px-[12px] py-[10px] font-sans text-[12px] text-red-800"
        >
          <AlertCircle
            aria-hidden="true"
            className="mt-[1px] h-4 w-4 shrink-0 text-red-700"
          />
          <span>
            {run.error ?? 'Run failed before completion. Inspect logs and retry.'}
          </span>
        </div>
      ) : null}

      <div>
        <RunStatusPill runType={run.runType} status={run.status} />
        {run.tieBreakRule ? (
          <p className="mt-[6px] font-sans text-[11px] italic text-slate-500">
            Tie-break: {run.tieBreakRule}
          </p>
        ) : null}
      </div>

      <SummaryStrip
        applicants={totalApplicants}
        programs={totalPrograms}
        matched={matched}
        unmatched={unmatched}
        iterations={iterations}
      />

      <FillRatesTable
        rates={res?.programFillRates ?? []}
        programsById={programsById}
      />

      <MatchedList
        matches={res?.matches ?? []}
        programsById={programsById}
      />

      {unmatched > 0 ? (
        <section aria-labelledby="run-unmatched-heading">
          <h3
            id="run-unmatched-heading"
            className="font-display text-[12px] font-bold uppercase tracking-wide text-lrfap-navy"
          >
            Unmatched applicants
          </h3>
          <p className="mt-[6px] flex items-start gap-[8px] border-[0.91px] border-rose-200 bg-rose-50 px-[12px] py-[10px] font-sans text-[12px] text-rose-900">
            <Users aria-hidden="true" className="mt-[1px] h-4 w-4 shrink-0" />
            <span>
              {unmatched} applicant{unmatched === 1 ? '' : 's'} did not match
              any of their preferences.
            </span>
          </p>
        </section>
      ) : null}
    </div>
  );
}

function SummaryStrip({
  applicants,
  programs,
  matched,
  unmatched,
  iterations,
}: {
  applicants: number;
  programs: number;
  matched: number;
  unmatched: number;
  iterations: number;
}) {
  const stats = [
    { label: 'Applicants', value: applicants },
    { label: 'Programs', value: programs },
    { label: 'Matched', value: matched },
    { label: 'Unmatched', value: unmatched },
    { label: 'Iterations', value: iterations },
  ];
  return (
    <dl className="grid grid-cols-2 gap-[8px] sm:grid-cols-5">
      {stats.map((s) => (
        <div
          key={s.label}
          className="border-[0.91px] border-lrfap-ghost bg-lrfap-ghost/20 px-[10px] py-[8px]"
        >
          <dt className="font-sans text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {s.label}
          </dt>
          <dd className="mt-[2px] font-display text-[18px] font-extrabold leading-none text-lrfap-navy">
            {s.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

interface FillRatesTableProps {
  rates: NonNullable<MatchRun['results']>['programFillRates'];
  programsById: Map<ID, Program>;
}

function FillRatesTable({ rates, programsById }: FillRatesTableProps) {
  const list = rates ?? [];
  if (list.length === 0) {
    return (
      <section aria-labelledby="run-fill-heading">
        <h3
          id="run-fill-heading"
          className="font-display text-[12px] font-bold uppercase tracking-wide text-lrfap-navy"
        >
          Program fill rates
        </h3>
        <p className="mt-[6px] border-[0.91px] border-dashed border-lrfap-ghost bg-white px-[14px] py-[14px] text-center font-sans text-[12px] text-slate-500">
          No fill-rate data recorded for this run.
        </p>
      </section>
    );
  }
  return (
    <section aria-labelledby="run-fill-heading">
      <h3
        id="run-fill-heading"
        className="font-display text-[12px] font-bold uppercase tracking-wide text-lrfap-navy"
      >
        Program fill rates
      </h3>
      <ul role="list" className="mt-[8px] flex flex-col gap-[6px]">
        {list.map((rate, i) => {
          const { title, subtitle } = describeProgram(rate.programId, programsById);
          const pct =
            rate.capacity > 0 ? Math.round((rate.filled / rate.capacity) * 100) : 0;
          return (
            <li
              key={`${idOf(rate.programId)}-${i}`}
              className="border-[0.91px] border-lrfap-ghost bg-white px-[12px] py-[10px]"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-[6px]">
                <div className="min-w-0">
                  <p className="truncate font-sans text-[13px] font-semibold text-lrfap-navy">
                    {title}
                  </p>
                  {subtitle ? (
                    <p className="truncate font-sans text-[11px] text-slate-500">
                      {subtitle}
                    </p>
                  ) : null}
                </div>
                <p className="font-sans text-[12px] text-slate-600">
                  <strong className="font-semibold text-lrfap-navy">
                    {rate.filled}
                  </strong>
                  {' / '}
                  {rate.capacity} · {rate.unfilled} unfilled
                </p>
              </div>
              <div
                aria-hidden="true"
                className="mt-[6px] h-[6px] w-full overflow-hidden rounded-full bg-lrfap-ghost"
              >
                <div
                  className="h-full bg-lrfap-sky"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface MatchedListProps {
  matches: NonNullable<MatchRun['results']>['matches'];
  programsById: Map<ID, Program>;
}

function MatchedList({ matches, programsById }: MatchedListProps) {
  const list = matches ?? [];
  if (list.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="run-matches-heading">
      <h3
        id="run-matches-heading"
        className="font-display text-[12px] font-bold uppercase tracking-wide text-lrfap-navy"
      >
        Matches
      </h3>
      <ul role="list" className="mt-[8px] flex flex-col gap-[4px]">
        {list.map((m, i) => {
          const { title, subtitle } = describeProgram(m.programId, programsById);
          return (
            <li
              key={`${idOf(m.applicantId)}-${idOf(m.programId)}-${i}`}
              className="flex flex-col border-[0.91px] border-lrfap-ghost bg-white px-[12px] py-[8px] sm:flex-row sm:items-center sm:justify-between sm:gap-[12px]"
            >
              <p className="truncate font-sans text-[13px] font-medium text-lrfap-navy">
                {applicantName(m.applicantId as ID | User | null | undefined)}
              </p>
              <p className="truncate font-sans text-[12px] text-slate-600">
                → {title}
                {subtitle ? (
                  <span className="text-slate-500"> · {subtitle}</span>
                ) : null}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
