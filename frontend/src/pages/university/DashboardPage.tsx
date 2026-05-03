import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUpRight,
  ClipboardList,
  GraduationCap,
  Users,
} from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuth } from '../../hooks/useAuth';
import { universityReviewApi } from '../../api/universityReview';
import { cyclesApi } from '../../api/cycles';
import { dashboardApi } from '../../api/dashboard';
import type {
  Cycle,
  CycleStatus,
  ID,
  Program,
  Specialty,
  UniversityProgramStatusCounts,
} from '../../types';

/**
 * University reviewer landing page.
 *
 * First wave (parallel):
 *   1. GET /university-review/programs   — programs owned by this university
 *   2. GET /cycles                       — used to pick the active cycle
 *
 * Second wave (after active cycle is known):
 *   3. GET /dashboard/university/program-counts?cycle=…
 *      Single aggregation that returns per-program status counts AND
 *      the total unique applicants across them — scoped to the active
 *      cycle. Replaces the old N+1 fetch that pulled one applications
 *      list per program.
 *
 * Per-program cards show the total applicant count only — no per-status
 * pills. The legacy pills mirrored Application.status (submitted/under_review/
 * matched/...) but the per-program detail page categorises applicants by
 * ApplicationReviewState (new/under_review/reviewed/matched). Showing both
 * gave inconsistent numbers for the same record (e.g. dashboard "Submitted: 1"
 * vs detail "New: 1"); reviewers click into the program for the breakdown.
 *
 * There is no university name in the welcome strip: backend auth responses
 * omit the populated university on the user object and getMyPrograms
 * doesn't populate it either — flagged as a backend gap. The reviewer role
 * label stands in until that ships.
 */

type FetchStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface ProgramWithCounts {
  program: Program;
  counts: UniversityProgramStatusCounts;
}

// Mirror the backend's LGC dashboard picker — "non-draft, non-closed"
// is the definition of an active cycle across the app.
const ACTIVE_CYCLE_STATUSES: CycleStatus[] = [
  'open',
  'review',
  'ranking',
  'matching',
  'published',
];

function emptyCounts(): UniversityProgramStatusCounts {
  return {
    submitted: 0,
    under_review: 0,
    matched: 0,
    unmatched: 0,
    withdrawn: 0,
    total: 0,
  };
}

function idOf(ref: ID | { _id: ID } | null | undefined): ID | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref._id;
}

export default function UniversityDashboardPage() {
  useDocumentTitle('University dashboard');
  const { user } = useAuth();

  const [entries, setEntries] = useState<ProgramWithCounts[]>([]);
  const [totalUniqueApplicants, setTotalUniqueApplicants] = useState(0);
  const [pendingReview, setPendingReview] = useState(0);
  const [programsStatus, setProgramsStatus] = useState<FetchStatus>('idle');

  useEffect(() => {
    let cancelled = false;
    setProgramsStatus('loading');

    (async () => {
      try {
        // First wave: parallel fetches that don't depend on each other.
        const [programsList, cyclesList] = await Promise.all([
          universityReviewApi.listMyPrograms(),
          cyclesApi.list(),
        ]);
        if (cancelled) return;

        const activeCycle = pickActiveCycle(cyclesList);

        // Scope the "My Programs" section to the active cycle — matches
        // the new aggregation's scope and avoids cross-cycle duplicates
        // in the counts (a program can only exist in one cycle anyway,
        // but the old page happily rolled everything up cycle-agnostic).
        const cycleScopedPrograms = activeCycle
          ? programsList.filter((p) => idOf(p.cycle) === activeCycle._id)
          : [];

        if (!activeCycle || cycleScopedPrograms.length === 0) {
          setEntries(cycleScopedPrograms.map((p) => ({ program: p, counts: emptyCounts() })));
          setTotalUniqueApplicants(0);
          setPendingReview(0);
          setProgramsStatus('loaded');
          return;
        }

        // Second wave: single aggregation replacing the old per-program
        // applications fetch loop.
        const summary = await dashboardApi.universityProgramCounts(
          activeCycle._id,
        );
        if (cancelled) return;

        const countsByProgram = new Map<ID, UniversityProgramStatusCounts>();
        for (const entry of summary.programs) {
          countsByProgram.set(entry.programId, entry.counts);
        }
        setEntries(
          cycleScopedPrograms.map((program) => ({
            program,
            counts: countsByProgram.get(program._id) ?? emptyCounts(),
          })),
        );
        setTotalUniqueApplicants(summary.totalUniqueApplicants);
        setPendingReview(summary.pendingReview);
        setProgramsStatus('loaded');
      } catch {
        if (!cancelled) setProgramsStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(
    () => ({
      totalPrograms: entries.length,
      totalApplicants: totalUniqueApplicants,
      pendingReview,
    }),
    [entries.length, totalUniqueApplicants, pendingReview],
  );

  const firstName = user?.firstName?.trim() || '';

  if (programsStatus === 'loading' || programsStatus === 'idle') {
    return (
      <PageShell>
        <div className="h-[48px] w-[320px] max-w-full animate-pulse bg-slate-100" />
        <div className="grid grid-cols-1 gap-[16px] md:grid-cols-3">
          <div className="h-[110px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50" />
          <div className="h-[110px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50" />
          <div className="h-[110px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50" />
        </div>
        <div className="h-[220px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50" />
      </PageShell>
    );
  }

  if (programsStatus === 'error') {
    return (
      <PageShell>
        <div
          role="alert"
          className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
        >
          <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
          <span>
            Couldn&apos;t load your programs. Refresh the page to try again.
          </span>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <header>
        <h1 className="font-display text-[36px] font-extrabold leading-[1.1] text-lrfap-navy md:text-[40px]">
          {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        </h1>
        {(() => {
          const uni = entries[0]?.program?.university;
          const name = uni && typeof uni === 'object' && 'name' in uni ? (uni as { name: string }).name : null;
          return name ? (
            <p className="mt-[8px] font-sans text-[14px] font-semibold uppercase tracking-wide text-lrfap-navy">
              {name}
            </p>
          ) : null;
        })()}
        <p className="mt-[4px] font-sans text-[14px] uppercase tracking-wide text-slate-500">
          Review Committee
        </p>
      </header>

      <SummaryRow
        totalPrograms={summary.totalPrograms}
        totalApplicants={summary.totalApplicants}
        pendingReview={summary.pendingReview}
      />

      <ProgramList entries={entries} />
    </PageShell>
  );
}

/**
 * Pick the "active" cycle the way the backend LGC dashboard does — the
 * most-recent cycle whose status is open/review/ranking/matching/published.
 * Draft and closed cycles are excluded. Falls back to the most recent
 * cycle overall when none match (so the page still has something to
 * scope against during setup).
 */
function pickActiveCycle(cycles: Cycle[]): Cycle | null {
  if (cycles.length === 0) return null;
  const sorted = [...cycles].sort((a, b) => b.year - a.year);
  return (
    sorted.find((c) => ACTIVE_CYCLE_STATUSES.includes(c.status)) ??
    sorted[0] ??
    null
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-[40px] md:px-8">
      <div className="flex flex-col gap-[32px]">{children}</div>
    </div>
  );
}

interface SummaryRowProps {
  totalPrograms: number;
  totalApplicants: number;
  pendingReview: number;
}

function SummaryRow({ totalPrograms, totalApplicants, pendingReview }: SummaryRowProps) {
  return (
    <section aria-labelledby="dashboard-summary-heading">
      <h2 id="dashboard-summary-heading" className="sr-only">
        Summary
      </h2>
      <div className="grid grid-cols-1 gap-[16px] md:grid-cols-3">
        <SummaryCard
          icon={<GraduationCap aria-hidden="true" className="h-5 w-5" />}
          label="Programs"
          value={totalPrograms}
          hint={totalPrograms === 1 ? '1 program in active cycle' : `${totalPrograms} programs in active cycle`}
        />
        <SummaryCard
          icon={<Users aria-hidden="true" className="h-5 w-5" />}
          label="Applicants"
          value={totalApplicants}
          hint="Unique across your active-cycle programs"
        />
        <SummaryCard
          icon={<ClipboardList aria-hidden="true" className="h-5 w-5" />}
          label="Pending review"
          value={pendingReview}
          hint="Awaiting your committee's review"
        />
      </div>
    </section>
  );
}

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
}

function SummaryCard({ icon, label, value, hint }: SummaryCardProps) {
  return (
    <div className="flex items-start gap-[14px] border-[0.91px] border-lrfap-ghost bg-white p-[20px] shadow-[0_4px_12px_rgba(38,43,102,0.08)]">
      <span
        aria-hidden="true"
        className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-lrfap-ghost text-lrfap-navy"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-sans text-[12px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className="mt-[2px] font-display text-[28px] font-extrabold leading-none text-lrfap-navy">
          {value}
        </p>
        <p className="mt-[6px] font-sans text-[12px] text-slate-500">{hint}</p>
      </div>
    </div>
  );
}

interface ProgramListProps {
  entries: ProgramWithCounts[];
}

function ProgramList({ entries }: ProgramListProps) {
  return (
    <section aria-labelledby="dashboard-programs-heading">
      <h2
        id="dashboard-programs-heading"
        className="font-display text-[16px] font-bold uppercase tracking-wide text-lrfap-navy"
      >
        My Programs
      </h2>

      {entries.length === 0 ? (
        <div className="mt-[16px] flex flex-col items-center justify-center gap-[8px] border border-dashed border-lrfap-ghost bg-white/60 px-[16px] py-[36px] text-center">
          <GraduationCap
            aria-hidden="true"
            className="h-8 w-8 text-slate-300"
            strokeWidth={1.5}
          />
          <p className="font-sans text-[13px] text-slate-500">
            No programs in the active cycle yet.
          </p>
        </div>
      ) : (
        <ul role="list" className="mt-[16px] flex flex-col gap-[12px]">
          {entries.map(({ program, counts }) => (
            <li key={program._id}>
              <ProgramCard program={program} counts={counts} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface ProgramCardProps {
  program: Program;
  counts: UniversityProgramStatusCounts;
}

function ProgramCard({ program, counts }: ProgramCardProps) {
  const specialtyName =
    typeof program.specialty === 'object' && program.specialty
      ? (program.specialty as Specialty).name
      : 'Program';

  return (
    <Link
      to={`/university/programs/${program._id}`}
      className="group flex flex-col gap-[14px] border-[0.91px] border-lrfap-ghost bg-white px-[20px] py-[18px] shadow-[0_4px_12px_rgba(38,43,102,0.08)] transition-colors hover:border-lrfap-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky md:flex-row md:items-center"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-sans text-[16px] font-semibold text-lrfap-navy">
          {specialtyName}
        </p>
        <p className="mt-[2px] font-sans text-[12px] uppercase tracking-wide text-slate-500">
          {program.track} · {counts.total}{' '}
          {counts.total === 1 ? 'applicant' : 'applicants'}
        </p>
      </div>

      {counts.total === 0 ? (
        <span className="font-sans text-[11px] text-slate-400">
          No applicants yet
        </span>
      ) : null}

      <ArrowUpRight
        aria-hidden="true"
        className="hidden h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:-translate-y-[1px] group-hover:translate-x-[1px] group-hover:text-lrfap-navy md:block"
      />
    </Link>
  );
}
