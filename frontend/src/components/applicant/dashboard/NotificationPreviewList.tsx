import { BellOff, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Notification } from '../../../types';

/**
 * Dashboard widget: the 3 most recent notifications with a "View all"
 * shortcut. The caller already sorted/trimmed the list — we just render.
 * If a notification has a `link`, the whole row navigates to it;
 * otherwise we fall back to the notifications inbox.
 */

interface NotificationPreviewListProps {
  notifications: Notification[];
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function NotificationPreviewList({
  notifications,
}: NotificationPreviewListProps) {
  return (
    <section
      aria-labelledby="dashboard-notifications-heading"
      className="border-[0.91px] border-lrfap-ghost bg-white p-[24px] shadow-[0_4px_12px_rgba(38,43,102,0.08)]"
    >
      <div className="flex items-center justify-between gap-[12px]">
        <h2
          id="dashboard-notifications-heading"
          className="font-display text-[16px] font-bold uppercase tracking-wide text-lrfap-navy"
        >
          Recent Notifications
        </h2>
        <Link
          to="/applicant/notifications"
          className="font-sans text-[12px] font-semibold uppercase tracking-wide text-lrfap-sky underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
        >
          View all
        </Link>
      </div>

      {notifications.length === 0 ? (
        <div className="mt-[16px] flex flex-col items-center justify-center gap-[8px] border border-dashed border-lrfap-ghost bg-white/60 px-[16px] py-[36px] text-center">
          <BellOff
            aria-hidden="true"
            className="h-8 w-8 text-slate-300"
            strokeWidth={1.5}
          />
          <p className="font-sans text-[13px] text-slate-500">
            No notifications yet
          </p>
        </div>
      ) : (
        <ul role="list" className="mt-[16px] flex flex-col">
          {notifications.map((n, idx) => {
            const href = n.link || '/applicant/notifications';
            return (
              <li
                key={n._id}
                className={idx > 0 ? 'border-t border-lrfap-ghost/70' : ''}
              >
                <Link
                  to={href}
                  className="group flex items-start gap-[12px] px-[4px] py-[12px] transition-colors hover:bg-lrfap-ghost/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-[8px] h-[8px] w-[8px] shrink-0 rounded-full ${
                      n.isRead ? 'bg-transparent' : 'bg-lrfap-sky'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-sans text-[13px] font-semibold text-lrfap-navy">
                      {n.title}
                    </p>
                    {n.message ? (
                      <p className="mt-[2px] truncate font-sans text-[12px] text-slate-500">
                        {n.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-[6px] text-slate-400">
                    <span className="font-sans text-[11px] text-slate-500">
                      {relativeTime(n.createdAt)}
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="h-4 w-4 transition-transform group-hover:translate-x-[1px]"
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
