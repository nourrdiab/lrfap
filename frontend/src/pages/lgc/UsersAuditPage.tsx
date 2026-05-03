import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Plus, X } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { auditApi } from '../../api/audit';
import { getApiErrorMessage } from '../../utils/apiError';
import { CreateUserModal } from '../../components/lgc/users/CreateUserModal';
import {
  AuditFilterBar,
  type AuditFilterValues,
} from '../../components/lgc/users/AuditFilterBar';
import { AuditLogTable } from '../../components/lgc/users/AuditLogTable';
import type { AuditActorRole, AuditLog } from '../../types';

/**
 * LGC Users & Audit — audit log is the primary surface; user creation
 * is a modal. Read-only list of users isn't included because the
 * backend doesn't expose `GET /users` / update / deactivate routes
 * (see gap banner).
 *
 * Filters are exact-match on `action` and `targetType` — that matches
 * the backend query handler, which does string equality rather than
 * regex/contains. The datalist gives users the common values without
 * pretending we support fuzzy search.
 */

type FetchStatus = 'idle' | 'loading' | 'loaded' | 'error';

const PAGE_SIZE = 25;

const ACTION_SUGGESTIONS = [
  'USER_REGISTERED',
  'USER_LOGIN',
  'USER_CREATED_BY_ADMIN',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_COMPLETED',
  'PROGRAM_RANKING_SUBMITTED',
  'MATCH_RUN_EXECUTED',
  'RESULTS_PUBLISHED',
];

const TARGET_TYPE_SUGGESTIONS = [
  'User',
  'ProgramRanking',
  'MatchRun',
  'Cycle',
];

const INITIAL_FILTERS: AuditFilterValues = {
  actorRole: '',
  action: '',
  targetType: '',
};

export default function LGCUsersAuditPage() {
  useDocumentTitle('Users & audit');

  const [filters, setFilters] = useState<AuditFilterValues>(INITIAL_FILTERS);
  const debouncedAction = useDebouncedValue(filters.action, 200);
  const debouncedTarget = useDebouncedValue(filters.targetType, 200);

  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 8000);
    return () => clearTimeout(t);
  }, [successMessage]);

  // Reset pagination whenever any filter changes (debounced or not).
  // Mirror the debounce by resetting to page 1 on filter change; the
  // fetch keys off debounced values.
  useEffect(() => {
    setPage(1);
  }, [filters.actorRole, debouncedAction, debouncedTarget]);

  const loadLogs = useCallback(async () => {
    const hadData = logs.length > 0;
    if (hadData) setIsRefreshing(true);
    else setStatus('loading');
    setLoadError(null);
    try {
      const res = await auditApi.list({
        actorRole: filters.actorRole
          ? (filters.actorRole as AuditActorRole)
          : undefined,
        action: debouncedAction.trim() || undefined,
        targetType: debouncedTarget.trim() || undefined,
        limit: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      });
      setLogs(res.logs);
      setTotal(res.total);
      setStatus('loaded');
    } catch (err) {
      setLoadError(getApiErrorMessage(err, 'Couldn’t load audit log.'));
      setStatus('error');
    } finally {
      setIsRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.actorRole, debouncedAction, debouncedTarget, page]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const filtersForBar = useMemo(() => filters, [filters]);

  function handleCreateSuccess() {
    setModalOpen(false);
    setSuccessMessage('User created — they can sign in with the credentials you set.');
    // If we were sitting past page 1 a fresh USER_CREATED_BY_ADMIN row
    // would hide behind older entries, so jump back to the top.
    if (page !== 1) setPage(1);
    else void loadLogs();
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-[40px] md:px-8">
      <div className="flex flex-col gap-[24px]">
        <header className="flex flex-col gap-[12px] md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-[32px] font-extrabold leading-[1.05] text-lrfap-navy md:text-[40px]">
              Users &amp; audit
            </h1>
            <p className="mt-[8px] max-w-[640px] font-sans text-[13px] text-slate-600">
              Provision University and LGC accounts, and review every
              action recorded across the platform. The audit log is the
              system of record for who did what, when.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex h-[44px] shrink-0 items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[20px] font-sans text-[13px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Create user
          </button>
        </header>

        {successMessage ? (
          <div
            role="status"
            className="inline-flex max-w-fit items-center gap-[10px] border-[0.91px] border-emerald-200 bg-emerald-50 py-[8px] pl-[12px] pr-[8px] font-sans text-[12px] font-medium text-emerald-800"
          >
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              aria-label="Dismiss notification"
              className="inline-flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-sm text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        <section
          aria-labelledby="audit-section-heading"
          className="flex flex-col gap-[14px]"
        >
          <div className="flex items-baseline justify-between gap-[12px]">
            <h2
              id="audit-section-heading"
              className="font-display text-[18px] font-bold uppercase tracking-wide text-lrfap-navy"
            >
              Audit log
            </h2>
            <p className="font-sans text-[11px] text-slate-500">
              Sorted newest first · {PAGE_SIZE} per page
            </p>
          </div>

          <AuditFilterBar
            values={filtersForBar}
            onChange={setFilters}
            actionSuggestions={ACTION_SUGGESTIONS}
            targetTypeSuggestions={TARGET_TYPE_SUGGESTIONS}
          />

          {status === 'error' ? (
            <div
              role="alert"
              className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
            >
              <AlertCircle
                aria-hidden="true"
                className="mt-[2px] h-4 w-4 shrink-0"
              />
              <span>{loadError ?? 'Couldn’t load audit log.'}</span>
            </div>
          ) : null}

          {status === 'loading' || status === 'idle' ? (
            <div className="flex flex-col gap-[2px]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[56px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50"
                />
              ))}
            </div>
          ) : null}

          {status === 'loaded' || (status === 'error' && logs.length > 0) ? (
            <AuditLogTable
              logs={logs}
              total={total}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              isRefreshing={isRefreshing}
            />
          ) : null}
        </section>
      </div>

      <CreateUserModal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
