import { motion, AnimatePresence } from "framer-motion";
import { 
  Copy, Check, BookOpen, Lightbulb, ListChecks, 
  Clock, Hash, Map, MessageSquare, FileText, 
  ChevronRight, Brain, Target, Compass, Download,
  GraduationCap, Rocket, ArrowRight, Star, HelpCircle,
  Settings, ChevronDown, Plus, Eye
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QuizTab from "./QuizTab";
import MindMapTab from "./MindMapTab";
import Flashcards from "./Flashcards";
import { cn } from "@/lib/utils";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  quiz?: QuizQuestion[];
  mindMap?: MindMapData;
  onTimestampClick?: (seconds: number) => void;
  spaces?: { id: string; name: string }[];
  onAddToSpace?: (spaceId: string) => void;
  currentTime?: number;
  flashcards?: { front: string; back: string }[];
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
  quiz,
  mindMap,
  onTimestampClick,
  spaces = [],
  onAddToSpace,
  currentTime = 0,
  flashcards
}: SummaryDisplayProps) => {
  const [copied, setCopied] = useState(false);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
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
        block: "center"
      });
    }
  }, [currentTime, isAutoScroll]);

  const findActiveTranscriptIndex = () => {
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

  const activeTranscriptIndex = findActiveTranscriptIndex();
  const activeChapterIndex = findActiveChapterIndex();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-8 pb-20">
      <Tabs defaultValue="chapters" className="w-full">
        <div className="flex items-center justify-between mb-8 border-b pb-1">
          <TabsList className="bg-transparent p-0 gap-8 h-auto">
            <TabsTrigger 
              value="chapters" 
              className="px-0 py-2 text-sm font-bold data-[state=active]:text-foreground text-muted-foreground border-b-2 border-transparent data-[state=active]:border-green-500 rounded-none bg-transparent gap-2"
            >
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              Chapters
            </TabsTrigger>
            <TabsTrigger 
              value="transcripts" 
              className="px-0 py-2 text-sm font-bold data-[state=active]:text-foreground text-muted-foreground border-b-2 border-transparent data-[state=active]:border-blue-500 rounded-none bg-transparent gap-2"
            >
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              Transcripts
            </TabsTrigger>
            <TabsTrigger 
              value="flashcards" 
              className="px-0 py-2 text-sm font-bold data-[state=active]:text-foreground text-muted-foreground border-b-2 border-transparent data-[state=active]:border-orange-500 rounded-none bg-transparent gap-2"
            >
              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
              Flashcards
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-4">
             {spaces.length > 0 && (
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors border px-3 py-1.5 rounded-xl">
                      <Plus className="h-3.5 w-3.5" />
                      Save to Space
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-2xl border-gray-100 shadow-xl p-2 w-48">
                    {spaces.map(space => (
                      <DropdownMenuItem 
                        key={space.id} 
                        onClick={() => onAddToSpace?.(space.id)}
                        className="rounded-xl font-bold text-xs py-2.5 cursor-pointer"
                      >
                        {space.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
               </DropdownMenu>
             )}
             <button 
               onClick={() => setIsAutoScroll(!isAutoScroll)}
               className={cn(
                 "flex items-center gap-2 text-xs font-bold transition-colors border px-3 py-1.5 rounded-xl",
                 isAutoScroll ? "text-green-600 border-green-100 bg-green-50" : "text-muted-foreground hover:text-foreground"
               )}
             >
                <Eye className="h-3.5 w-3.5" />
                {isAutoScroll ? "Auto Scroll ON" : "Auto Scroll OFF"}
             </button>
             <button onClick={handleCopy} className="p-1.5 hover:bg-gray-100 rounded-lg border">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
             </button>
          </div>
        </div>

        {/* ─── CHAPTERS TAB ─── */}
        <TabsContent value="chapters" className="mt-0 outline-none space-y-12">
          {timestamps?.map((ts, i) => (
            <motion.div 
              key={i}
              ref={i === activeChapterIndex ? activeLineRef : null}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "group cursor-pointer p-4 -mx-4 rounded-3xl transition-all",
                i === activeChapterIndex ? "bg-green-50/50 border-l-4 border-green-500 shadow-sm" : "border-l-4 border-transparent"
              )}
              onClick={() => onTimestampClick && onTimestampClick(parseTimeToSeconds(ts.time))}
            >
              <span className={cn(
                "text-[11px] font-black mb-3 block transition-colors",
                i === activeChapterIndex ? "text-green-600" : "text-muted-foreground group-hover:text-foreground"
              )}>{ts.time}</span>
              <h3 className={cn(
                "text-xl font-bold mb-3 uppercase tracking-tight transition-colors",
                i === activeChapterIndex ? "text-green-700 font-black" : "group-hover:text-green-600"
              )}>{ts.label}</h3>
              <p className="text-muted-foreground leading-relaxed text-sm">
                {keyPoints[i] || overview.slice(0, 200)}
              </p>
            </motion.div>
          ))}

          {!timestamps?.length && (
            <div className="p-8 border-2 border-dashed rounded-3xl text-center text-muted-foreground">
               No chapters detected. The summary provides a full overview.
            </div>
          )}
        </TabsContent>

        {/* ─── TRANSCRIPTS TAB ─── */}
        <TabsContent value="transcripts" className="mt-0 outline-none">
          {transcript ? (
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
                        isActive ? "bg-green-50 text-green-700 font-bold shadow-sm" : "hover:bg-gray-50"
                      )}
                    >
                      <span className={cn(
                        "text-[10px] font-black mb-1 block",
                        isActive ? "text-green-600" : "text-muted-foreground group-hover:text-foreground"
                      )}>{match[1]}</span>
                      <p className="text-sm leading-relaxed">{match[2]}</p>
                    </div>
                  );
                }
                return <p key={i} className="text-foreground text-sm leading-relaxed">{line}</p>;
              })}
            </div>
          ) : (
            <div className="p-8 border-2 border-dashed rounded-3xl text-center text-muted-foreground">
               Transcript unavailable for this video.
            </div>
          )}
        </TabsContent>

        {/* ─── FLASHCARDS TAB ─── */}
        <TabsContent value="flashcards" className="mt-0 outline-none">
          {flashcards ? (
            <Flashcards cards={flashcards} />
          ) : (
            <div className="p-12 border-2 border-dashed rounded-[3rem] text-center bg-gray-50/30">
               <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">Study Cards Unavailable</p>
               <p className="text-sm font-bold mt-2">Try re-analyzing this video to generate interactive cards.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Other Sections (Roadmap, Quiz, etc.) */}
      {(roadmap || quiz || mindMap) && (
        <div className="mt-20 pt-12 border-t space-y-20">
           {roadmap && (
             <section id="roadmap">
                <div className="flex items-center gap-3 mb-8">
                   <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center">
                      <Rocket className="h-5 w-5 text-purple-600" />
                   </div>
                   <h3 className="text-2xl font-black uppercase tracking-tighter italic">Mastery Roadmap</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {roadmap.steps.map((step, i) => (
                     <div key={i} className="p-6 rounded-3xl border bg-white shadow-sm hover:shadow-md transition-all">
                        <span className="text-xs font-black text-purple-600 mb-2 block tracking-widest uppercase">Step {step.step}</span>
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
                   <h3 className="text-2xl font-black uppercase tracking-tighter italic">Evaluation Quiz</h3>
                </div>
                <QuizTab quiz={quiz} />
             </section>
           )}

           {mindMap && mindMap.nodes && mindMap.nodes.length > 0 && (
              <section id="mindmap">
                 <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
                       <Map className="h-5 w-5 text-blue-500" />
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter italic">Mind Map</h3>
                 </div>
                 <MindMapTab mindMap={mindMap} />
              </section>
            )}
        </div>
      )}
    </motion.div>
  );
};

export default SummaryDisplay;
