import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bell } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { dashboardApi } from '../../api/dashboard';
import { universitiesApi } from '../../api/universities';
import { cyclesApi } from '../../api/cycles';
import { matchApi } from '../../api/match';
import { getApiErrorMessage } from '../../utils/apiError';
import { StatCards, type MatchStatusTone } from '../../components/lgc/dashboard/StatCards';
import {
  UniversitiesTable,
  deriveUniversityStatus,
  type UniversityRow,
} from '../../components/lgc/dashboard/UniversitiesTable';
import { ActiveCycleCard, nextStatusFor } from '../../components/lgc/dashboard/ActiveCycleCard';
import { MatchingCard, type TrackState } from '../../components/lgc/dashboard/MatchingCard';
import { AuditLogPreview } from '../../components/lgc/dashboard/AuditLogPreview';
import { ConfirmActionDialog } from '../../components/lgc/ConfirmActionDialog';
import type {
  CycleStatus,
  ID,
  LGCDashboard,
  LGCRankingSummary,
  LGCRankingSummaryUniversity,
  MatchRun,
  Track,
  University,
} from '../../types';

/**
 * LGC Committee Dashboard.
 *
 * First wave (parallel):
 *   - GET /dashboard/lgc                   → counts, active cycle, activity
 *   - GET /universities                    → full university list (for the table)
 *   - GET /match/runs                      → match runs, filtered client-side
 *
 * Second wave (after active cycle ID known):
 *   - GET /dashboard/lgc/ranking-summary?cycle=…
 *     Single-shot aggregation that returns per-university ranking
 *     totals and per-track rollups. Replaces the old N+1 fetch loop
 *     that pulled ProgramRanking for each program individually.
 *
 * The page holds a single loading state until all required fetches land,
 * per spec ("Don't show partial data — show the whole skeleton"). After
 * load, the three action buttons (advance cycle, run match per track,
 * publish results per track) flow through ConfirmActionDialog before
 * hitting the backend. Re-fetch on success so the page reflects state.
 */

type FetchStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface TrackReadiness {
  /** Programs in this track that have at least one submitted application. */
  programsWithApplicants: number;
  /** Subset of above that also have a submitted ProgramRanking. */
  programsWithApplicantsAndSubmittedRanking: number;
  /**
   * True when every program with applicants has a submitted ranking.
   * Matches MatchingEngine's denominator — programs without applicants
   * are excluded by the matcher regardless, so they don't need rankings.
   */
  allSubmitted: boolean;
}

function idOf(ref: ID | { _id: ID } | null | undefined): ID | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref._id;
}

function latestOf(
  runs: MatchRun[],
  cycleId: ID,
  track: Track,
): MatchRun | null {
  const filtered = runs.filter(
    (r) => idOf(r.cycle) === cycleId && r.track === track,
  );
  if (filtered.length === 0) return null;
  // Backend sorts -createdAt already; trust but verify locally.
  return filtered
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
}

function hasOfficialCompleted(
  runs: MatchRun[],
  cycleId: ID,
  track: Track,
): boolean {
  return runs.some(
    (r) =>
      idOf(r.cycle) === cycleId &&
      r.track === track &&
      r.runType === 'official' &&
      r.status === 'completed',
  );
}

/**
 * Fold the two-track match state + cycle status into a single label
 * for the top stat card. Published wins over everything (cycle is
 * final); otherwise we prefer the more-advanced per-track state.
 */
function deriveOverallMatchStatus(
  runs: MatchRun[],
  cycleId: ID | null,
  cycleStatus: CycleStatus | null,
): { label: string; tone: MatchStatusTone } {
  if (!cycleId) return { label: 'Not started', tone: 'idle' };
  if (cycleStatus === 'published') return { label: 'Published', tone: 'published' };

  const trackRuns = runs.filter((r) => idOf(r.cycle) === cycleId);
  if (trackRuns.length === 0) return { label: 'Not started', tone: 'idle' };

  if (trackRuns.some((r) => r.status === 'running'))
    return { label: 'Running', tone: 'running' };

  const resDone = hasOfficialCompleted(runs, cycleId, 'residency');
  const fellDone = hasOfficialCompleted(runs, cycleId, 'fellowship');
  if (resDone && fellDone) return { label: 'Completed', tone: 'completed' };
  if (resDone || fellDone) return { label: 'Partial', tone: 'completed' };

  const anyFailed = trackRuns.some((r) => r.status === 'failed');
  if (anyFailed) return { label: 'Failed', tone: 'failed' };

  return { label: 'Not started', tone: 'idle' };
}

export default function LGCDashboardPage() {
  useDocumentTitle('LGC dashboard');

  const [dashboard, setDashboard] = useState<LGCDashboard | null>(null);
  const [universities, setUniversities] = useState<University[]>([]);
  const [matchRuns, setMatchRuns] = useState<MatchRun[]>([]);
  const [rankingSummary, setRankingSummary] =
    useState<LGCRankingSummary | null>(null);

  const [status, setStatus] = useState<FetchStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Action state — shared across the three action flows. Only one can
  // run at a time; the confirm modal blocks others implicitly.
  const [pendingAction, setPendingAction] = useState<
    | { kind: 'advance'; from: CycleStatus; to: CycleStatus; cycleId: ID }
    | { kind: 'run'; track: Track; cycleId: ID }
    | { kind: 'publish'; track: Track; cycleId: ID }
    | null
  >(null);
  const [actionWorking, setActionWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Per-track running indicator for the Matching card's button spinners.
  const [workingTrack, setWorkingTrack] = useState<Track | null>(null);
  const [workingKind, setWorkingKind] = useState<'run' | 'publish' | null>(null);

  const loadAll = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const [dashRes, unisRes, runsRes] = await Promise.all([
        dashboardApi.lgc(),
        universitiesApi.list(),
        matchApi.listRuns(),
      ]);
      setDashboard(dashRes);
      setUniversities(unisRes);
      setMatchRuns(runsRes);

      // Second wave: one aggregation call that returns everything the
      // Universities table and the MatchingCard's readiness checks need.
      const activeCycleId = dashRes.activeCycle?.id ?? null;
      if (activeCycleId) {
        const summary = await dashboardApi.lgcRankingSummary(activeCycleId);
        setRankingSummary(summary);
      } else {
        setRankingSummary(null);
      }
      setStatus('loaded');
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, 'Couldn’t load the dashboard.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // ---- Derived state ---------------------------------------------------

  const activeCycle = dashboard?.activeCycle ?? null;

  /** Rows for the Universities table, one per University document. */
  const universityRows = useMemo<UniversityRow[]>(() => {
    // Map the aggregation response by university id for cheap lookup; when
    // there's no active cycle we fall back to empty rows for every uni.
    const summaryByUni = new Map<ID, LGCRankingSummaryUniversity>();
    if (rankingSummary) {
      for (const u of rankingSummary.universities) summaryByUni.set(u._id, u);
    }
    return universities.map((u) => {
      const entry = summaryByUni.get(u._id);
      if (!entry) {
        return {
          universityId: u._id,
          name: u.name,
          programCount: 0,
          lastUpdated: null,
          status: 'draft' as const,
        };
      }
      return {
        universityId: u._id,
        name: u.name,
        programCount: entry.totalPrograms,
        lastUpdated: entry.lastUpdatedAt ?? null,
        status: deriveUniversityStatus(
          entry.totalPrograms,
          entry.submittedRankings,
        ),
      };
    });
  }, [universities, rankingSummary]);

  /**
   * Readiness per track — comes straight from the aggregation endpoint.
   * Denominator is programs-with-applicants (not total programs), so
   * a program without any submitted applications doesn't block the
   * "ready" state. Matches the MatchingEngine page's checklist exactly.
   */
  const trackReadiness = useMemo<{ residency: TrackReadiness; fellowship: TrackReadiness }>(() => {
    const build = (track: Track): TrackReadiness => {
      const stats = rankingSummary?.tracks[track];
      const programsWithApplicants = stats?.programsWithApplicants ?? 0;
      const programsWithApplicantsAndSubmittedRanking =
        stats?.programsWithApplicantsAndSubmittedRanking ?? 0;
      return {
        programsWithApplicants,
        programsWithApplicantsAndSubmittedRanking,
        allSubmitted:
          programsWithApplicants > 0 &&
          programsWithApplicantsAndSubmittedRanking === programsWithApplicants,
      };
    };
    return { residency: build('residency'), fellowship: build('fellowship') };
  }, [rankingSummary]);

  /** Per-track state for the MatchingCard buttons. */
  const matchingState = useMemo(() => {
    if (!activeCycle) {
      const empty: TrackState = {
        canRun: false,
        hasOfficialRun: false,
        lastRunAt: null,
        lastRunStatus: null,
      };
      return { residency: empty, fellowship: empty };
    }
    const build = (track: Track): TrackState => {
      const latest = latestOf(matchRuns, activeCycle.id, track);
      return {
        canRun: trackReadiness[track].allSubmitted,
        hasOfficialRun: hasOfficialCompleted(matchRuns, activeCycle.id, track),
        lastRunAt: latest?.createdAt ?? null,
        lastRunStatus: latest?.status ?? null,
      };
    };
    return { residency: build('residency'), fellowship: build('fellowship') };
  }, [activeCycle, matchRuns, trackReadiness]);

  const overallMatchStatus = useMemo(() => {
    return deriveOverallMatchStatus(
      matchRuns,
      activeCycle?.id ?? null,
      activeCycle?.status ?? null,
    );
  }, [matchRuns, activeCycle]);

  /** Totals for the stat cards. */
  const stats = useMemo(() => {
    const universitiesWithPrograms = universityRows.filter((r) => r.programCount > 0);
    const universitiesTotal = universitiesWithPrograms.length;
    const universitiesSubmitted = universitiesWithPrograms.filter(
      (r) => r.status === 'all_submitted',
    ).length;

    const pendingRankings = rankingSummary
      ? rankingSummary.totals.draftRankings
      : 0;

    const apps = dashboard?.counts.applications;
    const preferencesLocked = apps
      ? apps.submitted + apps.matched + apps.unmatched
      : 0;
    const applicationsTotal = apps?.total ?? 0;

    return {
      universitiesSubmitted,
      universitiesTotal,
      pendingRankings,
      preferencesLocked,
      applicationsTotal,
    };
  }, [universityRows, rankingSummary, dashboard]);

  const auditAlerts = useMemo(() => {
    if (!dashboard) return 0;
    return dashboard.recentActivity.filter((a) => a.outcome === 'failure').length;
  }, [dashboard]);

  // Combined readiness for the MatchingCard checklist on the dashboard:
  // both tracks are considered "ready" if every track that has any
  // programs-with-applicants has all of them ranked. At least one track
  // must have applicants overall — otherwise there's nothing to match.
  const allProgramRankingsSubmitted = (() => {
    const r = trackReadiness.residency;
    const f = trackReadiness.fellowship;
    const anyHasApplicants =
      r.programsWithApplicants > 0 || f.programsWithApplicants > 0;
    if (!anyHasApplicants) return false;
    const rReady = r.programsWithApplicants === 0 || r.allSubmitted;
    const fReady = f.programsWithApplicants === 0 || f.allSubmitted;
    return rReady && fReady;
  })();

  // ---- Action handlers -------------------------------------------------

  const requestAdvance = useCallback(() => {
    if (!activeCycle) return;
    const next = nextStatusFor(activeCycle.status);
    if (!next) return;
    setActionError(null);
    setPendingAction({
      kind: 'advance',
      from: activeCycle.status,
      to: next,
      cycleId: activeCycle.id,
    });
  }, [activeCycle]);

  const requestRunMatch = useCallback(
    (track: Track) => {
      if (!activeCycle) return;
      setActionError(null);
      setPendingAction({ kind: 'run', track, cycleId: activeCycle.id });
    },
    [activeCycle],
  );

  const requestPublish = useCallback(
    (track: Track) => {
      if (!activeCycle) return;
      setActionError(null);
      setPendingAction({ kind: 'publish', track, cycleId: activeCycle.id });
    },
    [activeCycle],
  );

  const cancelPending = useCallback(() => {
    if (actionWorking) return;
    setPendingAction(null);
    setActionError(null);
  }, [actionWorking]);

  const confirmPending = useCallback(async () => {
    if (!pendingAction) return;
    setActionWorking(true);
    setActionError(null);
    try {
      if (pendingAction.kind === 'advance') {
        await cyclesApi.setStatus(pendingAction.cycleId, pendingAction.to);
      } else if (pendingAction.kind === 'run') {
        setWorkingTrack(pendingAction.track);
        setWorkingKind('run');
        await matchApi.execute(pendingAction.cycleId, pendingAction.track);
      } else if (pendingAction.kind === 'publish') {
        setWorkingTrack(pendingAction.track);
        setWorkingKind('publish');
        await matchApi.publish(pendingAction.cycleId, pendingAction.track);
      }
      setPendingAction(null);
      setWorkingTrack(null);
      setWorkingKind(null);
      await loadAll();
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Couldn’t complete this action.'));
      setWorkingTrack(null);
      setWorkingKind(null);
    } finally {
      setActionWorking(false);
    }
  }, [pendingAction, loadAll]);

  // ---- Render branches -------------------------------------------------

  if (status === 'loading' || status === 'idle') {
    return <SkeletonShell />;
  }

  if (status === 'error' || !dashboard) {
    return (
      <PageShell>
        <div
          role="alert"
          className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
        >
          <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
          <span>{errorMessage ?? 'Couldn’t load the dashboard.'}</span>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <header className="flex flex-col gap-[10px] md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-[32px] font-extrabold leading-[1.05] text-lrfap-navy md:text-[40px]">
            LGC Committee Dashboard
          </h1>
          <p className="mt-[8px] max-w-[640px] font-sans text-[13px] text-slate-600">
            National oversight and match control platform managed by the
            LRFAP Governance Committee.
          </p>
        </div>
        <span
          aria-label={
            auditAlerts > 0
              ? `${auditAlerts} recent audit failures`
              : 'No recent audit failures'
          }
          className={`inline-flex shrink-0 items-center gap-[6px] border-[0.91px] px-[12px] py-[6px] font-sans text-[12px] font-medium uppercase tracking-wide ${
            auditAlerts > 0
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          <Bell aria-hidden="true" className="h-3.5 w-3.5" />
          {auditAlerts} Audit {auditAlerts === 1 ? 'Alert' : 'Alerts'}
        </span>
      </header>

      <StatCards
        universitiesSubmitted={stats.universitiesSubmitted}
        universitiesTotal={stats.universitiesTotal}
        pendingRankings={stats.pendingRankings}
        preferencesLocked={stats.preferencesLocked}
        applicationsTotal={stats.applicationsTotal}
        matchStatusLabel={overallMatchStatus.label}
        matchStatusTone={overallMatchStatus.tone}
      />

      {/* Main 2-column area */}
      <div className="grid grid-cols-1 gap-[24px] lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-[24px]">
          <UniversitiesTable rows={universityRows} />
        </div>
        <div className="flex flex-col gap-[16px]">
          <ActiveCycleCard
            cycle={activeCycle}
            isAdvancing={actionWorking && pendingAction?.kind === 'advance'}
            onRequestAdvance={requestAdvance}
          />
          <MatchingCard
            allProgramRankingsSubmitted={allProgramRankingsSubmitted}
            cycleStatus={activeCycle?.status ?? null}
            residency={matchingState.residency}
            fellowship={matchingState.fellowship}
            workingTrack={workingTrack}
            workingKind={workingKind}
            onRunMatch={requestRunMatch}
            onPublishResults={requestPublish}
          />
        </div>
      </div>

      <AuditLogPreview entries={dashboard.recentActivity} />

      <ConfirmActionDialog
        open={!!pendingAction}
        title={confirmTitleFor(pendingAction)}
        body={confirmBodyFor(pendingAction)}
        confirmLabel={confirmLabelFor(pendingAction)}
        tone={pendingAction?.kind === 'publish' ? 'danger' : 'navy'}
        isWorking={actionWorking}
        errorMessage={actionError}
        onCancel={cancelPending}
        onConfirm={() => void confirmPending()}
      />
    </PageShell>
  );
}

// ---- Confirm dialog copy -----------------------------------------------

type PendingAction =
  | { kind: 'advance'; from: CycleStatus; to: CycleStatus; cycleId: ID }
  | { kind: 'run'; track: Track; cycleId: ID }
  | { kind: 'publish'; track: Track; cycleId: ID }
  | null;

function trackLabel(track: Track): string {
  return track === 'fellowship' ? 'Fellowship' : 'Residency';
}

function confirmTitleFor(action: PendingAction): string {
  if (!action) return '';
  if (action.kind === 'advance') return 'Advance cycle status?';
  if (action.kind === 'run') return `Run ${trackLabel(action.track)} match?`;
  return `Publish ${trackLabel(action.track)} results?`;
}

function confirmBodyFor(action: PendingAction): React.ReactNode {
  if (!action) return null;
  if (action.kind === 'advance') {
    return (
      <>
        The cycle will move from <strong>{action.from}</strong> to{' '}
        <strong>{action.to}</strong>. This is a permanent state change —
        applicants and universities may see different UI as a result.
      </>
    );
  }
  if (action.kind === 'run') {
    return (
      <>
        This will run the Gale-Shapley matching algorithm for the{' '}
        <strong>{trackLabel(action.track).toLowerCase()}</strong> track
        and persist the results. An official run for this track cannot
        be repeated.
      </>
    );
  }
  return (
    <>
      Publishing is final. Applicants will be notified of their match
      status for the <strong>{trackLabel(action.track).toLowerCase()}</strong>{' '}
      track and the cycle will move to the <strong>published</strong> state.
    </>
  );
}

function confirmLabelFor(action: PendingAction): string {
  if (!action) return 'Confirm';
  if (action.kind === 'advance') return `Advance to ${action.to}`;
  if (action.kind === 'run') return `Run ${trackLabel(action.track)}`;
  return `Publish ${trackLabel(action.track)}`;
}

// ---- Shells ------------------------------------------------------------

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-[40px] md:px-8">
      <div className="flex flex-col gap-[28px]">{children}</div>
    </div>
  );
}

function SkeletonShell() {
  return (
    <PageShell>
      <div className="flex flex-col gap-[12px]">
        <div className="h-[48px] w-[360px] max-w-full animate-pulse bg-slate-100" />
        <div className="h-[18px] w-[480px] max-w-full animate-pulse bg-slate-100" />
      </div>
      <div className="grid grid-cols-2 gap-[16px] md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[110px] animate-pulse rounded-xl border-[0.91px] border-lrfap-ghost bg-slate-50"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-[24px] lg:grid-cols-[2fr_1fr]">
        <div className="h-[360px] animate-pulse rounded-xl border-[0.91px] border-lrfap-ghost bg-slate-50" />
        <div className="flex flex-col gap-[16px]">
          <div className="h-[200px] animate-pulse rounded-xl border-[0.91px] border-lrfap-ghost bg-slate-50" />
          <div className="h-[220px] animate-pulse rounded-xl border-[0.91px] border-lrfap-ghost bg-slate-50" />
        </div>
      </div>
      <div className="h-[220px] animate-pulse rounded-xl border-[0.91px] border-lrfap-ghost bg-slate-50" />
    </PageShell>
  );
}
