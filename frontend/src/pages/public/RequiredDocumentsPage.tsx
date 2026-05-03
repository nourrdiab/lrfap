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
    id: 'general-requirements',
    title: 'General Document Requirements',
    body: (
      <p>
        All applicants must upload the following documents before submitting an
        application. Files should be in PDF format where possible. Image files
        (JPG, PNG) and Word documents are also accepted. Maximum file size per
        document is 10 MB.
      </p>
    ),
  },
  {
    id: 'cv',
    title: 'CV / Resume',
    body: (
      <p>
        A current curriculum vitae or resume detailing your academic background,
        clinical experience, research, publications, and any relevant work
        history. There is no fixed length, but a focused two to four page
        document is typical for residency and fellowship applications.
      </p>
    ),
  },
  {
    id: 'personal-statement',
    title: 'Personal Statement',
    body: (
      <p>
        A written statement explaining your motivations, career goals, and why
        you are pursuing your chosen specialty. Universities use this to
        evaluate your fit beyond academic credentials. Length and formatting
        expectations vary, but most programs expect roughly one to two pages.
      </p>
    ),
  },
  {
    id: 'transcript',
    title: 'Transcript',
    body: (
      <p>
        Your official medical school transcript, showing all courses completed
        and grades received. If your transcript is not in English, an official
        translation may be required. Confirm with the universities you are
        applying to.
      </p>
    ),
  },
  {
    id: 'degree-certification',
    title: 'Degree Certification',
    body: (
      <p>
        Proof that you have earned your medical degree, or proof of expected
        graduation if you have not yet completed your studies. This is
        typically a copy of your diploma or an official letter from your
        medical school.
      </p>
    ),
  },
  {
    id: 'recommendation-letters',
    title: 'Recommendation Letters',
    body: (
      <p>
        Letters of recommendation from faculty members, attending physicians,
        or supervisors familiar with your clinical and academic work. Most
        programs expect two to three letters. Letters should be on official
        letterhead, signed, and dated.
      </p>
    ),
  },
  {
    id: 'id-passport',
    title: 'ID / Passport',
    body: (
      <p>
        A clear copy of your government-issued identification document.
        Lebanese citizens can submit a national ID. Non-Lebanese applicants
        should submit a passport. Make sure the document is current and the
        personal information is clearly visible.
      </p>
    ),
  },
  {
    id: 'license-registration',
    title: 'License / Registration',
    body: (
      <p>
        If you are already licensed to practice medicine, upload a copy of your
        current medical license or registration with the relevant medical
        authority. If you are not yet licensed, this requirement may not apply,
        but confirm with each program.
      </p>
    ),
  },
  {
    id: 'language-test',
    title: 'Language Test',
    body: (
      <>
        <p>
          Proof of language proficiency may be required depending on the
          language of instruction at each university.
        </p>
        <p>
          <strong className="font-semibold">
            Programs taught in English
          </strong>{' '}
          (American University of Beirut, Beirut Arab University, Holy Spirit
          University of Kaslik, Lebanese American University, Lebanese
          University, Saint George University of Beirut, University of
          Balamand): Proof of English proficiency may be required. Common
          accepted tests include IELTS, TOEFL, or equivalent. Specific score
          requirements vary by program. Confirm directly with the university.
        </p>
        <p>
          <strong className="font-semibold">
            Programs taught in French
          </strong>{' '}
          (Saint Joseph University of Beirut): Proof of French proficiency is
          required. Common accepted tests include DELF and DALF, or equivalent.
          Specific score requirements vary by program. Confirm directly with
          the university.
        </p>
        <p>
          Native speakers of the language of instruction may be exempt from the
          language test requirement. Confirm exemption criteria with the
          university.
        </p>
      </>
    ),
  },
  {
    id: 'institution-specific',
    title: 'Additional Institution-Specific Documents',
    body: (
      <p>
        Some programs require additional documentation specific to that
        institution. Examples include institutional application forms,
        statements specific to the university or specialty, supplementary
        essays, or program-specific questionnaires. When you select programs
        in your application wizard, any additional documents required by those
        institutions will be listed for upload.
      </p>
    ),
  },
  {
    id: 'file-format',
    title: 'File Format Guidelines',
    body: (
      <p>
        Accepted file types: PDF (preferred), JPG, PNG, DOC, DOCX. Maximum
        file size: 10 MB per document. Use clear, legible scans for any
        handwritten or printed documents. Files should be uploaded with
        descriptive names where possible (for example,
        &ldquo;YourName_Transcript.pdf&rdquo;). Documents that are unreadable,
        corrupted, or in unsupported formats may delay your application
        review.
      </p>
    ),
  },
  {
    id: 'verification',
    title: 'Document Verification',
    body: (
      <p>
        All uploaded documents are reviewed for completeness during the
        application process. Universities may contact you directly to request
        additional information or verification. Submitting forged or misleading
        documents will result in removal from the matching process and may be
        reported to the relevant authorities.
      </p>
    ),
  },
  {
    id: 'questions',
    title: 'Questions About Documents',
    body: (
      <p>
        If you are unsure whether a specific document is required, what format
        is acceptable, or how to obtain a particular document, contact the LGC
        through the Support page or reach out directly to the university you
        are applying to. Do not submit your application with incomplete or
        unclear documentation.
      </p>
    ),
  },
];

export default function RequiredDocumentsPage() {
  useDocumentTitle('Required Documents');
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
          REQUIRED DOCUMENTS
        </motion.h1>
        <motion.p
          variants={headingVariants}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="font-sans text-[14px] text-lrfap-navy md:text-[15px]"
        >
          What you&apos;ll need before you submit your application.
        </motion.p>
      </motion.header>

      <div className="mt-[48px] flex flex-col gap-[48px] lg:flex-row lg:items-start lg:justify-between lg:gap-[48px]">
        <div className="flex w-full max-w-[800px] flex-col gap-[48px]">
          <p className="font-sans text-[15px] leading-[1.65] text-lrfap-navy md:text-[16px]">
            To complete your LRFAP application, you&apos;ll need to prepare and
            upload several documents. The exact requirements depend on the
            universities and programs you apply to. This page outlines the
            documents you need to have ready, accepted file formats, and
            language test requirements that vary by institution.
          </p>

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
