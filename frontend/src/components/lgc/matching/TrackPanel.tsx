import { AlertTriangle, FlaskConical, Loader2, Play, Send } from 'lucide-react';
import type { CycleStatus, ID, MatchRun, Track } from '../../../types';
import { MatchingReadiness, type ReadinessState } from './MatchingReadiness';
import { RunHistoryList } from './RunHistoryList';

/**
 * One track's column of the Matching Engine. Owns the readiness
 * checklist, the three actions (Dry Run / Execute / Publish), an
 * optional publish-lockout warning banner, and the per-track run
 * history. All data + mutations are lifted to the parent page so both
 * tracks can coordinate (e.g., publish-one-locks-the-cycle warning).
 */

export type TrackWorkingKind = 'dry' | 'execute' | 'publish';

interface TrackPanelProps {
  track: Track;
  title: string;
  cycleStatus: CycleStatus | null;
  readiness: ReadinessState;
  runs: MatchRun[];
  hasCompletedOfficial: boolean;
  /** Warning copy about the cross-track publish lockout, or null. */
  publishWarning: string | null;
  /** Which action on this track is currently running. */
  workingKind: TrackWorkingKind | null;
  selectedRunId: ID | null;
  onDryRun: () => void;
  onRequestExecute: () => void;
  onRequestPublish: () => void;
  onSelectRun: (runId: ID) => void;
}

export function TrackPanel({
  track,
  title,
  cycleStatus,
  readiness,
  runs,
  hasCompletedOfficial,
  publishWarning,
  workingKind,
  selectedRunId,
  onDryRun,
  onRequestExecute,
  onRequestPublish,
  onSelectRun,
}: TrackPanelProps) {
  const isCycleTerminal =
    cycleStatus === 'published' || cycleStatus === 'closed';
  const isAnyWorking = workingKind !== null;

  // Dry / execute both need rankings green and cycle still actionable.
  const canRunAny = readiness.allProgramsRanked && readiness.cycleActionable;
  // Execute additionally requires no completed official to already exist.
  const canExecute = canRunAny && !hasCompletedOfficial;
  // Publish requires a completed official AND cycle not already past matching.
  const canPublish = hasCompletedOfficial && !isCycleTerminal;

  const runningDry = workingKind === 'dry';
  const runningExecute = workingKind === 'execute';
  const runningPublish = workingKind === 'publish';

  // Specific disabled reasons for tooltips — browsers render native
  // `title` on most disabled buttons, so we lean on that rather than
  // building a tooltip primitive for this one use case.
  const dryDisabledReason = dryRunDisabledReason(readiness, isAnyWorking);
  const executeDisabledReason = executeActionDisabledReason(
    readiness,
    hasCompletedOfficial,
    isAnyWorking,
  );
  const publishDisabledReason = publishActionDisabledReason(
    readiness,
    hasCompletedOfficial,
    isCycleTerminal,
    cycleStatus,
    isAnyWorking,
  );

  return (
    <section
      aria-labelledby={`matching-${track}-heading`}
      className="flex flex-col gap-[16px] rounded-xl border-[0.91px] border-lrfap-ghost bg-white p-[20px] shadow-[0_4px_12px_rgba(38,43,102,0.08)]"
    >
      <header className="flex items-center justify-between gap-[10px]">
        <h2
          id={`matching-${track}-heading`}
          className="font-display text-[16px] font-bold uppercase tracking-wide text-lrfap-navy"
        >
          {title}
        </h2>
        {hasCompletedOfficial ? (
          <span className="inline-flex items-center border-[0.91px] border-emerald-200 bg-emerald-50 px-[10px] py-[2px] font-sans text-[11px] font-medium uppercase tracking-wide text-emerald-800">
            Official run complete
          </span>
        ) : null}
      </header>

      <MatchingReadiness state={readiness} />

      {publishWarning ? (
        <div
          role="note"
          className="flex items-start gap-[8px] border-[0.91px] border-amber-200 bg-amber-50 px-[12px] py-[10px] font-sans text-[12px] text-amber-900"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-[1px] h-4 w-4 shrink-0 text-amber-700"
          />
          <span>{publishWarning}</span>
        </div>
      ) : null}

      {/* Action row. Dry run and Execute share a stacked pair; Publish is
          a separate outlined button so it reads as a different phase of
          the workflow. */}
      <div className="flex flex-col gap-[10px]">
        <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-2">
          <ActionButton
            onClick={onDryRun}
            disabled={!canRunAny || isAnyWorking}
            loading={runningDry}
            icon={<FlaskConical aria-hidden="true" className="h-4 w-4" />}
            primary={false}
            idleLabel="Dry run"
            workingLabel="Running dry…"
            title={dryDisabledReason}
          />
          <ActionButton
            onClick={onRequestExecute}
            disabled={!canExecute || isAnyWorking}
            loading={runningExecute}
            icon={<Play aria-hidden="true" className="h-4 w-4" />}
            primary
            idleLabel={hasCompletedOfficial ? 'Official ran' : 'Execute'}
            workingLabel="Executing…"
            title={executeDisabledReason}
          />
        </div>
        <ActionButton
          onClick={onRequestPublish}
          disabled={!canPublish || isAnyWorking}
          loading={runningPublish}
          icon={<Send aria-hidden="true" className="h-4 w-4" />}
          primary={false}
          outlined
          idleLabel={
            isCycleTerminal ? `Cycle is ${cycleStatus}` : 'Publish results'
          }
          workingLabel="Publishing…"
          title={publishDisabledReason}
        />
      </div>

      <RunHistoryList
        runs={runs}
        selectedRunId={selectedRunId}
        onSelectRun={onSelectRun}
      />
    </section>
  );
}

interface ActionButtonProps {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  icon: React.ReactNode;
  idleLabel: string;
  workingLabel: string;
  /** Filled navy. */
  primary?: boolean;
  /** Outlined navy (used for Publish). */
  outlined?: boolean;
  title?: string;
}

function ActionButton({
  onClick,
  disabled,
  loading,
  icon,
  idleLabel,
  workingLabel,
  primary,
  outlined,
  title,
}: ActionButtonProps) {
  const base =
    'inline-flex h-[40px] w-full items-center justify-center gap-[8px] border-[0.91px] px-[16px] font-sans text-[12px] font-medium uppercase tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-50';
  const style = primary
    ? 'border-lrfap-navy bg-lrfap-navy text-white hover:bg-lrfap-navy/90'
    : outlined
      ? 'border-lrfap-navy bg-white text-lrfap-navy hover:bg-lrfap-navy hover:text-white'
      : 'border-lrfap-ghost bg-lrfap-ghost/30 text-lrfap-navy hover:border-slate-300 hover:bg-lrfap-ghost/60';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${base} ${style}`}
    >
      {loading ? (
        <>
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {workingLabel}
        </>
      ) : (
        <>
          {icon}
          {idleLabel}
        </>
      )}
    </button>
  );
}

// ---- Disabled-reason helpers -----------------------------------------

function dryRunDisabledReason(
  readiness: ReadinessState,
  isAnyWorking: boolean,
): string | undefined {
  if (isAnyWorking) return 'Another action is running — wait for it to finish.';
  if (readiness.totalPrograms === 0) {
    return 'No programs in this track for the selected cycle.';
  }
  if (!readiness.cycleActionable) {
    return `Cycle is ${readiness.cycleStatus} — matching can no longer run.`;
  }
  if (readiness.programsWithApplicants === 0) {
    return 'No programs have applicants yet for this track.';
  }
  if (!readiness.allProgramsRanked) {
    return `All programs with applicants must have submitted rankings first. Currently ${readiness.programsWithApplicantsAndSubmittedRanking} of ${readiness.programsWithApplicants}.`;
  }
  return undefined;
}

function executeActionDisabledReason(
  readiness: ReadinessState,
  hasCompletedOfficial: boolean,
  isAnyWorking: boolean,
): string | undefined {
  if (isAnyWorking) return 'Another action is running — wait for it to finish.';
  if (hasCompletedOfficial) {
    return 'An official match has already been run for this track. It cannot be repeated.';
  }
  return dryRunDisabledReason(readiness, false);
}

function publishActionDisabledReason(
  readiness: ReadinessState,
  hasCompletedOfficial: boolean,
  isCycleTerminal: boolean,
  cycleStatus: string | null,
  isAnyWorking: boolean,
): string | undefined {
  if (isAnyWorking) return 'Another action is running — wait for it to finish.';
  if (!hasCompletedOfficial) {
    return 'Run an official match first before publishing.';
  }
  if (isCycleTerminal) {
    return `Cycle is ${cycleStatus} — cannot publish again.`;
  }
  if (!readiness.cycleActionable) {
    return `Cycle is ${readiness.cycleStatus} — cannot publish.`;
  }
  return undefined;
}
