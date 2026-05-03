import { Link } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import type { LGCActivityEntry } from '../../../types';

/**
 * Recent audit activity — bottom full-width block. Reads its 5 entries
 * directly from the dashboard payload's pre-aggregated
 * `recentActivity` array (backend already limits to 10 there; we slice
 * to 5 for the dashboard preview). Action strings come through as raw
 * SNAKE_CASE (e.g. "PROGRAM_RANKING_SUBMITTED") which we humanize on
 * the fly.
 *
 * "View all" points at /lgc/users since that page will own the full
 * paginated audit log (alongside the Create User form). Until that
 * page ships, the link target is a placeholder — clicking goes to the
 * stub.
 */

interface AuditLogPreviewProps {
  entries: LGCActivityEntry[];
}

function humanizeAction(action: string): string {
  if (!action) return '—';
  const words = action
    .split(/[._\s]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
  if (words.length === 0) return action;
  const first = words[0];
  const rest = words.slice(1);
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AuditLogPreview({ entries }: AuditLogPreviewProps) {
  const rows = entries.slice(0, 5);
  return (
    <section
      aria-labelledby="audit-log-heading"
      className="flex flex-col gap-[12px]"
    >
      <div className="flex items-center justify-between gap-[12px]">
        <h2
          id="audit-log-heading"
          className="font-display text-[16px] font-bold uppercase tracking-wide text-lrfap-navy"
        >
          Audit / Log Summary
        </h2>
        <Link
          to="/lgc/users"
          className="font-sans text-[12px] font-semibold uppercase tracking-wide text-lrfap-sky underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
        >
          View all
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-[8px] border border-dashed border-lrfap-ghost bg-white/60 px-[16px] py-[40px] text-center">
          <Inbox
            aria-hidden="true"
            className="h-8 w-8 text-slate-300"
            strokeWidth={1.5}
          />
          <p className="font-sans text-[13px] text-slate-500">No recent activity</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border-[0.91px] border-lrfap-ghost bg-white shadow-[0_4px_24px_-12px_rgba(38,43,102,0.08)]">
          {/* Desktop table */}
          <table className="hidden w-full border-collapse md:table">
            <thead>
              <tr className="border-b border-lrfap-ghost bg-lrfap-ghost/40">
                <th className="px-[20px] py-[14px] text-left font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Time
                </th>
                <th className="px-[16px] py-[14px] text-left font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Actor
                </th>
                <th className="px-[16px] py-[14px] text-left font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Action
                </th>
                <th className="px-[20px] py-[14px] text-left font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Outcome
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={idx > 0 ? 'border-t border-lrfap-ghost/70' : ''}
                >
                  <td
                    className="px-[20px] py-[14px] align-middle font-sans text-[13px] text-slate-600"
                    title={formatAbsolute(row.createdAt)}
                  >
                    {formatRelative(row.createdAt)}{' '}
                    <span className="text-slate-400">· {formatTime(row.createdAt)}</span>
                  </td>
                  <td className="px-[16px] py-[14px] align-middle">
                    <p className="font-sans text-[13px] font-medium text-lrfap-navy">
                      {row.actor}
                    </p>
                    <p className="font-sans text-[11px] text-slate-500">{row.actorRole}</p>
                  </td>
                  <td className="px-[16px] py-[14px] align-middle font-sans text-[13px] text-slate-700">
                    {humanizeAction(row.action)}
                  </td>
                  <td className="px-[20px] py-[14px] align-middle">
                    {row.outcome === 'failure' ? (
                      <span className="inline-flex items-center border-[0.91px] border-rose-200 bg-rose-50 px-[8px] py-[1px] font-sans text-[10px] font-medium uppercase tracking-wide text-rose-700">
                        Failure
                      </span>
                    ) : (
                      <span className="inline-flex items-center border-[0.91px] border-emerald-200 bg-emerald-50 px-[8px] py-[1px] font-sans text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                        Success
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile stacked cards */}
          <ul role="list" className="flex flex-col md:hidden">
            {rows.map((row, idx) => (
              <li
                key={row.id}
                className={`px-[16px] py-[14px] ${idx > 0 ? 'border-t border-lrfap-ghost/70' : ''}`}
              >
                <div className="flex items-start justify-between gap-[10px]">
                  <p className="font-sans text-[13px] font-semibold text-lrfap-navy">
                    {humanizeAction(row.action)}
                  </p>
                  {row.outcome === 'failure' ? (
                    <span className="shrink-0 border-[0.91px] border-rose-200 bg-rose-50 px-[8px] py-[1px] font-sans text-[10px] font-medium uppercase tracking-wide text-rose-700">
                      Failure
                    </span>
                  ) : null}
                </div>
                <p className="mt-[2px] font-sans text-[12px] text-slate-500">
                  {row.actor} · {formatRelative(row.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
