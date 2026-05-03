import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Dashboard widget showing how complete the applicant's profile is.
 * Caller should not render this when `value >= 100`; the component
 * doesn't hide itself so the parent controls the layout gap.
 */

interface ProfileCompletionBarProps {
  value: number;
}

export function ProfileCompletionBar({ value }: ProfileCompletionBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <section
      aria-labelledby="dashboard-profile-completion-heading"
      className="border-[0.91px] border-lrfap-ghost bg-white p-[24px] shadow-[0_4px_12px_rgba(38,43,102,0.08)]"
    >
      <div className="flex flex-col gap-[12px] md:flex-row md:items-center md:justify-between md:gap-[24px]">
        <div className="min-w-0 flex-1">
          <h2
            id="dashboard-profile-completion-heading"
            className="font-display text-[16px] font-bold uppercase tracking-wide text-lrfap-navy"
          >
            Your profile is {clamped}% complete
          </h2>
          <p className="mt-[6px] font-sans text-[13px] text-slate-600">
            Complete your profile to strengthen your application.
          </p>
        </div>
        <Link
          to="/applicant/profile"
          className="inline-flex h-[40px] shrink-0 items-center justify-center gap-[6px] font-sans text-[13px] font-semibold uppercase tracking-wide text-lrfap-sky underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
        >
          Complete Profile
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Profile completion"
        className="mt-[16px] h-[10px] w-full overflow-hidden border-[0.91px] border-lrfap-ghost bg-lrfap-ghost/40"
      >
        <div
          className="h-full bg-lrfap-sky transition-[width] duration-500 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </section>
  );
}
