import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ScrollToTop } from './components/ScrollToTop';
import { ProgramsRoute } from './routes/ProgramsRoute';

import { PublicLayout } from './layouts/PublicLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { CenteredAuthLayout } from './layouts/CenteredAuthLayout';
import { ApplicantLayout } from './layouts/ApplicantLayout';
import { UniversityLayout } from './layouts/UniversityLayout';
import { LGCLayout } from './layouts/LGCLayout';

import LandingPage from './pages/public/LandingPage';
import ProgramCatalogPage from './pages/public/ProgramCatalogPage';
import AboutPage from './pages/public/AboutPage';
import TermsPage from './pages/public/TermsPage';
import FAQsPage from './pages/public/FAQsPage';
import SupportPage from './pages/public/SupportPage';
import PrivacyPolicyPage from './pages/public/PrivacyPolicyPage';
import RequiredDocumentsPage from './pages/public/RequiredDocumentsPage';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

import ApplicantDashboardPage from './pages/applicant/DashboardPage';
import ApplicantProfilePage from './pages/applicant/ProfilePage';
import ApplicantMyApplicationsPage from './pages/applicant/MyApplicationsPage';
import ApplicantApplicationDetailPage from './pages/applicant/ApplicationDetailPage';
import ApplicantNotificationsPage from './pages/applicant/NotificationsPage';
import ApplicationWizardPage from './pages/applicant/ApplicationWizardPage';
import ProfileStep from './components/applicant/wizard/steps/ProfileStep';
import DocumentsStep from './components/applicant/wizard/steps/DocumentsStep';
import ProgramsStep from './components/applicant/wizard/steps/ProgramsStep';
import PreferenceRankingStep from './components/applicant/wizard/steps/PreferenceRankingStep';
import ReviewSubmitStep from './components/applicant/wizard/steps/ReviewSubmitStep';

import UniversityDashboardPage from './pages/university/DashboardPage';
import UniversityProgramApplicationsPage from './pages/university/ProgramApplicationsPage';
import UniversityApplicationDetailPage from './pages/university/ApplicationDetailPage';
import UniversityRankingPage from './pages/university/RankingPage';

import LGCDashboardPage from './pages/lgc/DashboardPage';
import LGCCyclesPage from './pages/lgc/CyclesPage';
import LGCCatalogPage from './pages/lgc/CatalogPage';
import LGCCatalogUniversitiesTab from './pages/lgc/catalog/UniversitiesTab';
import LGCCatalogSpecialtiesTab from './pages/lgc/catalog/SpecialtiesTab';
import LGCCatalogProgramsTab from './pages/lgc/catalog/ProgramsTab';
import LGCMatchingPage from './pages/lgc/MatchingPage';
import LGCUsersAuditPage from './pages/lgc/UsersAuditPage';

import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <Routes>
          {/* Landing is full-bleed — it ships its own nav and footer, so it
              sits outside PublicLayout. */}
          <Route index element={<LandingPage />} />

          {/* Other public pages keep the scaffold PublicLayout shell until
              they're rebuilt from Figma. */}
          <Route element={<PublicLayout />}>
            <Route path="about" element={<AboutPage />} />
            <Route path="terms" element={<TermsPage />} />
            <Route path="faqs" element={<FAQsPage />} />
            <Route path="support" element={<SupportPage />} />
            <Route path="privacy" element={<PrivacyPolicyPage />} />
            <Route path="required-documents" element={<RequiredDocumentsPage />} />
          </Route>

          {/* /programs is public-or-private — ProgramsRoute picks the
              appropriate layout based on auth state and role. */}
          <Route path="programs" element={<ProgramsRoute />}>
            <Route index element={<ProgramCatalogPage />} />
          </Route>

          {/* Auth — split layout (form + photo) for multi-field flows */}
          <Route element={<AuthLayout />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
          </Route>

          {/* Auth — centered layout for single-field flows */}
          <Route element={<CenteredAuthLayout />}>
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
          </Route>

          {/* Convenience redirect: /dashboard lands role-routing at the
              applicant dashboard. Other roles have their own landing pages
              wired under /university and /lgc respectively. */}
          <Route path="dashboard" element={<Navigate to="/applicant" replace />} />

          {/* Applicant portal */}
          <Route element={<ProtectedRoute allow={['applicant']} />}>
            <Route path="applicant" element={<ApplicantLayout />}>
              <Route index element={<ApplicantDashboardPage />} />
              <Route path="profile" element={<ApplicantProfilePage />} />
              <Route path="applications" element={<ApplicantMyApplicationsPage />} />
              {/* Wizard routes — more specific than :id, so ordered first */}
              <Route
                path="applications/:id/edit"
                element={<ApplicationWizardPage />}
              >
                <Route index element={<Navigate to="profile" replace />} />
                <Route path="profile" element={<ProfileStep />} />
                <Route path="documents" element={<DocumentsStep />} />
                <Route path="programs" element={<ProgramsStep />} />
                <Route
                  path="preference-ranking"
                  element={<PreferenceRankingStep />}
                />
                <Route path="review" element={<ReviewSubmitStep />} />
              </Route>
              <Route
                path="applications/:id"
                element={<ApplicantApplicationDetailPage />}
              />
              <Route path="notifications" element={<ApplicantNotificationsPage />} />
            </Route>
          </Route>

          {/* University portal — ranking is scoped per-program, so it
              lives under /programs/:programId/ranking rather than a
              top-level /ranking route. */}
          <Route element={<ProtectedRoute allow={['university']} />}>
            <Route path="university" element={<UniversityLayout />}>
              <Route index element={<UniversityDashboardPage />} />
              <Route
                path="programs/:programId"
                element={<UniversityProgramApplicationsPage />}
              />
              <Route
                path="programs/:programId/ranking"
                element={<UniversityRankingPage />}
              />
              <Route
                path="applications/:applicationId"
                element={<UniversityApplicationDetailPage />}
              />
            </Route>
          </Route>

          {/* LGC committee portal */}
          <Route element={<ProtectedRoute allow={['lgc']} />}>
            <Route path="lgc" element={<LGCLayout />}>
              <Route index element={<LGCDashboardPage />} />
              <Route path="cycles" element={<LGCCyclesPage />} />
              <Route path="catalog" element={<LGCCatalogPage />}>
                <Route index element={<Navigate to="universities" replace />} />
                <Route path="universities" element={<LGCCatalogUniversitiesTab />} />
                <Route path="specialties" element={<LGCCatalogSpecialtiesTab />} />
                <Route path="programs" element={<LGCCatalogProgramsTab />} />
              </Route>
              <Route path="matching" element={<LGCMatchingPage />} />
              <Route path="users" element={<LGCUsersAuditPage />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
