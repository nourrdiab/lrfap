import { Check, X } from 'lucide-react';

/**
 * Two-item readiness checklist for a track. Backend enforces the real
 * invariants on each action; this is advisory so buttons can disable
 * with a hint instead of failing on click.
 *
 * Item 1 — every program in (track, cycle) that has applicants has a
 *   submitted ProgramRanking. Programs without applicants are ignored
 *   because matching silently excludes them regardless of ranking state
 *   (see matchController.gatherInputs).
 * Item 2 — cycle is not yet published or closed.
 *
 * "At least one submitted application" is not a separate item because
 * it's captured by `programsWithApplicants === 0`: if zero programs
 * have applicants, there's nothing to match.
 */

export interface ReadinessState {
  allProgramsRanked: boolean;
  totalPrograms: number;
  submittedRankings: number;
  programsWithApplicants: number;
  programsWithApplicantsAndSubmittedRanking: number;
  cycleActionable: boolean;
  cycleStatus: string;
}

interface MatchingReadinessProps {
  state: ReadinessState;
}

export function MatchingReadiness({ state }: MatchingReadinessProps) {
  return (
    <ul role="list" className="flex flex-col gap-[6px]">
      <ChecklistItem
        passed={state.allProgramsRanked}
        label={rankingLabel(state)}
        detail={rankingDetail(state)}
      />
      <ChecklistItem
        passed={state.cycleActionable}
        label="Cycle is still actionable"
        detail={
          state.cycleActionable
            ? `Status: ${state.cycleStatus}`
            : `Cycle is ${state.cycleStatus} — matching can no longer run.`
        }
      />
    </ul>
  );
}

function rankingLabel(state: ReadinessState): string {
  if (state.totalPrograms === 0) return 'Programs for this track';
  if (state.programsWithApplicants === 0) return 'Applicants for this track';
  return 'All programs with applicants have submitted rankings';
}

function rankingDetail(state: ReadinessState): string {
  if (state.totalPrograms === 0) {
    return 'No programs in this track for the selected cycle.';
  }
  if (state.programsWithApplicants === 0) {
    return 'No programs have applicants yet for this track.';
  }
  return `${state.programsWithApplicantsAndSubmittedRanking} of ${state.programsWithApplicants} programs with applicants are ranked`;
}

function ChecklistItem({
  passed,
  label,
  detail,
}: {
  passed: boolean;
  label: string;
  detail?: string;
}) {
  return (
    <li className="flex items-start gap-[8px] font-sans text-[12px]">
      <span
        aria-hidden="true"
        className={`mt-[2px] inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full ${
          passed ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {passed ? (
          <Check className="h-3 w-3" strokeWidth={3} />
        ) : (
          <X className="h-3 w-3" strokeWidth={3} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className={passed ? 'text-lrfap-navy' : 'text-slate-600'}>{label}</p>
        {detail ? (
          <p className="mt-[1px] text-[11px] italic text-slate-500">{detail}</p>
        ) : null}
      </div>
    </li>
  );
}
