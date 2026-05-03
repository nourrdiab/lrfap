import { Plus } from 'lucide-react';
import type { ApplicationStatus, ID } from '../../../types';
import type { RankedRowData } from './RankedList';

/**
 * Eligible applicants who haven't been placed in the ranking yet.
 * Clicking "Add" appends them to the bottom of the Ranked list.
 * Hidden entirely on locked pages (no adds allowed once submitted).
 */

interface UnrankedListProps {
  rows: RankedRowData[];
  onAdd: (applicationId: ID) => void;
}

const STATUS_TONE: Record<ApplicationStatus, string> = {
  draft: 'border-slate-200 bg-slate-50 text-slate-600',
  submitted: 'border-lrfap-sky/40 bg-lrfap-sky/10 text-lrfap-navy',
  under_review: 'border-amber-200 bg-amber-50 text-amber-800',
  matched: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  unmatched: 'border-rose-200 bg-rose-50 text-rose-800',
  withdrawn: 'border-slate-200 bg-slate-50 text-slate-500',
};

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  matched: 'Matched',
  unmatched: 'Unmatched',
  withdrawn: 'Withdrawn',
};

export function UnrankedList({ rows, onAdd }: UnrankedListProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-[6px] border border-dashed border-lrfap-ghost bg-white/60 px-[16px] py-[28px] text-center">
        <p className="font-sans text-[12px] text-slate-500">
          All eligible applicants are in your ranking.
        </p>
      </div>
    );
  }

  return (
    <ul
      role="list"
      className="flex flex-col divide-y divide-lrfap-ghost border-[0.91px] border-lrfap-ghost bg-white shadow-[0_4px_24px_-12px_rgba(38,43,102,0.08)]"
    >
      {rows.map((row) => (
        <li key={row.applicationId} className="flex items-center gap-[12px] px-[16px] py-[12px]">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-[8px]">
              <p className="truncate font-sans text-[14px] font-semibold text-lrfap-navy">
                {row.name}
              </p>
            </div>
            <div className="mt-[2px] flex flex-wrap items-center gap-[10px]">
              {row.email ? (
                <span className="truncate font-sans text-[12px] text-slate-500">
                  {row.email}
                </span>
              ) : null}
              <span
                className={`inline-flex items-center border-[0.91px] px-[8px] py-[1px] font-sans text-[10px] font-medium uppercase tracking-wide ${STATUS_TONE[row.status]}`}
              >
                {STATUS_LABEL[row.status]}
              </span>
              {row.reference ? (
                <span className="font-mono text-[11px] text-slate-500">
                  {row.reference}
                </span>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onAdd(row.applicationId)}
            aria-label={`Add ${row.name} to ranking`}
            className="inline-flex shrink-0 items-center gap-[6px] border-[0.91px] border-lrfap-navy px-[12px] py-[6px] font-sans text-[11px] font-medium uppercase tracking-wide text-lrfap-navy transition-colors hover:bg-lrfap-navy hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            Add
          </button>
        </li>
      ))}
    </ul>
  );
}
