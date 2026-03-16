import { motion, AnimatePresence } from "framer-motion";
import { 
  Copy, Check, BookOpen, Lightbulb, 
  Clock, Map, FileText, 
  Brain, Target,
  Rocket, Star,
  ChevronDown, Plus, FolderPlus, MessageSquare,
  ChevronUp, Settings2, Share2, MoreVertical, ChevronRight
} from "lucide-react";
import { useState, useEffect, useRef, lazy, Suspense, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
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
  onToolClick
}: SummaryDisplayProps) => {
  const resolvedLearningContext = learningContext || learning_context;
  const [copied, setCopied] = useState(false);
  const [isAutoScroll, setIsAutoScroll] = useState(false);
  const [activeTab, setActiveTab] = useState("chapters");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

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
  }, [currentTime, isAutoScroll, activeTab]);

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
      {/* Overview Card - Minimal version for header */}
      <div className="flex items-center justify-between gap-4 mb-2">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center border border-gray-100 dark:border-gray-800">
              <BookOpen className="h-4 w-4 text-black dark:text-white" />
            </div>
            <h2 className="text-xl font-bold text-foreground truncate max-w-sm">Video Summary</h2>
         </div>
         
         <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl border-gray-100 font-bold text-[#00a86b] hover:bg-[#e6f9f1] hover:border-[#ccf0dd] transition-all">
              Upgrade
            </Button>
            <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl border-gray-100 font-bold gap-2 hover:bg-gray-50 transition-all">
               <Plus className="h-4 w-4" /> New Exam
            </Button>
            <Button variant="ghost" size="sm" className="h-9 px-4 rounded-xl font-bold gap-2 text-gray-500 hover:text-black">
               Share <MoreVertical className="h-4 w-4" />
            </Button>
         </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-2 bg-gray-50/80 p-1.5 rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
           <button 
             onClick={() => setActiveTab("chapters")}
             className={cn(
               "flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
               activeTab === "chapters" ? "bg-white text-black shadow-sm" : "text-gray-400 hover:text-gray-600"
             )}
           >
             <div className={cn("w-2 h-2 rounded-full", activeTab === "chapters" ? "bg-green-500" : "bg-gray-200")} />
             Chapters
           </button>
           <div className="w-px h-4 bg-gray-200" />
           <button 
             onClick={() => setActiveTab("transcripts")}
             className={cn(
               "flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
               activeTab === "transcripts" ? "bg-white text-black shadow-sm" : "text-gray-400 hover:text-gray-600"
             )}
           >
             <FileText className="h-3.5 w-3.5" />
             Transcripts
           </button>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAutoScroll(!isAutoScroll)}
            className={cn(
              "flex items-center gap-2.5 px-6 py-2.5 rounded-2xl border transition-all shadow-sm",
              isAutoScroll ? "bg-white border-gray-100 text-black" : "bg-gray-50/50 border-gray-100 text-gray-400 hover:bg-white"
            )}
          >
             <Settings2 className={cn("h-4 w-4 transition-transform", isAutoScroll && "text-black")} />
             <span className="text-xs font-black uppercase tracking-widest">Auto Scroll</span>
          </button>
          <Button variant="ghost" size="icon" className="h-10 w-10 bg-gray-50/50 hover:bg-white border border-gray-100 rounded-2xl shadow-sm">
             <ChevronUp className="h-4 w-4 text-gray-400" />
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
           key={activeTab}
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           exit={{ opacity: 0, y: -10 }}
           transition={{ duration: 0.2 }}
           className="bg-gray-50/30 dark:bg-gray-900/10 rounded-[40px] border border-gray-100 dark:border-gray-800 p-8 min-h-[400px]"
        >
          {activeTab === "chapters" ? (
             <div className="space-y-12">
               {timestamps?.map((ts, i) => (
                  <div key={i} className="group cursor-pointer">
                    <div className="flex items-start gap-8">
                       <div className="flex flex-col items-center gap-3">
                          <button 
                             onClick={() => onTimestampClick?.(parseTimeToSeconds(ts.time))}
                             className="w-16 h-10 rounded-2xl bg-white dark:bg-black border border-gray-100 dark:border-gray-800 flex items-center justify-center text-xs font-black shadow-sm group-hover:border-black dark:group-hover:border-white transition-all"
                          >
                             {ts.time}
                          </button>
                          <div className="w-0.5 flex-1 bg-gray-100 dark:bg-gray-800 rounded-full" />
                       </div>
                       <div className="flex-1 pb-12 group-last:pb-0">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-black dark:group-hover:text-white transition-colors">{ts.label}</h3>
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 leading-relaxed">
                            Deep analysis of {ts.label.toLowerCase()} covering key concepts and practical applications shared in this section.
                          </p>
                       </div>
                    </div>
                  </div>
               ))}

               {/* Add Context-Aware Chat Trigger */}
               <div className="mt-12 pt-12 border-t border-gray-100 dark:border-gray-800">
                  <div className="relative group">
                    <input 
                      type="text"
                      placeholder="Ask a follow-up about these chapters..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value;
                          if (val.trim()) {
                            onToolClick?.('chapters', val, `[Chapters Context]:\n${timestamps?.map(t => `${t.time}: ${t.label}`).join('\n')}`);
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
          ) : activeTab === "transcripts" ? (
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

    </motion.div>
  );
};

export default SummaryDisplay;
