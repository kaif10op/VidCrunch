import { useRef, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, GraduationCap } from "lucide-react";
import { useAnalysisContext } from "@/contexts/AnalysisContext";
import { useUIContext } from "@/contexts/UIContext";
import { useSpacesContext } from "@/contexts/SpacesContext";
import { cn } from "@/lib/utils";
import VideoPreview from "@/components/VideoPreview";
import SummaryDisplay from "@/components/SummaryDisplay";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import LearnTools from "@/components/LearnTools";
import AIChatSidebar from "@/components/AIChatSidebar";
import { Button } from "@/components/ui/button";

export default function AnalysisPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isMobileLearnOpen, setIsMobileLearnOpen] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState("learn");

  const {
    videoData,
    videoIds,
    summaryData,
    transcript,
    analysisProgress,
    isLoading,
    activeAnalysisId,
    currentTime,
    setCurrentTime,
    isChatLoading,
    generatingTools,
    chatMessages,
    handleSendMessage,
    isChatOpen,
    setIsChatOpen,
    contextSnippet,
    setContextSnippet,
    handleTimestampClick,
    handleToolClick,
    handleGenerateTool,
    handleAddToSpace,
    loadAnalysis
  } = useAnalysisContext();

  const { isFocusMode, isVideoMinimized, setIsVideoMinimized } = useUIContext();
  const { spaces } = useSpacesContext();

  // Load analysis if videoId changes and not already loaded
  useEffect(() => {
    if (videoId && activeAnalysisId !== videoId) {
      loadAnalysis(videoId);
    }
  }, [videoId, activeAnalysisId, loadAnalysis]);

  // YouTube Progress Tracking Logic
  useEffect(() => {
    if (!iframeRef.current) return;

    const interval = setInterval(() => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: "listening", id: 1, channel: "widget" }),
          "*"
        );
      }
    }, 500);

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data.event === "infoDelivery" && data.info && data.info.currentTime !== undefined) {
          setCurrentTime(data.info.currentTime);
        }
      } catch (e) {
        // Not a JSON message or not from YT
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      clearInterval(interval);
      window.removeEventListener("message", handleMessage);
    };
  }, [videoIds, setCurrentTime]);

  if (!videoData && !isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">No analysis found</h2>
          <Button variant="outline" onClick={() => window.history.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex w-full"
    >
      <div className="flex-1">
        <div className={cn(
          "transition-all duration-700 ease-in-out",
          isFocusMode ? "max-w-6xl mx-auto pt-10 pb-24 px-8" : "max-w-6xl mx-auto px-8 py-6"
        )}>
          <div className={cn(
            "flex flex-col lg:flex-row gap-6 lg:gap-10 transition-all duration-700",
            isFocusMode && "lg:gap-12"
          )}>
            {/* Left Column - Video & Analysis */}
            <div className={cn(
              "flex-1 min-w-0 transition-all duration-700",
              isFocusMode ? "lg:w-[65%]" : ""
            )}>
              {/* Video Player Section */}
              <div className={cn(
                "transition-all duration-500 ease-in-out origin-top relative group rounded-3xl overflow-hidden shadow-xl shadow-black/5 dark:shadow-white/5 border border-gray-100 dark:border-gray-800",
                isVideoMinimized ? "h-0 opacity-0 mb-0" : "h-auto opacity-100 dark:bg-black mb-10"
              )}>
                {!isVideoMinimized && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsVideoMinimized(true)}
                    className="absolute top-4 right-6 z-50 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Minimize Video"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <VideoPreview 
                  videoId={videoIds?.[0] || ""} 
                  {...videoData}
                  thumbnail={`https://img.youtube.com/vi/${videoIds?.[0]}/maxresdefault.jpg`}
                  iframeRef={iframeRef} 
                />
              </div>

              {isVideoMinimized && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="sticky top-0 z-40 pb-4"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsVideoMinimized(false)}
                    className="w-full rounded-[24px] border border-gray-100 dark:border-gray-800 bg-white dark:bg-black hover:bg-gray-50 dark:hover:bg-gray-900 transition-all font-bold uppercase tracking-widest text-[10px] h-12 gap-3 dark:text-white"
                  >
                    <Play className="h-4 w-4" /> Show Video Player
                  </Button>
                </motion.div>
              )}

              {/* Content States: Loading, Summary, or Empty */}
              <AnimatePresence mode="wait">
                {isLoading || (activeAnalysisId && !summaryData) ? (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="py-6"
                  >
                    <div className="bg-gray-50/50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 p-8 rounded-3xl shadow-sm">
                      <div className="flex items-end justify-between mb-10">
                         <div>
                           <h2 className="text-3xl font-bold mb-3 text-black dark:text-white">Synthesizing Knowledge</h2>
                           <div className="flex items-center gap-3">
                             <div className="flex items-center gap-2">
                               <div className={cn("h-2 w-2 rounded-full animate-pulse", analysisProgress < 30 ? "bg-amber-500" : analysisProgress < 70 ? "bg-blue-500" : "bg-green-500")} />
                               <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                 {analysisProgress < 20 ? "Pre-processing" : 
                                  analysisProgress < 50 ? "Transcript Extraction" : 
                                  analysisProgress < 80 ? "AI Analysis" : 
                                  "Finalizing"}
                               </span>
                             </div>
                           </div>
                         </div>
                         <div className="text-right">
                           <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-2">Progress</p>
                           <div className="flex flex-col items-end">
                             <span className="text-5xl font-black leading-none text-black">{analysisProgress}%</span>
                           </div>
                         </div>
                      </div>
                      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                         <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${analysisProgress}%` }}
                          className="h-full bg-black transition-all duration-500"
                         />
                      </div>
                      <div className="grid grid-cols-4 gap-2 mt-10">
                         {[25, 50, 75, 100].map((step) => (
                           <div key={step} className={cn(
                             "h-1.5 rounded-full transition-colors duration-500",
                             analysisProgress >= step ? "bg-black" : "bg-gray-200"
                           )} />
                         ))}
                      </div>
                    </div>
                    <div className="opacity-40 grayscale pointer-events-none mt-12">
                      <LoadingSkeleton />
                    </div>
                  </motion.div>
                ) : summaryData ? (
                  <motion.div
                    key="summary"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-8"
                  >
                    <SummaryDisplay 
                      {...summaryData}
                      transcript={transcript}
                      transcript_segments={summaryData.transcript_segments}
                      onTimestampClick={handleTimestampClick}
                      spaces={spaces}
                      onAddToSpace={handleAddToSpace}
                      currentTime={currentTime}
                      onToolClick={handleToolClick}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {/* Right Column - Desktop Study Tools (Hidden in Focus Mode) */}
            {!isFocusMode && (
              <div className="hidden lg:block w-[380px] shrink-0 sticky top-6 self-start">
                <LearnTools 
                  onToolClick={(toolId, value) => {
                    handleToolClick(toolId, value);
                    if (['quiz', 'flashcards', 'roadmap', 'mindmap'].includes(toolId)) {
                      setActiveSidebarTab(toolId);
                    }
                  }} 
                  activeSidebarTab={activeSidebarTab}
                  onSidebarTabChange={setActiveSidebarTab}
                  hasQuiz={!!summaryData?.quiz}
                  hasFlashcards={!!summaryData?.flashcards}
                  hasRoadmap={!!summaryData?.roadmap}
                  hasMindMap={!!summaryData?.mind_map}
                  quizData={summaryData?.quiz}
                  flashcardsData={summaryData?.flashcards}
                  roadmapData={summaryData?.roadmap}
                  mindMapData={summaryData?.mind_map}
                  podcastData={summaryData?.podcast}
                  isChatLoading={isChatLoading}
                  onGenerate={handleGenerateTool}
                  generatingTools={generatingTools}
                  sets={summaryData ? [
                    ...(summaryData.quiz ? [{ id: 'quiz', name: 'Knowledge Quiz', date: 'Generated', type: 'quiz' }] : []),
                    ...(summaryData.flashcards ? [{ id: 'flashcards', name: 'Brain Cards', date: 'Generated', type: 'flashcards' }] : []),
                    ...(summaryData.roadmap ? [{ id: 'roadmap', name: 'Learning Path', date: 'Generated', type: 'roadmap' }] : []),
                    ...(summaryData.mind_map ? [{ id: 'mind_map', name: 'Mind Map', date: 'Generated', type: 'mindmap' }] : []),
                  ] : []}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Study Tools (Hidden in Focus Mode) */}
      {!isFocusMode && (
        <>
          <button
            onClick={() => setIsMobileLearnOpen(!isMobileLearnOpen)}
            className="lg:hidden fixed bottom-6 right-6 z-50 w-14 h-14 bg-black text-white rounded-2xl shadow-xl flex items-center justify-center hover:bg-gray-800 transition-all"
            aria-label="Open learning tools"
          >
            <GraduationCap className="h-6 w-6" />
          </button>

          <AnimatePresence>
            {isMobileLearnOpen && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="lg:hidden fixed inset-0 bg-black/20 z-40"
                  onClick={() => setIsMobileLearnOpen(false)}
                />
                <motion.div 
                  initial={{ y: "100%" }} 
                  animate={{ y: 0 }} 
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[70vh] overflow-y-auto"
                >
                  <div className="p-1 flex justify-center">
                    <div className="w-10 h-1 rounded-full bg-gray-200" />
                  </div>
                  <LearnTools 
                    onToolClick={(id, v) => { 
                      handleToolClick(id, v); 
                      if (['quiz', 'flashcards', 'roadmap', 'mindmap'].includes(id)) {
                        setActiveSidebarTab(id);
                      } else {
                        setIsMobileLearnOpen(false); 
                      }
                    }}
                    activeSidebarTab={activeSidebarTab}
                    onSidebarTabChange={setActiveSidebarTab}
                    hasQuiz={!!summaryData?.quiz?.length}
                    hasFlashcards={!!summaryData?.flashcards?.length}
                    hasRoadmap={!!summaryData?.roadmap}
                    hasMindMap={!!summaryData?.mind_map?.nodes?.length}
                    quizData={summaryData?.quiz}
                    flashcardsData={summaryData?.flashcards}
                    roadmapData={summaryData?.roadmap}
                    mindMapData={summaryData?.mind_map}
                    isChatLoading={isChatLoading}
                    sets={[
                      ...(summaryData?.quiz?.length ? [{ id: 'quiz-set', name: `Quiz (${summaryData.quiz.length} questions)`, date: 'Generated', type: 'quiz' }] : []),
                      ...(summaryData?.flashcards?.length ? [{ id: 'flashcard-set', name: `Flashcards (${summaryData.flashcards.length} cards)`, date: 'Generated', type: 'flashcards' }] : []),
                      ...(summaryData?.roadmap ? [{ id: 'roadmap-set', name: `Learning Roadmap`, date: 'Generated', type: 'roadmap' }] : []),
                      ...(summaryData?.mind_map ? [{ id: 'mindmap-set', name: `Mind Map`, date: 'Generated', type: 'mindmap' }] : []),
                    ]}
                    isMobile
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}

      {/* AI Chat Sidebar */}
      <AIChatSidebar
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        isLoading={isChatLoading}
        contextSnippet={contextSnippet}
        onClearContext={() => setContextSnippet(null)}
      />
    </motion.div>
  );
}
