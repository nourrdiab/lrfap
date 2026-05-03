import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Menu } from 'lucide-react';
import { MobileDrawer } from '../public/MobileDrawer';

/**
 * Shared navbar for every auth page (/login, /register, /forgot-password,
 * /reset-password). Both AuthLayout (split) and CenteredAuthLayout use this
 * so the chrome is identical regardless of body layout.
 *
 * White background with navy type + logo-navy.png, 0.91 px ghost bottom
 * border. The CTA on the right swaps based on the current path: on
 * /register we offer SIGN IN as the way back; on every other auth page we
 * offer CREATE ACCOUNT. Keeps the CTA useful for someone who lands on the
 * wrong page.
 *
 * Below md the secondary links (PROGRAMS / ABOUT / Back to home) collapse
 * into the shared MobileDrawer; the CTA pill stays in the topbar so the
 * primary action is always reachable.
 */

const AUX_LINK_CLS =
  'font-sans text-[16.49px] font-normal text-lrfap-navy transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lrfap-navy';

export function AuthNavbar() {
  const { pathname } = useLocation();
  const isRegister = pathname === '/register';
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const ctaTarget = isRegister ? '/login' : '/register';
  const ctaLabel = isRegister ? 'SIGN IN' : 'CREATE ACCOUNT';

  return (
    <header className="w-full border-b-[0.91px] border-lrfap-ghost bg-white">
      <div className="mx-auto flex w-full max-w-[1366px] items-center px-6 pt-[31px] pb-[22px] md:px-[58px]">
        <Link
          to="/"
          className="block shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lrfap-navy"
          aria-label="LRFAP — home"
        >
          <img
            src="/logos/logo-navy.png"
            alt="LRFAP — Lebanese Residency and Fellowship Application Program"
            className="h-[40px] w-auto md:h-[48.5px]"
            draggable={false}
          />
        </Link>

        {/* Desktop chrome */}
        <nav
          aria-label="Auth chrome"
          className="ml-auto hidden items-center gap-[24px] md:flex md:gap-[40px]"
        >
          <Link to="/programs" className={AUX_LINK_CLS}>
            PROGRAMS
          </Link>
          <Link to="/about" className={AUX_LINK_CLS}>
            ABOUT
          </Link>
          <Link to="/" className={`${AUX_LINK_CLS} inline-flex items-center gap-[8px]`}>
            <ArrowLeft aria-hidden="true" className="h-[18px] w-[18px]" />
            <span>Back to home</span>
          </Link>
          {isRegister ? (
            <Link
              to="/login"
              className="inline-flex h-[40.67px] shrink-0 items-center justify-center border-[0.91px] border-lrfap-navy px-[22px] font-sans text-[16.49px] font-normal text-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lrfap-navy"
            >
              SIGN IN
            </Link>
          ) : (
            <Link
              to="/register"
              className="inline-flex shrink-0 items-center justify-center border-[0.91px] border-lrfap-navy font-sans text-[16.49px] font-normal text-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lrfap-navy"
              style={{ width: '198.36px', height: '40.67px' }}
            >
              CREATE ACCOUNT
            </Link>
          )}
        </nav>

        {/* Mobile: CTA pill stays + hamburger opens drawer */}
        <div className="ml-auto flex items-center gap-[12px] md:hidden">
          <Link
            to={ctaTarget}
            className="inline-flex h-[36px] shrink-0 items-center justify-center border-[0.91px] border-lrfap-navy px-[14px] font-sans text-[13px] font-normal text-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lrfap-navy"
          >
            {ctaLabel}
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            aria-controls="auth-mobile-drawer"
            className="inline-flex h-[40px] w-[40px] items-center justify-center border-[0.91px] border-lrfap-navy text-lrfap-navy focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lrfap-navy"
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
      </div>

      <MobileDrawer
        id="auth-mobile-drawer"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        links={[
          { to: '/programs', label: 'PROGRAMS' },
          { to: '/about', label: 'ABOUT' },
          {
            to: '/',
            label: 'Back to home',
            end: true,
            icon: <ArrowLeft className="h-[18px] w-[18px]" />,
          },
        ]}
      />
    </header>
  );
}
