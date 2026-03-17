import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import LandingPage from "./pages/LandingPage.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";
import AnalysisPage from "./pages/AnalysisPage.tsx";
import HistoryPage from "./pages/HistoryPage.tsx";
import LibraryPage from "./pages/LibraryPage.tsx";
import SpacePage from "./pages/SpacePage.tsx";
import SettingsPage from "./pages/SettingsPage.tsx";
import { ProtectedRoute } from "./components/ProtectedRoute.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import { SpacesProvider } from "./contexts/SpacesContext.tsx";
import { AnalysisProvider } from "./contexts/AnalysisContext.tsx";
import { UIProvider } from "./contexts/UIContext.tsx";
import { AppLayout } from "./layouts/AppLayout.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-black focus:text-white focus:rounded-lg focus:text-sm focus:font-medium">
          Skip to main content
        </a>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <SpacesProvider>
              <AnalysisProvider>
                <UIProvider>
                  <Routes>
                    <Route path="/" element={<LandingPage />} />
                    
                    <Route element={<ProtectedRoute />}>
                      <Route element={<AppLayout />}>
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/analysis/:videoId" element={<AnalysisPage />} />
                        <Route path="/history" element={<HistoryPage />} />
                        <Route path="/library" element={<LibraryPage />} />
                        <Route path="/space/:spaceId" element={<SpacePage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                      </Route>
                    </Route>

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </UIProvider>
              </AnalysisProvider>
            </SpacesProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
