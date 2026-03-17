import { motion, AnimatePresence } from "framer-motion";
import { 
  Clock, Map, FileText, 
  Brain, Target,
  Rocket, Star,
  ChevronDown, Plus, MessageSquare,
  ChevronUp, Settings2, Share2, MoreVertical, ChevronRight, Sparkles, X
} from "lucide-react";
import { useState, useEffect, useRef, lazy, Suspense, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { RichMessage } from "./RichMessage";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const QuizTab = lazy(() => import("./QuizTab"));
const MindMapTab = lazy(() => import("./MindMapTab"));
const Flashcards = lazy(() => import("./Flashcards"));

interface Timestamp {
  time: string;
  label: string;
}

interface RoadmapStep {
  step: number;
  task: string;
  description: string;
}

interface LearningContext {
  why: string;
  whatToHowTo: string;
  bestWay: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

interface MindMapData {
  nodes: { id: string; label: string }[];
  edges: { source: string; target: string; label?: string }[];
}

interface SummaryDisplayProps {
  overview: string;
  keyPoints: string[];
  takeaways: string[];
  timestamps: Timestamp[];
  tags: string[];
  transcript?: string;
  learningContext?: LearningContext;
  learning_context?: LearningContext;
  onTimestampClick?: (seconds: number) => void;
  spaces?: { id: string; name: string }[];
  onAddToSpace?: (spaceId: string) => void;
  currentTime?: number;
  flashcards?: { front: string; back: string }[];
  transcript_segments?: { start: number; end: number; text: string }[];
  onToolClick?: (toolId: string, value?: string, context?: string) => void;
  aiExplanation?: string | null;
  onClearExplanation?: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  isAutoScroll: boolean;
  setIsAutoScroll: (val: boolean) => void;
}

function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

const SummaryDisplay = ({ 
  overview, 
  keyPoints, 
  takeaways, 
  timestamps, 
  tags, 
  transcript,
  learningContext,
  learning_context,
  onTimestampClick,
  spaces = [],
  onAddToSpace,
  currentTime = 0,
  flashcards,
  transcript_segments,
  onToolClick,
  aiExplanation,
  onClearExplanation,
  activeTab = "chapters",
  onTabChange,
  isAutoScroll,
  setIsAutoScroll
}: SummaryDisplayProps) => {
  const resolvedLearningContext = learningContext || learning_context;
  const [copied, setCopied] = useState(false);
  
  const currentTab = activeTab;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onClearExplanation?.();
  }, [currentTab, onClearExplanation]);

  const handleCopy = () => {
    const text = `Title: ${overview}\n\nKey Points:\n${keyPoints.join("\n")}\n\nTakeaways:\n${takeaways.join("\n")}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (isAutoScroll && activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentTime, isAutoScroll, currentTab]);

  const activeTranscriptIndex = useMemo(() => {
    if (transcript_segments) {
      let activeIndex = -1;
      for (let i = 0; i < transcript_segments.length; i++) {
        if (transcript_segments[i].start <= currentTime) {
          activeIndex = i;
        } else {
          break;
        }
      }
      return activeIndex;
    }
    if (!transcript) return -1;

    const lines = transcript.split("\n");
    let activeIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^\[(\d+:\d+)\]/);
      if (match) {
        const time = parseTimeToSeconds(match[1]);
        if (time <= currentTime) {
          activeIndex = i;
        } else {
          break;
        }
      }
    }

    return activeIndex;
  }, [currentTime, transcript_segments, transcript]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName);
      if (isInput) return;

      // Tab switching
      switch(e.key) {
        case '1': onTabChange?.("chapters"); break;
        case '2': onTabChange?.("transcript"); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTabChange]);

  const activeChapterIndex = useMemo(() => {
    let activeIndex = -1;
    for (let i = 0; i < timestamps.length; i++) {
      const time = parseTimeToSeconds(timestamps[i].time);
      if (time <= currentTime) {
        activeIndex = i;
      } else {
        break;
      }
    }
    return activeIndex;
  }, [currentTime, timestamps]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-8 pb-32">

      <AnimatePresence mode="wait">
        <motion.div
           key={currentTab}
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           exit={{ opacity: 0, y: -10 }}
           transition={{ duration: 0.2 }}
           className="bg-gray-50/30 dark:bg-gray-900/10 rounded-[40px] border border-gray-100 dark:border-gray-800 p-8 min-h-[400px]"
        >
          {currentTab === "chapters" ? (
             <div className="space-y-12">
               {timestamps?.map((ts, i) => (
                  <div key={i} className="group cursor-pointer">
                    <div className="flex items-start gap-8">
                       <div className="flex flex-col items-center gap-3">
                          <button 
                             onClick={() => onTimestampClick?.(parseTimeToSeconds(ts.time))}
                             className={cn(
                                "w-16 h-10 rounded-2xl border flex items-center justify-center text-xs font-black shadow-sm transition-all",
                                i === activeChapterIndex ? "bg-black text-white border-black" : "bg-white dark:bg-black border-gray-100 dark:border-gray-800 group-hover:border-black dark:group-hover:border-white"
                             )}
                          >
                             {ts.time}
                          </button>
                          <div className="w-0.5 flex-1 bg-gray-100 dark:bg-gray-800 rounded-full" />
                       </div>
                       <div className="flex-1 pb-12 group-last:pb-0">
                          <div className="flex items-center justify-between gap-4 mb-2">
                            <h3 className={cn(
                                "text-lg font-bold transition-colors",
                                i === activeChapterIndex ? "text-black dark:text-white" : "text-gray-600 dark:text-gray-400 group-hover:text-black dark:group-hover:text-white"
                            )}>{ts.label}</h3>
                            <Button 
                                size="sm" 
                                variant="ghost"
                                className="h-8 rounded-lg text-[10px] font-bold gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToolClick?.('chapters', `Explain this section: ${ts.label}`, `[Chapter Context]: ${ts.label} at ${ts.time}`);
                                }}
                            >
                                <Sparkles className="h-3 w-3" /> Explain
                            </Button>
                          </div>
                          <p className="text-sm font-medium text-gray-400 dark:text-gray-500 leading-relaxed">
                            Deep analysis of {ts.label.toLowerCase()} covering key concepts and practical applications shared in this section.
                          </p>
                       </div>
                    </div>
                  </div>
               ))}
                 </div>
          ) : currentTab === "transcripts" ? (
             <div className="space-y-8">
               <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4 scrollbar-thin">
                 {transcript_segments?.map((seg, i) => (
                   <div 
                     key={i} 
                     ref={i === activeTranscriptIndex ? activeLineRef : null}
                     className={cn(
                       "p-4 rounded-2xl transition-all cursor-pointer flex gap-6 items-start",
                       i === activeTranscriptIndex ? "bg-white dark:bg-gray-800 shadow-md border border-gray-100 dark:border-gray-700" : "hover:bg-white/50 dark:hover:bg-gray-900/50"
                     )}
                     onClick={() => onTimestampClick?.(seg.start)}
                   >
                     <span className={cn(
                       "text-[10px] font-black uppercase tracking-widest shrink-0 mt-1 w-12",
                       i === activeTranscriptIndex ? "text-green-600" : "text-gray-300"
                     )}>{Math.floor(seg.start/60)}:{String(Math.floor(seg.start%60)).padStart(2, '0')}</span>
                     <p className={cn(
                       "text-sm font-medium leading-relaxed",
                       i === activeTranscriptIndex ? "text-gray-800 dark:text-gray-100" : "text-gray-400"
                     )}>{seg.text}</p>
                   </div>
                 ))}
               </div>

               {/* Add Context-Aware Chat Trigger */}
               <div className="mt-12 pt-12 border-t border-gray-100 dark:border-gray-800">
                  <div className="relative group">
                    <input
                      type="text"
                      placeholder="Ask a follow-up about the transcript..."
                      aria-label="Ask a question about the transcript"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value;
                          if (val.trim()) {
                            onToolClick?.('transcript', val, `[Transcript Snippet]:\n${transcript?.slice(0, 1000)}...`);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                      className="w-full h-16 bg-white dark:bg-black rounded-3xl border border-gray-200 dark:border-gray-800 px-8 pr-16 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all shadow-sm"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-black dark:bg-white flex items-center justify-center cursor-pointer">
                      <ChevronRight className="h-4 w-4 text-white dark:text-black" />
                    </div>
                  </div>
                </div>
             </div>
          ) : null}
        </motion.div>
      </AnimatePresence>

      {/* AI Breakdown for Summary navigation deep-dives */}
      <AnimatePresence>
        {aiExplanation && (
            <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="mx-8 p-8 bg-black rounded-[2.5rem] border border-white/10 relative overflow-hidden shadow-2xl"
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-100">Deep-Dive Analysis</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClearExplanation} className="h-8 w-8 p-0 rounded-lg text-white/40 hover:text-white">
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <div className="prose prose-invert prose-sm max-w-none">
                    <RichMessage content={aiExplanation} role="assistant" className="text-gray-200" />
                </div>
            </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
};

export default SummaryDisplay;
