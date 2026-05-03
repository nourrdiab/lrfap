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
    id: 'acceptance',
    title: 'Acceptance of Terms',
    body: (
      <>
        <p>
          By creating an account, accessing, or using the Lebanese Residency
          and Fellowship Application Program (&ldquo;LRFAP&rdquo;, &ldquo;the
          platform&rdquo;), you agree to be bound by these Terms &amp;
          Conditions. These terms constitute a binding agreement between you
          and the LRFAP Governance Committee (&ldquo;LGC&rdquo;),
          which operates the platform.
        </p>
        <p>
          If you do not agree with any part of these terms, you must not
          register for or use the platform. Continued use of LRFAP following
          any update to these terms constitutes ongoing acceptance of the
          revised terms.
        </p>
      </>
    ),
  },
  {
    id: 'platform-description',
    title: 'Platform Description',
    body: (
      <>
        <p>
          LRFAP is a centralized application and matching platform connecting
          medical graduates with residency and fellowship programs at
          participating Lebanese universities. The platform consolidates
          applications, supports document submission, supports university
          review, and produces an annual match using the Gale-Shapley stable
          matching algorithm.
        </p>
        <p>
          The platform is operated under the oversight of the LGC, the
          national body responsible for the licensing, governance, and
          integrity of the matching process. Participating universities,
          applicants, and the LGC each interact with the platform through
          dedicated, role-specific interfaces.
        </p>
      </>
    ),
  },
  {
    id: 'eligibility',
    title: 'Eligibility',
    body: (
      <>
        <p>
          To register as an applicant, you must be a medical graduate from an
          accredited institution or in your final year of medical study, must
          be eligible under applicable regulations to pursue residency or
          fellowship training in Lebanon, and must provide accurate
          identifying information. Misrepresentation of eligibility,
          identity, or academic standing is grounds for immediate
          disqualification.
        </p>
        <p>
          University and LGC accounts are issued directly by the LGC and are
          not available through public registration. Such accounts are bound
          by additional internal policies, including conflict-of-interest and
          confidentiality requirements.
        </p>
      </>
    ),
  },
  {
    id: 'account-responsibilities',
    title: 'Account Responsibilities',
    body: (
      <>
        <p>
          You are responsible for maintaining the confidentiality of your
          account credentials and for all activity that occurs under your
          account. You agree to notify the LGC immediately of any
          unauthorized use or suspected compromise. The platform is not
          liable for losses resulting from your failure to safeguard your
          credentials.
        </p>
        <p>
          Sharing credentials, falsifying personal or academic information,
          impersonating another individual, or operating multiple accounts is
          strictly prohibited and may result in account termination,
          disqualification from the active matching cycle, and reporting to
          relevant licensing authorities.
        </p>
      </>
    ),
  },
  {
    id: 'submissions',
    title: 'Application Submission and Documents',
    body: (
      <>
        <p>
          Applicants are solely responsible for the accuracy and authenticity
          of all materials submitted through the platform, including
          transcripts, certificates, recommendation letters, examination
          results, and personal statements. All submitted documents must be
          the applicant&rsquo;s own work or properly attributed to their
          original source. Plagiarism, fabrication, or alteration of
          documents is prohibited.
        </p>
        <p>
          Submission of fraudulent or knowingly inaccurate documents will
          result in immediate disqualification from the current and any
          future matching cycle, account suspension, and notification to
          relevant licensing and regulatory authorities. The LGC reserves the
          right to verify any submitted material with the issuing
          institution.
        </p>
      </>
    ),
  },
  {
    id: 'matching',
    title: 'The Matching Process',
    body: (
      <>
        <p>
          The platform uses a Gale-Shapley stable matching algorithm.
          Applicants rank participating programs in order of preference,
          while university committees independently rank the applicants who
          have applied to their programs. The algorithm produces a match
          that is stable: no applicant-program pair would mutually prefer
          each other over their assigned outcome.
        </p>
        <p>
          Match results are binding for the cycle in which they are
          produced. Applicants are expected to honor the program to which
          they are matched, and programs are expected to honor matched
          applicants. Withdrawal from a confirmed match outside the
          procedures published by the LGC may result in disciplinary
          action, exclusion from future cycles, and reporting to licensing
          authorities.
        </p>
      </>
    ),
  },
  {
    id: 'data-privacy',
    title: 'Data Privacy and Use',
    body: (
      <>
        <p>
          LRFAP collects and processes only the personal information
          necessary to facilitate applications and matching. This includes
          identifying information, contact details, academic records, and
          any documents you choose to submit. Your information is shared
          with universities to which you have submitted applications and
          with the LGC for oversight, audit, and integrity purposes. It is
          not shared with any other third party without your consent,
          except as required by law.
        </p>
        <p>
          You may request access to or correction of your data through the
          LGC support contact below. Application data is retained for the
          duration of the active cycle and archived thereafter under
          retention policies maintained by the LGC. Deidentified or
          aggregated data may be retained indefinitely for statistical and
          reporting purposes.
        </p>
      </>
    ),
  },
  {
    id: 'reviewer-conduct',
    title: 'University and Reviewer Conduct',
    body: (
      <>
        <p>
          Participating universities and their authorized reviewers must
          evaluate applicants fairly, consistently, and without
          discrimination on the basis of gender, religion, ethnicity,
          nationality, age, disability, or any other protected
          characteristic. Reviewer rankings must reflect genuine
          programmatic preferences grounded in academic merit and program
          fit.
        </p>
        <p>
          Universities may not solicit, accept, or imply pre-match
          commitments from applicants outside the platform. Side-channel
          agreements that purport to circumvent the matching algorithm are
          not recognized by the LGC and constitute a violation of these
          terms.
        </p>
      </>
    ),
  },
  {
    id: 'prohibited-conduct',
    title: 'Prohibited Conduct',
    body: (
      <>
        <p>You agree not to:</p>
        <ul className="ml-[20px] list-disc space-y-[8px]">
          <li>
            Attempt to bypass, manipulate, or otherwise interfere with the
            matching algorithm or its outputs.
          </li>
          <li>
            Enter into or solicit off-platform agreements that purport to
            determine or override match results.
          </li>
          <li>
            Harass, intimidate, or impersonate any other user, reviewer, or
            staff member.
          </li>
          <li>
            Use automated systems (scripts, scrapers, bots) to access or
            extract data from the platform.
          </li>
          <li>
            Reverse-engineer, decompile, or otherwise attempt to derive the
            underlying source code or algorithmic mechanics of the
            platform.
          </li>
          <li>
            Upload content that is unlawful, defamatory, or infringes the
            rights of any third party.
          </li>
          <li>
            Probe, scan, or test the vulnerability of the platform&rsquo;s
            systems without express written authorization from the LGC.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'intellectual-property',
    title: 'Intellectual Property',
    body: (
      <>
        <p>
          The LRFAP platform, including its software, branding, logos,
          written materials, and overall visual design, is the property of
          the LGC and the operating institution. All such materials are
          protected by applicable intellectual property laws and may not be
          reproduced, distributed, or used outside the platform without
          written permission.
        </p>
        <p>
          Content submitted by applicants &mdash; including personal
          statements, supplementary essays, and uploaded documents &mdash;
          remains the intellectual property of the applicant. By submitting
          such content, you grant LRFAP, the LGC, and any university to
          which you apply a limited, non-exclusive, royalty-free license to
          view, store, transmit, and process the content for the purposes
          of evaluation, matching, and audit related to your application
          cycle.
        </p>
      </>
    ),
  },
  {
    id: 'disclaimers',
    title: 'Disclaimers and Limitations',
    body: (
      <>
        <p>
          The platform is provided on an &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo; basis. While the LGC makes reasonable efforts to
          maintain the accuracy, security, and uptime of the platform, no
          warranty is made that access will be uninterrupted, that the
          platform will be free of errors, or that match outcomes will
          satisfy any particular party&rsquo;s expectations. The
          platform&rsquo;s role is strictly to facilitate the application
          and matching process; final placement, contractual, and post-match
          arrangements are the responsibility of the applicant and the
          matched program.
        </p>
        <p>
          To the fullest extent permitted by Lebanese law, the LGC, the
          operating institution, and their respective affiliates disclaim
          liability for indirect, incidental, or consequential damages
          arising from use of the platform.
        </p>
      </>
    ),
  },
  {
    id: 'modifications',
    title: 'Modifications to Terms',
    body: (
      <>
        <p>
          These terms may be updated periodically to reflect changes in
          platform features, regulatory requirements, or LGC policy.
          Material changes will be communicated via in-platform notification
          or to the email address associated with your account. The
          &ldquo;Last updated&rdquo; date at the top of this document
          indicates the most recent revision.
        </p>
        <p>
          Continued use of the platform following notification of revised
          terms constitutes acceptance of those revisions. If you do not
          accept the revised terms, you must discontinue use of the platform
          and may request deletion of your account through the LGC support
          contact.
        </p>
      </>
    ),
  },
  {
    id: 'termination',
    title: 'Termination',
    body: (
      <>
        <p>
          The LGC reserves the right to suspend or terminate any account for
          violation of these terms, fraudulent activity, threats to the
          integrity of the matching process, or as otherwise required by
          applicable law or LGC policy. Suspended or terminated accounts
          forfeit access to current and future matching cycles unless
          reinstated at the discretion of the LGC.
        </p>
        <p>
          You may also discontinue your use of the platform at any time.
          Discontinuation does not nullify match outcomes already produced,
          contractual obligations to a matched program, or audit obligations
          under LGC retention policies.
        </p>
      </>
    ),
  },
  {
    id: 'governing-law',
    title: 'Governing Law',
    body: (
      <p>
        These Terms &amp; Conditions are governed by and construed in
        accordance with the laws of the Republic of Lebanon. Any dispute
        arising out of or in connection with these terms, the platform, or
        its operation shall be subject to the exclusive jurisdiction of the
        competent courts of Lebanon.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        Questions, concerns, data-access requests, or notices regarding
        these Terms &amp; Conditions should be directed to the LGC at{' '}
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

export default function TermsPage() {
  useDocumentTitle('Terms & Conditions');
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
          TERMS &amp; CONDITIONS
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
