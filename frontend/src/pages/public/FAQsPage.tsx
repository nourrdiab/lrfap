import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

interface Section {
  id: string;
  title: string;
  body: ReactNode;
}

interface QA {
  q: string;
  a: ReactNode;
}

function QAList({ items }: { items: QA[] }) {
  return (
    <div className="flex flex-col gap-[24px]">
      {items.map((item) => (
        <div key={item.q}>
          <h3 className="font-display text-[15px] font-semibold uppercase tracking-wide text-lrfap-navy">
            {item.q}
          </h3>
          <p className="mt-[8px]">{item.a}</p>
        </div>
      ))}
    </div>
  );
}

// TODO: re-add a "Fees" question once fee policy is finalized — needs platform fee, program fee, refund policy
const GETTING_STARTED: QA[] = [
  {
    q: 'Who can register on LRFAP?',
    a: 'LRFAP registration is open to medical graduates from accredited institutions and final-year medical students who are eligible to pursue residency or fellowship training in Lebanon.',
  },
  {
    q: 'How do I create an account?',
    a: 'Click "Get Started Now" on the homepage, fill in your details, accept the Terms and Conditions, and submit. You will receive a confirmation email and can sign in immediately.',
  },
  {
    q: 'What if I forget my password?',
    a: 'Use the "Forgot password?" link on the sign-in page. Enter the email associated with your account and follow the reset link sent to your inbox.',
  },
];

const APPLICATION_AND_MATCHING: QA[] = [
  {
    q: 'How does the matching process work?',
    a: 'Applicants rank their preferred programs and universities rank their preferred applicants. The platform runs a stable matching algorithm that produces an outcome where no applicant-program pair would mutually prefer each other over their assigned match.',
  },
  {
    q: 'Can I apply to multiple programs?',
    a: 'Yes. You may apply to as many programs as you choose during the application window. We recommend ranking only programs you would genuinely accept.',
  },
  {
    q: 'What documents do I need to submit?',
    a: "A standard application includes your transcript, medical degree certificate, identification, recommendation letters, and a personal statement. Some programs may request additional materials, listed on each program's page.",
  },
  {
    q: 'Can I edit my application after submitting?',
    a: "Application contents can be updated until the cycle's submission deadline. Once the deadline passes, applications are locked for review.",
  },
  {
    q: 'What happens after I submit my preference rankings?',
    a: 'After the ranking deadline, the LGC runs the matching algorithm. Once the match is published, all applicants and programs see their results simultaneously.',
  },
  {
    q: 'Is my match binding?',
    a: 'Yes. Match outcomes are binding for the cycle in which they are produced. Applicants are expected to honor the program they are matched with, and programs are expected to honor matched applicants.',
  },
];

const ACCOUNTS_AND_PRIVACY: QA[] = [
  {
    q: 'Can I have more than one account?',
    a: 'No. Each applicant must use one account. Operating multiple accounts is a violation of the Terms and Conditions and may result in disqualification.',
  },
  {
    q: 'How is my information used?',
    a: (
      <>
        Your information is shared with universities you apply to and with
        the LRFAP Governance Committee for oversight. It is not shared with
        any third parties without your consent. See our{' '}
        <Link
          to="/privacy"
          className="font-medium text-lrfap-sky underline-offset-4 hover:underline"
        >
          Privacy Policy
        </Link>{' '}
        for full details.
      </>
    ),
  },
  {
    q: 'What happens to my data after the cycle ends?',
    a: 'Application data is retained for the duration of the active cycle and archived afterward according to LGC retention policies. You may request access or correction of your data through support.',
  },
  {
    q: 'How do I close my account?',
    a: (
      <>
        Contact{' '}
        <a
          href="mailto:support@lrfap.lb"
          className="font-medium text-lrfap-sky underline-offset-4 hover:underline"
        >
          support@lrfap.lb
        </a>{' '}
        with a request to close your account. Note that closing an account
        during an active cycle does not nullify match outcomes already
        produced.
      </>
    ),
  },
  {
    q: 'Who do I contact if I need help?',
    a: (
      <>
        For technical issues, account questions, or urgent inquiries, email{' '}
        <a
          href="mailto:support@lrfap.lb"
          className="font-medium text-lrfap-sky underline-offset-4 hover:underline"
        >
          support@lrfap.lb
        </a>
        . We typically respond within two business days.
      </>
    ),
  },
];

const SECTIONS: Section[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    body: <QAList items={GETTING_STARTED} />,
  },
  {
    id: 'application-and-matching',
    title: 'Application and Matching',
    body: <QAList items={APPLICATION_AND_MATCHING} />,
  },
  {
    id: 'accounts-and-privacy',
    title: 'Accounts and Privacy',
    body: <QAList items={ACCOUNTS_AND_PRIVACY} />,
  },
];

export default function FAQsPage() {
  useDocumentTitle('FAQs');
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
          FREQUENTLY ASKED QUESTIONS
        </motion.h1>
        <motion.p
          variants={headingVariants}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="font-sans text-[14px] text-lrfap-navy md:text-[15px]"
        >
          Everything you need to know about LRFAP, from registering an account
          to receiving your match.
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
