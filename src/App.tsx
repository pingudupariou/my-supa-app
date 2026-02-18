import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { FinancialProvider } from "@/context/FinancialContext";
import { AuthProvider } from "@/context/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ProductPlanPage } from "@/pages/ProductPlanPage";
import { OrganisationPage } from "@/pages/OrganisationPage";
import { ChargesPage } from "@/pages/ChargesPage";
import { CRMPage } from "@/pages/CRMPage";
import { PrevisionnelPage } from "@/pages/PrevisionnelPage";
import { FundingPage } from "@/pages/FundingPage";
import { ScenariosPage } from "@/pages/ScenariosPage";
import { ValuationAnalysisPage } from "@/pages/ValuationAnalysisPage";
import { InvestmentSummaryPage } from "@/pages/InvestmentSummaryPage";
import { AuthPage } from "@/pages/AuthPage";
import { PermissionsPage } from "@/pages/PermissionsPage";
import { CostFlowPage } from "@/pages/CostFlowPage";
import { TimeTrackingPage } from "@/pages/TimeTrackingPage";
import { SnapshotsPage } from "@/pages/SnapshotsPage";
import { PricingPage } from "@/pages/PricingPage";
import { PlanningDevPage } from "@/pages/PlanningDevPage";
import { TableauDeBordPage } from "@/pages/TableauDeBordPage";
import { AccueilPage } from "@/pages/AccueilPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <FinancialProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Auth route - public */}
              <Route path="/auth" element={<AuthPage />} />
              
              {/* Accueil - accessible to everyone */}
              <Route path="/accueil" element={
                <ProtectedRoute tabKey="home">
                  <DashboardLayout>
                    <AccueilPage />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              
              {/* Dashboard */}
              <Route path="/" element={
                <ProtectedRoute tabKey="tableau-de-bord">
                  <DashboardLayout>
                    <TableauDeBordPage />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/product" element={
                <ProtectedRoute tabKey="product-plan">
                  <DashboardLayout>
                    <ProductPlanPage />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/organisation" element={
                <ProtectedRoute tabKey="organisation">
                  <DashboardLayout>
                    <OrganisationPage />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/charges" element={
                <ProtectedRoute tabKey="charges">
                  <DashboardLayout>
                    <ChargesPage />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/crm" element={
                <ProtectedRoute tabKey="crm">
                  <DashboardLayout>
                    <CRMPage />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/previsionnel" element={
                <ProtectedRoute tabKey="previsionnel">
                  <DashboardLayout>
                    <PrevisionnelPage />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/funding" element={
                <ProtectedRoute tabKey="funding">
                  <DashboardLayout>
                    <FundingPage />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/scenarios" element={
                <ProtectedRoute tabKey="scenarios">
                  <DashboardLayout>
                    <ScenariosPage />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/valuation" element={
                <ProtectedRoute tabKey="valuation">
                  <DashboardLayout>
                    <ValuationAnalysisPage />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/investment-summary" element={
                <ProtectedRoute tabKey="investment-summary">
                  <DashboardLayout>
                    <InvestmentSummaryPage />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/pricing" element={
                <ProtectedRoute tabKey="pricing">
                  <DashboardLayout>
                    <PricingPage />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              
              {/* Redirect old routes */}
              <Route path="/home" element={<Navigate to="/" replace />} />
              <Route path="/tableau-de-bord" element={<Navigate to="/" replace />} />
              
              <Route path="/costflow" element={
                <ProtectedRoute tabKey="costflow">
                  <DashboardLayout>
                    <CostFlowPage />
                  </DashboardLayout>
              </ProtectedRoute>
              } />
              
              <Route path="/planning-dev" element={
                <ProtectedRoute tabKey="planning-dev">
                  <DashboardLayout>
                    <PlanningDevPage />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/timetracking" element={
                <ProtectedRoute tabKey="timetracking">
                  <DashboardLayout>
                    <TimeTrackingPage />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/snapshots" element={
                <ProtectedRoute tabKey="snapshots">
                  <DashboardLayout>
                    <SnapshotsPage />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              
              {/* Admin routes */}
              <Route path="/permissions" element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PermissionsPage />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              
              {/* Fallback */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </FinancialProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
