export interface VideoData {
  title: string;
  channel: string;
  duration: string;
  views: string;
  likes: string;
  published: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface RoadmapStep {
  step: number;
  task: string;
  description: string;
}

export interface MindMapData {
  nodes: { id: string; label: string }[];
  edges: { source: string; target: string; label?: string }[];
}

export interface SummaryData {
  overview: string;
  keyPoints: string[];
  takeaways: string[];
  timestamps: { time: string; label: string }[];
  tags: string[];
  quiz?: QuizQuestion[];
  roadmap?: { title: string; steps: RoadmapStep[] };
  mind_map?: MindMapData;
  flashcards?: { front: string; back: string }[];
  transcript_segments?: { start: number; end: number; text: string }[];
  learning_context?: { why: string; whatToHowTo: string; bestWay: string };
}

export interface Metadata {
  title: string;
  channel: string;
  duration: string;
  thumbnails: { url: string; width: number; height: number }[];
}

export interface HistoryItem {
  id: string;
  title: string;
  date: string;
  videoIds: string[];
  videoData: VideoData;
  summaryData: SummaryData;
  transcript: string | null;
  metadata: Metadata;
  status: "pending" | "completed" | "failed" | "queued";
}

export interface Space {
  id: string;
  name: string;
  videoIds: string[];
  createdAt: string;
}

import { apiFetch, getAuthToken } from "./api";
import { STORAGE_KEYS, MAX_TRANSCRIPT_LENGTH, MAX_HISTORY_ITEMS, UUID_PATTERN } from "./constants";
import { logger } from "./logger";

const STORE = {
  HISTORY: STORAGE_KEYS.HISTORY,
  SPACES: STORAGE_KEYS.SPACES,
};

export const getHistory = (): HistoryItem[] => {
  const token = getAuthToken();
  if (!token) return [];
  const data = localStorage.getItem(STORE.HISTORY);
  return data ? JSON.parse(data) : [];
};

export const fetchHistory = async (): Promise<HistoryItem[]> => {
  const token = getAuthToken();
  if (!token) return [];

  try {
    const res = await apiFetch("/analysis/");
    if (res.ok) {
      const data = await res.json();
      const mapped = data.map((a: any) => ({
        id: a.id,
        title: a.video_title || "Video Analysis",
        date: a.created_at,
        status: a.status,
        videoIds: [a.video_platform_id || a.video_id], // Platform ID is critical for player
        videoData: {
          title: a.video_title || "Untitled",
          channel: "YouTube",
          duration: "N/A",
          views: "N/A",
          likes: "N/A",
          published: a.created_at
        },
        summaryData: {
          overview: a.overview || "",
          keyPoints: a.key_points || [],
          takeaways: a.takeaways || [],
          timestamps: (a.timestamps || []).map((t: any) => ({ time: t.timestamp || t.time, label: t.topic || t.label })),
          tags: a.tags || [],
          quiz: a.quiz,
          roadmap: a.roadmap,
          mind_map: a.mind_map,
          flashcards: a.flashcards,
          transcript_segments: a.transcript_segments
        },
        transcript: null,
        metadata: {
          title: a.video_title || "Untitled",
          channel: "YouTube",
          duration: "N/A",
          thumbnails: a.video_thumbnail ? [{ url: a.video_thumbnail, width: 1280, height: 720 }] : []
        }
      }));
      localStorage.setItem(STORE.HISTORY, JSON.stringify(mapped));
      return mapped;
    }
  } catch (e) {
    logger.error("Failed to fetch history", e);
  }
  return [];
};

export const saveHistory = (item: Omit<HistoryItem, "id" | "date">) => {
  const token = getAuthToken();
  if (!token) return null;
  
  try {
    const history = getHistory();
    const optimizedItem = {
      ...item,
      transcript: item.transcript && item.transcript.length > MAX_TRANSCRIPT_LENGTH 
        ? item.transcript.slice(0, MAX_TRANSCRIPT_LENGTH) + "... [truncated]" 
        : item.transcript
    };
    
    const newItem: HistoryItem = {
      ...optimizedItem,
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      status: "completed", // Local save is usually for manual completion or guest
    };
    const updatedHistory = [newItem, ...history].slice(0, MAX_HISTORY_ITEMS); 
    localStorage.setItem(STORE.HISTORY, JSON.stringify(updatedHistory));
    return newItem;
  } catch (error) {
    logger.error("Storage error:", error);
    return null;
  }
};

export const deleteHistory = async (id: string, backend_id?: string) => {
  const history = getHistory();
  const updatedHistory = history.filter((item) => item.id !== id);
  localStorage.setItem(STORE.HISTORY, JSON.stringify(updatedHistory));

  const token = getAuthToken();
  if (token && backend_id) {
    apiFetch(`/analysis/${backend_id}`, { method: "DELETE" }).catch(console.error);
  }
};

export const clearHistory = async () => {
  localStorage.removeItem(STORE.HISTORY);
  const token = getAuthToken();
  if (token) {
    try {
      await apiFetch("/analysis/", { method: "DELETE" });
    } catch (e) {
      logger.error("Failed to clear history", e);
    }
  }
};

export const getSpaces = (): Space[] => {
  const token = getAuthToken();
  if (!token) return [];
  const data = localStorage.getItem(STORE.SPACES);
  return data ? JSON.parse(data) : [];
};

export const fetchSpaces = async (): Promise<Space[]> => {
  const token = getAuthToken();
  if (!token) return [];

  try {
    const res = await apiFetch("/spaces");
    if (res.ok) {
      const data = await res.json();
      const backendSpaces = data.map((s: any) => ({
        id: s.id,
        name: s.name,
        videoIds: s.video_ids || [],
        createdAt: s.created_at
      }));
      localStorage.setItem(STORE.SPACES, JSON.stringify(backendSpaces));
      return backendSpaces;
    }
  } catch (e) {
    logger.error("Failed to fetch spaces", e);
  }
  return [];
};

export const createSpace = async (name: string): Promise<Space | null> => {
  const token = getAuthToken();
  if (!token) return null;

  let backendSpace = null;
  try {
    const res = await apiFetch("/spaces", {
      method: "POST",
      body: JSON.stringify({ name, description: "" })
    });
    if (res.ok) {
      backendSpace = await res.json();
    }
  } catch (e) {
    logger.error("Failed to create space", e);
  }

  const spacesArr = getSpaces();
  const newSpace: Space = {
    id: backendSpace ? backendSpace.id : Math.random().toString(36).substr(2, 9),
    name,
    videoIds: [],
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(STORE.SPACES, JSON.stringify([...spacesArr, newSpace]));
  return newSpace;
};

export const addVideoToSpace = async (spaceId: string, videoId: string) => {
  const token = getAuthToken();
  
  if (token) {
    try {
      await apiFetch(`/spaces/${spaceId}/videos`, {
        method: "POST",
        body: JSON.stringify({ video_id: videoId })
      });
    } catch (e) {
      logger.error("Failed to add video to space", e);
    }
  }

  const spaces = getSpaces();
  const updatedSpaces = spaces.map((space) => {
    if (space.id === spaceId && !space.videoIds.includes(videoId)) {
      return { ...space, videoIds: [...space.videoIds, videoId] };
    }
    return space;
  });
  localStorage.setItem(STORE.SPACES, JSON.stringify(updatedSpaces));
};

export const renameSpace = async (id: string, name: string) => {
  const token = getAuthToken();
  if (token && id.match(UUID_PATTERN)) {
    try {
      await apiFetch(`/spaces/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name })
      });
    } catch (e) {
      logger.error("Failed to rename space", e);
    }
  }

  const spaces = getSpaces();
  const updatedSpaces = spaces.map((space) => space.id === id ? { ...space, name } : space);
  localStorage.setItem(STORE.SPACES, JSON.stringify(updatedSpaces));
};

export const deleteSpace = async (id: string) => {
  const token = getAuthToken();
  if (token && id.match(UUID_PATTERN)) {
    try {
      await apiFetch(`/spaces/${id}`, { method: "DELETE" });
    } catch (e) {
      logger.error("Failed to delete space", e);
    }
  }

  const spaces = getSpaces();
  const updatedSpaces = spaces.filter((space) => space.id !== id);
  localStorage.setItem(STORE.SPACES, JSON.stringify(updatedSpaces));
};
