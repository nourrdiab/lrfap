import { X } from 'lucide-react';
import type { AuditActorRole } from '../../../types';

/**
 * Filter bar for the audit log. The backend does exact-match on
 * `action` and `targetType`, so we seed a `<datalist>` with common
 * values rather than fake a search.
 *
 * Debouncing happens one level up in the page (useDebouncedValue at
 * 200ms on the text fields); this component is a pure controlled input.
 */

export interface AuditFilterValues {
  actorRole: AuditActorRole | '';
  action: string;
  targetType: string;
}

interface AuditFilterBarProps {
  values: AuditFilterValues;
  onChange: (values: AuditFilterValues) => void;
  actionSuggestions: string[];
  targetTypeSuggestions: string[];
}

const ROLE_OPTIONS: Array<{ value: AuditActorRole | ''; label: string }> = [
  { value: '', label: 'All roles' },
  { value: 'applicant', label: 'Applicant' },
  { value: 'university', label: 'University' },
  { value: 'lgc', label: 'LGC' },
  { value: 'system', label: 'System' },
];

export function AuditFilterBar({
  values,
  onChange,
  actionSuggestions,
  targetTypeSuggestions,
}: AuditFilterBarProps) {
  const hasAny =
    values.actorRole !== '' || values.action !== '' || values.targetType !== '';

  function clear() {
    onChange({ actorRole: '', action: '', targetType: '' });
  }

  return (
    <div className="flex flex-col gap-[12px] border-[0.91px] border-lrfap-ghost bg-white p-[16px] md:flex-row md:items-end md:gap-[14px]">
      <div className="flex flex-col gap-[6px] md:w-[180px]">
        <label
          htmlFor="audit-filter-role"
          className="font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500"
        >
          Actor role
        </label>
        <select
          id="audit-filter-role"
          value={values.actorRole}
          onChange={(e) =>
            onChange({
              ...values,
              actorRole: e.target.value as AuditActorRole | '',
            })
          }
          className="h-[38px] w-full border-[0.91px] border-lrfap-ghost bg-white px-[10px] font-sans text-[13px] text-slate-900 transition-colors hover:border-slate-300 focus:border-lrfap-sky focus:outline-none"
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-[6px] md:flex-1">
        <label
          htmlFor="audit-filter-action"
          className="font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500"
        >
          Action (exact match)
        </label>
        <input
          id="audit-filter-action"
          type="text"
          list="audit-filter-action-options"
          value={values.action}
          onChange={(e) => onChange({ ...values, action: e.target.value })}
          placeholder="e.g. USER_LOGIN"
          className="h-[38px] w-full border-[0.91px] border-lrfap-ghost bg-white px-[10px] font-sans text-[13px] text-slate-900 placeholder:text-slate-400 transition-colors hover:border-slate-300 focus:border-lrfap-sky focus:outline-none"
        />
        <datalist id="audit-filter-action-options">
          {actionSuggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>

      <div className="flex flex-col gap-[6px] md:flex-1">
        <label
          htmlFor="audit-filter-target"
          className="font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500"
        >
          Target type (exact match)
        </label>
        <input
          id="audit-filter-target"
          type="text"
          list="audit-filter-target-options"
          value={values.targetType}
          onChange={(e) =>
            onChange({ ...values, targetType: e.target.value })
          }
          placeholder="e.g. ProgramRanking"
          className="h-[38px] w-full border-[0.91px] border-lrfap-ghost bg-white px-[10px] font-sans text-[13px] text-slate-900 placeholder:text-slate-400 transition-colors hover:border-slate-300 focus:border-lrfap-sky focus:outline-none"
        />
        <datalist id="audit-filter-target-options">
          {targetTypeSuggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>

      {hasAny ? (
        <button
          type="button"
          onClick={clear}
          className="inline-flex h-[38px] shrink-0 items-center justify-center gap-[6px] border-[0.91px] border-lrfap-ghost bg-white px-[14px] font-sans text-[12px] font-medium uppercase tracking-wide text-slate-600 transition-colors hover:border-slate-300 hover:text-lrfap-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
          Clear
        </button>
      ) : null}
    </div>
  );
}
