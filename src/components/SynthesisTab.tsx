import { motion } from "framer-motion";
import { useEffect } from "react";
import { Brain, Lightbulb, Target, Rocket, Clock, Plus, Sparkles, X } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { RichMessage } from "./RichMessage";
import { AnimatePresence } from "framer-motion";

interface Timestamp {
  time: string;
  label: string;
}

interface LearningContext {
  why: string;
  whatToHowTo: string;
  bestWay: string;
}

interface SynthesisTabProps {
  overview?: string;
  keyPoints?: string[];
  takeaways?: string[];
  tags?: string[];
  learningContext?: LearningContext;
  onGenerate: (toolId: string) => void;
  onTimestampClick?: (seconds: number) => void;
  timestamps?: Timestamp[];
  isGenerating?: boolean;
  aiExplanation?: string | null;
  onClearExplanation?: () => void;
  onAIAction?: (toolId: string, value: string, context: string) => void;
}

function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

export default function SynthesisTab({
  overview,
  keyPoints = [],
  takeaways = [],
  tags = [],
  learningContext,
  onGenerate,
  onTimestampClick,
  timestamps = [],
  isGenerating = false,
  aiExplanation,
  onClearExplanation,
  onAIAction
}: SynthesisTabProps) {
  useEffect(() => {
    onClearExplanation?.();
  }, [overview, keyPoints, takeaways, onClearExplanation]);

  return (
    <div className="space-y-10 py-4 pb-32">
      {/* Overview Section */}
      <div className="space-y-4">
        {overview ? (
          <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm group">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                    <Brain className="h-3.5 w-3.5" /> Executive Overview
                </h3>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 rounded-xl font-bold gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600 hover:bg-indigo-50"
                    onClick={() => onAIAction?.('summary', `Deep dive into the overview: ${overview}`, `[Overview Context]: ${overview}`)}
                >
                    <Sparkles className="h-3 w-3" /> Explain
                </Button>
            </div>
            <p className="text-sm font-bold text-gray-700 leading-relaxed">{overview}</p>
          </div>
        ) : (
          <div className="bg-gray-50/50 rounded-3xl border border-dashed border-gray-200 p-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center border border-gray-100 shadow-sm">
              <Brain className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-gray-900">AI Synthesis</h3>
              <p className="text-[10px] text-gray-400 font-medium">Get a high-level overview of this video</p>
            </div>
            <Button 
              onClick={() => onGenerate("overview")}
              disabled={isGenerating}
              className="h-9 rounded-xl font-bold bg-black text-white hover:bg-gray-800 transition-all text-xs"
            >
              <Rocket className="h-3.5 w-3.5 mr-2" /> 
              {isGenerating ? "Synthesizing..." : "Synthesize Overview"}
            </Button>
          </div>
        )}

        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, i) => (
              <span key={i} className="text-[9px] font-black uppercase tracking-widest bg-gray-50 text-gray-400 px-3 py-1.5 rounded-xl border border-gray-100">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Key Insights */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">Key Insights</h3>
        {keyPoints.length > 0 ? (
          <div className="grid gap-3">
            {keyPoints.map((point, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm group hover:border-amber-200 transition-all">
                <div className="flex items-start gap-4">
                    <span className="w-6 h-6 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 text-[10px] font-black text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-all">
                    {i + 1}
                    </span>
                    <div className="flex-1 space-y-3">
                        <p className="text-xs font-bold text-gray-700 leading-relaxed">{point}</p>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 px-2 rounded-lg font-bold gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-amber-600 hover:bg-amber-50 text-[10px]"
                            onClick={() => onAIAction?.('summary', `Help me understand this insight: ${point}`, `[Point Context]: ${point}`)}
                        >
                            <Sparkles className="h-2.5 w-2.5" /> Deep Dive
                        </Button>
                    </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50/50 rounded-3xl border border-dashed border-gray-200 p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center border border-gray-100 shadow-sm">
                <Lightbulb className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-900">Major Takeaways</h4>
                <p className="text-[8px] text-gray-400 font-medium uppercase tracking-tighter">Missing Data</p>
              </div>
            </div>
            <Button 
              onClick={() => onGenerate("key_points")}
              disabled={isGenerating}
              size="sm"
              className="h-8 rounded-lg font-bold bg-amber-500 text-white hover:bg-amber-600 text-[10px]"
            >
              Generate
            </Button>
          </div>
        )}
      </div>

      {/* Action Items */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">Action Items</h3>
        {takeaways.length > 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm">
            {takeaways.map((item, i) => (
              <div key={i} className="flex items-start gap-3 group">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 group-hover:scale-125 transition-transform" />
                <div className="flex-1 space-y-2">
                    <p className="text-xs font-bold text-gray-600 leading-relaxed">{item}</p>
                    <button 
                        onClick={() => onAIAction?.('summary', `How do I implement this: ${item}`, `[Action Item Context]: ${item}`)}
                        className="text-[9px] font-black text-blue-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity hover:text-blue-700"
                    >
                        Learn How →
                    </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50/50 rounded-3xl border border-dashed border-gray-200 p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center border border-gray-100 shadow-sm">
                <Target className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-900">Implementation</h4>
                <p className="text-[8px] text-gray-400 font-medium uppercase tracking-tighter">Ready to Extract</p>
              </div>
            </div>
            <Button 
              onClick={() => onGenerate("takeaways")}
              disabled={isGenerating}
              size="sm"
              className="h-8 rounded-lg font-bold bg-blue-500 text-white hover:bg-blue-600 text-[10px]"
            >
              Extract
            </Button>
          </div>
        )}
      </div>

      {/* Optimized Learning Context specifically for sidebar strategy */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">Knowledge Strategy</h3>
        {learningContext && (learningContext.why || learningContext.whatToHowTo || learningContext.bestWay) ? (
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 space-y-6">
            {[
              { label: "The Why", icon: <Target className="h-3 w-3 text-blue-500" />, value: learningContext.why },
              { label: "The How", icon: <Rocket className="h-3 w-3 text-purple-500" />, value: learningContext.whatToHowTo },
              { label: "The Path", icon: <Brain className="h-3 w-3 text-green-500" />, value: learningContext.bestWay },
            ].filter(i => i.value).map((item, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center gap-2">
                    {item.icon}
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.label}</h4>
                </div>
                <p className="text-xs font-bold text-gray-600 leading-relaxed">{item.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 p-6 flex flex-col items-center gap-3 text-center">
            <h4 className="text-xs font-bold text-gray-400">Deep strategy analysis needed</h4>
            <Button 
              onClick={() => onGenerate("learning_context")}
              disabled={isGenerating}
              size="sm"
              className="h-8 rounded-lg font-bold bg-black text-white hover:bg-gray-800 text-[10px]"
            >
              Analyze Path
            </Button>
          </div>
        )}
      </div>

      {/* AI Breakdown Area for Sidebar */}
      <AnimatePresence>
        {aiExplanation && (
            <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }} 
                exit={{ opacity: 0, height: 0 }}
                className="bg-black rounded-[2rem] p-6 border border-white/10 overflow-hidden relative shadow-2xl"
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-3 w-3 text-amber-400" />
                        <span className="text-[10px] font-black text-amber-100 uppercase tracking-widest">AI Breakdown</span>
                    </div>
                    <button onClick={onClearExplanation} className="text-white/40 hover:text-white transition-colors">
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
                <div className="prose prose-invert prose-sm max-w-none">
                    <RichMessage content={aiExplanation} role="assistant" className="text-gray-300" />
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
