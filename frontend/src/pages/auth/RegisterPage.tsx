import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Lock, Mail, User } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuth } from '../../hooks/useAuth';
import { getApiErrorMessage } from '../../utils/apiError';
import { AuthCard } from '../../components/auth/AuthCard';
import { FormField } from '../../components/auth/FormField';
import { PasswordField } from '../../components/auth/PasswordField';
import { PrimaryButton } from '../../components/auth/PrimaryButton';
import { FormErrorBanner } from '../../components/auth/FormErrorBanner';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

const FORM_VARIANTS = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.2 },
  },
};

const CHILD_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' as const },
  },
};

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

const INITIAL: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  acceptedTerms: false,
};

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.firstName.trim()) errors.firstName = 'Required';
  if (!form.lastName.trim()) errors.lastName = 'Required';
  if (!form.email.trim()) errors.email = 'Required';
  else if (!EMAIL_RE.test(form.email.trim()))
    errors.email = 'Enter a valid email address';
  if (!form.password) errors.password = 'Required';
  else if (form.password.length < MIN_PASSWORD)
    errors.password = `Must be at least ${MIN_PASSWORD} characters`;
  if (!form.confirmPassword) errors.confirmPassword = 'Required';
  else if (form.password && form.confirmPassword !== form.password)
    errors.confirmPassword = 'Passwords do not match';
  if (!form.acceptedTerms)
    errors.acceptedTerms =
      'You must accept the Terms & Conditions to continue.';
  return errors;
}

export default function RegisterPage() {
  useDocumentTitle('Create account');
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(INITIAL);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setField<K extends keyof FormState>(name: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear a field's error as soon as the user edits it — submit-time
    // validation will re-run and re-surface any problem that remains.
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitError(null);
    setSubmitting(true);
    try {
      await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      navigate('/applicant', { replace: true });
    } catch (err) {
      setSubmitError(
        getApiErrorMessage(err, 'Unable to create account. Please try again.'),
      );
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Create account"
      subtitle="Fill in your details to get started."
      footer={
        <span>
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-lrfap-sky underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </span>
      }
    >
      <motion.form
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-[16px]"
        initial="hidden"
        animate="visible"
        variants={FORM_VARIANTS}
      >
        {submitError ? (
          <motion.div variants={CHILD_VARIANTS}>
            <FormErrorBanner message={submitError} />
          </motion.div>
        ) : null}

        <motion.div variants={CHILD_VARIANTS}>
          <FormField
            id="register-firstName"
            name="firstName"
            label="First Name"
            type="text"
            autoComplete="given-name"
            required
            hideRequiredMarker
            autoFocus
            value={form.firstName}
            onChange={(e) => setField('firstName', e.target.value)}
            placeholder="Enter your first name"
            icon={<User className="h-[18px] w-[18px]" />}
            error={fieldErrors.firstName}
          />
        </motion.div>

        <motion.div variants={CHILD_VARIANTS}>
          <FormField
            id="register-lastName"
            name="lastName"
            label="Last Name"
            type="text"
            autoComplete="family-name"
            required
            hideRequiredMarker
            value={form.lastName}
            onChange={(e) => setField('lastName', e.target.value)}
            placeholder="Enter your last name"
            icon={<User className="h-[18px] w-[18px]" />}
            error={fieldErrors.lastName}
          />
        </motion.div>

        <motion.div variants={CHILD_VARIANTS}>
          <FormField
            id="register-email"
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            required
            hideRequiredMarker
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            placeholder="Enter your email"
            icon={<Mail className="h-[18px] w-[18px]" />}
            error={fieldErrors.email}
          />
        </motion.div>

        <motion.div variants={CHILD_VARIANTS}>
          <PasswordField
            id="register-password"
            name="password"
            label="Password"
            autoComplete="new-password"
            required
            hideRequiredMarker
            value={form.password}
            onChange={(e) => setField('password', e.target.value)}
            placeholder="Create a password"
            icon={<Lock className="h-[18px] w-[18px]" />}
            error={fieldErrors.password}
          />
        </motion.div>

        <motion.div variants={CHILD_VARIANTS}>
          <PasswordField
            id="register-confirmPassword"
            name="confirmPassword"
            label="Confirm Password"
            autoComplete="new-password"
            required
            hideRequiredMarker
            value={form.confirmPassword}
            onChange={(e) => setField('confirmPassword', e.target.value)}
            placeholder="Re-enter your password"
            icon={<Lock className="h-[18px] w-[18px]" />}
            error={fieldErrors.confirmPassword}
          />
        </motion.div>

        <motion.div variants={CHILD_VARIANTS}>
          <label className="flex cursor-pointer items-start gap-[10px]">
            <input
              type="checkbox"
              checked={form.acceptedTerms}
              onChange={(e) => setField('acceptedTerms', e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className={`mt-[1px] inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center border-[0.91px] border-lrfap-navy peer-focus-visible:ring-2 peer-focus-visible:ring-lrfap-sky/60 ${
                form.acceptedTerms ? 'bg-lrfap-navy' : 'bg-white'
              }`}
            >
              {form.acceptedTerms ? (
                <Check
                  aria-hidden="true"
                  className="h-3 w-3 text-white"
                  strokeWidth={3}
                />
              ) : null}
            </span>
            <span className="font-sans text-[12px] leading-[1.4] text-lrfap-navy">
              I have read and agree to the{' '}
              <Link
                to="/terms"
                onClick={(e) => e.stopPropagation()}
                className="font-medium whitespace-nowrap text-lrfap-sky underline-offset-4 hover:underline"
              >
                Terms &amp; Conditions
              </Link>
            </span>
          </label>
          {fieldErrors.acceptedTerms ? (
            <p className="mt-[6px] font-sans text-[12px] text-red-600">
              {fieldErrors.acceptedTerms}
            </p>
          ) : null}
        </motion.div>

        <motion.div variants={CHILD_VARIANTS}>
          <PrimaryButton
            loading={submitting}
            loadingLabel="Creating account…"
            disabled={!form.acceptedTerms}
          >
            Create account
          </PrimaryButton>
        </motion.div>
      </motion.form>
    </AuthCard>
  );
}
