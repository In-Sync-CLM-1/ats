import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppLayout } from "@/components/AppLayout";
import { OrgProvider } from "@/contexts/OrgContext";
import Index from "./pages/Index";
import LandingPage from "./pages/LandingPage";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Candidates from "./pages/Candidates";
import CandidateForm from "./pages/CandidateForm";
import CandidateDetail from "./pages/CandidateDetail";
import Templates from "./pages/Templates";
import EmailTemplateForm from "./pages/EmailTemplateForm";
import WhatsAppTemplateForm from "./pages/WhatsAppTemplateForm";
import Mandates from "./pages/Mandates";
import MandateForm from "./pages/MandateForm";
import MandateDetail from "./pages/MandateDetail";
import Clients from "./pages/Clients";
import ClientForm from "./pages/ClientForm";
import Webhooks from "./pages/Webhooks";
import Users from "./pages/Users";
import MyProfile from "./pages/MyProfile";
import Teams from "./pages/Teams";
import Designations from "./pages/Designations";
import PipelineStages from "./pages/PipelineStages";
import CallDispositions from "./pages/CallDispositions";
import Tasks from "./pages/Tasks";
import WhatsNew from "./pages/WhatsNew";

import RecruiterPerformance from "./pages/RecruiterPerformance";
import CallingDashboard from "./pages/CallingDashboard";
import NotFound from "./pages/NotFound";
import PublicApply from "./pages/PublicApply";
import CreateOrg from "./pages/CreateOrg";
import OnboardingWizard from "./pages/OnboardingWizard";
import HROnboarding from "./pages/HROnboarding";
import CandidateOnboardingForm from "./pages/CandidateOnboardingForm";
import LandingDemo from "./pages/LandingDemo";
import CareersPage from "./pages/CareersPage";
import MyDesk from "./pages/MyDesk";
import PlatformAdminLayout from "./components/platform/PlatformAdminLayout";
import PlatformAdminDashboard from "./pages/platform/PlatformAdminDashboard";
import PlatformOrganizations from "./pages/platform/PlatformOrganizations";
import PlatformOrgDetail from "./pages/platform/PlatformOrgDetail";
import PlatformUsers from "./pages/platform/PlatformUsers";
import ZonalDashboard from "./pages/ZonalDashboard";
import HeadcountManagement from "./pages/HeadcountManagement";
import SitesAdmin from "./pages/SitesAdmin";
import HeadcountAgreementsAdmin from "./pages/HeadcountAgreementsAdmin";
import ZonalCoordinatorLayout from "./components/zonal/ZonalCoordinatorLayout";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <OrgProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/welcome" element={<LandingPage />} />
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/apply/:referralCode" element={<PublicApply />} />
              <Route path="/careers/:slug" element={<CareersPage />} />
              <Route path="/join/:slug" element={<CandidateOnboardingForm />} />
              <Route path="/landing-demo" element={<LandingDemo />} />
              <Route path="/create-org" element={<CreateOrg />} />
              <Route path="/onboarding" element={<OnboardingWizard />} />

              {/* Platform admin command center */}
              <Route element={<PlatformAdminLayout />}>
                <Route path="/platform-admin" element={<PlatformAdminDashboard />} />
                <Route path="/platform-admin/organizations" element={<PlatformOrganizations />} />
                <Route path="/platform-admin/organizations/:id" element={<PlatformOrgDetail />} />
                <Route path="/platform-admin/users" element={<PlatformUsers />} />
              </Route>

              <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/recruiter-performance" element={<RecruiterPerformance />} />
              <Route path="/calling-dashboard" element={<CallingDashboard />} />
              <Route path="/candidates" element={<Candidates />} />
              <Route path="/candidates/new" element={<CandidateForm />} />
              <Route path="/candidates/view/:id" element={<CandidateDetail />} />
              <Route path="/candidates/:id" element={<CandidateForm />} />
                <Route path="/templates" element={<Templates />} />
                <Route path="/templates/email/new" element={<EmailTemplateForm />} />
                <Route path="/templates/email/:id" element={<EmailTemplateForm />} />
                <Route path="/templates/whatsapp/new" element={<WhatsAppTemplateForm />} />
                <Route path="/templates/whatsapp/:id" element={<WhatsAppTemplateForm />} />
            <Route path="/mandates" element={<Mandates />} />
            <Route path="/mandates/new" element={<MandateForm />} />
            <Route path="/mandates/edit/:id" element={<MandateForm />} />
            <Route path="/mandates/view/:id" element={<MandateDetail />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/clients/new" element={<ClientForm />} />
              <Route path="/clients/:id" element={<ClientForm />} />
                <Route path="/webhooks" element={<Webhooks />} />
                <Route path="/users" element={<Users />} />
                <Route path="/my-profile" element={<MyProfile />} />
                <Route path="/teams" element={<Teams />} />
                <Route path="/designations" element={<Designations />} />
                <Route path="/pipeline-stages" element={<PipelineStages />} />
                <Route path="/call-dispositions" element={<CallDispositions />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/whats-new" element={<WhatsNew />} />

                <Route path="/my-desk" element={<MyDesk />} />
              <Route path="/hr-onboarding" element={<HROnboarding />} />
                <Route path="/sites" element={<SitesAdmin />} />
                <Route path="/headcount-agreements" element={<HeadcountAgreementsAdmin />} />
              </Route>

              {/* Zonal Coordinator Routes */}
              <Route element={<ZonalCoordinatorLayout />}>
                <Route path="/zonal-coordinator" element={<ZonalDashboard />} />
                <Route path="/zonal-coordinator/headcount" element={<HeadcountManagement />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </OrgProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
