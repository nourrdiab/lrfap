import type { MatchRunStatus, MatchRunType } from '../../../types';

/**
 * Two side-by-side pills for a MatchRun: type (Dry / Official) and
 * lifecycle status (Running / Completed / Failed). Re-usable in the
 * history list and inside the details drawer so both surfaces share
 * one vocabulary.
 */

const TYPE_CLS: Record<MatchRunType, string> = {
  dry_run: 'border-slate-200 bg-slate-50 text-slate-600',
  official: 'border-lrfap-navy/20 bg-lrfap-navy/5 text-lrfap-navy',
};

const TYPE_LABEL: Record<MatchRunType, string> = {
  dry_run: 'Dry run',
  official: 'Official',
};

const STATUS_CLS: Record<MatchRunStatus, string> = {
  running: 'border-amber-200 bg-amber-50 text-amber-800',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  failed: 'border-rose-200 bg-rose-50 text-rose-800',
};

const STATUS_LABEL: Record<MatchRunStatus, string> = {
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
};

interface RunStatusPillProps {
  runType: MatchRunType;
  status: MatchRunStatus;
}

export function RunStatusPill({ runType, status }: RunStatusPillProps) {
  return (
    <span className="inline-flex items-center gap-[6px]">
      <span
        className={`inline-flex items-center border-[0.91px] px-[8px] py-[1px] font-sans text-[11px] font-medium uppercase tracking-wide ${TYPE_CLS[runType]}`}
      >
        {TYPE_LABEL[runType]}
      </span>
      <span
        className={`inline-flex items-center border-[0.91px] px-[8px] py-[1px] font-sans text-[11px] font-medium uppercase tracking-wide ${STATUS_CLS[status]}`}
      >
        {STATUS_LABEL[status]}
      </span>
    </span>
  );
}
