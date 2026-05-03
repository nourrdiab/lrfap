import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

interface Section {
  id: string;
  title: string;
  body: ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: 'introduction',
    title: 'Introduction',
    body: (
      <>
        <p>
          This Privacy Policy describes how the Lebanese Residency and
          Fellowship Application Program (&ldquo;LRFAP&rdquo;,
          &ldquo;we&rdquo;) collects, uses, stores, and protects your
          personal information when you use our platform. The platform is
          operated under the oversight of the LRFAP Governance Committee
          (&ldquo;LGC&rdquo;).
        </p>
        <p>
          By creating an account or using LRFAP, you agree to the practices
          described in this policy. If you do not agree, you should not use
          the platform.
        </p>
      </>
    ),
  },
  {
    id: 'information-collected',
    title: 'Information We Collect',
    body: (
      <>
        <p>
          We collect only the information necessary to facilitate the
          application and matching process. This includes:
        </p>
        <ul className="ml-[20px] list-disc space-y-[8px]">
          <li>
            Identifying information you provide during registration,
            including your full name, email address, and phone number.
          </li>
          <li>
            Academic records and supporting documents you upload, including
            transcripts, certificates, recommendation letters, examination
            results, and personal statements.
          </li>
          <li>
            Application content, including programs you apply to, your
            preference rankings, and any answers to program-specific
            questions.
          </li>
          <li>
            Account activity, including login times, actions taken on the
            platform, and communications with the LGC or universities
            through the platform.
          </li>
          <li>
            Technical information automatically collected during use,
            including browser type, device type, IP address, and timestamps
            for audit purposes.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'how-we-use',
    title: 'How We Use Your Information',
    body: (
      <>
        <p>
          Your information is used solely for purposes related to the
          residency and fellowship matching process. Specifically, we use it
          to:
        </p>
        <ul className="ml-[20px] list-disc space-y-[8px]">
          <li>
            Verify your identity and eligibility to participate in the
            matching cycle.
          </li>
          <li>
            Make your application materials available to programs you apply
            to.
          </li>
          <li>Run the matching algorithm and produce match results.</li>
          <li>
            Communicate with you about your application, deadlines, and
            platform updates.
          </li>
          <li>
            Maintain audit logs and records as required by LGC oversight
            policies.
          </li>
          <li>
            Detect and prevent fraud, abuse, or misuse of the platform.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'who-we-share-with',
    title: 'Who We Share Your Information With',
    body: (
      <>
        <p>
          We share your information only with parties directly involved in
          the application and matching process:
        </p>
        <ul className="ml-[20px] list-disc space-y-[8px]">
          <li>
            Universities you apply to receive your application materials,
            including documents and personal statement, for review purposes.
          </li>
          <li>
            The LRFAP Governance Committee receives oversight access to
            verify match integrity, audit application records, and handle
            disputes.
          </li>
          <li>
            Authorized service providers may process data on our behalf for
            technical infrastructure, including secure document storage and
            email delivery, under strict confidentiality agreements.
          </li>
        </ul>
        <p>
          We do not sell your personal information. We do not share your
          information with advertisers or with any party not directly
          involved in the matching process, except where required by law.
        </p>
      </>
    ),
  },
  {
    id: 'data-security',
    title: 'Document and Data Security',
    body: (
      <>
        <p>
          We use industry-standard security measures to protect your
          information, including encrypted connections for all data
          transmitted to and from the platform, encrypted storage of
          uploaded documents, access controls limiting who can view your
          data, and regular security reviews.
        </p>
        <p>
          While we take these measures seriously, no system is completely
          immune to security risks. You are responsible for maintaining the
          confidentiality of your account credentials and for notifying us
          promptly of any suspected unauthorized access.
        </p>
      </>
    ),
  },
  {
    id: 'data-retention',
    title: 'Data Retention',
    body: (
      <>
        <p>
          Your application data is retained for the duration of the active
          matching cycle and archived afterward according to LGC retention
          policies. Archived data may be kept for record-keeping, audit, and
          statistical reporting purposes.
        </p>
        <p>
          Deidentified or aggregated data, which cannot be used to identify
          you individually, may be retained indefinitely for research,
          reporting, and platform improvement purposes.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and Analytics',
    body: (
      <>
        <p>
          LRFAP uses minimal cookies and similar technologies, limited to
          what is necessary for the platform to function correctly. This
          includes session cookies that keep you signed in and preference
          cookies that remember your settings between visits.
        </p>
        <p>
          We do not use third-party advertising cookies or sell access to
          your browsing data. Aggregate analytics may be collected to
          understand platform usage and improve performance, but these
          analytics do not personally identify you.
        </p>
      </>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your Rights',
    body: (
      <>
        <p>
          You have the following rights regarding your personal information:
        </p>
        <ul className="ml-[20px] list-disc space-y-[8px]">
          <li>
            <strong className="font-semibold">Access.</strong> You may
            request a copy of the personal information we hold about you.
          </li>
          <li>
            <strong className="font-semibold">Correction.</strong> You may
            request that we correct any inaccurate or incomplete
            information.
          </li>
          <li>
            <strong className="font-semibold">Deletion.</strong> You may
            request deletion of your account and associated data, subject to
            applicable retention requirements and obligations from active
            match cycles.
          </li>
          <li>
            <strong className="font-semibold">Objection.</strong> You may
            object to certain uses of your information, where applicable.
          </li>
          <li>
            <strong className="font-semibold">Portability.</strong> You may
            request a copy of your information in a structured, commonly
            used format.
          </li>
        </ul>
        <p>
          To exercise any of these rights, contact us at support@lrfap.lb.
          We will respond to verified requests within thirty days.
        </p>
      </>
    ),
  },
  {
    id: 'policy-changes',
    title: 'Changes to This Policy',
    body: (
      <>
        <p>
          This Privacy Policy may be updated periodically to reflect changes
          in our practices, legal requirements, or platform features.
          Material changes will be communicated via in-platform notification
          or to the email address associated with your account.
        </p>
        <p>
          The &ldquo;Last updated&rdquo; date at the top of this document
          indicates the most recent revision. Continued use of the platform
          after notification constitutes acceptance of the revised policy.
        </p>
      </>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        Questions, data access requests, or concerns about this Privacy
        Policy should be directed to the LGC at{' '}
        <a
          href="mailto:support@lrfap.lb"
          className="font-medium text-lrfap-sky underline-offset-4 hover:underline"
        >
          support@lrfap.lb
        </a>
        .
      </p>
    ),
  },
];

export default function PrivacyPolicyPage() {
  useDocumentTitle('Privacy Policy');
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
          PRIVACY POLICY
        </motion.h1>
        <motion.p
          variants={headingVariants}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="font-sans text-[14px] text-lrfap-navy/70 md:text-[15px]"
        >
          Last updated: April 2026
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
