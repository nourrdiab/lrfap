import type { ReactNode } from 'react';
import { WizardHeaderBar } from './WizardHeaderBar';
import { WizardHero } from './WizardHero';
import { WizardSummaryRow } from './WizardSummaryRow';
import { WizardProfileRow } from './WizardProfileRow';
import { WizardStepIndicator } from './WizardStepIndicator';
import { WizardFooterNav } from './WizardFooterNav';

/**
 * Layout shell around every wizard step. Renders the shared chrome in
 * Figma order (header → hero → summary → profile → indicator → content
 * slot → footer nav) and hands the `children` slot to the step component.
 *
 * The shell is pure layout — it reads everything it needs from
 * WizardContext, so step components can stay focused on their own data
 * and mutations.
 */
interface ApplicationWizardShellProps {
  children: ReactNode;
}

export function ApplicationWizardShell({ children }: ApplicationWizardShellProps) {
  return (
    <div className="flex flex-col">
      <WizardHeaderBar />
      <WizardHero />
      <WizardSummaryRow />
      <WizardProfileRow />
      <WizardStepIndicator />
      <div className="mx-auto w-full max-w-[1366px] px-6 md:px-[58px]">
        {children}
      </div>
      <WizardFooterNav />
    </div>
  );
}
