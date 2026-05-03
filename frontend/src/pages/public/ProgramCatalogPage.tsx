import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, Inbox } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useAuth } from '../../hooks/useAuth';
import { programsApi } from '../../api/programs';
import { universitiesApi } from '../../api/universities';
import { specialtiesApi } from '../../api/specialties';
import { cyclesApi } from '../../api/cycles';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  CatalogFilterBar,
  type CatalogFilterValues,
  type TrackFilter,
} from '../../components/public/programs/CatalogFilterBar';
import { ProgramCard } from '../../components/public/programs/ProgramCard';
import type {
  Cycle,
  CycleStatus,
  ID,
  Program,
  Specialty,
  Track,
  University,
} from '../../types';

/**
 * Public programs catalog — anonymous and authenticated visitors both
 * land here. Read-only; no create/edit/deactivate.
 *
 * Filter state is URL-synced via useSearchParams so the page is
 * shareable/bookmarkable. Empty filters produce no URL params (a clean
 * `/programs` URL). The cycle default (most-recent-non-draft) is
 * applied once after cycles load, and written to the URL so the
 * resulting link reflects the actual filter in effect.
 *
 * Search is client-side over specialty name + university name +
 * description, because the backend /programs endpoint takes exact-match
 * ID filters only. The static filter selects (cycle/track/university/
 * specialty) drive the backend query; the text field filters the
 * returned array in-memory.
 */

type FetchStatus = 'idle' | 'loading' | 'loaded' | 'error';

const TRACK_OPTIONS: ReadonlyArray<Track> = ['residency', 'fellowship'];

function isTrackParam(value: string): value is Track {
  return (TRACK_OPTIONS as ReadonlyArray<string>).includes(value);
}

function populate<T extends { _id: ID }>(
  ref: ID | T | null | undefined,
  lookup: Map<ID, T>,
): T | null {
  if (!ref) return null;
  if (typeof ref === 'string') return lookup.get(ref) ?? null;
  return ref;
}

function idOf(ref: ID | { _id: ID } | null | undefined): string {
  if (!ref) return '';
  return typeof ref === 'string' ? ref : ref._id;
}

function mostRecentNonDraft(cycles: Cycle[]): Cycle | null {
  const sorted = [...cycles]
    .filter((c) => c.status !== 'draft')
    .sort((a, b) => b.year - a.year);
  return sorted[0] ?? null;
}

function readFiltersFromParams(
  params: URLSearchParams,
): CatalogFilterValues {
  const track = params.get('track') ?? '';
  return {
    search: params.get('q') ?? '',
    cycle: params.get('cycle') ?? 'all',
    track: isTrackParam(track) ? track : 'all',
    university: params.get('university') ?? 'all',
    specialty: params.get('specialty') ?? 'all',
  };
}

function filtersToParams(
  values: CatalogFilterValues,
): Record<string, string> {
  const p: Record<string, string> = {};
  if (values.search.trim()) p.q = values.search.trim();
  if (values.cycle !== 'all') p.cycle = values.cycle;
  if (values.track !== 'all') p.track = values.track;
  if (values.university !== 'all') p.university = values.university;
  if (values.specialty !== 'all') p.specialty = values.specialty;
  return p;
}

const EMPTY_FILTERS: CatalogFilterValues = {
  search: '',
  cycle: 'all',
  track: 'all',
  university: 'all',
  specialty: 'all',
};

export default function ProgramCatalogPage() {
  useDocumentTitle('Programs');
  const { isAuthenticated } = useAuth();
  const reduceMotion = useReducedMotion();
  const headingVariants = reduceMotion
    ? { hidden: {}, visible: {} }
    : { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } };

  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<CatalogFilterValues>(() =>
    readFiltersFromParams(searchParams),
  );
  const debouncedSearch = useDebouncedValue(filters.search, 200);

  const [programs, setPrograms] = useState<Program[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Whether we've applied the first-load cycle default — prevents us
  // from re-overriding a user's explicit "All cycles" choice after they
  // clear the filter.
  const [defaultCycleApplied, setDefaultCycleApplied] = useState(false);

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
      setPrograms(progs.filter((p) => p.isActive !== false));
      setUniversities(unis);
      setSpecialties(specs);
      setCycles(cyc);
      setStatus('loaded');
    } catch (err) {
      setLoadError(getApiErrorMessage(err, 'Couldn’t load the program catalog.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Apply the cycle default ONCE after cycles load, only if the URL
  // didn't already specify one. Reflect the choice back to the URL so
  // the resulting link is self-describing.
  useEffect(() => {
    if (defaultCycleApplied) return;
    if (status !== 'loaded') return;
    if (cycles.length === 0) {
      setDefaultCycleApplied(true);
      return;
    }
    setDefaultCycleApplied(true);
    if (filters.cycle !== 'all') return;
    if (searchParams.get('cycle')) return;
    const pick = mostRecentNonDraft(cycles);
    if (!pick) return;
    setFilters((prev) => ({ ...prev, cycle: pick._id }));
  }, [status, cycles, defaultCycleApplied, filters.cycle, searchParams]);

  // Push filter state back to the URL (replaceState — don't spam history).
  // Search param writes are debounced via debouncedSearch.
  useEffect(() => {
    const next = filtersToParams({
      ...filters,
      search: debouncedSearch,
    });
    const prev: Record<string, string> = {};
    searchParams.forEach((v, k) => {
      prev[k] = v;
    });
    const sameKeys =
      Object.keys(next).length === Object.keys(prev).length &&
      Object.keys(next).every((k) => next[k] === prev[k]);
    if (sameKeys) return;
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.cycle,
    filters.track,
    filters.university,
    filters.specialty,
    debouncedSearch,
  ]);

  // Lookup maps.
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
      [...cycles]
        .filter((c) => c.status !== 'draft')
        .sort((a, b) => {
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
    return programs
      .filter((p) => {
        if (filters.cycle !== 'all' && idOf(p.cycle) !== filters.cycle) {
          return false;
        }
        if (filters.track !== 'all' && p.track !== filters.track) return false;
        if (
          filters.university !== 'all' &&
          idOf(p.university) !== filters.university
        ) {
          return false;
        }
        if (
          filters.specialty !== 'all' &&
          idOf(p.specialty) !== filters.specialty
        ) {
          return false;
        }
        if (q) {
          const uni = populate(p.university, universityById);
          const spec = populate(p.specialty, specialtyById);
          const haystack = [
            spec?.name ?? '',
            uni?.name ?? '',
            uni?.city ?? '',
            p.description ?? '',
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const specA = populate(a.specialty, specialtyById)?.name ?? '';
        const specB = populate(b.specialty, specialtyById)?.name ?? '';
        const bySpec = specA.localeCompare(specB);
        if (bySpec !== 0) return bySpec;
        const uniA = populate(a.university, universityById)?.name ?? '';
        const uniB = populate(b.university, universityById)?.name ?? '';
        return uniA.localeCompare(uniB);
      });
  }, [
    programs,
    debouncedSearch,
    filters.cycle,
    filters.track,
    filters.university,
    filters.specialty,
    universityById,
    specialtyById,
  ]);

  const activeCycleStatus: CycleStatus | null = useMemo(() => {
    if (filters.cycle === 'all') {
      // Show post-match seats when all visible programs' cycles are
      // post-match; otherwise use pre-match framing.
      return null;
    }
    return cycleById.get(filters.cycle)?.status ?? null;
  }, [filters.cycle, cycleById]);

  const hasAnyActive =
    filters.search.trim() !== '' ||
    filters.cycle !== 'all' ||
    (filters.track as TrackFilter) !== 'all' ||
    filters.university !== 'all' ||
    filters.specialty !== 'all';

  function handleFilterChange(next: CatalogFilterValues) {
    setFilters(next);
    setExpandedId(null);
  }

  function clearAll() {
    setFilters(EMPTY_FILTERS);
    setExpandedId(null);
  }

  function toggleExpanded(programId: string) {
    setExpandedId((cur) => (cur === programId ? null : programId));
  }

  const isLoading = status === 'loading' || status === 'idle';

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-[40px] md:px-8 md:py-[56px]">
      <div className="flex flex-col gap-[28px]">
        <motion.header
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.1 } },
          }}
          className="flex flex-col gap-[12px] md:flex-row md:items-start md:gap-8"
        >
          <motion.h1
            variants={headingVariants}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="font-display text-[32px] font-extrabold leading-[1.05] text-lrfap-navy md:text-[40px]"
          >
            PROGRAMS
          </motion.h1>
          <motion.p
            variants={headingVariants}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="font-sans text-[14px] text-lrfap-navy md:flex-1 md:text-[15px]"
          >
            Browse residency and fellowship programs offered across
            participating Lebanese universities. Use the filters to narrow
            by cycle, track, university, or specialty.
          </motion.p>
        </motion.header>

        <CatalogFilterBar
          values={filters}
          onChange={handleFilterChange}
          cycles={sortedCycles}
          universities={sortedUniversities}
          specialties={sortedSpecialties}
          isBusy={isLoading}
          hasAnyActive={hasAnyActive}
          onClear={clearAll}
        />

        <div className="flex items-baseline justify-between">
          <p
            className={`font-sans text-[12px] ${isLoading ? 'italic text-lrfap-navy/70' : 'text-lrfap-navy'}`}
            aria-live="polite"
          >
            {isLoading ? (
              'Loading programs…'
            ) : status === 'loaded' ? (
              <>
                Showing{' '}
                <span className="font-semibold text-lrfap-navy">
                  {filtered.length}
                </span>{' '}
                {filtered.length === 1 ? 'program' : 'programs'}
                <span className="text-lrfap-navy/40">
                  {' '}· {programs.length} total
                </span>
              </>
            ) : null}
          </p>
        </div>

        {status === 'error' ? (
          <div
            role="alert"
            className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
          >
            <AlertCircle
              aria-hidden="true"
              className="mt-[2px] h-4 w-4 shrink-0"
            />
            <span>{loadError ?? 'Couldn’t load the program catalog.'}</span>
          </div>
        ) : null}

        {isLoading ? (
          <div
            aria-busy="true"
            aria-live="polite"
            className="grid grid-cols-1 gap-[16px] sm:grid-cols-2 lg:grid-cols-3"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : null}

        {status === 'loaded' && filtered.length === 0 ? (
          <EmptyState hasAnyActive={hasAnyActive} onClear={clearAll} />
        ) : null}

        {status === 'loaded' && filtered.length > 0 ? (
          <ul
            role="list"
            className="grid grid-cols-1 gap-[16px] sm:grid-cols-2 lg:grid-cols-3"
          >
            {filtered.map((p) => {
              const cyc = populate(p.cycle, cycleById);
              const cycleStatus =
                activeCycleStatus ?? cyc?.status ?? null;
              return (
                <li key={p._id}>
                  <ProgramCard
                    program={p}
                    universityById={universityById}
                    specialtyById={specialtyById}
                    cycleStatus={cycleStatus}
                    expanded={expandedId === p._id}
                    onToggle={() => toggleExpanded(p._id)}
                    isAuthenticated={isAuthenticated}
                  />
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-[12px] rounded-xl bg-white px-[20px] pt-[20px] pb-[20px] shadow-[0_4px_24px_-12px_rgba(38,43,102,0.15)]">
      <div className="h-[22px] w-3/4 animate-pulse bg-lrfap-navy/5" />
      <div className="h-[14px] w-1/2 animate-pulse bg-lrfap-navy/5" />
      <div className="flex gap-[6px]">
        <div className="h-[20px] w-[70px] animate-pulse bg-lrfap-navy/5" />
        <div className="h-[20px] w-[50px] animate-pulse bg-lrfap-navy/5" />
      </div>
      <div className="mt-[4px] flex flex-col gap-[6px]">
        <div className="h-[12px] w-full animate-pulse bg-lrfap-navy/5" />
        <div className="h-[12px] w-5/6 animate-pulse bg-lrfap-navy/5" />
      </div>
    </div>
  );
}

interface EmptyStateProps {
  hasAnyActive: boolean;
  onClear: () => void;
}

function EmptyState({ hasAnyActive, onClear }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-[12px] rounded-xl bg-white px-[16px] py-[56px] text-center shadow-[0_4px_24px_-12px_rgba(38,43,102,0.15)]">
      <Inbox aria-hidden="true" className="h-8 w-8 text-lrfap-navy" strokeWidth={1.5} />
      <p className="font-sans text-[14px] text-lrfap-navy">
        No programs match these filters.
      </p>
      {hasAnyActive ? (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-[36px] items-center justify-center rounded-lg px-[16px] font-sans text-[12px] font-medium uppercase tracking-wide text-lrfap-navy ring-1 ring-inset ring-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy"
        >
          Clear filters
        </button>
      ) : (
        <p className="font-sans text-[12px] text-lrfap-navy/70">
          No programs have been published yet.
        </p>
      )}
    </div>
  );
}
