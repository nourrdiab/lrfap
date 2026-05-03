import { Check } from 'lucide-react';
import { useWizard } from './WizardContext';
import { STEPS, type StepStatus } from './types';

/**
 * 5-step indicator. Each step is a circle (checkmark / current-highlight /
 * numbered) with a label below, connected by horizontal lines.
 *
 * Click semantics (earlier architecture decision):
 *   - completed → clickable, navigates to that step
 *   - current   → not clickable, no-op
 *   - upcoming  → disabled, shows a not-allowed cursor
 *
 * Current-step visual = sky-blue fill + white number (decided earlier).
 * Completed = navy fill + white check. Upcoming = white fill + navy border
 * + navy number.
 *
 * Connecting lines between steps carry their own completion color: navy
 * when the step on the left is complete, ghost otherwise.
 */
export function WizardStepIndicator() {
  const { currentStep, stepStatus, goToStep } = useWizard();

  return (
    <section className="mx-auto w-full max-w-[1366px] px-6 pt-[40px] pb-[28px] md:px-[58px]">
      <ol
        className="grid w-full grid-cols-5 gap-0"
        aria-label="Application steps"
      >
        {STEPS.map((step, index) => {
          const status = stepStatus[step.slug];
          const isCurrent = currentStep === step.slug;
          const displayState = isCurrent ? 'current' : status;
          const prevStatus = index > 0 ? stepStatus[STEPS[index - 1].slug] : undefined;
          const lineComplete = prevStatus === 'complete';

          return (
            <li key={step.slug} className="relative flex flex-col items-center">
              {/* Left connecting line (skip on first step) */}
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className={`absolute top-[20px] right-1/2 h-[2px] w-full ${
                    lineComplete ? 'bg-lrfap-navy' : 'bg-lrfap-ghost'
                  }`}
                />
              ) : null}

              <StepCircle
                displayState={displayState}
                position={step.position}
                isCurrent={isCurrent}
                disabled={status === 'pending' && !isCurrent}
                onClick={() => {
                  if (isCurrent) return;
                  if (status === 'pending') return;
                  goToStep(step.slug);
                }}
                stepLabel={step.label}
              />
              <span
                aria-current={isCurrent ? 'step' : undefined}
                className={`relative mt-[12px] text-center font-sans text-[12px] font-medium uppercase tracking-wide ${
                  isCurrent ? 'text-lrfap-navy' : 'text-slate-500'
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

interface StepCircleProps {
  displayState: StepStatus | 'current';
  position: number;
  isCurrent: boolean;
  disabled: boolean;
  onClick: () => void;
  stepLabel: string;
}

function StepCircle({
  displayState,
  position,
  isCurrent,
  disabled,
  onClick,
  stepLabel,
}: StepCircleProps) {
  const base =
    'relative z-[1] flex h-[40px] w-[40px] items-center justify-center rounded-full font-sans text-[14px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lrfap-navy';

  const stateCls =
    displayState === 'complete'
      ? 'bg-lrfap-navy text-white'
      : displayState === 'current'
        ? 'bg-lrfap-sky text-white'
        : 'border-[0.91px] border-lrfap-navy bg-white text-lrfap-navy';

  const interactiveCls = isCurrent
    ? 'cursor-default'
    : disabled
      ? 'cursor-not-allowed opacity-70'
      : 'cursor-pointer hover:opacity-90';

  const ariaLabel = isCurrent
    ? `Current step: ${stepLabel}`
    : displayState === 'complete'
      ? `Go to completed step: ${stepLabel}`
      : `${stepLabel} (not yet available)`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isCurrent || disabled}
      aria-label={ariaLabel}
      aria-current={isCurrent ? 'step' : undefined}
      className={`${base} ${stateCls} ${interactiveCls}`}
    >
      {displayState === 'complete' ? (
        <Check aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
      ) : (
        <span>{position.toString().padStart(2, '0')}</span>
      )}
    </button>
  );
}
