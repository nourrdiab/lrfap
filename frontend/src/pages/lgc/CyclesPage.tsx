import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { cyclesApi } from '../../api/cycles';
import { adminApi } from '../../api/admin';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatCountdown, pickNextDeadline } from '../../utils/cycleCountdown';
import { ConfirmActionDialog } from '../../components/lgc/ConfirmActionDialog';
import {
  CycleFormModal,
  type CycleFormValues,
} from '../../components/lgc/cycles/CycleFormModal';
import { nextStatusFor } from '../../components/lgc/dashboard/ActiveCycleCard';
import type { Cycle, CycleStatus } from '../../types';

/**
 * Cycles Management — LGC only.
 *
 * Cards-over-table on purpose: a cycle has five dates, a status, and
 * three actions (view/edit/advance), which packs awkwardly into a row
 * but reads cleanly as a stacked card. Sorted year-desc so the active
 * / most-recent cycle is at the top.
 *
 * The page owns three mutation flows:
 *   1. Create (modal → POST /cycles)
 *   2. Edit   (modal → PUT  /cycles/:id) — field locking enforced in
 *      the modal itself based on current status
 *   3. Advance status (ConfirmActionDialog → PATCH /cycles/:id/status)
 *
 * No delete: backend routes don't expose a DELETE endpoint (and even if
 * they did, soft-deleting a populated cycle would cascade into the
 * entire audit trail). Closed is the terminal state.
 */

type FetchStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface AdvancePending {
  cycleId: string;
  from: CycleStatus;
  to: CycleStatus;
}

const STATUS_PILL: Record<CycleStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'border-slate-200 bg-slate-50 text-slate-600' },
  open: { label: 'Open', cls: 'border-lrfap-sky/40 bg-lrfap-sky/10 text-lrfap-navy' },
  review: { label: 'Review', cls: 'border-amber-200 bg-amber-50 text-amber-800' },
  ranking: { label: 'Ranking', cls: 'border-amber-200 bg-amber-50 text-amber-800' },
  matching: { label: 'Matching', cls: 'border-amber-200 bg-amber-50 text-amber-800' },
  published: {
    label: 'Published',
    cls: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  closed: { label: 'Closed', cls: 'border-slate-200 bg-slate-50 text-slate-500' },
};

function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function LGCCyclesPage() {
  useDocumentTitle('Cycles');

  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form modal state (create + edit share the same component).
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formTarget, setFormTarget] = useState<Cycle | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Advance confirm state.
  const [advancePending, setAdvancePending] = useState<AdvancePending | null>(
    null,
  );
  const [advanceWorking, setAdvanceWorking] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);

  // TODO: Remove reset state + dialog before production deployment.
  // Dev/demo reset only.
  const [resetTarget, setResetTarget] = useState<Cycle | null>(null);
  const [resetWorking, setResetWorking] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // TODO: Remove bulk-submit state + dialog before production deployment.
  const [bulkSubmitTarget, setBulkSubmitTarget] = useState<Cycle | null>(null);
  const [bulkSubmitWorking, setBulkSubmitWorking] = useState(false);
  const [bulkSubmitError, setBulkSubmitError] = useState<string | null>(null);

  // Auto-dismissing success chip (used by the reset flow for now).
  // Reset/Submit-All toasts carry detailed counts that take a beat to
  // read — 15s auto-dismiss, plus a manual X for users done reading.
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 15000);
    return () => clearTimeout(t);
  }, [successMessage]);

  const loadAll = useCallback(async () => {
    setStatus('loading');
    setLoadError(null);
    try {
      const rows = await cyclesApi.list();
      setCycles(rows);
      setStatus('loaded');
    } catch (err) {
      setLoadError(getApiErrorMessage(err, 'Couldn’t load cycles.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const sortedCycles = useMemo(() => {
    return [...cycles].sort((a, b) => {
      // Year desc; tiebreak on createdAt desc so newer-within-a-year wins.
      if (b.year !== a.year) return b.year - a.year;
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  }, [cycles]);

  // ---- Action handlers -------------------------------------------------

  function openCreate() {
    setFormMode('create');
    setFormTarget(null);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(cycle: Cycle) {
    setFormMode('edit');
    setFormTarget(cycle);
    setFormError(null);
    setFormOpen(true);
  }

  function closeForm() {
    if (formSaving) return;
    setFormOpen(false);
    setFormError(null);
  }

  const submitForm = useCallback(
    async (values: CycleFormValues) => {
      setFormSaving(true);
      setFormError(null);
      try {
        if (formMode === 'create') {
          await cyclesApi.create(values);
        } else if (formTarget) {
          await cyclesApi.update(formTarget._id, values);
        }
        setFormOpen(false);
        await loadAll();
      } catch (err) {
        setFormError(getApiErrorMessage(err, 'Couldn’t save this cycle.'));
      } finally {
        setFormSaving(false);
      }
    },
    [formMode, formTarget, loadAll],
  );

  function requestAdvance(cycle: Cycle) {
    const next = nextStatusFor(cycle.status);
    if (!next) return;
    setAdvanceError(null);
    setAdvancePending({ cycleId: cycle._id, from: cycle.status, to: next });
  }

  function cancelAdvance() {
    if (advanceWorking) return;
    setAdvancePending(null);
    setAdvanceError(null);
  }

  const confirmAdvance = useCallback(async () => {
    if (!advancePending) return;
    setAdvanceWorking(true);
    setAdvanceError(null);
    try {
      await cyclesApi.setStatus(advancePending.cycleId, advancePending.to);
      setAdvancePending(null);
      await loadAll();
    } catch (err) {
      setAdvanceError(getApiErrorMessage(err, 'Couldn’t advance this cycle.'));
    } finally {
      setAdvanceWorking(false);
    }
  }, [advancePending, loadAll]);

  // TODO: Remove the reset handlers below before production deployment.
  function requestReset(cycle: Cycle) {
    setResetError(null);
    setResetTarget(cycle);
  }

  function cancelReset() {
    if (resetWorking) return;
    setResetTarget(null);
    setResetError(null);
  }

  const confirmReset = useCallback(async () => {
    if (!resetTarget) return;
    setResetWorking(true);
    setResetError(null);
    try {
      const result = await adminApi.resetCycle(resetTarget._id);
      setResetTarget(null);
      setSuccessMessage(
        `Cycle reset successfully — ${result.applicationsReset} applications reset, ${result.rankingsDeleted} rankings deleted, ${result.matchRunsDeleted} match runs deleted`,
      );
      await loadAll();
    } catch (err) {
      setResetError(getApiErrorMessage(err, 'Couldn’t reset this cycle.'));
    } finally {
      setResetWorking(false);
    }
  }, [resetTarget, loadAll]);

  // TODO: Remove bulk-submit handlers before production deployment.
  function requestBulkSubmit(cycle: Cycle) {
    setBulkSubmitError(null);
    setBulkSubmitTarget(cycle);
  }

  function cancelBulkSubmit() {
    if (bulkSubmitWorking) return;
    setBulkSubmitTarget(null);
    setBulkSubmitError(null);
  }

  const confirmBulkSubmit = useCallback(async () => {
    if (!bulkSubmitTarget) return;
    setBulkSubmitWorking(true);
    setBulkSubmitError(null);
    try {
      const result = await adminApi.bulkSubmitRankings(bulkSubmitTarget._id);
      setBulkSubmitTarget(null);
      setSuccessMessage(
        `Bulk-submitted ${result.rankingsSubmitted}/${result.programsProcessed} program rankings (${result.rankingsCreated} newly created).`,
      );
    } catch (err) {
      setBulkSubmitError(
        getApiErrorMessage(err, 'Couldn’t bulk-submit rankings.'),
      );
    } finally {
      setBulkSubmitWorking(false);
    }
  }, [bulkSubmitTarget]);

  // ---- Render branches -------------------------------------------------

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-[40px] md:px-8">
      <div className="flex flex-col gap-[28px]">
        <header className="flex flex-col gap-[12px] md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-[32px] font-extrabold leading-[1.05] text-lrfap-navy md:text-[40px]">
              Cycles
            </h1>
            <p className="mt-[8px] max-w-[640px] font-sans text-[13px] text-slate-600">
              Create, edit, and advance application cycles. A cycle moves
              through seven states — draft → open → review → ranking →
              matching → published → closed — and only one active cycle
              should be non-terminal at a time.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-[44px] shrink-0 items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[20px] font-sans text-[13px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            New cycle
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

        {status === 'error' ? (
          <div
            role="alert"
            className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
          >
            <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
            <span>{loadError ?? 'Couldn’t load cycles.'}</span>
          </div>
        ) : null}

        {status === 'loading' || status === 'idle' ? (
          <div className="flex flex-col gap-[16px]">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-[220px] animate-pulse rounded-xl border-[0.91px] border-lrfap-ghost bg-slate-50"
              />
            ))}
          </div>
        ) : null}

        {status === 'loaded' && sortedCycles.length === 0 ? (
          <EmptyState onCreate={openCreate} />
        ) : null}

        {status === 'loaded' && sortedCycles.length > 0 ? (
          <ul role="list" className="flex flex-col gap-[16px]">
            {sortedCycles.map((cycle) => (
              <li key={cycle._id}>
                <CycleCard
                  cycle={cycle}
                  onEdit={() => openEdit(cycle)}
                  onRequestAdvance={() => requestAdvance(cycle)}
                  isAdvancing={
                    advanceWorking && advancePending?.cycleId === cycle._id
                  }
                  onRequestReset={() => requestReset(cycle)}
                  isResetting={
                    resetWorking && resetTarget?._id === cycle._id
                  }
                  onRequestBulkSubmit={() => requestBulkSubmit(cycle)}
                  isBulkSubmitting={
                    bulkSubmitWorking && bulkSubmitTarget?._id === cycle._id
                  }
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <CycleFormModal
        open={formOpen}
        mode={formMode}
        initial={formTarget}
        isSaving={formSaving}
        errorMessage={formError}
        onCancel={closeForm}
        onSubmit={submitForm}
      />

      <ConfirmActionDialog
        open={!!advancePending}
        title="Advance cycle status?"
        body={
          advancePending ? (
            <>
              The cycle will move from <strong>{advancePending.from}</strong>{' '}
              to <strong>{advancePending.to}</strong>. This is a permanent
              state change — applicants and universities may see different
              UI as a result.
            </>
          ) : null
        }
        confirmLabel={
          advancePending ? `Advance to ${advancePending.to}` : 'Advance'
        }
        tone="navy"
        isWorking={advanceWorking}
        errorMessage={advanceError}
        onCancel={cancelAdvance}
        onConfirm={() => void confirmAdvance()}
      />

      {/* TODO: Remove this reset dialog before production deployment. */}
      <ConfirmActionDialog
        open={!!resetTarget}
        title="Reset cycle data?"
        body={
          resetTarget ? (
            <>
              This will reset all applications in{' '}
              <strong>{resetTarget.name}</strong> to <strong>submitted</strong>{' '}
              status, clear all match results, reset program available seats
              to capacity, and set cycle status back to <strong>ranking</strong>.
              Use for demo/testing only. Continue?
            </>
          ) : null
        }
        confirmLabel="Reset cycle"
        tone="danger"
        isWorking={resetWorking}
        errorMessage={resetError}
        onCancel={cancelReset}
        onConfirm={() => void confirmReset()}
      />

      {/* TODO: Remove this bulk-submit dialog before production deployment. */}
      <ConfirmActionDialog
        open={!!bulkSubmitTarget}
        title="Submit all rankings?"
        body={
          bulkSubmitTarget ? (
            <>
              This will create <strong>submitted</strong> rankings for every
              program in <strong>{bulkSubmitTarget.name}</strong> that
              doesn&apos;t already have one. Applicants are ordered by
              submission time (earliest first). Existing rankings are
              untouched. Use for demo/testing only. Continue?
            </>
          ) : null
        }
        confirmLabel="Submit all rankings"
        tone="danger"
        isWorking={bulkSubmitWorking}
        errorMessage={bulkSubmitError}
        onCancel={cancelBulkSubmit}
        onConfirm={() => void confirmBulkSubmit()}
      />
    </div>
  );
}

// ---- CycleCard ---------------------------------------------------------

interface CycleCardProps {
  cycle: Cycle;
  onEdit: () => void;
  onRequestAdvance: () => void;
  isAdvancing: boolean;
  // TODO: Remove dev-only props before production deployment.
  onRequestReset: () => void;
  isResetting: boolean;
  onRequestBulkSubmit: () => void;
  isBulkSubmitting: boolean;
}

function CycleCard({
  cycle,
  onEdit,
  onRequestAdvance,
  isAdvancing,
  onRequestReset,
  isResetting,
  onRequestBulkSubmit,
  isBulkSubmitting,
}: CycleCardProps) {
  const pill = STATUS_PILL[cycle.status];
  const next = nextStatusFor(cycle.status);
  const terminal = next === null;
  const fullyReadOnly = cycle.status === 'published' || cycle.status === 'closed';

  // Live countdown for active pre-publish cycles. Same shape as the
  // dashboard Active Cycle card so the two pages feel consistent.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (fullyReadOnly) return;
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [fullyReadOnly]);

  const countdown = useMemo(() => {
    if (fullyReadOnly) return null;
    return pickNextDeadline(cycle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle, tick, fullyReadOnly]);

  return (
    <article className="rounded-xl border-[0.91px] border-lrfap-ghost bg-white p-[24px] shadow-[0_4px_12px_rgba(38,43,102,0.08)]">
      <div className="flex flex-col gap-[12px] md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h2 className="truncate font-display text-[18px] font-bold text-lrfap-navy">
            {cycle.name}{' '}
            <span className="font-sans font-normal text-slate-500">
              · {cycle.year}
            </span>
          </h2>
          <p className="mt-[4px] font-sans text-[12px] text-slate-500">
            Acceptance window:{' '}
            <span className="font-medium text-lrfap-navy">
              {cycle.acceptanceWindowHours ?? 72} hours
            </span>
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center border-[0.91px] px-[10px] py-[2px] font-sans text-[11px] font-medium uppercase tracking-wide ${pill.cls}`}
        >
          {pill.label}
        </span>
      </div>

      <dl className="mt-[18px] grid grid-cols-1 gap-x-[24px] gap-y-[8px] font-sans text-[12px] sm:grid-cols-2 lg:grid-cols-3">
        <DateRow label="Start" iso={cycle.startDate} />
        <DateRow label="End" iso={cycle.endDate} />
        <DateRow label="Submission" iso={cycle.submissionDeadline} />
        <DateRow label="Ranking" iso={cycle.rankingDeadline} />
        <DateRow label="Results" iso={cycle.resultPublicationDate} />
      </dl>

      {fullyReadOnly ? null : (
        <div className="mt-[18px] border-t border-lrfap-ghost pt-[14px]">
          {countdown ? (
            <>
              <p className="font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {countdown.label}
              </p>
              <p
                aria-live="polite"
                className="mt-[4px] font-display text-[22px] font-extrabold tabular-nums tracking-wide text-lrfap-navy"
              >
                {formatCountdown(countdown.remainingMs)}
              </p>
            </>
          ) : (
            <p className="flex items-center gap-[6px] font-sans text-[12px] italic text-slate-500">
              <Calendar aria-hidden="true" className="h-3.5 w-3.5" />
              All deadlines passed
            </p>
          )}
        </div>
      )}

      <div className="mt-[18px] flex flex-wrap items-center gap-[10px]">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-[40px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy px-[18px] font-sans text-[12px] font-medium uppercase tracking-wide text-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy"
        >
          <Pencil aria-hidden="true" className="h-4 w-4" />
          {fullyReadOnly ? 'View' : 'Edit'}
        </button>
        <button
          type="button"
          onClick={onRequestAdvance}
          disabled={terminal || isAdvancing}
          title={terminal ? 'Cycle is in its final state.' : undefined}
          className="inline-flex h-[40px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[18px] font-sans text-[12px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isAdvancing ? (
            <>
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              Advancing…
            </>
          ) : terminal ? (
            'Cycle is final'
          ) : (
            <>
              Advance to {STATUS_PILL[next as CycleStatus].label}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      {/* TODO: Remove this dev-only control row before production deployment. */}
      <div className="mt-[12px] flex flex-wrap items-center gap-x-[16px] gap-y-[6px]">
        <button
          type="button"
          onClick={onRequestReset}
          disabled={isResetting || isBulkSubmitting}
          className="inline-flex items-center gap-[6px] font-sans text-[11px] font-medium text-red-600 underline-offset-4 transition-colors hover:text-red-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isResetting ? (
            <>
              <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
              Resetting…
            </>
          ) : (
            'Reset Cycle Data (Dev Only)'
          )}
        </button>
        <button
          type="button"
          onClick={onRequestBulkSubmit}
          disabled={isResetting || isBulkSubmitting}
          className="inline-flex items-center gap-[6px] font-sans text-[11px] font-medium text-red-600 underline-offset-4 transition-colors hover:text-red-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBulkSubmitting ? (
            <>
              <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
              Submitting…
            </>
          ) : (
            'Submit All Rankings (Dev Only)'
          )}
        </button>
      </div>
    </article>
  );
}

function DateRow({ label, iso }: { label: string; iso: string | undefined }) {
  return (
    <div className="flex items-center justify-between gap-[10px]">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-lrfap-navy">{formatDate(iso)}</dd>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border-[0.91px] border-dashed border-lrfap-ghost bg-white px-[24px] py-[40px] text-center">
      <Calendar
        aria-hidden="true"
        className="mx-auto h-6 w-6 text-slate-400"
      />
      <h2 className="mt-[12px] font-display text-[18px] font-bold text-lrfap-navy">
        No cycles yet
      </h2>
      <p className="mx-auto mt-[6px] max-w-[420px] font-sans text-[13px] text-slate-600">
        Create the first application cycle to unlock program creation,
        applicant submissions, and the matching pipeline.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-[18px] inline-flex h-[40px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[20px] font-sans text-[12px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
        Create cycle
      </button>
    </div>
  );
}
