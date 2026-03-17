import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface Flashcard {
  front: string;
  back: string;
  hint?: string;
}

type StudyMode = "fast" | "spaced";

interface StudyContextValue {
  // Flashcard list and current index
  cards: Flashcard[];
  setCards: (cards: Flashcard[]) => void;
  currentIndex: number;
  setCurrentIndex: (idx: number) => void;
  // Mastered card indices
  mastered: number[];
  setMastered: (ids: number[]) => void;
  // Study mode
  studyMode: StudyMode;
  setStudyMode: (mode: StudyMode) => void;
  // UI flags used across components
  isFlipped: boolean;
  setIsFlipped: (val: boolean) => void;
  // Shortcut to reset whole study session
  resetStudy: () => void;
}

const StudyContext = createContext<StudyContextValue | null>(null);

export function StudyProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mastered, setMastered] = useState<number[]>([]);
  const [studyMode, setStudyMode] = useState<StudyMode>("fast");
  const [isFlipped, setIsFlipped] = useState(false);

  const resetStudy = useCallback(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setMastered([]);
  }, []);

  return (
    <StudyContext.Provider
      value={{
        cards,
        setCards,
        currentIndex,
        setCurrentIndex,
        mastered,
        setMastered,
        studyMode,
        setStudyMode,
        isFlipped,
        setIsFlipped,
        resetStudy,
      }}
    >
      {children}
    </StudyContext.Provider>
  );
}

export function useStudyContext() {
  const ctx = useContext(StudyContext);
  if (!ctx) throw new Error("useStudyContext must be used within StudyProvider");
  return ctx;
}
