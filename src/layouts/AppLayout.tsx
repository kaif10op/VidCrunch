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
    <div className="flex h-screen bg-white dark:bg-black overflow-hidden font-sans text-gray-900 dark:text-gray-100">
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
        {/* Global Nav / Header */}
        {!isFocusMode && (
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="h-16 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-black/80 backdrop-blur-md sticky top-0 z-40 shrink-0"
          >
            <div className="max-w-5xl mx-auto px-6 w-full h-full flex items-center justify-between">
              <div className="flex items-center gap-4 min-w-0">

                  
                  <div className="flex items-center gap-2 text-gray-300 dark:text-gray-700 mx-2 hidden md:flex">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-gray-800" />
                  </div>

                  {activeAnalysisId && videoData ? (
                    <div className="flex items-center gap-3 min-w-0">
                      <h1 className="text-sm font-bold text-foreground truncate max-w-[300px]">{videoData.title}</h1>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-2">Dashboard</span>
                    </div>
                  )}
              </div>
              
              <div className="flex items-center gap-3 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsFocusMode(!isFocusMode)}
                    className={cn(
                      "rounded-xl h-9 px-4 text-xs font-bold uppercase tracking-wider transition-all gap-2",
                      isFocusMode ? "bg-black text-white hover:bg-gray-900" : "bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900 border border-gray-100 dark:border-gray-800"
                    )}
                  >
                    <GraduationCap className="h-4 w-4" />
                    {isFocusMode ? "Exit Focus" : "Focus Mode"}
                  </Button>

                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setIsTopUpOpen(true)}
                    className="rounded-full h-9 px-5 text-xs font-bold uppercase tracking-wider bg-black dark:bg-white text-white dark:text-black hover:bg-gray-900 dark:hover:bg-gray-100 shadow-lg shadow-black/5"
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
                className="rounded-full h-12 px-8 bg-black dark:bg-white text-white dark:text-black shadow-2xl hover:bg-gray-900 dark:hover:bg-gray-100 font-black text-xs uppercase tracking-[0.2em] border border-white/20 backdrop-blur-sm group"
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
