import { useCallback, useEffect, useMemo, useState } from 'react';
import { AxiosError } from 'axios';
import { AlertCircle, ArrowLeft, CheckCircle, Copy, Loader2 } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuth } from '../../hooks/useAuth';
import { applicationsApi } from '../../api/applications';
import { documentsApi } from '../../api/documents';
import { SelectedProgramsList } from '../../components/applicant/applicationView/SelectedProgramsList';
import { DocumentsList } from '../../components/applicant/applicationView/DocumentsList';
import { MatchResultCard } from '../../components/applicant/applicationView/MatchResultCard';
import type {
  Application,
  ApplicationDocument,
  ApplicationStatus,
} from '../../types';
import { STEPS, type StepSlug } from '../../components/applicant/wizard/types';

/**
 * Read-only view of a submitted (or later-staged) application. The
 * MyApplications card's "View Application" button lands here. Drafts are
 * redirected to the wizard; 404/403 surface on MyApplications via the
 * `?error=application-not-found` query param.
 *
 * Visually mirrors ~70% of the Review & Submit wizard step but lives
 * outside WizardContext — no step indicator, no declarations section,
 * no save/submit buttons. Status-specific additions: Match Result card
 * when status === 'matched'.
 */

// Payment summary duplicates the Review step's presentation. Kept inline
// here rather than extracted — if a second caller shows up we can share.
const APPLICATION_FEE_USD = 250;

type FetchStatus = 'idle' | 'loading' | 'loaded' | 'error' | 'not-found';

function isValidObjectId(id: string | undefined): id is string {
  return !!id && /^[0-9a-fA-F]{24}$/.test(id);
}

function formatInvoiceNumber(applicationId: string): string {
  return `INV${applicationId.slice(-8).toUpperCase()}`;
}
function formatInvoiceDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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

interface StatusPresentation {
  label: string;
  badgeCls: string;
}
function presentStatus(status: ApplicationStatus): StatusPresentation {
  switch (status) {
    case 'submitted':
      return { label: 'Submitted', badgeCls: 'bg-sky-50 text-sky-700 border-sky-200' };
    case 'under_review':
      return {
        label: 'Under Review',
        badgeCls: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    case 'matched':
      return { label: 'Matched', badgeCls: 'bg-green-50 text-green-700 border-green-200' };
    case 'unmatched':
      return { label: 'Unmatched', badgeCls: 'bg-slate-50 text-slate-700 border-slate-200' };
    case 'withdrawn':
      return {
        label: 'Withdrawn',
        badgeCls: 'bg-slate-50 text-slate-500 border-slate-200',
      };
    case 'draft':
    default:
      return { label: status, badgeCls: 'bg-slate-50 text-slate-700 border-slate-200' };
  }
}

export default function ApplicantApplicationDetailPage() {
  useDocumentTitle('Application details');
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [application, setApplication] = useState<Application | null>(null);
  const [appStatus, setAppStatus] = useState<FetchStatus>('idle');
  const [documents, setDocuments] = useState<ApplicationDocument[]>([]);
  const [docsStatus, setDocsStatus] = useState<FetchStatus>('idle');
  const [refCopied, setRefCopied] = useState(false);

  const validId = isValidObjectId(id);

  useEffect(() => {
    if (!validId) return;
    let cancelled = false;
    setAppStatus('loading');
    applicationsApi
      .get(id)
      .then((res) => {
        if (cancelled) return;
        setApplication(res);
        setAppStatus('loaded');
      })
      .catch((err) => {
        if (cancelled) return;
        if (
          err instanceof AxiosError &&
          (err.response?.status === 404 || err.response?.status === 403)
        ) {
          setAppStatus('not-found');
          return;
        }
        setAppStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [id, validId]);

  useEffect(() => {
    if (!validId) return;
    let cancelled = false;
    setDocsStatus('loading');
    documentsApi
      .listForApplication(id)
      .then((res) => {
        if (cancelled) return;
        setDocuments(res);
        setDocsStatus('loaded');
      })
      .catch(() => {
        // Documents failing shouldn't blank the whole page; we render an
        // inline warning in the Documents panel instead.
        if (!cancelled) setDocsStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [id, validId]);

  const handleApplicationUpdated = useCallback((next: Application) => {
    setApplication(next);
  }, []);

  const handleCopyRef = useCallback(async () => {
    if (!application?.submissionReference) return;
    try {
      await navigator.clipboard.writeText(application.submissionReference);
      setRefCopied(true);
      setTimeout(() => setRefCopied(false), 2000);
    } catch {
      // ignore — clipboard may be unavailable in some browsers/contexts
    }
  }, [application?.submissionReference]);

  const statusPresentation = useMemo(
    () => (application ? presentStatus(application.status) : null),
    [application],
  );

  // ---- Guards ----------------------------------------------------------

  if (!validId) {
    return (
      <PageShell>
        <EmptyState
          title="No application attached"
          body={
            <>
              Open a submitted application from{' '}
              <Link
                to="/applicant/applications"
                className="font-medium text-lrfap-sky underline-offset-4 hover:underline"
              >
                My Applications
              </Link>
              .
            </>
          }
        />
      </PageShell>
    );
  }

  if (appStatus === 'not-found') {
    return <Navigate to="/applicant/applications?error=application-not-found" replace />;
  }

  // Drafts belong in the wizard, not here.
  if (application?.status === 'draft') {
    return <Navigate to={`/applicant/applications/${application._id}/edit`} replace />;
  }

  if (appStatus === 'loading' || appStatus === 'idle') {
    return (
      <PageShell>
        <div className="h-[80px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50" />
        <div className="h-[280px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50" />
        <div className="h-[420px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50" />
      </PageShell>
    );
  }

  if (appStatus === 'error' || !application || !statusPresentation) {
    return (
      <PageShell>
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

  // ---- Content ---------------------------------------------------------

  return (
    <PageShell>
      {/* Heading + status */}
      <header className="flex flex-col gap-[10px] md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-[14px]">
          <h1 className="font-display text-[36px] font-extrabold leading-[1.1] text-lrfap-navy md:text-[40px]">
            APPLICATION DETAILS
          </h1>
          <span
            role="status"
            aria-label={`Status: ${statusPresentation.label}`}
            className={`inline-flex shrink-0 items-center border px-[12px] py-[4px] font-sans text-[11px] font-medium uppercase tracking-wide ${statusPresentation.badgeCls}`}
          >
            {statusPresentation.label}
          </span>
        </div>
      </header>

      {/* Reference card */}
      <section
        aria-labelledby="reference-heading"
        className="flex flex-col gap-[12px] border-[0.91px] border-lrfap-ghost bg-white p-[24px] shadow-[0_4px_24px_-12px_rgba(38,43,102,0.1)]"
      >
        <p
          id="reference-heading"
          className="font-sans text-[12px] font-medium uppercase tracking-wide text-slate-500"
        >
          Application Reference
        </p>
        <div className="flex flex-wrap items-center gap-[12px]">
          <code className="font-mono text-[22px] font-semibold text-lrfap-navy">
            {application.submissionReference ?? '—'}
          </code>
          {application.submissionReference ? (
            <button
              type="button"
              onClick={() => void handleCopyRef()}
              aria-label="Copy reference"
              className="inline-flex h-[32px] w-[32px] items-center justify-center border-[0.91px] border-lrfap-ghost text-slate-500 transition-colors hover:border-lrfap-navy hover:text-lrfap-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
            >
              <Copy aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {refCopied ? (
            <span
              role="status"
              aria-live="polite"
              className="font-sans text-[12px] text-green-600"
            >
              Copied to clipboard
            </span>
          ) : null}
        </div>
        <p className="font-sans text-[13px] text-slate-500">
          Submitted on{' '}
          <span className="text-slate-700">
            {formatSubmittedAt(application.submittedAt)}
          </span>
        </p>
      </section>

      {/* Match result (only when matched) */}
      {application.status === 'matched' && application.matchedProgram ? (
        <MatchResultCard
          application={application}
          onApplicationUpdated={handleApplicationUpdated}
        />
      ) : null}

      {/* Two-column grid: documents + status/ranked selections */}
      <div className="grid grid-cols-1 gap-[24px] lg:grid-cols-[1fr_1fr]">
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
            <DocumentsList documents={documents} readOnly />
          )}
        </section>

        <div className="flex flex-col gap-[24px]">
          <section
            aria-labelledby="detail-status-heading"
            className="flex flex-col gap-[12px]"
          >
            <h2
              id="detail-status-heading"
              className="font-display text-[16px] font-bold uppercase tracking-wide text-lrfap-navy"
            >
              Status
            </h2>
            <ul
              role="list"
              className="flex flex-col divide-y divide-lrfap-ghost border-[0.91px] border-lrfap-ghost bg-white shadow-[0_4px_24px_-12px_rgba(38,43,102,0.08)]"
            >
              {(['profile', 'documents', 'programs', 'preference-ranking'] as StepSlug[]).map(
                (slug) => {
                  const def = STEPS.find((s) => s.slug === slug);
                  if (!def) return null;
                  return (
                    <li
                      key={slug}
                      className="flex items-center justify-between gap-[16px] px-[18px] py-[14px]"
                    >
                      <span className="min-w-0 font-sans text-[13px] font-semibold uppercase tracking-wide text-lrfap-navy">
                        {def.label}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-[6px] border border-green-200 bg-green-50 px-[10px] py-[2px] font-sans text-[11px] font-medium uppercase tracking-wide text-green-700">
                        <CheckCircle aria-hidden="true" className="h-3 w-3" />
                        Complete
                      </span>
                    </li>
                  );
                },
              )}
            </ul>
          </section>

          <section
            aria-labelledby="detail-ranked-heading"
            className="flex flex-col gap-[12px]"
          >
            <h2
              id="detail-ranked-heading"
              className="font-display text-[16px] font-bold uppercase tracking-wide text-lrfap-navy"
            >
              Selected Programs &amp; Rankings
            </h2>
            <SelectedProgramsList
              selections={application.selections}
              readOnly
              emptyMessage="No programs were ranked on this application."
            />
          </section>
        </div>
      </div>

      {/* Payment summary */}
      <section
        aria-labelledby="detail-payment-heading"
        className="flex flex-col gap-[12px]"
      >
        <h2
          id="detail-payment-heading"
          className="font-display text-[16px] font-bold uppercase tracking-wide text-lrfap-navy"
        >
          Payment Summary
        </h2>
        <div className="flex flex-col gap-[20px] border-[0.91px] border-lrfap-ghost bg-white p-[24px] shadow-[0_4px_24px_-12px_rgba(38,43,102,0.08)]">
          <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2">
            <dl className="grid grid-cols-[auto_1fr] gap-x-[16px] gap-y-[8px]">
              <dt className="font-sans text-[13px] text-slate-500">Billed to:</dt>
              <dd className="font-sans text-[13px] font-semibold text-lrfap-navy">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : 'Applicant'}
              </dd>
              <dt className="font-sans text-[13px] text-slate-500">Summary:</dt>
              <dd className="font-sans text-[13px] font-semibold text-lrfap-navy">
                LRFAP Application
              </dd>
            </dl>
            <dl className="grid grid-cols-[auto_1fr] gap-x-[16px] gap-y-[8px]">
              <dt className="font-sans text-[13px] text-slate-500">Invoice Number:</dt>
              <dd className="font-mono text-[13px] font-semibold text-lrfap-navy">
                {formatInvoiceNumber(application._id)}
              </dd>
              <dt className="font-sans text-[13px] text-slate-500">Subject:</dt>
              <dd className="font-sans text-[13px] font-semibold text-lrfap-navy">
                Application
              </dd>
              <dt className="font-sans text-[13px] text-slate-500">Currency:</dt>
              <dd className="font-sans text-[13px] font-semibold text-lrfap-navy">USD</dd>
              <dt className="font-sans text-[13px] text-slate-500">Date:</dt>
              <dd className="font-sans text-[13px] font-semibold text-lrfap-navy">
                {formatInvoiceDate(application.submittedAt)}
              </dd>
            </dl>
          </div>
          <div className="flex flex-col gap-[6px] border-t border-lrfap-ghost pt-[16px]">
            <div className="flex items-center justify-between font-sans text-[13px] text-slate-500">
              <span>Subtotal</span>
              <span>{APPLICATION_FEE_USD} USD</span>
            </div>
            <div className="flex items-center justify-between font-sans text-[15px] font-semibold text-lrfap-navy">
              <span>Total</span>
              <span>{APPLICATION_FEE_USD} USD</span>
            </div>
          </div>
          <p className="font-sans text-[12px] leading-relaxed text-slate-500">
            Payment instructions were sent to your email at submission.
          </p>
        </div>
      </section>

      {/* Back link */}
      <div className="pt-[8px]">
        <Link
          to="/applicant/applications"
          className="inline-flex items-center gap-[8px] font-sans text-[13px] font-medium text-lrfap-navy underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to My Applications
        </Link>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1100px] px-6 py-[40px] md:px-[58px]">
      <div className="flex flex-col gap-[24px]">{children}</div>
    </div>
  );
}

function EmptyState({
  title,
  body,
}: {
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-[12px] border border-dashed border-lrfap-ghost bg-white/60 px-6 py-[80px] text-center">
      <Loader2
        aria-hidden="true"
        className="h-10 w-10 animate-none text-slate-300"
        strokeWidth={1.5}
      />
      <h2 className="font-display text-[20px] font-bold text-lrfap-navy">
        {title}
      </h2>
      <p className="max-w-[440px] font-sans text-[13px] text-slate-600">{body}</p>
    </div>
  );
}
