import type { ISODateString } from '../types';

/**
 * Shared helpers for rendering a cycle's time-to-next-deadline. The
 * Active Cycle card on the LGC dashboard and the per-card countdown on
 * Cycles Management both pick from the same three deadlines
 * (submissionDeadline / rankingDeadline / resultPublicationDate) and
 * render the same `DD : HH : MM : SS` layout.
 */

export interface CycleCountdown {
  kind: 'submission' | 'ranking' | 'results';
  label: string;
  targetIso: string;
  remainingMs: number;
}

interface CycleDeadlines {
  submissionDeadline: ISODateString;
  rankingDeadline: ISODateString;
  resultPublicationDate: ISODateString;
}

export function pickNextDeadline(cycle: CycleDeadlines): CycleCountdown | null {
  const now = Date.now();
  const all: CycleCountdown[] = [
    {
      kind: 'submission',
      label: 'Submission deadline',
      targetIso: cycle.submissionDeadline,
      remainingMs: new Date(cycle.submissionDeadline).getTime() - now,
    },
    {
      kind: 'ranking',
      label: 'Ranking deadline',
      targetIso: cycle.rankingDeadline,
      remainingMs: new Date(cycle.rankingDeadline).getTime() - now,
    },
    {
      kind: 'results',
      label: 'Results publication',
      targetIso: cycle.resultPublicationDate,
      remainingMs: new Date(cycle.resultPublicationDate).getTime() - now,
    },
  ];
  const candidates = all.filter(
    (c) => !Number.isNaN(c.remainingMs) && c.remainingMs > 0,
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.remainingMs - b.remainingMs);
  return candidates[0];
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return '00 : 00 : 00 : 00';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(days)} : ${pad(hours)} : ${pad(minutes)} : ${pad(seconds)}`;
}
