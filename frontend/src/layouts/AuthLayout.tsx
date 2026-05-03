import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AuthNavbar } from '../components/auth/AuthNavbar';
import { PublicFooter } from '../components/public/PublicFooter';

/**
 * Split-layout auth shell — used by /login and /register, where the task
 * has enough structure (multi-field forms, choice of paths) to deserve the
 * grounding of a full-bleed photograph on the right.
 *
 *   Body (md and up, 50 / 50 split):
 *     - Left: form column with subtle white → cool-gray gradient and
 *       60 px vertical padding. Card is centered both axes.
 *     - Right: full-bleed photograph, touches navbar at top and footer
 *       at bottom with no gap. Slides in from the right 0.2 s after the
 *       card appears so the card lands first.
 *
 *   Below md the photo is hidden and the form takes full width.
 *
 * For single-field tasks (/forgot-password, /reset-password) use
 * CenteredAuthLayout instead — the photo would make those pages feel
 * heavier than the content warrants.
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 md:min-h-[1260px]">
      <AuthNavbar />

      <main className="flex flex-1 flex-col md:flex-row">
        <section className="flex flex-1 items-center justify-center bg-gradient-to-b from-white via-[#f7f9fc] to-[#ebeef5] px-6 py-[60px] md:w-1/2 md:flex-none lg:px-[48px]">
          <Outlet />
        </section>

        <motion.aside
          aria-hidden="true"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }}
          className="relative hidden md:block md:w-1/2 md:flex-none"
        >
          <img
            src="/images/auth-background2.jpg"
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        </motion.aside>
      </main>

      <PublicFooter />
    </div>
  );
}
