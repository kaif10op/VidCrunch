export interface Timestamp {
  time: string;
  label: string;
}

export interface LearningContext {
  why: string;
  whatToHowTo: string;
  bestWay: string;
}

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
  nodes: { id: string; label: string; details?: string; timestamp?: number }[];
  edges: { id?: string; source: string; target: string; label?: string }[];
}

export interface SummaryData {
  overview: string;
  keyPoints: string[];
  key_points?: string[]; // Backend alias
  takeaways: string[];
  timestamps: Timestamp[];
  tags: string[];
  quiz?: QuizQuestion[];
  roadmap?: { title: string; steps: RoadmapStep[] };
  mind_map?: MindMapData;
  flashcards?: { front: string; back: string; hint?: string }[];
  podcast?: { audioUrl?: string; script?: string };
  learning_context?: LearningContext;
  transcript_segments?: { start: number; end: number; text: string }[];
  glossary?: { term: string; definition: string }[];
  resources?: { name: string; url?: string; description?: string }[];
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

export interface DocumentData {
  id: string;
  title: string;
  file_type: string;
  file_size_bytes?: number;
  status: "pending" | "processing" | "ready" | "failed";
  createdAt: string;
}

export interface NoteData {
  id: string;
  title: string;
  content: string;
  space_id?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Space {
  id: string;
  name: string;
  description?: string;
  videoIds: string[];
  documentCount?: number;
  noteCount?: number;
  createdAt: string;
}

import { apiFetch, getAuthToken } from "./api";
import { STORAGE_KEYS, MAX_TRANSCRIPT_LENGTH, MAX_HISTORY_ITEMS, UUID_PATTERN, API_BASE_URL } from "./constants";
import { logger } from "./logger";
import { transformBackendAnalysis, safeJSONParse } from "./transformers";

const STORE = {
  HISTORY: STORAGE_KEYS.HISTORY,
  SPACES: STORAGE_KEYS.SPACES,
};

export const getHistory = (): HistoryItem[] => {
  const token = getAuthToken();
  if (!token) return [];
  return safeJSONParse(localStorage.getItem(STORE.HISTORY), []);
};

export const fetchHistory = async (): Promise<HistoryItem[]> => {
  const token = getAuthToken();
  if (!token) return [];

  try {
    const res = await apiFetch("/api/analysis/");
    if (res.ok) {
      const data = await res.json();

      // Transform each analysis using the shared transformer
      const mapped: HistoryItem[] = data.map((a: any) => {
        const { videoData, summaryData, metadata, videoIds } = transformBackendAnalysis(a);

        return {
          id: a.id,
          title: a.video_title || videoData.title,
          date: a.created_at,
          status: a.status,
          videoIds,
          videoData: {
            ...videoData,
            // Preserve original video_data if available (populated from summary)
            title: a.video_title || videoData.title,
          },
          summaryData,
          transcript: null,
          metadata: {
            ...metadata,
            title: a.video_title || metadata.title,
            thumbnails: a.video_thumbnail
              ? [{ url: a.video_thumbnail, width: 1280, height: 720 }]
              : metadata.thumbnails
          }
        };
      });

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
  // History items from API use their backend UUID as the main 'id'
  const targetId = backend_id || id;
  
  if (token && targetId) {
    apiFetch(`/api/analysis/${targetId}`, { method: "DELETE" }).catch(console.error);
  }
};

export const clearHistory = async () => {
  localStorage.removeItem(STORE.HISTORY);
  const token = getAuthToken();
  if (token) {
    try {
      await apiFetch("/api/analysis/", { method: "DELETE" });
    } catch (e) {
      logger.error("Failed to clear history", e);
    }
  }
};

export const getSpaces = (): Space[] => {
  const token = getAuthToken();
  if (!token) return [];
  return safeJSONParse(localStorage.getItem(STORE.SPACES), []);
};

export const fetchSpaces = async (): Promise<Space[]> => {
  const token = getAuthToken();
  if (!token) return [];

  try {
    const res = await apiFetch("/api/spaces/");
    if (res.ok) {
      const data = await res.json();
      const backendSpaces = data.map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        videoIds: s.video_ids || [],
        documentCount: s.document_count || 0,
        noteCount: s.note_count || 0,
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
    const res = await apiFetch("/api/spaces/", {
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
      await apiFetch(`/api/spaces/${spaceId}/videos`, {
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

export const removeVideoFromSpace = async (spaceId: string, videoId: string) => {
  const token = getAuthToken();
  if (token) {
    try {
      await apiFetch(`/api/spaces/${spaceId}/videos/${videoId}`, { method: "DELETE" });
    } catch (e) {
      logger.error("Failed to remove video from space", e);
    }
  }

  const spaces = getSpaces();
  const updatedSpaces = spaces.map((space) => {
    if (space.id === spaceId) {
      return { ...space, videoIds: space.videoIds.filter(id => id !== videoId) };
    }
    return space;
  });
  localStorage.setItem(STORE.SPACES, JSON.stringify(updatedSpaces));
};

export const renameSpace = async (id: string, name: string) => {
  const token = getAuthToken();
  if (token) {
    try {
      await apiFetch(`/api/spaces/${id}`, {
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
  if (token) {
    try {
      await apiFetch(`/api/spaces/${id}`, { method: "DELETE" });
    } catch (e) {
      logger.error("Failed to delete space", e);
    }
  }

  const spaces = getSpaces();
  const updatedSpaces = spaces.filter((space) => space.id !== id);
  localStorage.setItem(STORE.SPACES, JSON.stringify(updatedSpaces));
};

// ── DOCUMENTS ──

export const uploadDocument = async (file: File): Promise<DocumentData | null> => {
  const token = getAuthToken();
  if (!token) return null;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await apiFetch("/api/documents/upload", {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      return {
        id: data.id,
        title: data.title,
        file_type: "pdf", // Placeholder, backend knows
        status: data.status,
        createdAt: new Date().toISOString()
      };
    }
  } catch (e) {
    logger.error("Failed to upload document", e);
  }
  return null;
};

export const fetchSpaceDocuments = async (spaceId: string): Promise<DocumentData[]> => {
  try {
    const res = await apiFetch(`/api/spaces/${spaceId}/documents`);
    if (res.ok) {
        const data = await res.json();
        return data.map((d: any) => ({
            id: d.id,
            title: d.title,
            file_type: d.file_type,
            file_size_bytes: d.file_size_bytes,
            status: d.status,
            createdAt: d.created_at
        }));
    }
  } catch (e) {
    logger.error("Failed to fetch space documents", e);
  }
  return [];
};

export const addDocumentToSpace = async (spaceId: string, docId: string) => {
    try {
        await apiFetch(`/api/spaces/${spaceId}/documents/${docId}`, { method: "POST" });
    } catch (e) {
        logger.error("Failed to add document to space", e);
    }
};

export const removeDocumentFromSpace = async (spaceId: string, docId: string) => {
    try {
        await apiFetch(`/api/spaces/${spaceId}/documents/${docId}`, { method: "DELETE" });
    } catch (e) {
        logger.error("Failed to remove document from space", e);
    }
};

export const getDocumentUrl = (docId: string) => {
    const token = getAuthToken();
    return `${API_BASE_URL}/api/documents/${docId}/download?access_token=${token}`;
};

// ── NOTES ──

export const fetchSpaceNotes = async (spaceId: string): Promise<NoteData[]> => {
    try {
        const res = await apiFetch(`/api/spaces/${spaceId}/notes`);
        if (res.ok) {
            const data = await res.json();
            return data.map((n: any) => ({
                id: n.id,
                title: n.title,
                content: n.content,
                space_id: n.space_id,
                createdAt: n.created_at,
                updatedAt: n.updated_at
            }));
        }
    } catch (e) {
        logger.error("Failed to fetch space notes", e);
    }
    return [];
};

export const createSpaceNote = async (spaceId: string, title: string, content: string): Promise<NoteData | null> => {
    try {
        const res = await apiFetch(`/api/spaces/${spaceId}/notes`, {
            method: "POST",
            body: JSON.stringify({ title, content })
        });
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        logger.error("Failed to create space note", e);
    }
    return null;
};

export const deleteSpaceNote = async (spaceId: string, noteId: string) => {
    try {
        await apiFetch(`/api/spaces/${spaceId}/notes/${noteId}`, { method: "DELETE" });
    } catch (e) {
        logger.error("Failed to delete space note", e);
    }
};

export const updateSpaceNote = async (spaceId: string, noteId: string, title: string, content: string): Promise<NoteData | null> => {
    try {
        const res = await apiFetch(`/api/spaces/${spaceId}/notes/${noteId}`, {
            method: "PATCH",
            body: JSON.stringify({ title, content })
        });
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        logger.error("Failed to update space note", e);
    }
    return null;
};

// ── SPACE CHAT ──

export const sendSpaceChat = async (spaceId: string, message: string, onChunk: (chunk: string) => void) => {
    const token = getAuthToken();
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/spaces/${spaceId}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ message }),
        });

        if (!response.ok) throw new Error("Chat request failed");

        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const dataStr = line.replace("data: ", "").trim();
                    if (dataStr === "[DONE]") return;
                    try {
                        const data = JSON.parse(dataStr);
                        if (data.type === "chunk") {
                            onChunk(data.content);
                        }
                    } catch (e) {
                        // Ignore malformed JSON chunks
                    }
                }
            }
        }
    } catch (e) {
        logger.error("Space chat error", e);
        throw e;
    }
};
