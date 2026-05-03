import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Loader2, X } from 'lucide-react';
import type { Cycle, CycleStatus, ISODateString } from '../../../types';

/**
 * Create + Edit modal for Cycle records.
 *
 * Field locking tracks the cycle lifecycle:
 *   - draft                              → everything editable
 *   - open / review / ranking / matching → dates locked (applicants and
 *     universities are already working against them); name/year/window
 *     stay editable
 *   - published / closed                 → fully read-only; the modal
 *     shouldn't be reachable from those statuses on the management page,
 *     but if it somehow opens we render the body as a summary view.
 *
 * Backend accepts ISO strings for startDate/endDate/submissionDeadline/
 * rankingDeadline/resultPublicationDate. Native <input type="date">
 * gives us YYYY-MM-DD, which we parse back to ISO at submit time
 * (anchored to start-of-day UTC, consistent with how dashboard surfaces
 * formatted dates in en-GB day-month-year).
 */

export interface CycleFormValues {
  name: string;
  year: number;
  status: CycleStatus;
  startDate: ISODateString;
  endDate: ISODateString;
  submissionDeadline: ISODateString;
  rankingDeadline: ISODateString;
  resultPublicationDate: ISODateString;
  acceptanceWindowHours: number;
}

interface CycleFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial: Cycle | null;
  isSaving: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onSubmit: (values: CycleFormValues) => void;
}

const DEFAULT_ACCEPTANCE_HOURS = 72;

function isoToDateInput(iso: ISODateString | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = d.getUTCDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function dateInputToIso(value: string): ISODateString {
  if (!value) return '';
  // YYYY-MM-DD → start-of-day UTC ISO. `new Date('YYYY-MM-DD')` already
  // parses as UTC midnight; call toISOString() to normalize.
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

interface FormState {
  name: string;
  year: string;
  startDate: string;
  endDate: string;
  submissionDeadline: string;
  rankingDeadline: string;
  resultPublicationDate: string;
  acceptanceWindowHours: string;
}

function initialFormState(cycle: Cycle | null): FormState {
  if (!cycle) {
    const nextYear = new Date().getUTCFullYear() + 1;
    return {
      name: '',
      year: String(nextYear),
      startDate: '',
      endDate: '',
      submissionDeadline: '',
      rankingDeadline: '',
      resultPublicationDate: '',
      acceptanceWindowHours: String(DEFAULT_ACCEPTANCE_HOURS),
    };
  }
  return {
    name: cycle.name ?? '',
    year: String(cycle.year ?? ''),
    startDate: isoToDateInput(cycle.startDate),
    endDate: isoToDateInput(cycle.endDate),
    submissionDeadline: isoToDateInput(cycle.submissionDeadline),
    rankingDeadline: isoToDateInput(cycle.rankingDeadline),
    resultPublicationDate: isoToDateInput(cycle.resultPublicationDate),
    acceptanceWindowHours: String(
      cycle.acceptanceWindowHours ?? DEFAULT_ACCEPTANCE_HOURS,
    ),
  };
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

function validate(state: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!state.name.trim()) errors.name = 'Name is required.';
  const yearNum = Number(state.year);
  if (!state.year || !Number.isFinite(yearNum) || yearNum < 2000 || yearNum > 2100) {
    errors.year = 'Enter a valid year.';
  }
  if (!state.startDate) errors.startDate = 'Start date is required.';
  if (!state.endDate) errors.endDate = 'End date is required.';
  if (!state.submissionDeadline)
    errors.submissionDeadline = 'Submission deadline is required.';
  if (!state.rankingDeadline)
    errors.rankingDeadline = 'Ranking deadline is required.';
  if (!state.resultPublicationDate)
    errors.resultPublicationDate = 'Results date is required.';

  if (state.startDate && state.endDate && state.startDate > state.endDate) {
    errors.endDate = 'End date must be on or after start date.';
  }
  if (
    state.startDate &&
    state.submissionDeadline &&
    state.submissionDeadline < state.startDate
  ) {
    errors.submissionDeadline = 'Must be on or after start date.';
  }
  if (
    state.submissionDeadline &&
    state.rankingDeadline &&
    state.rankingDeadline < state.submissionDeadline
  ) {
    errors.rankingDeadline = 'Must be on or after submission deadline.';
  }
  if (
    state.rankingDeadline &&
    state.resultPublicationDate &&
    state.resultPublicationDate < state.rankingDeadline
  ) {
    errors.resultPublicationDate = 'Must be on or after ranking deadline.';
  }

  const hoursNum = Number(state.acceptanceWindowHours);
  if (
    !state.acceptanceWindowHours ||
    !Number.isFinite(hoursNum) ||
    hoursNum < 1 ||
    hoursNum > 720
  ) {
    errors.acceptanceWindowHours = 'Enter 1–720 hours.';
  }
  return errors;
}

export function CycleFormModal({
  open,
  mode,
  initial,
  isSaving,
  errorMessage,
  onCancel,
  onSubmit,
}: CycleFormModalProps) {
  const [state, setState] = useState<FormState>(() => initialFormState(initial));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  // Re-seed when the modal opens or the target cycle changes.
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
    // Focus the name field by default in create mode; in locked/read-only
    // modes, fall back to the cancel button so there's always a focus
    // anchor for screen readers.
    if (mode === 'create') {
      nameRef.current?.focus();
    } else {
      cancelBtnRef.current?.focus();
    }
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
  }, [open, isSaving, onCancel, mode]);

  const status: CycleStatus = initial?.status ?? 'draft';
  const datesLocked =
    mode === 'edit' &&
    (status === 'open' ||
      status === 'review' ||
      status === 'ranking' ||
      status === 'matching');
  const fullyReadOnly = mode === 'edit' && (status === 'published' || status === 'closed');

  const title = useMemo(() => {
    if (mode === 'create') return 'Create cycle';
    if (fullyReadOnly) return 'View cycle';
    return 'Edit cycle';
  }, [mode, fullyReadOnly]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
    if (submitAttempted) {
      setErrors((e) => {
        const next = { ...e };
        delete next[key];
        return next;
      });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving || fullyReadOnly) return;
    setSubmitAttempted(true);
    const v = validate(state);
    if (Object.keys(v).length > 0) {
      setErrors(v);
      return;
    }
    onSubmit({
      name: state.name.trim(),
      year: Number(state.year),
      status,
      startDate: dateInputToIso(state.startDate),
      endDate: dateInputToIso(state.endDate),
      submissionDeadline: dateInputToIso(state.submissionDeadline),
      rankingDeadline: dateInputToIso(state.rankingDeadline),
      resultPublicationDate: dateInputToIso(state.resultPublicationDate),
      acceptanceWindowHours: Number(state.acceptanceWindowHours),
    });
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="cycle-form-backdrop"
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
              aria-labelledby="cycle-form-title"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[640px] border-[0.91px] border-lrfap-ghost bg-white shadow-[0_10px_40px_-12px_rgba(38,43,102,0.25)]"
            >
              <form onSubmit={handleSubmit} noValidate>
                <div className="flex items-start justify-between gap-[16px] px-[28px] pt-[24px] pb-[12px]">
                  <div className="min-w-0">
                    <h2
                      id="cycle-form-title"
                      className="font-display text-[20px] font-bold uppercase tracking-wide text-lrfap-navy"
                    >
                      {title}
                    </h2>
                    {mode === 'edit' ? (
                      <p className="mt-[4px] font-sans text-[12px] text-slate-500">
                        Status: <span className="font-medium text-lrfap-navy">{status}</span>
                        {datesLocked
                          ? ' — dates are locked once the cycle is active.'
                          : null}
                        {fullyReadOnly
                          ? ' — this cycle is final and read-only.'
                          : null}
                      </p>
                    ) : null}
                  </div>
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
                    <TextInput
                      id="cycle-name"
                      label="Name"
                      value={state.name}
                      onChange={(v) => update('name', v)}
                      required
                      disabled={fullyReadOnly}
                      error={errors.name}
                      inputRef={nameRef}
                      placeholder="e.g. 2027 Residency & Fellowship"
                      className="md:col-span-2"
                    />
                    <TextInput
                      id="cycle-year"
                      label="Year"
                      type="number"
                      value={state.year}
                      onChange={(v) => update('year', v)}
                      required
                      disabled={fullyReadOnly}
                      error={errors.year}
                      min={2000}
                      max={2100}
                    />
                    <TextInput
                      id="cycle-acceptance"
                      label="Acceptance window (hours)"
                      type="number"
                      value={state.acceptanceWindowHours}
                      onChange={(v) => update('acceptanceWindowHours', v)}
                      required
                      disabled={fullyReadOnly}
                      error={errors.acceptanceWindowHours}
                      min={1}
                      max={720}
                    />
                    <TextInput
                      id="cycle-start"
                      label="Start date"
                      type="date"
                      value={state.startDate}
                      onChange={(v) => update('startDate', v)}
                      required
                      disabled={fullyReadOnly || datesLocked}
                      error={errors.startDate}
                    />
                    <TextInput
                      id="cycle-end"
                      label="End date"
                      type="date"
                      value={state.endDate}
                      onChange={(v) => update('endDate', v)}
                      required
                      disabled={fullyReadOnly || datesLocked}
                      error={errors.endDate}
                    />
                    <TextInput
                      id="cycle-submission"
                      label="Submission deadline"
                      type="date"
                      value={state.submissionDeadline}
                      onChange={(v) => update('submissionDeadline', v)}
                      required
                      disabled={fullyReadOnly || datesLocked}
                      error={errors.submissionDeadline}
                    />
                    <TextInput
                      id="cycle-ranking"
                      label="Ranking deadline"
                      type="date"
                      value={state.rankingDeadline}
                      onChange={(v) => update('rankingDeadline', v)}
                      required
                      disabled={fullyReadOnly || datesLocked}
                      error={errors.rankingDeadline}
                    />
                    <TextInput
                      id="cycle-results"
                      label="Results publication"
                      type="date"
                      value={state.resultPublicationDate}
                      onChange={(v) => update('resultPublicationDate', v)}
                      required
                      disabled={fullyReadOnly || datesLocked}
                      error={errors.resultPublicationDate}
                      className="md:col-span-2"
                    />
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
                    {fullyReadOnly ? 'Close' : 'Cancel'}
                  </button>
                  {fullyReadOnly ? null : (
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="inline-flex h-[40px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[22px] font-sans text-[13px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving ? (
                        <>
                          <Loader2
                            aria-hidden="true"
                            className="h-4 w-4 animate-spin"
                          />
                          Saving…
                        </>
                      ) : mode === 'create' ? (
                        'Create cycle'
                      ) : (
                        'Save changes'
                      )}
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

interface TextInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'number' | 'date';
  required?: boolean;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

function TextInput({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required,
  disabled,
  error,
  placeholder,
  min,
  max,
  className,
  inputRef,
}: TextInputProps) {
  const errorId = `${id}-error`;
  const borderClasses = error
    ? 'border-red-500'
    : 'border-lrfap-ghost hover:border-slate-300 focus-within:border-lrfap-sky';
  return (
    <div className={`flex flex-col gap-[6px] ${className ?? ''}`}>
      <label
        htmlFor={id}
        className="font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy"
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-lrfap-sky">
            *
          </span>
        ) : null}
      </label>
      <input
        ref={inputRef}
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        min={min}
        max={max}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`h-[40.67px] w-full border-2 bg-white px-[14px] font-sans text-[15px] text-slate-900 transition-colors duration-150 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${borderClasses}`}
      />
      {error ? (
        <p id={errorId} className="font-sans text-[12px] font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
