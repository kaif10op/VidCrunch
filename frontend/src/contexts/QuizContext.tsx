import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type QuizQuestion = {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
};

type QuizMode = "idle" | "inProgress" | "finished";

interface QuizContextValue {
  quiz: QuizQuestion[];
  setQuiz: (quiz: QuizQuestion[]) => void;
  current: number;
  setCurrent: (idx: number) => void;
  selected: number | null;
  setSelected: (idx: number | null) => void;
  score: number;
  setScore: (s: number) => void;
  finished: boolean;
  setFinished: (f: boolean) => void;
  answers: (number | null)[];
  setAnswers: (a: (number | null)[]) => void;
  resetQuiz: () => void;
}

const QuizContext = createContext<QuizContextValue | null>(null);

export function QuizProvider({ children }: { children: ReactNode }) {
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>([]);

  const resetQuiz = useCallback(() => {
    setCurrent(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
    setAnswers([]);
  }, []);

  return (
    <QuizContext.Provider
      value={{
        quiz,
        setQuiz,
        current,
        setCurrent,
        selected,
        setSelected,
        score,
        setScore,
        finished,
        setFinished,
        answers,
        setAnswers,
        resetQuiz,
      }}
    >
      {children}
    </QuizContext.Provider>
  );
}

export function useQuizContext() {
  const ctx = useContext(QuizContext);
  if (!ctx) throw new Error("useQuizContext must be used within QuizProvider");
  return ctx;
}
