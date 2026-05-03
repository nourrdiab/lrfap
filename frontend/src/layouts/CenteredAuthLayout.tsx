import { Outlet } from 'react-router-dom';
import { AuthNavbar } from '../components/auth/AuthNavbar';
import { PublicFooter } from '../components/public/PublicFooter';

/**
 * Centered-layout auth shell — used by /forgot-password and /reset-password,
 * where the task is a single-field ask. The photo column from AuthLayout
 * would make these pages feel heavier than their content warrants, so we
 * drop it and center the card across the full viewport width instead.
 *
 * Everything else matches AuthLayout: same AuthNavbar, same gradient, same
 * card styling, same PublicFooter.
 */
export function CenteredAuthLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <AuthNavbar />

      <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-white via-[#f7f9fc] to-[#ebeef5] px-6 py-[60px]">
        <Outlet />
      </main>

      <PublicFooter />
    </div>
  );
}
