import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Mail } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuth } from '../../hooks/useAuth';
import { getApiErrorMessage } from '../../utils/apiError';
import type { UserRole } from '../../types';
import { AuthCard } from '../../components/auth/AuthCard';
import { FormField } from '../../components/auth/FormField';
import { PasswordField } from '../../components/auth/PasswordField';
import { PrimaryButton } from '../../components/auth/PrimaryButton';
import { FormErrorBanner } from '../../components/auth/FormErrorBanner';

const ROLE_HOME: Record<UserRole, string> = {
  applicant: '/applicant',
  university: '/university',
  lgc: '/lgc',
};

// Form-level stagger: each child fades up with 0.08 s between them, starting
// 0.2 s after the card begins animating. Matches the choreography on the
// landing page hero.
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

export default function LoginPage() {
  useDocumentTitle('Sign in');
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      navigate(ROLE_HOME[user.role], { replace: true });
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, 'Unable to sign in. Please try again.'));
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Sign in"
      subtitle="Enter your credentials to continue."
      footer={
        <span>
          New to LRFAP?{' '}
          <Link
            to="/register"
            className="font-medium text-lrfap-sky underline-offset-4 hover:underline"
          >
            Create an account
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
            id="login-email"
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            required
            hideRequiredMarker
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            icon={<Mail className="h-[18px] w-[18px]" />}
          />
        </motion.div>

        <motion.div variants={CHILD_VARIANTS}>
          <PasswordField
            id="login-password"
            name="password"
            label="Password"
            autoComplete="current-password"
            required
            hideRequiredMarker
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            icon={<Lock className="h-[18px] w-[18px]" />}
          />
        </motion.div>

        <motion.div variants={CHILD_VARIANTS} className="-mt-[6px] flex justify-end">
          <Link
            to="/forgot-password"
            className="font-sans text-[13px] text-lrfap-sky underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </motion.div>

        <motion.div variants={CHILD_VARIANTS}>
          <PrimaryButton loading={submitting} loadingLabel="Signing in…">
            Sign in
          </PrimaryButton>
        </motion.div>
      </motion.form>
    </AuthCard>
  );
}
