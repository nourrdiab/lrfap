import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import {
  WizardProvider,
  useWizard,
} from '../../components/applicant/wizard/WizardContext';
import { ApplicationWizardShell } from '../../components/applicant/wizard/ApplicationWizardShell';

/**
 * Parent route for /applicant/applications/:id/edit(/:step).
 *
 * Provides WizardContext to every child step, renders the chrome, and
 * leaves an <Outlet /> as the step content slot.
 */
export default function ApplicationWizardPage() {
  useDocumentTitle('Application');
  return (
    <WizardProvider>
      <NotFoundGuard>
        <ApplicationWizardShell>
          <Outlet />
        </ApplicationWizardShell>
      </NotFoundGuard>
    </WizardProvider>
  );
}

/**
 * Watches the application fetch state and bounces to /applicant/applications
 * with an `error=application-not-found` search param when the draft ID
 * doesn't resolve. The MyApplicationsPage will read that param and
 * surface a message once it's built (currently a stub).
 */
function NotFoundGuard({ children }: { children: React.ReactNode }) {
  const { applicationNotFound } = useWizard();
  const navigate = useNavigate();
  useEffect(() => {
    if (applicationNotFound) {
      navigate('/applicant/applications?error=application-not-found', {
        replace: true,
      });
    }
  }, [applicationNotFound, navigate]);
  return <>{children}</>;
}
