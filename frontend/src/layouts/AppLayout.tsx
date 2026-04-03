import { Outlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { useUIContext } from "@/contexts/UIContext";
import { useAnalysisContext } from "@/contexts/AnalysisContext";

// Modals to be extracted later
import SearchModal from "../components/SearchModal";
import TopUpDialog from "../components/TopUpDialog";
import FeedbackDialog from "../components/FeedbackDialog";
import ProfileUpdateDialog from "../components/ProfileUpdateDialog";

export function AppLayout() {
  const { 
    isFocusMode, 
    setIsFocusMode,
    isSearchModalOpen,
    setIsSearchModalOpen,
  } = useUIContext();

  const { activeAnalysisId } = useAnalysisContext();

  return (
    <div className="flex flex-col min-h-[100dvh] w-full bg-background relative selection:bg-primary/20 selection:text-primary font-sans text-foreground overflow-x-hidden">
      {/* Background Orbs */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute top-[0%] left-[10%] h-[60vw] max-w-[800px] aspect-square rounded-full bg-primary/[0.04] blur-[140px]" />
        <div className="absolute bottom-[0%] right-[5%] h-[50vw] max-w-[700px] aspect-square rounded-full bg-[hsl(234,89%,64%)]/[0.03] blur-[150px]" />
        <div className="absolute top-[40%] left-[60%] h-[30vw] max-w-[400px] aspect-square rounded-full bg-emerald-500/[0.02] blur-[100px]" />
      </div>

      {/* Main Top Navigation */}
      {!isFocusMode && <TopNav />}

      {/* Main content wrapper */}
      <main id="main-content" className="flex-col flex flex-1 w-full max-w-6xl mx-auto md:py-8 pt-4 pb-20 px-4 md:px-6 relative z-10 overflow-y-auto scrollbar-none">
        <Outlet />
      </main>

      {/* Floating Exit Focus Button */}
      <AnimatePresence>
        {isFocusMode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60]"
          >
            <Button
              onClick={() => setIsFocusMode(false)}
              className="group h-12 rounded-full bg-card/90 border border-white/[0.1] backdrop-blur-xl px-6 text-sm font-bold text-foreground shadow-2xl shadow-black hover:bg-white/[0.05] gap-3"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
                 <X className="h-3.5 w-3.5 text-primary group-hover:rotate-90 transition-transform duration-300" />
              </div>
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

      {/* Global Modals */}
      <SearchModal />
      <TopUpDialog />
      <FeedbackDialog />
      <ProfileUpdateDialog />
    </div>
  );
}
