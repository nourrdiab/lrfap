import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useWizard } from './WizardContext';
import { STEPS } from './types';

/**
 * PREVIOUS / NEXT navigation at the bottom of each step.
 *
 * - First step hides PREVIOUS (no prior step to go to).
 * - Last step hides NEXT (submit lives on the step itself, not here).
 * - Per memory (project_wizard_api), both buttons force-save before
 *   navigating — but the save wiring is per-step, so we just call the
 *   context's goNext / goPrevious, which each step's own effect/handler
 *   can intercept when needed.
 */
export function WizardFooterNav() {
  const { currentStep, goNext, goPrevious } = useWizard();
  const index = STEPS.findIndex((s) => s.slug === currentStep);
  const isFirst = index === 0;
  const isLast = index === STEPS.length - 1;

  return (
    <nav
      aria-label="Wizard navigation"
      className="mx-auto w-full max-w-[1366px] px-6 pt-[16px] pb-[40px] md:px-[58px]"
    >
      <div className="flex items-center justify-between">
        {!isFirst ? (
          <button
            type="button"
            onClick={goPrevious}
            className="inline-flex items-center gap-[8px] font-sans text-[14px] font-medium uppercase tracking-wide text-lrfap-navy transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lrfap-navy"
          >
            <ArrowLeft aria-hidden="true" className="h-[18px] w-[18px]" />
            Previous
          </button>
        ) : (
          <span aria-hidden="true" />
        )}

        {!isLast ? (
          <button
            type="button"
            onClick={goNext}
            className="inline-flex items-center gap-[8px] font-sans text-[14px] font-medium uppercase tracking-wide text-lrfap-navy transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lrfap-navy"
          >
            Next
            <ArrowRight aria-hidden="true" className="h-[18px] w-[18px]" />
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
    </nav>
  );
}
