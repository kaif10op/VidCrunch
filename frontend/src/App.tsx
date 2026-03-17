import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import { lazy, useState, useEffect, Suspense } from "react";
import { KeyboardShortcutHelp } from "./components/KeyboardShortcutHelp";
import { StudyProvider } from "./contexts/StudyContext";
import { QuizProvider } from "./contexts/QuizContext";
import { AppLayout } from "./layouts/AppLayout.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import { SpacesProvider } from "./contexts/SpacesContext.tsx";
import { AnalysisProvider } from "./contexts/AnalysisContext.tsx";

const UIProvider = lazy(() => import("@/contexts/UIContext.tsx").then(m => ({ default: m.UIProvider })));

const LandingPage = lazy(() => import("./pages/LandingPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AnalysisPage = lazy(() => import("./pages/AnalysisPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const LibraryPage = lazy(() => import("./pages/LibraryPage"));
const SpacePage = lazy(() => import("./pages/SpacePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
import { ProtectedRoute } from "./components/ProtectedRoute.tsx";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcutHelp(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
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
                  <StudyProvider>
                  <UIProvider>
                  <QuizProvider>
                    <Suspense fallback={<div className="p-4">Loading…</div>}>
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
                    </Suspense>
                  </QuizProvider>
                  </UIProvider>
                  </StudyProvider>
                </AnalysisProvider>
              </SpacesProvider>
            </AuthProvider>
          </BrowserRouter>
          {showShortcutHelp && <KeyboardShortcutHelp open={showShortcutHelp} onClose={() => setShowShortcutHelp(false)} />}
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
