import React, { memo } from "react";
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
  X,
  Plus,
  Sparkles,
  Keyboard,
  Command
} from "lucide-react";
import { Button } from "./ui/button";
import { useReducedMotion } from "../hooks/useReducedMotion";

interface Flashcard {
  front: string;
  back: string;
  hint?: string;
}

interface FlashcardsProps {
  cards: Flashcard[];
  onAIAction?: (action: string, context: string) => void;
  onGenerateMore?: () => void;
  isGenerating?: boolean;
  aiExplanation?: string | null;
  onClearExplanation?: () => void;
}

const Flashcards = ({
  cards: initialCards,
  onAIAction,
  onGenerateMore,
  isGenerating,
  aiExplanation,
  onClearExplanation
}: FlashcardsProps) => {
  const { cards, setCards, currentIndex, setCurrentIndex, mastered, setMastered, studyMode, setStudyMode, isFlipped, setIsFlipped, resetStudy } = useStudyContext();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ front: "", back: "" });
  const [isFinished, setIsFinished] = useState(false);
  const [showHint, setShowHint] = useState<number | null>(null);
  const [lastCount, setLastCount] = useState(initialCards.length);
  const [showAdditionBadge, setShowAdditionBadge] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [displayedExplanation, setDisplayedExplanation] = useState<string>("");

  // Memoized handlers
  const handleNext = useCallback(() => {
    setIsFlipped(false);
    if (currentIndex === cards.length - 1) {
      setTimeout(() => setIsFinished(true), 150);
      return;
    }
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % cards.length);
      setShowHint(null);
    }, 150);
  }, [currentIndex, cards.length]);

  const handlePrev = useCallback(() => {
    setIsFlipped(false);
    if (currentIndex === 0) return;
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
      setShowHint(null);
    }, 150);
  }, [currentIndex, cards.length]);

  const toggleMastered = useCallback(() => {
    if (mastered.includes(currentIndex)) {
      setMastered(mastered.filter(i => i !== currentIndex));
    } else {
      setMastered([...mastered, currentIndex]);
      if (studyMode === 'spaced') handleNext();
    }
  }, [currentIndex, mastered, studyMode, handleNext]);

  // Effects
  useEffect(() => {
    if (initialCards.length > lastCount) {
      setShowAdditionBadge(true);
      setTimeout(() => setShowAdditionBadge(false), 3000);
      setLastCount(initialCards.length);
    }
    setCards(initialCards);
    onClearExplanation?.();
  }, [initialCards, lastCount, onClearExplanation]);

  useEffect(() => {
    onClearExplanation?.();
  }, [currentIndex, onClearExplanation]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName);
      if (isInput || isEditing) return;

      switch(e.key.toLowerCase()) {
        case 'arrowright':
        case 'd':
        case ']':
          handleNext();
          break;
        case 'arrowleft':
        case 'a':
        case '[':
          handlePrev();
          break;
        case ' ':
        case 'enter':
        case 'f':
          e.preventDefault();
          setIsFlipped(prev => !prev);
          break;
        case 'm':
          toggleMastered();
          break;
        case 'h':
        case 'i':
          setShowHint(currentIndex);
          break;
        case 'e':
          setIsEditing(true);
          setEditData({ front: cards[currentIndex]?.front || "", back: cards[currentIndex]?.back || "" });
          break;
        case 'r':
          resetStudy();
          break;
        case 'g':
        case '+':
          if (!isGenerating) onGenerateMore?.();
          break;
        case 's':
          setStudyMode(prev => prev === 'fast' ? 'spaced' : 'fast');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isEditing, isFlipped, mastered, studyMode, cards, isGenerating, onGenerateMore, toggleMastered, handleNext, handlePrev]);

  // Early return after all hooks
  if (!cards || cards.length === 0) return null;

  const currentCard = cards[currentIndex];
  const progress = ((currentIndex + 1) / cards.length) * 100;

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
                   <div className="flex items-center gap-1.5 overflow-hidden">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter shrink-0">{cards.length} Total Cards</p>
                      <AnimatePresence>
                        {showAdditionBadge && (
                          <motion.span 
                            initial={{ x: -10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 10, opacity: 0 }}
                            className="text-[8px] font-black bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-md uppercase shrink-0 whitespace-nowrap"
                          >
                            +{cards.length - (lastCount - (showAdditionBadge ? 0 : 0))} New Added
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
               <Button 
                  variant="ghost" 
                  size="sm" 
                  disabled={isGenerating}
                  onClick={(e) => { e.stopPropagation(); onGenerateMore?.(); }}
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
                     { k: "← / A / [", l: "Previous" },
                     { k: "→ / D / ]", l: "Next" },
                     { k: "Space / F", l: "Flip" },
                     { k: "M", l: "Master" },
                     { k: "H / I", l: "Hint" },
                     { k: "E", l: "Edit" },
                     { k: "R", l: "Reset" },
                     { k: "G / +", l: "More" },
                     { k: "S", l: "Study Mode" }
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
       </div>

      {isFinished ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full bg-white border border-gray-100 rounded-[3rem] p-10 text-center space-y-8 shadow-2xl shadow-black/5"
        >
          <div className="w-24 h-24 rounded-[2.5rem] bg-black mx-auto flex items-center justify-center shadow-2xl shadow-black/20">
            <Trophy className="h-10 w-10 text-white" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black tracking-tight">Deck Mastery!</h3>
            <p className="text-sm font-bold text-gray-400">You've reached the end of this study set.</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 rounded-[2rem] bg-gray-50 border border-gray-100">
               <span className="text-2xl font-black text-black">{mastered.length}</span>
               <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">Mastered</p>
            </div>
            <div className="p-6 rounded-[2rem] bg-gray-50 border border-gray-100">
               <span className="text-2xl font-black text-black">{cards.length - mastered.length}</span>
               <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">To Review</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
             <Button 
               onClick={() => {
                 setCurrentIndex(0);
                 setIsFinished(false);
                 setMastered([]);
               }}
               className="h-14 rounded-2xl bg-black text-white font-bold gap-2"
             >
               <RotateCcw className="h-4 w-4" /> Restart Deck
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
               Generate 10 More Cards
             </Button>
          </div>
        </motion.div>
      ) : (
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
                <div className={cn(
                  "absolute inset-0 w-full h-full backface-hidden p-8 flex flex-col items-center justify-center border-2 rounded-[3.5rem] shadow-2xl transition-all duration-500",
                  mastered.includes(currentIndex) 
                    ? "bg-emerald-50 border-emerald-100" 
                    : "bg-white border-gray-50 hover:border-black/5"
                )}>
                  <div className="absolute top-8 left-8 flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">Question</span>
                    {mastered.includes(currentIndex) && (
                      <span className="bg-emerald-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-sm">Mastered</span>
                    )}
                  </div>
                  <p className="text-xl font-black text-center leading-relaxed text-gray-900 px-4">
                    {currentCard.front}
                  </p>
                  <div className="absolute bottom-8 flex flex-col items-center gap-2">
                    <div className="flex gap-1">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-100" />
                      ))}
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-300">Click to flip</span>
                    {showHint === currentIndex ? (
                      <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 px-4 py-2 bg-amber-50 border border-amber-100 rounded-xl max-w-xs"
                      >
                        <p className="text-[10px] font-bold text-amber-800 leading-tight">
                          {currentCard.hint || "Try thinking about the core concepts discussed in this segment."}
                        </p>
                      </motion.div>
                    ) : (
                      <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           setShowHint(currentIndex);
                         }}
                         className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-full transition-all mt-2"
                      >
                         <Zap className="h-2.5 w-2.5 text-amber-500" />
                         <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">Get Hint</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Back */}
                <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 p-8 flex flex-col bg-black text-white rounded-[3.5rem] shadow-3xl overflow-hidden group/back">
                   <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black opacity-50" />
                   
                   <div className="relative z-10 flex-1 flex flex-col h-full">
                      <div className="flex items-center justify-between mb-2">
                         <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">The Genius Answer</span>
                         <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             onAIAction?.("explain", `Explain this flashcard concept in more detail: "${currentCard.front}" -> "${currentCard.back}"`);
                           }}
                           className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all"
                         >
                            <Sparkles className="h-3 w-3 text-amber-400" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Ask AI</span>
                         </button>
                      </div>

                      <div className="flex-1 flex flex-col justify-center items-center px-4 overflow-y-auto scrollbar-none py-6 relative">
                        <AnimatePresence mode="wait">
                          {aiExplanation !== null ? (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="w-full text-left space-y-4"
                            >
                               <div className="flex items-center gap-2 mb-4 bg-white/10 w-fit px-3 py-1 rounded-full border border-white/10">
                                  <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                                  <span className="text-[8px] font-black uppercase tracking-widest text-amber-100">Genius Breakdown</span>
                               </div>
                               <div className="prose prose-invert prose-xs max-w-none">
                                  <p className="text-[13px] font-medium leading-relaxed text-gray-200">
                                    {aiExplanation || "Thinking..."}
                                  </p>
                               </div>
                            </motion.div>
                          ) : (
                            <motion.p 
                              key="original"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-lg font-bold text-center leading-relaxed"
                            >
                              {currentCard.back}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="mt-auto flex flex-col items-center gap-4 text-center">
                         <div className="h-px w-12 bg-gray-800" />
                         <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-700">Click to Flip Back</span>
                      </div>
                   </div>

                   {/* Background floating effect */}
                   <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-white/5 blur-3xl rounded-full group-hover/back:scale-150 transition-transform duration-1000" />
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      <div className="w-full mt-10 space-y-8">
        <div className={cn(
          "flex items-center justify-center gap-6 transition-all duration-500",
          isFinished && "opacity-0 pointer-events-none scale-95"
        )}>
          <button 
            disabled={currentIndex === 0}
            onClick={handlePrev}
            className="p-4 bg-white border border-gray-100 rounded-3xl shadow-lg hover:bg-gray-50 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-gray-400 hover:text-black"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          
          <button 
            onClick={toggleMastered}
            className={cn(
              "flex-1 flex items-center justify-center gap-3 py-4 rounded-3xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-xl active:scale-95",
              mastered.includes(currentIndex) 
                ? "bg-emerald-600 text-white shadow-emerald-200" 
                : "bg-black text-white shadow-black/10 hover:shadow-black/20"
            )}
          >
            {mastered.includes(currentIndex) ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Mastered
              </>
            ) : (
              <>
                <Brain className="h-4 w-4" />
                I Got it
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-card-title"
          >
            <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative border border-gray-100">
               <button onClick={() => setIsEditing(false)} className="absolute top-6 right-6 p-2 hover:bg-gray-50 rounded-xl transition-colors">
                  <X className="h-4 w-4" />
               </button>
               <h3 id="edit-card-title" className="text-xl font-bold mb-6">Edit Card</h3>
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

export default memo(Flashcards);
