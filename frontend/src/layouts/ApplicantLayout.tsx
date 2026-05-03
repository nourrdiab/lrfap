import { Outlet } from 'react-router-dom';
import { ApplicantNavBar } from '../components/applicant/ApplicantNavBar';
import { PublicFooter } from '../components/public/PublicFooter';
import { NotificationsProvider } from '../context/NotificationsContext';
import { ChatbotWidget } from '../components/chatbot/ChatbotWidget';

/**
 * Shell wrapping every /applicant/* route. ProtectedRoute gates access to
 * this layout (allow=['applicant']), so the navbar and footer can assume
 * an authenticated applicant user.
 *
 * Chrome:
 *   - ApplicantNavBar (white bg, navy text, 0.91 px ghost bottom border)
 *   - <main> grows to fill available space; pages control their own
 *     internal spacing and gradients
 *   - PublicFooter (reused from the public site — same brand footer)
 */
export function ApplicantLayout() {
  return (
    <NotificationsProvider>
      <div className="flex min-h-screen flex-col bg-white text-slate-900">
        <ApplicantNavBar />
        <main className="flex-1">
          <Outlet />
        </main>
        <PublicFooter />
        <ChatbotWidget />
      </div>
    </NotificationsProvider>
  );
}
