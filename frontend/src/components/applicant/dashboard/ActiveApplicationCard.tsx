import { ArrowRight, CheckCircle, Clock, FileText, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import type {
  DashboardActiveCycle,
  DashboardApplication,
  ID,
  Program,
  Specialty,
  University,
} from '../../../types';

/**
 * Dashboard widget that surfaces whatever applicant action is most
 * relevant today. Branches by the current-cycle application's status.
 * The parent picks which app to feed us (one per cycle is enforced
 * backend-side); we branch on `application.status` only.
 *
 * The thin `DashboardApplication` shape doesn't carry the submission
 * reference in plain view — detail lookups go to /applicant/applications/:id.
 */

interface ActiveApplicationCardProps {
  application: DashboardApplication | null;
  activeCycle: DashboardActiveCycle | null;
  /**
   * True when the applicant has any draft/submitted/matched application
   * anywhere (checklist-derived). Used to disable the "Start New" CTA
   * even on cycles where they don't yet have an app, aligning with the
   * backend's one-per-cycle enforcement and MyApplicationsPage behavior.
   */
  hasAnyApplication: boolean;
}

function formatCloseDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function populated<T extends { _id: ID }>(ref: ID | T | null | undefined): T | null {
  if (!ref || typeof ref === 'string') return null;
  return ref;
}

function trackLabel(track: 'residency' | 'fellowship'): string {
  return track === 'fellowship' ? 'FELLOWSHIP' : 'RESIDENCY';
}

function cycleSubheading(
  activeCycle: DashboardActiveCycle | null,
  application: DashboardApplication,
): string {
  const year = activeCycle?.year ?? '';
  return [year, trackLabel(application.track)].filter(Boolean).join(' · ');
}

export function ActiveApplicationCard({
  application,
  activeCycle,
  hasAnyApplication,
}: ActiveApplicationCardProps) {
  // No application in the active cycle.
  if (!application) {
    const cycleOpen = !!activeCycle && activeCycle.status === 'open';
    const buttonEnabled = cycleOpen && !hasAnyApplication;
    const helper = !cycleOpen
      ? 'No cycle is currently open for applications.'
      : hasAnyApplication
        ? 'You already have an application for this cycle.'
        : null;
    return (
      <CardShell>
        <div className="flex flex-col gap-[14px]">
          <h2 className="font-display text-[18px] font-bold uppercase tracking-wide text-lrfap-navy">
            No Active Application
          </h2>
          <p className="font-sans text-[14px] text-slate-600">
            Start your first application to begin.
          </p>
          <div className="flex flex-col gap-[6px] md:flex-row md:items-center md:gap-[14px]">
            <Link
              to="/applicant/applications"
              aria-disabled={!buttonEnabled || undefined}
              onClick={(e) => {
                if (!buttonEnabled) e.preventDefault();
              }}
              title={helper ?? undefined}
              className={`inline-flex h-[44px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[22px] font-sans text-[14px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky ${
                buttonEnabled ? '' : 'pointer-events-none opacity-60'
              }`}
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              Start New Application
            </Link>
            {helper ? (
              <span className="font-sans text-[12px] text-slate-500">
                {helper}
              </span>
            ) : null}
          </div>
        </div>
      </CardShell>
    );
  }

  const subheading = cycleSubheading(activeCycle, application);
  const { label: badgeLabel, cls: badgeCls } = statusBadge(application.status);

  if (application.status === 'matched') {
    const matched = populated<Program>(application.matchedProgram ?? null);
    const matchedName = matched
      ? (populated<Specialty>(matched.specialty)?.name ?? 'your program')
      : 'your program';
    const matchedUni = matched ? populated<University>(matched.university) : null;
    return (
      <CardShell>
        <div className="flex flex-col gap-[14px]">
          <div className="flex flex-wrap items-center gap-[12px]">
            <CheckCircle
              aria-hidden="true"
              className="h-6 w-6 shrink-0 text-green-600"
            />
            <h2 className="font-display text-[22px] font-extrabold uppercase tracking-wide text-lrfap-navy">
              Congratulations!
            </h2>
            <span
              className={`inline-flex items-center border px-[10px] py-[2px] font-sans text-[11px] font-medium uppercase tracking-wide ${badgeCls}`}
            >
              {badgeLabel}
            </span>
          </div>
          <p className="font-sans text-[14px] text-slate-600">
            You&apos;ve been matched to{' '}
            <span className="font-semibold text-lrfap-navy">{matchedName}</span>
            {matchedUni ? ` at ${matchedUni.name}` : ''}.
          </p>
          {application.offerStatus !== 'none' ? (
            <p className="font-sans text-[13px] text-slate-500">
              Offer status: <OfferStatusText status={application.offerStatus} />
            </p>
          ) : null}
          <div>
            <Link
              to={`/applicant/applications/${application.id}`}
              className="inline-flex h-[40px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-sky bg-lrfap-sky px-[22px] font-sans text-[13px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-[#3a86bd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
            >
              View Match Details
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </CardShell>
    );
  }

  if (application.status === 'draft') {
    return (
      <CardShell>
        <div className="flex flex-col gap-[14px]">
          <div className="flex flex-wrap items-center gap-[12px]">
            <FileText
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-lrfap-navy"
            />
            <h2 className="font-display text-[18px] font-bold uppercase tracking-wide text-lrfap-navy">
              Your Draft Application
            </h2>
            <span
              className={`inline-flex items-center border px-[10px] py-[2px] font-sans text-[11px] font-medium uppercase tracking-wide ${badgeCls}`}
            >
              {badgeLabel}
            </span>
          </div>
          {subheading ? (
            <p className="font-display text-[13px] font-bold uppercase tracking-wide text-slate-500">
              {subheading}
            </p>
          ) : null}
          {activeCycle?.submissionDeadline ? (
            <p className="flex items-center gap-[6px] font-sans text-[13px] text-slate-500">
              <Clock aria-hidden="true" className="h-3.5 w-3.5" />
              Applications close {formatCloseDate(activeCycle.submissionDeadline)}
            </p>
          ) : null}
          <p className="font-sans text-[14px] text-slate-600">
            Your application is in progress. Pick up where you left off.
          </p>
          <div className="flex flex-col gap-[10px] md:flex-row md:items-center md:gap-[14px]">
            <Link
              to={`/applicant/applications/${application.id}/edit`}
              className="inline-flex h-[44px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-sky bg-lrfap-sky px-[22px] font-sans text-[14px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-[#3a86bd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
            >
              Continue Editing
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            <Link
              to="/applicant/applications"
              className="inline-flex h-[44px] items-center justify-center border-[0.91px] border-lrfap-navy px-[20px] font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy"
            >
              View Details
            </Link>
          </div>
        </div>
      </CardShell>
    );
  }

  // submitted / under_review / unmatched / withdrawn — single CTA out.
  const { title, body } = nonDraftCopy(application.status);
  return (
    <CardShell>
      <div className="flex flex-col gap-[14px]">
        <div className="flex flex-wrap items-center gap-[12px]">
          <FileText
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-lrfap-navy"
          />
          <h2 className="font-display text-[18px] font-bold uppercase tracking-wide text-lrfap-navy">
            {title}
          </h2>
          <span
            className={`inline-flex items-center border px-[10px] py-[2px] font-sans text-[11px] font-medium uppercase tracking-wide ${badgeCls}`}
          >
            {badgeLabel}
          </span>
        </div>
        {subheading ? (
          <p className="font-display text-[13px] font-bold uppercase tracking-wide text-slate-500">
            {subheading}
          </p>
        ) : null}
        <p className="font-sans text-[14px] text-slate-600">{body}</p>
        <div>
          <Link
            to={`/applicant/applications/${application.id}`}
            className="inline-flex h-[44px] items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[22px] font-sans text-[14px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
          >
            View Details
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </CardShell>
  );
}

function nonDraftCopy(status: string): { title: string; body: string } {
  switch (status) {
    case 'submitted':
    case 'under_review':
      return {
        title: 'Your Application',
        body: 'Your application has been submitted and is under review.',
      };
    case 'unmatched':
      return {
        title: 'Application Not Matched',
        body: 'Matching has completed. No match was offered for this cycle.',
      };
    case 'withdrawn':
      return {
        title: 'Application Withdrawn',
        body: 'This application has been withdrawn.',
      };
    default:
      return {
        title: 'Your Application',
        body: 'Open the detail page to see more.',
      };
  }
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-labelledby="dashboard-active-app-heading"
      className="border-[0.91px] border-lrfap-ghost bg-white p-[24px] shadow-[0_4px_12px_rgba(38,43,102,0.08)]"
    >
      {children}
    </section>
  );
}

function statusBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case 'draft':
      return { label: 'Draft', cls: 'bg-slate-100 text-slate-700 border-slate-200' };
    case 'submitted':
      return { label: 'Submitted', cls: 'bg-sky-50 text-sky-700 border-sky-200' };
    case 'under_review':
      return {
        label: 'Under Review',
        cls: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    case 'matched':
      return { label: 'Matched', cls: 'bg-green-50 text-green-700 border-green-200' };
    case 'unmatched':
      return { label: 'Unmatched', cls: 'bg-slate-50 text-slate-700 border-slate-200' };
    case 'withdrawn':
      return { label: 'Withdrawn', cls: 'bg-slate-50 text-slate-500 border-slate-200' };
    default:
      return { label: status, cls: 'bg-slate-50 text-slate-700 border-slate-200' };
  }
}

function OfferStatusText({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return <span className="font-semibold text-amber-700">Pending decision</span>;
    case 'accepted':
      return <span className="font-semibold text-green-700">Accepted</span>;
    case 'declined':
      return <span className="font-semibold text-slate-600">Declined</span>;
    case 'expired':
      return <span className="font-semibold text-slate-500">Expired</span>;
    default:
      return <span className="font-semibold text-slate-600">{status}</span>;
  }
}
