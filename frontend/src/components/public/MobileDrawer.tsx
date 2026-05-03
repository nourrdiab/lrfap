import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, NavLink } from 'react-router-dom';
import { X } from 'lucide-react';

/**
 * Shared top-down navy drawer used by both the public navbar and the auth
 * navbar at < md. Owns its own focus trap and body-scroll lock; callers
 * pass `open` / `onClose` and a list of links plus an optional pill CTA.
 */

export interface MobileDrawerLink {
  to: string;
  label: string;
  end?: boolean;
  icon?: ReactNode;
}

export interface MobileDrawerCta {
  to: string;
  label: string;
}

interface MobileDrawerProps {
  id: string;
  open: boolean;
  onClose: () => void;
  links: MobileDrawerLink[];
  cta?: MobileDrawerCta;
}

export function MobileDrawer({ id, open, onClose, links, cta }: MobileDrawerProps) {
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !drawerRef.current) return;
      const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="drawer"
          id={id}
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          initial={{ y: '-100%' }}
          animate={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed inset-x-0 top-0 z-40 bg-lrfap-navy text-white shadow-xl md:hidden"
        >
          <div className="flex items-center justify-between px-6 pt-[31px] pb-[22px]">
            <img
              src="/logos/logo-white.png"
              alt="LRFAP"
              className="h-[40px] w-auto"
              draggable={false}
            />
            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="inline-flex h-[40px] w-[40px] items-center justify-center border-[0.91px] border-white text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
          <ul role="list" className="flex flex-col gap-[28px] px-6 pt-[24px] pb-[40px]">
            {links.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-[10px] font-sans text-[22px] font-normal text-white transition-opacity ${
                      isActive ? 'opacity-100 underline underline-offset-[6px]' : 'opacity-90'
                    }`
                  }
                >
                  {item.icon ? <span aria-hidden="true">{item.icon}</span> : null}
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
            {cta ? (
              <li className="mt-[8px]">
                <Link
                  to={cta.to}
                  onClick={onClose}
                  className="inline-flex h-[40.67px] shrink-0 items-center justify-center border-[0.91px] border-white px-[22px] font-sans text-[16.49px] font-normal text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  {cta.label}
                </Link>
              </li>
            ) : null}
          </ul>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
