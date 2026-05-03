import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Lock } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { authApi } from '../../api/auth';
import { getApiErrorMessage } from '../../utils/apiError';
import { AuthCard } from '../../components/auth/AuthCard';
import { PasswordField } from '../../components/auth/PasswordField';
import { PrimaryButton } from '../../components/auth/PrimaryButton';
import { FormErrorBanner } from '../../components/auth/FormErrorBanner';

const MIN_PASSWORD = 8;

const FORM_VARIANTS = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.2 },
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

type FieldErrors = Partial<Record<'password' | 'confirmPassword', string>>;

/**
 * Three states:
 *   1. No token in URL → render an "invalid link" card with a path to
 *      request a fresh reset email.
 *   2. Token present, form not yet submitted successfully → render the
 *      new-password form with inline validation (min 8 chars, must match
 *      confirm) and backend error surfacing via FormErrorBanner.
 *   3. Backend accepted the reset → render a success card with a sky-blue
 *      link to sign in.
 */
export default function ResetPasswordPage() {
  useDocumentTitle('Reset password');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const hasToken = typeof token === 'string' && token.trim().length > 0;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function setPasswordField(value: string) {
    setPassword(value);
    if (fieldErrors.password) {
      setFieldErrors((prev) => ({ ...prev, password: undefined }));
    }
  }

  function setConfirmField(value: string) {
    setConfirmPassword(value);
    if (fieldErrors.confirmPassword) {
      setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !hasToken) return;

    const errors: FieldErrors = {};
    if (!password) errors.password = 'Required';
    else if (password.length < MIN_PASSWORD)
      errors.password = `Must be at least ${MIN_PASSWORD} characters`;
    if (!confirmPassword) errors.confirmPassword = 'Required';
    else if (password && confirmPassword !== password)
      errors.confirmPassword = 'Passwords do not match';

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitError(null);
    setSubmitting(true);
    try {
      await authApi.resetPassword({
        token: (token as string).trim(),
        newPassword: password,
      });
      setDone(true);
    } catch (err) {
      setSubmitError(
        getApiErrorMessage(err, 'Unable to reset password. Please try again.'),
      );
      setSubmitting(false);
    }
  }

  // State 1 — no / empty token
  if (!hasToken) {
    return (
      <AuthCard
        title="Invalid reset link"
        subtitle="This password reset link is invalid or has expired. Please request a new one."
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <Link
            to="/forgot-password"
            className="inline-flex h-[40.67px] w-full items-center justify-center gap-2 border-[0.91px] border-lrfap-navy bg-lrfap-navy font-sans text-[15px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
          >
            Request a new link
          </Link>
        </motion.div>
      </AuthCard>
    );
  }

  // State 3 — reset accepted
  if (done) {
    return (
      <AuthCard
        title="Password reset"
        subtitle="Your password has been successfully updated."
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex flex-col items-center gap-[18px] py-[8px]"
        >
          <CheckCircle
            aria-hidden="true"
            className="h-[56px] w-[56px] text-lrfap-sky"
            strokeWidth={1.5}
          />
          <Link
            to="/login"
            className="font-sans text-[15px] font-medium text-lrfap-sky underline-offset-4 hover:underline"
          >
            Sign in now
          </Link>
        </motion.div>
      </AuthCard>
    );
  }

  // State 2 — form
  return (
    <AuthCard
      title="Reset password"
      subtitle="Choose a new password for your account."
      footer={
        <span>
          Remember your password?{' '}
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
          <motion.div variants={CHILD_VARIANTS} className="flex flex-col gap-[8px]">
            <FormErrorBanner message={submitError} />
            <Link
              to="/forgot-password"
              className="self-start font-sans text-[13px] text-lrfap-sky underline-offset-4 hover:underline"
            >
              Request a new link
            </Link>
          </motion.div>
        ) : null}

        <motion.div variants={CHILD_VARIANTS}>
          <PasswordField
            id="reset-password"
            name="password"
            label="New Password"
            autoComplete="new-password"
            required
            hideRequiredMarker
            autoFocus
            value={password}
            onChange={(e) => setPasswordField(e.target.value)}
            placeholder="Enter your new password"
            icon={<Lock className="h-[18px] w-[18px]" />}
            error={fieldErrors.password}
          />
        </motion.div>

        <motion.div variants={CHILD_VARIANTS}>
          <PasswordField
            id="reset-confirmPassword"
            name="confirmPassword"
            label="Confirm New Password"
            autoComplete="new-password"
            required
            hideRequiredMarker
            value={confirmPassword}
            onChange={(e) => setConfirmField(e.target.value)}
            placeholder="Re-enter your new password"
            icon={<Lock className="h-[18px] w-[18px]" />}
            error={fieldErrors.confirmPassword}
          />
        </motion.div>

        <motion.div variants={CHILD_VARIANTS}>
          <PrimaryButton loading={submitting} loadingLabel="Resetting…">
            Reset password
          </PrimaryButton>
        </motion.div>
      </motion.form>
    </AuthCard>
  );
}
