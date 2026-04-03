export type {
  VideoData,
  SummaryData,
  HistoryItem,
  Space,
  Metadata,
  QuizQuestion,
  RoadmapStep,
  MindMapData,
  DocumentData,
  NoteData,
} from "@/lib/storage";

export type { User, Transaction } from "@/hooks/use-auth";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  toolId?: string;
};

export type ExpertiseLevel = "Beginner" | "Intermediate" | "Expert";

export type AnalysisStatus = "idle" | "pending" | "queued" | "completed" | "failed";

export interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  thumbnail?: string;
  type: "video" | "analysis" | "transcript" | "space";
  video_id?: string;
  platform_id?: string;
}
