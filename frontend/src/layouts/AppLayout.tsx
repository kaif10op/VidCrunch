import { Outlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, PlusCircle, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import Sidebar from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { useUIContext } from "@/contexts/UIContext";
import { useAuthContext } from "@/contexts/AuthContext";
import { useAnalysisContext } from "@/contexts/AnalysisContext";
import { useSpacesContext } from "@/contexts/SpacesContext";

// Modals to be extracted later
import SearchModal from "../components/SearchModal";
import TopUpDialog from "../components/TopUpDialog";
import FeedbackDialog from "../components/FeedbackDialog";
import ProfileUpdateDialog from "../components/ProfileUpdateDialog";

export function AppLayout() {
  const { 
    isSidebarCollapsed, 
    setIsSidebarCollapsed, 
    isFocusMode, 
    setIsFocusMode,
    isSearchModalOpen,
    setIsSearchModalOpen,
    isTopUpOpen,
    setIsTopUpOpen,
    isFeedbackOpen,
    setIsFeedbackOpen,
    isProfileUpdateOpen,
    setIsProfileUpdateOpen
  } = useUIContext();

  const { user, credits, handleLogout } = useAuthContext();
  const { videoData, activeAnalysisId, handleBackToDashboard } = useAnalysisContext();
  const { spaces, handleCreateNewSpace } = useSpacesContext();

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans text-foreground">
      {/* Sidebar - Desktop */}
      {!isFocusMode && (
        <Sidebar 
          isCollapsed={isSidebarCollapsed}
          onCollapse={setIsSidebarCollapsed}
          user={user}
          onLogout={handleLogout}
          spaces={spaces}
          onCreateSpace={handleCreateNewSpace}
          credits={credits} 
          onAuthSuccess={() => {}} 
        />
      )}

      {/* Main Content */}
      <main 
        id="main-content"
        className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out relative"
        )}
      >
        {/* Global Nav / Header - Portal Style */}
        {!isFocusMode && (
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="h-16 border-b border-border bg-background/70 backdrop-blur-xl sticky top-0 z-40 shrink-0 flex items-center transition-all px-6"
          >
            <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
              <div className="flex items-center gap-4 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                       <PlusCircle className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex flex-col">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 leading-none mb-1">
                        {activeAnalysisId && videoData ? "Deep Analysis" : "Portal"}
                      </p>
                      <h1 className="text-sm font-bold text-foreground truncate max-w-[200px] md:max-w-[400px]">
                        {activeAnalysisId && videoData ? videoData.title : "Dashboard"}
                      </h1>
                    </div>
                  </div>
              </div>
              
              <div className="flex items-center gap-3 shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsFocusMode(!isFocusMode)}
                    className={cn(
                      "rounded-xl h-9 px-4 text-[10px] font-black uppercase tracking-widest transition-all gap-2 border border-border shadow-sm",
                      isFocusMode 
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 border-transparent" 
                        : "bg-background text-muted-foreground hover:bg-secondary/80"
                    )}
                  >
                    <GraduationCap className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{isFocusMode ? "Exit Focus" : "Focus Mode"}</span>
                  </Button>

                  <div className="w-[1px] h-6 bg-border mx-1" />

                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setIsTopUpOpen(true)}
                    className="rounded-xl h-9 px-5 text-[10px] font-black uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                  >
                    Upgrade
                  </Button>
              </div>
            </div>
          </motion.div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <Outlet />
        </div>

        {/* Floating Exit Focus Button */}
        <AnimatePresence>
          {isFocusMode && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              className="fixed top-8 left-1/2 -translate-x-1/2 z-[60]"
            >
              <Button
                onClick={() => setIsFocusMode(false)}
                className="rounded-full h-12 px-8 bg-primary text-primary-foreground shadow-2xl hover:bg-primary/90 font-black text-xs uppercase tracking-[0.2em] border border-primary-foreground/20 backdrop-blur-sm group"
              >
                <X className="mr-2 h-4 w-4 group-hover:rotate-90 transition-transform duration-300" />
                Exit Focus Mode
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Bottom Navigation */}
        {!isFocusMode && (
          <BottomNav 
            activeView={activeAnalysisId ? "analysis" : "dashboard"} 
            onViewChange={(view) => {
              if (view === "search-modal") {
                setIsSearchModalOpen(true);
              }
            }}
          />
        )}
      </main>

      {/* Global Modals */}
      <SearchModal />
      <TopUpDialog />
      <FeedbackDialog />
      <ProfileUpdateDialog />
    </div>
  );
}
