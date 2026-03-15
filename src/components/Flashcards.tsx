import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw, 
  CheckCircle2, 
  Circle,
  Trophy,
  Brain
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

interface Flashcard {
  front: string;
  back: string;
}

interface FlashcardsProps {
  cards: Flashcard[];
}

const Flashcards = ({ cards }: FlashcardsProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [mastered, setMastered] = useState<number[]>([]);

  if (!cards || cards.length === 0) return null;

  const currentCard = cards[currentIndex];
  const progress = ((currentIndex + 1) / cards.length) * 100;

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % cards.length);
    }, 150);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
    }, 150);
  };

  const toggleMastery = () => {
    if (mastered.includes(currentIndex)) {
      setMastered(mastered.filter(i => i !== currentIndex));
    } else {
      setMastered([...mastered, currentIndex]);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4 flex flex-col items-center">
      <div className="w-full flex items-center justify-between mb-8">
         <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black rounded-2xl shadow-lg rotate-3 group-hover:rotate-0 transition-all">
               <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
               <h3 className="text-xl font-black italic uppercase tracking-tighter">Study Cards</h3>
               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
                  {mastered.length} of {cards.length} Mastered
               </p>
            </div>
         </div>
         <div className="flex items-center gap-1.5 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
            <Button 
               variant="ghost" 
               size="sm" 
               onClick={() => {setCurrentIndex(0); setIsFlipped(false); setMastered([]);}}
               className="h-8 w-8 p-0 rounded-xl hover:bg-white transition-all"
            >
               <RotateCcw className="h-4 w-4 text-gray-400" />
            </Button>
         </div>
      </div>

      <div className="w-full h-80 perspective-1000 group relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 200 }}
            className="w-full h-full"
          >
            <div 
              className={cn(
                "relative w-full h-full transition-all duration-700 preserve-3d cursor-pointer active:scale-95",
                isFlipped && "rotate-y-180"
              )}
              onClick={() => setIsFlipped(!isFlipped)}
            >
              {/* Front */}
              <div className="absolute inset-0 w-full h-full backface-hidden p-8 flex flex-col items-center justify-center bg-white border-2 border-gray-100 rounded-[3rem] shadow-2xl hover:border-black/5 transition-colors">
                <span className="absolute top-8 left-8 text-[10px] font-black uppercase tracking-widest text-gray-300">Question</span>
                <p className="text-xl font-bold text-center leading-relaxed">
                  {currentCard.front}
                </p>
                <span className="absolute bottom-8 text-[10px] font-black uppercase tracking-widest text-gray-400 animate-pulse">Click to Reveal</span>
              </div>

              {/* Back */}
              <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 p-8 flex flex-col items-center justify-center bg-black text-white rounded-[3rem] shadow-2xl overflow-y-auto">
                 <span className="absolute top-8 left-8 text-[10px] font-black uppercase tracking-widest text-gray-600">Answer</span>
                 <p className="text-lg font-medium text-center leading-relaxed">
                   {currentCard.back}
                 </p>
                 <span className="absolute bottom-8 text-[10px] font-black uppercase tracking-widest text-gray-600">Click to Flip Back</span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="w-full mt-10 space-y-8">
        <div className="flex items-center justify-center gap-6">
          <button 
            onClick={handlePrev}
            className="p-4 bg-white border border-gray-100 rounded-3xl shadow-lg hover:bg-gray-50 active:scale-90 transition-all text-gray-400 hover:text-black"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          
          <button 
            onClick={toggleMastery}
            className={cn(
              "flex-1 flex items-center justify-center gap-3 py-4 rounded-3xl font-black uppercase tracking-widest text-xs transition-all shadow-lg active:scale-95",
              mastered.includes(currentIndex) 
                ? "bg-green-500 text-white shadow-green-200" 
                : "bg-black text-white shadow-gray-200"
            )}
          >
            {mastered.includes(currentIndex) ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Mastered
              </>
            ) : (
              <>
                <Trophy className="h-4 w-4" />
                Mark as Mastered
              </>
            )}
          </button>

          <button 
            onClick={handleNext}
            className="p-4 bg-white border border-gray-100 rounded-3xl shadow-lg hover:bg-gray-50 active:scale-90 transition-all text-gray-400 hover:text-black"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden p-0.5">
            <motion.div 
               initial={{ width: 0 }}
               animate={{ width: `${progress}%` }}
               className="h-full bg-black rounded-full" 
            />
          </div>
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>
      </div>

      <style>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .preserve-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}</style>
    </div>
  );
};

export default Flashcards;
