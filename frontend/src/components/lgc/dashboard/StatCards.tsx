import { Building2, ClipboardList, Lock, Play } from 'lucide-react';

/**
 * Top metrics row — 4 stat cards. On mobile the row wraps to 2×2; at
 * md+ it stretches to 4 across. Each card is self-contained: icon tile
 * on the left, uppercase label, big navy number, muted subtitle.
 *
 * Mirrors the Figma's stat row but with backend-aligned labels
 * (Pending Rankings not Pending Validations — validation isn't a
 * backend concept). See DashboardPage for the derivation logic.
 */

export interface StatCardsProps {
  universitiesSubmitted: number;
  universitiesTotal: number;
  pendingRankings: number;
  preferencesLocked: number;
  applicationsTotal: number;
  matchStatusLabel: string;
  matchStatusTone: MatchStatusTone;
}

export type MatchStatusTone = 'idle' | 'running' | 'completed' | 'published' | 'failed';

const MATCH_TONE_CLS: Record<MatchStatusTone, string> = {
  idle: 'text-slate-600',
  running: 'text-amber-700',
  completed: 'text-lrfap-sky',
  published: 'text-emerald-700',
  failed: 'text-rose-700',
};

export function StatCards({
  universitiesSubmitted,
  universitiesTotal,
  pendingRankings,
  preferencesLocked,
  applicationsTotal,
  matchStatusLabel,
  matchStatusTone,
}: StatCardsProps) {
  return (
    <div
      role="group"
      aria-label="LGC summary statistics"
      className="grid grid-cols-2 gap-[16px] md:grid-cols-4"
    >
      <StatCard
        icon={<Building2 aria-hidden="true" className="h-5 w-5" />}
        label="Universities submitted"
        value={`${universitiesSubmitted} of ${universitiesTotal}`}
        hint={
          universitiesTotal === 0
            ? 'No universities yet'
            : universitiesSubmitted === universitiesTotal
              ? 'All submitted'
              : `${universitiesTotal - universitiesSubmitted} still pending`
        }
      />
      <StatCard
        icon={<ClipboardList aria-hidden="true" className="h-5 w-5" />}
        label="Pending rankings"
        value={pendingRankings}
        hint={
          pendingRankings === 0
            ? 'All program rankings submitted'
            : `${pendingRankings === 1 ? 'program has a draft ranking' : 'programs have draft rankings'}`
        }
      />
      <StatCard
        icon={<Lock aria-hidden="true" className="h-5 w-5" />}
        label="Preferences locked"
        value={`${preferencesLocked} of ${applicationsTotal}`}
        hint={
          applicationsTotal === 0
            ? 'No applications yet'
            : preferencesLocked === applicationsTotal
              ? 'All applicant preferences locked'
              : `${applicationsTotal - preferencesLocked} still open`
        }
      />
      <StatCard
        icon={<Play aria-hidden="true" className="h-5 w-5" />}
        label="Match status"
        value={matchStatusLabel}
        valueCls={MATCH_TONE_CLS[matchStatusTone]}
        hint="Residency + fellowship"
      />
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint: string;
  /** Override color on the main number — used for Match Status. */
  valueCls?: string;
}

function StatCard({ icon, label, value, hint, valueCls }: StatCardProps) {
  return (
    <div className="flex items-start gap-[14px] rounded-xl border-[0.91px] border-lrfap-ghost bg-white p-[20px] shadow-[0_4px_12px_rgba(38,43,102,0.08)]">
      <span
        aria-hidden="true"
        className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-lrfap-ghost text-lrfap-navy"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p
          className={`mt-[2px] truncate font-display text-[22px] font-extrabold leading-tight ${
            valueCls ?? 'text-lrfap-navy'
          }`}
        >
          {value}
        </p>
        <p className="mt-[4px] font-sans text-[11px] text-slate-500">{hint}</p>
      </div>
    </div>
  );
}
