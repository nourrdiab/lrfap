import { useWizard } from './WizardContext';

/**
 * Hero row: "Welcome back, {firstName}!" + navy progress bar + "X% Complete"
 * caption. Progress percentage is backend-derivable but for now comes from
 * WizardContext as mock data (72%, matching Figma).
 */
export function WizardHero() {
  const { welcomeName, completionPercentage } = useWizard();
  const clamped = Math.max(0, Math.min(100, completionPercentage));

  return (
    <section className="mx-auto w-full max-w-[1366px] px-6 pt-[40px] pb-[32px] md:px-[58px]">
      <h2 className="font-display text-[36px] font-bold leading-[1.2] text-lrfap-navy">
        Welcome back, {welcomeName}!
      </h2>
      <div className="mt-[24px]">
        <div
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Application completion: ${clamped}%`}
          className="relative h-[6px] w-full overflow-hidden bg-lrfap-ghost"
        >
          <div
            className="absolute inset-y-0 left-0 bg-lrfap-navy transition-[width] duration-300"
            style={{ width: `${clamped}%` }}
          />
        </div>
        <p className="mt-[10px] font-sans text-[13px] text-slate-500">
          {clamped}% Complete
        </p>
      </div>
    </section>
  );
}
