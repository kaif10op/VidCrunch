import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Check, ChevronRight, Brain, RotateCcw, 
  Rocket, Star, ArrowRight, Lightbulb, 
  Footprints, Send, Keyboard, Plus, 
  Target, Clock, Sparkles, HelpCircle,
  History as HistoryIcon 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RichMessage } from "@/components/RichMessage";

interface RoadmapStep {
  step: number;
  task: string;
  description: string;
}

interface RoadmapTabProps {
  roadmap: {
    title: string;
    steps: RoadmapStep[];
  };
  onAIAction?: (action: string, context: string) => void;
  onGenerateMore?: () => void;
  isGenerating?: boolean;
  roadmapAIExplanation?: string | null;
  onClearExplanation?: () => void;
}

const RoadmapTab = ({ 
  roadmap: initialRoadmap, 
  onAIAction, 
  onGenerateMore, 
  isGenerating,
  roadmapAIExplanation,
  onClearExplanation
}: RoadmapTabProps) => {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [roadmap, setRoadmap] = useState(initialRoadmap);
  const [lastCount, setLastCount] = useState(initialRoadmap.steps.length);
  const [showAdditionBadge, setShowAdditionBadge] = useState(false);

  useEffect(() => {
    if (initialRoadmap.steps.length > lastCount) {
      setShowAdditionBadge(true);
      setTimeout(() => setShowAdditionBadge(false), 3000);
      setLastCount(initialRoadmap.steps.length);
    }
    setRoadmap(initialRoadmap);
    onClearExplanation?.();
  }, [initialRoadmap, lastCount, onClearExplanation]);

  useEffect(() => {
    onClearExplanation?.();
  }, [activeStep, onClearExplanation]);

  const toggleStep = (stepIdx: number) => {
    setCompletedSteps(prev => 
      prev.includes(stepIdx) ? prev.filter(i => i !== stepIdx) : [...prev, stepIdx]
    );
  };

  const handleNext = useCallback(() => {
    if (activeStep < roadmap.steps.length - 1) {
      setActiveStep(activeStep + 1);
    }
  }, [activeStep, roadmap.steps.length]);

  const handlePrev = useCallback(() => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  }, [activeStep]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName);
      if (isInput) return;

      // Milestone selection 1-9
      if (e.key >= '1' && e.key <= (Math.min(roadmap.steps.length, 9).toString())) {
        setActiveStep(parseInt(e.key) - 1);
        return;
      }

      switch(e.key.toLowerCase()) {
        case 'arrowright':
        case 'n':
          handleNext();
          break;
        case 'arrowleft':
        case 'p':
          handlePrev();
          break;
        case 'e':
          onAIAction?.('roadmap_explain', roadmap.steps[activeStep].task);
          break;
        case 'g':
        case '+':
          if (!isGenerating) onGenerateMore?.();
          break;
        case 'k':
          setShowShortcuts(prev => !prev);
          break;
        case ' ':
          e.preventDefault();
          toggleStep(activeStep);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeStep, roadmap, isGenerating, onAIAction, onGenerateMore, handleNext, handlePrev]);

  if (!roadmap || roadmap.steps.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Rocket className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="font-semibold">No Roadmap found</p>
      </div>
    );
  }

  const currentStep = roadmap.steps[activeStep];
  const progress = Math.round((completedSteps.length / roadmap.steps.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header & Progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center shadow-xl shadow-black/10">
            <Rocket className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight">{roadmap.title || "Mastery Path"}</h3>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{roadmap.steps.length} Milestones</p>
              <AnimatePresence>
                {showAdditionBadge && (
                  <motion.span 
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="text-[8px] font-black bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-md uppercase"
                  >
                    +Added
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowShortcuts(!showShortcuts)}
            className={cn("h-8 px-2 rounded-lg bg-gray-50 border border-gray-100", showShortcuts && "bg-black text-white")}
          >
            <Keyboard className="h-3.5 w-3.5" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            disabled={isGenerating}
            onClick={onGenerateMore}
            className="h-8 px-3 rounded-lg bg-black text-white text-[10px] font-bold gap-1.5"
          >
            {isGenerating ? <div className="w-2.5 h-2.5 border border-white/30 border-t-white animate-spin rounded-full" /> : <Plus className="h-3 w-3" />}
            More
          </Button>
        </div>
      </div>

      {/* Shortcuts Legend */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="p-4 bg-black rounded-3xl border border-white/10 grid grid-cols-2 gap-3">
              {[
                { k: "1-9", l: "Go to Step" },
                { k: "N / →", l: "Next Step" },
                { k: "P / ←", l: "Prev Step" },
                { k: "Space", l: "Toggle Check" },
                { k: "E", l: "Explain" },
                { k: "G / +", l: "Add Steps" },
              ].map(s => (
                <div key={s.l} className="flex items-center justify-between">
                  <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">{s.l}</span>
                  <code className="text-[10px] font-black bg-white/10 px-1.5 py-0.5 rounded-md text-white">{s.k}</code>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
          <span>Mastery Status</span>
          <span>{progress}% Complete</span>
        </div>
        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden border">
          <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-emerald-500 rounded-full" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 gap-6">
        {/* Milestone Cards Scroll */}
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-none snap-x">
          {roadmap.steps.map((step, i) => (
            <button
              key={i}
              onClick={() => setActiveStep(i)}
              className={cn(
                "min-w-[140px] snap-center p-4 rounded-3xl border-2 transition-all text-left group relative overflow-hidden",
                activeStep === i ? "bg-black border-black text-white shadow-xl shadow-black/10" : "bg-white border-gray-100 text-gray-400 hover:border-black/20"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={cn("text-[10px] font-black uppercase tracking-tight", activeStep === i ? "text-gray-400" : "text-gray-300")}>Step {step.step}</span>
                {completedSteps.includes(i) && <Check className={cn("h-3 w-3", activeStep === i ? "text-emerald-400" : "text-emerald-500")} />}
              </div>
              <p className="text-xs font-bold leading-tight line-clamp-2">{step.task}</p>
            </button>
          ))}
        </div>

        {/* Active Step Details */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-gray-50/50 rounded-[2.5rem] border border-gray-100 p-8 space-y-6"
          >
            <div className="space-y-3">
               <div className="flex items-center gap-3">
                  <div className="px-3 py-1 rounded-full bg-white border border-gray-100 text-[10px] font-black text-black shadow-sm">
                    {activeStep + 1} of {roadmap.steps.length}
                  </div>
                  {completedSteps.includes(activeStep) && (
                    <div className="flex items-center gap-1.5 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                      <Check className="h-3.5 w-3.5" /> Milestone Reached
                    </div>
                  )}
               </div>
               <h3 className="text-2xl font-black text-black leading-tight">{currentStep.task}</h3>
               <p className="text-sm font-medium text-gray-600 leading-relaxed">{currentStep.description}</p>
            </div>

            <div className="flex flex-wrap gap-3">
               <Button 
                onClick={() => toggleStep(activeStep)}
                className={cn(
                  "h-12 px-6 rounded-2xl font-bold transition-all shadow-lg active:scale-95",
                  completedSteps.includes(activeStep) ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-black text-white hover:bg-gray-800"
                )}
               >
                 {completedSteps.includes(activeStep) ? "Completed" : "Mark as Done"}
               </Button>
               <Button 
                variant="outline"
                onClick={() => onAIAction?.('roadmap_explain', `Help me understand this milestone: ${currentStep.task}. Description: ${currentStep.description}`)}
                className="h-12 px-6 rounded-2xl border-gray-200 bg-white font-bold gap-2 text-indigo-600 hover:bg-indigo-50"
               >
                 <span className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Explain This</span>
               </Button>
            </div>

            {/* AI Breakdown for Roadmap */}
            <AnimatePresence>
              {roadmapAIExplanation && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 p-6 bg-black rounded-[2rem] border border-white/10 relative overflow-hidden">
                  <div className="relative z-10 space-y-3">
                    <div className="flex items-center gap-2">
                       <Sparkles className="h-3 w-3 text-amber-400" />
                       <span className="text-[8px] font-black uppercase tracking-widest text-amber-100">Milestone Deep-Dive</span>
                    </div>
                    <div className="prose prose-invert prose-xs max-w-none">
                       <RichMessage 
                        content={roadmapAIExplanation} 
                        role="assistant" 
                        className="text-gray-200" 
                       />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-50">
        <div className="flex items-center gap-2 text-gray-400 text-[10px] font-black uppercase tracking-widest">
           <HistoryIcon className="h-3 w-3" /> Step {activeStep + 1} Details
        </div>
        <div className="flex items-center gap-3">
           <Button variant="ghost" size="sm" onClick={handlePrev} disabled={activeStep === 0} className="h-10 w-10 p-0 rounded-xl bg-gray-50 border border-gray-100 disabled:opacity-30">
             <ChevronRight className="h-4 w-4 rotate-180" />
           </Button>
           <Button variant="ghost" size="sm" onClick={handleNext} disabled={activeStep === roadmap.steps.length - 1} className="h-10 w-10 p-0 rounded-xl bg-gray-50 border border-gray-100 disabled:opacity-30">
             <ChevronRight className="h-4 w-4" />
           </Button>
        </div>
      </div>
    </div>
  );
};

export default RoadmapTab;
