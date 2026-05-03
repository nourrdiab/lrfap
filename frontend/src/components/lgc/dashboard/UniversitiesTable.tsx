import { useMemo, useState } from 'react';
import { Building2, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { ID, University } from '../../../types';

/**
 * Universities overview table — left column of the dashboard. Each row
 * derives a per-university "submission status" by aggregating ranking
 * statuses across that university's programs (in the active cycle).
 *
 * Status policy:
 *   - "All submitted"  — the university owns ≥ 1 program, AND every
 *                        one of those programs has a ProgramRanking
 *                        with status === 'submitted'. Emerald pill.
 *   - "Partial"        — some but not all programs have submitted
 *                        rankings (must be ≥ 1 submitted). Amber.
 *   - "Draft"          — no submitted rankings yet (or 0 programs
 *                        with a ranking document at all). Slate.
 *
 * A university with zero programs in the active cycle is rendered
 * with "—" program count and the "Draft" slate pill, since it has no
 * submitted rankings by definition.
 */

export type UniversityStatus = 'all_submitted' | 'partial' | 'draft';

export interface UniversityRow {
  universityId: ID;
  name: string;
  programCount: number;
  /** Most recent updatedAt across this university's programs; null when none. */
  lastUpdated: string | null;
  status: UniversityStatus;
}

interface UniversitiesTableProps {
  rows: UniversityRow[];
}

const PAGE_SIZE = 6;

const STATUS_PILL: Record<UniversityStatus, { label: string; cls: string }> = {
  all_submitted: {
    label: 'All submitted',
    cls: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  partial: {
    label: 'Partial',
    cls: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  draft: {
    label: 'Draft',
    cls: 'border-slate-200 bg-slate-50 text-slate-600',
  },
};

/**
 * Derive the per-university status from a set of per-program ranking
 * statuses. Exposed for unit-testability and called from DashboardPage
 * during the merge step.
 *
 * `totalPrograms` is the count of programs owned by this university
 * for the current cycle. `submittedRankings` is the count of those
 * programs whose ranking is currently in `submitted` state.
 */
export function deriveUniversityStatus(
  totalPrograms: number,
  submittedRankings: number,
): UniversityStatus {
  if (totalPrograms === 0) return 'draft';
  if (submittedRankings === 0) return 'draft';
  if (submittedRankings >= totalPrograms) return 'all_submitted';
  return 'partial';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export function UniversitiesTable({ rows }: UniversitiesTableProps) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, query]);

  // Clamp page when the filter shrinks the list below the current page.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <section
      aria-labelledby="universities-heading"
      className="flex flex-col gap-[14px]"
    >
      <div className="flex flex-col gap-[10px] md:flex-row md:items-center md:justify-between">
        <h2
          id="universities-heading"
          className="font-display text-[16px] font-bold uppercase tracking-wide text-lrfap-navy"
        >
          Universities
        </h2>
        <label className="relative block w-full max-w-[360px]">
          <span className="sr-only">Search universities</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-[12px] top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search universities…"
            className="h-[36px] w-full border-[0.91px] border-lrfap-ghost bg-white pl-[38px] pr-[12px] font-sans text-[13px] text-lrfap-navy placeholder:text-slate-400 focus:border-lrfap-navy focus:outline-none"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-[8px] border border-dashed border-lrfap-ghost bg-white/60 px-[16px] py-[40px] text-center">
          <Building2
            aria-hidden="true"
            className="h-8 w-8 text-slate-300"
            strokeWidth={1.5}
          />
          <p className="font-sans text-[13px] text-slate-500">
            {query
              ? `No universities match "${query}".`
              : 'No universities registered yet.'}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border-[0.91px] border-lrfap-ghost bg-white shadow-[0_4px_24px_-12px_rgba(38,43,102,0.08)]">
            {/* Desktop table */}
            <table className="hidden w-full border-collapse md:table">
              <thead>
                <tr className="border-b border-lrfap-ghost bg-lrfap-ghost/40">
                  <th className="px-[20px] py-[14px] text-left font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    University
                  </th>
                  <th className="px-[16px] py-[14px] text-left font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Programs
                  </th>
                  <th className="px-[16px] py-[14px] text-left font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Last updated
                  </th>
                  <th className="px-[20px] py-[14px] text-left font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, idx) => {
                  const pill = STATUS_PILL[row.status];
                  return (
                    <tr
                      key={row.universityId}
                      className={idx > 0 ? 'border-t border-lrfap-ghost/70' : ''}
                    >
                      <td className="px-[20px] py-[14px] align-middle font-sans text-[14px] font-semibold text-lrfap-navy">
                        {row.name}
                      </td>
                      <td className="px-[16px] py-[14px] align-middle font-sans text-[13px] text-slate-600">
                        {row.programCount > 0
                          ? row.programCount.toString().padStart(2, '0')
                          : '—'}
                      </td>
                      <td className="px-[16px] py-[14px] align-middle font-sans text-[13px] text-slate-600">
                        {formatDate(row.lastUpdated)}
                      </td>
                      <td className="px-[20px] py-[14px] align-middle">
                        <span
                          className={`inline-flex items-center border-[0.91px] px-[10px] py-[2px] font-sans text-[11px] font-medium uppercase tracking-wide ${pill.cls}`}
                        >
                          {pill.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile: stacked cards */}
            <ul role="list" className="flex flex-col md:hidden">
              {pageRows.map((row, idx) => {
                const pill = STATUS_PILL[row.status];
                return (
                  <li
                    key={row.universityId}
                    className={`px-[16px] py-[14px] ${idx > 0 ? 'border-t border-lrfap-ghost/70' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-[12px]">
                      <p className="truncate font-sans text-[14px] font-semibold text-lrfap-navy">
                        {row.name}
                      </p>
                      <span
                        className={`shrink-0 border-[0.91px] px-[8px] py-[1px] font-sans text-[10px] font-medium uppercase tracking-wide ${pill.cls}`}
                      >
                        {pill.label}
                      </span>
                    </div>
                    <p className="mt-[4px] font-sans text-[12px] text-slate-500">
                      {row.programCount > 0
                        ? `${row.programCount} ${row.programCount === 1 ? 'program' : 'programs'}`
                        : 'No programs'}{' '}
                      · {formatDate(row.lastUpdated)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-end gap-[8px]">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                aria-label="Previous page"
                className="inline-flex h-[32px] w-[32px] items-center justify-center border-[0.91px] border-lrfap-ghost bg-white text-lrfap-navy transition-colors hover:border-lrfap-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              </button>
              <span className="font-sans text-[12px] text-slate-600">
                Page {safePage + 1} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage === totalPages - 1}
                aria-label="Next page"
                className="inline-flex h-[32px] w-[32px] items-center justify-center border-[0.91px] border-lrfap-ghost bg-white text-lrfap-navy transition-colors hover:border-lrfap-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

// Re-export University type for callers constructing rows from the raw
// `/api/universities` response; prevents a double import at the call site.
export type { University };
