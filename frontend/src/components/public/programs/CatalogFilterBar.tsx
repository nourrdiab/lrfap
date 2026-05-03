import { Fragment } from 'react';
import { Search, X } from 'lucide-react';
import type { Cycle, ID, Specialty, Track, University } from '../../../types';

/**
 * Filter bar for the public program catalog. Presentational — parent
 * owns state (URL-synced via useSearchParams).
 *
 * Styling mirrors the LGC Catalog filter bar for platform consistency:
 * same input heights, same uppercase small-caps labels, same track
 * segmented control. The visual difference is the public variant sits
 * on a plain white page (no tab shell), so the filter bar wraps in its
 * own bordered block to define the region.
 */

export type TrackFilter = 'all' | Track;
export type CycleFilter = 'all' | ID;
export type UniversityFilter = 'all' | ID;
export type SpecialtyFilter = 'all' | ID;

export interface CatalogFilterValues {
  search: string;
  cycle: CycleFilter;
  track: TrackFilter;
  university: UniversityFilter;
  specialty: SpecialtyFilter;
}

interface CatalogFilterBarProps {
  values: CatalogFilterValues;
  onChange: (values: CatalogFilterValues) => void;
  cycles: Cycle[];
  universities: University[];
  specialties: Specialty[];
  isBusy?: boolean;
  hasAnyActive: boolean;
  onClear: () => void;
}

const SELECT_CLS =
  'h-[40px] w-full appearance-none rounded-xl bg-lrfap-ghost/40 px-[12px] font-sans text-[13px] text-lrfap-navy transition-colors focus:bg-lrfap-ghost/60 focus:outline-none focus:ring-2 focus:ring-lrfap-sky/60 disabled:cursor-not-allowed disabled:bg-slate-50';

export function CatalogFilterBar({
  values,
  onChange,
  cycles,
  universities,
  specialties,
  isBusy,
  hasAnyActive,
  onClear,
}: CatalogFilterBarProps) {
  function patch<K extends keyof CatalogFilterValues>(
    key: K,
    value: CatalogFilterValues[K],
  ) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="flex flex-col gap-[14px] rounded-xl bg-white p-[18px] shadow-[0_8px_32px_-12px_rgba(38,43,102,0.2)]">
      <div className="flex flex-col gap-[10px] sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor="catalog-search" className="relative flex-1 sm:max-w-[440px]">
          <span className="sr-only">Search programs</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-[12px] top-1/2 h-4 w-4 -translate-y-1/2 text-lrfap-navy"
          />
          <input
            id="catalog-search"
            type="search"
            value={values.search}
            onChange={(e) => patch('search', e.target.value)}
            placeholder="Search specialty, university, description…"
            disabled={isBusy}
            className="h-[40px] w-full rounded-xl bg-lrfap-ghost/40 pl-[36px] pr-[14px] font-sans text-[14px] text-lrfap-navy transition-colors placeholder:text-lrfap-navy focus:bg-lrfap-ghost/60 focus:outline-none focus:ring-2 focus:ring-lrfap-sky/60 disabled:cursor-not-allowed disabled:bg-slate-50"
          />
        </label>
        {hasAnyActive ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-[40px] shrink-0 items-center justify-center gap-[6px] rounded-lg bg-lrfap-ghost/40 px-[14px] font-sans text-[12px] font-medium uppercase tracking-wide text-lrfap-navy transition-colors hover:bg-lrfap-ghost/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-[10px]">
        <div className="flex flex-[2] flex-col gap-[4px] min-w-[280px]">
          <label
            htmlFor="catalog-filter-cycle"
            className="font-sans text-[13px] font-semibold uppercase tracking-wide text-lrfap-navy"
          >
            Cycle
          </label>
          <select
            id="catalog-filter-cycle"
            value={values.cycle}
            onChange={(e) => patch('cycle', e.target.value as CycleFilter)}
            disabled={isBusy}
            className={SELECT_CLS}
          >
            <option value="all">All cycles</option>
            {cycles.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} · {c.year}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-1 flex-col gap-[4px] min-w-[260px]">
          <span
            id="catalog-filter-track-label"
            className="font-sans text-[13px] font-semibold uppercase tracking-wide text-lrfap-navy"
          >
            Track
          </span>
          <div
            role="radiogroup"
            aria-labelledby="catalog-filter-track-label"
            className="flex h-[40px] items-stretch overflow-hidden rounded-xl bg-white ring-1 ring-inset ring-lrfap-navy"
          >
            {(['all', 'residency', 'fellowship'] as TrackFilter[]).map((t, i) => {
              const selected = values.track === t;
              return (
                <Fragment key={t}>
                  {i > 0 ? (
                    <span
                      aria-hidden="true"
                      className="my-[8px] w-px bg-lrfap-navy/15"
                    />
                  ) : null}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => patch('track', t)}
                    disabled={isBusy}
                    className={`flex-1 px-[10px] font-sans text-[11px] font-medium uppercase tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-60 ${
                      selected
                        ? 'bg-lrfap-navy text-white'
                        : 'bg-transparent text-lrfap-navy hover:bg-lrfap-navy/5'
                    }`}
                  >
                    {t === 'all' ? 'All' : t}
                  </button>
                </Fragment>
              );
            })}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-[4px] min-w-[180px]">
          <label
            htmlFor="catalog-filter-university"
            className="font-sans text-[13px] font-semibold uppercase tracking-wide text-lrfap-navy"
          >
            University
          </label>
          <select
            id="catalog-filter-university"
            value={values.university}
            onChange={(e) => patch('university', e.target.value as UniversityFilter)}
            disabled={isBusy}
            className={SELECT_CLS}
          >
            <option value="all">All universities</option>
            {universities.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-1 flex-col gap-[4px] min-w-[180px]">
          <label
            htmlFor="catalog-filter-specialty"
            className="font-sans text-[13px] font-semibold uppercase tracking-wide text-lrfap-navy"
          >
            Specialty
          </label>
          <select
            id="catalog-filter-specialty"
            value={values.specialty}
            onChange={(e) => patch('specialty', e.target.value as SpecialtyFilter)}
            disabled={isBusy}
            className={SELECT_CLS}
          >
            <option value="all">All specialties</option>
            {specialties.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
