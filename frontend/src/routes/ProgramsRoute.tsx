import { useAuth } from '../hooks/useAuth';
import { ApplicantLayout } from '../layouts/ApplicantLayout';
import { LGCLayout } from '../layouts/LGCLayout';
import { PublicLayout } from '../layouts/PublicLayout';
import { UniversityLayout } from '../layouts/UniversityLayout';

/**
 * Layout chooser for the public-or-private /programs route.
 *
 * Picks the chrome based on whether (and how) the user is signed in:
 *   - unauthenticated → PublicLayout (white navbar variant via
 *     PublicLayout's existing pathname check)
 *   - authenticated applicant → ApplicantLayout (ApplicantNavBar)
 *   - authenticated university → UniversityLayout
 *   - authenticated LGC → LGCLayout
 *
 * Each layout renders <Outlet />, which matches the index child route
 * (ProgramCatalogPage) defined under this layout chooser in App.tsx.
 *
 * During isBootstrapping, falls through to the unauthenticated branch so
 * public visitors see the page immediately. Authenticated users on a hard
 * reload get a brief navbar swap once bootstrap resolves — acceptable.
 */
export function ProgramsRoute() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated || !user) return <PublicLayout />;

  switch (user.role) {
    case 'applicant':
      return <ApplicantLayout />;
    case 'university':
      return <UniversityLayout />;
    case 'lgc':
      return <LGCLayout />;
    default:
      return <PublicLayout />;
  }
}
