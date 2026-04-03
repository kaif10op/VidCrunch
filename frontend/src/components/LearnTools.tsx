import { 
  Copy, Check, BookOpen, Lightbulb, 
  Clock, Map as MapIcon, FileText, 
  Brain, Target, MessageSquare,
  Rocket, Star, HelpCircle, Layers, LayoutGrid,
  ChevronDown, Plus, FolderPlus, Search, 
  ChevronUp, Settings2, Share2, MoreVertical, Maximize2, Sliders,
  ChevronRight, StickyNote, MoreHorizontal, Mic, History,
  User as UserIcon, Sparkles, X, ChevronLeftCircle,
  Headphones, Video, Link, BookMarked, Languages, Library, List, ExternalLink
} from "lucide-react";
import { useRef, useEffect, useState, useMemo, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RichMessage } from "./RichMessage";
import { useAnalysisContext } from "@/contexts/AnalysisContext";
import { AnimatePresence, motion } from "framer-motion";
import { TOOL_IDS, UTILITY_TOOLS } from "@/lib/toolConstants";

const QuizTab = lazy(() => import("./QuizTab"));
const MindMapTab = lazy(() => import("./MindMapTab"));
const Flashcards = lazy(() => import("./Flashcards"));
const NotesTool = lazy(() => import("./NotesTool"));
const SynthesisTab = lazy(() => import("./SynthesisTab"));
const RoadmapTab = lazy(() => import("./RoadmapTab"));

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
  quizAIExplanation?: string | null;
  roadmapAIExplanation?: string | null;
  onClearExplanation?: () => void;
  onMaximize?: () => void;
  isMaximized?: boolean;
  isMobile?: boolean;
}

const LoadingState = () => (
  <div className="p-12 text-center space-y-6">
    <div className="w-20 h-20 rounded-[2.5rem] bg-secondary mx-auto flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-muted border-t-primary animate-spin rounded-full" />
    </div>
    <p className="text-xs font-bold text-muted-foreground capitalize">Loading analysis tool...</p>
  </div>
);

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
  openTabs = ["learn"],
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
  quizAIExplanation,
  roadmapAIExplanation,
  onClearExplanation,
}: LearnToolsProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [askInput, setAskInput] = useState("");
  const { chatMessages, isChatLoading, summaryData, generatingTools: contextGeneratingTools } = useAnalysisContext();
  const [showConversation, setShowConversation] = useState(false);
  
  // Use context generating tools as fallback if props not provided
  const activeGeneratingTools = generatingTools || contextGeneratingTools || [];

  // Filter messages for current tool
  const currentToolMessages = useMemo(() => {
    return chatMessages.filter(m => m.toolId === activeSidebarTab);
  }, [chatMessages, activeSidebarTab]);

  // Removed auto-chat transition to keep users in the "Page" view

  const tools = [
    { id: TOOL_IDS.PODCAST, name: 'Podcast', icon: <Headphones className="h-4 w-4" />, color: 'text-indigo-500', bg: 'bg-indigo-500/10', available: !!podcastData },
    { id: TOOL_IDS.VIDEO, name: 'Video', icon: <Video className="h-4 w-4" />, color: 'text-blue-500', bg: 'bg-blue-500/10', available: true },
    { id: TOOL_IDS.SUMMARY, name: 'Summary', icon: <FileText className="h-4 w-4" />, color: 'text-sky-500', bg: 'bg-sky-500/10', available: !!overview },
    { id: TOOL_IDS.QUIZ, name: 'Quiz', icon: <HelpCircle className="h-4 w-4" />, color: 'text-rose-500', bg: 'bg-rose-500/10', available: hasQuiz || !!quizData },
    { id: TOOL_IDS.FLASHCARDS, name: 'Flashcards', icon: <Layers className="h-4 w-4" />, color: 'text-orange-500', bg: 'bg-orange-500/10', available: hasFlashcards || !!flashcardsData },
    { id: TOOL_IDS.NOTES, name: 'Notes', icon: <StickyNote className="h-4 w-4" />, color: 'text-amber-500', bg: 'bg-amber-500/10', available: true },
    { id: TOOL_IDS.ROADMAP, name: 'Lesson Plan', icon: <Rocket className="h-4 w-4" />, color: 'text-emerald-500', bg: 'bg-emerald-500/10', available: hasRoadmap || !!roadmapData, isNew: true },
    { id: TOOL_IDS.MIND_MAP, name: 'Mind Map', icon: <MapIcon className="h-4 w-4" />, color: 'text-emerald-600', bg: 'bg-emerald-600/10', available: hasMindMap || !!mindMapData },
    { id: TOOL_IDS.GLOSSARY, name: 'Glossary', icon: <Library className="h-4 w-4" />, color: 'text-purple-500', bg: 'bg-purple-500/10', available: true },
    { id: TOOL_IDS.RESOURCES, name: 'Resources', icon: <BookMarked className="h-4 w-4" />, color: 'text-cyan-500', bg: 'bg-cyan-500/10', available: true },
  ];

  const handleAsk = () => {
    if (askInput.trim()) {
      let context = "";
      if (activeSidebarTab === TOOL_IDS.SUMMARY && (overview || keyPoints || takeaways)) {
        context = `[Summary Context]:\nOverview: ${overview || "N/A"}\nKey Points: ${keyPoints?.join(", ") || "N/A"}\nTakeaways: ${takeaways?.join(", ") || "N/A"}`;
      } else if (activeSidebarTab === TOOL_IDS.QUIZ && quizData) {
        context = `[Quiz Context]:\n${quizData.map((q, i) => `Q${i+1}: ${q.question}`).join("\n")}`;
      } else if (activeSidebarTab === TOOL_IDS.ROADMAP && roadmapData) {
        context = `[Roadmap Context]:\nTitle: ${roadmapData.title}\nSteps: ${roadmapData.steps.map(s => `${s.step}. ${s.task}`).join(", ")}`;
      } else if (activeSidebarTab === TOOL_IDS.FLASHCARDS && flashcardsData) {
        context = `[Flashcards Context]:\n${flashcardsData.slice(0, 5).map((f, i) => `Card ${i+1}: ${f.front}`).join("\n")}`;
      }

      onToolClick?.(activeSidebarTab, askInput.trim(), context);
      setAskInput("");
    }
  };

  const activeTabs = useMemo(() => {
    const allTabs = [
      { id: 'learn', name: 'Learn', icon: <LayoutGrid className="h-3 w-3" /> },
      { id: TOOL_IDS.SYNTHESIS, name: 'Synthesis', icon: <Brain className="h-3 w-3" /> },
      { id: TOOL_IDS.SUMMARY, name: 'Summary', icon: <FileText className="h-3 w-3" /> },
      { id: TOOL_IDS.CHAPTERS, name: 'Chapters', icon: <List className="h-3 w-3" /> },
      { id: TOOL_IDS.TRANSCRIPT, name: 'Transcript', icon: <FileText className="h-3 w-3" /> },
      { id: TOOL_IDS.QUIZ, name: 'Quiz', icon: <HelpCircle className="h-3 w-3" /> },
      { id: TOOL_IDS.FLASHCARDS, name: 'Flashcards', icon: <Layers className="h-3 w-3" /> },
      { id: TOOL_IDS.ROADMAP, name: 'Roadmap', icon: <Brain className="h-3 w-3" /> },
      { id: TOOL_IDS.MIND_MAP, name: 'Mind Map', icon: <MapIcon className="h-3 w-3" /> },
      { id: TOOL_IDS.NOTES, name: 'Notes', icon: <StickyNote className="h-3 w-3" /> },
      { id: TOOL_IDS.VIDEO, name: 'Video', icon: <Video className="h-3 w-3" /> },
      { id: TOOL_IDS.GLOSSARY, name: 'Glossary', icon: <Library className="h-3 w-3" /> },
      { id: TOOL_IDS.RESOURCES, name: 'Resources', icon: <BookMarked className="h-3 w-3" /> },
      { id: TOOL_IDS.PODCAST, name: 'Podcast', icon: <Headphones className="h-3 w-3" /> },
    ];

    return allTabs.filter(tab => openTabs.includes(tab.id));
  }, [openTabs]);

  const renderActiveTool = () => {
    switch (activeSidebarTab) {
      case TOOL_IDS.PODCAST:
        if (generatingTools.includes(TOOL_IDS.PODCAST)) {
          return (
            <div className="p-12 text-center space-y-8 animate-in fade-in duration-700">
               <div className="w-24 h-24 rounded-[2.5rem] bg-indigo-500/10 mx-auto flex items-center justify-center relative">
                  <div className="absolute inset-0 rounded-[2.5rem] border-2 border-dashed border-indigo-500/20 animate-[spin_10s_linear_infinite]" />
                  <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 animate-spin rounded-full shadow-[0_0_15px_rgba(99,102,241,0.3)]" />
               </div>
               <div className="space-y-3">
                 <h3 className="text-xl font-black text-foreground tracking-tight">Crafting Audio Edition</h3>
                 <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest leading-relaxed">Synthesizing personalized podcast insights...</p>
               </div>
            </div>
          );
        }
        return podcastData ? (
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-4 p-6 rounded-[2.5rem] bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 shadow-xl shadow-indigo-500/10">
              <div className="w-16 h-16 rounded-3xl bg-indigo-600 flex items-center justify-center shadow-lg">
                <Headphones className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-black text-indigo-900 dark:text-indigo-100 leading-tight">AI Generated Podcast</h3>
                <p className="text-sm font-bold text-indigo-400 dark:text-indigo-300 mt-1 uppercase tracking-widest">Mastery Audio Edition</p>
              </div>
            </div>
            
            {podcastData.audioUrl && (
              <div className="p-4 bg-card border border-border rounded-[2rem] shadow-sm">
                <audio controls className="w-full">
                  <source src={podcastData.audioUrl} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}

            {podcastData.script && (
              <div className="p-8 bg-secondary/30 border border-border rounded-[2.5rem] space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Podcast Script</h4>
                <div className="text-sm font-medium leading-relaxed text-foreground italic">
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
      case TOOL_IDS.SUMMARY:
      case TOOL_IDS.CHAPTERS:
      case TOOL_IDS.SYNTHESIS:
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
              aiExplanation={aiExplanation}
              onClearExplanation={onClearExplanation}
              onAIAction={onAIAction}
            />
          </Suspense>
        );
      case TOOL_IDS.VIDEO:
        return (
          <div className="p-6">
            <div className="flex items-center gap-4 p-6 rounded-[2.5rem] bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 shadow-xl shadow-blue-500/10 mb-8">
              <div className="w-16 h-16 rounded-3xl bg-blue-600 flex items-center justify-center shadow-lg">
                <Video className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-black text-blue-900 dark:text-blue-100 leading-tight">Mastery Video</h3>
                <p className="text-sm font-bold text-blue-400 dark:text-blue-300 mt-1 uppercase tracking-widest">Active Player Context</p>
              </div>
            </div>
            <div className="p-8 bg-secondary/30 border border-border rounded-[2.5rem] space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Player Navigation</h4>
                <p className="text-sm font-medium leading-relaxed text-foreground">
                    The video is playing in the main viewport on the left. Use the **Chapters** and **Transcript** tabs to navigate to specific insights. You can also ask follow-up questions about specific moments here.
                </p>
                <div className="grid grid-cols-2 gap-3 mt-4">
                    <Button variant="outline" className="rounded-2xl border-border font-bold text-[10px] h-10 uppercase tracking-widest" onClick={() => onSidebarTabChange?.('chapters')}>
                        Open Chapters
                    </Button>
                    <Button variant="outline" className="rounded-2xl border-border font-bold text-[10px] h-10 uppercase tracking-widest" onClick={() => onSidebarTabChange?.('transcripts')}>
                        View Transcript
                    </Button>
                </div>
            </div>
          </div>
        );
      case TOOL_IDS.GLOSSARY:
        if (activeGeneratingTools.includes(TOOL_IDS.GLOSSARY)) {
          return (
            <div className="p-12 text-center space-y-6 animate-pulse">
               <div className="w-20 h-20 rounded-[2.5rem] bg-purple-50 dark:bg-purple-900/20 mx-auto flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-purple-200 dark:border-purple-800 border-t-purple-600 animate-spin rounded-full" />
               </div>
               <div className="space-y-2">
                 <h3 className="text-lg font-black text-purple-900 dark:text-purple-100">Term Analysis</h3>
                 <p className="text-xs font-medium text-muted-foreground">Extracting video-specific jargon...</p>
               </div>
            </div>
          );
        }
        return (
          <div className="p-6">
             <div className="flex items-center gap-4 p-6 rounded-[2.5rem] bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 shadow-xl shadow-purple-500/10 mb-8">
              <div className="w-16 h-16 rounded-3xl bg-purple-600 flex items-center justify-center shadow-lg">
                <Library className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-black text-purple-900 dark:text-purple-100 leading-tight">Video Glossary</h3>
                <p className="text-sm font-bold text-purple-400 dark:text-purple-300 mt-1 uppercase tracking-widest">Terminology Mastery</p>
              </div>
            </div>

            {summaryData?.glossary?.length ? (
                <div className="space-y-4">
                    {summaryData.glossary.map((item: any, i: number) => (
                        <motion.div 
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="p-6 rounded-[2rem] bg-card border border-border shadow-sm hover:shadow-md transition-all group"
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                    <BookOpen className="h-4 w-4" />
                                </div>
                                <h4 className="text-sm font-black text-foreground tracking-tight">{item.term}</h4>
                            </div>
                            <p className="text-xs text-muted-foreground font-medium leading-relaxed pl-11">
                                {item.definition}
                            </p>
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="p-8 bg-secondary/30 border border-dashed border-border rounded-[2.5rem] text-center space-y-4">
                    <p className="text-xs font-bold text-muted-foreground">No terms analyzed yet.</p>
                </div>
            )}
          </div>
        );
      case TOOL_IDS.RESOURCES:
        if (activeGeneratingTools.includes(TOOL_IDS.RESOURCES)) {
          return (
            <div className="p-12 text-center space-y-6 animate-pulse">
               <div className="w-20 h-20 rounded-[2.5rem] bg-cyan-50 dark:bg-cyan-900/20 mx-auto flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-cyan-200 dark:border-cyan-800 border-t-cyan-600 animate-spin rounded-full" />
               </div>
               <div className="space-y-2">
                 <h3 className="text-lg font-black text-cyan-900 dark:text-cyan-100">Finding Mentions</h3>
                 <p className="text-xs font-medium text-muted-foreground">Scanning for tools, books and links...</p>
               </div>
            </div>
          );
        }
        return (
          <div className="p-6">
             <div className="flex items-center gap-4 p-6 rounded-[2.5rem] bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-100 dark:border-cyan-800 shadow-xl shadow-cyan-500/10 mb-8">
              <div className="w-16 h-16 rounded-3xl bg-cyan-600 flex items-center justify-center shadow-lg">
                <ExternalLink className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-black text-cyan-900 dark:text-cyan-100 leading-tight">Resource Hub</h3>
                <p className="text-sm font-bold text-cyan-400 dark:text-cyan-300 mt-1 uppercase tracking-widest">External References</p>
              </div>
            </div>

            {summaryData?.resources?.length ? (
                <div className="space-y-4">
                    {summaryData.resources.map((res: any, i: number) => (
                        <motion.div 
                            key={i}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.05 }}
                            className="p-6 rounded-[2rem] bg-card border border-border shadow-sm hover:shadow-md transition-all relative overflow-hidden group"
                        >
                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-black text-foreground tracking-tight">{res.name}</h4>
                                    <p className="text-[10px] text-muted-foreground font-bold leading-relaxed pr-4">
                                        {res.description}
                                    </p>
                                </div>
                                {res.url && (
                                    <a 
                                        href={res.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="p-3 rounded-2xl bg-cyan-50 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-600 hover:text-white transition-all ring-4 ring-cyan-50/50 dark:ring-cyan-900/20"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </a>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="p-8 bg-secondary/30 border border-dashed border-border rounded-[2.5rem] text-center space-y-4">
                    <p className="text-xs font-bold text-muted-foreground">No resources found yet.</p>
                </div>
            )}
          </div>
        );
      case TOOL_IDS.TRANSCRIPT:
        return (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-secondary text-primary flex items-center justify-center">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-black tracking-tight text-foreground">Full Transcript</h3>
            </div>
            <div className="p-8 rounded-[2.5rem] bg-secondary/30 border border-border text-sm font-medium leading-relaxed text-muted-foreground">
              The full transcript is synchronized with the video player. You can jump to any section using the timestamps in the Summary or Chapters view.
            </div>
          </div>
        );
      case TOOL_IDS.QUIZ:
        if (generatingTools.includes(TOOL_IDS.QUIZ)) {
          return (
            <div className="p-12 text-center space-y-6 animate-pulse">
               <div className="w-20 h-20 rounded-[2.5rem] bg-rose-50 mx-auto flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-rose-200 border-t-rose-600 animate-spin rounded-full" />
               </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-black text-foreground">Crafting Quiz</h3>
                  <p className="text-xs font-medium text-muted-foreground">Designing questions to test your knowledge...</p>
                </div>
            </div>
          );
        }
        return quizData ? (
          <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading quiz...</div>}>
            <div className="sidebar-quiz-container scale-[0.85] origin-top -mt-4">
              <QuizTab 
                quiz={quizData} 
                onAIAction={onAIAction}
                onGenerateMore={() => onGenerate?.('quiz', true)}
                isGenerating={generatingTools.includes('quiz')}
                quizAIExplanation={quizAIExplanation}
                onClearExplanation={onClearExplanation}
              />
            </div>
          </Suspense>
        ) : null;
      case TOOL_IDS.FLASHCARDS:
        if (generatingTools.includes(TOOL_IDS.FLASHCARDS)) {
          return (
            <div className="p-12 text-center space-y-6 animate-pulse">
               <div className="w-20 h-20 rounded-[2.5rem] bg-orange-50 mx-auto flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-600 animate-spin rounded-full" />
               </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-black text-foreground">Generating Cards</h3>
                  <p className="text-xs font-medium text-muted-foreground">Creating flashcards for spaced repetition...</p>
                </div>
            </div>
          );
        }
        return flashcardsData ? (
          <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading flashcards...</div>}>
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
      case TOOL_IDS.ROADMAP:
        if (generatingTools.includes(TOOL_IDS.ROADMAP)) {
          return (
            <div className="p-12 text-center space-y-6 animate-pulse">
               <div className="w-20 h-20 rounded-[2.5rem] bg-emerald-50 mx-auto flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 animate-spin rounded-full" />
               </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-black text-foreground">Mapping Knowledge</h3>
                  <p className="text-xs font-medium text-muted-foreground">Structuring your personalized learning path...</p>
                </div>
            </div>
          );
        }
        return roadmapData ? (
          <Suspense fallback={<LoadingState />}>
            <RoadmapTab 
              roadmap={roadmapData} 
              onAIAction={onAIAction}
              onGenerateMore={() => onGenerate?.('roadmap', true)}
              isGenerating={generatingTools.includes('roadmap')}
              roadmapAIExplanation={roadmapAIExplanation}
              onClearExplanation={onClearExplanation}
            />
          </Suspense>
        ) : null;
      case TOOL_IDS.MIND_MAP:
        return mindMapData ? (
          <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading mind map...</div>}>
            <div className="h-[500px] border border-border bg-secondary/20 rounded-3xl overflow-hidden mt-4">
              <MindMapTab mindMap={mindMapData} />
            </div>
          </Suspense>
        ) : null;
      case TOOL_IDS.NOTES:
        if (generatingTools.includes(TOOL_IDS.NOTES)) {
          return (
            <div className="p-12 text-center space-y-6 animate-pulse">
               <div className="w-20 h-20 rounded-[2.5rem] bg-amber-50 mx-auto flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 animate-spin rounded-full" />
               </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-black text-foreground">Note Crafting</h3>
                  <p className="text-xs font-medium text-muted-foreground">Synthesizing study materials...</p>
                </div>
            </div>
          );
        }
        return (
          <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading notes...</div>}>
            <div className="mt-4 space-y-6">
              <NotesTool />
              <div className="p-8 bg-secondary/50 rounded-[2.5rem] border border-border text-center space-y-4">
                 <div className="w-12 h-12 rounded-2xl bg-primary/10 mx-auto flex items-center justify-center text-primary">
                    <Sparkles className="h-6 w-6" />
                 </div>
                 <div className="space-y-1">
                    <h4 className="text-sm font-black text-foreground">AI Study Assistant</h4>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Enhance your drafts</p>
                 </div>
                 <Button 
                    onClick={() => onToolClick?.('notes', 'Create comprehensive study notes from this video content.', '[Action]: Generate AI Notes')}
                    className="w-full rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 font-black uppercase tracking-widest text-[10px] h-12"
                 >
                    Inject AI Insights
                 </Button>
              </div>

              {/* AI Breakdown for Notes */}
              <AnimatePresence>
                {currentToolMessages.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-gray-900 rounded-[2.5rem] p-8 border border-white/10 shadow-2xl"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-amber-400" />
                                <span className="text-[10px] font-black text-amber-100 uppercase tracking-widest">AI Insights</span>
                            </div>
                            <button 
                                onClick={() => setShowConversation(true)}
                                className="text-[10px] font-bold text-amber-400 hover:text-white underline underline-offset-4"
                            >
                                Discuss in Chat
                            </button>
                        </div>
                        <div className="prose prose-invert prose-sm max-w-none">
                            <RichMessage 
                                content={currentToolMessages[currentToolMessages.length - 1].content} 
                                role="assistant" 
                                className="text-gray-300"
                            />
                        </div>
                    </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Suspense>
        );
      default:
        return null;
    }
  };

  return (
    <aside className={cn(
      "bg-background flex flex-col overflow-hidden relative h-full max-h-full",
      "w-full border-border transition-all duration-500",
      !isMaximized && "border-l"
    )}>
      {/* Tabbed Header - Stays at top */}
      <div className="px-6 py-4 border-b border-border bg-background/50 backdrop-blur-md z-20 overflow-x-auto scrollbar-none shrink-0">
        <div className="flex items-center gap-2">
           {activeTabs.map((tab) => (
             <button
               key={tab.id}
               onClick={() => onSidebarTabChange?.(tab.id)}
               className={cn(
                 "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border",
                 activeSidebarTab === tab.id 
                   ? "bg-primary text-primary-foreground border-primary shadow-md" 
                   : "bg-secondary text-muted-foreground border-transparent hover:bg-accent"
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
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-xl bg-secondary/50">
               <Plus className="h-4 w-4 text-muted-foreground" />
            </Button>
            <button 
              onClick={() => setShowConversation(!showConversation)}
              className={cn(
                "p-2 rounded-lg transition-colors group ml-1 relative",
                showConversation ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"
              )}
              title="Toggle Discussion Chat"
            >
              <MessageSquare className="h-4 w-4" />
              {currentToolMessages.length > 0 && !showConversation && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-indigo-500 rounded-full border-2 border-white animate-pulse" />
              )}
            </button>
            <button 
              onClick={onMaximize}
              className="p-2 hover:bg-secondary rounded-lg transition-colors group ml-1"
              title={isMaximized ? "Minimize Sidebar" : "Maximize Sidebar"}
            >
              <Maximize2 className={cn("h-4 w-4 text-muted-foreground group-hover:text-foreground transition-transform", isMaximized && "rotate-180")} />
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
              className="absolute inset-0 z-20 bg-background flex flex-col overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-background/80 backdrop-blur-md z-30 shrink-0">
                  <div className="flex items-center gap-3">
                     <button 
                       onClick={() => setShowConversation(false)}
                       className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
                     >
                       <ChevronLeftCircle className="h-4 w-4" />
                     </button>
                     <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-foreground" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-foreground">
                           {activeSidebarTab} Discussion
                        </span>
                     </div>
                  </div>
                  <button 
                    onClick={() => setShowConversation(false)}
                    className="text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
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
                            <div className="w-5 h-5 rounded-lg bg-primary flex items-center justify-center">
                               <Sparkles className="h-2.5 w-2.5 text-primary-foreground" />
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Genius AI</span>
                          </>
                        ) : (
                          <>
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">You</span>
                            <div className="w-5 h-5 rounded-lg bg-secondary flex items-center justify-center">
                               <UserIcon className="h-2.5 w-2.5 text-muted-foreground" />
                            </div>
                          </>
                        )}
                      </div>
                      <div className={cn(
                        "max-w-[90%] p-4 rounded-2xl text-sm font-medium leading-relaxed shadow-sm",
                        msg.role === 'user' 
                          ? "bg-primary text-primary-foreground rounded-tr-none" 
                          : "bg-secondary text-secondary-foreground rounded-tl-none border border-border"
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
                        <div className="w-5 h-5 rounded-lg bg-secondary flex items-center justify-center">
                           <Sparkles className="h-2.5 w-2.5 text-muted-foreground" />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Genius is thinking...</span>
                      </div>
                      <div className="w-[70%] h-20 bg-secondary rounded-2xl rounded-tl-none border border-border" />
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
                      <h3 className="text-xs font-bold text-muted-foreground px-1 opacity-70 mt-2 uppercase tracking-widest">Generate</h3>
                      <div className="grid grid-cols-2 gap-3 pb-8 border-b border-border">
                        {tools.map((tool) => (
                          <button
                            key={tool.id}
                            onClick={() => {
                              onToolClick?.(tool.id);
                            }}
                            className={cn(
                              "flex items-center justify-between p-3.5 rounded-2xl border transition-all hover:scale-[1.01] active:scale-[0.99] group",
                              "bg-card border-border hover:border-primary hover:shadow-md hover:shadow-foreground/[0.02]"
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
                                <p className="text-[13px] font-bold text-foreground">{tool.name}</p>
                                {tool.isNew && (
                                  <span className="bg-emerald-50 dark:bg-emerald-900/40 text-[9px] font-black text-emerald-500 dark:text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800 uppercase tracking-tighter">New</span>
                                )}
                              </div>
                            </div>
                            <Sliders className="h-3.5 w-3.5 text-muted-foreground opacity-20 group-hover:opacity-40 transition-opacity" />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Generated Items Section - My Sets */}
                    <div className="space-y-4 pt-4 pb-12">
                      <div className="flex items-center justify-between px-1">
                        <h3 className="text-xs font-bold text-muted-foreground opacity-70 uppercase tracking-widest">My Sets</h3>
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
                                set.type === TOOL_IDS.QUIZ ? "bg-red-50 text-red-500" :
                                set.type === TOOL_IDS.ROADMAP ? "bg-emerald-50 text-emerald-500" :
                                set.type === TOOL_IDS.FLASHCARDS ? "bg-amber-50 text-amber-500" :
                                set.type === TOOL_IDS.SUMMARY ? "bg-blue-50 text-blue-500" :
                                "bg-indigo-50 text-indigo-500"
                              )
                            )}>
                               {set.isGenerating ? <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 animate-spin rounded-full" /> : (
                                 set.type === TOOL_IDS.QUIZ ? <HelpCircle className="h-5 w-5" /> :
                                  set.type === TOOL_IDS.ROADMAP ? <Target className="h-5 w-5" /> :
                                  set.type === TOOL_IDS.FLASHCARDS ? <Layers className="h-5 w-5" /> :
                                  set.type === TOOL_IDS.SUMMARY ? <FileText className="h-5 w-5" /> :
                                  <Headphones className="h-5 w-5" />
                               )}
                            </div>
                            <div className="flex-1 text-left">
                              <p className="text-[13px] font-black text-gray-800 line-clamp-1">{set.name}</p>
                              <p className="text-[10px] font-bold text-gray-400 mt-0.5 opacity-80 uppercase tracking-tighter">
                                  {set.isGenerating ? 'Content is being generated...' : (
                                    set.type === TOOL_IDS.QUIZ ? '10 questions left • All topics' :
                                     set.type === TOOL_IDS.SUMMARY ? 'Detailed Summary • All topics' :
                                     set.type === TOOL_IDS.ROADMAP ? 'Personalized Learning Path' :
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
