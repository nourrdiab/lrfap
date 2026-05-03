import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  Loader2,
  Lock,
  Users,
  X,
} from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { programsApi } from '../../api/programs';
import { universityReviewApi } from '../../api/universityReview';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  RankedList,
  type RankedRowData,
} from '../../components/university/ranking/RankedList';
import { UnrankedList } from '../../components/university/ranking/UnrankedList';
import { SubmitConfirmDialog } from '../../components/university/ranking/SubmitConfirmDialog';
import type {
  Application,
  Cycle,
  ID,
  Program,
  ProgramRanking,
  Specialty,
  User,
} from '../../types';

/**
 * Per-program ranking workspace.
 *
 * Strategy
 * --------
 * On mount we fetch three things in parallel:
 *   - the program (for the header)
 *   - the program's applications (to resolve applicant names/status/refs
 *     and to seed the unranked pool)
 *   - the stored ranking (auto-created by the backend on first GET)
 *
 * Those three are merged into two lists the reviewer manipulates locally:
 *   - `ranked`   — the committed ranking, drag-sortable (position = rank)
 *   - `unranked` — eligible applicants not yet in the ranking, with "Add"
 *
 * First visit (empty stored ranking) auto-populates `ranked` with all
 * eligible applicants by submittedAt ASC. The state is marked dirty so
 * the reviewer knows to Save Draft — nothing hits the server until they
 * do.
 *
 * Ineligibility
 * -------------
 * Backend PUT rejects the save if any ranked applicant currently has
 * status not in ['submitted', 'under_review']. We surface that on load:
 * ranked rows that are now withdrawn / matched / unmatched get a yellow
 * warning + note, and a dismissible banner offers to clean them out on
 * the next Save Draft.
 *
 * Submission
 * ----------
 * Submit opens a confirmation modal; on confirm we POST /ranking/submit
 * and flip the page to locked state (drag + remove removed, action bar
 * hidden, lock banner at top).
 *
 * Dirty guard
 * -----------
 * A beforeunload listener covers tab close / reload / typed-URL nav
 * when the reviewer has unsaved changes — same pattern as ProfileForm.
 */

type FetchStatus = 'idle' | 'loading' | 'loaded' | 'error' | 'not-found';

function isValidObjectId(id: string | undefined): id is string {
  return !!id && /^[0-9a-fA-F]{24}$/.test(id);
}

function idOf(ref: ID | { _id: ID } | null | undefined): ID | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref._id;
}

function populated<T extends { _id: ID }>(ref: ID | T | null | undefined): T | null {
  if (!ref || typeof ref === 'string') return null;
  return ref;
}

function trackLabel(track: 'residency' | 'fellowship' | undefined): string {
  return track === 'fellowship' ? 'Fellowship' : 'Residency';
}

function applicantName(applicant: ID | User): string {
  if (typeof applicant === 'string') return 'Applicant';
  const parts = [applicant.firstName, applicant.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : (applicant.email ?? 'Applicant');
}
function applicantEmail(applicant: ID | User): string | null {
  if (typeof applicant === 'string') return null;
  return applicant.email ?? null;
}

function submittedMs(app: Application): number {
  if (!app.submittedAt) return 0;
  const t = new Date(app.submittedAt).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function rowForApp(app: Application): RankedRowData {
  const ineligible =
    app.status !== 'submitted' && app.status !== 'under_review';
  return {
    applicationId: app._id,
    applicantId: idOf(app.applicant) ?? '',
    name: applicantName(app.applicant),
    email: applicantEmail(app.applicant),
    status: app.status,
    reference: app.submissionReference ?? null,
    isIneligible: ineligible,
    ineligibleReason: ineligible
      ? app.status === 'withdrawn'
        ? 'Withdrawn'
        : app.status === 'matched'
          ? 'Already matched'
          : app.status === 'unmatched'
            ? 'Unmatched'
            : 'Not eligible'
      : undefined,
  };
}

function formatSubmittedAt(iso: string | null | undefined): string {
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

export default function UniversityRankingPage() {
  useDocumentTitle('Program ranking');
  const { programId } = useParams<{ programId: string }>();
  const validId = isValidObjectId(programId);

  const [program, setProgram] = useState<Program | null>(null);
  const [programStatus, setProgramStatus] = useState<FetchStatus>('idle');

  const [applications, setApplications] = useState<Application[]>([]);
  const [appsStatus, setAppsStatus] = useState<FetchStatus>('idle');

  const [ranking, setRanking] = useState<ProgramRanking | null>(null);
  const [rankingStatus, setRankingStatus] = useState<FetchStatus>('idle');

  const [ranked, setRanked] = useState<RankedRowData[]>([]);
  // `serverSignature` reflects the order + IDs last known to the server.
  // Dirty = current ranked list differs from this signature.
  const serverSignatureRef = useRef<string>('');
  const hydrationDoneRef = useRef(false);

  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dismissedIneligibleBanner, setDismissedIneligibleBanner] = useState(false);

  // ---- Fetches ---------------------------------------------------------

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

  useEffect(() => {
    if (!validId || !programId) return;
    let cancelled = false;
    setRankingStatus('loading');
    universityReviewApi
      .getRanking(programId)
      .then((res) => {
        if (cancelled) return;
        setRanking(res);
        setRankingStatus('loaded');
      })
      .catch(() => {
        if (!cancelled) setRankingStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [programId, validId]);

  // ---- Merge + hydrate -------------------------------------------------

  // The server-side signature of the ranking's current order. Used for
  // dirty detection. On first hydration we also seed local state from
  // this plus the applications list (auto-populate empty drafts).
  const allReady =
    programStatus === 'loaded' &&
    appsStatus === 'loaded' &&
    rankingStatus === 'loaded';

  useEffect(() => {
    if (!allReady || !programId || !ranking || hydrationDoneRef.current) return;

    // Build a fast lookup of applicationId → Application (populated).
    const appsById = new Map<ID, Application>();
    for (const a of applications) appsById.set(a._id, a);

    // Resolve stored ranking rows against the apps list. An applicant
    // whose application is missing from the list (e.g. they just got
    // matched and the backend dropped them from the programs-applications
    // query — which includes matched/unmatched) can still be shown if we
    // synthesize a row from the populated ranking payload. Backend does
    // include matched in programs/:id/applications, so this is defensive.
    const storedRows: RankedRowData[] = [];
    const rankedIds = new Set<ID>();
    const sortedStored = ranking.rankedApplicants
      .slice()
      .sort((a, b) => a.rank - b.rank);
    for (const entry of sortedStored) {
      const app = appsById.get(entry.application);
      if (app) {
        storedRows.push(rowForApp(app));
        rankedIds.add(app._id);
      } else {
        // Fallback: applicant was populated on the ranking response, so
        // we can still render a row using that data. Mark as ineligible
        // so the reviewer is nudged to remove it on next save.
        const populatedUser = populated<User>(entry.applicant);
        storedRows.push({
          applicationId: entry.application,
          applicantId: idOf(entry.applicant) ?? '',
          name: populatedUser
            ? [populatedUser.firstName, populatedUser.lastName]
                .filter(Boolean)
                .join(' ') ||
              (populatedUser.email ?? 'Applicant')
            : 'Applicant',
          email: populatedUser?.email ?? null,
          status: 'withdrawn',
          reference: null,
          isIneligible: true,
          ineligibleReason: 'No longer applicable',
        });
        rankedIds.add(entry.application);
      }
    }

    // First-visit auto-populate: if the stored ranking is empty AND
    // we have eligible applicants, seed the ranked list with them
    // (submittedAt ASC). Marks the state dirty — the user must Save
    // Draft to persist.
    if (storedRows.length === 0) {
      const eligible = applications
        .filter(
          (a) => a.status === 'submitted' || a.status === 'under_review',
        )
        .slice()
        .sort((a, b) => submittedMs(a) - submittedMs(b));
      const seeded = eligible.map((a) => rowForApp(a));
      setRanked(seeded);
      // serverSignature stays '' — stored ranking is empty — so any
      // non-empty seeded list is dirty, as intended.
      serverSignatureRef.current = '';
    } else {
      setRanked(storedRows);
      serverSignatureRef.current = storedRows
        .map((r) => r.applicationId)
        .join(',');
    }

    hydrationDoneRef.current = true;
  }, [allReady, applications, programId, ranking]);

  // ---- Derived state ---------------------------------------------------

  const locked = ranking?.status === 'submitted';

  const unranked = useMemo<RankedRowData[]>(() => {
    if (!programId) return [];
    const rankedSet = new Set(ranked.map((r) => r.applicationId));
    return applications
      .filter((a) => !rankedSet.has(a._id))
      .filter((a) => a.status === 'submitted' || a.status === 'under_review')
      .slice()
      .sort((a, b) => submittedMs(a) - submittedMs(b))
      .map((a) => rowForApp(a));
  }, [applications, ranked, programId]);

  const ineligibleInRanking = useMemo(
    () => ranked.filter((r) => r.isIneligible),
    [ranked],
  );

  const currentSignature = useMemo(
    () => ranked.map((r) => r.applicationId).join(','),
    [ranked],
  );
  const isDirty =
    !locked && hydrationDoneRef.current && currentSignature !== serverSignatureRef.current;

  // ---- beforeunload guard ---------------------------------------------

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Auto-hide the "Saved" pill after 3 s.
  useEffect(() => {
    if (savedAt === null) return;
    const t = setTimeout(() => setSavedAt(null), 3000);
    return () => clearTimeout(t);
  }, [savedAt]);

  // ---- Mutations -------------------------------------------------------

  const handleReorder = useCallback(
    (next: RankedRowData[]) => {
      setRanked(next);
      setSaveError(null);
    },
    [],
  );

  const handleRemove = useCallback((applicationId: ID) => {
    setRanked((prev) => prev.filter((r) => r.applicationId !== applicationId));
    setSaveError(null);
  }, []);

  const handleAdd = useCallback(
    (applicationId: ID) => {
      if (!programId) return;
      const app = applications.find((a) => a._id === applicationId);
      if (!app) return;
      const row = rowForApp(app);
      setRanked((prev) => [...prev, row]);
      setSaveError(null);
    },
    [applications, programId],
  );

  const handleSaveDraft = useCallback(
    async (silent = false) => {
      if (!programId || isSaving) return;

      // Drop ineligible rows on save — backend PUT would reject them.
      const payload = ranked
        .filter((r) => !r.isIneligible)
        .map((r, idx) => ({
          applicant: r.applicantId,
          application: r.applicationId,
          rank: idx + 1,
        }));

      setIsSaving(true);
      setSaveError(null);
      try {
        const updated = await universityReviewApi.saveRanking(programId, {
          rankedApplicants: payload,
        });
        setRanking(updated);
        // After save, reset local state to reflect what the server has
        // (strips ineligibles, renumbers ranks).
        if (hydrationDoneRef.current) {
          const cleaned = ranked.filter((r) => !r.isIneligible);
          setRanked(cleaned);
          serverSignatureRef.current = cleaned
            .map((r) => r.applicationId)
            .join(',');
          setDismissedIneligibleBanner(false);
        }
        if (!silent) setSavedAt(Date.now());
      } catch (err) {
        setSaveError(getApiErrorMessage(err, 'Couldn’t save your ranking.'));
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving, programId, ranked],
  );

  const openSubmit = useCallback(() => {
    setSaveError(null);
    setSubmitOpen(true);
  }, []);

  const closeSubmit = useCallback(() => {
    if (isSubmitting) return;
    setSubmitOpen(false);
  }, [isSubmitting]);

  const confirmSubmit = useCallback(async () => {
    if (!programId || isSubmitting) return;
    setIsSubmitting(true);
    setSaveError(null);
    try {
      // Save any pending local changes first so the submit operates on
      // the reviewer's intended ordering. If the save throws, abort.
      if (isDirty || ineligibleInRanking.length > 0) {
        await handleSaveDraft(true);
      }
      const submitted = await universityReviewApi.submitRanking(programId);
      setRanking(submitted);
      serverSignatureRef.current = ranked
        .filter((r) => !r.isIneligible)
        .map((r) => r.applicationId)
        .join(',');
      setSubmitOpen(false);
    } catch (err) {
      setSaveError(getApiErrorMessage(err, 'Couldn’t submit your ranking.'));
    } finally {
      setIsSubmitting(false);
    }
  }, [handleSaveDraft, ineligibleInRanking.length, isDirty, isSubmitting, programId, ranked]);

  // ---- Render branches -------------------------------------------------

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

  if (programStatus === 'error' || appsStatus === 'not-found') {
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

  // Check load errors before the loading skeleton — otherwise the
  // `!allReady` short-circuit narrows the status unions to 'loaded' for
  // the type checker, making the subsequent `=== 'error'` branch a
  // type-error AND (worse) making it unreachable dead code, so apps /
  // ranking load failures would have silently shown the skeleton
  // forever.
  if (appsStatus === 'error' || rankingStatus === 'error') {
    return (
      <PageShell>
        <BackLink programId={programId as string} />
        <div
          role="alert"
          className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
        >
          <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
          <span>
            Couldn&apos;t load the ranking. Refresh the page to try again.
          </span>
        </div>
      </PageShell>
    );
  }

  if (!allReady) {
    return (
      <PageShell>
        <div className="h-[28px] w-[180px] animate-pulse bg-slate-100" />
        <div className="h-[48px] w-[360px] max-w-full animate-pulse bg-slate-100" />
        <div className="h-[320px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50" />
      </PageShell>
    );
  }

  const specialty = program
    ? populated<Specialty>(program.specialty)
    : null;
  const cycle = program ? populated<Cycle>(program.cycle) : null;
  const title = specialty?.name ?? 'Program';

  const totalEligible = applications.filter(
    (a) => a.status === 'submitted' || a.status === 'under_review',
  ).length;

  // Empty state: no eligible applicants at all. Hide action buttons.
  const noEligible = totalEligible === 0 && ranked.length === 0;

  return (
    <PageShell>
      <BackLink programId={programId as string} />

      <header className="flex flex-col gap-[10px]">
        <p className="font-sans text-[12px] font-semibold uppercase tracking-wide text-slate-500">
          {trackLabel(program?.track)}
          {cycle ? ` · ${cycle.name} ${cycle.year}` : null}
        </p>
        <div className="flex flex-wrap items-center gap-[14px]">
          <h1 className="font-display text-[32px] font-extrabold leading-[1.1] text-lrfap-navy md:text-[36px]">
            {title} · Ranking
          </h1>
          {locked ? (
            <span className="inline-flex items-center gap-[6px] border-[0.91px] border-emerald-200 bg-emerald-50 px-[10px] py-[3px] font-sans text-[11px] font-medium uppercase tracking-wide text-emerald-800">
              <Lock aria-hidden="true" className="h-3 w-3" />
              Submitted
            </span>
          ) : (
            <span className="inline-flex items-center gap-[6px] border-[0.91px] border-lrfap-ghost bg-white px-[10px] py-[3px] font-sans text-[11px] font-medium uppercase tracking-wide text-lrfap-navy">
              <Users aria-hidden="true" className="h-3 w-3" />
              Draft · {ranked.length} ranked
            </span>
          )}
        </div>
      </header>

      {/* Locked banner */}
      {locked ? (
        <div className="flex items-start gap-[10px] border-[0.91px] border-emerald-200 bg-emerald-50/60 px-[16px] py-[12px] font-sans text-[13px] text-emerald-900">
          <Lock aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Rankings submitted.</p>
            <p className="mt-[2px] text-[12px] text-emerald-800/80">
              This ranking is final and cannot be changed. Submitted on{' '}
              {formatSubmittedAt(ranking?.submittedAt)}.
            </p>
          </div>
        </div>
      ) : null}

      {/* Ineligibility banner */}
      {!locked &&
      ineligibleInRanking.length > 0 &&
      !dismissedIneligibleBanner ? (
        <div
          role="status"
          className="flex items-start gap-[10px] border-[0.91px] border-amber-300 bg-amber-50 px-[16px] py-[12px] font-sans text-[13px] text-amber-900"
        >
          <AlertTriangle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {ineligibleInRanking.length}{' '}
              {ineligibleInRanking.length === 1 ? 'applicant' : 'applicants'} in
              your ranking{' '}
              {ineligibleInRanking.length === 1 ? 'is' : 'are'} no longer
              eligible (withdrawn or matched elsewhere).
            </p>
            <p className="mt-[2px] text-[12px] text-amber-900/80">
              Click Save Draft to remove them from your ranking. Save will remove them regardless.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDismissedIneligibleBanner(true)}
            aria-label="Dismiss warning"
            className="inline-flex h-[28px] w-[28px] shrink-0 items-center justify-center text-amber-700 transition-colors hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Save error */}
      {saveError ? (
        <div
          role="alert"
          className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
        >
          <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      ) : null}

      {/* Empty state */}
      {noEligible ? (
        <div className="flex flex-col items-center justify-center gap-[10px] border border-dashed border-lrfap-ghost bg-white/60 px-[16px] py-[60px] text-center">
          <Users
            aria-hidden="true"
            className="h-8 w-8 text-slate-300"
            strokeWidth={1.5}
          />
          <p className="font-sans text-[14px] text-slate-600">
            No eligible applicants have applied to this program yet.
          </p>
          <Link
            to={`/university/programs/${programId}`}
            className="font-sans text-[12px] font-semibold uppercase tracking-wide text-lrfap-sky underline-offset-4 hover:underline"
          >
            Back to Applications Review
          </Link>
        </div>
      ) : (
        <>
          <section
            aria-labelledby="ranking-heading"
            className="flex flex-col gap-[10px]"
          >
            <h2
              id="ranking-heading"
              className="font-display text-[16px] font-bold uppercase tracking-wide text-lrfap-navy"
            >
              Ranking
            </h2>
            <RankedList
              rows={ranked}
              locked={locked}
              onReorder={handleReorder}
              onRemove={handleRemove}
            />
          </section>

          {!locked ? (
            <section
              aria-labelledby="unranked-heading"
              className="flex flex-col gap-[10px]"
            >
              <h2
                id="unranked-heading"
                className="font-display text-[16px] font-bold uppercase tracking-wide text-lrfap-navy"
              >
                Not yet ranked ({unranked.length})
              </h2>
              <UnrankedList rows={unranked} onAdd={handleAdd} />
            </section>
          ) : null}

          {!locked ? (
            <div className="flex flex-col items-center gap-[10px] pt-[8px]">
              <div className="flex w-full flex-col items-stretch gap-[10px] md:flex-row md:items-center md:justify-end">
                {isDirty ? (
                  <span className="font-sans text-[12px] italic text-slate-500">
                    You have unsaved changes
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleSaveDraft()}
                  disabled={isSaving || ranked.length === 0}
                  className="inline-flex h-[44px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-white px-[22px] font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy transition-colors hover:bg-lrfap-navy hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? (
                    <>
                      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Save Draft'
                  )}
                </button>
                <button
                  type="button"
                  onClick={openSubmit}
                  disabled={isSaving || ranked.length === 0}
                  className="inline-flex h-[44px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[22px] font-sans text-[13px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Submit Rankings
                </button>
              </div>

              <AnimatePresence>
                {savedAt !== null ? (
                  <motion.span
                    key="saved-rankings"
                    role="status"
                    aria-live="polite"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="inline-flex items-center gap-[6px] font-sans text-[12px] font-medium text-green-600"
                  >
                    <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3} />
                    Ranking saved
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </div>
          ) : null}
        </>
      )}

      <SubmitConfirmDialog
        open={submitOpen}
        rankedCount={ranked.filter((r) => !r.isIneligible).length}
        unrankedCount={unranked.length}
        isWorking={isSubmitting}
        onCancel={closeSubmit}
        onConfirm={() => void confirmSubmit()}
      />
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-[40px] md:px-8">
      <div className="flex flex-col gap-[24px]">{children}</div>
    </div>
  );
}

function BackLink({ programId }: { programId: string }) {
  return (
    <Link
      to={`/university/programs/${programId}`}
      className="inline-flex w-fit items-center gap-[8px] font-sans text-[13px] font-medium text-lrfap-navy underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      Back to Applications Review
    </Link>
  );
}
