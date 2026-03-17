import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, ChevronRight, Brain, RotateCcw, Trophy, ArrowRight, Lightbulb, Baby, Footprints, HelpCircle, Send, Mic, Keyboard, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

interface QuizTabProps {
  quiz: QuizQuestion[];
  onAIAction?: (action: string, context: string) => void;
  onGenerateMore?: () => void;
  isGenerating?: boolean;
  quizAIExplanation?: string | null;
  onClearExplanation?: () => void;
}

const QuizTab = ({ 
  quiz: initialQuiz, 
  onAIAction, 
  onGenerateMore, 
  isGenerating,
  quizAIExplanation,
  onClearExplanation
}: QuizTabProps) => {
  const [quiz, setQuiz] = useState(initialQuiz);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [lastCount, setLastCount] = useState(initialQuiz.length);
  const [showAdditionBadge, setShowAdditionBadge] = useState(false);

  useEffect(() => {
    if (initialQuiz.length > lastCount) {
      setShowAdditionBadge(true);
      setTimeout(() => setShowAdditionBadge(false), 3000);
      setLastCount(initialQuiz.length);
    }
    setQuiz(initialQuiz);
    onClearExplanation?.();
  }, [initialQuiz, lastCount, onClearExplanation]);

  useEffect(() => {
    onClearExplanation?.();
  }, [current, onClearExplanation]);

  const handleSelect = useCallback((idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    const isCorrect = idx === quiz[current].answer;
    if (isCorrect) setScore(s => s + 1);
    const newAnswers = [...answers, idx];
    setAnswers(newAnswers);
  }, [selected, current, quiz, answers]);

  const handleNext = useCallback(() => {
    if (current + 1 >= quiz.length) {
      setFinished(true);
    } else {
      setCurrent(c => c + 1);
      setSelected(null);
    }
  }, [current, quiz.length]);

  const handleRestart = useCallback(() => {
    setCurrent(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
    setAnswers([]);
    onClearExplanation?.();
  }, [onClearExplanation]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName);
      if (isInput) return;

      if (finished) {
        if (e.key.toLowerCase() === 'r') handleRestart();
        return;
      }

      // Selection shortcuts 1-4
      if (selected === null && e.key >= '1' && e.key <= (Math.min(quiz[current].options.length, 4).toString())) {
        handleSelect(parseInt(e.key) - 1);
        return;
      }

      switch(e.key.toLowerCase()) {
        case 'enter':
          if (selected !== null) handleNext();
          break;
        case 'h':
          onAIAction?.('quiz_hint', quiz[current].question);
          break;
        case 'e':
        case 'w':
          onAIAction?.('quiz_explain', quiz[current].question);
          break;
        case 'r':
          handleRestart();
          break;
        case 'k':
          setShowShortcuts(prev => !prev);
          break;
        case 'g':
        case '+':
          if (!isGenerating) onGenerateMore?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [current, selected, finished, quiz, isGenerating, onAIAction, onGenerateMore, handleNext, handleRestart, handleSelect]);

  if (!quiz || quiz.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Brain className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="font-semibold">No quiz generated</p>
        <p className="text-xs mt-1">Try using "Educational Deep-Dive" mode.</p>
      </div>
    );
  }

  const pct = Math.round((score / quiz.length) * 100);

  if (finished) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl p-10 text-center border shadow-sm border-gray-100">
        <Trophy className={`h-16 w-16 mx-auto ${pct >= 70 ? "text-yellow-400" : "text-gray-300"}`} />
        <div className="space-y-4">
          <h3 className="text-2xl font-bold text-foreground mt-4">
            {pct >= 90 ? "Outstanding!" : pct >= 70 ? "Well Done!" : "Keep Learning!"}
          </h3>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Score Achieved</p>
          <div className="text-6xl font-bold text-foreground my-6">{score}<span className="text-2xl text-muted-foreground font-medium">/{quiz.length}</span></div>
          <div className="w-full h-3 bg-gray-50 rounded-full overflow-hidden border">
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: "easeOut" }} className={`h-full rounded-full ${pct >= 70 ? "bg-green-500" : "bg-orange-500"}`} />
          </div>
          <p className="text-xs font-medium text-muted-foreground">{pct}% accuracy</p>
        </div>
        <div className="mt-10 flex flex-col gap-3 max-w-[280px] mx-auto">
          <Button onClick={handleRestart} className="h-14 rounded-2xl bg-black text-white font-bold gap-2">
            <RotateCcw className="h-4 w-4" /> Try Again
          </Button>
          <Button 
            variant="outline"
            disabled={isGenerating}
            onClick={onGenerateMore}
            className="h-14 rounded-2xl border-gray-200 font-bold gap-2 hover:bg-gray-50 transition-all"
          >
            {isGenerating ? (
              <div className="w-4 h-4 border-2 border-gray-300 border-t-black animate-spin rounded-full" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Generate 5 More
          </Button>
        </div>
      </motion.div>
    );
  }

  const q = quiz[current];

  return (
    <motion.div key={current} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border-4 border-black border-r-transparent flex items-center justify-center">
                <span className="text-[10px] font-black">{Math.round(((current) / quiz.length) * 100)}%</span>
            </div>
            <div>
                <h3 className="text-xs font-bold">Quiz Progress</h3>
                <div className="flex items-center gap-1.5 overflow-hidden">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter shrink-0">{quiz.length} Total Questions</p>
                    <AnimatePresence>
                    {showAdditionBadge && (
                        <motion.span 
                        initial={{ x: -10, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 10, opacity: 0 }}
                        className="text-[8px] font-black bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-md uppercase shrink-0 whitespace-nowrap"
                        >
                        +{quiz.length - lastCount} New Added
                        </motion.span>
                    )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
        <div className="flex items-center gap-1.5">
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowShortcuts(!showShortcuts)}
                className={cn(
                    "h-8 px-2 rounded-lg bg-gray-50 border border-gray-100 transition-colors",
                    showShortcuts && "bg-black text-white"
                )}
            >
                <Keyboard className="h-3.5 w-3.5" />
            </Button>
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleRestart}
                className="h-8 w-8 p-0 rounded-lg bg-gray-50 border border-gray-100"
            >
                <RotateCcw className="h-3.5 w-3.5 text-gray-500" />
            </Button>
            <Button 
                variant="ghost" 
                size="sm" 
                disabled={isGenerating}
                onClick={() => onGenerateMore?.()}
                className="h-8 px-3 rounded-lg bg-black text-white text-[10px] font-bold gap-1.5"
            >
                {isGenerating ? (
                    <div className="w-2.5 h-2.5 border border-white/30 border-t-white animate-spin rounded-full" />
                ) : (
                    <Plus className="h-3 w-3" />
                )}
                More
            </Button>
        </div>
      </div>

      <AnimatePresence>
        {showShortcuts && (
            <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
            >
            <div className="p-4 bg-black rounded-[2rem] border border-white/10 grid grid-cols-2 gap-x-6 gap-y-2 mt-2">
                {[
                    { k: "1-4", l: "Select Option" },
                    { k: "Enter", l: "Next Question" },
                    { k: "H", l: "Hint" },
                    { k: "E", l: "Explain" },
                    { k: "W", l: "Walkthrough" },
                    { k: "R", l: "Reset Quiz" },
                    { k: "G / +", l: "Add Questions" },
                    { k: "K", l: "Shortcuts" }
                ].map(s => (
                    <div key={s.l} className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">{s.l}</span>
                    <code className="text-[10px] font-black bg-white/10 px-1.5 py-0.5 rounded-md text-white">{s.k}</code>
                    </div>
                ))}
            </div>
            </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-4">
        <div className="flex-1 h-1.5 bg-gray-50 rounded-full overflow-hidden border">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${((current + 1) / quiz.length) * 100}%` }}
            className="h-full bg-green-500 rounded-full transition-all duration-500" 
          />
        </div>
        <span className="text-[10px] font-medium text-muted-foreground shrink-0">{current + 1} / {quiz.length}</span>
      </div>

      {/* Question */}
      <div className="py-2 space-y-4">
        <h3 className="text-xl font-bold text-foreground leading-tight">{q.question}</h3>
        
        {/* AI Assistance Buttons */}
        <div className="flex flex-wrap gap-2">
           <Button 
             variant="outline" 
             size="sm" 
             onClick={() => onAIAction?.('quiz_hint', q.question)}
             className="h-8 rounded-full text-[10px] font-bold gap-1.5 border-indigo-100 bg-indigo-50/30 text-indigo-600 hover:bg-indigo-50"
           >
             <Lightbulb className="h-3 w-3" /> Hint
           </Button>
           <Button 
             variant="outline" 
             size="sm" 
             onClick={() => onAIAction?.('quiz_explain', q.question)}
             className="h-8 rounded-full text-[10px] font-bold gap-1.5 border-purple-100 bg-purple-50/30 text-purple-600 hover:bg-purple-50"
           >
             <Baby className="h-3 w-3" /> Explain like I'm 5
           </Button>
           <Button 
             variant="outline" 
             size="sm" 
             onClick={() => onAIAction?.('quiz_explain', `Walk me through this question: ${q.question}`)}
             className="h-8 rounded-full text-[10px] font-bold gap-1.5 border-emerald-100 bg-emerald-50/30 text-emerald-600 hover:bg-emerald-50"
           >
             <Footprints className="h-3 w-3" /> Walk me through it
           </Button>
        </div>

        <AnimatePresence>
          {quizAIExplanation && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 p-5 bg-black rounded-[2.5rem] border border-white/10 relative overflow-hidden group"
            >
               <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-50" />
               <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3 bg-white/10 w-fit px-3 py-1 rounded-full border border-white/10">
                    <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-amber-100">Genius Breakdown</span>
                  </div>
                  <div className="prose prose-invert prose-xs max-w-none">
                    <p className="text-[12px] font-medium leading-relaxed text-gray-200">
                      {quizAIExplanation}
                    </p>
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Options */}
      <div className="grid gap-4" role="radiogroup" aria-label="Quiz options">
        {q.options.map((opt, i) => {
          let variant = "bg-white border-gray-100 text-muted-foreground hover:bg-gray-50 hover:border-gray-200";
          if (selected !== null) {
            if (i === q.answer) variant = "bg-green-50 border-green-200 text-green-700 shadow-sm";
            else if (i === selected && i !== q.answer) variant = "bg-red-50 border-red-200 text-red-700 shadow-sm";
            else variant = "bg-white border-gray-50 text-gray-300 opacity-60";
          }
          return (
            <motion.button 
              key={i} 
              whileHover={selected === null ? { x: 4 } : {}} 
              onClick={() => handleSelect(i)} 
              role="radio"
              aria-checked={selected === i}
              aria-label={`Option ${String.fromCharCode(65 + i)}: ${opt}`}
              className={`w-full text-left flex items-center gap-5 p-5 rounded-3xl border transition-all duration-300 font-bold ${variant}`}
            >
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 font-bold text-sm border shadow-sm transition-colors ${selected !== null && i === q.answer ? "bg-green-600 border-green-600 text-white" : selected !== null && i === selected ? "bg-red-600 border-red-600 text-white" : "bg-white border-gray-100 text-gray-900"}`}>
                {String.fromCharCode(65 + i)}
              </div>
              <span className="text-base leading-relaxed">{opt}</span>
              {selected !== null && i === q.answer && <Check className="h-5 w-5 ml-auto text-green-600" />}
              {selected !== null && i === selected && i !== q.answer && <X className="h-5 w-5 ml-auto text-red-600" />}
            </motion.button>
          );
        })}
        
        {selected === null && (
          <button 
            onClick={() => setSelected(-1)}
            className="w-full text-center py-4 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors border border-dashed border-gray-100 rounded-2xl"
          >
            I don't know the answer
          </button>
        )}
      </div>

      {/* Explanation */}
      <AnimatePresence>
        {selected !== null && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`p-6 rounded-3xl border ${selected === q.answer ? "border-green-100 bg-green-50/50" : "border-orange-100 bg-orange-50/50"}`}>
            <p className="text-sm leading-relaxed text-gray-700">
               <span className="text-[10px] font-semibold uppercase tracking-wider block mb-2 text-muted-foreground">Detailed Explanation</span>
               {q.explanation}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {selected !== null && (
        <div className="flex justify-end pt-4">
          <Button variant="default" onClick={handleNext} className="gap-2 h-14 px-10 rounded-2xl font-semibold text-white bg-gray-900 hover:bg-black transition-all">
            {current + 1 >= quiz.length ? "Finish Quiz" : "Next Challenge"}
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Integrated Chat for Quiz */}
      <div className="mt-8 pt-6 border-t border-gray-50">
        <div className="relative group">
          <textarea 
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (chatInput.trim()) {
                  onAIAction?.('custom', chatInput.trim());
                  setChatInput("");
                }
              }
            }}
            placeholder="Ask about this question..."
            className="w-full h-12 bg-gray-50/50 border border-gray-100 rounded-2xl pl-5 pr-14 py-3.5 text-xs font-medium focus:outline-none focus:bg-white focus:border-gray-200 focus:ring-4 focus:ring-black/5 transition-all scrollbar-none resize-none"
          />
          <button 
            onClick={() => {
              if (chatInput.trim()) {
                onAIAction?.('custom', chatInput.trim());
                setChatInput("");
              }
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black text-white rounded-xl shadow-lg shadow-black/10 hover:scale-105 transition-all"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default QuizTab;
