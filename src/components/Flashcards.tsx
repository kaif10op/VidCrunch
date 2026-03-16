import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw, 
  CheckCircle2, 
  Circle,
  Trophy,
  Brain,
  Zap,
  Clock,
  Edit3,
  Check,
  X
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

const Flashcards = ({ cards: initialCards }: FlashcardsProps) => {
  const [cards, setCards] = useState(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [mastered, setMastered] = useState<number[]>([]);
  const [studyMode, setStudyMode] = useState<'spaced' | 'fast'>('fast');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ front: "", back: "" });

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

  const handleEditSave = () => {
    const newCards = [...cards];
    newCards[currentIndex] = { ...editData };
    setCards(newCards);
    setIsEditing(false);
  };

  return (
    <div 
      className="max-w-xl mx-auto py-2 px-2 flex flex-col items-center"
      role="region"
      aria-label={`Flashcard ${currentIndex + 1} of ${cards.length}`}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") handleNext();
        else if (e.key === "ArrowLeft") handlePrev();
        else if (e.key === " " || e.key === "Enter") { e.preventDefault(); setIsFlipped(!isFlipped); }
      }}
      tabIndex={0}
    >
      <div className="w-full space-y-4 mb-6">
         {/* Study Mode Toggles */}
         <div className="flex bg-gray-50 p-1 rounded-2xl border border-gray-100">
            <button 
              onClick={() => setStudyMode('fast')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-bold transition-all",
                studyMode === 'fast' ? "bg-white text-black shadow-sm" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <Zap className="h-3 w-3" /> Fast Review
            </button>
            <button 
              onClick={() => setStudyMode('spaced')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-bold transition-all",
                studyMode === 'spaced' ? "bg-white text-black shadow-sm" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <Clock className="h-3 w-3" /> Spaced Repetition
            </button>
         </div>

         <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-full border-4 border-black border-r-transparent flex items-center justify-center">
                  <span className="text-[10px] font-black">{Math.round((mastered.length / cards.length) * 100)}%</span>
               </div>
               <div>
                  <h3 className="text-sm font-bold">Study Progress</h3>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Deck ID: #study-set</p>
               </div>
            </div>
            <div className="flex items-center gap-1.5">
               <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setIsEditing(true);
                  setEditData({ front: currentCard.front, back: currentCard.back });
                }}
                className="h-8 w-8 p-0 rounded-lg bg-gray-50 border border-gray-100"
               >
                 <Edit3 className="h-3.5 w-3.5 text-gray-500" />
               </Button>
               <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {setCurrentIndex(0); setIsFlipped(false); setMastered([]);}}
                  className="h-8 w-8 p-0 rounded-lg bg-gray-50 border border-gray-100"
               >
                  <RotateCcw className="h-3.5 w-3.5 text-gray-500" />
               </Button>
            </div>
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
                <span className="absolute top-8 left-8 text-[10px] font-semibold uppercase tracking-wider text-gray-300">Question</span>
                <p className="text-xl font-bold text-center leading-relaxed">
                  {currentCard.front}
                </p>
                <span className="absolute bottom-8 text-[10px] font-medium uppercase tracking-wider text-gray-400 animate-pulse">Click or press Space to Reveal</span>
              </div>

              {/* Back */}
              <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 p-8 flex flex-col items-center justify-center bg-black text-white rounded-[3rem] shadow-2xl overflow-y-auto">
                 <span className="absolute top-8 left-8 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Answer</span>
                 <p className="text-lg font-medium text-center leading-relaxed">
                   {currentCard.back}
                 </p>
                 <span className="absolute bottom-8 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Click to Flip Back</span>
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
            onClick={() => {
              if (mastered.includes(currentIndex)) {
                setMastered(mastered.filter(i => i !== currentIndex));
              } else {
                setMastered([...mastered, currentIndex]);
                if (studyMode === 'spaced') handleNext();
              }
            }}
            className={cn(
              "flex-1 flex items-center justify-center gap-3 py-4 rounded-3xl font-bold text-[10px] uppercase tracking-wider transition-all shadow-lg active:scale-95",
              mastered.includes(currentIndex) 
                ? "bg-green-600 text-white shadow-green-200" 
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
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <motion.div 
               initial={{ width: 0 }}
               animate={{ width: `${progress}%` }}
               className="h-full bg-black rounded-full" 
            />
          </div>
          <div className="flex justify-between text-[10px] font-black uppercase text-gray-300 tracking-tighter">
            <span>Progress Tracking</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isEditing && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
          >
            <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative border border-gray-100">
               <button onClick={() => setIsEditing(false)} className="absolute top-6 right-6 p-2 hover:bg-gray-50 rounded-xl transition-colors">
                  <X className="h-4 w-4" />
               </button>
               <h3 className="text-xl font-bold mb-6">Edit Card</h3>
               <div className="space-y-6">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase text-gray-400 tracking-tighter">Term / Question</label>
                     <textarea 
                        value={editData.front}
                        onChange={(e) => setEditData({...editData, front: e.target.value})}
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-black/5 min-h-[100px] resize-none"
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase text-gray-400 tracking-tighter">Definition / Answer</label>
                     <textarea 
                        value={editData.back}
                        onChange={(e) => setEditData({...editData, back: e.target.value})}
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-black/5 min-h-[120px] resize-none"
                     />
                  </div>
                  <Button onClick={handleEditSave} className="w-full h-14 rounded-2xl bg-black text-white font-bold gap-2 hover:scale-[1.02] active:scale-95 transition-all">
                     <Check className="h-4 w-4" /> Save Changes
                  </Button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Flashcards;
