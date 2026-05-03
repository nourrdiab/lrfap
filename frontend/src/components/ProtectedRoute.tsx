import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
  allow?: UserRole[];
}

export function ProtectedRoute({ allow }: ProtectedRouteProps) {
  const { isAuthenticated, isBootstrapping, user } = useAuth();
  const location = useLocation();

  if (isBootstrapping) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allow && user && !allow.includes(user.role)) {
    // Authenticated but wrong role — send them to their own portal root.
    const roleHome =
      user.role === 'applicant'
        ? '/applicant'
        : user.role === 'university'
          ? '/university'
          : '/lgc';
    return <Navigate to={roleHome} replace />;
  }

  return <Outlet />;
}
