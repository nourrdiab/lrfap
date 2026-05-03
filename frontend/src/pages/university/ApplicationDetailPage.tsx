import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Loader2,
  Mail,
  User as UserIcon,
} from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { universityReviewApi } from '../../api/universityReview';
import { documentsApi } from '../../api/documents';
import { DocumentsList } from '../../components/applicant/applicationView/DocumentsList';
import type {
  ApplicantLanguages,
  ApplicantProfile,
  Application,
  ApplicationDocument,
  ApplicationReviewState,
  Cycle,
  ID,
  LanguageCode,
  LanguageLevel,
  Program,
  Specialty,
  University,
  User,
} from '../../types';

/**
 * University-side read-only view of a submitted application. Reachable
 * from the per-program applicants table via
 *   /university/applications/:applicationId?program=:programId
 *
 * The `program` query param anchors the reviewer: the matching row in
 * the Selected Programs list gets a sky-blue left border + "Your program"
 * pill, and the Back link returns to the source program. Without the
 * query param the page still works — no highlight, and Back falls back
 * to the Dashboard.
 *
 * Auth: universityReviewApi.getApplication is gated server-side to
 * universities whose program appears in this application's selections.
 * 403 / 404 redirect to the Dashboard (best fallback — we can't always
 * know which program they came from if the URL was hand-typed).
 *
 * Reuses SelectedProgramsList and DocumentsList from the applicant
 * applicationView bundle — both are already role-agnostic read-only
 * components.
 */

type FetchStatus = 'idle' | 'loading' | 'loaded' | 'error' | 'not-found';

function isValidObjectId(id: string | undefined): id is string {
  return !!id && /^[0-9a-fA-F]{24}$/.test(id);
}

function populated<T extends { _id: ID }>(
  ref: ID | T | null | undefined,
): T | null {
  if (!ref || typeof ref === 'string') return null;
  return ref;
}

function formatSubmittedAt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const GENDER_LABEL: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
};

const LANGUAGE_LABEL: Record<LanguageCode, string> = {
  english: 'English',
  french: 'French',
  arabic: 'Arabic',
};

const LANGUAGE_LEVEL_LABEL: Record<LanguageLevel, string> = {
  none: 'None',
  basic: 'Basic',
  intermediate: 'Intermediate',
  fluent: 'Fluent',
  native: 'Native',
};

function medicalSchoolName(profile: ApplicantProfile): string | null {
  if (profile.medicalSchool && typeof profile.medicalSchool === 'object') {
    return (profile.medicalSchool as University).name ?? null;
  }
  if (profile.medicalSchoolOther?.trim()) {
    return profile.medicalSchoolOther.trim();
  }
  return null;
}

function spokenLanguages(
  langs: ApplicantLanguages | undefined,
): Array<{ code: LanguageCode; level: LanguageLevel }> {
  if (!langs) return [];
  const codes: LanguageCode[] = ['english', 'french', 'arabic'];
  return codes
    .map((code) => ({ code, level: langs[code] ?? 'none' }))
    .filter((entry) => entry.level !== 'none');
}

interface StatusPresentation {
  label: string;
  badgeCls: string;
}

const REVIEW_STATE_PRESENTATION: Record<ApplicationReviewState, StatusPresentation> = {
  new: { label: 'New', badgeCls: 'bg-slate-50 text-slate-700 border-slate-200' },
  under_review: {
    label: 'Under Review',
    badgeCls: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  reviewed: {
    label: 'Reviewed',
    badgeCls: 'bg-green-50 text-green-700 border-green-200',
  },
  matched: {
    label: 'Matched',
    badgeCls: 'bg-lrfap-navy/5 text-lrfap-navy border-lrfap-navy/40',
  },
};

function applicantName(applicant: ID | User): string {
  if (typeof applicant === 'string') return 'Applicant';
  const parts = [applicant.firstName, applicant.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : (applicant.email ?? 'Applicant');
}

function applicantEmail(applicant: ID | User): string | null {
  if (typeof applicant === 'string') return null;
  return applicant.email ?? null;
}

export default function UniversityApplicationDetailPage() {
  useDocumentTitle('Applicant review');
  const { applicationId } = useParams<{ applicationId: string }>();
  const [searchParams] = useSearchParams();
  const sourceProgramId = searchParams.get('program');

  const [application, setApplication] = useState<Application | null>(null);
  const [appStatus, setAppStatus] = useState<FetchStatus>('idle');
  const [documents, setDocuments] = useState<ApplicationDocument[]>([]);
  const [docsStatus, setDocsStatus] = useState<FetchStatus>('idle');
  const [reviewState, setReviewState] = useState<ApplicationReviewState>('new');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const validId = isValidObjectId(applicationId);

  useEffect(() => {
    if (!validId || !applicationId) return;
    let cancelled = false;
    setAppStatus('loading');
    universityReviewApi
      .getApplication(applicationId)
      .then((res) => {
        if (cancelled) return;
        setApplication(res);
        setReviewState(res.reviewState ?? 'new');
        setAppStatus('loaded');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404 || status === 403) {
          setAppStatus('not-found');
          return;
        }
        setAppStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, validId]);

  useEffect(() => {
    if (!validId || !applicationId) return;
    let cancelled = false;
    setDocsStatus('loading');
    documentsApi
      .listForApplication(applicationId)
      .then((res) => {
        if (cancelled) return;
        setDocuments(res);
        setDocsStatus('loaded');
      })
      .catch(() => {
        if (!cancelled) setDocsStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, validId]);

  // Find the source program's display name for the Back link. Populated
  // on getApplication via selections.program; we filter to the selection
  // that matches ?program= so we can render its specialty name.
  const sourceProgram = useMemo<Program | null>(() => {
    if (!sourceProgramId || !application) return null;
    for (const s of application.selections) {
      const prog = populated<Program>(s.program);
      if (prog && prog._id === sourceProgramId) return prog;
    }
    return null;
  }, [application, sourceProgramId]);

  const statePresentation = REVIEW_STATE_PRESENTATION[reviewState];

  const handleBeginReview = useCallback(async () => {
    if (!applicationId) return;
    setReviewBusy(true);
    setReviewError(null);
    try {
      const res = await universityReviewApi.beginReview(applicationId);
      setReviewState(res.state);
    } catch {
      setReviewError("Couldn't update review state. Try again.");
    } finally {
      setReviewBusy(false);
    }
  }, [applicationId]);

  const handleMarkReviewed = useCallback(async () => {
    if (!applicationId) return;
    setReviewBusy(true);
    setReviewError(null);
    try {
      const res = await universityReviewApi.markReviewed(applicationId);
      setReviewState(res.state);
    } catch {
      setReviewError("Couldn't update review state. Try again.");
    } finally {
      setReviewBusy(false);
    }
  }, [applicationId]);

  const matchedProgram = populated<Program>(application?.matchedProgram ?? null);
  const matchedUni = matchedProgram ? populated<University>(matchedProgram.university) : null;
  const matchedSpec = matchedProgram ? populated<Specialty>(matchedProgram.specialty) : null;
  const cycle = application ? populated<Cycle>(application.cycle) : null;

  if (!validId) {
    return <Navigate to="/university" replace />;
  }

  if (appStatus === 'not-found') {
    return <Navigate to="/university" replace />;
  }

  if (appStatus === 'loading' || appStatus === 'idle') {
    return (
      <PageShell>
        <div className="h-[24px] w-[180px] animate-pulse bg-slate-100" />
        <div className="h-[80px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50" />
        <div className="h-[200px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50" />
        <div className="h-[420px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50" />
      </PageShell>
    );
  }

  if (appStatus === 'error' || !application) {
    return (
      <PageShell>
        <BackLink sourceProgramId={sourceProgramId} sourceProgram={sourceProgram} />
        <div
          role="alert"
          className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
        >
          <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
          <span>
            Couldn&apos;t load this application. Refresh the page to try again.
          </span>
        </div>
      </PageShell>
    );
  }

  const name = applicantName(application.applicant);
  const email = applicantEmail(application.applicant);

  return (
    <PageShell>
      <BackLink sourceProgramId={sourceProgramId} sourceProgram={sourceProgram} />

      <header className="flex flex-col gap-[10px] md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-[14px]">
          <span
            aria-hidden="true"
            className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full bg-lrfap-ghost text-lrfap-navy"
          >
            <UserIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-[28px] font-extrabold leading-[1.1] text-lrfap-navy md:text-[32px]">
              {name}
            </h1>
            {email ? (
              <p className="mt-[2px] flex items-center gap-[6px] font-sans text-[13px] text-slate-500">
                <Mail aria-hidden="true" className="h-3.5 w-3.5" />
                {email}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-[6px] md:items-end">
          <div className="flex items-center gap-[10px]">
            <span
              role="status"
              aria-label={`Review state: ${statePresentation.label}`}
              className={`inline-flex shrink-0 items-center border px-[12px] py-[4px] font-sans text-[11px] font-medium uppercase tracking-wide ${statePresentation.badgeCls}`}
            >
              {statePresentation.label}
            </span>
            {reviewState === 'new' ? (
              <button
                type="button"
                onClick={() => void handleBeginReview()}
                disabled={reviewBusy}
                className="inline-flex items-center gap-[6px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[14px] py-[6px] font-sans text-[11px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-60"
              >
                {reviewBusy ? (
                  <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
                ) : null}
                Begin Review
              </button>
            ) : null}
            {reviewState === 'under_review' ? (
              <button
                type="button"
                onClick={() => void handleMarkReviewed()}
                disabled={reviewBusy}
                className="inline-flex items-center gap-[6px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[14px] py-[6px] font-sans text-[11px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky disabled:cursor-not-allowed disabled:opacity-60"
              >
                {reviewBusy ? (
                  <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
                ) : null}
                Mark as Reviewed
              </button>
            ) : null}
          </div>
          {reviewError ? (
            <p
              role="alert"
              className="font-sans text-[11px] text-red-700"
            >
              {reviewError}
            </p>
          ) : null}
        </div>
      </header>

      {/* Reference + submitted-at summary */}
      <section
        aria-labelledby="applicant-reference-heading"
        className="flex flex-col gap-[12px] border-[0.91px] border-lrfap-ghost bg-white p-[24px] shadow-[0_4px_24px_-12px_rgba(38,43,102,0.1)]"
      >
        <p
          id="applicant-reference-heading"
          className="font-sans text-[12px] font-medium uppercase tracking-wide text-slate-500"
        >
          Application Reference
        </p>
        <code className="font-mono text-[22px] font-semibold text-lrfap-navy">
          {application.submissionReference ?? '—'}
        </code>
        <p className="font-sans text-[13px] text-slate-500">
          Submitted on{' '}
          <span className="text-slate-700">
            {formatSubmittedAt(application.submittedAt)}
          </span>
          {cycle ? (
            <>
              {' · '}
              <span className="text-slate-700">
                {cycle.name} {cycle.year}
              </span>
            </>
          ) : null}
        </p>
      </section>

      <ApplicantProfileSection name={name} profile={application.applicantProfile ?? null} />

      {/* Match result summary — read-only mini card, no accept/decline
          (those belong to the applicant). */}
      {application.status === 'matched' && matchedProgram ? (
        <section
          aria-labelledby="match-result-heading"
          className="border-[0.91px] border-emerald-200 bg-emerald-50/50 p-[24px] shadow-[0_4px_24px_-12px_rgba(38,43,102,0.1)]"
        >
          <div className="flex items-start gap-[12px]">
            <CheckCircle
              aria-hidden="true"
              className="mt-[2px] h-5 w-5 shrink-0 text-emerald-600"
            />
            <div className="min-w-0 flex-1">
              <h2
                id="match-result-heading"
                className="font-display text-[14px] font-bold uppercase tracking-wide text-emerald-900"
              >
                Matched
              </h2>
              <p className="mt-[4px] font-sans text-[13px] text-emerald-900">
                {matchedSpec?.name ?? 'Program'}
                {matchedUni?.name ? ` · ${matchedUni.name}` : null}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="detail-documents-heading" className="flex flex-col gap-[12px]">
        <h2
          id="detail-documents-heading"
          className="font-display text-[16px] font-bold uppercase tracking-wide text-lrfap-navy"
        >
          Documents
        </h2>
        {docsStatus === 'loading' ? (
          <div className="h-[320px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50" />
        ) : docsStatus === 'error' ? (
          <div
            role="alert"
            className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
          >
            <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
            <span>Couldn&apos;t load documents. Refresh to try again.</span>
          </div>
        ) : (
          <DocumentsList documents={documents} readOnly showActions />
        )}
      </section>
    </PageShell>
  );
}

interface ApplicantProfileSectionProps {
  name: string;
  profile: ApplicantProfile | null;
}

function ApplicantProfileSection({ name, profile }: ApplicantProfileSectionProps) {
  if (!profile) {
    return (
      <section
        aria-labelledby="applicant-profile-heading"
        className="flex flex-col gap-[12px]"
      >
        <h2
          id="applicant-profile-heading"
          className="font-display text-[16px] font-bold uppercase tracking-wide text-lrfap-navy"
        >
          Applicant Profile
        </h2>
        <div className="border-[0.91px] border-dashed border-lrfap-ghost bg-white/60 px-[24px] py-[20px] font-sans text-[13px] text-slate-500">
          This applicant hasn&apos;t completed their profile yet.
        </div>
      </section>
    );
  }

  const schoolName = medicalSchoolName(profile);
  const languages = spokenLanguages(profile.languages);
  const freeText: Array<{ label: string; value: string | undefined }> = [
    { label: 'Research', value: profile.research },
    { label: 'Publications', value: profile.publications },
    { label: 'Work experience', value: profile.workExperience },
    { label: 'Extracurriculars', value: profile.extracurriculars },
  ].filter((e) => e.value && e.value.trim().length > 0);

  return (
    <section
      aria-labelledby="applicant-profile-heading"
      className="flex flex-col gap-[12px]"
    >
      <h2
        id="applicant-profile-heading"
        className="font-display text-[16px] font-bold uppercase tracking-wide text-lrfap-navy"
      >
        Applicant Profile
      </h2>
      <div className="flex flex-col gap-[24px] border-[0.91px] border-lrfap-ghost bg-white p-[24px] shadow-[0_4px_24px_-12px_rgba(38,43,102,0.08)]">
        <ProfileGroup label="Personal">
          <ProfileRow label="Full name" value={name} />
          <ProfileRow label="Date of birth" value={formatDateOnly(profile.dateOfBirth)} />
          <ProfileRow
            label="Gender"
            value={profile.gender ? GENDER_LABEL[profile.gender] : null}
          />
          <ProfileRow label="Nationality" value={profile.nationality} />
          <ProfileRow label="National ID" value={profile.nationalId} />
          <ProfileRow label="Phone" value={profile.phone} />
          <ProfileRow label="Address" value={profile.address} />
          <ProfileRow label="City" value={profile.city} />
        </ProfileGroup>

        <ProfileGroup label="Education">
          <ProfileRow label="Medical school" value={schoolName} />
          <ProfileRow label="Graduation year" value={profile.graduationYear ?? null} />
          <ProfileRow label="Class rank" value={profile.classRank} />
        </ProfileGroup>

        <ProfileGroup label="Languages" asList={false}>
          {languages.length === 0 ? (
            <p className="font-sans text-[13px] text-slate-500">
              No language proficiencies recorded.
            </p>
          ) : (
            <ul role="list" className="flex flex-wrap gap-[8px]">
              {languages.map((entry) => (
                <li
                  key={entry.code}
                  className="inline-flex items-center gap-[6px] border-[0.91px] border-lrfap-ghost bg-lrfap-ghost/40 px-[10px] py-[3px] font-sans text-[12px] text-lrfap-navy"
                >
                  <span className="font-semibold">{LANGUAGE_LABEL[entry.code]}</span>
                  <span className="text-slate-500">·</span>
                  <span>{LANGUAGE_LEVEL_LABEL[entry.level]}</span>
                </li>
              ))}
            </ul>
          )}
        </ProfileGroup>

        <ProfileGroup label="Standardised scores">
          <ProfileRow label="IFOM 1" value={profile.usmleStep1 ?? null} />
          <ProfileRow label="IFOM 2" value={profile.usmleStep2 ?? null} />
        </ProfileGroup>

        {freeText.length > 0 ? (
          <ProfileGroup label="Background" asList={false}>
            {freeText.map((entry) => (
              <div key={entry.label} className="flex flex-col gap-[4px]">
                <p className="font-sans text-[12px] font-medium uppercase tracking-wide text-slate-500">
                  {entry.label}
                </p>
                <p className="whitespace-pre-line font-sans text-[13px] leading-relaxed text-slate-700">
                  {entry.value}
                </p>
              </div>
            ))}
          </ProfileGroup>
        ) : null}

        <ProfileGroup label="Emergency contact">
          <ProfileRow label="Name" value={profile.emergencyContactName} />
          <ProfileRow label="Phone" value={profile.emergencyContactPhone} />
          <ProfileRow label="Relationship" value={profile.emergencyContactRelation} />
        </ProfileGroup>
      </div>
    </section>
  );
}

function ProfileGroup({
  label,
  children,
  asList = true,
}: {
  label: string;
  children: React.ReactNode;
  asList?: boolean;
}) {
  return (
    <div className="flex flex-col gap-[10px]">
      <p className="font-sans text-[12px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      {asList ? (
        <dl className="grid grid-cols-1 gap-x-[24px] gap-y-[8px] sm:grid-cols-2">
          {children}
        </dl>
      ) : (
        <div className="flex flex-col gap-[8px]">{children}</div>
      )}
    </div>
  );
}

function ProfileRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  const display =
    value === null || value === undefined || value === '' ? '—' : String(value);
  return (
    <div className="grid grid-cols-[160px_1fr] items-baseline gap-x-[12px]">
      <dt className="font-sans text-[12px] text-slate-500">{label}</dt>
      <dd className="font-sans text-[13px] text-lrfap-navy">{display}</dd>
    </div>
  );
}

interface BackLinkProps {
  sourceProgramId: string | null;
  sourceProgram: Program | null;
}

function BackLink({ sourceProgramId, sourceProgram }: BackLinkProps) {
  if (!sourceProgramId) {
    return (
      <Link
        to="/university"
        className="inline-flex w-fit items-center gap-[8px] font-sans text-[13px] font-medium text-lrfap-navy underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Back to Dashboard
      </Link>
    );
  }

  const specialty = sourceProgram ? populated<Specialty>(sourceProgram.specialty) : null;
  const label = specialty?.name ? `Back to ${specialty.name}` : 'Back to program';

  return (
    <Link
      to={`/university/programs/${sourceProgramId}`}
      className="inline-flex w-fit items-center gap-[8px] font-sans text-[13px] font-medium text-lrfap-navy underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      {label}
    </Link>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1100px] px-6 py-[40px] md:px-[58px]">
      <div className="flex flex-col gap-[24px]">{children}</div>
    </div>
  );
}
