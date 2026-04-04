import { useRef, useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, GraduationCap, Map as MapIcon, FileText, List, Settings2, Sparkles } from "lucide-react";
import { useAnalysisContext } from "@/contexts/AnalysisContext";
import { useUIContext } from "@/contexts/UIContext";
import { useSpacesContext } from "@/contexts/SpacesContext";
import { cn } from "@/lib/utils";
import VideoPreview from "@/components/VideoPreview";
import SummaryDisplay from "@/components/SummaryDisplay";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import LearnTools from "@/components/LearnTools";
import { Button } from "@/components/ui/button";
import MindMapDetail from "@/components/MindMapDetail";
import AIChatSidebar from "@/components/AIChatSidebar";
import { TOOL_IDS, UTILITY_TOOLS } from "@/lib/toolConstants";

const ANALYSIS_UI_STORAGE_PREFIX = "youtube-genius:analysis-ui";

type AnalysisUiState = {
  activeSidebarTab: string;
  openSidebarTabs: string[];
  isSidebarMaximized: boolean;
  isAutoScroll: boolean;
};

const createDefaultAnalysisUiState = (): AnalysisUiState => ({
  activeSidebarTab: "learn",
  openSidebarTabs: ["learn"],
  isSidebarMaximized: false,
  isAutoScroll: true,
});

const getAnalysisUiStorageKey = (analysisKey: string | undefined) => `${ANALYSIS_UI_STORAGE_PREFIX}:${analysisKey || "default"}`;

const loadAnalysisUiState = (analysisKey: string | undefined): AnalysisUiState => {
  if (typeof window === "undefined") {
    return createDefaultAnalysisUiState();
  }

  try {
    const raw = window.localStorage.getItem(getAnalysisUiStorageKey(analysisKey));
    if (!raw) {
      return createDefaultAnalysisUiState();
    }

    const parsed = JSON.parse(raw) as Partial<AnalysisUiState>;
    return {
      activeSidebarTab: typeof parsed.activeSidebarTab === "string" ? parsed.activeSidebarTab : "learn",
      openSidebarTabs: Array.isArray(parsed.openSidebarTabs) && parsed.openSidebarTabs.length > 0 ? parsed.openSidebarTabs : ["learn"],
      isSidebarMaximized: typeof parsed.isSidebarMaximized === "boolean" ? parsed.isSidebarMaximized : false,
      isAutoScroll: typeof parsed.isAutoScroll === "boolean" ? parsed.isAutoScroll : true,
    };
  } catch {
    return createDefaultAnalysisUiState();
  }
};

export default function AnalysisPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isMobileLearnOpen, setIsMobileLearnOpen] = useState(false);
  const [analysisUiState, setAnalysisUiState] = useState<AnalysisUiState>(() => loadAnalysisUiState(videoId));

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
    aiExplanation,
    setAiExplanation,
    quizAIExplanation,
    setQuizAIExplanation,
    roadmapAIExplanation,
    setRoadmapAIExplanation,
    handleTimestampClick,
    handleToolClick,
    handleGenerateTool,
    handleAddToSpace,
    loadAnalysis,
    clearExplanation
  } = useAnalysisContext();

  const { isFocusMode, setIsFocusMode, isVideoMinimized, setIsVideoMinimized } = useUIContext();
  const { spaces } = useSpacesContext();

  useEffect(() => {
    setAnalysisUiState(loadAnalysisUiState(videoId));
  }, [videoId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(getAnalysisUiStorageKey(videoId), JSON.stringify(analysisUiState));
  }, [analysisUiState, videoId]);

  const activeSidebarTab = analysisUiState.activeSidebarTab;
  const openSidebarTabs = analysisUiState.openSidebarTabs;
  const isSidebarMaximized = analysisUiState.isSidebarMaximized;
  const isAutoScroll = analysisUiState.isAutoScroll;

  const setActiveSidebarTab = (tab: string) => {
    setAnalysisUiState(prev => ({
      ...prev,
      activeSidebarTab: tab,
      openSidebarTabs: prev.openSidebarTabs.includes(tab) ? prev.openSidebarTabs : [...prev.openSidebarTabs, tab],
    }));
  };

  const setOpenSidebarTabs = (updater: ((tabs: string[]) => string[]) | string[]) => {
    setAnalysisUiState(prev => ({
      ...prev,
      openSidebarTabs: typeof updater === "function" ? updater(prev.openSidebarTabs) : updater,
    }));
  };

  const setIsSidebarMaximized = (value: boolean | ((prev: boolean) => boolean)) => {
    setAnalysisUiState(prev => ({
      ...prev,
      isSidebarMaximized: typeof value === "function" ? value(prev.isSidebarMaximized) : value,
    }));
  };

  const setIsAutoScroll = (value: boolean | ((prev: boolean) => boolean)) => {
    setAnalysisUiState(prev => ({
      ...prev,
      isAutoScroll: typeof value === "function" ? value(prev.isAutoScroll) : value,
    }));
  };

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

  const handleOpenTab = (tabId: string) => {
    if (!openSidebarTabs.includes(tabId)) {
      setOpenSidebarTabs(prev => [...prev, tabId]);
    }
    setActiveSidebarTab(tabId);
  };

  const handleCloseTab = (tabId: string) => {
    setOpenSidebarTabs(prev => {
      const newList = prev.filter(t => t !== tabId);
      if (activeSidebarTab === tabId) {
        setActiveSidebarTab("learn");
      }
      return newList;
    });
  };

  const sets = useMemo(() => [
    { id: TOOL_IDS.SUMMARY, name: 'Overview & Insights', date: 'Generated', type: 'summary', isGenerating: false },
    ...(summaryData?.quiz?.length ? [{ id: TOOL_IDS.QUIZ, name: 'Knowledge Quiz', date: 'Generated', type: 'quiz', isGenerating: false }] : []),
    ...(summaryData?.flashcards?.length ? [{ id: TOOL_IDS.FLASHCARDS, name: 'Brain Cards', date: 'Generated', type: 'flashcards', isGenerating: false }] : []),
    ...(summaryData?.roadmap ? [{ id: TOOL_IDS.ROADMAP, name: 'Learning Path', date: 'Generated', type: 'roadmap', isGenerating: false }] : []),
    ...(summaryData?.mind_map ? [{ id: TOOL_IDS.MIND_MAP, name: 'Mind Map', date: 'Generated', type: 'mindmap', isGenerating: false }] : []),
    ...(summaryData?.podcast ? [{ id: TOOL_IDS.PODCAST, name: 'Audio Podcast', date: 'Generated', type: 'podcast', isGenerating: false }] : []),
    ...(summaryData?.glossary?.length ? [{ id: TOOL_IDS.GLOSSARY, name: 'Video Glossary', date: 'Generated', type: 'glossary', isGenerating: false }] : []),
    ...(summaryData?.resources?.length ? [{ id: TOOL_IDS.RESOURCES, name: 'Resource Hub', date: 'Generated', type: 'resources', isGenerating: false }] : []),
    ...(generatingTools.map(toolId => ({
      id: `gen-${toolId}`,
      name: `Generating ${toolId.charAt(0).toUpperCase() + toolId.slice(1)}...`,
      date: 'In Progress',
      type: toolId,
      isGenerating: true
    })))
  ], [summaryData, generatingTools]);

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
          isSidebarMaximized ? "w-full h-screen overflow-hidden" : (isFocusMode ? "max-w-6xl mx-auto pt-10 pb-24 px-8" : "max-w-6xl mx-auto px-8 py-6")
        )}>
          <div className={cn(
            "flex flex-col lg:flex-row gap-6 lg:gap-10 transition-all duration-700",
            isFocusMode && "lg:gap-12",
            isSidebarMaximized && "gap-0 h-full overflow-hidden"
          )}>
            {/* Left Column - Video & Analysis */}
            <div className={cn(
              "flex-1 min-w-0 transition-all duration-700",
              isFocusMode ? "lg:w-[65%]" : "",
              isSidebarMaximized && "hidden"
            )}>
              {/* Video Player Section */}
              <div className={cn(
                "transition-all duration-500 ease-in-out origin-top relative group rounded-3xl overflow-hidden shadow-xl shadow-foreground/5 border border-border",
                isVideoMinimized ? "h-0 opacity-0 mb-0" : "h-auto opacity-100 bg-background mb-10"
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
                    className="w-full rounded-[24px] border border-border bg-background hover:bg-secondary transition-all font-bold uppercase tracking-widest text-[10px] h-12 gap-3 text-foreground"
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
                    className="py-12"
                  >
                    <div className="bg-card/50 backdrop-blur-xl border border-border p-10 md:p-16 rounded-[3rem] shadow-2xl shadow-foreground/5 relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-full h-1 bg-secondary overflow-hidden">
                        <motion.div 
                          initial={{ x: "-100%" }}
                          animate={{ x: "100%" }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          className="w-1/2 h-full bg-primary"
                        />
                      </div>
                      
                      <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-16">
                         <div className="space-y-4">
                           <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary">
                             <Sparkles className="h-3 w-3 animate-pulse" />
                             <span className="text-[10px] font-black uppercase tracking-widest">Genius AI Active</span>
                           </div>
                           <h2 className="text-4xl md:text-5xl font-black text-foreground tracking-tight leading-[1.1]">
                             Synthesizing <br /> <span className="text-muted-foreground/40">Knowledge.</span>
                           </h2>
                           <div className="flex items-center gap-4">
                             <div className="flex items-center gap-2">
                               <div className={cn("h-2.5 w-2.5 rounded-full animate-pulse", analysisProgress < 30 ? "bg-amber-500" : analysisProgress < 70 ? "bg-blue-500" : "bg-emerald-500")} />
                               <span className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-60">
                                 {analysisProgress < 20 ? "Pre-processing" : 
                                  analysisProgress < 50 ? "Transcript Extraction" : 
                                  analysisProgress < 80 ? "AI Analysis" : 
                                  "Finalizing Insights"}
                               </span>
                             </div>
                           </div>
                         </div>
                         <div className="text-left md:text-right shrink-0">
                           <p className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.3em] mb-2">Synthesis Progress</p>
                           <div className="flex items-baseline md:justify-end gap-1">
                             <span className="text-7xl font-black leading-none text-foreground tracking-tighter">{analysisProgress}</span>
                             <span className="text-2xl font-black text-muted-foreground/20">%</span>
                           </div>
                         </div>
                      </div>

                      <div className="relative h-3 w-full bg-secondary/50 rounded-full overflow-hidden mb-12">
                         <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${analysisProgress}%` }}
                          transition={{ type: "spring", damping: 20 }}
                          className="absolute inset-x-0 h-full bg-primary shadow-[0_0_20px_rgba(var(--primary),0.3)]"
                         />
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                         {[
                           { label: "Scan Content", target: 25 },
                           { label: "Tokenize Data", target: 50 },
                           { label: "AI Reasoning", target: 75 },
                           { label: "Visual Maps", target: 100 }
                         ].map((step) => (
                           <div key={step.target} className="space-y-4">
                              <div className={cn(
                                "h-1 rounded-full transition-all duration-700",
                                analysisProgress >= step.target ? "bg-primary" : "bg-secondary"
                              )} />
                              <p className={cn(
                                "text-[9px] font-black uppercase tracking-widest transition-colors",
                                analysisProgress >= step.target ? "text-foreground" : "text-muted-foreground/30"
                              )}>{step.label}</p>
                           </div>
                         ))}
                      </div>
                    </div>
                    <div className="opacity-20 grayscale pointer-events-none mt-16 scale-95 blur-[2px]">
                      <LoadingSkeleton />
                    </div>
                  </motion.div>
                ) : summaryData ? (
                  <motion.div
                    key="summary"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-12"
                  >
                    <div className="bg-card rounded-[3.5rem] overflow-hidden border border-border shadow-2xl shadow-foreground/5 transition-all">
                      {/* Sub-navigation for Detail View */}
                      <div className="flex items-center gap-8 px-12 pt-10 pb-4 border-b border-border bg-secondary/10">
                        <button
                          onClick={() => handleOpenTab(TOOL_IDS.CHAPTERS)}
                          className={cn("text-[10px] font-black uppercase tracking-[0.2em] pb-3 transition-all relative", activeSidebarTab === TOOL_IDS.CHAPTERS ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground")}
                        >
                          Chapters
                          {activeSidebarTab === TOOL_IDS.CHAPTERS && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
                        </button>
                        <button
                          onClick={() => handleOpenTab(TOOL_IDS.TRANSCRIPT)}
                          className={cn("text-[10px] font-black uppercase tracking-[0.2em] pb-3 transition-all relative", activeSidebarTab === TOOL_IDS.TRANSCRIPT ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground")}
                        >
                          Transcript
                          {activeSidebarTab === TOOL_IDS.TRANSCRIPT && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
                        </button>
                        <button
                          onClick={() => handleOpenTab(TOOL_IDS.MIND_MAP)}
                          className={cn("text-[10px] font-black uppercase tracking-[0.2em] pb-3 transition-all relative", activeSidebarTab === TOOL_IDS.MIND_MAP ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground")}
                        >
                          Mastery Map
                          {activeSidebarTab === TOOL_IDS.MIND_MAP && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
                        </button>
                      </div>

                      {/* Unified Search/Scroll Controls for Detail View */}
                      <div className="flex items-center gap-6 px-10 pt-4 pb-6 border-b border-border">
                        {activeSidebarTab === TOOL_IDS.TRANSCRIPT && (
                          <button 
                            onClick={() => setIsAutoScroll(!isAutoScroll)}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all shadow-sm",
                              isAutoScroll ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:bg-secondary"
                            )}
                          >
                            <Settings2 className={cn("h-3.5 w-3.5", isAutoScroll ? "text-primary-foreground" : "text-muted-foreground")} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Auto Scroll</span>
                          </button>
                        )}
                        <div className="flex-1" />
                        <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground/30 uppercase tracking-widest">
                             <span>Detail View</span>
                             <div className="w-1 h-1 rounded-full bg-border" />
                             <span className="text-muted-foreground">{activeSidebarTab.charAt(0).toUpperCase() + activeSidebarTab.slice(1)}</span>
                        </div>
                      </div>

                      <div className="min-h-[600px]">
                        {activeSidebarTab === TOOL_IDS.MIND_MAP ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="h-[700px] bg-secondary/5"
                          >
                            <MindMapDetail 
                              mindMap={summaryData.mind_map} 
                              onAIAction={(toolId, value, context) => {
                                const isGenerationRequest = value?.toLowerCase().includes('generate') || value?.toLowerCase().includes('regenerate');
                                if ((toolId === TOOL_IDS.MIND_MAP || toolId === 'mind_map' || toolId === 'mindmap') && isGenerationRequest) {
                                  handleGenerateTool(TOOL_IDS.MIND_MAP);
                                  return;
                                }
                                handleToolClick(toolId, value, context);
                              }}
                              onTimestampClick={handleTimestampClick}
                              isGenerating={generatingTools.includes(TOOL_IDS.MIND_MAP)}
                            />
                          </motion.div>
                        ) : (
                          <SummaryDisplay 
                            {...summaryData}
                            activeTab={activeSidebarTab === TOOL_IDS.TRANSCRIPT ? 'transcripts' : (activeSidebarTab === TOOL_IDS.CHAPTERS ? 'chapters' : 'chapters')}
                            onTabChange={(tab) => {
                              const tabId = tab === 'chapters' ? TOOL_IDS.CHAPTERS : TOOL_IDS.TRANSCRIPT;
                              handleOpenTab(tabId);
                            }}
                            transcript={transcript}
                            transcript_segments={summaryData.transcript_segments}
                            onTimestampClick={handleTimestampClick}
                            spaces={spaces}
                            onAddToSpace={handleAddToSpace}
                            currentTime={currentTime}
                            onToolClick={(toolId, value, context) => {
                              if (toolId === TOOL_IDS.MIND_MAP && !value) {
                                handleOpenTab(TOOL_IDS.MIND_MAP);
                                return;
                              }
                              handleToolClick(toolId, value, context);
                              if ([(TOOL_IDS.CHAPTERS as string), TOOL_IDS.TRANSCRIPT, TOOL_IDS.SUMMARY].includes(toolId)) {
                                handleOpenTab(toolId);
                              }
                            }}
                            aiExplanation={aiExplanation}
                            onClearExplanation={clearExplanation}
                            isAutoScroll={isAutoScroll}
                            setIsAutoScroll={setIsAutoScroll}
                          />
                        )}
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {/* Right Column - Desktop Study Tools (Hidden in Focus Mode) */}
            {!isFocusMode && (
              <div className={cn(
                "hidden lg:block shrink-0 transition-all duration-500 overflow-hidden",
                isSidebarMaximized ? "w-full h-screen" : "w-[380px] sticky top-6 self-start h-[calc(100vh-48px)]"
              )}>
                <LearnTools
                  onToolClick={(toolId, value, context) => {
                    const utilityTools = UTILITY_TOOLS;
                    const isAvailable = sets.some(s => s.type === toolId && !s.isGenerating) || utilityTools.includes(toolId as any);

                    if (value) {
                      // It's a follow-up or specific action (like hint)
                      handleToolClick(toolId, value, context);
                      return;
                    }

                    // If it's a utility tool, just open it
                    if (utilityTools.includes(toolId as any)) {
                      handleOpenTab(toolId);
                      // Some utility tools also trigger an initial AI action if nothing exists
                      handleToolClick(toolId);
                      return;
                    }

                    // For generated tools (quiz, etc):
                    if (!isAvailable) {
                      handleGenerateTool(toolId);
                      return;
                    }

                    // If already generated/available, open the tab
                    if (toolId === TOOL_IDS.MIND_MAP) {
                      handleOpenTab(TOOL_IDS.MIND_MAP);
                      return;
                    }

                    handleOpenTab(toolId);
                  }} 
                  activeSidebarTab={activeSidebarTab}
                  onSidebarTabChange={setActiveSidebarTab}
                  onCloseTab={handleCloseTab}
                  onMaximize={() => setIsSidebarMaximized(!isSidebarMaximized)}
                  isMaximized={isSidebarMaximized}
                  openTabs={openSidebarTabs}
                  hasQuiz={!!summaryData?.quiz?.length}
                  hasFlashcards={!!summaryData?.flashcards?.length}
                  hasRoadmap={!!summaryData?.roadmap?.steps?.length}
                  hasMindMap={!!summaryData?.mind_map?.nodes?.length}
                  quizData={summaryData?.quiz}
                  flashcardsData={summaryData?.flashcards}
                  roadmapData={summaryData?.roadmap}
                  mindMapData={summaryData?.mind_map}
                  onGenerate={handleGenerateTool}
                  generatingTools={generatingTools}
                  overview={summaryData?.overview}
                  keyPoints={summaryData?.keyPoints || summaryData?.key_points}
                  takeaways={summaryData?.takeaways}
                  tags={summaryData?.tags}
                  learningContext={summaryData?.learning_context}
                  onTimestampClick={handleTimestampClick}
                  timestamps={summaryData?.timestamps}
                  onAIAction={handleToolClick}
                  aiExplanation={aiExplanation}
                  quizAIExplanation={quizAIExplanation}
                  roadmapAIExplanation={roadmapAIExplanation}
                  onClearExplanation={clearExplanation}
                  sets={sets}
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
            className="lg:hidden fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary text-primary-foreground rounded-2xl shadow-xl flex items-center justify-center hover:bg-primary/90 transition-all"
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
                  className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl shadow-2xl max-h-[70vh] overflow-y-auto border-t border-border"
                >
                  <div className="p-1 flex justify-center">
                    <div className="w-10 h-1 rounded-full bg-secondary" />
                  </div>
                  <LearnTools
                    onToolClick={(id, v, c) => {
                      const utilityTools = UTILITY_TOOLS;
                      const isAvailable = sets.some(s => s.type === id && !s.isGenerating) || utilityTools.includes(id as any);

                      if (v) {
                        handleToolClick(id, v, c);
                        return;
                      }

                      if (utilityTools.includes(id as any)) {
                        handleOpenTab(id);
                        handleToolClick(id);
                        setIsMobileLearnOpen(false);
                        return;
                      }

                      if (!isAvailable) {
                        handleGenerateTool(id);
                        return;
                      }

                      if (id === TOOL_IDS.MIND_MAP) {
                        handleOpenTab(TOOL_IDS.MIND_MAP);
                        setIsMobileLearnOpen(false);
                        return;
                      }

                      handleOpenTab(id);
                      setIsMobileLearnOpen(false); 
                    }}
                    activeSidebarTab={activeSidebarTab}
                    onSidebarTabChange={setActiveSidebarTab}
                    onCloseTab={handleCloseTab}
                    openTabs={openSidebarTabs}
                    hasQuiz={!!summaryData?.quiz?.length}
                    hasFlashcards={!!summaryData?.flashcards?.length}
                    hasRoadmap={!!summaryData?.roadmap?.steps?.length}
                    hasMindMap={!!summaryData?.mind_map?.nodes?.length}
                    quizData={summaryData?.quiz}
                    flashcardsData={summaryData?.flashcards}
                    roadmapData={summaryData?.roadmap}
                    mindMapData={summaryData?.mind_map}
                    onGenerate={handleGenerateTool}
                    generatingTools={generatingTools}
                    overview={summaryData?.overview}
                    keyPoints={summaryData?.keyPoints || summaryData?.key_points}
                    takeaways={summaryData?.takeaways}
                    tags={summaryData?.tags}
                    learningContext={summaryData?.learning_context}
                    onTimestampClick={handleTimestampClick}
                    timestamps={summaryData?.timestamps}
                    onAIAction={handleToolClick}
                    aiExplanation={aiExplanation}
                    quizAIExplanation={quizAIExplanation}
                    onClearExplanation={() => {
                      setAiExplanation(null);
                      setQuizAIExplanation(null);
                    }}
                    sets={sets}
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
        title={summaryData?.overview ? "Analysis Chat" : "Video Chat"}
        subtitle={videoData?.title || "Ask follow-up questions, request summaries, or drill into a topic."}
        storageKey={videoId ? `analysis:${videoId}` : activeAnalysisId ? `analysis:${activeAnalysisId}` : "analysis:default"}
      />
    </motion.div>
  );
}
