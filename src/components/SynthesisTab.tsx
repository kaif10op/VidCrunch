import { motion } from "framer-motion";
import { Brain, Lightbulb, Target, Rocket, Clock, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

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
  isGenerating = false
}: SynthesisTabProps) {
  return (
    <div className="space-y-10 py-4">
      {/* Overview Section */}
      <div className="space-y-4">
        {overview ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Brain className="h-3 w-3" /> Overview
            </h3>
            <p className="text-sm font-medium text-gray-600 leading-relaxed">{overview}</p>
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
          <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
            {keyPoints.map((point, i) => (
              <div key={i} className="flex items-start gap-3 group">
                <span className="w-5 h-5 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-black text-gray-400 group-hover:bg-black group-hover:text-white transition-all">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-600 leading-relaxed">{point}</p>
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
          <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
            {takeaways.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-2 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                <p className="text-xs font-semibold text-gray-600 leading-relaxed">{item}</p>
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

      {/* Strategic Context */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">Strategy</h3>
        {learningContext && (learningContext.why || learningContext.whatToHowTo || learningContext.bestWay) ? (
          <div className="bg-black rounded-3xl p-6 space-y-6 shadow-xl border border-white/5">
            {[
              { label: "Purpose", value: learningContext.why },
              { label: "Application", value: learningContext.whatToHowTo },
              { label: "Method", value: learningContext.bestWay },
            ].filter(i => i.value).map((item, i) => (
              <div key={i} className="space-y-1">
                <h4 className="text-[8px] font-black text-white/30 uppercase tracking-widest">{item.label}</h4>
                <p className="text-[11px] font-medium text-white/70 leading-relaxed">{item.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-900 rounded-3xl p-6 flex items-center justify-between shadow-xl border border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                <Brain className="h-4 w-4 text-white/40" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Strategic Context</h4>
                <p className="text-[9px] text-white/30 font-medium uppercase tracking-tighter">Learning Path Analysis</p>
              </div>
            </div>
            <Button 
              onClick={() => onGenerate("learning_context")}
              disabled={isGenerating}
              size="sm"
              className="h-8 rounded-lg font-bold bg-white text-black hover:bg-gray-100 text-[10px]"
            >
              Analyze
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
