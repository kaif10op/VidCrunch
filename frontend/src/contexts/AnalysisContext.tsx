import { useNavigate } from "react-router-dom";
import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { toast } from "sonner";
import { videoApi, apiFetch, chatApi, analysisApi, exportApi } from "@/lib/api";
import { extractVideoId, POLL_INTERVAL_MS, POLL_MAX_ATTEMPTS, API_BASE_URL } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { getAuthToken } from "@/lib/api";
import { useSpacesContext } from "./SpacesContext";
import { transformBackendAnalysis, safeJSONParse } from "@/lib/transformers";
import { TOOL_IDS, ON_DEMAND_TOOLS, TOOL_TYPE_MAP } from "@/lib/toolConstants";
import type { VideoData, SummaryData, Metadata, ChatMessage, AnalysisStatus, HistoryItem } from "@/types";

interface AnalysisContextValue {
  videoData: VideoData | null;
  videoIds: string[];
  summaryData: SummaryData | null;
  transcript: string | null;
  metadata: Metadata | null;
  activeAnalysisId: string | null;
  analysisStatus: AnalysisStatus;
  analysisProgress: number;
  estimatedRemaining: number | null;
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  isLoading: boolean;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  contextSnippet: string | null;
  setContextSnippet: (snippet: string | null) => void;
  aiExplanation: string | null;
  setAiExplanation: (explanation: string | null) => void;
  quizAIExplanation: string | null;
  setQuizAIExplanation: (explanation: string | null) => void;
  roadmapAIExplanation: string | null;
  setRoadmapAIExplanation: (explanation: string | null) => void;
  generatingTools: string[];
  handleSubmit: (urls: string[], options?: any) => Promise<void>;
  handleSendMessage: (content: string, forcedContext?: string | null, toolId?: string | null) => Promise<void>;
  handleGenerateTool: (toolId: string) => Promise<void>;
  handleExport: (format: "json" | "markdown") => Promise<void>;
  handleLoadHistoryItem: (item: HistoryItem) => Promise<void>;
  handleBackToDashboard: () => void;
  handleToolClick: (toolId: string, value?: string, context?: string) => void;
  handleTimestampClick: (seconds: number) => void;
  handleAddToSpace: (spaceId: string) => Promise<void>;
  loadAnalysis: (analysisId: string) => Promise<void>;
  clearExplanation: () => void;
  isChatOpen: boolean;
  setIsChatOpen: (isOpen: boolean) => void;
  analysisStyle: string;
  setAnalysisStyle: (style: string) => void;
  userNotes: string;
  updateUserNotes: (notes: string) => void;
  isNotesSaving: boolean;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const { refreshHistory } = useSpacesContext();
  const navigate = useNavigate();
  
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [videoIds, setVideoIds] = useState<string[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("idle");
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [estimatedRemaining, setEstimatedRemaining] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [contextSnippet, setContextSnippet] = useState<string | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [quizAIExplanation, setQuizAIExplanation] = useState<string | null>(null);
  const [roadmapAIExplanation, setRoadmapAIExplanation] = useState<string | null>(null);
  const [generatingTools, setGeneratingTools] = useState<string[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [analysisStyle, setAnalysisStyle] = useState("");
  const [userNotes, setUserNotes] = useState("");
  const [isNotesSaving, setIsNotesSaving] = useState(false);
  
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pollingAbortControllerRef = useRef<AbortController | null>(null);

  const pollAnalysis = useCallback(async (
    analysisId: string,
    vIds: string[],
    signal?: AbortSignal
  ): Promise<any> => {
    let completed = false;
    let data = null;
    let attempts = 0;
    
    while (!completed && attempts < POLL_MAX_ATTEMPTS) {
      attempts++;

      // Wait with cancellation support
      await new Promise((resolve, reject) => {
        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        const timeout = setTimeout(() => {
          resolve(null);
        }, POLL_INTERVAL_MS);

        const onAbort = () => {
          clearTimeout(timeout);
          reject(new DOMException('Aborted', 'AbortError'));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        // Listener auto-removed via once: true, no memory leak
      });

      try {
        if (signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        // Use the signal for the fetch request
        const statusRes = await apiFetch(`/analysis/${analysisId}/status`, {
          signal: signal ? { signal } : undefined
        });

        if (!statusRes.ok) continue;
        const statusData = await statusRes.json();

        if (statusData.progress_percentage !== undefined) {
          setAnalysisProgress(statusData.progress_percentage);
        }
        if (statusData.estimated_remaining_seconds !== undefined) {
          setEstimatedRemaining(statusData.estimated_remaining_seconds);
        }

        if (statusData.status === "completed") {
          const detailRes = await apiFetch(`/analysis/${analysisId}`, {
            signal: signal ? { signal } : undefined
          });
          data = await detailRes.json();
          completed = true;
          setAnalysisProgress(100);
          setAnalysisStatus("completed");
        } else if (statusData.status === "failed") {
          setAnalysisStatus("failed");
          throw new Error(statusData.error || "Analysis task failed");
        }
      } catch (e: any) {
        if (e.name === 'AbortError') {
          // Polling was cancelled, propagate abort
          throw e;
        }
        logger.warn("Polling attempt failed:", e);
      }
    }

    if (data) {
      const { videoData, summaryData, metadata, videoIds: transformedVideoIds } = transformBackendAnalysis(data);

      // Use platform_id preferentially, fallback to first provided videoId
      const finalVideoIds = [data.video.platform_id || vIds[0]];

      setVideoIds(finalVideoIds);
      setVideoData(videoData);
      setSummaryData(summaryData);
      setTranscript(data.transcript_text || null);
      setMetadata(metadata);

      // History is saved on backend, but we might want to refresh local history too
      refreshHistory();
    }
    return data;
  }, [refreshHistory]);

  const handleSubmit = useCallback(async (urls: string[], options: any = {}) => {
    const ids = urls.map(u => extractVideoId(u)).filter(Boolean) as string[];
    if (!ids.length) {
      toast.error("No valid YouTube URLs found.");
      return;
    }

    setIsChatLoading(true); // Reusing for overall loading state in some cases
    setAnalysisStatus("pending");
    setAnalysisProgress(0);

    try {
      const res = await apiFetch("/videos/analyze", {
        method: "POST",
        body: JSON.stringify({
          urls: ids.map(id => `https://youtube.com/watch?v=${id}`),
          expertise: (options.expertise || "intermediate").toLowerCase(),
          full_analysis: options.full_analysis ?? true,
          style: options.style || undefined,
          ...options
        }),
      });

      if (res.status === 402) {
        toast.error("Insufficient credits. Please top up to continue.");
        return;
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Analysis failed");
      }

      setVideoIds(ids);
      setVideoData({
        title: "Analyzing Video...",
        channel: "YouTube",
        duration: "N/A",
        views: "N/A",
        likes: "N/A",
        published: new Date().toISOString()
      });
      setSummaryData(null);
      setTranscript(null);
      setMetadata(null);

      const { message } = await res.json();
      const analysisId = message.match(/[0-9a-fA-F-]{36}/)?.[0];
      
      if (!analysisId) throw new Error("No analysis ID returned");

      setActiveAnalysisId(analysisId);

      // Cancel any pending polling from previous analysis
      pollingAbortControllerRef.current?.abort();
      const pollController = new AbortController();
      pollingAbortControllerRef.current = pollController;

      refreshHistory();
      navigate(`/analysis/${analysisId}`);

      try {
        const data = await pollAnalysis(analysisId, ids, pollController.signal);
        if (data) {
          toast.success("Analysis complete!");
        }
      } finally {
        // Clear the ref if this is the current poll controller
        if (pollingAbortControllerRef.current === pollController) {
          pollingAbortControllerRef.current = null;
        }
      }
    } catch (err: any) {
      // Ignore intentional abort errors (e.g., cancelled polling, component unmount)
      if (err.name === 'AbortError') {
        logger.info("Polling aborted:", err.message);
        return;
      }
      logger.error("Summarize error:", err);
      toast.error(err.message || "Failed to analyze video");
      setAnalysisStatus("failed");
    } finally {
      setIsChatLoading(false);
    }
  }, [pollAnalysis, refreshHistory, navigate]);

  const loadChatHistory = useCallback(async (analysisId: string) => {
    try {
      const res = await chatApi.getHistory(analysisId);
      if (res.ok) {
        const history = await res.json();
        if (Array.isArray(history) && history.length > 0) {
          const messages = history.map((msg: any) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          }));
          setChatMessages(messages);
        }
      }
    } catch (err) {
      logger.warn("Failed to load chat history:", err);
    }
  }, []);

  const updateUserNotes = useCallback((notes: string) => {
    setUserNotes(notes);
  }, []);

  // Debounced auto-save for notes
  useEffect(() => {
    if (!activeAnalysisId || !userNotes) return;
    
    const timer = setTimeout(async () => {
      setIsNotesSaving(true);
      try {
        await apiFetch(`/analysis/${activeAnalysisId}/notes`, {
          method: "PATCH",
          body: JSON.stringify({ user_notes: userNotes }),
        });
      } catch (err) {
        logger.error("Failed to auto-save notes:", err);
      } finally {
        setIsNotesSaving(false);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [userNotes, activeAnalysisId]);

  const handleSendMessage = useCallback(async (content: string, forcedContext?: string | null, toolId?: string | null) => {
    const activeContext = forcedContext !== undefined ? forcedContext : contextSnippet;
    const finalContent = content;
    const newUserMsg: ChatMessage = { 
      role: "user", 
      content: finalContent,
      toolId: toolId || undefined
    };
    const updatedMessages = [...chatMessages, newUserMsg];
    setChatMessages(updatedMessages);
    setIsChatLoading(true);
    setContextSnippet(null);
    if (toolId === 'explain') setAiExplanation("");
    if (toolId === 'quiz_hint' || toolId === 'quiz_explain') setQuizAIExplanation("");
    if (toolId === 'roadmap_explain') setRoadmapAIExplanation("");
    try {
      if (activeAnalysisId) {
        const response = await fetch(`${API_BASE_URL}/chat/${activeAnalysisId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAuthToken()}`,
          },
          body: JSON.stringify({
            message: finalContent,
            context_snippet: activeContext,
            tool_id: toolId,
            chatHistory: chatMessages.slice(-5)
          }),
        });

        if (!response.ok) throw new Error("Chat failed");

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let assistantMsgContent = "";
        let visualBuffer = "";
        let isInsideVisual = false;
        
        setChatMessages(prev => [...prev, { role: "assistant", content: "", toolId: toolId || undefined }]);

        while (true) {
          const { done, value } = await reader!.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim();
              if (dataStr === "[DONE]") {
                // Final check for visual parsing
                if (toolId === 'mindmap_expand' && visualBuffer) {
                  try {
                    const visualData = JSON.parse(visualBuffer);
                    if (visualData.nodes && visualData.edges) {
                      setSummaryData(prev => {
                        if (!prev) return null;
                        const existingMap = prev.mind_map || { nodes: [], edges: [] };
                        // Filter out existing node IDs to avoid duplicates
                        const newNodes = visualData.nodes.filter((n: any) => !existingMap.nodes.some(ex => ex.id === n.id));
                        
                        // Robust edge filtering using id or source-target as key
                        const getEdgeKey = (e: any) => e.id || `${e.source}-${e.target}`;
                        const newEdges = visualData.edges.filter((e: any) => {
                          const newKey = getEdgeKey(e);
                          return !existingMap.edges.some(ex => getEdgeKey(ex) === newKey);
                        });
                        
                        return {
                          ...prev,
                          mind_map: {
                            nodes: [...existingMap.nodes, ...newNodes],
                            edges: [...existingMap.edges, ...newEdges]
                          }
                        };
                      });
                      toast.success("Knowledge graph expanded!");
                    }
                  } catch (e) {
                    logger.warn("Failed to parse visual data on DONE", e);
                  }
                }
                break;
              }
              
              try {
                const data = JSON.parse(dataStr);
                if (data.type === "chunk") {
                  const contentChunk = data.content;
                  assistantMsgContent += contentChunk;

                  // Visual extraction logic
                  if (contentChunk.includes("[VISUAL:")) {
                    isInsideVisual = true;
                    visualBuffer = "";
                  }
                  
                  if (isInsideVisual) {
                    const visualPart = contentChunk.includes("[/VISUAL]") 
                      ? contentChunk.split("[/VISUAL]")[0].replace(/\[VISUAL:.*?\]/, "")
                      : contentChunk.replace(/\[VISUAL:.*?\]/, "");
                    visualBuffer += visualPart;
                  }

                  if (contentChunk.includes("[/VISUAL]")) {
                    isInsideVisual = false;
                    // Attempt immediate parse for better UX (though DONE is safer)
                  }

                  setChatMessages(prev => {
                    const newChat = [...prev];
                    newChat[newChat.length - 1].content = assistantMsgContent;
                    return newChat;
                  });
                  if (toolId === 'explain') setAiExplanation(assistantMsgContent);
                  if (toolId === 'quiz_hint' || toolId === 'quiz_explain') setQuizAIExplanation(assistantMsgContent);
                  if (toolId === 'roadmap_explain') setRoadmapAIExplanation(assistantMsgContent);
                }
              } catch (e) {
                logger.warn("Error parsing chunk", e);
              }
            }
          }
        }
      } else {
        // Fallback generic chat
        const res = await apiFetch("/videos/analyze", {
          method: "POST",
          body: JSON.stringify({
            urls: videoIds.map(id => `https://youtube.com/watch?v=${id}`),
            style: `Chat Mode: ${content}`,
            expertise: "intermediate",
            chatHistory: updatedMessages.slice(-5)
          }),
        });
        const responseData = await res.json();
        const aiResponse = responseData.answer || responseData?.analysis?.overview || responseData?.summary || "I couldn't process that. Try asking something else!";
        setChatMessages(prev => [...prev, { role: "assistant", content: aiResponse as string }]);
      }
    } catch (err: any) {
      logger.error("Chat error:", err);
      toast.error(err.message || "AI Assistant is having trouble. Try again.");
    } finally {
      setIsChatLoading(false);
    }
  }, [activeAnalysisId, chatMessages, contextSnippet, videoIds, setChatMessages, setIsChatLoading, setContextSnippet]);

  const handleGenerateTool = useCallback(async (toolId: string, append: boolean = false, force: boolean = false) => {
    if (!activeAnalysisId) return;
    
    setGeneratingTools(prev => [...prev, toolId]);
    try {
      const toolTypeMap: Record<string, string> = {
        'overview': 'overview',
        'key_points': 'key_points',
        'takeaways': 'takeaways',
        'tags': 'tags',
        'learning_context': 'learning_context',
        'quiz': 'quiz',
        'roadmap': 'roadmap',
        'mindmap': 'mind_map',
        'mind_map': 'mind_map',
        'mindmap_regenerate': 'mind_map',
        'flashcards': 'flashcards',
        'podcast': 'podcast',
        'summary': 'overview',
        'synthesis': 'overview',
        'glossary': 'glossary',
        'resources': 'resources'
      };
      
      const backendToolType = toolTypeMap[toolId];
      if (!backendToolType) return;

      const res = await analysisApi.generateTool(activeAnalysisId, backendToolType, append, force);
      if (res.ok) {
        const updatedAnalysis = await res.json();
        
        setSummaryData(prev => {
          if (!prev) return null;
          return {
            ...prev,
            [backendToolType]: updatedAnalysis[backendToolType]
          };
        });
        
        toast.success(force ? `Mind Map regenerated!` : (append ? `Generated more ${toolId}!` : `${toolId.charAt(0).toUpperCase() + toolId.slice(1)} generated!`));
        refreshHistory();
      } else {
        toast.error(`Failed to generate ${toolId}`);
      }
    } catch (err) {
      logger.error(`Generation error for ${toolId}:`, err);
      toast.error("An error occurred during generation");
    } finally {
      setGeneratingTools(prev => prev.filter(id => id !== toolId));
    }
  }, [activeAnalysisId, refreshHistory]);

  const handleExport = useCallback(async (format: "json" | "markdown") => {
    if (!activeAnalysisId) {
      toast.error("No analysis to export");
      return;
    }
    try {
      const res = await exportApi.download(activeAnalysisId, format);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const ext = format === "markdown" ? "md" : "json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${videoData?.title || "analysis"}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (err: any) {
      logger.error("Export error:", err);
      toast.error("Export failed. Please try again.");
    }
  }, [activeAnalysisId, videoData]);

  const handleLoadHistoryItem = useCallback(async (item: HistoryItem) => {
    setActiveAnalysisId(null); // Force reload on AnalysisPage
    setVideoIds(item.videoIds);
    setVideoData(item.videoData);
    setSummaryData(item.summaryData);
    setTranscript(item.transcript);
    setMetadata(item.metadata);
    // Note: We intentionally don't set activeAnalysisId here so that 
    // AnalysisPage's useEffect will see a mismatch and call loadAnalysis(videoId)
    // for a full, fresh data fetch (especially for transcripts)
    setChatMessages([]);
    setAnalysisStatus("completed");
    setAnalysisProgress(100);

    if (item.id && getAuthToken()) {
      loadChatHistory(item.id);
    }
    navigate(`/analysis/${item.id}`);
  }, [loadChatHistory, navigate]);

  const handleBackToDashboard = useCallback(() => {
    setVideoData(null);
    setSummaryData(null);
    setVideoIds([]);
    setActiveAnalysisId(null);
    setChatMessages([]);
    setAnalysisStatus("idle");
    setAnalysisProgress(0);
    setUserNotes("");
  }, []);

  const handleAddToSpace = useCallback(async (spaceId: string) => {
    if (!videoIds.length || !activeAnalysisId) return;
    try {
      const res = await apiFetch(`/spaces/${spaceId}/videos`, {
        method: "POST",
        body: JSON.stringify({ video_id: activeAnalysisId }),
      });
      if (res.ok) {
        toast.success("Added to space!");
        refreshHistory();
      } else {
        toast.error("Failed to add to space");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  }, [videoIds, activeAnalysisId, refreshHistory]);

  const loadAnalysis = useCallback(async (id: string) => {
    setIsLoading(true);
    // Partial reset to avoid stale content
    setTranscript(null); 
    setSummaryData(null);
    try {
      const res = await apiFetch(`/analysis/${id}`);
      if (res.ok) {
        const data = await res.json();

        // Use shared transformer
        const { videoData, summaryData, metadata } = transformBackendAnalysis(data);

        setVideoIds([data.video.platform_id]);
        setVideoData(videoData);
        setSummaryData(summaryData);
        setTranscript(data.transcript_text || null);
        setMetadata(metadata);
        setUserNotes(data.analysis.user_notes || "");
        setActiveAnalysisId(id);
        setAnalysisStatus("completed");
        setAnalysisProgress(100);

        if (getAuthToken()) {
          // loadChatHistory(id);
        }
      } else {
        toast.error("Failed to load analysis");
      }
    } catch (err) {
      toast.error("An error occurred loading analysis");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleToolClick = useCallback((toolId: string, value?: string, context?: string) => {
    if (value) {
      setIsChatOpen(true);
      if (context) setContextSnippet(context);
      handleSendMessage(value, context, toolId);
      return;
    }

    if (ON_DEMAND_TOOLS.includes(toolId as any)) {
      // Special cases for non-gen tools or specific actions
      if (toolId === TOOL_IDS.DEEPDIVE) {
        setIsChatOpen(true);
        handleSendMessage("Provide an in-depth academic analysis of this video's content...", null, TOOL_IDS.DEEPDIVE);
        toast.info("Generating deep-dive analysis...");
        return;
      }
      if (toolId === TOOL_IDS.VIDEO) {
        // Just open the tab, no AI message needed initially
        return;
      }

      // Check if already available to avoid redundant generation
      const toolKey = TOOL_TYPE_MAP[toolId];
      const data = toolKey ? summaryData?.[toolKey] : null;

      let isAvailable = false;
      if (toolId === TOOL_IDS.PODCAST) {
        isAvailable = !!summaryData?.podcast;
      } else if (Array.isArray(data)) {
        isAvailable = data.length > 0;
      } else {
        isAvailable = !!data;
      }
      
      if (!isAvailable) {
        handleGenerateTool(toolId);
      }
      return;
    }

    if (value) {
      // Intercept regeneration intent in chat with more robustness (typos, shorthand)
      // Done BEFORE toolId check to ensure it works anywhere
      const intent = value.toLowerCase();
      const words = intent.split(/\s+/);
      const hasRe = words.some(w => w.startsWith('re'));
      const hasGen = words.some(w => w.includes('gen'));
      const hasMap = words.some(w => w.includes('map') || w.includes('mind'));
      
      if (hasRe && (hasGen || hasMap)) {
          handleGenerateTool(TOOL_IDS.MIND_MAP, false, true);
          return; // Stop processing further for this command
      }
    }

    if (toolId === TOOL_IDS.ASK || toolId === "action") {
      setIsChatOpen(true);
      if (context) setContextSnippet(context);
      if (value) handleSendMessage(value, context, toolId);
    }

    if (toolId === 'mindmap_regenerate') {
        handleGenerateTool(TOOL_IDS.MIND_MAP, false, true);
    }
  }, [handleGenerateTool, handleSendMessage, setContextSnippet, setIsChatOpen, summaryData]);

  const handleTimestampClick = useCallback((seconds: number) => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: "seekTo", args: [seconds, true] }),
      "*"
    );
  }, []);

  const clearExplanation = useCallback(() => {
    setAiExplanation(null);
    setQuizAIExplanation(null);
    setRoadmapAIExplanation(null);
  }, []);

  // Cleanup: abort any ongoing polling when provider unmounts
  useEffect(() => {
    return () => {
      pollingAbortControllerRef.current?.abort();
    };
  }, []);

  return (
    <AnalysisContext.Provider
      value={{
        videoData,
        videoIds,
        summaryData,
        transcript,
        metadata,
        activeAnalysisId,
        analysisStatus,
        analysisProgress,
        estimatedRemaining,
        chatMessages,
        isChatLoading,
        isLoading,
        currentTime,
        setCurrentTime,
        contextSnippet,
        setContextSnippet,
        aiExplanation,
        setAiExplanation,
        quizAIExplanation,
        setQuizAIExplanation,
        roadmapAIExplanation,
        setRoadmapAIExplanation,
        generatingTools,
        handleSubmit,
        handleSendMessage,
        handleGenerateTool,
        handleExport,
        handleLoadHistoryItem,
        handleBackToDashboard,
        handleToolClick,
        handleTimestampClick,
        handleAddToSpace,
        loadAnalysis,
        clearExplanation,
        isChatOpen,
        setIsChatOpen,
        analysisStyle,
        setAnalysisStyle,
        userNotes,
        updateUserNotes,
        isNotesSaving
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysisContext() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysisContext must be used within AnalysisProvider");
  return ctx;
}
