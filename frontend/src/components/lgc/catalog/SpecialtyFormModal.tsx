import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Loader2, X } from 'lucide-react';
import type { Specialty } from '../../../types';
import { CatalogTextInput } from './CatalogTextInput';

/**
 * Create + Edit modal for Specialty records. Fields mirror the backend
 * Specialty schema (name, code, description?, nationalQuota?).
 *
 * nationalQuota is optional — empty input is stored as `null` (matches
 * Mongoose default) rather than 0, since 0 would be a hard cap meaning
 * "no seats nationwide", not "unconstrained".
 */

export interface SpecialtyFormValues {
  name: string;
  code: string;
  description?: string;
  nationalQuota?: number | null;
}

export type SpecialtyFieldKey = 'name' | 'code' | 'description' | 'nationalQuota';

interface SpecialtyFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial: Specialty | null;
  isSaving: boolean;
  errorMessage: string | null;
  fieldErrors?: Partial<Record<SpecialtyFieldKey, string>>;
  onCancel: () => void;
  onSubmit: (values: SpecialtyFormValues) => void;
}

interface FormState {
  name: string;
  code: string;
  description: string;
  nationalQuota: string;
}

function initialFormState(s: Specialty | null): FormState {
  return {
    name: s?.name ?? '',
    code: s?.code ?? '',
    description: s?.description ?? '',
    nationalQuota: s?.nationalQuota == null ? '' : String(s.nationalQuota),
  };
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

function validate(s: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!s.name.trim()) errors.name = 'Name is required.';
  else if (s.name.trim().length > 100) errors.name = 'Max 100 characters.';

  const code = s.code.trim();
  if (!code) errors.code = 'Code is required.';
  else if (code.length > 10) errors.code = 'Max 10 characters.';

  if (s.description.trim().length > 500)
    errors.description = 'Max 500 characters.';

  if (s.nationalQuota.trim()) {
    const q = Number(s.nationalQuota);
    if (!Number.isFinite(q) || q < 0 || !Number.isInteger(q))
      errors.nationalQuota = 'Enter a non-negative integer or leave blank.';
  }
  return errors;
}

export function SpecialtyFormModal({
  open,
  mode,
  initial,
  isSaving,
  errorMessage,
  fieldErrors,
  onCancel,
  onSubmit,
}: SpecialtyFormModalProps) {
  const [state, setState] = useState<FormState>(() => initialFormState(initial));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

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
    nameRef.current?.focus();
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setSubmitAttempted(true);
    const v = validate(state);
    if (Object.keys(v).length > 0) {
      setErrors(v);
      return;
    }
    onSubmit({
      name: state.name.trim(),
      code: state.code.trim().toUpperCase(),
      description: state.description.trim() || undefined,
      nationalQuota: state.nationalQuota.trim()
        ? Number(state.nationalQuota)
        : null,
    });
  }

  const mergedErrors: FieldErrors = { ...errors, ...(fieldErrors ?? {}) };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="specialty-form-backdrop"
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
              aria-labelledby="specialty-form-title"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[560px] border-[0.91px] border-lrfap-ghost bg-white shadow-[0_10px_40px_-12px_rgba(38,43,102,0.25)]"
            >
              <form onSubmit={handleSubmit} noValidate>
                <div className="flex items-start justify-between gap-[16px] px-[28px] pt-[24px] pb-[12px]">
                  <h2
                    id="specialty-form-title"
                    className="font-display text-[20px] font-bold uppercase tracking-wide text-lrfap-navy"
                  >
                    {mode === 'create' ? 'Add specialty' : 'Edit specialty'}
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
                    <CatalogTextInput
                      id="spec-name"
                      label="Name"
                      value={state.name}
                      onChange={(v) => update('name', v)}
                      required
                      maxLength={100}
                      error={mergedErrors.name}
                      inputRef={nameRef}
                      placeholder="e.g. Internal Medicine"
                      className="md:col-span-2"
                    />
                    <CatalogTextInput
                      id="spec-code"
                      label="Code"
                      value={state.code}
                      onChange={(v) => update('code', v.toUpperCase())}
                      required
                      maxLength={10}
                      error={mergedErrors.code}
                      placeholder="IM"
                      hint="Short uppercase identifier (≤10 chars)."
                    />
                    <CatalogTextInput
                      id="spec-quota"
                      label="National quota"
                      value={state.nationalQuota}
                      onChange={(v) => update('nationalQuota', v)}
                      type="number"
                      min={0}
                      error={mergedErrors.nationalQuota}
                      hint="Leave blank for no nationwide cap."
                    />
                    <div className="md:col-span-2 flex flex-col gap-[6px]">
                      <label
                        htmlFor="spec-description"
                        className="font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy"
                      >
                        Description
                      </label>
                      <textarea
                        id="spec-description"
                        value={state.description}
                        onChange={(e) => update('description', e.target.value)}
                        maxLength={500}
                        rows={3}
                        aria-invalid={mergedErrors.description ? 'true' : undefined}
                        className={`min-h-[80px] w-full resize-y border-2 bg-white px-[14px] py-[10px] font-sans text-[15px] text-slate-900 transition-colors duration-150 placeholder:text-slate-400 focus:outline-none ${
                          mergedErrors.description
                            ? 'border-red-500'
                            : 'border-lrfap-ghost hover:border-slate-300 focus-within:border-lrfap-sky'
                        }`}
                        placeholder="Optional summary shown to applicants."
                      />
                      <p className="font-sans text-[12px] text-slate-500">
                        {state.description.length}/500 characters.
                      </p>
                      {mergedErrors.description ? (
                        <p className="font-sans text-[12px] font-medium text-red-600">
                          {mergedErrors.description}
                        </p>
                      ) : null}
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
                      'Add specialty'
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
