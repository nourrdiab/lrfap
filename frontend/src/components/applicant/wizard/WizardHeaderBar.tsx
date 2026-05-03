import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useWizard } from './WizardContext';

/**
 * Top block of the wizard page: "APPLICANT DASHBOARD" h1, the intro
 * paragraph on the right, then a row carrying APPLICATION CYCLE /
 * APPLICATION DEADLINE on the left and the SAVE DRAFT button on the right.
 *
 * A tiny "Saved just now" confirmation appears next to SAVE DRAFT for
 * three seconds after every successful save (triggered by context
 * `lastSavedAt` changing).
 */
export function WizardHeaderBar() {
  const {
    pageTitle,
    applicationCycle,
    applicationDeadline,
    isSaving,
    saveDraft,
    lastSavedAt,
  } = useWizard();

  const [showSaved, setShowSaved] = useState(false);
  useEffect(() => {
    if (!lastSavedAt) return;
    setShowSaved(true);
    const t = setTimeout(() => setShowSaved(false), 3000);
    return () => clearTimeout(t);
  }, [lastSavedAt]);

  return (
    <section className="mx-auto w-full max-w-[1366px] px-6 pt-[40px] md:px-[58px]">
      <div className="flex flex-col gap-[16px] md:flex-row md:items-start md:justify-between md:gap-[32px]">
        <h1 className="font-display text-[40px] font-extrabold leading-[1.1] text-lrfap-navy">
          {pageTitle}
        </h1>
        <p className="max-w-[540px] font-sans text-[15px] leading-relaxed text-slate-600 md:pt-[12px] md:text-right">
          Manage your residency or fellowship application from one centralized
          workspace.
        </p>
      </div>

      <div className="mt-[24px] flex flex-col gap-[16px] md:flex-row md:items-center md:justify-between md:gap-[32px]">
        <div className="flex flex-col gap-[16px] sm:flex-row sm:gap-[80px]">
          <div>
            <p className="font-sans text-[13px] font-medium uppercase tracking-wide text-slate-500">
              Application Cycle
            </p>
            <p className="mt-[4px] font-sans text-[15px] font-semibold text-lrfap-navy">
              {applicationCycle}
            </p>
          </div>
          <div>
            <p className="font-sans text-[13px] font-medium uppercase tracking-wide text-slate-500">
              Application Deadline
            </p>
            <p className="mt-[4px] font-sans text-[15px] font-semibold text-lrfap-navy">
              {applicationDeadline}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-[12px]">
          <AnimatePresence>
            {showSaved ? (
              <motion.span
                key="saved"
                role="status"
                aria-live="polite"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="inline-flex items-center gap-[6px] font-sans text-[12px] font-medium text-green-600"
              >
                <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3} />
                Saved just now
              </motion.span>
            ) : null}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => void saveDraft()}
            disabled={isSaving}
            className="inline-flex h-[40.67px] shrink-0 items-center justify-center border-[0.91px] border-lrfap-navy px-[22px] font-sans text-[14px] font-normal uppercase tracking-wide text-lrfap-navy transition-colors hover:bg-lrfap-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-navy disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : 'Save Draft'}
          </button>
        </div>
      </div>
    </section>
  );
}
