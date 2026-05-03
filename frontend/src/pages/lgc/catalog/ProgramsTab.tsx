import { useCallback, useEffect, useMemo, useState } from 'react';
import { AxiosError } from 'axios';
import {
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  Languages,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { programsApi } from '../../../api/programs';
import { universitiesApi } from '../../../api/universities';
import { specialtiesApi } from '../../../api/specialties';
import { cyclesApi } from '../../../api/cycles';
import { getApiErrorMessage } from '../../../utils/apiError';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { ConfirmActionDialog } from '../../../components/lgc/ConfirmActionDialog';
import {
  ProgramFormModal,
  type ProgramFormValues,
} from '../../../components/lgc/catalog/ProgramFormModal';
import type {
  Cycle,
  CycleStatus,
  ID,
  Program,
  Specialty,
  Track,
  University,
} from '../../../types';

/**
 * Programs tab of /lgc/catalog. Loads programs + the three lookup
 * collections it needs to label FKs and populate the form dropdowns.
 *
 * Sort order (per spec): cycle year DESC → specialty name ASC →
 * university name ASC. No grouping headers; a flat list keeps actions
 * consistently placed on every row.
 *
 * Filters (all client-side): cycle, track, university, specialty, plus
 * text search over university/specialty names. Default cycle filter is
 * the most recent non-terminal cycle — the LGC will almost always be
 * managing the in-flight cycle.
 */

type FetchStatus = 'idle' | 'loading' | 'loaded' | 'error';
type TrackFilter = 'all' | Track;

const TERMINAL_CYCLE_STATUSES: CycleStatus[] = ['published', 'closed'];

function idOf(ref: ID | { _id: ID } | null | undefined): string {
  if (!ref) return '';
  return typeof ref === 'string' ? ref : ref._id;
}

function populatedRef<T extends { _id: ID }>(
  ref: ID | T | null | undefined,
  lookup: Map<ID, T>,
): T | null {
  if (!ref) return null;
  if (typeof ref === 'string') return lookup.get(ref) ?? null;
  return ref;
}

export default function ProgramsTab() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 200);
  const [cycleFilter, setCycleFilter] = useState<'all' | ID>('all');
  const [trackFilter, setTrackFilter] = useState<TrackFilter>('all');
  const [universityFilter, setUniversityFilter] = useState<'all' | ID>('all');
  const [specialtyFilter, setSpecialtyFilter] = useState<'all' | ID>('all');

  // Whether the default cycle filter has been applied yet — prevents us
  // from re-overriding a user's explicit "All cycles" choice on re-load.
  const [defaultFilterApplied, setDefaultFilterApplied] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formTarget, setFormTarget] = useState<Program | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deactivateTarget, setDeactivateTarget] = useState<Program | null>(null);
  const [deactivateWorking, setDeactivateWorking] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 3000);
    return () => clearTimeout(t);
  }, [successMessage]);

  const loadAll = useCallback(async () => {
    setStatus('loading');
    setLoadError(null);
    try {
      const [progs, unis, specs, cyc] = await Promise.all([
        programsApi.list(),
        universitiesApi.list(),
        specialtiesApi.list(),
        cyclesApi.list(),
      ]);
      setPrograms(progs);
      setUniversities(unis);
      setSpecialties(specs);
      setCycles(cyc);
      setStatus('loaded');
    } catch (err) {
      setLoadError(getApiErrorMessage(err, 'Couldn’t load the programs catalog.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Apply default cycle filter once, after the first successful load.
  useEffect(() => {
    if (defaultFilterApplied) return;
    if (status !== 'loaded') return;
    if (cycles.length === 0) return;
    const sorted = [...cycles].sort((a, b) => b.year - a.year);
    const activeCycle = sorted.find(
      (c) => !TERMINAL_CYCLE_STATUSES.includes(c.status),
    );
    if (activeCycle) setCycleFilter(activeCycle._id);
    setDefaultFilterApplied(true);
  }, [status, cycles, defaultFilterApplied]);

  // Lookup maps for denormalizing FK refs on the rendered list.
  const universityById = useMemo(() => {
    const m = new Map<ID, University>();
    for (const u of universities) m.set(u._id, u);
    return m;
  }, [universities]);
  const specialtyById = useMemo(() => {
    const m = new Map<ID, Specialty>();
    for (const s of specialties) m.set(s._id, s);
    return m;
  }, [specialties]);
  const cycleById = useMemo(() => {
    const m = new Map<ID, Cycle>();
    for (const c of cycles) m.set(c._id, c);
    return m;
  }, [cycles]);

  const sortedCycles = useMemo(
    () =>
      [...cycles].sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return a.name.localeCompare(b.name);
      }),
    [cycles],
  );
  const sortedUniversities = useMemo(
    () => [...universities].sort((a, b) => a.name.localeCompare(b.name)),
    [universities],
  );
  const sortedSpecialties = useMemo(
    () => [...specialties].sort((a, b) => a.name.localeCompare(b.name)),
    [specialties],
  );

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const rows = programs
      .filter((p) => {
        if (cycleFilter !== 'all' && idOf(p.cycle) !== cycleFilter) return false;
        if (trackFilter !== 'all' && p.track !== trackFilter) return false;
        if (
          universityFilter !== 'all' &&
          idOf(p.university) !== universityFilter
        )
          return false;
        if (specialtyFilter !== 'all' && idOf(p.specialty) !== specialtyFilter)
          return false;
        if (q) {
          const uni = populatedRef(p.university, universityById);
          const spec = populatedRef(p.specialty, specialtyById);
          const haystack = `${uni?.name ?? ''} ${uni?.code ?? ''} ${spec?.name ?? ''} ${spec?.code ?? ''}`
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const cycA = populatedRef(a.cycle, cycleById);
        const cycB = populatedRef(b.cycle, cycleById);
        const yearA = cycA?.year ?? 0;
        const yearB = cycB?.year ?? 0;
        if (yearB !== yearA) return yearB - yearA;

        const specA = populatedRef(a.specialty, specialtyById)?.name ?? '';
        const specB = populatedRef(b.specialty, specialtyById)?.name ?? '';
        const bySpec = specA.localeCompare(specB);
        if (bySpec !== 0) return bySpec;

        const uniA = populatedRef(a.university, universityById)?.name ?? '';
        const uniB = populatedRef(b.university, universityById)?.name ?? '';
        return uniA.localeCompare(uniB);
      });
    return rows;
  }, [
    programs,
    debouncedSearch,
    cycleFilter,
    trackFilter,
    universityFilter,
    specialtyFilter,
    universityById,
    specialtyById,
    cycleById,
  ]);

  function resetFilters() {
    setSearch('');
    setCycleFilter('all');
    setTrackFilter('all');
    setUniversityFilter('all');
    setSpecialtyFilter('all');
  }

  const anyFilterActive =
    debouncedSearch.trim().length > 0 ||
    cycleFilter !== 'all' ||
    trackFilter !== 'all' ||
    universityFilter !== 'all' ||
    specialtyFilter !== 'all';

  // ---- Handlers --------------------------------------------------------

  const canCreatePrograms = universities.length > 0 && specialties.length > 0;

  function openCreate() {
    if (!canCreatePrograms) return;
    setFormMode('create');
    setFormTarget(null);
    setFormError(null);
    setFormOpen(true);
  }
  function openEdit(p: Program) {
    setFormMode('edit');
    setFormTarget(p);
    setFormError(null);
    setFormOpen(true);
  }
  function closeForm() {
    if (formSaving) return;
    setFormOpen(false);
    setFormError(null);
  }

  const submitForm = useCallback(
    async (values: ProgramFormValues) => {
      setFormSaving(true);
      setFormError(null);
      try {
        if (formMode === 'create') {
          const created = await programsApi.create(
            values as Omit<Program, '_id'>,
          );
          setPrograms((prev) => [...prev, created]);
          setSuccessMessage('Program added.');
        } else if (formTarget) {
          const updated = await programsApi.update(formTarget._id, values);
          setPrograms((prev) =>
            prev.map((p) => (p._id === updated._id ? updated : p)),
          );
          setSuccessMessage('Program updated.');
        }
        setFormOpen(false);
      } catch (err) {
        if (err instanceof AxiosError && err.response?.status === 409) {
          setFormError(
            'A program for this university, specialty, cycle, and track already exists.',
          );
        } else {
          setFormError(getApiErrorMessage(err, 'Couldn’t save this program.'));
        }
      } finally {
        setFormSaving(false);
      }
    },
    [formMode, formTarget],
  );

  function requestDeactivate(p: Program) {
    setDeactivateError(null);
    setDeactivateTarget(p);
  }
  function cancelDeactivate() {
    if (deactivateWorking) return;
    setDeactivateTarget(null);
    setDeactivateError(null);
  }
  const confirmDeactivate = useCallback(async () => {
    if (!deactivateTarget) return;
    setDeactivateWorking(true);
    setDeactivateError(null);
    try {
      await programsApi.remove(deactivateTarget._id);
      setPrograms((prev) => prev.filter((p) => p._id !== deactivateTarget._id));
      setSuccessMessage('Program deactivated.');
      setDeactivateTarget(null);
    } catch (err) {
      setDeactivateError(
        getApiErrorMessage(err, 'Couldn’t deactivate this program.'),
      );
    } finally {
      setDeactivateWorking(false);
    }
  }, [deactivateTarget]);

  // ---- Render ----------------------------------------------------------

  const selectCls =
    'h-[40px] w-full appearance-none border-[0.91px] border-lrfap-ghost bg-white px-[12px] font-sans text-[13px] text-slate-900 transition-colors hover:border-slate-300 focus:border-lrfap-sky focus:outline-none';

  return (
    <div className="flex flex-col gap-[20px]">
      {successMessage ? (
        <div
          role="status"
          className="inline-flex max-w-fit items-center gap-[8px] border-[0.91px] border-emerald-200 bg-emerald-50 px-[12px] py-[8px] font-sans text-[12px] font-medium text-emerald-800"
        >
          <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
          {successMessage}
        </div>
      ) : null}

      <div className="flex flex-col gap-[12px]">
        <div className="flex flex-col gap-[12px] sm:flex-row sm:items-center sm:justify-between">
          <label htmlFor="prog-search" className="relative flex-1 max-w-[420px]">
            <span className="sr-only">Search programs</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-[12px] top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              id="prog-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search university or specialty"
              className="h-[40px] w-full border-[0.91px] border-lrfap-ghost bg-white pl-[36px] pr-[14px] font-sans text-[14px] text-slate-900 transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-lrfap-sky focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={openCreate}
            disabled={!canCreatePrograms}
            title={
              canCreatePrograms
                ? undefined
                : 'Add at least one university and specialty first.'
            }
            className="inline-flex h-[40px] shrink-0 items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[18px] font-sans text-[12px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Add program
          </button>
        </div>

        <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-[4px]">
            <label
              htmlFor="filter-cycle"
              className="font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500"
            >
              Cycle
            </label>
            <select
              id="filter-cycle"
              value={cycleFilter}
              onChange={(e) => setCycleFilter(e.target.value)}
              className={selectCls}
            >
              <option value="all">All cycles</option>
              {sortedCycles.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} · {c.year}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-[4px]">
            <span
              id="filter-track-label"
              className="font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500"
            >
              Track
            </span>
            <div
              role="radiogroup"
              aria-labelledby="filter-track-label"
              className="inline-flex h-[40px] w-full items-stretch overflow-hidden border-[0.91px] border-lrfap-ghost"
            >
              {(['all', 'residency', 'fellowship'] as TrackFilter[]).map((t) => {
                const selected = trackFilter === t;
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setTrackFilter(t)}
                    className={`flex-1 font-sans text-[12px] font-medium uppercase tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lrfap-sky ${
                      selected
                        ? 'bg-lrfap-navy text-white'
                        : 'bg-white text-lrfap-navy hover:bg-lrfap-ghost/50'
                    }`}
                  >
                    {t === 'all' ? 'All' : t}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-[4px]">
            <label
              htmlFor="filter-uni"
              className="font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500"
            >
              University
            </label>
            <select
              id="filter-uni"
              value={universityFilter}
              onChange={(e) => setUniversityFilter(e.target.value)}
              className={selectCls}
            >
              <option value="all">All universities</option>
              {sortedUniversities.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-[4px]">
            <label
              htmlFor="filter-spec"
              className="font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500"
            >
              Specialty
            </label>
            <select
              id="filter-spec"
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
              className={selectCls}
            >
              <option value="all">All specialties</option>
              {sortedSpecialties.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {status === 'error' ? (
        <div
          role="alert"
          className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
        >
          <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
          <span>{loadError ?? 'Couldn’t load the programs catalog.'}</span>
        </div>
      ) : null}

      {(status === 'loading' || status === 'idle') ? (
        <div className="flex flex-col gap-[8px]">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[96px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50"
            />
          ))}
        </div>
      ) : null}

      {status === 'loaded' && programs.length === 0 ? (
        <EmptyState
          onCreate={openCreate}
          canCreate={canCreatePrograms}
        />
      ) : null}

      {status === 'loaded' && programs.length > 0 && filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-[10px] border-[0.91px] border-dashed border-lrfap-ghost bg-white px-[16px] py-[28px] text-center font-sans text-[13px] text-slate-500">
          <span>No programs match the current filters.</span>
          {anyFilterActive ? (
            <button
              type="button"
              onClick={resetFilters}
              className="font-medium text-lrfap-navy hover:underline"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}

      {status === 'loaded' && filtered.length > 0 ? (
        <ul role="list" className="flex flex-col gap-[8px]">
          {filtered.map((p) => (
            <li key={p._id}>
              <ProgramRow
                program={p}
                universityById={universityById}
                specialtyById={specialtyById}
                cycleById={cycleById}
                onEdit={() => openEdit(p)}
                onDeactivate={() => requestDeactivate(p)}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <ProgramFormModal
        open={formOpen}
        mode={formMode}
        initial={formTarget}
        universities={universities}
        specialties={specialties}
        cycles={cycles}
        isSaving={formSaving}
        errorMessage={formError}
        onCancel={closeForm}
        onSubmit={submitForm}
      />

      <ConfirmActionDialog
        open={!!deactivateTarget}
        title="Deactivate program?"
        body={
          deactivateTarget ? (
            <>
              This program will be hidden but data is preserved. Existing
              applications referencing it remain active — contact affected
              applicants separately if the program is being withdrawn.
            </>
          ) : null
        }
        confirmLabel="Deactivate"
        tone="danger"
        isWorking={deactivateWorking}
        errorMessage={deactivateError}
        onCancel={cancelDeactivate}
        onConfirm={() => void confirmDeactivate()}
      />
    </div>
  );
}

// ---- Row ---------------------------------------------------------------

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

interface ProgramRowProps {
  program: Program;
  universityById: Map<ID, University>;
  specialtyById: Map<ID, Specialty>;
  cycleById: Map<ID, Cycle>;
  onEdit: () => void;
  onDeactivate: () => void;
}

function ProgramRow({
  program,
  universityById,
  specialtyById,
  cycleById,
  onEdit,
  onDeactivate,
}: ProgramRowProps) {
  const uni = populatedRef(program.university, universityById);
  const spec = populatedRef(program.specialty, specialtyById);
  const cyc = populatedRef(program.cycle, cycleById);
  const cyclePill = cyc ? STATUS_PILL[cyc.status] : null;

  return (
    <article className="flex flex-col gap-[12px] border-[0.91px] border-lrfap-ghost bg-white px-[18px] py-[14px] shadow-[0_2px_8px_rgba(38,43,102,0.04)] md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-[8px]">
          <h3 className="truncate font-display text-[15px] font-bold text-lrfap-navy">
            {spec?.name ?? 'Unknown specialty'}
          </h3>
          <span className="font-sans text-[13px] text-slate-500">·</span>
          <span className="truncate font-sans text-[13px] font-medium text-slate-700">
            {uni?.name ?? 'Unknown university'}
          </span>
          <span
            className={`inline-flex items-center border-[0.91px] px-[8px] py-[1px] font-sans text-[11px] font-medium uppercase tracking-wide capitalize ${
              program.track === 'fellowship'
                ? 'border-purple-200 bg-purple-50 text-purple-800'
                : 'border-sky-200 bg-sky-50 text-sky-800'
            }`}
          >
            {program.track}
          </span>
          {cyc ? (
            <span className="inline-flex items-center gap-[6px] font-sans text-[12px] text-slate-500">
              <span>{cyc.name} · {cyc.year}</span>
              {cyclePill ? (
                <span
                  className={`inline-flex items-center border-[0.91px] px-[8px] py-[1px] font-sans text-[11px] font-medium uppercase tracking-wide ${cyclePill.cls}`}
                >
                  {cyclePill.label}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
        <dl className="mt-[6px] flex flex-wrap items-center gap-x-[16px] gap-y-[4px] font-sans text-[12px] text-slate-600">
          <div className="inline-flex items-center gap-[4px]">
            <Users aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
            <dt className="sr-only">Seats</dt>
            <dd>
              <strong className="font-semibold text-lrfap-navy">
                {program.availableSeats}
              </strong>{' '}
              / {program.capacity} seats
            </dd>
          </div>
          <div className="inline-flex items-center gap-[4px]">
            <GraduationCap aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
            <dt className="sr-only">Duration</dt>
            <dd>
              {program.durationYears} year{program.durationYears === 1 ? '' : 's'}
            </dd>
          </div>
          {program.languageRequirement && program.languageRequirement !== 'none' ? (
            <div className="inline-flex items-center gap-[4px]">
              <Languages aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
              <dt className="sr-only">Language</dt>
              <dd className="capitalize">{program.languageRequirement}</dd>
            </div>
          ) : null}
        </dl>
      </div>
      <div className="flex items-center gap-[8px]">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-[36px] items-center justify-center gap-[6px] border-[0.91px] border-lrfap-navy px-[14px] font-sans text-[12px] font-medium uppercase tracking-wide text-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy"
        >
          <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
          Edit
        </button>
        <button
          type="button"
          onClick={onDeactivate}
          className="inline-flex h-[36px] items-center justify-center gap-[6px] border-[0.91px] border-red-200 bg-white px-[14px] font-sans text-[12px] font-medium uppercase tracking-wide text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
        >
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          Deactivate
        </button>
      </div>
    </article>
  );
}

interface EmptyStateProps {
  onCreate: () => void;
  canCreate: boolean;
}

function EmptyState({ onCreate, canCreate }: EmptyStateProps) {
  return (
    <div className="rounded-xl border-[0.91px] border-dashed border-lrfap-ghost bg-white px-[24px] py-[40px] text-center">
      <GraduationCap aria-hidden="true" className="mx-auto h-6 w-6 text-slate-400" />
      <h3 className="mt-[12px] font-display text-[16px] font-bold text-lrfap-navy">
        No programs created yet
      </h3>
      <p className="mx-auto mt-[6px] max-w-[420px] font-sans text-[13px] text-slate-600">
        {canCreate
          ? 'Create the first one to unlock applications against the active cycle.'
          : 'Add at least one university and specialty before creating programs.'}
      </p>
      <button
        type="button"
        onClick={onCreate}
        disabled={!canCreate}
        className="mt-[18px] inline-flex h-[40px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[20px] font-sans text-[12px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
        Add program
      </button>
    </div>
  );
}
