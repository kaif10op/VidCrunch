import { useNavigate } from "react-router-dom";
import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { toast } from "sonner";
import { videoApi, apiFetch, chatApi, analysisApi, exportApi } from "@/lib/api";
import { extractVideoId, POLL_INTERVAL_MS, POLL_MAX_ATTEMPTS, API_BASE_URL } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { getAuthToken } from "@/lib/api";
import { useSpacesContext } from "./SpacesContext";
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
  generatingTools: string[];
  handleSubmit: (urls: string[], options?: any) => Promise<void>;
  handleSendMessage: (content: string) => Promise<void>;
  handleGenerateTool: (toolId: string) => Promise<void>;
  handleExport: (format: "json" | "markdown") => Promise<void>;
  handleLoadHistoryItem: (item: HistoryItem) => Promise<void>;
  handleBackToDashboard: () => void;
  handleToolClick: (toolId: string, value?: string) => void;
  handleTimestampClick: (seconds: number) => void;
  handleAddToSpace: (spaceId: string) => Promise<void>;
  loadAnalysis: (analysisId: string) => Promise<void>;
  isChatOpen: boolean;
  setIsChatOpen: (isOpen: boolean) => void;
  analysisStyle: string;
  setAnalysisStyle: (style: string) => void;
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
  const [generatingTools, setGeneratingTools] = useState<string[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [analysisStyle, setAnalysisStyle] = useState("");
  
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const pollAnalysis = useCallback(async (analysisId: string, vIds: string[]) => {
    let completed = false;
    let data = null;
    let attempts = 0;
    
    while (!completed && attempts < POLL_MAX_ATTEMPTS) {
      attempts++;
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      try {
        const statusRes = await apiFetch(`/analysis/${analysisId}/status`);
        if (!statusRes.ok) continue;
        const statusData = await statusRes.json();
        
        if (statusData.progress_percentage !== undefined) {
          setAnalysisProgress(statusData.progress_percentage);
        }
        if (statusData.estimated_remaining_seconds !== undefined) {
          setEstimatedRemaining(statusData.estimated_remaining_seconds);
        }

        if (statusData.status === "completed") {
          const detailRes = await apiFetch(`/analysis/${analysisId}`);
          data = await detailRes.json();
          completed = true;
          setAnalysisProgress(100);
          setAnalysisStatus("completed");
        } else if (statusData.status === "failed") {
          setAnalysisStatus("failed");
          throw new Error(statusData.error || "Analysis task failed");
        }
      } catch (e) {
        logger.warn("Polling attempt failed:", e);
      }
    }

    if (data) {
      const { analysis, video, transcript_text, transcript_segments } = data;
      
      const vData: VideoData = {
        title: video.title || "Video Analysis",
        channel: video.channel || "YouTube",
        duration: video.duration_seconds ? String(video.duration_seconds) : "N/A",
        views: video.view_count ? video.view_count.toLocaleString() : "N/A",
        likes: video.like_count ? video.like_count.toLocaleString() : "N/A",
        published: video.created_at
      };

      const sData: SummaryData = {
        overview: analysis.overview || "",
        keyPoints: analysis.key_points || [],
        takeaways: analysis.takeaways || [],
        timestamps: (analysis.timestamps || []).map((t: any) => ({
          time: t.timestamp !== undefined ? t.timestamp : t.time,
          label: t.topic || t.label
        })),
        tags: analysis.tags || [],
        quiz: analysis.quiz,
        roadmap: analysis.roadmap,
        mind_map: analysis.mind_map,
        flashcards: analysis.flashcards,
        transcript_segments: transcript_segments || analysis.transcript_segments,
        learning_context: analysis.learning_context
      };

      const mData: Metadata = {
        title: vData.title,
        channel: vData.channel,
        duration: vData.duration,
        thumbnails: [{ url: video.thumbnail_url || `https://img.youtube.com/vi/${video.platform_id}/maxresdefault.jpg`, width: 1280, height: 720 }]
      };

      setVideoIds([video.platform_id || vIds[0]]);
      setVideoData(vData);
      setSummaryData(sData);
      setTranscript(transcript_text);
      setMetadata(mData);
      
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
      
      refreshHistory();
      navigate(`/analysis/${analysisId}`);

      const data = await pollAnalysis(analysisId, ids);
      if (data) {
        toast.success("Analysis complete!");
      }
    } catch (err: any) {
      logger.error("Summarize error:", err);
      toast.error(err.message || "Failed to analyze video");
      setAnalysisStatus("failed");
    } finally {
      setIsChatLoading(false);
    }
  }, [pollAnalysis, refreshHistory]);

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

  const handleSendMessage = useCallback(async (content: string) => {
    const finalContent = content;
    const newUserMsg: ChatMessage = { role: "user", content: contextSnippet ? `[Context: ${contextSnippet}]\n\n${finalContent}` : finalContent };
    const updatedMessages = [...chatMessages, newUserMsg];
    setChatMessages(updatedMessages);
    setIsChatLoading(true);
    setContextSnippet(null);

    try {
      if (activeAnalysisId) {
        const response = await fetch(`${API_BASE_URL}/chat/${activeAnalysisId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAuthToken()}`,
          },
          body: JSON.stringify({
            message: newUserMsg.content,
            chatHistory: chatMessages.slice(-5)
          }),
        });

        if (!response.ok) throw new Error("Chat failed");

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let assistantMsgContent = "";
        
        setChatMessages(prev => [...prev, { role: "assistant", content: "" }]);

        while (true) {
          const { done, value } = await reader!.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim();
              if (dataStr === "[DONE]") break;
              
              try {
                const data = JSON.parse(dataStr);
                if (data.type === "chunk") {
                  assistantMsgContent += data.content;
                  setChatMessages(prev => {
                    const newChat = [...prev];
                    newChat[newChat.length - 1].content = assistantMsgContent;
                    return newChat;
                  });
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
  }, [activeAnalysisId, chatMessages, contextSnippet, videoIds]);

  const handleGenerateTool = useCallback(async (toolId: string) => {
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
        'flashcards': 'flashcards',
        'podcast': 'podcast'
      };
      
      const backendToolType = toolTypeMap[toolId];
      if (!backendToolType) return;

      const res = await analysisApi.generateTool(activeAnalysisId, backendToolType);
      if (res.ok) {
        const updatedAnalysis = await res.json();
        
        setSummaryData(prev => {
          if (!prev) return null;
          return {
            ...prev,
            [backendToolType]: updatedAnalysis[backendToolType]
          };
        });
        
        toast.success(`${toolId.charAt(0).toUpperCase() + toolId.slice(1)} generated!`);
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
  }, [loadChatHistory]);

  const handleBackToDashboard = useCallback(() => {
    setVideoData(null);
    setSummaryData(null);
    setVideoIds([]);
    setActiveAnalysisId(null);
    setChatMessages([]);
    setAnalysisStatus("idle");
    setAnalysisProgress(0);
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
        // Reuse handleLoadHistoryItem logic or similar data transformation
        const { analysis, video, transcript_text, transcript_segments } = data;
        
        const vData: VideoData = {
          title: video.title || "Video Analysis",
          channel: video.channel || "YouTube",
          duration: video.duration_seconds ? String(video.duration_seconds) : "N/A",
          views: video.view_count ? video.view_count.toLocaleString() : "N/A",
          likes: video.like_count ? video.like_count.toLocaleString() : "N/A",
          published: video.created_at
        };
  
        const sData: SummaryData = {
          overview: analysis.overview || "",
          keyPoints: analysis.key_points || [],
          takeaways: analysis.takeaways || [],
          timestamps: (analysis.timestamps || []).map((t: any) => ({
            time: t.timestamp !== undefined ? t.timestamp : t.time,
            label: t.topic || t.label
          })),
          tags: analysis.tags || [],
          quiz: analysis.quiz,
          roadmap: analysis.roadmap,
          mind_map: analysis.mind_map,
          flashcards: analysis.flashcards,
          transcript_segments: transcript_segments || analysis.transcript_segments,
          learning_context: analysis.learning_context
        };
  
        const mData: Metadata = {
          title: vData.title,
          channel: vData.channel,
          duration: vData.duration,
          thumbnails: [{ url: video.thumbnail_url || `https://img.youtube.com/vi/${video.platform_id}/maxresdefault.jpg`, width: 1280, height: 720 }]
        };
  
        setVideoIds([video.platform_id]);
        setVideoData(vData);
        setSummaryData(sData);
        setTranscript(transcript_text);
        setMetadata(mData);
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

  const handleToolClick = useCallback((toolId: string, value?: string) => {
    if (["overview", "key_points", "takeaways", "tags", "learning_context", "podcast"].includes(toolId)) {
      handleGenerateTool(toolId);
      return;
    }

    if (["quiz", "roadmap", "mindmap"].includes(toolId)) {
      const el = document.getElementById(toolId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        toast.success(`Scrolled to ${toolId === "quiz" ? "Quiz" : toolId === "roadmap" ? "Roadmap" : "Mind Map"}`);
      } else {
        setIsChatOpen(true);
        handleSendMessage(
          toolId === "quiz" ? "Generate a comprehensive quiz with multiple choice questions to test understanding of this video's content." :
          toolId === "roadmap" ? "Create a step-by-step learning roadmap based on this video's content." :
          "Create a mind map outline showing the key topics and their relationships from this video."
        );
        toast.info("Generating via AI chat...");
      }
    } else if (toolId === "flashcards") {
      const flashcardsTab = document.querySelector('[value="flashcards"]') as HTMLElement;
      if (flashcardsTab) {
        flashcardsTab.click();
        flashcardsTab.scrollIntoView({ behavior: "smooth" });
        toast.success("Scrolled to Flashcards");
      } else {
        setIsChatOpen(true);
        handleSendMessage("Generate a set of flashcards from this video's key concepts. Format each card with a clear question on the front and a concise answer on the back.");
        toast.info("Generating flashcards via AI chat...");
      }
    } else if (toolId === "podcast") {
      handleGenerateTool("podcast");
    } else if (toolId === "deepdive") {
      setIsChatOpen(true);
      handleSendMessage("Provide an in-depth academic analysis of this video's content, including key arguments, evidence, critical evaluation, and connections to broader topics.");
      toast.info("Generating deep-dive analysis...");
    } else if (toolId === "notes") {
      setIsChatOpen(true);
      handleSendMessage("Create comprehensive study notes from this video. Include key definitions, important concepts, examples mentioned, and a brief summary of each major section.");
      toast.info("Generating study notes...");
    } else if (toolId === "ask") {
      setIsChatOpen(true);
      if (value) handleSendMessage(value);
    } else if (toolId === "action" && value) {
      setIsChatOpen(true);
      handleSendMessage(value);
    }
  }, [handleSendMessage]);

  const handleTimestampClick = useCallback((seconds: number) => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: "seekTo", args: [seconds, true] }),
      "*"
    );
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
        isChatOpen,
        setIsChatOpen,
        analysisStyle,
        setAnalysisStyle,
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
