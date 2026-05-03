import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, GripVertical, Loader2 } from 'lucide-react';
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
import { AnimatePresence, motion } from 'framer-motion';
import { applicationsApi } from '../../../../api/applications';
import { getApiErrorMessage } from '../../../../utils/apiError';
import type {
  ID,
  Program,
  ProgramSelection,
  Specialty,
  University,
} from '../../../../types';
import { useWizard } from '../WizardContext';

/**
 * Preference Ranking step (step 4 of the wizard).
 *
 * Dashboard 3 in Figma. Renders the applicant's selected programs as a
 * keyboard-reorderable list (@dnd-kit/sortable). Rank 1 highlighted with
 * a navy rank badge per Figma; subsequent ranks use outlined badges.
 *
 * Persistence is explicit via SUBMIT RANKINGS (no debounce) — reordering
 * is cheap to preview but a commit is a deliberate "I'm done ranking"
 * action. NEXT / PREVIOUS also auto-save through registerStepSave so no
 * work is lost when the user advances.
 *
 * Demo route / empty state / fetch error handled inline with the same
 * visual patterns as the other steps.
 */

// Local helpers (mirror the ones in WizardContext + ProgramsStep).
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
  const parts = [uni?.name, spec?.name, trackLabel].filter(Boolean);
  return parts.join(' ').toUpperCase();
}

export default function PreferenceRankingStep() {
  const {
    draftId,
    application,
    applicationStatus,
    programs,
    updateApplicationCache,
    notifySaved,
    registerStepSave,
    goToStep,
  } = useWizard();

  const isDemoRoute = !/^[0-9a-fA-F]{24}$/.test(draftId);

  const [localOrder, setLocalOrder] = useState<ProgramSelection[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  // Hydrate local order from application whenever the cache updates.
  useEffect(() => {
    if (application) {
      setLocalOrder(
        application.selections.slice().sort((a, b) => a.rank - b.rank),
      );
    }
  }, [application]);

  // Auto-hide the "Rankings saved" inline confirmation after 3 s.
  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 3000);
    return () => clearTimeout(t);
  }, [justSaved]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Resolve selections to full Program objects (populated from the API
  // response or fallback to the cached programs list).
  const resolvedRows = useMemo(() => {
    return localOrder.map((sel) => {
      const programId = idOf(sel.program) ?? '';
      const program =
        populated<Program>(sel.program) ??
        programs.find((p) => p._id === programId) ??
        null;
      return { id: programId, rank: sel.rank, program, selection: sel };
    });
  }, [localOrder, programs]);

  const sortableIds = useMemo(() => resolvedRows.map((r) => r.id), [resolvedRows]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalOrder((prev) => {
      const oldIndex = prev.findIndex((s) => (idOf(s.program) ?? '') === active.id);
      const newIndex = prev.findIndex((s) => (idOf(s.program) ?? '') === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      const reordered = arrayMove(prev, oldIndex, newIndex);
      // Renumber ranks 1..N on every reorder so the consecutive-ranks
      // invariant the completion rule needs always holds.
      return reordered.map((s, i) => ({ ...s, rank: i + 1 }));
    });
    setJustSaved(false);
  }

  async function saveOrder() {
    if (!/^[0-9a-fA-F]{24}$/.test(draftId) || localOrder.length === 0) return;
    const updated = await applicationsApi.updateSelections(draftId, {
      selections: localOrder.map((s, i) => ({
        program: idOf(s.program) ?? '',
        rank: i + 1,
      })),
    });
    updateApplicationCache(updated);
    notifySaved();
  }

  async function handleSubmitClick() {
    if (isSaving || localOrder.length === 0) return;
    setIsSaving(true);
    setSubmitError(null);
    setJustSaved(false);
    try {
      await saveOrder();
      setJustSaved(true);
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, 'Couldn’t save rankings.'));
    } finally {
      setIsSaving(false);
    }
  }

  // Register as step save so NEXT / PREVIOUS force-flush the current order
  // before navigating. If the save throws, navigation is blocked (the
  // context's runStepSave catches and returns false). submitError surfaces
  // inline so the user knows why they didn't advance.
  useEffect(() => {
    registerStepSave(async () => {
      if (localOrder.length === 0) return;
      try {
        await saveOrder();
      } catch (err) {
        setSubmitError(getApiErrorMessage(err, 'Couldn’t save rankings.'));
        throw err;
      }
    });
    return () => registerStepSave(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerStepSave, localOrder, draftId]);

  // ---- Branches --------------------------------------------------------

  if (isDemoRoute) {
    return (
      <StepShell>
        <EmptyPanel
          title="Demo route — no application attached"
          body={
            <>
              Open a real draft application (via{' '}
              <span className="font-mono">/applicant/applications/:id/edit/preference-ranking</span>)
              to rank your selected programs.
            </>
          }
        />
      </StepShell>
    );
  }

  if (applicationStatus === 'loading') {
    return (
      <StepShell>
        <ul role="list" aria-busy="true" className="flex flex-col gap-[16px]">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="h-[96px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50"
            />
          ))}
        </ul>
      </StepShell>
    );
  }

  if (applicationStatus === 'error') {
    return (
      <StepShell>
        <div
          role="alert"
          className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
        >
          <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
          <span>
            Couldn&apos;t load your application. Refresh the page to try again.
          </span>
        </div>
      </StepShell>
    );
  }

  if (localOrder.length === 0) {
    return (
      <StepShell>
        <EmptyPanel
          title="No programs selected yet"
          body="Add programs in the previous step to rank them here."
          action={
            <button
              type="button"
              onClick={() => goToStep('programs')}
              className="mt-[16px] inline-flex h-[40px] items-center justify-center border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[20px] font-sans text-[13px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
            >
              Go to Programs
            </button>
          }
        />
      </StepShell>
    );
  }

  return (
    <StepShell>
      {submitError ? (
        <div
          role="alert"
          className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
        >
          <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <ul role="list" className="flex flex-col gap-[12px]">
            {resolvedRows.map((row) => (
              <SortableRankRow
                key={row.id}
                id={row.id}
                rank={row.rank}
                program={row.program}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <p className="font-sans text-[12px] italic text-slate-500">
        * Warning: Rankings may become locked later.
      </p>

      <div className="flex flex-col items-center gap-[12px] pt-[8px]">
        <button
          type="button"
          onClick={() => void handleSubmitClick()}
          disabled={isSaving || localOrder.length === 0}
          className="inline-flex h-[48px] w-full max-w-[560px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-lrfap-navy font-sans text-[14px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? (
            <>
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            'Submit Rankings'
          )}
        </button>

        <AnimatePresence>
          {justSaved ? (
            <motion.span
              key="saved-rankings"
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="inline-flex items-center gap-[6px] font-sans text-[12px] font-medium text-green-600"
            >
              <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3} />
              Rankings saved
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
    </StepShell>
  );
}

// ---- Presentational pieces ---------------------------------------------

function StepShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-[20px] pt-[16px] pb-[24px]">
      <header>
        <h2 className="font-display text-[22px] font-bold text-lrfap-navy">
          Preference Ranking
        </h2>
        <p className="mt-[4px] font-sans text-[13px] leading-relaxed text-slate-500">
          * Please note that the matching process is dependent on ordered
          preferences where Rank 1 is your highest preference.
        </p>
      </header>
      {children}
    </section>
  );
}

function EmptyPanel({
  title,
  body,
  action,
}: {
  title: string;
  body: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-lrfap-ghost bg-white/60 px-6 py-[40px] text-center">
      <p className="font-sans text-[14px] font-medium text-lrfap-navy">
        {title}
      </p>
      <p className="mt-[8px] max-w-[480px] font-sans text-[13px] text-slate-500">
        {body}
      </p>
      {action}
    </div>
  );
}

interface SortableRankRowProps {
  id: string;
  rank: number;
  program: Program | null;
}

function SortableRankRow({ id, rank, program }: SortableRankRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    boxShadow: isDragging
      ? '0 16px 40px -12px rgba(38, 43, 102, 0.35)'
      : undefined,
    opacity: isDragging ? 0.96 : 1,
  };

  const isRankOne = rank === 1;
  const uni = program ? populated<University>(program.university) : null;
  const spec = program ? populated<Specialty>(program.specialty) : null;
  const rankLabel = rank.toString().padStart(2, '0');

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-stretch border-[0.91px] border-lrfap-ghost bg-white shadow-[0_4px_24px_-12px_rgba(38,43,102,0.08)]"
    >
      {/* Rank badge */}
      <div
        className={`flex w-[96px] shrink-0 items-center justify-center ${
          isRankOne
            ? 'bg-lrfap-navy text-white'
            : 'border-r border-lrfap-ghost bg-white text-lrfap-navy'
        }`}
      >
        <span
          aria-hidden="true"
          className={`font-display font-extrabold ${
            isRankOne ? 'text-[52px]' : 'text-[44px] opacity-30'
          } leading-none`}
        >
          {rankLabel}
        </span>
      </div>

      {/* Program info */}
      <div className="flex flex-1 items-center px-[20px] py-[18px] min-w-0">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[14px] font-bold uppercase tracking-wide text-lrfap-navy">
            {headlineFor(program)}
          </p>
          {uni?.name ? (
            <p className="mt-[2px] truncate font-sans text-[12px] text-slate-500">
              {uni.name}
            </p>
          ) : null}
        </div>
        {spec?.name ? (
          <div className="ml-[20px] hidden min-w-0 shrink-0 md:block">
            <p className="font-sans text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Speciality
            </p>
            <p className="mt-[2px] font-sans text-[13px] font-semibold text-lrfap-navy">
              {spec.name}
            </p>
          </div>
        ) : null}
      </div>

      {/* Drag handle — the listener lives here so only the handle initiates
          a drag, matching Figma's dedicated "DRAG AND REORDER" column. */}
      <button
        type="button"
        aria-label={`Drag to reorder ${headlineFor(program)}, currently rank ${rank}`}
        className="flex w-[120px] shrink-0 cursor-grab touch-none flex-col items-center justify-center gap-[4px] bg-lrfap-sky text-white transition-colors hover:bg-[#3a86bd] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" className="h-5 w-5" />
        <span className="px-[4px] text-center font-sans text-[11px] font-medium uppercase tracking-wide leading-tight">
          Drag and Reorder
        </span>
      </button>
    </li>
  );
}
