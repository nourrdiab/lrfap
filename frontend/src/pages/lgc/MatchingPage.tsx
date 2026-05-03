import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { cyclesApi } from '../../api/cycles';
import { matchApi } from '../../api/match';
import { programsApi } from '../../api/programs';
import { dashboardApi } from '../../api/dashboard';
import { getApiErrorMessage } from '../../utils/apiError';
import { ConfirmActionDialog } from '../../components/lgc/ConfirmActionDialog';
import {
  TrackPanel,
  type TrackWorkingKind,
} from '../../components/lgc/matching/TrackPanel';
import { RunDetailsDrawer } from '../../components/lgc/matching/RunDetailsDrawer';
import type { ReadinessState } from '../../components/lgc/matching/MatchingReadiness';
import type {
  Cycle,
  CycleStatus,
  ID,
  LGCRankingSummary,
  MatchRun,
  Program,
  Track,
} from '../../types';

/**
 * LGC Matching Engine — `/lgc/matching`.
 *
 * Split-by-track layout: Residency and Fellowship each own a full
 * column with readiness + three actions + run history. The page holds
 * one shared state so both tracks can coordinate UI (e.g., the
 * publish-locks-cycle warning banner).
 *
 * Data loaded on cycle-select:
 *   - GET /match/runs                         (client-filtered by cycle)
 *   - GET /dashboard/lgc/ranking-summary      (readiness per track)
 *   - GET /programs?cycle=                    (label lookup for drawer)
 *
 * The cycle list loads once on mount; the default selection is the
 * most-recent non-terminal cycle.
 */

type FetchStatus = 'idle' | 'loading' | 'loaded' | 'error';

type PendingAction =
  | { kind: 'execute'; track: Track; cycleId: ID }
  | { kind: 'publish'; track: Track; cycleId: ID };

const NON_TERMINAL_STATUSES: CycleStatus[] = [
  'draft',
  'open',
  'review',
  'ranking',
  'matching',
];

const ACTION_LABELS: Record<Track, string> = {
  residency: 'Residency',
  fellowship: 'Fellowship',
};

function idOf(ref: ID | { _id: ID } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref._id;
}

function pickDefaultCycle(cycles: Cycle[]): Cycle | null {
  if (cycles.length === 0) return null;
  const sorted = [...cycles].sort((a, b) => b.year - a.year);
  return (
    sorted.find((c) => NON_TERMINAL_STATUSES.includes(c.status)) ??
    sorted[0] ??
    null
  );
}

function hasCompletedOfficialFor(
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

export default function LGCMatchingPage() {
  useDocumentTitle('Matching engine');

  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cyclesStatus, setCyclesStatus] = useState<FetchStatus>('idle');
  const [cyclesError, setCyclesError] = useState<string | null>(null);

  const [selectedCycleId, setSelectedCycleId] = useState<ID | null>(null);

  const [runs, setRuns] = useState<MatchRun[]>([]);
  const [rankingSummary, setRankingSummary] =
    useState<LGCRankingSummary | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [scopedStatus, setScopedStatus] = useState<FetchStatus>('idle');
  const [scopedError, setScopedError] = useState<string | null>(null);

  // Per-track working state — only one action per track at a time.
  const [workingTrack, setWorkingTrack] = useState<Track | null>(null);
  const [workingKind, setWorkingKind] = useState<TrackWorkingKind | null>(null);

  // Confirm dialog state for execute / publish.
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Details drawer.
  const [drawerRunId, setDrawerRunId] = useState<ID | null>(null);

  // Success chip (auto-dismiss).
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(t);
  }, [successMessage]);

  // ---- Cycles ---------------------------------------------------------

  const loadCycles = useCallback(async () => {
    setCyclesStatus('loading');
    setCyclesError(null);
    try {
      const list = await cyclesApi.list();
      setCycles(list);
      setCyclesStatus('loaded');
      setSelectedCycleId((current) => {
        if (current && list.some((c) => c._id === current)) return current;
        return pickDefaultCycle(list)?._id ?? null;
      });
    } catch (err) {
      setCyclesError(getApiErrorMessage(err, 'Couldn’t load cycles.'));
      setCyclesStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadCycles();
  }, [loadCycles]);

  // ---- Cycle-scoped data ---------------------------------------------

  const loadScoped = useCallback(
    async (cycleId: ID) => {
      setScopedStatus('loading');
      setScopedError(null);
      try {
        const [runsList, summary, programList] = await Promise.all([
          matchApi.listRuns(),
          dashboardApi.lgcRankingSummary(cycleId),
          programsApi.list({ cycle: cycleId }),
        ]);
        setRuns(runsList);
        setRankingSummary(summary);
        setPrograms(programList);
        setScopedStatus('loaded');
      } catch (err) {
        setScopedError(
          getApiErrorMessage(err, 'Couldn’t load matching data.'),
        );
        setScopedStatus('error');
      }
    },
    [],
  );

  useEffect(() => {
    if (!selectedCycleId) {
      setRuns([]);
      setRankingSummary(null);
      setPrograms([]);
      setScopedStatus('idle');
      return;
    }
    void loadScoped(selectedCycleId);
  }, [selectedCycleId, loadScoped]);

  // ---- Derived state --------------------------------------------------

  const selectedCycle = useMemo<Cycle | null>(() => {
    if (!selectedCycleId) return null;
    return cycles.find((c) => c._id === selectedCycleId) ?? null;
  }, [cycles, selectedCycleId]);

  const sortedCycles = useMemo(
    () =>
      [...cycles].sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return a.name.localeCompare(b.name);
      }),
    [cycles],
  );

  const programsById = useMemo(() => {
    const m = new Map<ID, Program>();
    for (const p of programs) m.set(p._id, p);
    return m;
  }, [programs]);

  const runsByTrack = useMemo<Record<Track, MatchRun[]>>(() => {
    const res: Record<Track, MatchRun[]> = { residency: [], fellowship: [] };
    if (!selectedCycleId) return res;
    for (const r of runs) {
      if (idOf(r.cycle) !== selectedCycleId) continue;
      res[r.track]?.push(r);
    }
    // Newest first (backend already sorts -createdAt, but defend locally).
    res.residency.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    res.fellowship.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return res;
  }, [runs, selectedCycleId]);

  const readinessByTrack = useMemo<Record<Track, ReadinessState>>(() => {
    const build = (track: Track): ReadinessState => {
      const stats = rankingSummary?.tracks[track];
      const totalPrograms = stats?.totalPrograms ?? 0;
      const submittedRankings = stats?.submittedRankings ?? 0;
      const programsWithApplicants = stats?.programsWithApplicants ?? 0;
      const programsWithApplicantsAndSubmittedRanking =
        stats?.programsWithApplicantsAndSubmittedRanking ?? 0;
      // Readiness green = every program that actually has applicants
      // is ranked. Programs without applicants don't need rankings —
      // matching silently excludes them anyway.
      const allProgramsRanked =
        programsWithApplicants > 0 &&
        programsWithApplicantsAndSubmittedRanking === programsWithApplicants;
      const cycleStatus = selectedCycle?.status ?? 'draft';
      const cycleActionable =
        cycleStatus !== 'published' && cycleStatus !== 'closed';
      return {
        allProgramsRanked,
        totalPrograms,
        submittedRankings,
        programsWithApplicants,
        programsWithApplicantsAndSubmittedRanking,
        cycleActionable,
        cycleStatus,
      };
    };
    return { residency: build('residency'), fellowship: build('fellowship') };
  }, [rankingSummary, selectedCycle]);

  const officialByTrack = useMemo<Record<Track, boolean>>(() => {
    if (!selectedCycleId) return { residency: false, fellowship: false };
    return {
      residency: hasCompletedOfficialFor(runs, selectedCycleId, 'residency'),
      fellowship: hasCompletedOfficialFor(runs, selectedCycleId, 'fellowship'),
    };
  }, [runs, selectedCycleId]);

  // Publish-lockout warning: shown on both panels when both tracks have
  // completed officials and the cycle hasn't been published yet. Once
  // one track publishes, cycle.status flips to 'published' and the
  // warning disappears (the other track's Publish button auto-disables
  // via the `cycleActionable` check).
  const publishWarning: string | null = useMemo(() => {
    if (!selectedCycle) return null;
    if (selectedCycle.status === 'published' || selectedCycle.status === 'closed')
      return null;
    if (!officialByTrack.residency || !officialByTrack.fellowship) return null;
    return 'Both tracks have a completed official run. Publishing one track will lock the cycle for the other — publish them back-to-back.';
  }, [selectedCycle, officialByTrack]);

  // ---- Action handlers ------------------------------------------------

  function handleCycleChange(next: ID) {
    // Clear drawer selection when switching cycles — a drawer showing a
    // run from cycle A while the page is scoped to cycle B is confusing.
    setDrawerRunId(null);
    setSelectedCycleId(next);
  }

  const runDry = useCallback(
    async (track: Track) => {
      if (!selectedCycleId) return;
      setWorkingTrack(track);
      setWorkingKind('dry');
      setActionError(null);
      try {
        const result = await matchApi.dryRun(selectedCycleId, track);
        await loadScoped(selectedCycleId);
        setDrawerRunId(result.matchRunId);
        setSuccessMessage(
          `${ACTION_LABELS[track]} dry run completed — ${result.summary.totalMatched}/${result.summary.totalApplicants} matched in ${result.summary.iterations} iterations.`,
        );
      } catch (err) {
        setActionError(
          getApiErrorMessage(err, 'Dry run failed. Backend may be enforcing an invariant — open a direct request for details.'),
        );
      } finally {
        setWorkingTrack(null);
        setWorkingKind(null);
      }
    },
    [selectedCycleId, loadScoped],
  );

  const requestExecute = useCallback(
    (track: Track) => {
      if (!selectedCycleId) return;
      setActionError(null);
      setPendingAction({ kind: 'execute', track, cycleId: selectedCycleId });
    },
    [selectedCycleId],
  );

  const requestPublish = useCallback(
    (track: Track) => {
      if (!selectedCycleId) return;
      setActionError(null);
      setPendingAction({ kind: 'publish', track, cycleId: selectedCycleId });
    },
    [selectedCycleId],
  );

  function cancelPending() {
    if (workingKind === 'execute' || workingKind === 'publish') return;
    setPendingAction(null);
    setActionError(null);
  }

  const confirmPending = useCallback(async () => {
    if (!pendingAction) return;
    setWorkingTrack(pendingAction.track);
    setWorkingKind(pendingAction.kind);
    setActionError(null);
    try {
      if (pendingAction.kind === 'execute') {
        const result = await matchApi.execute(
          pendingAction.cycleId,
          pendingAction.track,
        );
        // Reload cycles too — execute flips cycle.status to 'matching'.
        await Promise.all([loadCycles(), loadScoped(pendingAction.cycleId)]);
        setDrawerRunId(result.matchRunId);
        setSuccessMessage(
          `${ACTION_LABELS[pendingAction.track]} official match complete — ${result.summary.totalMatched}/${result.summary.totalApplicants} matched.`,
        );
      } else {
        await matchApi.publish(pendingAction.cycleId, pendingAction.track);
        // Cycle status flips to 'published' — refresh cycles + scoped.
        await Promise.all([loadCycles(), loadScoped(pendingAction.cycleId)]);
        setSuccessMessage(
          `${ACTION_LABELS[pendingAction.track]} results published. Applicants have been notified.`,
        );
      }
      setPendingAction(null);
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Action failed.'));
    } finally {
      setWorkingTrack(null);
      setWorkingKind(null);
    }
  }, [pendingAction, loadCycles, loadScoped]);

  function workingKindFor(track: Track): TrackWorkingKind | null {
    if (workingTrack !== track) return null;
    return workingKind;
  }

  // ---- Render --------------------------------------------------------

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-[40px] md:px-8">
      <div className="flex flex-col gap-[24px]">
        <header className="flex flex-col gap-[12px] md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-[32px] font-extrabold leading-[1.05] text-lrfap-navy md:text-[40px]">
              Matching Engine
            </h1>
            <p className="mt-[8px] max-w-[640px] font-sans text-[13px] text-slate-600">
              Run the Gale-Shapley match for each track, inspect results,
              and publish to applicants. Dry runs are safe previews that
              don&apos;t modify applications or cycle state. Official runs
              and publishing are one-way.
            </p>
          </div>
          <CycleSelector
            cycles={sortedCycles}
            selectedId={selectedCycleId}
            disabled={cyclesStatus !== 'loaded'}
            onChange={handleCycleChange}
          />
        </header>

        {successMessage ? (
          <div
            role="status"
            className="inline-flex max-w-fit items-center gap-[8px] border-[0.91px] border-emerald-200 bg-emerald-50 px-[12px] py-[8px] font-sans text-[12px] font-medium text-emerald-800"
          >
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
            {successMessage}
          </div>
        ) : null}

        {cyclesStatus === 'error' ? (
          <ErrorBanner message={cyclesError ?? 'Couldn’t load cycles.'} />
        ) : null}

        {cyclesStatus === 'loaded' && cycles.length === 0 ? (
          <EmptyState />
        ) : null}

        {cyclesStatus === 'loaded' && selectedCycleId ? (
          scopedStatus === 'loading' || scopedStatus === 'idle' ? (
            <SkeletonGrid />
          ) : scopedStatus === 'error' ? (
            <ErrorBanner
              message={scopedError ?? 'Couldn’t load matching data.'}
            />
          ) : (
            <div className="grid grid-cols-1 gap-[20px] lg:grid-cols-2">
              <TrackPanel
                track="residency"
                title="Residency"
                cycleStatus={selectedCycle?.status ?? null}
                readiness={readinessByTrack.residency}
                runs={runsByTrack.residency}
                hasCompletedOfficial={officialByTrack.residency}
                publishWarning={publishWarning}
                workingKind={workingKindFor('residency')}
                selectedRunId={drawerRunId}
                onDryRun={() => void runDry('residency')}
                onRequestExecute={() => requestExecute('residency')}
                onRequestPublish={() => requestPublish('residency')}
                onSelectRun={setDrawerRunId}
              />
              <TrackPanel
                track="fellowship"
                title="Fellowship"
                cycleStatus={selectedCycle?.status ?? null}
                readiness={readinessByTrack.fellowship}
                runs={runsByTrack.fellowship}
                hasCompletedOfficial={officialByTrack.fellowship}
                publishWarning={publishWarning}
                workingKind={workingKindFor('fellowship')}
                selectedRunId={drawerRunId}
                onDryRun={() => void runDry('fellowship')}
                onRequestExecute={() => requestExecute('fellowship')}
                onRequestPublish={() => requestPublish('fellowship')}
                onSelectRun={setDrawerRunId}
              />
            </div>
          )
        ) : null}
      </div>

      <ConfirmActionDialog
        open={!!pendingAction}
        title={confirmTitleFor(pendingAction)}
        body={confirmBodyFor(pendingAction)}
        confirmLabel={confirmLabelFor(pendingAction)}
        tone={pendingAction?.kind === 'publish' ? 'danger' : 'navy'}
        isWorking={
          workingKind === 'execute' || workingKind === 'publish'
        }
        errorMessage={actionError}
        onCancel={cancelPending}
        onConfirm={() => void confirmPending()}
      />

      <RunDetailsDrawer
        open={drawerRunId !== null}
        runId={drawerRunId}
        programsById={programsById}
        onClose={() => setDrawerRunId(null)}
      />
    </div>
  );
}

// ---- Confirm copy ------------------------------------------------------

function confirmTitleFor(action: PendingAction | null): string {
  if (!action) return '';
  const track = ACTION_LABELS[action.track];
  if (action.kind === 'execute') return `Run official ${track} match?`;
  return `Publish ${track} results?`;
}

function confirmBodyFor(action: PendingAction | null): React.ReactNode {
  if (!action) return null;
  if (action.kind === 'execute') {
    return (
      <>
        This creates an official match run for the{' '}
        <strong>{action.track}</strong> track and commits applicant → program
        assignments. The cycle will advance to <strong>matching</strong> and
        program seats will be updated. Official runs cannot be repeated —
        use a dry run first if you want to preview the outcome.
      </>
    );
  }
  return (
    <>
      Publishing sends match emails to every applicant in the{' '}
      <strong>{action.track}</strong> track and locks the cycle. Because of
      a known backend constraint, publishing one track immediately flips
      the cycle to <strong>published</strong> for both tracks — publish the
      other track first if you haven&apos;t yet, or publish them
      back-to-back.
    </>
  );
}

function confirmLabelFor(action: PendingAction | null): string {
  if (!action) return 'Confirm';
  const track = ACTION_LABELS[action.track];
  if (action.kind === 'execute') return `Execute ${track}`;
  return `Publish ${track}`;
}

// ---- Subcomponents ----------------------------------------------------

interface CycleSelectorProps {
  cycles: Cycle[];
  selectedId: ID | null;
  disabled: boolean;
  onChange: (id: ID) => void;
}

function CycleSelector({
  cycles,
  selectedId,
  disabled,
  onChange,
}: CycleSelectorProps) {
  return (
    <label className="flex shrink-0 flex-col gap-[6px]">
      <span className="font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Cycle
      </span>
      <select
        value={selectedId ?? ''}
        disabled={disabled || cycles.length === 0}
        onChange={(e) => onChange(e.target.value)}
        className="h-[40px] min-w-[260px] appearance-none border-[0.91px] border-lrfap-ghost bg-white px-[14px] font-sans text-[14px] text-lrfap-navy transition-colors hover:border-slate-300 focus:border-lrfap-sky focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
      >
        {cycles.length === 0 ? (
          <option value="" disabled>
            No cycles available
          </option>
        ) : null}
        {cycles.map((c) => (
          <option key={c._id} value={c._id}>
            {c.name} · {c.year} · {c.status}
          </option>
        ))}
      </select>
    </label>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
    >
      <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border-[0.91px] border-dashed border-lrfap-ghost bg-white px-[24px] py-[40px] text-center">
      <h2 className="font-display text-[18px] font-bold text-lrfap-navy">
        No cycles yet
      </h2>
      <p className="mx-auto mt-[6px] max-w-[420px] font-sans text-[13px] text-slate-600">
        Create an application cycle under <strong>Cycles</strong> before
        running matching.
      </p>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-[20px] lg:grid-cols-2">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-[420px] animate-pulse rounded-xl border-[0.91px] border-lrfap-ghost bg-slate-50"
        />
      ))}
    </div>
  );
}
