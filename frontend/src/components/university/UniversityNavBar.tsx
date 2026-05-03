import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

/**
 * Authenticated navbar for the university portal. The portal is a single-
 * page experience (the dashboard), so the desktop bar carries one nav link
 * (Dashboard) plus the user dropdown. Mobile (< md) collapses the link —
 * tapping the logo navigates to the same destination.
 */

interface NavLinkDef {
  to: string;
  label: string;
  end?: boolean;
}

const NAV_LINKS: NavLinkDef[] = [
  { to: '/university', label: 'Dashboard', end: true },
];

const DESKTOP_LINK_CLS =
  'relative font-sans text-[16.49px] font-normal uppercase text-lrfap-navy transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lrfap-navy';

function initialsOf(firstName?: string, lastName?: string, email?: string) {
  const f = firstName?.trim()?.[0];
  const l = lastName?.trim()?.[0];
  if (f && l) return `${f}${l}`.toUpperCase();
  if (f) return f.toUpperCase();
  if (email) return email.trim()[0]?.toUpperCase() ?? '?';
  return '?';
}

export function UniversityNavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [dropdownOpen, setDropdownOpen] = useState(false);

  const initials = initialsOf(user?.firstName, user?.lastName, user?.email);
  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : (user?.firstName ?? user?.email ?? 'reviewer');

  useEffect(() => {
    setDropdownOpen(false);
  }, [location.pathname]);

  async function handleSignOut() {
    setDropdownOpen(false);
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="relative z-30 w-full border-b-[0.91px] border-lrfap-ghost bg-white">
      <div className="mx-auto flex w-full max-w-[1366px] items-center px-6 pt-[22px] pb-[18px] md:px-[58px]">
        <Link
          to="/university"
          className="block shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lrfap-navy"
          aria-label="LRFAP — university dashboard"
        >
          <img
            src="/logos/logo-navy.png"
            alt="LRFAP"
            className="h-[40px] w-auto md:h-[48.5px]"
            draggable={false}
          />
        </Link>

        {/* Desktop: nav link + user dropdown */}
        <nav
          aria-label="University navigation"
          className="ml-auto hidden items-center gap-[40px] md:flex"
        >
          <ul className="flex items-center gap-[24px] lg:gap-[48px]" role="list">
            {NAV_LINKS.map((item) => (
              <li key={item.to} className="relative">
                <NavLink to={item.to} end={item.end} className={DESKTOP_LINK_CLS}>
                  {({ isActive }) => (
                    <>
                      <span className="block py-[6px]">{item.label}</span>
                      {isActive ? (
                        <motion.span
                          layoutId="university-navbar-underline"
                          aria-hidden="true"
                          className="absolute inset-x-0 -bottom-[2px] h-[2px] bg-lrfap-navy"
                          transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                        />
                      ) : null}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          <UserDropdown
            open={dropdownOpen}
            setOpen={setDropdownOpen}
            initials={initials}
            displayName={displayName}
            email={user?.email}
            onSignOut={handleSignOut}
          />
        </nav>

        {/* Mobile: dropdown only — logo doubles as the Dashboard link */}
        <div className="ml-auto md:hidden">
          <UserDropdown
            open={dropdownOpen}
            setOpen={setDropdownOpen}
            initials={initials}
            displayName={displayName}
            email={user?.email}
            onSignOut={handleSignOut}
          />
        </div>
      </div>
    </header>
  );
}

interface UserDropdownProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  initials: string;
  displayName: string;
  email?: string;
  onSignOut: () => void | Promise<void>;
}

function UserDropdown({
  open,
  setOpen,
  initials,
  displayName,
  email,
  onSignOut,
}: UserDropdownProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, setOpen]);

  function handleTriggerKey(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' && !open) {
      event.preventDefault();
      setOpen(true);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onKeyDown={handleTriggerKey}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${displayName}`}
        className="inline-flex items-center gap-[8px] rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lrfap-navy"
      >
        <span
          aria-hidden="true"
          className="inline-flex h-[36px] w-[36px] items-center justify-center rounded-full bg-lrfap-navy font-sans text-[13px] font-semibold text-white"
        >
          {initials}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 text-lrfap-navy transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            aria-label="Account options"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-[10px] w-[240px] border-[0.91px] border-lrfap-ghost bg-white shadow-[0_10px_40px_-12px_rgba(38,43,102,0.15)]"
          >
            <div className="border-b border-lrfap-ghost px-[16px] py-[14px]">
              <p className="font-sans text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Signed in as
              </p>
              <p className="mt-[2px] truncate font-sans text-[14px] font-medium text-lrfap-navy">
                {displayName}
              </p>
              {email ? (
                <p className="mt-[2px] truncate font-sans text-[12px] text-slate-500">
                  {email}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => void onSignOut()}
              className="inline-flex w-full items-center gap-[10px] px-[16px] py-[12px] font-sans text-[14px] text-lrfap-navy transition-colors hover:bg-lrfap-ghost focus-visible:bg-lrfap-ghost focus-visible:outline-none"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              Sign out
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
