import { motion, MotionConfig } from 'framer-motion';
import { Mail } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { AboutStatsStrip } from '../../components/public/about/AboutStatsStrip';

/**
 * Public About page — single-scroll, anchored sections, mostly static
 * copy (plus one live-stats strip that fails silently).
 *
 * Typography and color follow the landing page's visual vocabulary
 * (font-display for headings, font-sans for body, navy primary, sky
 * accent, max-w-[1366px] container with 58px desktop / 24px mobile
 * padding, 0.91px borders, no rounded corners). PublicLayout provides
 * the solid navy navbar and the footer — this page only renders its
 * inner content.
 *
 * Every section has an id so future deep-links (/about#matching) work
 * without routing changes.
 */

// TODO: replace with real support email before production.
const CONTACT_EMAIL = 'support@lrfap.lb';

const MATCHING_STEPS: Array<{
  number: string;
  title: string;
  body: string;
}> = [
  {
    number: '01',
    title: 'Applicants rank their preferred programs',
    body: 'After submitting a single verified application, each applicant orders the programs they want, most-preferred first.',
  },
  {
    number: '02',
    title: 'Universities review and rank candidates',
    body: 'Program offices review applications, request interviews or additional data, and submit their own ranked list of candidates.',
  },
  {
    number: '03',
    title: 'The LGC runs the matching algorithm',
    body: 'A stable matching algorithm produces a stable match that is optimal for applicants, given both sides’ rankings.',
  },
  {
    number: '04',
    title: 'Results publish to everyone at once',
    body: 'Applicants and programs see results simultaneously. Accepted offers move into a 48-hour acceptance window, ensuring all participants receive their match outcome and respond on the same timeline.',
  },
];

const ROLES: Array<{
  id: string;
  title: string;
  body: string;
}> = [
  {
    id: 'applicants',
    title: 'Applicants',
    body: 'Medical graduates applying for residency or fellowship training. Applicants build one profile, upload required documents once, browse programs, rank preferences, and view their match result.',
  },
  {
    id: 'universities',
    title: 'Universities',
    body: 'Participating Lebanese universities and their program offices. Staff review submissions, request interviews, record notes, and submit ranked candidate lists for each program they operate.',
  },
  {
    id: 'lgc',
    title: 'LRFAP Governance Committee',
    body: 'The national body that operates the platform. The LGC manages cycles, runs the matching algorithm, publishes results, and reviews a complete audit trail of every action on the platform.',
  },
];

export default function AboutPage() {
  useDocumentTitle('About');

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col">
        <HeroStrip />
        <AboutStatsStrip />
        <AboutImageStrip />
        <MissionVision />
        <HowMatchingWorks />
        <WhoUses />
        <Governance />
        <Contact />
      </div>
    </MotionConfig>
  );
}

// ---- Hero strip --------------------------------------------------------

function HeroStrip() {
  return (
    <section
      id="intro"
      aria-labelledby="about-hero-heading"
      className="relative isolate w-full bg-lrfap-navy text-white"
    >
      <div className="mx-auto w-full max-w-[1366px] px-6 py-[100px] md:px-[58px] md:py-[160px]">
        <motion.h1
          id="about-hero-heading"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="max-w-[960px] font-display text-[32px] font-extrabold leading-[1.1] md:text-[48px]"
        >
          One unified system for residency and fellowship matching in
          Lebanon.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
          className="mt-[18px] max-w-[760px] font-sans text-[16px] leading-[1.55] text-white/85 md:text-[18px]"
        >
          LRFAP connects applicants, participating universities, and the
          national oversight committee on a single platform. One
          application produces one transparent, verifiable match.
        </motion.p>
      </div>
    </section>
  );
}

// ---- Decorative image strip --------------------------------------------

function AboutImageStrip() {
  return (
    <section aria-hidden="true" className="w-full bg-white">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="mx-auto w-full max-w-[1366px] px-6 md:px-[58px]"
      >
        <img
          src="/images/about-image.jpg"
          alt=""
          aria-hidden="true"
          draggable={false}
          className="h-[320px] w-full object-cover md:h-[480px]"
        />
      </motion.div>
    </section>
  );
}

// ---- Mission & vision --------------------------------------------------

function MissionVision() {
  return (
    <section
      id="mission"
      aria-labelledby="mission-heading"
      className="w-full bg-white"
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="mx-auto w-full max-w-[1366px] px-6 py-[40px] md:px-[58px] md:py-[64px]"
      >
        <h2
          id="mission-heading"
          className="font-display text-[24px] font-extrabold uppercase tracking-wide text-lrfap-navy md:text-[32px]"
        >
          Mission &amp; vision
        </h2>
        <div className="mt-[32px] grid grid-cols-1 gap-[28px] md:grid-cols-2 md:gap-[48px]">
          <div className="flex flex-col gap-[12px]">
            <h3 className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-lrfap-navy/60">
              Mission
            </h3>
            <p className="font-display text-[20px] font-bold leading-[1.3] text-lrfap-navy md:text-[22px]">
              Centralize, standardize, and modernize residency and
              fellowship matching in Lebanon.
            </p>
            <p className="font-sans text-[14px] leading-[1.6] text-lrfap-navy md:text-[15px]">
              Applicants and universities have historically worked across
              fragmented applications and manual coordination, where
              ranking errors often went undetected until after results
              were published. LRFAP replaces that with one verified
              application per applicant, one official program catalog,
              and one audited matching run.
            </p>
          </div>
          <div className="flex flex-col gap-[12px]">
            <h3 className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-lrfap-navy/60">
              Vision
            </h3>
            <p className="font-display text-[20px] font-bold leading-[1.3] text-lrfap-navy md:text-[22px]">
              A single source of truth, where every match is fair,
              automated, and explainable.
            </p>
            <p className="font-sans text-[14px] leading-[1.6] text-lrfap-navy md:text-[15px]">
              Applicants, universities, and the LGC should all see the
              same data, the same rankings, and the same results, at the
              same time. LRFAP is the platform that makes this possible.
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

// ---- How matching works ------------------------------------------------

function HowMatchingWorks() {
  return (
    <section
      id="matching"
      aria-labelledby="matching-heading"
      className="w-full bg-white"
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="mx-auto w-full max-w-[1366px] px-6 py-[40px] md:px-[58px] md:py-[64px]"
      >
        <h2
          id="matching-heading"
          className="font-display text-[24px] font-extrabold uppercase tracking-wide text-lrfap-navy md:text-[32px]"
        >
          How matching works
        </h2>
        <p className="mt-[12px] max-w-[720px] font-sans text-[14px] leading-[1.6] text-lrfap-navy md:text-[15px]">
          The platform runs a stable matching algorithm. The result is
          stable: no applicant and program pair can both prefer each
          other over the partners they were matched with. The algorithm
          is configured to be applicant-optimal.
        </p>
        <ol className="mt-[32px] grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          {MATCHING_STEPS.map((step) => (
            <li
              key={step.number}
              className="flex flex-col gap-[10px] rounded-xl bg-white p-[22px] shadow-[0_4px_24px_-12px_rgba(38,43,102,0.15)]"
            >
              <span
                aria-hidden="true"
                className="font-display text-[32px] font-extrabold leading-none text-lrfap-ghost"
              >
                {step.number}
              </span>
              <h3 className="font-display text-[15px] font-bold uppercase tracking-wide text-lrfap-navy">
                {step.title}
              </h3>
              <p className="font-sans text-[13px] leading-[1.55] text-lrfap-navy">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </motion.div>
    </section>
  );
}

// ---- Who uses the platform --------------------------------------------

function WhoUses() {
  return (
    <section
      id="roles"
      aria-labelledby="roles-heading"
      className="w-full bg-white"
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="mx-auto w-full max-w-[1366px] px-6 py-[40px] md:px-[58px] md:py-[64px]"
      >
        <h2
          id="roles-heading"
          className="font-display text-[24px] font-extrabold uppercase tracking-wide text-lrfap-navy md:text-[32px]"
        >
          Who uses the platform
        </h2>
        <div className="mt-[32px] grid grid-cols-1 gap-[18px] md:grid-cols-3">
          {ROLES.map((role) => (
            <article
              key={role.id}
              id={role.id}
              className="flex flex-col gap-[10px] rounded-xl bg-white p-[24px] shadow-[0_4px_24px_-12px_rgba(38,43,102,0.15)]"
            >
              <h3 className="font-display text-[18px] font-bold uppercase tracking-wide text-lrfap-navy">
                {role.title}
              </h3>
              <p className="font-sans text-[13px] leading-[1.6] text-lrfap-navy">
                {role.body}
              </p>
            </article>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

// ---- Governance -------------------------------------------------------

function Governance() {
  return (
    <section
      id="governance"
      aria-labelledby="governance-heading"
      className="w-full bg-white"
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="mx-auto w-full max-w-[1366px] px-6 py-[40px] md:px-[58px] md:py-[64px]"
      >
        <h2
          id="governance-heading"
          className="font-display text-[24px] font-extrabold uppercase tracking-wide text-lrfap-navy md:text-[32px]"
        >
          Governance
        </h2>
        <div className="mt-[24px] flex max-w-[860px] flex-col gap-[18px] font-sans text-[14px] leading-[1.7] text-lrfap-navy md:text-[15px]">
          <p>
            The platform is operated by the national LRFAP Governance
            Committee (LGC), which oversees match runs,
            validates applicant data, and publishes residency and
            fellowship placements across Lebanese universities.
          </p>
        </div>
      </motion.div>
    </section>
  );
}

// ---- Contact ----------------------------------------------------------

function Contact() {
  return (
    <section
      id="contact"
      aria-labelledby="contact-heading"
      className="w-full bg-white"
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="mx-auto w-full max-w-[1366px] px-6 py-[40px] md:px-[58px] md:py-[64px]"
      >
        <h2
          id="contact-heading"
          className="font-display text-[24px] font-extrabold uppercase tracking-wide text-lrfap-navy md:text-[32px]"
        >
          Contact
        </h2>
        <p className="mt-[16px] max-w-[720px] font-sans text-[14px] leading-[1.6] text-lrfap-navy md:text-[15px]">
          For questions about the platform, participating institutions,
          or the matching process, reach out below. Applicants with
          questions about their own submission should sign in and use
          the support channel on their dashboard.
        </p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="mt-[22px] inline-flex h-[44px] items-center justify-center gap-[10px] border-[0.91px] border-lrfap-navy bg-lrfap-navy px-[22px] font-sans text-[14px] font-medium uppercase tracking-wide text-white transition-colors hover:bg-lrfap-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
        >
          <Mail aria-hidden="true" className="h-4 w-4" />
          {CONTACT_EMAIL}
        </a>
      </motion.div>
    </section>
  );
}
