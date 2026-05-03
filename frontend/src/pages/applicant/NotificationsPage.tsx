import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  BellOff,
  CheckCheck,
  CheckCircle,
  ChevronRight,
  FileCheck,
  ListOrdered,
  Loader2,
  Mail,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { notificationsApi } from '../../api/notifications';
import { useNotifications } from '../../hooks/useNotifications';
import type { Notification, NotificationType } from '../../types';

/**
 * Full notifications inbox. Reads the list itself on mount; routes any
 * mutation (mark-one / mark-all) through the NotificationsContext so the
 * navbar bell badge stays in sync without a second roundtrip.
 *
 * No pagination today — backend caps the payload at limit=50, and real
 * applicants carry well under that per cycle. Bump the API helper if we
 * ever need to page.
 */

type FetchStatus = 'idle' | 'loading' | 'loaded' | 'error';

export default function ApplicantNotificationsPage() {
  useDocumentTitle('Notifications');
  const navigate = useNavigate();
  const { markRead, markAllRead } = useNotifications();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [markAllError, setMarkAllError] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    notificationsApi
      .list()
      .then((res) => {
        if (cancelled) return;
        setNotifications(res);
        setStatus('loaded');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(
    () =>
      notifications
        .slice()
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [notifications],
  );

  const grouped = useMemo(() => bucketByRecency(sorted), [sorted]);

  const hasUnread = notifications.some((n) => !n.isRead);

  const handleRowClick = useCallback(
    async (n: Notification) => {
      // Navigate first-class if a link exists; mark-read is a side effect.
      if (!n.isRead) {
        // Optimistic: flip local list + let context decrement the badge.
        setNotifications((prev) =>
          prev.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)),
        );
        markRead(n._id).catch(() => {
          // Rollback local list if the server rejected — the context
          // rolls back its own count.
          setNotifications((prev) =>
            prev.map((x) => (x._id === n._id ? { ...x, isRead: false } : x)),
          );
        });
      }
      if (n.link) navigate(n.link);
    },
    [markRead, navigate],
  );

  const handleMarkAll = useCallback(async () => {
    if (isMarkingAll) return;
    setIsMarkingAll(true);
    setMarkAllError(null);
    const snapshot = notifications;
    // Optimistic: flip all to read locally + context zeroes the badge.
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await markAllRead();
    } catch {
      setNotifications(snapshot);
      setMarkAllError(
        'Couldn’t mark all as read. Please try again.',
      );
    } finally {
      setIsMarkingAll(false);
    }
  }, [isMarkingAll, markAllRead, notifications]);

  return (
    <PageShell>
      <header className="flex flex-col gap-[10px] md:flex-row md:items-center md:justify-between">
        <h1 className="font-display text-[36px] font-extrabold leading-[1.1] text-lrfap-navy md:text-[40px]">
          NOTIFICATIONS
        </h1>
        {hasUnread ? (
          <button
            type="button"
            onClick={() => void handleMarkAll()}
            disabled={isMarkingAll}
            aria-label="Mark all notifications as read"
            className="inline-flex h-[40px] shrink-0 items-center justify-center gap-[8px] border-[0.91px] border-lrfap-navy px-[18px] font-sans text-[13px] font-medium uppercase tracking-wide text-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isMarkingAll ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck aria-hidden="true" className="h-4 w-4" />
            )}
            Mark all as read
          </button>
        ) : null}
      </header>

      {markAllError ? (
        <div
          role="alert"
          className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
        >
          <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
          <span>{markAllError}</span>
        </div>
      ) : null}

      {status === 'loading' || status === 'idle' ? (
        <SkeletonRows />
      ) : status === 'error' ? (
        <div
          role="alert"
          className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
        >
          <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
          <span>
            Couldn&apos;t load your notifications. Refresh the page to try again.
          </span>
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-[32px]">
          {grouped.map((bucket) => (
            <section
              key={bucket.key}
              aria-labelledby={`notif-bucket-${bucket.key}`}
              className="flex flex-col gap-[10px]"
            >
              <h2
                id={`notif-bucket-${bucket.key}`}
                className="font-sans text-[12px] font-semibold uppercase tracking-wide text-slate-500"
              >
                {bucket.label}
              </h2>
              <ul
                role="list"
                className="flex flex-col border-[0.91px] border-lrfap-ghost bg-white shadow-[0_4px_12px_rgba(38,43,102,0.08)]"
              >
                {bucket.items.map((n, idx) => (
                  <li
                    key={n._id}
                    role="listitem"
                    className={
                      idx > 0 ? 'border-t border-lrfap-ghost/70' : undefined
                    }
                  >
                    <NotificationRow
                      notification={n}
                      onSelect={handleRowClick}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </PageShell>
  );
}

// ---- Row -------------------------------------------------------------

interface NotificationRowProps {
  notification: Notification;
  onSelect: (n: Notification) => void;
}

function NotificationRow({ notification, onSelect }: NotificationRowProps) {
  const Icon = iconForType(notification.type);
  const iconTone = toneForType(notification.type);
  const ariaLabel = notification.isRead
    ? notification.title
    : `Unread notification: ${notification.title}`;
  return (
    <button
      type="button"
      onClick={() => onSelect(notification)}
      aria-label={ariaLabel}
      className={`group flex w-full items-start gap-[14px] px-[18px] py-[14px] text-left transition-colors hover:bg-lrfap-ghost/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lrfap-sky ${
        notification.isRead ? '' : 'bg-sky-50/40'
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-[4px] flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full ${iconTone.bg} ${iconTone.text}`}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-[8px]">
          {notification.isRead ? null : (
            <span
              aria-hidden="true"
              className="mt-[6px] h-[8px] w-[8px] shrink-0 rounded-full bg-lrfap-sky"
            />
          )}
          <p
            className={`min-w-0 flex-1 font-sans text-[14px] ${
              notification.isRead
                ? 'font-medium text-slate-700'
                : 'font-semibold text-lrfap-navy'
            }`}
          >
            {notification.title}
          </p>
          <span className="shrink-0 font-sans text-[11px] text-slate-400">
            {relativeTime(notification.createdAt)}
          </span>
        </div>
        {notification.message ? (
          <p className="mt-[4px] font-sans text-[13px] leading-relaxed text-slate-600">
            {notification.message}
          </p>
        ) : null}
        <p className="mt-[4px] font-sans text-[11px] text-slate-400">
          {formatFullTimestamp(notification.createdAt)}
        </p>
      </div>
      <ChevronRight
        aria-hidden="true"
        className="mt-[10px] h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-[1px] group-hover:text-lrfap-navy"
      />
    </button>
  );
}

// ---- Empty + loading ------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-[12px] border border-dashed border-lrfap-ghost bg-white/60 px-6 py-[80px] text-center">
      <BellOff
        aria-hidden="true"
        className="h-[56px] w-[56px] text-slate-300"
        strokeWidth={1.5}
      />
      <h2 className="font-display text-[20px] font-bold text-lrfap-navy">
        No notifications yet
      </h2>
      <p className="max-w-[420px] font-sans text-[13px] text-slate-600">
        You&apos;ll see application updates, match results, and reminders here.
      </p>
    </div>
  );
}

function SkeletonRows() {
  return (
    <ul role="list" aria-busy="true" className="flex flex-col gap-[10px]">
      {[0, 1, 2, 3].map((i) => (
        <li
          key={i}
          className="h-[80px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50"
        />
      ))}
    </ul>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-[40px] md:px-8">
      <div className="flex flex-col gap-[24px]">{children}</div>
    </div>
  );
}

// ---- Type → icon map ------------------------------------------------

function iconForType(type: NotificationType | string) {
  switch (type) {
    case 'application_submitted':
      return FileCheck;
    case 'ranking_submitted':
      return ListOrdered;
    case 'match_published':
      return CheckCircle;
    case 'offer_received':
      return Mail;
    case 'offer_expiring_soon':
      return AlertTriangle;
    case 'system':
    default:
      return Bell;
  }
}

function toneForType(type: NotificationType | string): {
  bg: string;
  text: string;
} {
  switch (type) {
    case 'match_published':
      return { bg: 'bg-green-50', text: 'text-green-700' };
    case 'offer_expiring_soon':
      return { bg: 'bg-amber-50', text: 'text-amber-700' };
    case 'offer_received':
      return { bg: 'bg-sky-50', text: 'text-sky-700' };
    default:
      return { bg: 'bg-lrfap-ghost', text: 'text-lrfap-navy' };
  }
}

// ---- Date bucketing -------------------------------------------------

type BucketKey = 'today' | 'yesterday' | 'this-week' | 'earlier';

interface Bucket {
  key: BucketKey;
  label: string;
  items: Notification[];
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function bucketByRecency(list: Notification[]): Bucket[] {
  const today = startOfDay(new Date()).getTime();
  const yesterday = today - 86_400_000;
  const weekAgo = today - 7 * 86_400_000;

  const buckets: Record<BucketKey, Notification[]> = {
    today: [],
    yesterday: [],
    'this-week': [],
    earlier: [],
  };

  for (const n of list) {
    const ts = new Date(n.createdAt).getTime();
    if (Number.isNaN(ts)) {
      buckets.earlier.push(n);
      continue;
    }
    const dayStart = startOfDay(new Date(ts)).getTime();
    if (dayStart >= today) buckets.today.push(n);
    else if (dayStart === yesterday) buckets.yesterday.push(n);
    else if (dayStart > weekAgo) buckets['this-week'].push(n);
    else buckets.earlier.push(n);
  }

  const ordered: Bucket[] = [
    { key: 'today', label: 'Today', items: buckets.today },
    { key: 'yesterday', label: 'Yesterday', items: buckets.yesterday },
    { key: 'this-week', label: 'This Week', items: buckets['this-week'] },
    { key: 'earlier', label: 'Earlier', items: buckets.earlier },
  ];
  return ordered.filter((b) => b.items.length > 0);
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

function formatFullTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

