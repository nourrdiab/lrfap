import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Users } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { programsApi } from '../../api/programs';
import { universityReviewApi } from '../../api/universityReview';
import {
  StatusFilterBar,
  type ReviewStateFilter,
} from '../../components/university/applications/StatusFilterBar';
import { ApplicantsTable } from '../../components/university/applications/ApplicantsTable';
import type {
  Application,
  Cycle,
  Program,
  Specialty,
} from '../../types';

/**
 * Per-program applicants list. Entry point for the university review
 * workflow — linked from the Dashboard program cards. Fetches the program
 * (for the header) and its applications in parallel.
 *
 * Status filtering is client-side: small lists (single-program scope,
 * backend already drops drafts). Sort order is submittedAt DESC; the
 * applicant's preference rank for this program is intentionally hidden
 * from reviewers so it can't bias their own ranking.
 */

type FetchStatus = 'idle' | 'loading' | 'loaded' | 'error' | 'not-found';

function isValidObjectId(id: string | undefined): id is string {
  return !!id && /^[0-9a-fA-F]{24}$/.test(id);
}

function trackLabel(track: 'residency' | 'fellowship' | undefined): string {
  return track === 'fellowship' ? 'Fellowship' : 'Residency';
}

function populatedSpecialty(program: Program | null): Specialty | null {
  if (!program) return null;
  return typeof program.specialty === 'object' ? (program.specialty as Specialty) : null;
}

function populatedCycle(program: Program | null): Cycle | null {
  if (!program) return null;
  return typeof program.cycle === 'object' ? (program.cycle as Cycle) : null;
}

function submittedMs(app: Application): number {
  if (!app.submittedAt) return 0;
  const t = new Date(app.submittedAt).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export default function UniversityProgramApplicationsPage() {
  useDocumentTitle('Program applications');
  const { programId } = useParams<{ programId: string }>();
  const validId = isValidObjectId(programId);

  const [program, setProgram] = useState<Program | null>(null);
  const [programStatus, setProgramStatus] = useState<FetchStatus>('idle');

  const [applications, setApplications] = useState<Application[]>([]);
  const [appsStatus, setAppsStatus] = useState<FetchStatus>('idle');

  const [filter, setFilter] = useState<ReviewStateFilter>('new');

  useEffect(() => {
    if (!validId || !programId) return;
    let cancelled = false;
    setProgramStatus('loading');
    programsApi
      .get(programId)
      .then((res) => {
        if (cancelled) return;
        setProgram(res);
        setProgramStatus('loaded');
      })
      .catch(() => {
        if (!cancelled) setProgramStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [programId, validId]);

  useEffect(() => {
    if (!validId || !programId) return;
    let cancelled = false;
    setAppsStatus('loading');
    universityReviewApi
      .listProgramApplications(programId)
      .then((res) => {
        if (cancelled) return;
        setApplications(res);
        setAppsStatus('loaded');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404 || status === 403) {
          setAppsStatus('not-found');
          return;
        }
        setAppsStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [programId, validId]);

  const sorted = useMemo(() => {
    return applications.slice().sort((a, b) => submittedMs(b) - submittedMs(a));
  }, [applications]);

  const counts = useMemo<Record<ReviewStateFilter, number>>(() => {
    const c: Record<ReviewStateFilter, number> = {
      new: 0,
      under_review: 0,
      reviewed: 0,
      matched: 0,
    };
    for (const a of sorted) {
      const s = a.reviewState ?? 'new';
      c[s] += 1;
    }
    return c;
  }, [sorted]);

  const filtered = useMemo(() => {
    return sorted.filter((a) => (a.reviewState ?? 'new') === filter);
  }, [sorted, filter]);

  const specialty = populatedSpecialty(program);
  const cycle = populatedCycle(program);
  const title = specialty?.name ?? 'Program';

  if (!validId) {
    return (
      <PageShell>
        <div
          role="alert"
          className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
        >
          <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
          <span>
            Invalid program reference.{' '}
            <Link to="/university" className="font-semibold underline-offset-4 hover:underline">
              Back to Dashboard
            </Link>
          </span>
        </div>
      </PageShell>
    );
  }

  if (appsStatus === 'not-found' || programStatus === 'error') {
    return (
      <PageShell>
        <div
          role="alert"
          className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
        >
          <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
          <span>
            This program isn&apos;t available.{' '}
            <Link to="/university" className="font-semibold underline-offset-4 hover:underline">
              Back to Dashboard
            </Link>
          </span>
        </div>
      </PageShell>
    );
  }

  if (
    programStatus === 'loading' ||
    programStatus === 'idle' ||
    appsStatus === 'loading' ||
    appsStatus === 'idle'
  ) {
    return (
      <PageShell>
        <div className="h-[28px] w-[180px] animate-pulse bg-slate-100" />
        <div className="h-[48px] w-[360px] max-w-full animate-pulse bg-slate-100" />
        <div className="h-[40px] w-[380px] max-w-full animate-pulse bg-slate-100" />
        <div className="h-[320px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50" />
      </PageShell>
    );
  }

  if (appsStatus === 'error') {
    return (
      <PageShell>
        <BackLink />
        <div
          role="alert"
          className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
        >
          <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
          <span>
            Couldn&apos;t load applicants for this program. Refresh the page to try again.
          </span>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <BackLink />

      <header className="flex flex-col gap-[10px]">
        <p className="font-sans text-[12px] font-semibold uppercase tracking-wide text-slate-500">
          {trackLabel(program?.track)}
          {cycle ? ` · ${cycle.name} ${cycle.year}` : null}
        </p>
        <div className="flex flex-wrap items-center gap-[14px]">
          <h1 className="font-display text-[36px] font-extrabold leading-[1.1] text-lrfap-navy md:text-[40px]">
            {title}
          </h1>
          <span className="inline-flex items-center gap-[6px] border-[0.91px] border-lrfap-ghost bg-white px-[12px] py-[4px] font-sans text-[12px] font-medium uppercase tracking-wide text-lrfap-navy">
            <Users aria-hidden="true" className="h-3.5 w-3.5" />
            {sorted.length} {sorted.length === 1 ? 'applicant' : 'applicants'}
          </span>
          {validId ? (
            <Link
              to={`/university/programs/${programId}/ranking`}
              className="ml-auto inline-flex h-[40px] items-center justify-center border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[20px] font-sans text-[13px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
            >
              Rank Applicants
            </Link>
          ) : null}
        </div>
      </header>

      <StatusFilterBar active={filter} counts={counts} onChange={setFilter} />

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-[10px] border border-dashed border-lrfap-ghost bg-white/60 px-[16px] py-[60px] text-center">
          <Users
            aria-hidden="true"
            className="h-8 w-8 text-slate-300"
            strokeWidth={1.5}
          />
          <p className="font-sans text-[14px] text-slate-600">
            No applicants have selected this program yet.
          </p>
          <Link
            to="/university"
            className="font-sans text-[12px] font-semibold uppercase tracking-wide text-lrfap-sky underline-offset-4 hover:underline"
          >
            Back to Dashboard
          </Link>
        </div>
      ) : (
        <ApplicantsTable applications={filtered} programId={programId as string} />
      )}
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-[40px] md:px-8">
      <div className="flex flex-col gap-[24px]">{children}</div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/university"
      className="inline-flex w-fit items-center gap-[8px] font-sans text-[13px] font-medium text-lrfap-navy underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      Back to Dashboard
    </Link>
  );
}
