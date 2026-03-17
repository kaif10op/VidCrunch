/**
 * Optimized React Query configuration
 * Centralizes query settings for better caching and performance
 */

import { QueryClient } from "@tanstack/react-query";

export const queryConfig = {
  // Default stale time - how long before data is considered stale
  staleTime: 1000 * 60 * 5, // 5 minutes

  // Garbage collection time - how long unused data stays in cache
  gcTime: 1000 * 60 * 30, // 30 minutes

  // Number of retries on error
  retry: 2,

  // Delay between retries
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),

  // Refetch on window focus (optional - can be disabled for user-initiated only)
  refetchOnWindowFocus: false,

  // Keep previous data while fetching new data (prevents UI flicker)
  placeholderData: (previousData: any) => previousData,
};

// Query key factory - ensures consistent, cacheable keys
export const queryKeys = {
  // Auth
  auth: {
    me: ["auth", "me"] as const,
    profile: (userId: string) => ["auth", "profile", userId] as const,
  },

  // Videos
  videos: {
    all: ["videos"] as const,
    detail: (videoId: string) => ["videos", videoId] as const,
    list: (limit: number, offset: number) => ["videos", "list", limit, offset] as const,
    analyses: (videoId: string) => ["videos", videoId, "analyses"] as const,
  },

  // Analyses
  analyses: {
    all: ["analyses"] as const,
    detail: (analysisId: string) => ["analyses", analysisId] as const,
    status: (analysisId: string) => ["analyses", analysisId, "status"] as const,
    list: (limit: number, offset: number) => ["analyses", "list", limit, offset] as const,
  },

  // Chat
  chat: {
    messages: (analysisId: string) => ["chat", analysisId, "messages"] as const,
  },

  // Spaces
  spaces: {
    all: ["spaces"] as const,
    detail: (spaceId: string) => ["spaces", spaceId] as const,
    videos: (spaceId: string) => ["spaces", spaceId, "videos"] as const,
  },

  // Credits
  credits: {
    balance: ["credits", "balance"] as const,
    transactions: ["credits", "transactions"] as const,
  },

  // User
  user: {
    settings: ["user", "settings"] as const,
    history: ["user", "history"] as const,
  },
};

// Create optimized query client
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        ...queryConfig,
      },
      mutations: {
        // Default mutation settings
        retry: 1,
      },
    },
  });
}

// Prefetch utilities
export const prefetchUtils = {
  // Prefetch video details
  prefetchVideo: async (queryClient: QueryClient, videoId: string) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.videos.detail(videoId),
      queryFn: async () => {
        const response = await fetch(`/api/videos/${videoId}`);
        if (!response.ok) throw new Error("Failed to fetch video");
        return response.json();
      },
    });
  },

  // Prefetch analysis
  prefetchAnalysis: async (queryClient: QueryClient, analysisId: string) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.analyses.detail(analysisId),
      queryFn: async () => {
        const response = await fetch(`/api/analysis/${analysisId}`);
        if (!response.ok) throw new Error("Failed to fetch analysis");
        return response.json();
      },
    });
  },
};