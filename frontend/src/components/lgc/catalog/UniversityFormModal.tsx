import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Loader2, X } from 'lucide-react';
import type { University } from '../../../types';
import { CatalogTextInput } from './CatalogTextInput';

/**
 * Create + Edit modal for University records. Fields mirror the backend
 * Mongoose schema exactly (name, code, city?, website?, contactEmail?).
 *
 * 409 handling is split in two: a form-level banner carries the raw
 * backend message, and the parent tab re-checks the local list to map
 * the collision back to a specific field (name vs code) and passes the
 * inline error through `fieldErrors`. See UniversitiesTab.submitForm.
 */

export interface UniversityFormValues {
  name: string;
  code: string;
  city?: string;
  website?: string;
  contactEmail?: string;
}

export type UniversityFieldKey = keyof UniversityFormValues;

interface UniversityFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial: University | null;
  isSaving: boolean;
  errorMessage: string | null;
  fieldErrors?: Partial<Record<UniversityFieldKey, string>>;
  onCancel: () => void;
  onSubmit: (values: UniversityFormValues) => void;
}

interface FormState {
  name: string;
  code: string;
  city: string;
  website: string;
  contactEmail: string;
}

function initialFormState(u: University | null): FormState {
  return {
    name: u?.name ?? '',
    code: u?.code ?? '',
    city: u?.city ?? '',
    website: u?.website ?? '',
    contactEmail: u?.contactEmail ?? '',
  };
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

const URL_RE = /^(https?:\/\/)[^\s]+$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(s: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!s.name.trim()) errors.name = 'Name is required.';
  else if (s.name.trim().length > 200) errors.name = 'Max 200 characters.';

  const code = s.code.trim();
  if (!code) errors.code = 'Code is required.';
  else if (code.length > 10) errors.code = 'Max 10 characters.';

  if (s.city.trim().length > 100) errors.city = 'Max 100 characters.';

  if (s.website.trim()) {
    if (s.website.trim().length > 300) errors.website = 'Max 300 characters.';
    else if (!URL_RE.test(s.website.trim()))
      errors.website = 'Must start with http:// or https://';
  }
  if (s.contactEmail.trim() && !EMAIL_RE.test(s.contactEmail.trim()))
    errors.contactEmail = 'Enter a valid email address.';
  return errors;
}

export function UniversityFormModal({
  open,
  mode,
  initial,
  isSaving,
  errorMessage,
  fieldErrors,
  onCancel,
  onSubmit,
}: UniversityFormModalProps) {
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
      city: state.city.trim() || undefined,
      website: state.website.trim() || undefined,
      contactEmail: state.contactEmail.trim() || undefined,
    });
  }

  // Parent-supplied field errors (e.g. 409 collision mapped to name/code)
  // override local validation errors for the same field.
  const mergedErrors: FieldErrors = { ...errors, ...(fieldErrors ?? {}) };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="university-form-backdrop"
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
              aria-labelledby="university-form-title"
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
                    id="university-form-title"
                    className="font-display text-[20px] font-bold uppercase tracking-wide text-lrfap-navy"
                  >
                    {mode === 'create' ? 'Add university' : 'Edit university'}
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
                      id="uni-name"
                      label="Name"
                      value={state.name}
                      onChange={(v) => update('name', v)}
                      required
                      maxLength={200}
                      error={mergedErrors.name}
                      inputRef={nameRef}
                      placeholder="e.g. Lebanese American University"
                      className="md:col-span-2"
                    />
                    <CatalogTextInput
                      id="uni-code"
                      label="Code"
                      value={state.code}
                      onChange={(v) => update('code', v.toUpperCase())}
                      required
                      maxLength={10}
                      error={mergedErrors.code}
                      placeholder="LAU"
                      hint="Short uppercase identifier (≤10 chars)."
                    />
                    <CatalogTextInput
                      id="uni-city"
                      label="City"
                      value={state.city}
                      onChange={(v) => update('city', v)}
                      maxLength={100}
                      error={mergedErrors.city}
                      placeholder="Beirut"
                    />
                    <CatalogTextInput
                      id="uni-website"
                      label="Website"
                      value={state.website}
                      onChange={(v) => update('website', v)}
                      maxLength={300}
                      error={mergedErrors.website}
                      placeholder="https://www.example.edu"
                    />
                    <CatalogTextInput
                      id="uni-email"
                      label="Contact email"
                      value={state.contactEmail}
                      onChange={(v) => update('contactEmail', v)}
                      type="email"
                      error={mergedErrors.contactEmail}
                      placeholder="registrar@example.edu"
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
                      'Add university'
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
