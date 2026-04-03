/** Application-wide constants */

export const APP_NAME = "VidCrunch" as const;
export const APP_DESCRIPTION = "AI-powered YouTube video learning platform — summarize, quiz, and master any video" as const;

/** API Configuration */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
export const API_TIMEOUT_MS = 30_000;

/** Polling */
export const POLL_INTERVAL_MS = 2_000;
export const POLL_MAX_ATTEMPTS = 600;

/** Storage keys */
export const STORAGE_KEYS = {
  HISTORY: "youlearn_history",
  SPACES: "youlearn_spaces",
  TOKEN: "token",
  USER_NAME: "user_name",
  USER_EMAIL: "user_email",
  USER_BALANCE: "user_balance",
  ACTIVE_VIEW: "youlearn_active_view",
  ACTIVE_ANALYSIS_ID: "youlearn_active_analysis_id",
  SIDEBAR_COLLAPSED: "youlearn_sidebar_collapsed",
} as const;

/** Limits */
export const MAX_TRANSCRIPT_LENGTH = 20_000;
export const MAX_HISTORY_ITEMS = 50;
export const MAX_RECENTS_SHOWN = 5;
export const MAX_CHAT_HISTORY_CONTEXT = 5;

/** YouTube URL patterns */
export const YOUTUBE_URL_PATTERNS = [
  /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
  /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
] as const;

/** Extract video ID from a YouTube URL */
export function extractVideoId(url: string): string | null {
  for (const pattern of YOUTUBE_URL_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** UUID v4 pattern */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
