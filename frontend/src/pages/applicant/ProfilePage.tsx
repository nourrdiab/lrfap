import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { applicationsApi } from '../../api/applications';
import { ProfileForm } from '../../components/applicant/profile/ProfileForm';
import type { Application } from '../../types';

/**
 * /applicant/profile — single-column view of the applicant's reusable
 * profile.
 *
 * Lock policy: once the applicant has any application with a status
 * other than 'draft' (submitted, under_review, matched, unmatched,
 * withdrawn), the profile becomes read-only to preserve the integrity
 * of what the LGC and universities have already reviewed. Backend will
 * enforce the same rule server-side — this UI layer prevents accidental
 * edits and sets expectations.
 */

type FetchStatus = 'idle' | 'loading' | 'loaded' | 'error';

// Placeholder until the real mailbox lands. Kept here as a single
// constant so swapping it later is a one-line change.
const LGC_SUPPORT_EMAIL = 'support@lrfap.lb';

export default function ApplicantProfilePage() {
  useDocumentTitle('Profile');

  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationsStatus, setApplicationsStatus] =
    useState<FetchStatus>('idle');

  useEffect(() => {
    let cancelled = false;
    setApplicationsStatus('loading');
    applicationsApi
      .list()
      .then((res) => {
        if (cancelled) return;
        setApplications(res);
        setApplicationsStatus('loaded');
      })
      .catch(() => {
        // A failure here shouldn't block profile rendering — we fall
        // through as "unlocked". Backend is the authoritative lock.
        if (!cancelled) setApplicationsStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Conservative: only commit to "locked" once we have a successful
  // fetch. If the applications fetch failed, render unlocked — the
  // backend still rejects an unauthorized save so data integrity is
  // preserved either way.
  const isLocked =
    applicationsStatus === 'loaded' &&
    applications.some((a) => a.status !== 'draft');

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-[40px] md:px-8">
      <header className="mb-[24px]">
        <h1 className="font-display text-[36px] font-extrabold leading-[1.1] text-lrfap-navy md:text-[40px]">
          PROFILE
        </h1>
        <p className="mt-[8px] font-sans text-[14px] text-slate-600">
          Your reusable applicant profile. Complete it once — every
          application you start pulls from this record.
        </p>
      </header>

      {isLocked ? (
        <div
          role="status"
          className="mb-[24px] flex items-start gap-[12px] border-[0.91px] border-amber-200 bg-amber-50 px-[18px] py-[14px] text-amber-900"
        >
          <Lock aria-hidden="true" className="mt-[2px] h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-sans text-[14px] font-semibold">
              Profile locked
            </p>
            <p className="mt-[4px] font-sans text-[13px] leading-relaxed">
              You have a submitted application. Your profile cannot be
              modified after submission to preserve application integrity.
              To update contact information, please email the LGC at{' '}
              <a
                href={`mailto:${LGC_SUPPORT_EMAIL}`}
                className="font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950"
              >
                {LGC_SUPPORT_EMAIL}
              </a>
              .
            </p>
          </div>
        </div>
      ) : null}

      <ProfileForm locked={isLocked} />
    </div>
  );
}
