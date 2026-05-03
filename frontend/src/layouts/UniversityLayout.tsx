import { Outlet } from 'react-router-dom';
import { UniversityNavBar } from '../components/university/UniversityNavBar';
import { PublicFooter } from '../components/public/PublicFooter';

/**
 * Shell wrapping every /university/* route. ProtectedRoute gates access
 * (allow=['university']), so the navbar and footer can assume an
 * authenticated university reviewer.
 *
 * Same chrome as ApplicantLayout — one visual system across both
 * authenticated portals. No NotificationsProvider yet: the university
 * navbar currently has no bell (see UniversityNavBar for the reasoning),
 * and the Dashboard fetches its own notifications inline for the Recent
 * Activity section. When a /university/notifications page ships, add the
 * provider here and the bell in the navbar.
 */
export function UniversityLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <UniversityNavBar />
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
