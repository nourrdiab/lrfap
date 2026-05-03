import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

interface Section {
  id: string;
  title: string;
  body: ReactNode;
}

const SUPPORT_EMAIL_LINK = (
  <a
    href="mailto:support@lrfap.lb"
    className="font-medium text-lrfap-sky underline-offset-4 hover:underline"
  >
    support@lrfap.lb
  </a>
);

const SECTIONS: Section[] = [
  {
    id: 'how-to-get-help',
    title: 'How to Get Help',
    body: (
      <>
        <p>
          For technical issues, account questions, document upload problems,
          or general inquiries, contact our support team at{' '}
          {SUPPORT_EMAIL_LINK}. Please include your account email, a clear
          description of the issue, and any error messages or screenshots
          that may help us resolve your case faster.
        </p>
        <p>
          We typically respond within two business days during the active
          cycle and within five business days outside the cycle window.
          Urgent issues affecting application deadlines are prioritized.
        </p>
      </>
    ),
  },
  {
    id: 'common-issues',
    title: 'Common Issues',
    body: (
      <div className="flex flex-col gap-[24px]">
        <div>
          <h3 className="font-display text-[15px] font-semibold uppercase tracking-wide text-lrfap-navy">
            Forgot password
          </h3>
          <p className="mt-[8px]">
            Use the &ldquo;Forgot password?&rdquo; link on the sign-in page
            to receive a reset email. If you do not receive the email within
            ten minutes, check your spam folder or contact support.
          </p>
        </div>
        <div>
          <h3 className="font-display text-[15px] font-semibold uppercase tracking-wide text-lrfap-navy">
            Cannot upload a document
          </h3>
          <p className="mt-[8px]">
            Documents must be in PDF format and under 10 MB per file. If
            your document is in another format, convert it to PDF before
            uploading. If the file size is too large, compress the PDF or
            split it into smaller sections.
          </p>
        </div>
        <div>
          <h3 className="font-display text-[15px] font-semibold uppercase tracking-wide text-lrfap-navy">
            Application not visible after submission
          </h3>
          <p className="mt-[8px]">
            After submitting an application, allow up to a few minutes for
            it to appear in your dashboard. If the application is still
            missing after thirty minutes, contact support with your account
            email.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'support-by-role',
    title: 'Support for Different Roles',
    body: (
      <p>
        For help with registration, applications, document uploads, or match
        results, contact support@lrfap.lb.
      </p>
    ),
  },
  {
    id: 'support-hours',
    title: 'Support Hours and Response Time',
    body: (
      <>
        <p>
          Support inquiries are answered Monday through Friday, excluding
          national holidays. We aim to acknowledge every inquiry within one
          business day and resolve standard issues within two business
          days. Complex cases may take longer, and you will be kept
          informed throughout the process.
        </p>
        <p>
          During matching cycle deadlines, support volume is higher. We
          recommend submitting non-urgent requests well before deadline
          windows to ensure timely handling.
        </p>
      </>
    ),
  },
  {
    id: 'still-need-help',
    title: 'Still Need Help?',
    body: (
      <>
        <p>
          If you have read through these resources and still have
          questions, please reach out:
        </p>
        <p>{SUPPORT_EMAIL_LINK}</p>
        <p>
          You may also find answers in our{' '}
          <Link
            to="/faqs"
            className="font-medium text-lrfap-sky underline-offset-4 hover:underline"
          >
            FAQs
          </Link>
          .
        </p>
      </>
    ),
  },
];

export default function SupportPage() {
  useDocumentTitle('Support');
  const reduceMotion = useReducedMotion();
  const headingVariants = reduceMotion
    ? { hidden: {}, visible: {} }
    : { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } };

  const [activeId, setActiveId] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        visible.sort(
          (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
        );
        setActiveId(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  function handleTocClick(e: MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
    history.replaceState(null, '', `#${id}`);
  }

  return (
    <article className="mx-auto w-full max-w-[1366px] px-6 py-[40px] md:px-[58px] md:py-[64px]">
      <motion.header
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.1 } },
        }}
        className="flex flex-col gap-[12px]"
      >
        <motion.h1
          variants={headingVariants}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="font-display text-[32px] font-extrabold leading-[1.05] text-lrfap-navy md:text-[40px]"
        >
          SUPPORT
        </motion.h1>
        <motion.p
          variants={headingVariants}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="font-sans text-[14px] text-lrfap-navy md:text-[15px]"
        >
          Get help with your account, applications, and the matching cycle.
        </motion.p>
      </motion.header>

      <div className="mt-[48px] flex flex-col gap-[48px] lg:flex-row lg:items-start lg:justify-between lg:gap-[48px]">
        <div className="flex w-full max-w-[800px] flex-col gap-[48px]">
          {SECTIONS.map((section, i) => (
            <section key={section.id} aria-labelledby={section.id}>
              <h2
                id={section.id}
                className="scroll-mt-[40px] font-display text-[18px] font-bold uppercase tracking-wide text-lrfap-navy md:text-[20px]"
              >
                {i + 1}. {section.title}
              </h2>
              <div className="mt-[12px] flex flex-col gap-[12px] font-sans text-[14px] leading-[1.65] text-lrfap-navy md:text-[15px]">
                {section.body}
              </div>
            </section>
          ))}
        </div>

        <aside className="hidden w-[260px] shrink-0 lg:block">
          <nav
            aria-label="On this page"
            className="sticky top-[24px] rounded-xl bg-white p-[20px] shadow-[0_4px_24px_-12px_rgba(38,43,102,0.15)]"
          >
            <p className="font-display text-[12px] font-semibold uppercase tracking-wide text-lrfap-navy">
              On this page
            </p>
            <ul className="mt-[12px] flex flex-col">
              {SECTIONS.map((section, i) => {
                const isActive = activeId === section.id;
                return (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      onClick={(e) => handleTocClick(e, section.id)}
                      className={`block border-l-2 py-[6px] pl-[10px] font-sans text-[13px] transition-colors ${
                        isActive
                          ? 'border-lrfap-navy font-semibold text-lrfap-navy'
                          : 'border-transparent text-lrfap-navy/70 hover:text-lrfap-navy'
                      }`}
                    >
                      {i + 1}. {section.title}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>
      </div>
    </article>
  );
}
