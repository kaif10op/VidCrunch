import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, ChevronRight, Brain, RotateCcw, Trophy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

interface QuizTabProps {
  quiz: QuizQuestion[];
}

const QuizTab = ({ quiz }: QuizTabProps) => {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>([]);

  const handleSelect = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    const isCorrect = idx === quiz[current].answer;
    if (isCorrect) setScore(s => s + 1);
    const newAnswers = [...answers, idx];
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (current + 1 >= quiz.length) {
      setFinished(true);
    } else {
      setCurrent(c => c + 1);
      setSelected(null);
    }
  };

  const handleRestart = () => {
    setCurrent(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
    setAnswers([]);
  };

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
          <h3 className="text-3xl font-black text-foreground uppercase tracking-tight italic">
            {pct >= 90 ? "Outstanding!" : pct >= 70 ? "Well Done!" : "Keep Learning!"}
          </h3>
          <p className="text-muted-foreground font-bold tracking-widest uppercase text-[10px]">Score Achieved</p>
          <div className="text-7xl font-black text-foreground my-6">{score}<span className="text-2xl text-muted-foreground font-medium">/{quiz.length}</span></div>
          <div className="w-full h-3 bg-gray-50 rounded-full overflow-hidden border">
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: "easeOut" }} className={`h-full rounded-full ${pct >= 70 ? "bg-green-500" : "bg-orange-500"}`} />
          </div>
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">{pct}% accuracy</p>
        </div>
        <div className="mt-10">
          <Button variant="outline" onClick={handleRestart} className="gap-2 h-12 px-8 rounded-2xl font-bold border-gray-200">
            <RotateCcw className="h-4 w-4" /> Try Again
          </Button>
        </div>
      </motion.div>
    );
  }

  const q = quiz[current];

  return (
    <motion.div key={current} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-8">
      {/* Progress bar */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-1.5 bg-gray-50 rounded-full overflow-hidden border">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${((current + 1) / quiz.length) * 100}%` }}
            className="h-full bg-green-500 rounded-full transition-all duration-500" 
          />
        </div>
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest shrink-0">{current + 1} / {quiz.length}</span>
      </div>

      {/* Question */}
      <div className="py-2">
        <h3 className="text-2xl font-black text-foreground uppercase tracking-tight italic leading-tight">{q.question}</h3>
      </div>

      {/* Options */}
      <div className="grid gap-4">
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
              className={`w-full text-left flex items-center gap-5 p-5 rounded-3xl border transition-all duration-300 font-bold ${variant}`}
            >
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 font-black text-sm border shadow-sm transition-colors ${selected !== null && i === q.answer ? "bg-green-600 border-green-600 text-white" : selected !== null && i === selected ? "bg-red-600 border-red-600 text-white" : "bg-white border-gray-100 text-gray-900"}`}>
                {String.fromCharCode(65 + i)}
              </div>
              <span className="text-base leading-relaxed">{opt}</span>
              {selected !== null && i === q.answer && <Check className="h-5 w-5 ml-auto text-green-600" />}
              {selected !== null && i === selected && i !== q.answer && <X className="h-5 w-5 ml-auto text-red-600" />}
            </motion.button>
          );
        })}
      </div>

      {/* Explanation */}
      <AnimatePresence>
        {selected !== null && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`p-6 rounded-3xl border ${selected === q.answer ? "border-green-100 bg-green-50/50" : "border-orange-100 bg-orange-50/50"}`}>
            <p className="text-sm leading-relaxed text-gray-700">
               <span className="text-[10px] font-black uppercase tracking-widest block mb-2 text-muted-foreground">Detailed Explanation</span>
               {q.explanation}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {selected !== null && (
        <div className="flex justify-end pt-4">
          <Button variant="default" onClick={handleNext} className="gap-2 h-14 px-10 rounded-2xl font-black uppercase tracking-tight text-white bg-gray-900 hover:bg-black transition-all">
            {current + 1 >= quiz.length ? "Finish Quiz" : "Next Challenge"}
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      )}
    </motion.div>
  );
};

export default QuizTab;
