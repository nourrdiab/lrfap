import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Loader2, X } from 'lucide-react';
import type {
  Cycle,
  CycleStatus,
  ID,
  LanguageRequirement,
  Program,
  Specialty,
  Track,
  University,
} from '../../../types';
import { CatalogTextInput } from './CatalogTextInput';

/**
 * Create + Edit modal for Program records. Foreign-key fields are
 * rendered as native <select> populated from lists the parent tab
 * pre-fetches (universities, specialties, cycles).
 *
 * Cycle dropdown rules:
 *   - Create: only non-terminal cycles (draft / open / review / ranking /
 *     matching) are selectable. Published and closed cycles are hidden
 *     because LGC shouldn't create programs inside a finished cycle.
 *   - Edit: if the bound cycle is terminal, show it but mark it as
 *     "(locked)" so the user understands why they can't move the program
 *     into another terminal cycle.
 *
 * availableSeats is intentionally not shown on Create. The backend
 * auto-fills it to `capacity` when omitted (see programController.
 * createProgram). On Edit we surface it so LGC can adjust seats
 * mid-cycle without touching capacity.
 */

export interface ProgramFormValues {
  university: ID;
  specialty: ID;
  cycle: ID;
  track: Track;
  capacity: number;
  // Only present on Edit — Create lets the backend default it to capacity.
  availableSeats?: number;
  durationYears: number;
  description?: string;
  extraRequirements?: string[];
  languageRequirement?: LanguageRequirement;
}

type ProgramFieldKey =
  | 'university'
  | 'specialty'
  | 'cycle'
  | 'track'
  | 'capacity'
  | 'availableSeats'
  | 'durationYears';

interface ProgramFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial: Program | null;
  universities: University[];
  specialties: Specialty[];
  cycles: Cycle[];
  isSaving: boolean;
  errorMessage: string | null;
  fieldErrors?: Partial<Record<ProgramFieldKey, string>>;
  onCancel: () => void;
  onSubmit: (values: ProgramFormValues) => void;
}

const TERMINAL_CYCLE_STATUSES: CycleStatus[] = ['published', 'closed'];
const LANGUAGE_OPTIONS: { value: LanguageRequirement; label: string }[] = [
  { value: 'none', label: 'No requirement' },
  { value: 'english', label: 'English' },
  { value: 'french', label: 'French' },
  { value: 'arabic', label: 'Arabic' },
];

interface FormState {
  university: string;
  specialty: string;
  cycle: string;
  track: Track | '';
  capacity: string;
  availableSeats: string;
  durationYears: string;
  description: string;
  extraRequirementsRaw: string;
  languageRequirement: LanguageRequirement;
}

function idOf(ref: ID | { _id: ID } | null | undefined): string {
  if (!ref) return '';
  return typeof ref === 'string' ? ref : ref._id;
}

function initialFormState(p: Program | null): FormState {
  return {
    university: idOf(p?.university),
    specialty: idOf(p?.specialty),
    cycle: idOf(p?.cycle),
    track: p?.track ?? '',
    capacity: p?.capacity == null ? '' : String(p.capacity),
    availableSeats:
      p?.availableSeats == null ? '' : String(p.availableSeats),
    durationYears: p?.durationYears == null ? '' : String(p.durationYears),
    description: p?.description ?? '',
    extraRequirementsRaw: (p?.extraRequirements ?? []).join('\n'),
    languageRequirement: p?.languageRequirement ?? 'none',
  };
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

function validate(s: FormState, mode: 'create' | 'edit'): FieldErrors {
  const errors: FieldErrors = {};
  if (!s.university) errors.university = 'Select a university.';
  if (!s.specialty) errors.specialty = 'Select a specialty.';
  if (!s.cycle) errors.cycle = 'Select a cycle.';
  if (!s.track) errors.track = 'Pick a track.';

  const capacity = Number(s.capacity);
  if (!s.capacity || !Number.isFinite(capacity) || capacity < 0 || !Number.isInteger(capacity))
    errors.capacity = 'Enter a non-negative integer.';

  if (mode === 'edit') {
    const seats = Number(s.availableSeats);
    if (
      !s.availableSeats ||
      !Number.isFinite(seats) ||
      seats < 0 ||
      !Number.isInteger(seats)
    )
      errors.availableSeats = 'Enter a non-negative integer.';
    else if (seats > capacity)
      errors.availableSeats = 'Cannot exceed capacity.';
  }

  const years = Number(s.durationYears);
  if (!s.durationYears || !Number.isFinite(years) || years < 1 || years > 10)
    errors.durationYears = 'Enter a value between 1 and 10.';

  if (s.description.trim().length > 1000)
    errors.description = 'Max 1000 characters.';

  return errors;
}

export function ProgramFormModal({
  open,
  mode,
  initial,
  universities,
  specialties,
  cycles,
  isSaving,
  errorMessage,
  fieldErrors,
  onCancel,
  onSubmit,
}: ProgramFormModalProps) {
  const [state, setState] = useState<FormState>(() => initialFormState(initial));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);
  const firstFieldRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    if (open) {
      setState(initialFormState(initial));
      setErrors({});
      setSubmitAttempted(false);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    firstFieldRef.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isSaving) {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, isSaving, onCancel]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
    if (submitAttempted) {
      setErrors((e) => {
        if (!(key in e)) return e;
        const next = { ...e };
        delete next[key];
        return next;
      });
    }
  }

  const sortedUniversities = useMemo(
    () => [...universities].sort((a, b) => a.name.localeCompare(b.name)),
    [universities],
  );
  const sortedSpecialties = useMemo(
    () => [...specialties].sort((a, b) => a.name.localeCompare(b.name)),
    [specialties],
  );

  // Cycle options — terminal cycles are always hidden on create and only
  // shown on edit if they match the bound cycle, so the user can't move
  // a program into a terminal cycle.
  const initialCycleId = idOf(initial?.cycle);
  const cycleOptions = useMemo(() => {
    return [...cycles]
      .filter((c) => {
        if (!TERMINAL_CYCLE_STATUSES.includes(c.status)) return true;
        if (mode === 'edit' && c._id === initialCycleId) return true;
        return false;
      })
      .sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return a.name.localeCompare(b.name);
      });
  }, [cycles, mode, initialCycleId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setSubmitAttempted(true);
    const v = validate(state, mode);
    if (Object.keys(v).length > 0) {
      setErrors(v);
      return;
    }
    const requirements = state.extraRequirementsRaw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const payload: ProgramFormValues = {
      university: state.university,
      specialty: state.specialty,
      cycle: state.cycle,
      track: state.track as Track,
      capacity: Number(state.capacity),
      durationYears: Number(state.durationYears),
      description: state.description.trim() || undefined,
      extraRequirements: requirements.length > 0 ? requirements : undefined,
      languageRequirement: state.languageRequirement,
    };
    if (mode === 'edit') {
      payload.availableSeats = Number(state.availableSeats);
    }
    onSubmit(payload);
  }

  const mergedErrors: FieldErrors = { ...errors, ...(fieldErrors ?? {}) };

  const selectBaseCls =
    'h-[40.67px] w-full appearance-none border-2 bg-white px-[14px] font-sans text-[15px] text-slate-900 transition-colors duration-150 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

  function selectClass(hasError: boolean | undefined) {
    return `${selectBaseCls} ${
      hasError
        ? 'border-red-500'
        : 'border-lrfap-ghost hover:border-slate-300 focus-within:border-lrfap-sky'
    }`;
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="program-form-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={isSaving ? undefined : onCancel}
          className="fixed inset-0 z-40 bg-black/40"
        >
          <div className="flex min-h-full items-center justify-center p-6">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="program-form-title"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[720px] border-[0.91px] border-lrfap-ghost bg-white shadow-[0_10px_40px_-12px_rgba(38,43,102,0.25)]"
            >
              <form onSubmit={handleSubmit} noValidate>
                <div className="flex items-start justify-between gap-[16px] px-[28px] pt-[24px] pb-[12px]">
                  <h2
                    id="program-form-title"
                    className="font-display text-[20px] font-bold uppercase tracking-wide text-lrfap-navy"
                  >
                    {mode === 'create' ? 'Add program' : 'Edit program'}
                  </h2>
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSaving}
                    aria-label="Close"
                    className="inline-flex h-[32px] w-[32px] shrink-0 items-center justify-center text-slate-500 hover:text-lrfap-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <X aria-hidden="true" className="h-5 w-5" />
                  </button>
                </div>

                <div className="max-h-[70vh] overflow-y-auto px-[28px] pb-[20px]">
                  <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2">
                    <div className="flex flex-col gap-[6px]">
                      <label
                        htmlFor="prog-university"
                        className="font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy"
                      >
                        University
                        <span aria-hidden="true" className="ml-1 text-lrfap-sky">*</span>
                      </label>
                      <select
                        ref={firstFieldRef}
                        id="prog-university"
                        value={state.university}
                        onChange={(e) => update('university', e.target.value)}
                        aria-invalid={mergedErrors.university ? 'true' : undefined}
                        className={selectClass(!!mergedErrors.university)}
                      >
                        <option value="" disabled>
                          Select a university…
                        </option>
                        {sortedUniversities.map((u) => (
                          <option key={u._id} value={u._id}>
                            {u.name} ({u.code})
                          </option>
                        ))}
                      </select>
                      {mergedErrors.university ? (
                        <p className="font-sans text-[12px] font-medium text-red-600">
                          {mergedErrors.university}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-[6px]">
                      <label
                        htmlFor="prog-specialty"
                        className="font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy"
                      >
                        Specialty
                        <span aria-hidden="true" className="ml-1 text-lrfap-sky">*</span>
                      </label>
                      <select
                        id="prog-specialty"
                        value={state.specialty}
                        onChange={(e) => update('specialty', e.target.value)}
                        aria-invalid={mergedErrors.specialty ? 'true' : undefined}
                        className={selectClass(!!mergedErrors.specialty)}
                      >
                        <option value="" disabled>
                          Select a specialty…
                        </option>
                        {sortedSpecialties.map((s) => (
                          <option key={s._id} value={s._id}>
                            {s.name} ({s.code})
                          </option>
                        ))}
                      </select>
                      {mergedErrors.specialty ? (
                        <p className="font-sans text-[12px] font-medium text-red-600">
                          {mergedErrors.specialty}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-[6px] md:col-span-2">
                      <label
                        htmlFor="prog-cycle"
                        className="font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy"
                      >
                        Cycle
                        <span aria-hidden="true" className="ml-1 text-lrfap-sky">*</span>
                      </label>
                      <select
                        id="prog-cycle"
                        value={state.cycle}
                        onChange={(e) => update('cycle', e.target.value)}
                        aria-invalid={mergedErrors.cycle ? 'true' : undefined}
                        className={selectClass(!!mergedErrors.cycle)}
                      >
                        <option value="" disabled>
                          Select a cycle…
                        </option>
                        {cycleOptions.map((c) => {
                          const terminal = TERMINAL_CYCLE_STATUSES.includes(c.status);
                          return (
                            <option key={c._id} value={c._id}>
                              {c.name} · {c.year}
                              {terminal ? ' (locked)' : ''}
                            </option>
                          );
                        })}
                      </select>
                      <p className="font-sans text-[12px] text-slate-500">
                        Only active cycles are available. Published and closed
                        cycles are locked from new programs.
                      </p>
                      {mergedErrors.cycle ? (
                        <p className="font-sans text-[12px] font-medium text-red-600">
                          {mergedErrors.cycle}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-[6px] md:col-span-2">
                      <span
                        className="font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy"
                        id="prog-track-label"
                      >
                        Track
                        <span aria-hidden="true" className="ml-1 text-lrfap-sky">*</span>
                      </span>
                      <div
                        role="radiogroup"
                        aria-labelledby="prog-track-label"
                        className="grid grid-cols-2 gap-[10px]"
                      >
                        {(['residency', 'fellowship'] as Track[]).map((t) => {
                          const selected = state.track === t;
                          return (
                            <button
                              key={t}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() => update('track', t)}
                              className={`inline-flex h-[40.67px] items-center justify-center border-[0.91px] px-[16px] font-sans text-[13px] font-medium capitalize tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky ${
                                selected
                                  ? 'border-lrfap-navy bg-lrfap-navy text-white'
                                  : 'border-lrfap-ghost bg-white text-lrfap-navy hover:bg-lrfap-ghost/50'
                              }`}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                      {mergedErrors.track ? (
                        <p className="font-sans text-[12px] font-medium text-red-600">
                          {mergedErrors.track}
                        </p>
                      ) : null}
                    </div>

                    <CatalogTextInput
                      id="prog-capacity"
                      label="Capacity"
                      type="number"
                      min={0}
                      required
                      value={state.capacity}
                      onChange={(v) => update('capacity', v)}
                      error={mergedErrors.capacity}
                      hint={
                        mode === 'create'
                          ? 'Available seats will default to this value.'
                          : undefined
                      }
                    />
                    {mode === 'edit' ? (
                      <CatalogTextInput
                        id="prog-seats"
                        label="Available seats"
                        type="number"
                        min={0}
                        required
                        value={state.availableSeats}
                        onChange={(v) => update('availableSeats', v)}
                        error={mergedErrors.availableSeats}
                        hint="Cannot exceed capacity."
                      />
                    ) : null}
                    <CatalogTextInput
                      id="prog-duration"
                      label="Duration (years)"
                      type="number"
                      min={1}
                      max={10}
                      required
                      value={state.durationYears}
                      onChange={(v) => update('durationYears', v)}
                      error={mergedErrors.durationYears}
                    />

                    <div className="flex flex-col gap-[6px]">
                      <label
                        htmlFor="prog-language"
                        className="font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy"
                      >
                        Language requirement
                      </label>
                      <select
                        id="prog-language"
                        value={state.languageRequirement}
                        onChange={(e) =>
                          update('languageRequirement', e.target.value as LanguageRequirement)
                        }
                        className={selectClass(false)}
                      >
                        {LANGUAGE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2 flex flex-col gap-[6px]">
                      <label
                        htmlFor="prog-description"
                        className="font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy"
                      >
                        Description
                      </label>
                      <textarea
                        id="prog-description"
                        value={state.description}
                        onChange={(e) => update('description', e.target.value)}
                        maxLength={1000}
                        rows={5}
                        className={`min-h-[80px] w-full resize-y border-2 bg-white px-[14px] py-[10px] font-sans text-[15px] text-slate-900 transition-colors duration-150 placeholder:text-slate-400 focus:outline-none ${
                          mergedErrors.description
                            ? 'border-red-500'
                            : 'border-lrfap-ghost hover:border-slate-300 focus-within:border-lrfap-sky'
                        }`}
                        placeholder="Describe the program for applicants. Include accreditation, training structure, and what makes this program distinctive."
                      />
                      <p className="font-sans text-[12px] text-slate-500">
                        {state.description.length}/1000 characters.
                      </p>
                    </div>

                    <div className="md:col-span-2 flex flex-col gap-[6px]">
                      <label
                        htmlFor="prog-requirements"
                        className="font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy"
                      >
                        Extra requirements
                      </label>
                      <textarea
                        id="prog-requirements"
                        value={state.extraRequirementsRaw}
                        onChange={(e) => update('extraRequirementsRaw', e.target.value)}
                        rows={3}
                        className="min-h-[80px] w-full resize-y border-2 border-lrfap-ghost bg-white px-[14px] py-[10px] font-sans text-[15px] text-slate-900 transition-colors duration-150 placeholder:text-slate-400 hover:border-slate-300 focus-within:border-lrfap-sky focus:outline-none"
                        placeholder={'IFOM 1 passing score\nClinical rotation certificate'}
                      />
                      <p className="font-sans text-[12px] text-slate-500">
                        One requirement per line. Leave blank if none.
                      </p>
                    </div>
                  </div>

                  {errorMessage ? (
                    <p
                      role="alert"
                      className="mt-[16px] flex items-start gap-[8px] font-sans text-[13px] text-red-700"
                    >
                      <AlertCircle
                        aria-hidden="true"
                        className="mt-[2px] h-4 w-4 shrink-0"
                      />
                      <span>{errorMessage}</span>
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center justify-end gap-[12px] border-t border-lrfap-ghost bg-lrfap-ghost/30 px-[28px] py-[16px]">
                  <button
                    ref={cancelBtnRef}
                    type="button"
                    disabled={isSaving}
                    onClick={onCancel}
                    className="inline-flex h-[40px] items-center justify-center border-[0.91px] border-lrfap-navy px-[18px] font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex h-[40px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[22px] font-sans text-[13px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : mode === 'create' ? (
                      'Add program'
                    ) : (
                      'Save changes'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
