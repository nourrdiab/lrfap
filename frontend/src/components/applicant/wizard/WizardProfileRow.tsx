import { Link } from 'react-router-dom';
import { useWizard } from './WizardContext';

/**
 * Quick-read row of the applicant's core profile fields: FULL NAME,
 * APPLICANT ID, DATE OF BIRTH. The EDIT button navigates to
 * /applicant/profile (the standalone Profile & Documents page), NOT
 * back to step 1 — profile management is orthogonal to application
 * creation, per earlier architecture decision.
 */
export function WizardProfileRow() {
  const { profileSummary } = useWizard();
  return (
    <section className="mx-auto w-full max-w-[1366px] px-6 md:px-[58px]">
      <div className="flex flex-col gap-[16px] border-b border-lrfap-ghost py-[24px] md:flex-row md:items-center md:justify-between md:gap-[32px]">
        <dl className="grid grid-cols-1 gap-[16px] sm:grid-cols-2 md:flex md:flex-wrap md:items-start md:gap-[64px]">
          <ProfileCell label="Full Name" value={profileSummary.fullName} />
          <ProfileCell label="Applicant ID" value={profileSummary.applicantId} />
          <ProfileCell label="Date of Birth" value={profileSummary.dob} />
        </dl>

        <Link
          to="/applicant/profile"
          className="inline-flex h-[40.67px] shrink-0 items-center justify-center border-[0.91px] border-lrfap-navy px-[22px] font-sans text-[14px] font-normal uppercase tracking-wide text-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy"
        >
          Edit
        </Link>
      </div>
    </section>
  );
}

function ProfileCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-sans text-[13px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-[4px] font-sans text-[15px] font-semibold text-lrfap-navy">
        {value || '—'}
      </dd>
    </div>
  );
}
