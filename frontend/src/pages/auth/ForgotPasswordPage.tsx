import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, MailCheck } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { authApi } from '../../api/auth';
import { getApiErrorMessage } from '../../utils/apiError';
import { AuthCard } from '../../components/auth/AuthCard';
import { FormField } from '../../components/auth/FormField';
import { PrimaryButton } from '../../components/auth/PrimaryButton';
import { FormErrorBanner } from '../../components/auth/FormErrorBanner';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export default function ForgotPasswordPage() {
  useDocumentTitle('Forgot password');

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  function handleEmailChange(value: string) {
    setEmail(value);
    if (emailError) setEmailError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError('Required');
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError('Enter a valid email address');
      return;
    }

    setSubmitError(null);
    setSubmitting(true);
    try {
      // Backend is enumeration-safe: it always returns 200 whether the
      // address is on file or not, so this `await` resolving tells us only
      // that the request was accepted.
      await authApi.forgotPassword({ email: trimmed });
      setSent(true);
    } catch (err) {
      setSubmitError(
        getApiErrorMessage(err, 'Unable to send reset link. Please try again.'),
      );
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthCard
        title="Check your email"
        subtitle="If an account with that email exists, a password reset link has been sent."
        footer={
          <span>
            Back to{' '}
            <Link
              to="/login"
              className="font-medium text-lrfap-sky underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </span>
        }
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex flex-col items-center gap-[16px] py-[8px]"
        >
          <MailCheck
            aria-hidden="true"
            className="h-[56px] w-[56px] text-lrfap-sky"
            strokeWidth={1.5}
          />
          <p className="text-center font-sans text-[13px] leading-relaxed text-slate-500">
            If you don&apos;t see it within a few minutes, check your spam
            folder or try again.
          </p>
        </motion.div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot password"
      subtitle="Enter your email and we'll send you a link to reset it."
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
          <motion.div variants={CHILD_VARIANTS}>
            <FormErrorBanner message={submitError} />
          </motion.div>
        ) : null}

        <motion.div variants={CHILD_VARIANTS}>
          <FormField
            id="forgot-email"
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            required
            hideRequiredMarker
            autoFocus
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder="Enter your email"
            icon={<Mail className="h-[18px] w-[18px]" />}
            error={emailError ?? undefined}
          />
        </motion.div>

        <motion.div variants={CHILD_VARIANTS}>
          <PrimaryButton loading={submitting} loadingLabel="Sending…">
            Send reset link
          </PrimaryButton>
        </motion.div>
      </motion.form>
    </AuthCard>
  );
}
