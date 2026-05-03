import type { MatchRun, User } from '../../../types';
import { formatRelativeShort } from '../../../utils/relativeTime';
import { RunStatusPill } from './RunStatusPill';

/**
 * Single row in the per-track run history list. Clicking the row opens
 * the details drawer. We render a button so keyboard/screen-reader
 * users get the expected semantics without an extra wrapper.
 */

interface RunHistoryRowProps {
  run: MatchRun;
  selected: boolean;
  onSelect: () => void;
}

function executedByName(ref: MatchRun['executedBy']): string {
  if (!ref || typeof ref === 'string') return 'Unknown';
  const u = ref as User;
  if (u.firstName || u.lastName) {
    return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
  }
  return u.email ?? 'Unknown';
}

export function RunHistoryRow({ run, selected, onSelect }: RunHistoryRowProps) {
  const res = run.results;
  const matched = res?.totalMatched ?? 0;
  const unmatched = res?.totalUnmatched ?? 0;
  const totalApplicants =
    run.inputsSnapshot?.applicantCount ?? matched + unmatched;
  const iterations = res?.iterations ?? 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full flex-col gap-[6px] border-[0.91px] px-[14px] py-[10px] text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky ${
        selected
          ? 'border-lrfap-sky bg-lrfap-sky/5'
          : 'border-lrfap-ghost bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-[8px]">
        <RunStatusPill runType={run.runType} status={run.status} />
        <span className="font-sans text-[11px] text-slate-500">
          {formatRelativeShort(run.createdAt)}
        </span>
      </div>
      <p className="font-sans text-[12px] text-slate-700">
        {run.status === 'completed' ? (
          <>
            <strong className="font-semibold text-lrfap-navy">
              {matched}
            </strong>
            {' / '}
            {totalApplicants} matched · {iterations} iteration
            {iterations === 1 ? '' : 's'}
          </>
        ) : run.status === 'failed' ? (
          <span className="text-rose-700">
            {run.error ?? 'Run failed before completion.'}
          </span>
        ) : (
          <span className="text-amber-700">In progress…</span>
        )}
      </p>
      <p className="font-sans text-[11px] text-slate-500">
        by {executedByName(run.executedBy)}
      </p>
    </button>
  );
}
