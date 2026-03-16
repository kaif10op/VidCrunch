import { motion, AnimatePresence } from "framer-motion";
import { 
  Copy, Check, BookOpen, Lightbulb, 
  Clock, Map, FileText, 
  Brain, Target,
  Rocket, Star,
  ChevronDown, Plus, FolderPlus, MessageSquare,
  ChevronUp, Settings2, Share2, MoreVertical
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
  onToolClick?: (toolId: string) => void;
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
            <h2 className="text-xl font-bold text-foreground truncate max-w-sm">Video Synthesis</h2>
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
             onClick={() => setActiveTab("synthesis")}
             className={cn(
               "flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
               activeTab === "synthesis" ? "bg-white text-black shadow-sm" : "text-gray-400 hover:text-gray-600"
             )}
           >
             <Brain className="h-3.5 w-3.5" />
             Synthesis
           </button>
           <div className="w-px h-4 bg-gray-200" />
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
          {activeTab === "synthesis" ? (
             <div className="space-y-12">
                <div className="space-y-6">
                  {overview ? (
                    <p className="text-lg font-medium text-gray-600 dark:text-gray-400 leading-relaxed max-w-4xl">{overview}</p>
                  ) : (
                    <div className="bg-white dark:bg-black rounded-[32px] border border-gray-100 dark:border-gray-800 p-8 flex flex-col items-center justify-center text-center space-y-4 shadow-sm min-h-[200px] w-full">
                       <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center border border-gray-100 dark:border-gray-800">
                          <Brain className="h-6 w-6 text-black dark:text-white" />
                       </div>
                       <div>
                          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">AI Synthesis</h3>
                          <p className="text-xs text-gray-400 mt-1">Generate a high-level overview of this video</p>
                       </div>
                       <Button 
                         onClick={() => onToolClick?.("overview")}
                         className="rounded-xl font-bold bg-black dark:bg-white text-white dark:text-black gap-2"
                       >
                          <Rocket className="h-4 w-4" /> Synthesize Overview
                       </Button>
                    </div>
                  )}
                  {tags && tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag, i) => (
                        <span key={i} className="text-[9px] font-black uppercase tracking-widest bg-white dark:bg-gray-900 text-gray-400 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  ) : overview && (
                     <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => onToolClick?.("tags")}
                        className="text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-black"
                     >
                        + Add Tags
                     </Button>
                  )}
                </div>

                {/* Insights Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {keyPoints && keyPoints.length > 0 ? (
                    <div className="bg-white dark:bg-black rounded-[32px] border border-gray-100 dark:border-gray-800 p-6 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center border border-amber-100 dark:border-amber-900/30">
                            <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Major Insights</h3>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {keyPoints.map((point, i) => (
                          <div key={i} className="flex items-start gap-3 text-sm font-medium text-gray-500 dark:text-gray-400 leading-relaxed group/item">
                            <span className="w-5 h-5 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black text-black dark:text-white group-hover/item:bg-black dark:group-hover/item:bg-white group-hover/item:text-white dark:group-hover/item:text-black transition-all">
                              {i + 1}
                            </span>
                            <div className="flex flex-wrap items-center gap-x-2">
                              {point}
                              <button 
                                onClick={() => onTimestampClick?.(parseTimeToSeconds(timestamps[i % timestamps.length]?.time || "0:00"))}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-[9px] font-black text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-200 transition-all ml-1"
                              >
                                <Clock className="h-2.5 w-2.5" />
                                {timestamps[i % timestamps.length]?.time || "0:00"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-black rounded-[32px] border border-gray-100 dark:border-gray-800 p-8 flex flex-col items-center justify-center text-center space-y-4 shadow-sm min-h-[200px]">
                       <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center border border-amber-100 dark:border-amber-900/30">
                          <Lightbulb className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                       </div>
                       <div>
                          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Key Insights</h3>
                          <p className="text-xs text-gray-400 mt-1">Generate main bullet points from this video</p>
                       </div>
                       <Button 
                         onClick={() => onToolClick?.("key_points")}
                         className="rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white gap-2"
                       >
                          <Plus className="h-4 w-4" /> Generate
                       </Button>
                    </div>
                  )}

                  {takeaways && takeaways.length > 0 ? (
                    <div className="bg-white dark:bg-black rounded-[32px] border border-gray-100 dark:border-gray-800 p-6 space-y-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center border border-blue-100 dark:border-blue-900/30">
                          <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Action Items</h3>
                      </div>
                      <div className="space-y-3">
                        {takeaways.map((item, i) => (
                          <div key={i} className="flex items-start gap-3 text-sm font-medium text-gray-500 dark:text-gray-400 leading-relaxed group/item">
                            <div className="mt-2 w-1 h-1 rounded-full bg-blue-500 shrink-0 group-hover/item:scale-150 transition-transform" />
                            <div className="flex flex-wrap items-center gap-x-2">
                              {item}
                              <button 
                                onClick={() => onTimestampClick?.(0)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-[9px] font-black text-indigo-400 hover:text-indigo-600 transition-all opacity-0 group-hover/item:opacity-100"
                              >
                                <Target className="h-2.5 w-2.5" />
                                Source
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-black rounded-[32px] border border-gray-100 dark:border-gray-800 p-8 flex flex-col items-center justify-center text-center space-y-4 shadow-sm min-h-[200px]">
                       <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center border border-blue-100 dark:border-blue-900/30">
                          <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                       </div>
                       <div>
                          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Action Items</h3>
                          <p className="text-xs text-gray-400 mt-1">Extract actionable takeaways</p>
                       </div>
                       <Button 
                         onClick={() => onToolClick?.("takeaways")}
                         className="rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white gap-2"
                       >
                          <Plus className="h-4 w-4" /> Generate
                       </Button>
                    </div>
                  )}
                </div>

                {/* Strategic Context */}
                {resolvedLearningContext && (resolvedLearningContext.why || resolvedLearningContext.whatToHowTo || resolvedLearningContext.bestWay) ? (
                  <div className="bg-black dark:bg-gray-900 rounded-[32px] p-8 space-y-6 shadow-xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 backdrop-blur-md">
                        <Brain className="h-4 w-4 text-white" />
                      </div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Strategic Context</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {resolvedLearningContext.why && (
                        <div className="space-y-2">
                          <h4 className="text-[9px] font-black text-white/40 uppercase tracking-widest">Purpose</h4>
                          <p className="text-xs font-medium text-white/70 leading-relaxed">{resolvedLearningContext.why}</p>
                        </div>
                      )}
                      {resolvedLearningContext.whatToHowTo && (
                        <div className="space-y-2">
                          <h4 className="text-[9px] font-black text-white/40 uppercase tracking-widest">Application</h4>
                          <p className="text-xs font-medium text-white/70 leading-relaxed">{resolvedLearningContext.whatToHowTo}</p>
                        </div>
                      )}
                      {resolvedLearningContext.bestWay && (
                        <div className="space-y-2">
                          <h4 className="text-[9px] font-black text-white/40 uppercase tracking-widest">Way Forward</h4>
                          <p className="text-xs font-medium text-white/70 leading-relaxed">{resolvedLearningContext.bestWay}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-900 rounded-[32px] p-8 flex items-center justify-between shadow-xl border border-white/5">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                          <Brain className="h-6 w-6 text-white/40" />
                       </div>
                       <div>
                          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Strategic Context</h3>
                          <p className="text-xs text-white/30 mt-1">Get high-level analysis on how to learn this topic</p>
                       </div>
                    </div>
                    <Button 
                      onClick={() => onToolClick?.("learning_context")}
                      className="rounded-xl font-bold bg-white text-black hover:bg-gray-100"
                    >
                       Analyze Context
                    </Button>
                  </div>
                )}
             </div>
          ) : activeTab === "chapters" ? (
             <div className="space-y-12">
               {timestamps?.map((ts, i) => (
                  <div key={i} className="group cursor-pointer">
                     <div className="flex items-center gap-3 mb-4">
                        <span className="bg-white px-3 py-1 rounded-lg border border-gray-100 text-[10px] font-black tracking-widest text-gray-400 group-hover:text-black transition-colors">{ts.time}</span>
                        <h3 className="text-xl font-bold text-gray-800">{ts.label}</h3>
                     </div>
                     <p className="text-base text-gray-500 leading-relaxed max-w-3xl pl-3 border-l-2 border-transparent group-hover:border-green-500 transition-all">
                        {keyPoints[i] || "Critical analysis for this segment is being processed. Dive deeper into the transcript for more details."}
                     </p>
                  </div>
               ))}
             </div>
          ) : activeTab === "transcripts" ? (
             <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-4 scrollbar-thin">
               {transcript_segments?.map((seg, i) => (
                 <div
                   key={i}
                   onClick={() => onTimestampClick && onTimestampClick(seg.start)}
                   className={cn(
                     "group cursor-pointer p-4 rounded-2xl transition-all flex gap-6 items-start",
                     i === activeTranscriptIndex ? "bg-white shadow-md scale-[1.01] border border-gray-100" : "hover:bg-white/50"
                   )}
                 >
                   <span className={cn(
                     "text-[10px] font-black uppercase tracking-widest shrink-0 mt-1 w-12",
                     i === activeTranscriptIndex ? "text-green-600" : "text-gray-300"
                   )}>{Math.floor(seg.start/60)}:{String(Math.floor(seg.start%60)).padStart(2, '0')}</span>
                   <p className={cn(
                     "text-sm font-medium leading-relaxed",
                     i === activeTranscriptIndex ? "text-gray-800" : "text-gray-400"
                   )}>{seg.text}</p>
                 </div>
               ))}
             </div>
          ) : null}
        </motion.div>
      </AnimatePresence>

    </motion.div>
  );
};

export default SummaryDisplay;
