import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Calendar, Loader2 } from 'lucide-react';
import type { CycleStatus, LGCActiveCycle } from '../../../types';
import { formatCountdown, pickNextDeadline } from '../../../utils/cycleCountdown';

/**
 * Active Cycle card — right column, top. Shows the current cycle name,
 * status, key dates, and a live countdown to the *next upcoming*
 * deadline among submissionDeadline / rankingDeadline /
 * resultPublicationDate.
 *
 * Countdown is hidden entirely for `published` and `closed` cycles
 * (they're no longer time-gated). When all three deadlines have
 * passed for a pre-published cycle, we swap the countdown for a muted
 * "All deadlines passed" line so the box doesn't render an obviously
 * stale 0:0:0:0.
 *
 * "Advance Cycle" button maps to the real cycle lifecycle
 * (draft → open → review → ranking → matching → published → closed).
 * Disabled at the terminal state with a tooltip. All transitions route
 * through a confirm dialog owned by DashboardPage, which is the one
 * place that actually owns the mutation.
 */

const STATUS_ORDER: CycleStatus[] = [
  'draft',
  'open',
  'review',
  'ranking',
  'matching',
  'published',
  'closed',
];

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

export function nextStatusFor(status: CycleStatus): CycleStatus | null {
  const idx = STATUS_ORDER.indexOf(status);
  if (idx < 0 || idx === STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[idx + 1];
}

interface ActiveCycleCardProps {
  cycle: LGCActiveCycle | null;
  isAdvancing: boolean;
  onRequestAdvance: () => void;
}

function formatDeadlineDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function ActiveCycleCard({
  cycle,
  isAdvancing,
  onRequestAdvance,
}: ActiveCycleCardProps) {
  // 1s tick so the countdown animates. Only runs while a cycle is
  // active, not-yet-published, and has at least one future deadline —
  // otherwise there's nothing to count down to.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!cycle) return;
    if (cycle.status === 'published' || cycle.status === 'closed') return;
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [cycle]);

  const countdown = useMemo(() => {
    if (!cycle) return null;
    if (cycle.status === 'published' || cycle.status === 'closed') return null;
    return pickNextDeadline(cycle);
    // tick makes us recompute every second so the remaining ms ticks
    // down; cycle itself doesn't need to be in the dep list beyond the
    // initial value, but re-evaluating is cheap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle, tick]);

  if (!cycle) {
    return (
      <section
        aria-labelledby="active-cycle-heading"
        className="rounded-xl border-[0.91px] border-lrfap-ghost bg-white p-[20px] shadow-[0_4px_12px_rgba(38,43,102,0.08)]"
      >
        <h2
          id="active-cycle-heading"
          className="font-display text-[14px] font-bold uppercase tracking-wide text-lrfap-navy"
        >
          Active cycle
        </h2>
        <p className="mt-[10px] font-sans text-[13px] text-slate-500">
          No active cycle. Create one in{' '}
          <span className="font-semibold text-lrfap-navy">Cycles</span> to begin.
        </p>
      </section>
    );
  }

  const next = nextStatusFor(cycle.status);
  const terminal = next === null;
  const pill = STATUS_PILL[cycle.status];

  return (
    <section
      aria-labelledby="active-cycle-heading"
      className="rounded-xl border-[0.91px] border-lrfap-ghost bg-white p-[20px] shadow-[0_4px_12px_rgba(38,43,102,0.08)]"
    >
      <div className="flex items-start justify-between gap-[10px]">
        <div className="min-w-0">
          <h2
            id="active-cycle-heading"
            className="font-display text-[14px] font-bold uppercase tracking-wide text-lrfap-navy"
          >
            Active cycle
          </h2>
          <p className="mt-[4px] truncate font-sans text-[16px] font-semibold text-lrfap-navy">
            {cycle.name} <span className="text-slate-500">· {cycle.year}</span>
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center border-[0.91px] px-[10px] py-[2px] font-sans text-[11px] font-medium uppercase tracking-wide ${pill.cls}`}
        >
          {pill.label}
        </span>
      </div>

      {/* Key dates */}
      <dl className="mt-[14px] flex flex-col gap-[6px] font-sans text-[12px]">
        <DateRow label="Submission" iso={cycle.submissionDeadline} />
        <DateRow label="Ranking" iso={cycle.rankingDeadline} />
        <DateRow label="Results" iso={cycle.resultPublicationDate} />
      </dl>

      {/* Countdown */}
      {cycle.status === 'published' || cycle.status === 'closed' ? null : countdown ? (
        <div className="mt-[16px] border-t border-lrfap-ghost pt-[14px]">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {countdown.label}
          </p>
          <p
            aria-live="polite"
            className="mt-[4px] font-display text-[26px] font-extrabold tabular-nums tracking-wide text-lrfap-navy"
          >
            {formatCountdown(countdown.remainingMs)}
          </p>
        </div>
      ) : (
        <div className="mt-[16px] border-t border-lrfap-ghost pt-[14px]">
          <p className="flex items-center gap-[6px] font-sans text-[12px] italic text-slate-500">
            <Calendar aria-hidden="true" className="h-3.5 w-3.5" />
            All deadlines passed
          </p>
        </div>
      )}

      {/* Advance button */}
      <div className="mt-[16px] flex flex-col gap-[6px]">
        <button
          type="button"
          onClick={onRequestAdvance}
          disabled={terminal || isAdvancing}
          title={terminal ? 'Cycle is in its final state.' : undefined}
          className="inline-flex h-[40px] w-full items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[16px] font-sans text-[12px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-50"
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
        {terminal ? (
          <p className="font-sans text-[11px] italic text-slate-500">
            Cycle is in its final state.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function DateRow({ label, iso }: { label: string; iso: string }) {
  return (
    <div className="flex items-center justify-between gap-[10px]">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-lrfap-navy">{formatDeadlineDate(iso)}</dd>
    </div>
  );
}
