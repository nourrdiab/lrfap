import { Outlet } from 'react-router-dom';
import { LGCNavBar } from '../components/lgc/LGCNavBar';
import { PublicFooter } from '../components/public/PublicFooter';

/**
 * Shell wrapping every /lgc/* route. ProtectedRoute gates access
 * (allow=['lgc']), so the navbar and footer can assume an authenticated
 * LGC committee user.
 *
 * Same chrome pattern as ApplicantLayout and UniversityLayout — one
 * visual system across all three authenticated portals.
 */
export function LGCLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <LGCNavBar />
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
