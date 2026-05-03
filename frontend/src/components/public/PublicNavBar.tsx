import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { MobileDrawer } from './MobileDrawer';

/**
 * Unified public-area navigation bar.
 *
 * Figma-locked geometry (do not alter without re-measuring):
 *   - Container: max-width 1366 px, 58 px horizontal padding
 *   - Logo: 48.5 px tall
 *   - Nav text: Montserrat 400 / 16.49 px / white
 *   - GET STARTED pill: 198.36 × 40.67 px, 0.91 px white stroke, square corners
 *   - SIGN IN pill: auto width with 22 px horizontal padding, h 40.67 px,
 *     0.91 px stroke, square corners — pairs with GET STARTED via shared
 *     height/border/corners (not width, which creates awkward whitespace
 *     when labels have different lengths).
 *
 * Variants:
 *   - transparent: floats over the landing hero photograph
 *   - solid:       navy background for inner public routes (Programs, About)
 */

type Variant = 'transparent' | 'solid' | 'white';

interface NavLinkDef {
  to: string;
  label: string;
  end?: boolean;
}

const NAV_LINKS: NavLinkDef[] = [
  { to: '/', label: 'HOME', end: true },
  { to: '/programs', label: 'PROGRAMS' },
  { to: '/about', label: 'ABOUT' },
];

const LINK_BASE =
  'relative font-sans text-[16.49px] font-normal text-white transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white';

const GET_STARTED_CLS =
  'inline-flex shrink-0 items-center justify-center border-[0.91px] border-white font-sans text-[16.49px] font-normal text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white';

const SIGN_IN_CLS =
  'inline-flex h-[40.67px] shrink-0 items-center justify-center border-[0.91px] border-white px-[22px] font-sans text-[16.49px] font-normal text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white';

const LINK_DARK =
  'relative font-sans text-[16.49px] font-normal text-lrfap-navy transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lrfap-navy';

const GET_STARTED_DARK =
  'inline-flex shrink-0 items-center justify-center border-[0.91px] border-lrfap-navy font-sans text-[16.49px] font-normal text-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lrfap-navy';

const SIGN_IN_DARK =
  'inline-flex h-[40.67px] shrink-0 items-center justify-center border-[0.91px] border-lrfap-navy px-[22px] font-sans text-[16.49px] font-normal text-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lrfap-navy';

interface PublicNavBarProps {
  variant?: Variant;
}

export function PublicNavBar({ variant = 'solid' }: PublicNavBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close drawer on route change.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const isWhite = variant === 'white';
  const navBg =
    variant === 'transparent'
      ? 'bg-transparent'
      : isWhite
        ? 'bg-white border-b border-lrfap-navy/10'
        : 'bg-lrfap-navy';
  const linkCls = isWhite ? LINK_DARK : LINK_BASE;
  const signInCls = isWhite ? SIGN_IN_DARK : SIGN_IN_CLS;
  const getStartedCls = isWhite ? GET_STARTED_DARK : GET_STARTED_CLS;
  const mobileBtnCls = isWhite
    ? 'inline-flex h-[40px] w-[40px] items-center justify-center border-[0.91px] border-lrfap-navy text-lrfap-navy focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lrfap-navy'
    : 'inline-flex h-[40px] w-[40px] items-center justify-center border-[0.91px] border-white text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white';
  const underlineColor = isWhite ? 'bg-lrfap-navy' : 'bg-white';
  const logoSrc = isWhite ? '/logos/logo-navy.png' : '/logos/logo-white.png';
  const logoFocus = isWhite
    ? 'focus-visible:outline-lrfap-navy'
    : 'focus-visible:outline-white';

  return (
    <nav
      aria-label="Primary"
      className={`relative z-30 w-full ${navBg}`}
    >
      <div className="mx-auto flex w-full max-w-[1366px] items-center px-6 pt-[31px] pb-[22px] md:px-[58px]">
        <Link
          to="/"
          className={`block shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 ${logoFocus}`}
          aria-label="LRFAP — home"
        >
          <img
            src={logoSrc}
            alt="LRFAP — Lebanese Residency and Fellowship Application Program"
            className="h-[40px] w-auto md:h-[48.5px]"
            draggable={false}
          />
        </Link>

        {/* Desktop links */}
        <ul
          className="ml-auto hidden items-center gap-[24px] md:flex lg:gap-[48px]"
          role="list"
        >
          {NAV_LINKS.map((item) => (
            <li key={item.to} className="relative">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `${linkCls} ${isActive ? 'opacity-100' : 'opacity-90'}`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="block py-[6px]">{item.label}</span>
                    {isActive ? (
                      <motion.span
                        layoutId="public-navbar-underline"
                        aria-hidden="true"
                        className={`absolute inset-x-0 -bottom-[2px] h-[2px] ${underlineColor}`}
                        transition={{
                          type: 'spring',
                          stiffness: 420,
                          damping: 38,
                        }}
                      />
                    ) : null}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Desktop right-side buttons */}
        <div className="hidden items-center gap-[18px] md:flex md:pl-[24px] lg:pl-[48px]">
          <Link to="/login" className={signInCls}>
            SIGN IN
          </Link>
          <Link
            to="/register"
            className={getStartedCls}
            style={{ width: '198.36px', height: '40.67px' }}
          >
            GET STARTED NOW
          </Link>
        </div>

        {/* Mobile: GET STARTED stays visible outside drawer, then hamburger */}
        <div className="ml-auto flex items-center gap-[14px] md:hidden">
          <Link
            to="/register"
            className={`${getStartedCls} h-[36px] px-[14px] text-[13px]`}
          >
            GET STARTED
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            aria-controls="public-mobile-drawer"
            className={mobileBtnCls}
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
      </div>

      <MobileDrawer
        id="public-mobile-drawer"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        links={NAV_LINKS}
        cta={{ to: '/login', label: 'SIGN IN' }}
      />
    </nav>
  );
}
