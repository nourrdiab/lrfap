import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, GripVertical, X } from 'lucide-react';
import type { ApplicationStatus, ID } from '../../../types';

/**
 * Sortable list of ranked applicants. Re-uses the dnd-kit sensors +
 * modifiers pattern from the applicant wizard's PreferenceRankingStep —
 * pointer (4 px activation) + keyboard (accessible reorder). Ranks are
 * rendered by position (1-based), not stored in the row, so reorder is
 * a single arrayMove + re-render.
 *
 * `locked` flips the list to read-only: drag handles and remove buttons
 * disappear, keyboard sorting is off (no sensors mounted).
 */

export interface RankedRowData {
  applicationId: ID;
  applicantId: ID;
  name: string;
  email: string | null;
  status: ApplicationStatus;
  reference: string | null;
  /** True when status is not in ['submitted', 'under_review']. */
  isIneligible: boolean;
  /** Short label describing the ineligibility reason (for the tooltip). */
  ineligibleReason?: string;
}

interface RankedListProps {
  rows: RankedRowData[];
  locked: boolean;
  /** Called with the new order after a drag. */
  onReorder: (next: RankedRowData[]) => void;
  /** Move a single row back to the unranked list. */
  onRemove: (applicationId: ID) => void;
}

export function RankedList({ rows, locked, onReorder, onRemove }: RankedListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rows.findIndex((r) => r.applicationId === active.id);
    const newIndex = rows.findIndex((r) => r.applicationId === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(rows, oldIndex, newIndex));
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-[8px] border border-dashed border-lrfap-ghost bg-white/60 px-[16px] py-[40px] text-center">
        <p className="font-sans text-[13px] text-slate-500">
          No applicants ranked yet. Add eligible applicants from the list below.
        </p>
      </div>
    );
  }

  // Locked state: render the same rows but without drag or remove.
  if (locked) {
    return (
      <ul role="list" className="flex flex-col gap-[8px]">
        {rows.map((row, idx) => (
          <li key={row.applicationId}>
            <RowShell row={row} rank={idx + 1} locked />
          </li>
        ))}
      </ul>
    );
  }

  const ids = rows.map((r) => r.applicationId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul role="list" className="flex flex-col gap-[8px]">
          {rows.map((row, idx) => (
            <SortableRow
              key={row.applicationId}
              row={row}
              rank={idx + 1}
              onRemove={() => onRemove(row.applicationId)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

interface SortableRowProps {
  row: RankedRowData;
  rank: number;
  onRemove: () => void;
}

function SortableRow({ row, rank, onRemove }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.applicationId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    boxShadow: isDragging
      ? '0 16px 40px -12px rgba(38, 43, 102, 0.35)'
      : undefined,
    opacity: isDragging ? 0.96 : 1,
  };

  return (
    <li ref={setNodeRef} style={style}>
      <RowShell
        row={row}
        rank={rank}
        onRemove={onRemove}
        dragAttributes={attributes}
        dragListeners={listeners}
      />
    </li>
  );
}

interface RowShellProps {
  row: RankedRowData;
  rank: number;
  locked?: boolean;
  onRemove?: () => void;
  dragAttributes?: ReturnType<typeof useSortable>['attributes'];
  dragListeners?: ReturnType<typeof useSortable>['listeners'];
}

const STATUS_TONE: Record<ApplicationStatus, string> = {
  draft: 'border-slate-200 bg-slate-50 text-slate-600',
  submitted: 'border-lrfap-sky/40 bg-lrfap-sky/10 text-lrfap-navy',
  under_review: 'border-amber-200 bg-amber-50 text-amber-800',
  matched: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  unmatched: 'border-rose-200 bg-rose-50 text-rose-800',
  withdrawn: 'border-slate-200 bg-slate-50 text-slate-500',
};

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  matched: 'Matched',
  unmatched: 'Unmatched',
  withdrawn: 'Withdrawn',
};

function RowShell({
  row,
  rank,
  locked = false,
  onRemove,
  dragAttributes,
  dragListeners,
}: RowShellProps) {
  const isRankOne = rank === 1;
  const rankLabel = rank.toString().padStart(2, '0');

  return (
    <div
      className={`flex items-stretch border-[0.91px] bg-white shadow-[0_4px_24px_-12px_rgba(38,43,102,0.08)] ${
        row.isIneligible
          ? 'border-amber-300'
          : 'border-lrfap-ghost'
      }`}
    >
      {/* Rank badge — navy filled for #1 to match the applicant wizard pattern. */}
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
            isRankOne ? 'text-[32px]' : 'text-[28px] opacity-30'
          }`}
        >
          {rankLabel}
        </span>
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1 px-[16px] py-[14px]">
        <div className="flex flex-wrap items-center gap-[8px]">
          <p className="truncate font-sans text-[14px] font-semibold text-lrfap-navy">
            {row.name}
          </p>
          {row.isIneligible ? (
            <span
              title={row.ineligibleReason ?? 'No longer eligible'}
              className="inline-flex items-center gap-[4px] border-[0.91px] border-amber-300 bg-amber-50 px-[8px] py-[1px] font-sans text-[10px] font-semibold uppercase tracking-wide text-amber-800"
            >
              <AlertTriangle aria-hidden="true" className="h-3 w-3" />
              {row.ineligibleReason ?? 'Not eligible'}
            </span>
          ) : null}
        </div>
        <div className="mt-[4px] flex flex-wrap items-center gap-[10px]">
          {row.email ? (
            <span className="truncate font-sans text-[12px] text-slate-500">
              {row.email}
            </span>
          ) : null}
          <span
            className={`inline-flex items-center border-[0.91px] px-[8px] py-[1px] font-sans text-[10px] font-medium uppercase tracking-wide ${STATUS_TONE[row.status]}`}
          >
            {STATUS_LABEL[row.status]}
          </span>
          {row.reference ? (
            <span className="font-mono text-[11px] text-slate-500">
              {row.reference}
            </span>
          ) : null}
        </div>
      </div>

      {/* Right-side controls — hidden when locked */}
      {!locked ? (
        <div className="flex shrink-0 flex-col items-stretch border-l border-lrfap-ghost">
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${row.name} from ranking`}
            className="flex h-[36px] w-[44px] items-center justify-center text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:bg-rose-50 focus-visible:text-rose-600 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lrfap-sky"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={`Drag to reorder ${row.name}`}
            {...dragAttributes}
            {...dragListeners}
            className="flex h-[40px] w-[44px] cursor-grab items-center justify-center border-t border-lrfap-ghost text-slate-400 transition-colors hover:bg-lrfap-ghost hover:text-lrfap-navy focus-visible:bg-lrfap-ghost focus-visible:text-lrfap-navy focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lrfap-sky active:cursor-grabbing"
          >
            <GripVertical aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
