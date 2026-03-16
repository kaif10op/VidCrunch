import { motion, AnimatePresence } from "framer-motion";
import { 
  Copy, Check, BookOpen, Lightbulb, 
  Clock, Map, FileText, 
  Brain, Target,
  Rocket, Star,
  ChevronDown
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-8 pb-20">
      {/* Overview Card */}
      {overview && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-green-600" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Overview</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{overview}</p>
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {tags.map((tag, i) => (
                <span key={i} className="text-[10px] font-medium bg-gray-50 text-muted-foreground px-2.5 py-1 rounded-full border border-gray-100">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Key Points */}
      {keyPoints && keyPoints.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
              <Lightbulb className="h-4 w-4 text-amber-600" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Key Points</h2>
          </div>
          <ul className="space-y-3">
            {keyPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground leading-relaxed">
                <span className="w-5 h-5 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-semibold text-gray-400">
                  {i + 1}
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Takeaways */}
      {takeaways && takeaways.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <Target className="h-4 w-4 text-blue-600" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Takeaways</h2>
          </div>
          <ul className="space-y-3">
            {takeaways.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground leading-relaxed">
                <Star className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Learning Context */}
      {resolvedLearningContext && (resolvedLearningContext.why || resolvedLearningContext.whatToHowTo || resolvedLearningContext.bestWay) && (
        <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 rounded-2xl border border-indigo-100/50 p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Brain className="h-4 w-4 text-indigo-600" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Learning Context</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {resolvedLearningContext.why && (
              <div className="bg-white/70 rounded-xl p-4 border border-indigo-100/30">
                <h4 className="text-xs font-semibold text-indigo-600 mb-2 uppercase tracking-wider">Why Learn This</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{resolvedLearningContext.why}</p>
              </div>
            )}
            {resolvedLearningContext.whatToHowTo && (
              <div className="bg-white/70 rounded-xl p-4 border border-indigo-100/30">
                <h4 className="text-xs font-semibold text-indigo-600 mb-2 uppercase tracking-wider">What to How</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{resolvedLearningContext.whatToHowTo}</p>
              </div>
            )}
            {resolvedLearningContext.bestWay && (
              <div className="bg-white/70 rounded-xl p-4 border border-indigo-100/30">
                <h4 className="text-xs font-semibold text-indigo-600 mb-2 uppercase tracking-wider">Best Approach</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{resolvedLearningContext.bestWay}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between mb-6">
          <TabsList className="bg-transparent p-0 gap-6 h-auto">
            <TabsTrigger 
              value="chapters" 
              className="px-0 py-2 text-sm font-medium data-[state=active]:text-foreground text-muted-foreground border-b-2 border-transparent data-[state=active]:border-green-500 rounded-none bg-transparent gap-2"
            >
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              Chapters
            </TabsTrigger>
            <TabsTrigger 
              value="transcripts" 
              className="px-0 py-2 text-sm font-medium data-[state=active]:text-foreground text-muted-foreground border-b-2 border-transparent data-[state=active]:border-foreground rounded-none bg-transparent gap-2"
            >
              <span className="text-muted-foreground text-xs">T</span>
              Transcripts
            </TabsTrigger>
            {flashcards && flashcards.length > 0 && (
              <TabsTrigger 
                value="flashcards" 
                className="px-0 py-2 text-sm font-medium data-[state=active]:text-foreground text-muted-foreground border-b-2 border-transparent data-[state=active]:border-purple-500 rounded-none bg-transparent gap-2"
              >
                <div className="w-2 h-2 bg-purple-500 rounded-full" />
                Flashcards
              </TabsTrigger>
            )}
          </TabsList>

          <div className="flex items-center gap-3">
             <button 
               onClick={() => setIsAutoScroll(!isAutoScroll)}
               className={cn(
                 "flex items-center gap-2 text-xs font-medium transition-colors px-3 py-1.5 rounded-full border",
                 isAutoScroll ? "text-foreground border-gray-200 bg-white" : "text-muted-foreground border-gray-100 hover:border-gray-200"
               )}
             >
                <ChevronDown className="h-3 w-3" />
                Auto Scroll
             </button>
             <button 
               onClick={handleCopy} 
               className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
             >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
             </button>
          </div>
        </div>

        {/* ─── CHAPTERS TAB ─── */}
        <TabsContent value="chapters" className="mt-0 outline-none space-y-8">
          {timestamps?.map((ts, i) => (
            <motion.div 
              key={i}
              ref={i === activeChapterIndex ? activeLineRef : null}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "group cursor-pointer p-4 -mx-4 rounded-2xl transition-all",
                i === activeChapterIndex ? "bg-gray-50" : "hover:bg-gray-50/50"
              )}
              onClick={() => onTimestampClick && onTimestampClick(parseTimeToSeconds(ts.time))}
              role="button"
              aria-label={`Jump to chapter: ${ts.label} at ${ts.time}`}
            >
              <span className={cn(
                "text-xs font-medium mb-2 block transition-colors",
                i === activeChapterIndex ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
              )}>{ts.time}</span>
              <h3 className={cn(
                "text-lg font-semibold mb-2 transition-colors",
                i === activeChapterIndex ? "text-foreground" : "group-hover:text-foreground"
              )}>{ts.label}</h3>
              <p className="text-muted-foreground leading-relaxed text-sm">
                {keyPoints[i] || overview.slice(0, 200)}
              </p>
            </motion.div>
          ))}

          {!timestamps?.length && (
            <div className="py-16 text-center">
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
                <Clock className="h-5 w-5 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No chapters detected</p>
              <p className="text-xs text-gray-400 mt-1">The summary above provides a full overview of the content.</p>
            </div>
          )}
        </TabsContent>

        {/* ─── TRANSCRIPTS TAB ─── */}
        <TabsContent value="transcripts" className="mt-0 outline-none">
          {transcript_segments ? (
            <div className="space-y-4">
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
                      "group cursor-pointer p-3 -mx-3 rounded-2xl transition-all",
                      isActive ? "bg-blue-50 text-blue-700 font-bold shadow-sm" : "hover:bg-gray-50"
                    )}
                  >
                    <span className={cn(
                      "text-[10px] font-semibold mb-1 block",
                      isActive ? "text-blue-600" : "text-muted-foreground group-hover:text-foreground"
                    )}>[{timeStr}]</span>
                    <p className="text-sm leading-relaxed">{seg.text}</p>
                  </div>
                );
              })}
            </div>
          ) : transcript ? (
            <div className="space-y-4">
              {transcript.split("\n").map((line, i) => {
                const match = line.match(/^\[(\d+:\d+)\]\s*(.*)$/);
                const isActive = i === activeTranscriptIndex;
                if (match) {
                  return (
                    <div
                      key={i}
                      ref={isActive ? activeLineRef : null}
                      onClick={() => onTimestampClick && onTimestampClick(parseTimeToSeconds(match[1]))}
                      className={cn(
                        "group cursor-pointer p-3 -mx-3 rounded-2xl transition-all",
                        isActive ? "bg-blue-50 text-blue-700 font-bold shadow-sm" : "hover:bg-gray-50"
                      )}
                    >
                      <span className={cn(
                        "text-[10px] font-semibold mb-1 block",
                        isActive ? "text-blue-600" : "text-muted-foreground group-hover:text-foreground"
                      )}>{match[1]}</span>
                      <p className="text-sm leading-relaxed">{match[2]}</p>
                    </div>
                  );
                }
                return <p key={i} className="text-foreground text-sm leading-relaxed">{line}</p>;
              })}
            </div>
          ) : (
            <div className="py-16 text-center">
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
                <FileText className="h-5 w-5 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Transcript unavailable</p>
              <p className="text-xs text-gray-400 mt-1">This video may not have captions or subtitles.</p>
            </div>
          )}
        </TabsContent>

        {/* ─── FLASHCARDS TAB ─── */}
        <TabsContent value="flashcards" className="mt-0 outline-none">
          {flashcards ? (
            <Suspense fallback={<div className="py-16 text-center text-muted-foreground text-sm">Loading flashcards...</div>}>
              <Flashcards cards={flashcards} />
            </Suspense>
          ) : (
            <div className="py-16 text-center">
               <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
                 <Brain className="h-5 w-5 text-gray-300" />
               </div>
               <p className="text-sm font-medium text-muted-foreground">Study Cards Unavailable</p>
               <p className="text-xs text-gray-400 mt-1">Try re-analyzing this video to generate interactive cards.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Other Sections (Roadmap, Quiz, etc.) */}
      {(roadmap || quiz || resolvedMindMap) && (
        <div className="mt-20 pt-12 border-t space-y-20">
           {roadmap && (
             <section id="roadmap">
                <div className="flex items-center gap-3 mb-8">
                   <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center">
                      <Rocket className="h-5 w-5 text-purple-600" />
                   </div>
                   <h3 className="text-2xl font-bold">Mastery Roadmap</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {roadmap.steps.map((step, i) => (
                     <div key={i} className="p-6 rounded-3xl border bg-white shadow-sm hover:shadow-md transition-all">
                        <span className="text-xs font-semibold text-purple-600 mb-2 block tracking-wider uppercase">Step {step.step}</span>
                        <h4 className="text-lg font-bold mb-3">{step.task}</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                     </div>
                   ))}
                </div>
             </section>
           )}

           {quiz && quiz.length > 0 && (
             <section id="quiz">
                <div className="flex items-center gap-3 mb-8">
                   <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center">
                      <Brain className="h-5 w-5 text-red-500" />
                   </div>
                   <h3 className="text-2xl font-bold">Evaluation Quiz</h3>
                </div>
                <Suspense fallback={<div className="p-8 text-center text-muted-foreground text-sm">Loading quiz...</div>}>
                  <QuizTab quiz={quiz} />
                </Suspense>
             </section>
           )}

           {resolvedMindMap && resolvedMindMap.nodes && resolvedMindMap.nodes.length > 0 && (
              <section id="mindmap">
                 <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
                       <Map className="h-5 w-5 text-blue-500" />
                    </div>
                    <h3 className="text-2xl font-bold">Mind Map</h3>
                 </div>
                 <Suspense fallback={<div className="p-8 text-center text-muted-foreground text-sm">Loading mind map...</div>}>
                   <MindMapTab mindMap={resolvedMindMap} />
                 </Suspense>
              </section>
            )}
        </div>
      )}
    </motion.div>
  );
};

export default SummaryDisplay;
