import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, Plus, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { FormSelect } from '../../forms/FormSelect';
import { useWizard } from '../WizardContext';
import type {
  ID,
  Program,
  ProgramSelection,
  Specialty,
  University,
} from '../../../../types';

/**
 * Programs step (step 3 of the wizard).
 *
 * Three filters drive discovery — UNIVERSITY and SPECIALITY hit the
 * backend via GET /api/programs query params; CITY filters client-side
 * against the populated university.city. Search is client-side and
 * case-insensitive against specialty.name + specialty.code +
 * university.name + university.code.
 *
 * ADD / REMOVE mutations are optimistic + 400ms debounced (wired
 * through WizardContext.addProgramSelection / removeProgramSelection).
 * On server rejection the cached selections revert and `selectionsError`
 * surfaces at the top of the step. The right-rail "Selected Programs"
 * panel is collapsed by default so a long selection list doesn't push
 * the wizard's Previous/Next controls below the fold.
 */

// Local tiny helpers; intentionally duplicated from WizardContext because
// they're one-liners and not worth exporting from a .tsx module.
function idOf(ref: ID | { _id: ID } | null | undefined): ID | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref._id;
}
function populated<T extends { _id: ID }>(ref: ID | T | null | undefined): T | null {
  if (!ref || typeof ref === 'string') return null;
  return ref;
}

/** Compose "JOHNS HOPKINS EMERGENCY MEDICINE RESIDENCY"-style heading. */
function headlineFor(program: Program): string {
  const uni = populated<University>(program.university);
  const spec = populated<Specialty>(program.specialty);
  const trackLabel = program.track === 'fellowship' ? 'Fellowship' : 'Residency';
  const uniPart = uni?.name ?? '';
  const specPart = spec?.name ?? '';
  return [uniPart, specPart, trackLabel].filter(Boolean).join(' ').toUpperCase();
}

export default function ProgramsStep() {
  const {
    draftId,
    application,
    applicationStatus,
    programs,
    programsStatus,
    addProgramSelection,
    removeProgramSelection,
    selectionsError,
    clearSelectionsError,
    registerStepSave,
  } = useWizard();

  const isDemoRoute = !/^[0-9a-fA-F]{24}$/.test(draftId);

  const [universityFilter, setUniversityFilter] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedExpanded, setSelectedExpanded] = useState(false);
  const [availableExpanded, setAvailableExpanded] = useState(false);
  const [showingAll, setShowingAll] = useState(false);

  useEffect(() => {
    // No step save: every mutation hits the server already (debounced),
    // so NEXT / PREVIOUS don't need to flush local state.
    registerStepSave(null);
    return () => registerStepSave(null);
  }, [registerStepSave]);

  const selectedIds = useMemo(() => {
    if (!application) return new Set<string>();
    return new Set(
      application.selections
        .map((s) => idOf(s.program))
        .filter((x): x is string => !!x),
    );
  }, [application]);

  const selectedSelections: ProgramSelection[] = useMemo(() => {
    if (!application) return [];
    return application.selections.slice().sort((a, b) => a.rank - b.rank);
  }, [application]);

  // Dropdown options derived from what's actually in scope for this
  // cycle + track so the user never picks a filter that returns zero.
  const universityOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of programs) {
      const u = populated<University>(p.university);
      if (u) m.set(u._id, u.name);
    }
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [programs]);

  const specialtyOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of programs) {
      const s = populated<Specialty>(p.specialty);
      if (s) m.set(s._id, s.name);
    }
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [programs]);

  const cityOptions = useMemo(() => {
    const s = new Set<string>();
    for (const p of programs) {
      const u = populated<University>(p.university);
      if (u?.city) s.add(u.city);
    }
    return Array.from(s).sort();
  }, [programs]);

  const filteredPrograms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return programs.filter((p) => {
      if (universityFilter && idOf(p.university) !== universityFilter) return false;
      if (specialtyFilter && idOf(p.specialty) !== specialtyFilter) return false;
      if (cityFilter) {
        const u = populated<University>(p.university);
        if (u?.city !== cityFilter) return false;
      }
      if (q) {
        const u = populated<University>(p.university);
        const sp = populated<Specialty>(p.specialty);
        const haystack = [sp?.name, sp?.code, u?.name, u?.code]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [programs, universityFilter, specialtyFilter, cityFilter, search]);

  const anyFiltersActive = !!(
    universityFilter ||
    specialtyFilter ||
    cityFilter ||
    search
  );

  function clearFilters() {
    setUniversityFilter('');
    setSpecialtyFilter('');
    setCityFilter('');
    setSearch('');
  }

  // Resolve selections to full Program objects for display.
  const selectedEntries = useMemo(() => {
    return selectedSelections.map((s) => {
      const id = idOf(s.program) ?? '';
      const prog =
        populated<Program>(s.program) ??
        programs.find((p) => p._id === id) ??
        null;
      return { rank: s.rank, programId: id, program: prog };
    });
  }, [selectedSelections, programs]);

  // ---- Rendering branches ----------------------------------------------

  if (isDemoRoute) {
    return (
      <section className="flex flex-col gap-[20px] pt-[16px] pb-[24px]">
        <h2 className="font-display text-[22px] font-bold text-lrfap-navy">
          Programs
        </h2>
        <div className="flex flex-col items-center justify-center border border-dashed border-lrfap-ghost bg-white/60 px-6 py-[48px] text-center">
          <p className="font-sans text-[14px] font-medium text-lrfap-navy">
            Demo route — no application attached
          </p>
          <p className="mt-[8px] max-w-[420px] font-sans text-[13px] text-slate-500">
            Open a real draft application (via <span className="font-mono">/applicant/applications/:id/edit/programs</span>)
            to browse the program catalog and manage selections.
          </p>
        </div>
      </section>
    );
  }

  if (applicationStatus === 'loading' || programsStatus === 'loading') {
    return <SkeletonList />;
  }

  if (applicationStatus === 'error' || programsStatus === 'error') {
    return (
      <section className="flex flex-col gap-[20px] pt-[16px] pb-[24px]">
        <h2 className="font-display text-[22px] font-bold text-lrfap-navy">
          Programs
        </h2>
        <div
          role="alert"
          className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
        >
          <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
          <span>
            Couldn&apos;t load the program catalog. Refresh the page to try again.
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-[20px] pt-[16px] pb-[24px]">
      <header>
        <h2 className="font-display text-[22px] font-bold text-lrfap-navy">
          Programs
        </h2>
        <p className="mt-[4px] font-sans text-[13px] text-slate-500">
          Add the programs you want to apply to. You&apos;ll rank them in the
          next step.
        </p>
      </header>

      {selectionsError ? (
        <div
          role="alert"
          className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
        >
          <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
          <span className="flex-1">{selectionsError}</span>
          <button
            type="button"
            onClick={clearSelectionsError}
            aria-label="Dismiss error"
            className="shrink-0 text-red-700 hover:text-red-900"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Search */}
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-[14px] h-4 w-4 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search programs by specialty or university"
          aria-label="Search programs"
          className="h-[44px] w-full border-2 border-lrfap-ghost pr-[14px] pl-[44px] font-sans text-[15px] text-slate-900 transition-colors duration-150 placeholder:text-slate-400 hover:border-slate-300 focus:border-lrfap-sky focus:outline-none"
        />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-[16px] md:grid-cols-3">
        <FormSelect
          id="programs-filter-university"
          label="University"
          value={universityFilter}
          onChange={(e) => setUniversityFilter(e.target.value)}
        >
          <option value="">All Universities</option>
          {universityOptions.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </FormSelect>
        <FormSelect
          id="programs-filter-specialty"
          label="Speciality"
          value={specialtyFilter}
          onChange={(e) => setSpecialtyFilter(e.target.value)}
        >
          <option value="">All Specialities</option>
          {specialtyOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </FormSelect>
        <FormSelect
          id="programs-filter-city"
          label="City"
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
        >
          <option value="">All Cities</option>
          {cityOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </FormSelect>
      </div>

      {/* Split */}
      <div className="grid grid-cols-1 gap-[24px] lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-[12px]">
          <button
            type="button"
            onClick={() =>
              setAvailableExpanded((v) => {
                if (v) setShowingAll(false);
                return !v;
              })
            }
            aria-expanded={availableExpanded}
            aria-controls="available-programs-panel"
            className="flex w-full items-center justify-between gap-[12px] border-[0.91px] border-lrfap-ghost bg-white px-[14px] py-[12px] text-left transition-colors hover:border-lrfap-navy/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
          >
            <h3 className="font-sans text-[14px] font-semibold uppercase tracking-wide text-lrfap-navy">
              Available Programs
            </h3>
            <span className="flex items-center gap-[10px]">
              <span className="font-sans text-[12px] text-slate-500">
                {filteredPrograms.length} result
                {filteredPrograms.length === 1 ? '' : 's'}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={`h-4 w-4 text-lrfap-navy transition-transform duration-200 ${
                  availableExpanded ? 'rotate-180' : ''
                }`}
              />
            </span>
          </button>

          <AnimatePresence initial={false}>
            {availableExpanded ? (
              <motion.div
                id="available-programs-panel"
                key="available-programs-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                style={{ overflow: 'hidden' }}
              >
                {programs.length === 0 ? (
                  <EmptyPanel
                    title="No programs available"
                    body="No programs have been published for this cycle yet. Check back later or contact your program coordinator."
                  />
                ) : filteredPrograms.length === 0 ? (
                  <EmptyPanel
                    title="No programs match your filters"
                    body="Try clearing one of the filters or the search to see more results."
                    action={
                      anyFiltersActive ? (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="mt-[12px] font-sans text-[13px] font-medium text-lrfap-sky underline-offset-4 hover:underline"
                        >
                          Clear filters
                        </button>
                      ) : null
                    }
                  />
                ) : (
                  <>
                    <ul role="list" className="flex flex-col gap-[16px]">
                      {(showingAll
                        ? filteredPrograms
                        : filteredPrograms.slice(0, 8)
                      ).map((p) => (
                        <li key={p._id}>
                          <AvailableProgramCard
                            program={p}
                            isSelected={selectedIds.has(p._id)}
                            onAdd={() => addProgramSelection(p._id)}
                            onRemove={() => removeProgramSelection(p._id)}
                          />
                        </li>
                      ))}
                    </ul>
                    {!showingAll && filteredPrograms.length > 8 ? (
                      <button
                        type="button"
                        onClick={() => setShowingAll(true)}
                        className="mt-[16px] inline-flex h-[40px] w-full items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-white px-[20px] font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy"
                      >
                        Show all {filteredPrograms.length} results
                      </button>
                    ) : null}
                  </>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <aside className="flex flex-col gap-[12px]">
          <button
            type="button"
            onClick={() => setSelectedExpanded((v) => !v)}
            aria-expanded={selectedExpanded}
            aria-controls="selected-programs-panel"
            className="flex w-full items-center justify-between gap-[12px] border-[0.91px] border-lrfap-ghost bg-white px-[14px] py-[12px] text-left transition-colors hover:border-lrfap-navy/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
          >
            <h3 className="font-sans text-[14px] font-semibold uppercase tracking-wide text-lrfap-navy">
              Selected Programs
            </h3>
            <span className="flex items-center gap-[10px]">
              <span className="font-sans text-[12px] text-slate-500">
                {selectedEntries.length} selected
              </span>
              <ChevronDown
                aria-hidden="true"
                className={`h-4 w-4 text-lrfap-navy transition-transform duration-200 ${
                  selectedExpanded ? 'rotate-180' : ''
                }`}
              />
            </span>
          </button>

          <AnimatePresence initial={false}>
            {selectedExpanded ? (
              <motion.div
                id="selected-programs-panel"
                key="selected-programs-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                style={{ overflow: 'hidden' }}
              >
                {selectedEntries.length === 0 ? (
                  <EmptyPanel
                    title="Nothing selected yet"
                    body="Add programs from the left. You'll rank them in the next step."
                  />
                ) : (
                  <ul role="list" className="flex flex-col gap-[12px]">
                    {selectedEntries.map((entry) => (
                      <li key={entry.programId}>
                        <SelectedProgramRow
                          rank={entry.rank}
                          program={entry.program}
                          onRemove={() => removeProgramSelection(entry.programId)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </aside>
      </div>
    </section>
  );
}

interface AvailableProgramCardProps {
  program: Program;
  isSelected: boolean;
  onAdd: () => void;
  onRemove: () => void;
}

function AvailableProgramCard({
  program,
  isSelected,
  onAdd,
  onRemove,
}: AvailableProgramCardProps) {
  const uni = populated<University>(program.university);
  const spec = populated<Specialty>(program.specialty);

  return (
    <article className="border-[0.91px] border-lrfap-ghost bg-white p-[20px] shadow-[0_4px_24px_-12px_rgba(38,43,102,0.1)]">
      <div className="min-w-0">
        <h4 className="font-display text-[15px] font-bold uppercase tracking-wide text-lrfap-navy">
          {headlineFor(program)}
        </h4>
        {uni?.name ? (
          <p className="mt-[2px] font-sans text-[13px] text-slate-500">
            {uni.name}
          </p>
        ) : null}
      </div>

      <dl className="mt-[14px] grid grid-cols-3 gap-[16px] border-t border-lrfap-ghost pt-[12px]">
        <Cell label="Speciality" value={spec?.name ?? '—'} />
        <Cell label="Location" value={uni?.city ?? '—'} />
        <Cell
          label="Number of Seats"
          value={program.availableSeats.toString().padStart(2, '0')}
        />
      </dl>

      <div className="mt-[16px] flex justify-end">
        {isSelected ? (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex h-[40px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-white px-[20px] font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy"
          >
            <X aria-hidden="true" className="h-4 w-4" />
            Remove
          </button>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex h-[40px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[20px] font-sans text-[13px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Add
          </button>
        )}
      </div>
    </article>
  );
}

interface SelectedProgramRowProps {
  rank: number;
  program: Program | null;
  onRemove: () => void;
}

function SelectedProgramRow({ rank, program, onRemove }: SelectedProgramRowProps) {
  const uni = program ? populated<University>(program.university) : null;
  const rankLabel = rank.toString().padStart(2, '0');

  return (
    <article className="flex items-center gap-[16px] border-[0.91px] border-lrfap-ghost bg-white p-[16px] shadow-[0_4px_24px_-12px_rgba(38,43,102,0.08)]">
      <span
        aria-hidden="true"
        className="flex h-[36px] w-[36px] shrink-0 items-center justify-center border-[0.91px] border-lrfap-navy bg-lrfap-navy font-display text-[13px] font-bold text-white"
      >
        {rankLabel}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-sans text-[13px] font-semibold uppercase tracking-wide text-lrfap-navy">
          {program ? headlineFor(program) : 'Unknown program'}
        </p>
        {uni?.name ? (
          <p className="mt-[2px] truncate font-sans text-[12px] text-slate-500">
            {uni.name}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex h-[36px] shrink-0 items-center justify-center gap-[6px] border-[0.91px] border-red-600 bg-red-600 px-[14px] font-sans text-[12px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
      >
        <X aria-hidden="true" className="h-3.5 w-3.5" />
        Remove
      </button>
    </article>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-sans text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-[2px] truncate font-sans text-[13px] font-semibold text-lrfap-navy">
        {value}
      </dd>
    </div>
  );
}

function EmptyPanel({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-lrfap-ghost bg-white/60 px-6 py-[40px] text-center">
      <p className="font-sans text-[14px] font-medium text-lrfap-navy">
        {title}
      </p>
      <p className="mt-[8px] max-w-[420px] font-sans text-[13px] text-slate-500">
        {body}
      </p>
      {action}
    </div>
  );
}

function SkeletonList() {
  return (
    <section
      aria-busy="true"
      className="flex flex-col gap-[20px] pt-[16px] pb-[24px]"
    >
      <div className="h-[22px] w-[120px] animate-pulse bg-slate-200" />
      <div className="h-[44px] w-full animate-pulse bg-slate-100" />
      <div className="grid grid-cols-1 gap-[16px] md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[64px] animate-pulse bg-slate-100" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-[24px] lg:grid-cols-[1.4fr_1fr]">
        <ul role="list" className="flex flex-col gap-[16px]">
          {[0, 1, 2, 3].map((i) => (
            <li
              key={i}
              className="h-[180px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50"
            />
          ))}
        </ul>
        <ul role="list" className="flex flex-col gap-[12px]">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="h-[72px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50"
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
