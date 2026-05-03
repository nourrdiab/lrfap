import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Loader2, X } from 'lucide-react';
import axios from 'axios';
import { authApi } from '../../../api/auth';
import { universitiesApi } from '../../../api/universities';
import { getApiErrorMessage } from '../../../utils/apiError';
import type { University, User } from '../../../types';

/**
 * Create User modal — LGC only. Backs `POST /auth/users`, which accepts
 * role ∈ {university, lgc}. Applicants self-register through a
 * different flow, so that role is intentionally absent here.
 *
 * University select is conditionally required: when role=university the
 * backend rejects a payload without a `university` id. When role=lgc
 * the field is omitted. Universities are fetched on first open only.
 *
 * 409 from the backend (duplicate email) surfaces inline on the email
 * field, not the generic error slot, because it's the actionable case.
 */

type Role = 'university' | 'lgc';

interface CreateUserModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: (created: User) => void;
}

interface FormState {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  university: string;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

const INITIAL_STATE: FormState = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  role: 'university',
  university: '',
};

function validate(state: FormState): FieldErrors {
  const errors: FieldErrors = {};
  const email = state.email.trim();
  if (!email) errors.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = 'Enter a valid email address.';

  if (!state.password) errors.password = 'Password is required.';
  else if (state.password.length < 8)
    errors.password = 'Password must be at least 8 characters.';

  if (!state.firstName.trim()) errors.firstName = 'First name is required.';
  else if (state.firstName.trim().length > 50)
    errors.firstName = 'Keep first name under 50 characters.';

  if (!state.lastName.trim()) errors.lastName = 'Last name is required.';
  else if (state.lastName.trim().length > 50)
    errors.lastName = 'Keep last name under 50 characters.';

  if (state.role === 'university' && !state.university)
    errors.university = 'Pick a university.';

  return errors;
}

export function CreateUserModal({
  open,
  onCancel,
  onSuccess,
}: CreateUserModalProps) {
  const [state, setState] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const [universities, setUniversities] = useState<University[]>([]);
  const [universitiesStatus, setUniversitiesStatus] = useState<
    'idle' | 'loading' | 'loaded' | 'error'
  >('idle');
  const [universitiesError, setUniversitiesError] = useState<string | null>(
    null,
  );

  const emailRef = useRef<HTMLInputElement | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  // Re-seed on open; don't clobber while closed (animation out).
  useEffect(() => {
    if (open) {
      setState(INITIAL_STATE);
      setErrors({});
      setSubmitAttempted(false);
      setGeneralError(null);
    }
  }, [open]);

  // Fetch universities the first time the modal opens — cache across re-opens.
  useEffect(() => {
    if (!open) return;
    if (universitiesStatus !== 'idle') return;
    setUniversitiesStatus('loading');
    setUniversitiesError(null);
    universitiesApi
      .list()
      .then((rows) => {
        const active = rows
          .filter((u) => u.isActive !== false)
          .sort((a, b) => a.name.localeCompare(b.name));
        setUniversities(active);
        setUniversitiesStatus('loaded');
      })
      .catch((err) => {
        setUniversitiesError(
          getApiErrorMessage(err, 'Couldn’t load universities.'),
        );
        setUniversitiesStatus('error');
      });
  }, [open, universitiesStatus]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    emailRef.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) {
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
  }, [open, saving, onCancel]);

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

  // If role flips away from university, drop any stale university id so the
  // payload stays tidy and the field error clears.
  function handleRoleChange(role: Role) {
    setState((s) => ({
      ...s,
      role,
      university: role === 'university' ? s.university : '',
    }));
    if (submitAttempted) {
      setErrors((e) => {
        const next = { ...e };
        delete next.university;
        return next;
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSubmitAttempted(true);
    setGeneralError(null);
    const v = validate(state);
    if (Object.keys(v).length > 0) {
      setErrors(v);
      return;
    }

    setSaving(true);
    try {
      const created = await authApi.createUser({
        email: state.email.trim(),
        password: state.password,
        firstName: state.firstName.trim(),
        lastName: state.lastName.trim(),
        role: state.role,
        university:
          state.role === 'university' ? state.university : undefined,
      });
      onSuccess(created);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setErrors((prev) => ({
          ...prev,
          email: 'An account with this email already exists.',
        }));
      } else {
        setGeneralError(getApiErrorMessage(err, 'Couldn’t create this user.'));
      }
    } finally {
      setSaving(false);
    }
  }

  const universityFieldVisible = state.role === 'university';

  const universityHint = useMemo(() => {
    if (!universityFieldVisible) return null;
    if (universitiesStatus === 'loading') return 'Loading universities…';
    if (universitiesStatus === 'error')
      return universitiesError ?? 'Couldn’t load universities.';
    if (universitiesStatus === 'loaded' && universities.length === 0)
      return 'No universities found — create one in the catalog first.';
    return null;
  }, [universityFieldVisible, universitiesStatus, universitiesError, universities.length]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="create-user-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={saving ? undefined : onCancel}
          className="fixed inset-0 z-40 bg-black/40"
        >
          <div className="flex min-h-full items-center justify-center p-6">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-user-title"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[560px] border-[0.91px] border-lrfap-ghost bg-white shadow-[0_10px_40px_-12px_rgba(38,43,102,0.25)]"
            >
              <form onSubmit={handleSubmit} noValidate>
                <div className="flex items-start justify-between gap-[16px] px-[28px] pt-[24px] pb-[12px]">
                  <div className="min-w-0">
                    <h2
                      id="create-user-title"
                      className="font-display text-[20px] font-bold uppercase tracking-wide text-lrfap-navy"
                    >
                      Create user
                    </h2>
                    <p className="mt-[4px] font-sans text-[12px] text-slate-500">
                      Provisions a University or LGC account. Applicants
                      register themselves.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={saving}
                    aria-label="Close"
                    className="inline-flex h-[32px] w-[32px] shrink-0 items-center justify-center text-slate-500 hover:text-lrfap-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <X aria-hidden="true" className="h-5 w-5" />
                  </button>
                </div>

                <div className="max-h-[70vh] overflow-y-auto px-[28px] pb-[20px]">
                  <div className="grid grid-cols-1 gap-[14px]">
                    <TextInput
                      id="create-user-email"
                      label="Email"
                      type="email"
                      value={state.email}
                      onChange={(v) => update('email', v)}
                      required
                      disabled={saving}
                      error={errors.email}
                      inputRef={emailRef}
                      autoComplete="off"
                      placeholder="name@example.com"
                    />
                    <TextInput
                      id="create-user-password"
                      label="Password"
                      type="password"
                      value={state.password}
                      onChange={(v) => update('password', v)}
                      required
                      disabled={saving}
                      error={errors.password}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                    />
                    <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
                      <TextInput
                        id="create-user-first"
                        label="First name"
                        value={state.firstName}
                        onChange={(v) => update('firstName', v)}
                        required
                        disabled={saving}
                        error={errors.firstName}
                        maxLength={50}
                      />
                      <TextInput
                        id="create-user-last"
                        label="Last name"
                        value={state.lastName}
                        onChange={(v) => update('lastName', v)}
                        required
                        disabled={saving}
                        error={errors.lastName}
                        maxLength={50}
                      />
                    </div>

                    <fieldset className="flex flex-col gap-[6px]">
                      <legend className="font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy">
                        Role
                        <span aria-hidden="true" className="ml-1 text-lrfap-sky">
                          *
                        </span>
                      </legend>
                      <div className="inline-flex border-[0.91px] border-lrfap-ghost">
                        <SegmentButton
                          active={state.role === 'university'}
                          onClick={() => handleRoleChange('university')}
                          disabled={saving}
                        >
                          University
                        </SegmentButton>
                        <SegmentButton
                          active={state.role === 'lgc'}
                          onClick={() => handleRoleChange('lgc')}
                          disabled={saving}
                        >
                          LGC
                        </SegmentButton>
                      </div>
                    </fieldset>

                    {universityFieldVisible ? (
                      <div className="flex flex-col gap-[6px]">
                        <label
                          htmlFor="create-user-university"
                          className="font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy"
                        >
                          University
                          <span
                            aria-hidden="true"
                            className="ml-1 text-lrfap-sky"
                          >
                            *
                          </span>
                        </label>
                        <select
                          id="create-user-university"
                          value={state.university}
                          onChange={(e) =>
                            update('university', e.target.value)
                          }
                          disabled={
                            saving ||
                            universitiesStatus === 'loading' ||
                            universitiesStatus === 'error'
                          }
                          aria-invalid={errors.university ? 'true' : undefined}
                          aria-describedby={
                            errors.university
                              ? 'create-user-university-error'
                              : undefined
                          }
                          className={`h-[40.67px] w-full border-2 bg-white px-[12px] font-sans text-[15px] text-slate-900 transition-colors duration-150 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${
                            errors.university
                              ? 'border-red-500'
                              : 'border-lrfap-ghost hover:border-slate-300 focus-within:border-lrfap-sky'
                          }`}
                        >
                          <option value="">Select a university…</option>
                          {universities.map((u) => (
                            <option key={u._id} value={u._id}>
                              {u.name}
                              {u.code ? ` (${u.code})` : ''}
                            </option>
                          ))}
                        </select>
                        {errors.university ? (
                          <p
                            id="create-user-university-error"
                            className="font-sans text-[12px] font-medium text-red-600"
                          >
                            {errors.university}
                          </p>
                        ) : universityHint ? (
                          <p className="font-sans text-[12px] text-slate-500">
                            {universityHint}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {generalError ? (
                    <p
                      role="alert"
                      className="mt-[16px] flex items-start gap-[8px] font-sans text-[13px] text-red-700"
                    >
                      <AlertCircle
                        aria-hidden="true"
                        className="mt-[2px] h-4 w-4 shrink-0"
                      />
                      <span>{generalError}</span>
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center justify-end gap-[12px] border-t border-lrfap-ghost bg-lrfap-ghost/30 px-[28px] py-[16px]">
                  <button
                    ref={cancelBtnRef}
                    type="button"
                    disabled={saving}
                    onClick={onCancel}
                    className="inline-flex h-[40px] items-center justify-center border-[0.91px] border-lrfap-navy px-[18px] font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-[40px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[22px] font-sans text-[13px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? (
                      <>
                        <Loader2
                          aria-hidden="true"
                          className="h-4 w-4 animate-spin"
                        />
                        Creating…
                      </>
                    ) : (
                      'Create user'
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

interface SegmentButtonProps {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

function SegmentButton({
  active,
  onClick,
  disabled,
  children,
}: SegmentButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`h-[36px] min-w-[104px] px-[16px] font-sans text-[12px] font-medium uppercase tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? 'bg-lrfap-navy text-white'
          : 'bg-white text-lrfap-navy hover:bg-lrfap-navy/5'
      }`}
    >
      {children}
    </button>
  );
}

interface TextInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'email' | 'password';
  required?: boolean;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  maxLength?: number;
  autoComplete?: string;
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
  maxLength,
  autoComplete,
  inputRef,
}: TextInputProps) {
  const errorId = `${id}-error`;
  const borderClasses = error
    ? 'border-red-500'
    : 'border-lrfap-ghost hover:border-slate-300 focus-within:border-lrfap-sky';
  return (
    <div className="flex flex-col gap-[6px]">
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
        maxLength={maxLength}
        autoComplete={autoComplete}
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
