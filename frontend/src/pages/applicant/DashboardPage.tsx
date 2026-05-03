import { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuth } from '../../hooks/useAuth';
import { dashboardApi } from '../../api/dashboard';
import { notificationsApi } from '../../api/notifications';
import type {
  ApplicantDashboard,
  DashboardApplication,
  ID,
  Notification,
} from '../../types';
import { ActiveApplicationCard } from '../../components/applicant/dashboard/ActiveApplicationCard';
import { ProfileCompletionBar } from '../../components/applicant/dashboard/ProfileCompletionBar';
import { NotificationPreviewList } from '../../components/applicant/dashboard/NotificationPreviewList';
import { QuickLinksGrid } from '../../components/applicant/dashboard/QuickLinksGrid';

/**
 * Applicant landing page after login. Pulls two endpoints in parallel:
 * `/dashboard/applicant` (pre-aggregated summary) and `/notifications`
 * (for the 3-row preview). The dashboard's `application` shape is thin
 * on purpose — users click through to /applicant/applications/:id for
 * the submission reference and full detail.
 */

type FetchStatus = 'idle' | 'loading' | 'loaded' | 'error';

export default function ApplicantDashboardPage() {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();

  const [dashboard, setDashboard] = useState<ApplicantDashboard | null>(null);
  const [dashboardStatus, setDashboardStatus] = useState<FetchStatus>('idle');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsStatus, setNotificationsStatus] = useState<FetchStatus>('idle');

  useEffect(() => {
    let cancelled = false;
    setDashboardStatus('loading');
    dashboardApi
      .applicant()
      .then((res) => {
        if (cancelled) return;
        setDashboard(res);
        setDashboardStatus('loaded');
      })
      .catch(() => {
        if (!cancelled) setDashboardStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setNotificationsStatus('loading');
    notificationsApi
      .list()
      .then((res) => {
        if (cancelled) return;
        setNotifications(res);
        setNotificationsStatus('loaded');
      })
      .catch(() => {
        // Notifications failing shouldn't blank the whole dashboard.
        // We treat this as an empty preview (the View-all link still
        // points at the full inbox).
        if (!cancelled) setNotificationsStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Pick the application tied to the active cycle. Backend enforces one
  // application per cycle, so at most one match is expected; if none is
  // tied to the active cycle but the applicant has some other app (past
  // cycle), we still pass `null` — the "none" branch of the card uses
  // `hasAnyApplication` to decide whether the Start CTA is enabled.
  const currentApplication = useMemo<DashboardApplication | null>(() => {
    if (!dashboard) return null;
    const activeId: ID | undefined = dashboard.activeCycle?.id;
    if (!activeId) return null;
    const match = dashboard.applications.find((a) => {
      const cid = typeof a.cycle === 'string' ? a.cycle : a.cycle?._id;
      return cid === activeId;
    });
    return match ?? null;
  }, [dashboard]);

  const hasAnyApplication = useMemo<boolean>(() => {
    const c = dashboard?.checklist;
    if (!c) return false;
    return c.hasDraft || c.hasSubmitted || c.hasMatch;
  }, [dashboard]);

  const recentNotifications = useMemo(() => {
    // Defensive: the /notifications endpoint historically returned
    // `{ notifications: [...] }` rather than a bare array. The API
    // wrapper now unwraps it, but we still guard in case the wire shape
    // shifts again — the dashboard blowing up over a notifications
    // regression isn't worth the terseness.
    if (!Array.isArray(notifications)) return [];
    return notifications
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 3);
  }, [notifications]);

  const firstName = user?.firstName?.trim() || '';

  // ---- Loading ---------------------------------------------------------

  if (dashboardStatus === 'loading' || dashboardStatus === 'idle') {
    return (
      <PageShell>
        <div className="h-[48px] w-[320px] max-w-full animate-pulse bg-slate-100" />
        <div className="h-[220px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50" />
        <div className="h-[120px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50" />
        <div className="h-[220px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50" />
        <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2">
          <div className="h-[100px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50" />
          <div className="h-[100px] animate-pulse border-[0.91px] border-lrfap-ghost bg-slate-50" />
        </div>
      </PageShell>
    );
  }

  // ---- Error -----------------------------------------------------------

  if (dashboardStatus === 'error' || !dashboard) {
    return (
      <PageShell>
        <div
          role="alert"
          className="flex items-start gap-[10px] border-[0.91px] border-red-200 bg-red-50 px-[16px] py-[12px] font-sans text-[13px] text-red-800"
        >
          <AlertCircle aria-hidden="true" className="mt-[2px] h-4 w-4 shrink-0" />
          <span>
            Couldn&apos;t load your dashboard. Refresh the page to try again.
          </span>
        </div>
      </PageShell>
    );
  }

  // ---- Content ---------------------------------------------------------

  const showProfileBar =
    typeof dashboard.profileCompletion === 'number' &&
    dashboard.profileCompletion < 100;

  return (
    <PageShell>
      <header>
        <h1 className="font-display text-[36px] font-extrabold leading-[1.1] text-lrfap-navy md:text-[40px]">
          {user?.isFirstLogin
            ? firstName ? `Welcome, ${firstName}` : 'Welcome'
            : firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        </h1>
        <p className="mt-[8px] font-sans text-[14px] text-slate-600">
          Here&apos;s a quick look at your application status and recent
          activity.
        </p>
      </header>

      <ActiveApplicationCard
        application={currentApplication}
        activeCycle={dashboard.activeCycle ?? null}
        hasAnyApplication={hasAnyApplication}
      />

      {showProfileBar ? (
        <ProfileCompletionBar value={dashboard.profileCompletion} />
      ) : null}

      <NotificationPreviewList
        notifications={notificationsStatus === 'error' ? [] : recentNotifications}
      />

      <QuickLinksGrid />
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-[40px] md:px-8">
      <div className="flex flex-col gap-[32px]">{children}</div>
    </div>
  );
}
