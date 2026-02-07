import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { FinancialProvider } from "@/context/FinancialContext";
import { AuthProvider } from "@/context/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { HomePage } from "@/pages/HomePage";
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
              
              {/* Home page - special layout */}
              <Route path="/home" element={
                <ProtectedRoute tabKey="home">
                  <HomePage />
                </ProtectedRoute>
              } />
              
              {/* Dashboard routes - protected */}
              <Route path="/" element={
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
