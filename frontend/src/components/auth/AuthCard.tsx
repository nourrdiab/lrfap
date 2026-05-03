import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

/**
 * Container for auth forms. Centers a white card (max-width 440 px) on the
 * soft gradient background supplied by AuthLayout.
 *
 * Visual treatment:
 *   - Square corners — matches the design system's sharp-edge language
 *     (inputs, pill buttons, nav CTAs are all square)
 *   - Navy-tinted soft drop shadow to lift the card off the gradient
 *   - 0.91 px ghost border retained for edge definition
 *
 * Animation: the card fades in and rises on mount (0.5 s, ease-out).
 * Form staggering lives at the page level because it's content-specific.
 */

interface AuthCardProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="w-full max-w-[400px] rounded-xl bg-white p-[36px] shadow-[0_20px_60px_-15px_rgba(38,43,102,0.2)]"
    >
      <header className="mb-[28px] text-center">
        <h1 className="font-display text-[26px] font-bold uppercase leading-tight tracking-wide text-lrfap-navy">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-[8px] font-sans text-[14px] leading-relaxed text-slate-600">
            {subtitle}
          </p>
        ) : null}
      </header>
      {children}
      {footer ? (
        <footer className="mt-[28px] border-t border-lrfap-ghost pt-[20px] text-center font-sans text-[13px] text-slate-600">
          {footer}
        </footer>
      ) : null}
    </motion.div>
  );
}
