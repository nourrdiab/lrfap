import { useState } from 'react';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { AuditLogRow } from './AuditLogRow';
import type { AuditLog } from '../../../types';

/**
 * Paginated audit log table. Page size is fixed at 25 (product call,
 * not a user setting). The header shows the current window and total,
 * and Prev/Next are disabled at boundaries. Sort is the backend
 * default `-createdAt`; we don't expose a client toggle.
 */

interface AuditLogTableProps {
  logs: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** When true, dim the table without unmounting it — preserves scroll/expand state across pagination. */
  isRefreshing?: boolean;
}

export function AuditLogTable({
  logs,
  total,
  page,
  pageSize,
  onPageChange,
  isRefreshing,
}: AuditLogTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  // Human-readable window ("showing 26–50 of 137"). 1-indexed. When
  // total is zero we suppress it; the empty-state message covers it.
  const windowStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const windowEnd = Math.min(page * pageSize, total);

  return (
    <div
      className={`flex flex-col gap-[12px] transition-opacity ${
        isRefreshing ? 'opacity-60' : ''
      }`}
    >
      <div className="overflow-hidden border-[0.91px] border-lrfap-ghost bg-white shadow-[0_4px_24px_-12px_rgba(38,43,102,0.08)]">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-[8px] px-[16px] py-[56px] text-center">
            <Inbox
              aria-hidden="true"
              className="h-8 w-8 text-slate-300"
              strokeWidth={1.5}
            />
            <p className="font-sans text-[13px] text-slate-500">
              No audit entries match these filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-lrfap-ghost bg-lrfap-ghost/40">
                  <th className="w-[40px] pl-[16px] pr-[4px] py-[12px]"></th>
                  <Th>Time</Th>
                  <Th>Actor</Th>
                  <Th>Action</Th>
                  <Th>Target type</Th>
                  <Th>Outcome</Th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <AuditLogRow
                    key={log._id}
                    log={log}
                    expanded={expandedId === log._id}
                    onToggle={() =>
                      setExpandedId((cur) =>
                        cur === log._id ? null : log._id,
                      )
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-col items-start justify-between gap-[10px] sm:flex-row sm:items-center">
        <p className="font-sans text-[12px] text-slate-500">
          {total === 0 ? (
            <>No entries</>
          ) : (
            <>
              Showing <span className="font-medium text-lrfap-navy">{windowStart}</span>
              –<span className="font-medium text-lrfap-navy">{windowEnd}</span> of{' '}
              <span className="font-medium text-lrfap-navy">{total}</span>
              <span className="text-slate-400"> · Page {page} of {totalPages}</span>
            </>
          )}
        </p>
        <div className="flex items-center gap-[8px]">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={!canPrev}
            className="inline-flex h-[36px] items-center justify-center gap-[6px] border-[0.91px] border-lrfap-ghost bg-white px-[12px] font-sans text-[12px] font-medium uppercase tracking-wide text-slate-600 transition-colors hover:border-slate-300 hover:text-lrfap-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            Prev
          </button>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={!canNext}
            className="inline-flex h-[36px] items-center justify-center gap-[6px] border-[0.91px] border-lrfap-ghost bg-white px-[12px] font-sans text-[12px] font-medium uppercase tracking-wide text-slate-600 transition-colors hover:border-slate-300 hover:text-lrfap-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-[12px] py-[12px] text-left font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}
