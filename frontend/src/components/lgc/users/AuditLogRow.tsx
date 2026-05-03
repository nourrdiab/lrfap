import { ChevronDown, ChevronRight } from 'lucide-react';
import { humanizeAction } from '../../../utils/humanizeAction';
import { formatRelativeShort } from '../../../utils/relativeTime';
import type { AuditActorRole, AuditLog, User } from '../../../types';

/**
 * Single audit-log row. The row itself is a click target that toggles
 * an expanded detail region showing IP address + metadata. Keeping
 * metadata/IP out of the main grid cuts visual noise — most rows are
 * boring and the user only expands when they're investigating.
 */

interface AuditLogRowProps {
  log: AuditLog;
  expanded: boolean;
  onToggle: () => void;
}

const COLUMN_COUNT = 6;

const ROLE_PILL: Record<AuditActorRole, string> = {
  applicant: 'border-sky-200 bg-sky-50 text-sky-800',
  university: 'border-violet-200 bg-violet-50 text-violet-800',
  lgc: 'border-lrfap-sky/40 bg-lrfap-sky/10 text-lrfap-navy',
  system: 'border-slate-200 bg-slate-50 text-slate-600',
};

function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function actorLabel(actor: AuditLog['actor']): {
  name: string;
  email: string | null;
} {
  if (actor && typeof actor === 'object') {
    const u = actor as User;
    const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
    return {
      name: full || u.email || '—',
      email: full && u.email ? u.email : null,
    };
  }
  return { name: 'Deleted user', email: null };
}

export function AuditLogRow({ log, expanded, onToggle }: AuditLogRowProps) {
  const actor = actorLabel(log.actor);
  const pill = ROLE_PILL[log.actorRole] ?? ROLE_PILL.system;
  const isoTitle = formatAbsolute(log.createdAt);
  const humanized = humanizeAction(log.action);

  const metadataEntries = log.metadata
    ? Object.entries(log.metadata).filter(([, v]) => v !== null && v !== undefined)
    : [];

  return (
    <>
      <tr
        className={`cursor-pointer transition-colors hover:bg-slate-50 ${
          expanded
            ? 'bg-slate-50'
            : 'border-b border-lrfap-ghost/60'
        }`}
        onClick={onToggle}
      >
        <td className="w-[40px] pl-[16px] pr-[4px] py-[12px] align-middle">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            aria-label={expanded ? 'Collapse row' : 'Expand row'}
            aria-expanded={expanded}
            className="inline-flex h-[24px] w-[24px] items-center justify-center text-slate-400 hover:text-lrfap-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy"
          >
            {expanded ? (
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
            ) : (
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        </td>

        <td
          className="whitespace-nowrap px-[12px] py-[12px] align-middle font-sans text-[12px] text-slate-600"
          title={isoTitle}
        >
          {formatRelativeShort(log.createdAt)}
        </td>

        <td className="px-[12px] py-[12px] align-middle">
          <p className="font-sans text-[13px] font-medium text-lrfap-navy">
            {actor.name}
          </p>
          <div className="mt-[2px] flex flex-wrap items-center gap-[6px]">
            <span
              className={`inline-flex items-center border-[0.91px] px-[6px] py-0 font-sans text-[10px] font-medium uppercase tracking-wide ${pill}`}
            >
              {log.actorRole}
            </span>
            {actor.email ? (
              <span className="font-sans text-[11px] text-slate-500">
                {actor.email}
              </span>
            ) : null}
          </div>
        </td>

        <td className="px-[12px] py-[12px] align-middle">
          <p className="font-sans text-[13px] text-slate-800">{humanized}</p>
          <p className="mt-[2px] font-mono text-[10px] text-slate-400">
            {log.action}
          </p>
        </td>

        <td className="whitespace-nowrap px-[12px] py-[12px] align-middle font-sans text-[12px] text-slate-600">
          {log.targetType ?? <span className="text-slate-400">—</span>}
        </td>

        <td className="whitespace-nowrap px-[12px] py-[12px] pr-[16px] align-middle">
          {log.outcome === 'failure' ? (
            <span className="inline-flex items-center border-[0.91px] border-rose-200 bg-rose-50 px-[8px] py-[1px] font-sans text-[10px] font-medium uppercase tracking-wide text-rose-700">
              ✗ Failure
            </span>
          ) : (
            <span className="inline-flex items-center border-[0.91px] border-emerald-200 bg-emerald-50 px-[8px] py-[1px] font-sans text-[10px] font-medium uppercase tracking-wide text-emerald-700">
              ✓ Success
            </span>
          )}
        </td>
      </tr>

      {expanded ? (
        <tr className="border-b border-lrfap-ghost/60 bg-slate-50">
          <td></td>
          <td colSpan={COLUMN_COUNT - 1} className="px-[12px] pr-[16px] pb-[16px] pt-0">
            <dl className="grid grid-cols-1 gap-x-[24px] gap-y-[6px] border-t border-slate-200 pt-[12px] sm:grid-cols-[160px_1fr]">
              <Detail label="Target ID">
                {log.targetId ? (
                  <span className="font-mono text-[12px] text-slate-800">
                    {log.targetId}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </Detail>
              <Detail label="Timestamp">
                <span className="font-mono text-[12px] text-slate-800">
                  {log.createdAt}
                </span>
              </Detail>
              <Detail label="Metadata">
                {metadataEntries.length === 0 ? (
                  <span className="text-slate-400">—</span>
                ) : (
                  <ul className="flex flex-col gap-[4px]">
                    {metadataEntries.map(([k, v]) => (
                      <li
                        key={k}
                        className="flex flex-wrap gap-[8px] font-sans text-[12px]"
                      >
                        <span className="font-medium text-slate-700">
                          {k}:
                        </span>
                        <span className="break-all font-mono text-slate-800">
                          {formatMetadataValue(v)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Detail>
            </dl>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="font-sans text-[12px] text-slate-700">{children}</dd>
    </>
  );
}

function formatMetadataValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
