import { Check, Loader2, Play, Send, X } from 'lucide-react';
import type { CycleStatus, ISODateString, Track } from '../../../types';
import { formatRelativeShort } from '../../../utils/relativeTime';

/**
 * Matching card — right column, middle. Consolidates the Figma's
 * "Lock Preferences" + "Run Matching" navy cards into a single card
 * that maps to real backend primitives:
 *
 *   - `POST /match/execute` (per track)   → Run {Residency,Fellowship} Match
 *   - `POST /match/publish` (per track)   → Publish {Residency,Fellowship} Results
 *
 * Readiness for a given track = (all programs of that track have
 * submitted rankings) AND (active cycle.status === 'matching'). When
 * the cycle isn't in 'matching' yet we surface a hint instead of a ✗
 * so the reviewer knows what to do next.
 *
 * Per-track state the parent passes in:
 *   - canRun      : checklist is green for this track
 *   - hasOfficial : a completed official run exists for this track
 *   - isPublished : the cycle is already 'published' (publish button
 *                   flips to disabled)
 */

export interface TrackState {
  canRun: boolean;
  hasOfficialRun: boolean;
  /** ISO timestamp of the most recent run (dry OR official) for this track. */
  lastRunAt: ISODateString | null;
  lastRunStatus: 'running' | 'completed' | 'failed' | null;
}

export interface MatchingCardProps {
  allProgramRankingsSubmitted: boolean;
  cycleStatus: CycleStatus | null;
  residency: TrackState;
  fellowship: TrackState;
  /** Tracks currently being run or published. Controls button spinner. */
  workingTrack: Track | null;
  workingKind: 'run' | 'publish' | null;
  onRunMatch: (track: Track) => void;
  onPublishResults: (track: Track) => void;
}

export function MatchingCard({
  allProgramRankingsSubmitted,
  cycleStatus,
  residency,
  fellowship,
  workingTrack,
  workingKind,
  onRunMatch,
  onPublishResults,
}: MatchingCardProps) {
  const inMatchingPhase = cycleStatus === 'matching';
  const isPublished = cycleStatus === 'published';
  const isClosed = cycleStatus === 'closed';

  return (
    <section
      aria-labelledby="matching-card-heading"
      className="rounded-xl border-[0.91px] border-lrfap-ghost bg-white p-[20px] shadow-[0_4px_12px_rgba(38,43,102,0.08)]"
    >
      <h2
        id="matching-card-heading"
        className="font-display text-[14px] font-bold uppercase tracking-wide text-lrfap-navy"
      >
        Run matching
      </h2>

      {/* Readiness checklist */}
      <ul role="list" className="mt-[12px] flex flex-col gap-[6px]">
        <ChecklistItem
          passed={allProgramRankingsSubmitted}
          label="All programs have submitted rankings"
        />
        <ChecklistItem
          passed={inMatchingPhase}
          label="Active cycle is in the matching phase"
          hint={
            inMatchingPhase
              ? undefined
              : isPublished || isClosed
                ? 'Cycle is already past matching.'
                : 'Advance the cycle to "Matching" first.'
          }
        />
      </ul>

      {/* Per-track run buttons */}
      <div className="mt-[16px] flex flex-col gap-[10px]">
        <TrackBlock
          track="residency"
          label="Residency"
          state={residency}
          inMatchingPhase={inMatchingPhase}
          isPublished={isPublished}
          workingTrack={workingTrack}
          workingKind={workingKind}
          onRunMatch={onRunMatch}
          onPublishResults={onPublishResults}
        />
        <TrackBlock
          track="fellowship"
          label="Fellowship"
          state={fellowship}
          inMatchingPhase={inMatchingPhase}
          isPublished={isPublished}
          workingTrack={workingTrack}
          workingKind={workingKind}
          onRunMatch={onRunMatch}
          onPublishResults={onPublishResults}
        />
      </div>
    </section>
  );
}

function ChecklistItem({
  passed,
  label,
  hint,
}: {
  passed: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <li className="flex items-start gap-[8px] font-sans text-[12px]">
      <span
        aria-hidden="true"
        className={`mt-[2px] inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full ${
          passed ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {passed ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={passed ? 'text-lrfap-navy' : 'text-slate-600'}>{label}</p>
        {hint ? (
          <p className="mt-[2px] text-[11px] italic text-slate-500">{hint}</p>
        ) : null}
      </div>
    </li>
  );
}

interface TrackBlockProps {
  track: Track;
  label: string;
  state: TrackState;
  inMatchingPhase: boolean;
  isPublished: boolean;
  workingTrack: Track | null;
  workingKind: 'run' | 'publish' | null;
  onRunMatch: (track: Track) => void;
  onPublishResults: (track: Track) => void;
}

function TrackBlock({
  track,
  label,
  state,
  inMatchingPhase,
  isPublished,
  workingTrack,
  workingKind,
  onRunMatch,
  onPublishResults,
}: TrackBlockProps) {
  const canRun = state.canRun && inMatchingPhase;
  const canPublish = state.hasOfficialRun && inMatchingPhase && !isPublished;
  const isRunning = workingTrack === track && workingKind === 'run';
  const isPublishing = workingTrack === track && workingKind === 'publish';

  return (
    <div className="flex flex-col gap-[6px] border-[0.91px] border-lrfap-ghost bg-lrfap-ghost/20 p-[12px]">
      <div className="flex items-center justify-between gap-[10px]">
        <p className="font-sans text-[12px] font-semibold uppercase tracking-wide text-lrfap-navy">
          {label}
        </p>
        <p className="font-sans text-[11px] text-slate-500">
          {state.lastRunAt
            ? `Last run · ${formatRelativeShort(state.lastRunAt)}${
                state.lastRunStatus && state.lastRunStatus !== 'completed'
                  ? ` (${state.lastRunStatus})`
                  : ''
              }`
            : 'Last run: not yet'}
        </p>
      </div>
      <div className="flex flex-col gap-[8px] md:flex-row">
        <button
          type="button"
          onClick={() => onRunMatch(track)}
          disabled={!canRun || isRunning || isPublishing}
          className="inline-flex h-[36px] flex-1 items-center justify-center gap-[6px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[14px] font-sans text-[11px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRunning ? (
            <>
              <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              Running…
            </>
          ) : (
            <>
              <Play aria-hidden="true" className="h-3.5 w-3.5" />
              Run {label} match
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => onPublishResults(track)}
          disabled={!canPublish || isRunning || isPublishing}
          className="inline-flex h-[36px] flex-1 items-center justify-center gap-[6px] border-[0.91px] border-lrfap-navy bg-white px-[14px] font-sans text-[11px] font-medium uppercase tracking-wide text-lrfap-navy transition-colors hover:bg-lrfap-navy hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPublishing ? (
            <>
              <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              Publishing…
            </>
          ) : (
            <>
              <Send aria-hidden="true" className="h-3.5 w-3.5" />
              Publish {label}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
