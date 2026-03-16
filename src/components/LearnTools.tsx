import { 
  Copy, Check, BookOpen, Lightbulb, 
  Clock, Map as MapIcon, FileText, 
  Brain, Target, MessageSquare,
  Rocket, Star, HelpCircle, Layers, LayoutGrid,
  ChevronDown, Plus, FolderPlus, Search, 
  ChevronUp, Settings2, Share2, MoreVertical, Maximize2, Sliders,
  ChevronRight, StickyNote, MoreHorizontal, Mic, History,
  User as UserIcon, Sparkles, X, ChevronLeftCircle,
  Headphones, Video
} from "lucide-react";
import { useRef, useEffect, useState, useMemo, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RichMessage } from "./RichMessage";
import { useAnalysisContext } from "@/contexts/AnalysisContext";
import { AnimatePresence, motion } from "framer-motion";

const QuizTab = lazy(() => import("./QuizTab"));
const MindMapTab = lazy(() => import("./MindMapTab"));
const Flashcards = lazy(() => import("./Flashcards"));
const NotesTool = lazy(() => import("./NotesTool"));
const SynthesisTab = lazy(() => import("./SynthesisTab"));

interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

interface RoadmapStep {
  step: number;
  task: string;
  description: string;
}

interface MindMapData {
  nodes: { id: string; label: string }[];
  edges: { source: string; target: string; label?: string }[];
}

interface Timestamp {
  time: string;
  label: string;
}

interface LearningContext {
  why: string;
  whatToHowTo: string;
  bestWay: string;
}

interface LearnToolsProps {
  onToolClick?: (toolId: string, value?: string, context?: string) => void;
  sets?: { id: string; name: string; date: string; type: string; isGenerating?: boolean }[];
  hasQuiz?: boolean;
  hasFlashcards?: boolean;
  hasRoadmap?: boolean;
  hasMindMap?: boolean;
  onGenerate?: (toolId: string, append?: boolean) => void;
  generatingTools?: string[];
  quizData?: QuizQuestion[];
  roadmapData?: { title: string; steps: RoadmapStep[] };
  mindMapData?: MindMapData;
  flashcardsData?: { front: string; back: string }[];
  podcastData?: { audioUrl?: string; script?: string };
  activeSidebarTab?: string;
  onSidebarTabChange?: (tab: string) => void;
  onCloseTab?: (tabId: string) => void;
  openTabs?: string[];
  onAIAction?: (action: string, context: string) => void;
  overview?: string;
  keyPoints?: string[];
  takeaways?: string[];
  tags?: string[];
  learningContext?: LearningContext;
  onTimestampClick?: (seconds: number) => void;
  timestamps?: Timestamp[];
  aiExplanation?: string | null;
  onClearExplanation?: () => void;
  onMaximize?: () => void;
  isMaximized?: boolean;
}

const LearnTools = ({ 
  onToolClick, 
  sets = [], 
  hasQuiz, 
  hasFlashcards, 
  hasRoadmap, 
  hasMindMap, 
  onGenerate, 
  generatingTools = [],
  quizData,
  roadmapData,
  mindMapData,
  flashcardsData,
  podcastData,
  activeSidebarTab = "learn",
  onSidebarTabChange,
  onCloseTab,
  openTabs = ["learn", "synthesis"],
  onAIAction,
  overview,
  keyPoints,
  takeaways,
  tags,
  learningContext,
  onTimestampClick,
  timestamps,
  onMaximize,
  isMaximized,
  aiExplanation,
  onClearExplanation,
}: LearnToolsProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [askInput, setAskInput] = useState("");
  const { chatMessages, isChatLoading } = useAnalysisContext();
  const [showConversation, setShowConversation] = useState(false);

  // Filter messages for current tool
  const currentToolMessages = useMemo(() => {
    return chatMessages.filter(m => m.toolId === activeSidebarTab);
  }, [chatMessages, activeSidebarTab]);

  useEffect(() => {
    if (currentToolMessages.length > 0) {
      setShowConversation(true);
    }
  }, [currentToolMessages.length]);

  const tools = [
    { id: 'podcast', name: 'Podcast', icon: <Headphones className="h-4 w-4" />, color: 'text-indigo-600', bg: 'bg-indigo-50', available: !!podcastData },
    { id: 'video', name: 'Video', icon: <Video className="h-4 w-4" />, color: 'text-blue-600', bg: 'bg-blue-50', available: true },
    { id: 'summary', name: 'Summary', icon: <FileText className="h-4 w-4" />, color: 'text-blue-500', bg: 'bg-blue-50', available: !!overview },
    { id: 'quiz', name: 'Quiz', icon: <HelpCircle className="h-4 w-4" />, color: 'text-rose-500', bg: 'bg-rose-50', available: hasQuiz || !!quizData },
    { id: 'flashcards', name: 'Flashcards', icon: <Layers className="h-4 w-4" />, color: 'text-orange-500', bg: 'bg-orange-50', available: hasFlashcards || !!flashcardsData },
    { id: 'notes', name: 'Notes', icon: <StickyNote className="h-4 w-4" />, color: 'text-amber-500', bg: 'bg-amber-50', available: true },
    { id: 'roadmap', name: 'Lesson Plan', icon: <Rocket className="h-4 w-4" />, color: 'text-emerald-500', bg: 'bg-emerald-50', available: hasRoadmap || !!roadmapData, isNew: true },
  ];

  const handleAsk = () => {
    if (askInput.trim()) {
      let context = "";
      if (activeSidebarTab === 'summary' && (overview || keyPoints || takeaways)) {
        context = `[Summary Context]:\nOverview: ${overview || "N/A"}\nKey Points: ${keyPoints?.join(", ") || "N/A"}\nTakeaways: ${takeaways?.join(", ") || "N/A"}`;
      } else if (activeSidebarTab === 'quiz' && quizData) {
        context = `[Quiz Context]:\n${quizData.map((q, i) => `Q${i+1}: ${q.question}`).join("\n")}`;
      } else if (activeSidebarTab === 'roadmap' && roadmapData) {
        context = `[Roadmap Context]:\nTitle: ${roadmapData.title}\nSteps: ${roadmapData.steps.map(s => `${s.step}. ${s.task}`).join(", ")}`;
      } else if (activeSidebarTab === 'flashcards' && flashcardsData) {
        context = `[Flashcards Context]:\n${flashcardsData.slice(0, 5).map((f, i) => `Card ${i+1}: ${f.front}`).join("\n")}`;
      }
      
      onToolClick?.(activeSidebarTab, askInput.trim(), context);
      setAskInput("");
    }
  };

  const activeTabs = useMemo(() => {
    const allTabs = [
      { id: 'learn', name: 'Learn', icon: <LayoutGrid className="h-3 w-3" /> },
      { id: 'synthesis', name: 'Synthesis', icon: <Brain className="h-3 w-3" /> },
      { id: 'quiz', name: 'Quiz', icon: <HelpCircle className="h-3 w-3" /> },
      { id: 'flashcards', name: 'Flashcards', icon: <Layers className="h-3 w-3" /> },
      { id: 'roadmap', name: 'Roadmap', icon: <Brain className="h-3 w-3" /> },
      { id: 'mindmap', name: 'Mind Map', icon: <MapIcon className="h-3 w-3" /> },
      { id: 'notes', name: 'Notes', icon: <StickyNote className="h-3 w-3" /> },
    ];
    
    return allTabs.filter(tab => openTabs.includes(tab.id));
  }, [openTabs]);

  const renderActiveTool = () => {
    switch (activeSidebarTab) {
      case 'podcast':
        if (generatingTools.includes('podcast')) {
          return (
            <div className="p-12 text-center space-y-6 animate-pulse">
               <div className="w-20 h-20 rounded-[2.5rem] bg-indigo-50 mx-auto flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 animate-spin rounded-full" />
               </div>
               <div className="space-y-2">
                 <h3 className="text-lg font-black text-indigo-900">Creating Audio Edition</h3>
                 <p className="text-xs font-medium text-gray-400">Our AI is synthesizing your personalized podcast...</p>
               </div>
            </div>
          );
        }
        return podcastData ? (
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-4 p-6 rounded-[2.5rem] bg-indigo-50 border border-indigo-100 shadow-xl shadow-indigo-500/10">
              <div className="w-16 h-16 rounded-3xl bg-indigo-600 flex items-center justify-center shadow-lg">
                <Headphones className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-black text-indigo-900 leading-tight">AI Generated Podcast</h3>
                <p className="text-sm font-bold text-indigo-400 mt-1 uppercase tracking-widest">Mastery Audio Edition</p>
              </div>
            </div>
            
            {podcastData.audioUrl && (
              <div className="p-4 bg-white border border-gray-100 rounded-[2rem] shadow-sm">
                <audio controls className="w-full">
                  <source src={podcastData.audioUrl} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}

            {podcastData.script && (
              <div className="p-8 bg-gray-50/50 border border-gray-100 rounded-[2.5rem] space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Podcast Script</h4>
                <div className="text-sm font-medium leading-relaxed text-gray-600 italic">
                  <RichMessage content={podcastData.script} role="assistant" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Button onClick={() => onGenerate?.('podcast')} className="rounded-2xl bg-indigo-600 hover:bg-indigo-700">
              Generate Podcast
            </Button>
          </div>
        );
      case 'chapters':
      case 'summary':
        return (
          <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading summary...</div>}>
            <SynthesisTab 
              overview={overview}
              keyPoints={keyPoints}
              takeaways={takeaways}
              tags={tags}
              learningContext={learningContext}
              onGenerate={(id) => onGenerate?.(id)}
              onTimestampClick={onTimestampClick}
              timestamps={timestamps}
              isGenerating={generatingTools.length > 0}
            />
          </Suspense>
        );
      case 'transcript':
        return (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-black tracking-tight">Full Transcript</h3>
            </div>
            <div className="p-8 rounded-[2.5rem] bg-gray-50/50 border border-gray-100 text-sm font-medium leading-relaxed text-gray-500">
              The full transcript is synchronized with the video player. You can jump to any section using the timestamps in the Summary or Chapters view.
            </div>
          </div>
        );
      case 'quiz':
        if (generatingTools.includes('quiz')) {
          return (
            <div className="p-12 text-center space-y-6 animate-pulse">
               <div className="w-20 h-20 rounded-[2.5rem] bg-rose-50 mx-auto flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-rose-200 border-t-rose-600 animate-spin rounded-full" />
               </div>
               <div className="space-y-2">
                 <h3 className="text-lg font-black text-rose-900">Crafting Quiz</h3>
                 <p className="text-xs font-medium text-gray-400">Designing questions to test your knowledge...</p>
               </div>
            </div>
          );
        }
        return quizData ? (
          <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading quiz...</div>}>
            <div className="sidebar-quiz-container scale-[0.85] origin-top -mt-4">
              <QuizTab 
                quiz={quizData} 
                onAIAction={(action, context) => {
                  let prompt = context;
                  if (action === 'hint') prompt = `Give me a helpful hint for this question: "${context}". Don't give me the answer directly.`;
                  if (action === 'explain') prompt = `Explain the concept behind this question like I'm 5 years old: "${context}"`;
                  if (action === 'walkthrough') prompt = `Walk me through the logical steps to arrive at the correct answer for this question: "${context}"`;
                  onAIAction?.(action, prompt);
                  // Also trigger the 'ask' tool click to open chat if needed
                  onToolClick(activeSidebarTab, prompt, context);
                }}
              />
            </div>
          </Suspense>
        ) : null;
      case 'flashcards':
        if (generatingTools.includes('flashcards')) {
          return (
            <div className="p-12 text-center space-y-6 animate-pulse">
               <div className="w-20 h-20 rounded-[2.5rem] bg-orange-50 mx-auto flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-600 animate-spin rounded-full" />
               </div>
               <div className="space-y-2">
                 <h3 className="text-lg font-black text-orange-900">Generating Cards</h3>
                 <p className="text-xs font-medium text-gray-400">Creating flashcards for spaced repetition...</p>
               </div>
            </div>
          );
        }
        return flashcardsData ? (
          <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading flashcards...</div>}>
             <div className="scale-[0.85] origin-top -mt-4">
                <Flashcards 
                  cards={flashcardsData} 
                  onAIAction={onAIAction}
                  onGenerateMore={() => onGenerate?.('flashcards', true)}
                  isGenerating={generatingTools.includes('flashcards')}
                  aiExplanation={aiExplanation}
                  onClearExplanation={onClearExplanation}
                />
             </div>
          </Suspense>
        ) : null;
      case 'roadmap':
        if (generatingTools.includes('roadmap')) {
          return (
            <div className="p-12 text-center space-y-6 animate-pulse">
               <div className="w-20 h-20 rounded-[2.5rem] bg-emerald-50 mx-auto flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 animate-spin rounded-full" />
               </div>
               <div className="space-y-2">
                 <h3 className="text-lg font-black text-emerald-900">Mapping Knowledge</h3>
                 <p className="text-xs font-medium text-gray-400">Structuring your personalized learning path...</p>
               </div>
            </div>
          );
        }
        return roadmapData ? (
          <div className="relative pl-6 pr-2 py-8 space-y-12">
             <div className="absolute left-10 top-12 bottom-12 w-px border-l-2 border-dashed border-gray-100 z-0" />
             
             <div className="flex items-center gap-4 mb-4 relative z-10 bg-white pb-4">
                <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center shadow-xl shadow-black/10">
                   <Rocket className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">{roadmapData.title || "Mastery Path"}</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{roadmapData.steps.length} Milestones</p>
                </div>
             </div>

             {roadmapData.steps.map((step, i) => (
                <div key={i} className="relative z-10 flex items-start gap-6 group">
                   <div className={cn(
                     "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-black text-[10px] shadow-md transition-all group-hover:scale-110 border-2",
                     i === 0 ? "bg-black border-black text-white" : "bg-white border-gray-100 text-gray-400 group-hover:border-black group-hover:text-black"
                   )}>
                     {step.step}
                   </div>
                   <div className="flex-1 space-y-2 pt-0.5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Stage {step.step}</p>
                      <h4 className="text-sm font-bold text-gray-900 leading-tight group-hover:text-black transition-colors">{step.task}</h4>
                      <div className="p-5 rounded-[2rem] bg-gray-50/50 border border-gray-50 text-[11px] font-medium text-gray-500 leading-relaxed group-hover:bg-white group-hover:border-gray-100 group-hover:shadow-lg group-hover:shadow-black/5 transition-all">
                         {step.description}
                      </div>
                   </div>
                </div>
             ))}
          </div>
        ) : null;
      case 'mindmap':
        return mindMapData ? (
          <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading mind map...</div>}>
            <div className="h-[500px] border border-gray-100 bg-gray-50/30 rounded-3xl overflow-hidden mt-4">
              <MindMapTab mindMap={mindMapData} />
            </div>
          </Suspense>
        ) : null;
      case 'notes':
        return (
          <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading notes...</div>}>
            <div className="mt-4">
              <NotesTool />
            </div>
          </Suspense>
        );
      default:
        return null;
    }
  };

  return (
    <aside className={cn(
      "bg-white flex flex-col overflow-hidden relative h-full max-h-full",
      "w-full border-gray-100 transition-all duration-500",
      !isMaximized && "border-l"
    )}>
      {/* Tabbed Header - Stays at top */}
      <div className="px-6 py-4 border-b border-gray-50 bg-white/50 backdrop-blur-md z-20 overflow-x-auto scrollbar-none shrink-0">
        <div className="flex items-center gap-2">
           {activeTabs.map((tab) => (
             <button
               key={tab.id}
               onClick={() => onSidebarTabChange?.(tab.id)}
               className={cn(
                 "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border",
                 activeSidebarTab === tab.id 
                   ? "bg-black text-white border-black shadow-md" 
                   : "bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100"
               )}
             >
               {tab.icon}
               {tab.name}
               {tab.id !== 'learn' && (
                 <X 
                   className="h-3 w-3 ml-2 hover:text-red-400 transition-colors" 
                   onClick={(e) => {
                     e.stopPropagation();
                     onCloseTab?.(tab.id);
                   }} 
                 />
               )}
             </button>
           ))}
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-xl bg-gray-50/50">
               <Plus className="h-4 w-4 text-gray-400" />
            </Button>
            <button 
              onClick={onMaximize}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors group ml-1"
              title={isMaximized ? "Minimize Sidebar" : "Maximize Sidebar"}
            >
              <Maximize2 className={cn("h-4 w-4 text-gray-400 group-hover:text-black transition-transform", isMaximized && "rotate-180")} />
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative flex flex-col">
        <AnimatePresence mode="wait">
          {showConversation && currentToolMessages.length > 0 ? (
            <motion.div 
              key="conversation"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute inset-0 z-20 bg-white flex flex-col overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-md z-30 shrink-0">
                 <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setShowConversation(false)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                    >
                      <ChevronLeftCircle className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-2">
                       <Sparkles className="h-3.5 w-3.5 text-black" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-black">
                          {activeSidebarTab} Discussion
                       </span>
                    </div>
                 </div>
                 <button 
                   onClick={() => setShowConversation(false)}
                   className="text-[10px] font-bold text-gray-400 hover:text-black transition-colors underline underline-offset-4"
                 >
                   Back to Tool
                 </button>
              </div>

              <ScrollArea className="flex-1 px-6 py-6">
                <div className="space-y-8 pb-10">
                  {currentToolMessages.map((msg, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "flex flex-col gap-3",
                        msg.role === 'user' ? "items-end" : "items-start"
                      )}
                    >
                      <div className="flex items-center gap-2 px-1">
                        {msg.role === 'assistant' ? (
                          <>
                            <div className="w-5 h-5 rounded-lg bg-black flex items-center justify-center">
                               <Sparkles className="h-2.5 w-2.5 text-white" />
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Genius AI</span>
                          </>
                        ) : (
                          <>
                            <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">You</span>
                            <div className="w-5 h-5 rounded-lg bg-gray-100 flex items-center justify-center">
                               <UserIcon className="h-2.5 w-2.5 text-gray-400" />
                            </div>
                          </>
                        )}
                      </div>
                      <div className={cn(
                        "max-w-[90%] p-4 rounded-2xl text-sm font-medium leading-relaxed shadow-sm",
                        msg.role === 'user' 
                          ? "bg-black text-white rounded-tr-none" 
                          : "bg-gray-50 text-gray-700 rounded-tl-none border border-gray-100"
                      )}>
                        {msg.role === 'assistant' ? (
                          <RichMessage content={msg.content} role={msg.role} />
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex flex-col items-start gap-3 animate-pulse">
                      <div className="flex items-center gap-2 px-1">
                        <div className="w-5 h-5 rounded-lg bg-black/10 flex items-center justify-center" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Genius is thinking...</span>
                      </div>
                      <div className="w-[70%] h-20 bg-gray-50 rounded-2xl rounded-tl-none border border-gray-100" />
                    </div>
                  )}
                </div>
              </ScrollArea>
            </motion.div>
          ) : (
            <motion.div 
              key="tool-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-hidden"
            >
              <ScrollArea className="h-full">
                <div className="p-8 space-y-8">
                {activeSidebarTab === 'learn' ? (
                  <>
                    {/* Available Tools Grid */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-gray-500 px-1 opacity-70 mt-2">Generate</h3>
                      <div className="grid grid-cols-2 gap-3 pb-8 border-b border-gray-50">
                        {tools.map((tool) => (
                          <button
                            key={tool.id}
                            onClick={() => {
                              if (tool.id === 'video') return;
                              onToolClick?.(tool.id);
                            }}
                            className={cn(
                              "flex items-center justify-between p-3.5 rounded-2xl border transition-all hover:scale-[1.01] active:scale-[0.99] group",
                              "bg-white border-gray-100 hover:border-gray-200 hover:shadow-md hover:shadow-black/[0.02]"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                                tool.bg, tool.color
                              )}>
                                {tool.icon}
                              </div>
                              <div className="text-left flex items-center gap-2">
                                <p className="text-[13px] font-bold text-gray-900">{tool.name}</p>
                                {tool.isNew && (
                                  <span className="bg-emerald-50 text-[9px] font-black text-emerald-500 px-1.5 py-0.5 rounded-full border border-emerald-100 uppercase tracking-tighter">New</span>
                                )}
                              </div>
                            </div>
                            <Sliders className="h-3.5 w-3.5 text-gray-300 opacity-20 group-hover:opacity-40 transition-opacity" />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Generated Items Section - My Sets */}
                    <div className="space-y-4 pt-4 pb-12">
                      <div className="flex items-center justify-between px-1">
                        <h3 className="text-xs font-bold text-gray-500 opacity-70">My Sets</h3>
                        <div className="flex items-center gap-3">
                           <div className="flex items-center gap-1 opacity-40">
                              <Sliders className="h-3.5 w-3.5" />
                              <span className="text-[10px] font-black">1</span>
                           </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {sets.length > 0 ? sets.map((set) => (
                          <button 
                            key={set.id} 
                            disabled={set.isGenerating}
                            onClick={() => onToolClick?.(set.type)}
                            className={cn(
                              "w-full flex items-center gap-4 p-4 rounded-3xl bg-white border border-gray-50 transition-all group",
                              set.isGenerating ? "opacity-60 cursor-not-allowed" : "hover:border-gray-100 hover:shadow-md hover:shadow-black/[0.02]"
                            )}
                          >
                            <div className={cn(
                              "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                              set.isGenerating ? "bg-gray-50 text-gray-400" : (
                                set.type === 'quiz' ? "bg-red-50 text-red-500" : 
                                set.type === 'roadmap' ? "bg-emerald-50 text-emerald-500" :
                                set.type === 'flashcards' ? "bg-amber-50 text-amber-500" :
                                set.type === 'summary' ? "bg-blue-50 text-blue-500" :
                                "bg-indigo-50 text-indigo-500"
                              )
                            )}>
                               {set.isGenerating ? <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 animate-spin rounded-full" /> : (
                                 set.type === 'quiz' ? <HelpCircle className="h-5 w-5" /> : 
                                  set.type === 'roadmap' ? <Target className="h-5 w-5" /> :
                                  set.type === 'flashcards' ? <Layers className="h-5 w-5" /> :
                                  set.type === 'summary' ? <FileText className="h-5 w-5" /> :
                                  <Headphones className="h-5 w-5" />
                               )}
                            </div>
                            <div className="flex-1 text-left">
                              <p className="text-[13px] font-black text-gray-800 line-clamp-1">{set.name}</p>
                              <p className="text-[10px] font-bold text-gray-400 mt-0.5 opacity-80 uppercase tracking-tighter">
                                  {set.isGenerating ? 'Content is being generated...' : (
                                    set.type === 'quiz' ? '10 questions left • All topics' : 
                                     set.type === 'summary' ? 'Detailed Summary • All topics' :
                                     set.type === 'roadmap' ? 'Personalized Learning Path' :
                                     'Processed Analysis'
                                  )}
                              </p>
                            </div>
                            {!set.isGenerating && <MoreVertical className="h-4 w-4 text-gray-300 opacity-40" />}
                          </button>
                        )) : (
                          <div className="p-10 text-center space-y-3 grayscale opacity-30">
                             <div className="w-16 h-16 rounded-[2.5rem] bg-gray-50 border border-gray-200 mx-auto flex items-center justify-center">
                                <LayoutGrid className="h-8 w-8 text-gray-300" />
                             </div>
                             <p className="text-xs font-bold text-gray-400">Generate your first set to see it here.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="pb-12">
                    {renderActiveTool()}
                  </div>
                )}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

      {/* Large Bottom Input Section - Fixed at bottom */}
      <div className="p-6 pt-2 bg-white border-t border-gray-50 shrink-0">
         <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-2">
               <span className="text-[10px] font-bold text-gray-400 tracking-tight">Chatting in:</span>
               <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
                  <div className="w-1.5 h-1.5 rounded-full bg-black/40" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-black/60">New Chat</span>
               </div>
            </div>
            <div className="flex items-center gap-4 opacity-30 hover:opacity-100 transition-opacity">
               <Plus className="h-4 w-4 cursor-pointer" />
               <History className="h-4 w-4 cursor-pointer" />
            </div>
         </div>

         <div className="relative group">
            <textarea 
               value={askInput}
               onChange={(e) => setAskInput(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAsk())}
               placeholder="Ask anything"
               className="w-full h-14 bg-gray-50/50 border border-gray-100 rounded-3xl pl-6 pr-24 py-4 text-sm font-bold placeholder:text-gray-300 focus:outline-none focus:bg-white focus:border-gray-200 focus:ring-8 focus:ring-black/[0.02] transition-all scrollbar-none resize-none"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
               <button 
                  onClick={handleAsk}
                  className="bg-black text-white flex items-center gap-2 pl-4 pr-3 py-2 rounded-2xl shadow-xl shadow-black/10 hover:scale-[1.02] transition-all active:scale-[0.98]"
               >
                  <Mic className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-black uppercase tracking-widest -mb-0.5">Voice</span>
               </button>
            </div>
         </div>
      </div>
    </aside>
  );
};

export default LearnTools;
