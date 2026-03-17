/**
 * Custom hooks for optimized React Query usage
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./api";
import { queryKeys } from "./queryConfig";

/**
 * Hook for fetching data with automatic error handling
 */
export function useAPIQuery<T>(
  key: readonly any[],
  endpoint: string,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    refetchOnMount?: boolean;
  }
) {
  return useQuery<T>({
    queryKey: key,
    queryFn: async () => {
      const response = await apiFetch(endpoint);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Request failed" }));
        throw new Error(error.detail || "Request failed");
      }
      return response.json();
    },
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? (1000 * 60 * 5), // 5 min default
    refetchOnMount: options?.refetchOnMount ?? true,
  });
}

/**
 * Hook for mutations with automatic cache invalidation
 */
export function useAPIMutation<TData, TVariables>(
  endpoint: string,
  method: "POST" | "PATCH" | "DELETE" = "POST",
  options?: {
    onSuccess?: (data: TData) => void;
    onError?: (error: Error) => void;
    invalidateKeys?: readonly any[][];
  }
) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables) => {
      const response = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(variables),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Request failed" }));
        throw new Error(error.detail || "Request failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate specified query keys
      if (options?.invalidateKeys) {
        options.invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      options?.onError?.(error);
    },
  });
}

// Pre-built hooks for common operations

// Video hooks
export function useVideo(videoId: string) {
  return useAPIQuery(
    queryKeys.videos.detail(videoId),
    `/videos/${videoId}`
  );
}

export function useVideoList(limit = 20, offset = 0) {
  return useAPIQuery(
    queryKeys.videos.list(limit, offset),
    `/videos?limit=${limit}&offset=${offset}`
  );
}

// Analysis hooks  
export function useAnalysis(analysisId: string) {
  return useAPIQuery(
    queryKeys.analyses.detail(analysisId),
    `/analysis/${analysisId}`
  );
}

export function useAnalysisStatus(analysisId: string) {
  return useAPIQuery(
    queryKeys.analyses.status(analysisId),
    `/analysis/${analysisId}/status`,
    { staleTime: 1000 * 30 } // 30 seconds for status
  );
}

export function useAnalysisList(limit = 20, offset = 0) {
  return useAPIQuery(
    queryKeys.analyses.list(limit, offset),
    `/analysis?limit=${limit}&offset=${offset}`
  );
}

// Credit hooks
export function useCreditBalance() {
  return useAPIQuery(
    queryKeys.credits.balance,
    "/credits/balance",
    { staleTime: 1000 * 60 } // 1 minute
  );
}

// Space hooks
export function useSpaces() {
  return useAPIQuery(
    queryKeys.spaces.all,
    "/spaces"
  );
}

export function useSpace(spaceId: string) {
  return useAPIQuery(
    queryKeys.spaces.detail(spaceId),
    `/spaces/${spaceId}`
  );
}