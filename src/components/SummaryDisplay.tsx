import { motion, AnimatePresence } from "framer-motion";
import { 
  Copy, Check, BookOpen, Lightbulb, 
  Clock, Map, FileText, 
  Brain, Target,
  Rocket, Star,
  ChevronDown, Plus, FolderPlus
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
  roadmap?: { title: string; steps: RoadmapStep[] };
  learningContext?: LearningContext;
  learning_context?: LearningContext;
  quiz?: QuizQuestion[];
  mindMap?: MindMapData;
  mind_map?: MindMapData;
  onTimestampClick?: (seconds: number) => void;
  spaces?: { id: string; name: string }[];
  onAddToSpace?: (spaceId: string) => void;
  currentTime?: number;
  flashcards?: { front: string; back: string }[];
  transcript_segments?: { start: number; end: number; text: string }[];
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
  roadmap,
  learningContext,
  learning_context,
  quiz,
  mindMap,
  mind_map,
  onTimestampClick,
  spaces = [],
  onAddToSpace,
  currentTime = 0,
  flashcards,
  transcript_segments
}: SummaryDisplayProps) => {
  const resolvedLearningContext = learningContext || learning_context;
  const resolvedMindMap = mindMap || mind_map;
  const [copied, setCopied] = useState(false);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
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

  const findActiveTranscriptIndex = () => {
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
  };

  const findActiveChapterIndex = () => {
    if (!timestamps) return -1;
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
  };

  const activeTranscriptIndex = useMemo(() => findActiveTranscriptIndex(), [currentTime, transcript_segments, transcript]);
  const activeChapterIndex = useMemo(() => findActiveChapterIndex(), [currentTime, timestamps]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-12 pb-32">
      {/* Overview Card */}
      {overview && (
        <div className="bg-white rounded-[40px] border border-gray-100 p-8 lg:p-10 space-y-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center border border-gray-100">
              <BookOpen className="h-5 w-5 text-black" />
            </div>
            <h2 className="text-xl font-bold text-foreground flex-1">Synthesis Overview</h2>
            
            {onAddToSpace && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-xl h-10 px-4 border-gray-100 hover:border-black hover:bg-black hover:text-white transition-all gap-2 text-[10px] font-bold uppercase tracking-widest"
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                    Add to Space
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl border-gray-100 shadow-xl">
                  {spaces.length > 0 ? (
                    spaces.map(space => (
                      <DropdownMenuItem 
                        key={space.id}
                        onClick={() => onAddToSpace(space.id)}
                        className="rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer hover:bg-gray-50 flex items-center gap-2"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        {space.name}
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <div className="p-4 text-center">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">No Spaces Found</p>
                      <p className="text-[9px] text-gray-300">Create one in the sidebar first.</p>
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <p className="text-lg font-medium text-gray-500 leading-relaxed max-w-3xl">{overview}</p>
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {tags.map((tag, i) => (
                <span key={i} className="text-[10px] font-bold uppercase tracking-widest bg-gray-50 text-gray-400 px-3 py-1.5 rounded-full border border-gray-100">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grid for Key Points and Takeaways */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Key Points */}
        {keyPoints && keyPoints.length > 0 && (
          <div className="bg-white rounded-[40px] border border-gray-100 p-8 space-y-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center border border-amber-100">
                <Lightbulb className="h-5 w-5 text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Critical Insights</h2>
            </div>
            <div className="space-y-4">
              {keyPoints.map((point, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 + 0.2 }}
                  className="flex items-start gap-4 text-sm font-medium text-gray-500 leading-relaxed group/item"
                >
                  <span className="w-6 h-6 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black text-black group-hover/item:bg-black group-hover/item:text-white transition-colors">
                    {i + 1}
                  </span>
                  {point}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Takeaways */}
        {takeaways && takeaways.length > 0 && (
          <div className="bg-white rounded-[40px] border border-gray-100 p-8 space-y-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center border border-blue-100">
                <Target className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Core Takeaways</h2>
            </div>
            <div className="space-y-4">
              {takeaways.map((item, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 + 0.3 }}
                  className="flex items-start gap-4 text-sm font-medium text-gray-500 leading-relaxed group/item"
                >
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 group-hover/item:scale-150 transition-transform" />
                  {item}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Learning Context */}
      {resolvedLearningContext && (resolvedLearningContext.why || resolvedLearningContext.whatToHowTo || resolvedLearningContext.bestWay) && (
        <div className="bg-black text-white rounded-[40px] p-10 space-y-8 shadow-2xl shadow-black/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10 backdrop-blur-md">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-bold">Strategic Context</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {resolvedLearningContext.why && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">The Purpose</h4>
                <p className="text-sm font-medium text-white/70 leading-relaxed">{resolvedLearningContext.why}</p>
              </div>
            )}
            {resolvedLearningContext.whatToHowTo && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Application</h4>
                <p className="text-sm font-medium text-white/70 leading-relaxed">{resolvedLearningContext.whatToHowTo}</p>
              </div>
            )}
            {resolvedLearningContext.bestWay && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Methodology</h4>
                <p className="text-sm font-medium text-white/70 leading-relaxed">{resolvedLearningContext.bestWay}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10 pb-6 border-b border-gray-100">
          <TabsList className="bg-gray-50/50 p-1 rounded-2xl border border-gray-100 h-12">
            <TabsTrigger 
              value="chapters" 
              className="px-6 rounded-xl text-xs font-bold uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm"
            >
              Chapters
            </TabsTrigger>
            <TabsTrigger 
              value="transcripts" 
              className="px-6 rounded-xl text-xs font-bold uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm"
            >
              Transcript
            </TabsTrigger>
            {flashcards && flashcards.length > 0 && (
              <TabsTrigger 
                value="flashcards" 
                className="px-6 rounded-xl text-xs font-bold uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm"
              >
                Cards
              </TabsTrigger>
            )}
          </TabsList>

          <div className="flex items-center gap-3">
             <button 
               onClick={() => setIsAutoScroll(!isAutoScroll)}
               className={cn(
                 "flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all px-4 py-2 rounded-xl border",
                 isAutoScroll ? "bg-black text-white border-black" : "bg-white text-gray-400 border-gray-100 hover:border-gray-200"
               )}
             >
                Auto Scroll
             </button>
             <div className="w-px h-4 bg-gray-100" />
             <button 
               onClick={handleCopy} 
               className="h-10 w-10 flex items-center justify-center bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-all shadow-sm"
               title="Copy analysis"
             >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-400" />}
             </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {/* ─── CHAPTERS TAB ─── */}
            <TabsContent value="chapters" className="mt-0 outline-none space-y-6">
              {timestamps?.map((ts, i) => (
                <motion.div 
                  key={i}
                  ref={i === activeChapterIndex ? activeLineRef : null}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    "group relative pl-8 pb-8 last:pb-0 border-l-2 transition-all",
                    i === activeChapterIndex ? "border-black" : "border-gray-100 hover:border-gray-300"
                  )}
                  onClick={() => onTimestampClick && onTimestampClick(parseTimeToSeconds(ts.time))}
                  role="button"
                >
                  <div className={cn(
                    "absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 transition-all",
                    i === activeChapterIndex ? "bg-black border-black scale-110 shadow-lg shadow-black/20" : "bg-white border-gray-200 group-hover:border-gray-400"
                  )} />
                  
                  <div className={cn(
                    "p-6 rounded-[32px] border transition-all",
                    i === activeChapterIndex ? "bg-white border-gray-100 shadow-xl shadow-black/5" : "bg-white border-transparent hover:border-gray-100"
                  )}>
                    <div className="flex items-center gap-3 mb-3">
                       <span className={cn(
                         "px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase transition-colors",
                         i === activeChapterIndex ? "bg-black text-white" : "bg-gray-100 text-gray-400 group-hover:text-gray-600"
                       )}>{ts.time}</span>
                       <h3 className="text-lg font-bold text-foreground">{ts.label}</h3>
                    </div>
                    <p className="text-sm font-medium text-gray-400 leading-relaxed max-w-2xl">
                      {keyPoints[i] || overview.slice(0, 200)}
                    </p>
                  </div>
                </motion.div>
              ))}

              {!timestamps?.length && (
                <div className="py-24 text-center bg-gray-50/50 rounded-[40px] border border-dashed border-gray-200">
                  <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-gray-100">
                    <Clock className="h-8 w-8 text-gray-200" />
                  </div>
                  <p className="text-lg font-bold text-gray-400">Chapters Missing</p>
                  <p className="text-sm text-gray-300 mt-2 max-w-[240px] mx-auto leading-relaxed">We couldn't detect timestamps for this video. Use the overview above.</p>
                </div>
              )}
            </TabsContent>

            {/* ─── TRANSCRIPTS TAB ─── */}
            <TabsContent value="transcripts" className="mt-0 outline-none">
              {transcript_segments ? (
                <div className="space-y-2">
                  {transcript_segments.map((seg, i) => {
                    const isActive = i === activeTranscriptIndex;
                    const hh = Math.floor(seg.start / 3600);
                    const mm = Math.floor((seg.start % 3600) / 60);
                    const ss = Math.floor(seg.start % 60);
                    const timeStr = hh > 0 
                      ? `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
                      : `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;

                    return (
                      <div
                        key={i}
                        ref={isActive ? activeLineRef : null}
                        onClick={() => onTimestampClick && onTimestampClick(seg.start)}
                        className={cn(
                          "group cursor-pointer p-4 rounded-2xl transition-all flex gap-6 items-start",
                          isActive ? "bg-black text-white shadow-xl shadow-black/10 scale-[1.02]" : "hover:bg-gray-50 bg-transparent"
                        )}
                      >
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-widest shrink-0 mt-1 w-12",
                          isActive ? "text-white/50" : "text-gray-300"
                        )}>{timeStr}</span>
                        <p className={cn(
                          "text-sm font-medium leading-relaxed",
                          isActive ? "text-white" : "text-gray-500"
                        )}>{seg.text}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-24 text-center bg-gray-50/50 rounded-[40px] border border-dashed border-gray-200">
                  <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-gray-100">
                    <FileText className="h-8 w-8 text-gray-200" />
                  </div>
                  <p className="text-lg font-bold text-gray-400">Transcript Unavailable</p>
                  <p className="text-sm text-gray-300 mt-2 max-w-[240px] mx-auto leading-relaxed">No text fallback found for this content.</p>
                </div>
              )}
            </TabsContent>

            {/* ─── FLASHCARDS TAB ─── */}
            <TabsContent value="flashcards" className="mt-0 outline-none">
              {flashcards ? (
                <Suspense fallback={<div className="py-24 text-center">
                  <div className="w-12 h-12 border-4 border-gray-100 border-t-black rounded-full animate-spin mx-auto" />
                </div>}>
                  <Flashcards cards={flashcards} />
                </Suspense>
              ) : null}
            </TabsContent>
          </motion.div>
        </AnimatePresence>
      </Tabs>

      {/* Roadmap & Global Tools Sections */}
      {(roadmap || quiz || resolvedMindMap) && (
        <div className="space-y-24 mt-20">
           {roadmap && (
             <section id="roadmap" className="space-y-10">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-3xl bg-purple-50 flex items-center justify-center border border-purple-100">
                      <Rocket className="h-6 w-6 text-purple-600" />
                   </div>
                   <h3 className="text-2xl font-black text-foreground">Strategic Mastery Path</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   {roadmap.steps.map((step, i) => (
                     <div key={i} className="p-8 rounded-[40px] border border-gray-100 bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                        <span className="text-[10px] font-black text-purple-600 mb-4 block tracking-[0.2em] uppercase">Stage {step.step}</span>
                        <h4 className="text-xl font-bold mb-4">{step.task}</h4>
                        <p className="text-sm font-medium text-gray-400 leading-relaxed">{step.description}</p>
                     </div>
                   ))}
                </div>
             </section>
           )}

           {quiz && quiz.length > 0 && (
             <section id="quiz" className="space-y-10">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-3xl bg-red-50 flex items-center justify-center border border-red-100">
                      <Brain className="h-6 w-6 text-red-500" />
                   </div>
                   <h3 className="text-2xl font-black text-foreground">Interactive Assessment</h3>
                </div>
                <div className="rounded-[40px] border border-gray-100 bg-white overflow-hidden shadow-sm">
                   <Suspense fallback={<div className="p-10 text-center text-gray-300">Loading evaluation...</div>}>
                     <QuizTab quiz={quiz} />
                   </Suspense>
                </div>
             </section>
           )}

           {resolvedMindMap && resolvedMindMap.nodes && resolvedMindMap.nodes.length > 0 && (
              <section id="mindmap" className="space-y-10">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-3xl bg-blue-50 flex items-center justify-center border border-blue-100">
                       <Map className="h-6 w-6 text-blue-500" />
                    </div>
                    <h3 className="text-2xl font-black text-foreground">Cognitive Mind Map</h3>
                 </div>
                 <div className="h-[600px] border border-gray-100 bg-gray-50/50 rounded-[40px] overflow-hidden shadow-inner">
                    <Suspense fallback={<div className="h-full flex items-center justify-center text-gray-300">Mapping logic...</div>}>
                      <MindMapTab mindMap={resolvedMindMap} />
                    </Suspense>
                 </div>
              </section>
            )}
        </div>
      )}
    </motion.div>
  );
};

export default SummaryDisplay;
