import type {
  ID,
  Program,
  ProgramSelection,
  Specialty,
  University,
} from '../../../types';

/**
 * Read-only ranked list of selected programs. Consumed by the submitted
 * Application Detail page and by the wizard's Review & Submit step.
 *
 * The wizard's Preference Ranking step has its own draggable editor —
 * sharing that complexity here today would add drag callbacks, keyboard
 * reorder handlers, and wizard-context coupling for no current payoff.
 * A `readOnly` prop is accepted so callers can opt in once that step is
 * ready to migrate; for now only the read-only rendering is implemented.
 */

interface SelectedProgramsListProps {
  selections: ProgramSelection[];
  /** Fallback catalog used when `selection.program` is a raw ObjectId. */
  programs?: Program[];
  readOnly?: boolean;
  emptyMessage?: string;
  /**
   * When set, the row whose program._id matches this ID is visually
   * highlighted with a sky-blue left border and a "Your program" pill.
   * Used by the university reviewer view to anchor the reader to where
   * their own program sits in the applicant's preference list.
   */
  highlightProgramId?: ID;
}

function idOf(ref: ID | { _id: ID } | null | undefined): ID | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref._id;
}
function populated<T extends { _id: ID }>(ref: ID | T | null | undefined): T | null {
  if (!ref || typeof ref === 'string') return null;
  return ref;
}

function headlineFor(program: Program | null): string {
  if (!program) return 'Unknown program';
  const uni = populated<University>(program.university);
  const spec = populated<Specialty>(program.specialty);
  const trackLabel = program.track === 'fellowship' ? 'Fellowship' : 'Residency';
  return [uni?.name, spec?.name, trackLabel]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();
}

export function SelectedProgramsList({
  selections,
  programs = [],
  emptyMessage = 'No programs ranked yet.',
  highlightProgramId,
}: SelectedProgramsListProps) {
  const sorted = selections.slice().sort((a, b) => a.rank - b.rank);

  if (sorted.length === 0) {
    return (
      <div className="border-[0.91px] border-dashed border-lrfap-ghost bg-white/60 px-[20px] py-[24px] text-center font-sans text-[13px] text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ol role="list" className="flex flex-col gap-[8px]">
      {sorted.map((sel) => {
        const id = idOf(sel.program) ?? '';
        const program =
          populated<Program>(sel.program) ??
          programs.find((p) => p._id === id) ??
          null;
        const isHighlighted = !!highlightProgramId && id === highlightProgramId;
        return (
          <li key={id || `${sel.rank}`}>
            <RankRow rank={sel.rank} program={program} isHighlighted={isHighlighted} />
          </li>
        );
      })}
    </ol>
  );
}

interface RankRowProps {
  rank: number;
  program: Program | null;
  isHighlighted?: boolean;
}

function RankRow({ rank, program, isHighlighted = false }: RankRowProps) {
  const uni = program ? populated<University>(program.university) : null;
  const rankLabel = rank.toString().padStart(2, '0');
  const isRankOne = rank === 1;
  return (
    <div
      className={`flex items-stretch border-[0.91px] bg-white shadow-[0_4px_24px_-12px_rgba(38,43,102,0.08)] ${
        isHighlighted
          ? 'border-lrfap-ghost border-l-[4px] border-l-lrfap-sky'
          : 'border-lrfap-ghost'
      }`}
    >
      <div
        className={`flex w-[72px] shrink-0 items-center justify-center ${
          isRankOne
            ? 'bg-lrfap-navy text-white'
            : 'border-r border-lrfap-ghost bg-white text-lrfap-navy'
        }`}
      >
        <span
          aria-hidden="true"
          className={`font-display font-extrabold leading-none ${
            isRankOne ? 'text-[36px]' : 'text-[32px] opacity-30'
          }`}
        >
          {rankLabel}
        </span>
      </div>
      <div className="min-w-0 flex-1 px-[16px] py-[14px]">
        <div className="flex flex-wrap items-center gap-[10px]">
          <p className="font-display text-[13px] font-bold uppercase tracking-wide text-lrfap-navy">
            {headlineFor(program)}
          </p>
          {isHighlighted ? (
            <span className="inline-flex shrink-0 items-center border-[0.91px] border-lrfap-sky/50 bg-lrfap-sky/10 px-[8px] py-[2px] font-sans text-[10px] font-semibold uppercase tracking-wide text-lrfap-sky">
              Your program
            </span>
          ) : null}
        </div>
        {uni?.name ? (
          <p className="mt-[2px] truncate font-sans text-[12px] text-slate-500">
            {uni.name}
          </p>
        ) : null}
      </div>
    </div>
  );
}
