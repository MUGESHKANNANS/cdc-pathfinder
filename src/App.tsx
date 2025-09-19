import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ModalProvider } from "@/contexts/ModalContext";
import LoginPage from "@/components/auth/LoginPage";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import FacultyManagement from "@/pages/FacultyManagement";
import Events from "@/pages/Events";
import CreateEvent from "@/pages/CreateEvent";
import FacultyDirectory from "@/components/faculty/FacultyDirectory";
import EditFacultyProfile from "@/pages/EditFacultyProfile";
import ChangePassword from "@/components/auth/ChangePassword";
import ForgotPassword from "@/components/auth/ForgotPassword";
import ResetPassword from "@/components/auth/ResetPassword";
import Tasks from "@/pages/Tasks";
import CreateTask from "@/pages/CreateTask";
import Training from "@/pages/Training";
import CreateTraining from "@/pages/CreateTraining";
import SystemSettings from "@/pages/SystemSettings";
import CareerVisualization from "@/pages/CareerVisualization";
import CareerStudents from "@/pages/CareerStudents";
import ComingSoon from "@/pages/career/ComingSoon";
import CareerCompanyAnalysis from "@/pages/CareerCompanyAnalysis";
import CareerPlacementOffer from "@/pages/CareerPlacementOffer";
import CareerAllAnalysis from "@/pages/CareerAllAnalysis";
import CareerGenderAnalysis from "@/pages/CareerGenderAnalysis";
import CareerQuotaAnalysis from "@/pages/CareerQuotaAnalysis";
import CareerMainDashboard from "@/pages/CareerMainDashboard";
import CareerHostelDayScholarAnalysis from "@/pages/CareerHostelDayScholarAnalysis";
import CareerBatchAnalysis from "@/pages/CareerBatchAnalysis";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <ModalProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<DashboardLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="career/main-dashboard" element={<CareerMainDashboard />} />
              <Route path="career/visualization" element={<CareerVisualization />} />
              <Route path="career-students" element={<CareerStudents />} />
              <Route path="career/all-analysis" element={<CareerAllAnalysis />} />
              <Route path="career/company-analysis" element={<CareerCompanyAnalysis />} />
              <Route path="career/placement-offer-analysis" element={<CareerPlacementOffer />} />
              <Route path="career/batch-analysis" element={<CareerBatchAnalysis />} />
              <Route path="career/gender-analysis" element={<CareerGenderAnalysis />} />
              <Route path="career/quota-analysis" element={<CareerQuotaAnalysis />} />
              <Route path="career/hostel-day-scholar-analysis" element={<CareerHostelDayScholarAnalysis />} />
              <Route path="profile" element={<Profile />} />
              <Route path="profile/edit" element={<EditFacultyProfile />} />
              <Route path="profile/change-password" element={<ChangePassword />} />
              <Route path="events" element={<Events />} />
              <Route path="events/create" element={<CreateEvent />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="tasks/create" element={<CreateTask />} />
              <Route path="training" element={<Training />} />
              <Route path="training/create" element={<CreateTraining />} />
              <Route path="placements" element={<div className="p-8 text-center text-muted-foreground">Placements module coming soon...</div>} />
              <Route path="faculty" element={<FacultyManagement />} />
              <Route path="faculty/directory" element={<FacultyDirectory />} />
              <Route path="faculty/edit/:facultyId" element={<EditFacultyProfile />} />
              <Route path="settings" element={<SystemSettings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </BrowserRouter>
        </ModalProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
