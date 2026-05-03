import { useMemo, useState } from 'react';
import type { ID, MatchRun, MatchRunType } from '../../../types';
import { RunHistoryRow } from './RunHistoryRow';

/**
 * Per-track history list with a client-side filter toggle:
 *   [All runs | Official only]
 *
 * Default is All — capstone demos want to show the full exploration
 * story (multiple dry runs, then the official) rather than hiding
 * anything. Filter is purely client-side: `GET /match/runs` returns
 * everything the LGC owns.
 */

type Filter = 'all' | MatchRunType;

interface RunHistoryListProps {
  runs: MatchRun[];
  selectedRunId: ID | null;
  onSelectRun: (runId: ID) => void;
}

export function RunHistoryList({
  runs,
  selectedRunId,
  onSelectRun,
}: RunHistoryListProps) {
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return runs;
    return runs.filter((r) => r.runType === filter);
  }, [runs, filter]);

  return (
    <div className="flex flex-col gap-[10px]">
      <div className="flex items-center justify-between gap-[10px]">
        <h3 className="font-display text-[12px] font-bold uppercase tracking-wide text-lrfap-navy">
          Run history
        </h3>
        <div
          role="radiogroup"
          aria-label="Filter runs"
          className="inline-flex h-[28px] items-stretch overflow-hidden border-[0.91px] border-lrfap-ghost"
        >
          {(['all', 'official'] as Filter[]).map((f) => {
            const selected = filter === f;
            return (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setFilter(f)}
                className={`px-[10px] font-sans text-[11px] font-medium uppercase tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lrfap-sky ${
                  selected
                    ? 'bg-lrfap-navy text-white'
                    : 'bg-white text-lrfap-navy hover:bg-lrfap-ghost/50'
                }`}
              >
                {f === 'all' ? 'All' : 'Official only'}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="border-[0.91px] border-dashed border-lrfap-ghost bg-white px-[14px] py-[18px] text-center font-sans text-[12px] text-slate-500">
          {runs.length === 0
            ? 'No runs yet for this track.'
            : 'No runs match the current filter.'}
        </p>
      ) : (
        <ul role="list" className="flex flex-col gap-[8px]">
          {filtered.map((run) => (
            <li key={run._id}>
              <RunHistoryRow
                run={run}
                selected={selectedRunId === run._id}
                onSelect={() => onSelectRun(run._id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
