import type { ApplicationReviewState } from '../../../types';

/**
 * Client-side filter chips for the program applications list, keyed on
 * the per-university review state attached by the backend. Per-program
 * lists are small so chip switching stays client-side.
 */

export type ReviewStateFilter = ApplicationReviewState;

interface StatusFilterBarProps {
  active: ReviewStateFilter;
  counts: Record<ReviewStateFilter, number>;
  onChange: (next: ReviewStateFilter) => void;
}

const CHIPS: { key: ReviewStateFilter; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'under_review', label: 'Under review' },
  { key: 'reviewed', label: 'Reviewed' },
  { key: 'matched', label: 'Matched' },
];

export function StatusFilterBar({ active, counts, onChange }: StatusFilterBarProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter applicants by review state"
      className="flex flex-wrap items-center gap-[8px]"
    >
      {CHIPS.map(({ key, label }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(key)}
            className={`inline-flex items-center gap-[8px] border-[0.91px] px-[14px] py-[6px] font-sans text-[12px] font-medium uppercase tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky ${
              isActive
                ? 'border-lrfap-navy bg-lrfap-navy text-white'
                : 'border-lrfap-ghost bg-white text-lrfap-navy hover:border-lrfap-navy'
            }`}
          >
            <span>{label}</span>
            <span
              className={`inline-flex min-w-[20px] items-center justify-center rounded-full px-[6px] py-[1px] font-sans text-[10px] font-semibold ${
                isActive ? 'bg-white/20 text-white' : 'bg-lrfap-ghost text-lrfap-navy'
              }`}
            >
              {counts[key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
