import { Link } from 'react-router-dom';
import { ArrowUpRight, Users } from 'lucide-react';
import type {
  Application,
  ApplicationReviewState,
  ID,
  User,
} from '../../../types';

/**
 * Per-program applicants table. The applicant's preference rank for this
 * program is intentionally not surfaced — exposing it would let reviewers
 * favor applicants who ranked them highly, breaking the stable-matching
 * guarantee the algorithm provides. Sort by submittedAt DESC.
 */

interface ApplicantsTableProps {
  applications: Application[];
  programId: ID;
}

interface StatusPresentation {
  label: string;
  cls: string;
}

const REVIEW_STATE_PRESENTATION: Record<ApplicationReviewState, StatusPresentation> = {
  new: { label: 'New', cls: 'border-slate-200 bg-slate-50 text-slate-600' },
  under_review: {
    label: 'Under review',
    cls: 'border-lrfap-sky/40 bg-lrfap-sky/10 text-lrfap-navy',
  },
  reviewed: {
    label: 'Reviewed',
    cls: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  matched: {
    label: 'Matched',
    cls: 'border-lrfap-navy bg-lrfap-navy/5 text-lrfap-navy',
  },
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function applicantDisplay(applicant: ID | User): {
  name: string;
  email: string | null;
} {
  if (typeof applicant === 'string') {
    return { name: 'Applicant', email: null };
  }
  const parts = [applicant.firstName, applicant.lastName].filter(Boolean);
  return {
    name: parts.length > 0 ? parts.join(' ') : (applicant.email ?? 'Applicant'),
    email: applicant.email ?? null,
  };
}

export function ApplicantsTable({ applications, programId }: ApplicantsTableProps) {
  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-[8px] border border-dashed border-lrfap-ghost bg-white/60 px-[16px] py-[48px] text-center">
        <Users
          aria-hidden="true"
          className="h-8 w-8 text-slate-300"
          strokeWidth={1.5}
        />
        <p className="font-sans text-[13px] text-slate-500">
          No applicants match this filter.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden border-[0.91px] border-lrfap-ghost bg-white shadow-[0_4px_24px_-12px_rgba(38,43,102,0.08)]">
      {/* Desktop: true table */}
      <table className="hidden w-full border-collapse md:table">
        <thead>
          <tr className="border-b border-lrfap-ghost bg-lrfap-ghost/40">
            <th className="px-[20px] py-[14px] text-left font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Applicant
            </th>
            <th className="px-[16px] py-[14px] text-left font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Applied
            </th>
            <th className="px-[16px] py-[14px] text-left font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Status
            </th>
            <th className="px-[16px] py-[14px] text-left font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Reference
            </th>
            <th className="px-[20px] py-[14px] text-right font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {applications.map((app, idx) => {
            const { name, email } = applicantDisplay(app.applicant);
            const presentation = REVIEW_STATE_PRESENTATION[app.reviewState ?? 'new'];
            return (
              <tr
                key={app._id}
                className={idx > 0 ? 'border-t border-lrfap-ghost/70' : ''}
              >
                <td className="px-[20px] py-[14px] align-middle">
                  <p className="font-sans text-[14px] font-semibold text-lrfap-navy">
                    {name}
                  </p>
                  {email ? (
                    <p className="mt-[2px] font-sans text-[12px] text-slate-500">
                      {email}
                    </p>
                  ) : null}
                </td>
                <td className="px-[16px] py-[14px] align-middle font-sans text-[13px] text-slate-600">
                  {formatDate(app.submittedAt)}
                </td>
                <td className="px-[16px] py-[14px] align-middle">
                  <span
                    className={`inline-flex items-center border-[0.91px] px-[10px] py-[2px] font-sans text-[11px] font-medium uppercase tracking-wide ${presentation.cls}`}
                  >
                    {presentation.label}
                  </span>
                </td>
                <td className="px-[16px] py-[14px] align-middle font-mono text-[12px] text-slate-600">
                  {app.submissionReference ?? '—'}
                </td>
                <td className="px-[20px] py-[14px] text-right align-middle">
                  <Link
                    to={`/university/applications/${app._id}?program=${programId}`}
                    className="inline-flex items-center gap-[6px] border-[0.91px] border-lrfap-navy px-[14px] py-[6px] font-sans text-[11px] font-medium uppercase tracking-wide text-lrfap-navy transition-colors hover:bg-lrfap-navy hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
                  >
                    View
                    <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Mobile: stacked cards */}
      <ul role="list" className="flex flex-col md:hidden">
        {applications.map((app, idx) => {
          const { name, email } = applicantDisplay(app.applicant);
          const presentation = REVIEW_STATE_PRESENTATION[app.reviewState ?? 'new'];
          return (
            <li
              key={app._id}
              className={idx > 0 ? 'border-t border-lrfap-ghost/70' : ''}
            >
              <Link
                to={`/university/applications/${app._id}?program=${programId}`}
                className="flex items-stretch gap-[14px] px-[16px] py-[14px] transition-colors hover:bg-lrfap-ghost/20 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lrfap-sky"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-sans text-[14px] font-semibold text-lrfap-navy">
                    {name}
                  </p>
                  {email ? (
                    <p className="truncate font-sans text-[12px] text-slate-500">
                      {email}
                    </p>
                  ) : null}
                  <div className="mt-[6px] flex flex-wrap items-center gap-[6px]">
                    <span
                      className={`inline-flex items-center border-[0.91px] px-[8px] py-[1px] font-sans text-[10px] font-medium uppercase tracking-wide ${presentation.cls}`}
                    >
                      {presentation.label}
                    </span>
                    <span className="font-sans text-[11px] text-slate-500">
                      {formatDate(app.submittedAt)}
                    </span>
                  </div>
                </div>
                <ArrowUpRight
                  aria-hidden="true"
                  className="mt-[4px] h-4 w-4 shrink-0 text-slate-400"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
