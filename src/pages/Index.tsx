import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Share2, 
  ChevronLeft,
  Search,
  PlusCircle,
  FolderOpen,
  MessageSquare,
  History as HistoryIcon,
  Library as LibraryIcon,
  X,
  CreditCard,
  User as UserIcon,
  Shield,
  Moon,
  Trash2,
  Download,
  ExternalLink,
  ChevronRight,
  Coins,
  Play,
  MoreHorizontal,
  Menu,
  FileDown,
  Upload,
  GraduationCap
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import LearnTools from "@/components/LearnTools";
import UrlInput from "@/components/UrlInput";
import AIChatSidebar from "@/components/AIChatSidebar";
import { cn } from "@/lib/utils";
import VideoPreview from "@/components/VideoPreview";
import SummaryDisplay from "@/components/SummaryDisplay";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  getHistory, 
  saveHistory, 
  getSpaces, 
  createSpace, 
  fetchHistory,
  fetchSpaces,
  addVideoToSpace,
  deleteHistory,
  clearHistory,
  renameSpace,
  deleteSpace,
  HistoryItem, 
  Space,
  VideoData,
  SummaryData,
  Metadata
} from "@/lib/storage";
import { 
  apiFetch, 
  videoApi, 
  getAuthToken,
  authApi,
  creditApi,
  paymentApi,
  exportApi,
  chatApi,
  removeAuthToken 
} from "@/lib/api";
import { extractVideoId, POLL_INTERVAL_MS, POLL_MAX_ATTEMPTS, MAX_RECENTS_SHOWN, MAX_CHAT_HISTORY_CONTEXT, STORAGE_KEYS, API_BASE_URL } from "@/lib/constants";
import { logger } from "@/lib/logger";

const Index = () => {
  const [activeView, setActiveView] = useState<"dashboard" | "analysis" | "history" | "library" | "space" | "settings">("dashboard");
  const [expertise, setExpertise] = useState<"Beginner" | "Intermediate" | "Expert">("Intermediate");
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // ... existing states
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [videoIds, setVideoIds] = useState<string[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Chat/Advanced Logic
  const [chatMessages, setChatMessages] = useState<Array<{role: "user" | "assistant", content: string}>>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [contextSnippet, setContextSnippet] = useState<string | null>(null);

  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [isProfileUpdateOpen, setIsProfileUpdateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [estimatedRemaining, setEstimatedRemaining] = useState<number | null>(null);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isVideoMinimized, setIsVideoMinimized] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isMobileLearnOpen, setIsMobileLearnOpen] = useState(false);
  const [analysisStyle, setAnalysisStyle] = useState<string>("");

  // User & Auth State
  const [user, setUser] = useState<any>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [deleteSpaceConfirmId, setDeleteSpaceConfirmId] = useState<string | null>(null);

  const fetchTransactions = async () => {
    try {
      const res = await creditApi.getHistory();
      if (res.ok) {
        setTransactions(await res.json());
      }
    } catch (err) {
      logger.error("Failed to fetch transactions:", err);
    }
  };

  const fetchUserData = async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setCredits(null);
      return;
    }
    try {
      const [userRes, creditRes] = await Promise.all([
        authApi.getMe(),
        creditApi.getBalance()
      ]);
      
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData);
        localStorage.setItem(STORAGE_KEYS.USER_NAME, userData.name || '');
        localStorage.setItem(STORAGE_KEYS.USER_EMAIL, userData.email || '');
      }
      
      if (creditRes.ok) {
        const creditData = await creditRes.json();
        setCredits(creditData.balance);
        localStorage.setItem(STORAGE_KEYS.USER_BALANCE, String(creditData.balance));
      }
      fetchTransactions();
    } catch (err) {
      logger.error("Auth sync failed", err);
    }
  };

  const handleLogout = () => {
    removeAuthToken();
    setUser(null);
    setCredits(null);
    localStorage.removeItem(STORAGE_KEYS.USER_NAME);
    localStorage.removeItem(STORAGE_KEYS.USER_EMAIL);
    localStorage.removeItem(STORAGE_KEYS.USER_BALANCE);
    setActiveView("dashboard");
    toast.info("Logged out");
  };

  const handleUpdateProfile = async () => {
    if (!newName.trim()) return;
    try {
      const res = await authApi.updateMe({ name: newName.trim() });
      if (res.ok) {
        const updatedUser = await res.json();
        setUser(updatedUser);
        localStorage.setItem(STORAGE_KEYS.USER_NAME, updatedUser.name);
        setIsProfileUpdateOpen(false);
        toast.success("Profile updated!");
      } else {
        toast.error("Failed to update profile");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  };

  useEffect(() => {
    const loadedHistory = getHistory();
    const loadedSpaces = getSpaces();
    setHistoryItems(loadedHistory);
    setSpaces(loadedSpaces);

    const handleSelection = () => {
      const selection = window.getSelection()?.toString().trim();
      if (selection && selection.length > 5) {
        setContextSnippet(selection);
        if (!isChatOpen) setIsChatOpen(true);
      }
    };
    
    document.addEventListener("mouseup", handleSelection);
    return () => document.removeEventListener("mouseup", handleSelection);
  }, [isChatOpen]);

  // YouTube Progress Tracking
  useEffect(() => {
    if (activeView !== "analysis" || !iframeRef.current) return;

    const interval = setInterval(() => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: "listening", id: 1, channel: "widget" }),
          "*"
        );
      }
    }, 500);

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data.event === "infoDelivery" && data.info && data.info.currentTime !== undefined) {
          setCurrentTime(data.info.currentTime);
        }
      } catch (e) {
        // Not a JSON message or not from YT
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      clearInterval(interval);
      window.removeEventListener("message", handleMessage);
    };
  }, [activeView, videoIds]);

  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token && ["history", "library", "space", "settings"].includes(activeView)) {
      setActiveView("dashboard");
    }
    // Scroll to top on view change
    document.getElementById("main-content")?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeView]);

  const handlePayment = async (plan: string) => {
    try {
      if (!(window as any).Razorpay) {
        toast.error("Razorpay SDK not loaded. Please check your internet connection and refresh.");
        return;
      }

      const res = await paymentApi.createOrder({ plan });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: "Failed to create order" }));
        throw new Error(errData.detail || "Failed to create order");
      }
      
      const order = await res.json();

      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "YouLearn AI",
        description: `Upgrade to ${plan.toUpperCase()}`,
        order_id: order.order_id,
        handler: async (response: any) => {
          try {
            const verifyRes = await paymentApi.verify({
              razorpay_order_id: order.order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            if (verifyRes.ok) {
              toast.success("Payment successful! Credits added.");
              setIsTopUpOpen(false);
              fetchUserData(); // Refresh credits
            } else {
              const verifyErr = await verifyRes.json().catch(() => ({ detail: "Verification failed" }));
              toast.error(verifyErr.detail || "Payment verification failed.");
            }
          } catch (vErr) {
            toast.error("An error occurred during verification.");
          }
        },
        prefill: {
          name: user?.name,
          email: user?.email,
        },
        theme: {
          color: "#000000",
        },
        modal: {
          ondismiss: function() {
            toast.info("Payment cancelled.");
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        toast.error(`Payment failed: ${response.error.description}`);
      });
      rzp.open();
    } catch (err: any) {
      logger.error("Payment initiation error:", err);
      toast.error(err.message || "Payment initiation failed");
    }
  };

  const handleSendMessage = async (content: string) => {
    const finalContent = content;
    const newUserMsg = { role: "user" as const, content: contextSnippet ? `[Context: ${contextSnippet}]\n\n${finalContent}` : finalContent };
    const updatedMessages = [...chatMessages, newUserMsg];
    setChatMessages(updatedMessages);
    setIsChatLoading(true);
    setContextSnippet(null);

    try {
      if (activeAnalysisId) {
        // Use streaming RAG chat endpoint
        const response = await fetch(`${API_BASE_URL}/chat/${activeAnalysisId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAuthToken()}`,
          },
          body: JSON.stringify({
            message: newUserMsg.content,
            chatHistory: chatMessages.slice(-MAX_CHAT_HISTORY_CONTEXT)
          }),
        });

        if (!response.ok) throw new Error("Chat failed");

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let assistantMsgContent = "";
        
        // Add empty assistant message placeholder
        setChatMessages(prev => [...prev, { role: "assistant", content: "" }]);

        while (true) {
          const { done, value } = await reader!.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim(); // Use trim() instead of strip()
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
                // Sources can be handled here if needed
              } catch (e) {
                logger.warn("Error parsing chunk", e);
              }
            }
          }
        }
      } else {
        // Fallback or generic chat (non-streaming for now)
        const responseData = await apiFetch("/videos/analyze", {
          method: "POST",
          body: JSON.stringify({
            urls: videoIds.map(id => `https://youtube.com/watch?v=${id}`),
            style: `Chat Mode: ${content}`,
            expertise: (expertise || "intermediate").toLowerCase(),
            chatHistory: updatedMessages.slice(-5)
          }),
        }).then(res => res.json());

        const aiResponse = responseData.answer || responseData?.analysis?.overview || responseData?.summary || "I couldn't process that. Try asking something else!";
        setChatMessages(prev => [...prev, { role: "assistant", content: aiResponse as string }]);
      }
    } catch (err: any) {
      logger.error("Chat error:", err);
      toast.error(err.message || "AI Assistant is having trouble. Try again.");
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSubmit = async (urls: string[], options: any = {}) => {
    const ids = urls.map(u => extractVideoId(u)).filter(Boolean) as string[];
    if (!ids.length) {
      toast.error("No valid YouTube URLs found.");
      return;
    }

    const expertLevel = options.expertise || expertise; 
    
    setIsLoading(true);

    try {
      const res = await apiFetch("/videos/analyze", {
        method: "POST",
        body: JSON.stringify({
          urls: ids.map(id => `https://youtube.com/watch?v=${id}`),
          expertise: expertLevel.toLowerCase(),
          full_analysis: options.full_analysis ?? true,
          style: options.style || analysisStyle || undefined,
          ...options
        }),
      });

      if (res.status === 402) {
        setIsTopUpOpen(true);
        toast.error("Insufficient credits. Please top up to continue.");
        return;
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Analysis failed");
      }

      // ONLY switch views and start polling if API call succeeded
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
      setActiveView("analysis");

      const { message } = await res.json();
      const analysisId = message.match(/[0-9a-fA-F-]{36}/)?.[0];
      
      if (!analysisId) throw new Error("No analysis ID returned");

      setActiveAnalysisId(analysisId);
      setAnalysisStatus("pending");
      
      // Refresh history list immediately so user sees it "processing"
      setHistoryItems(await fetchHistory());

      const data = await pollAnalysis(analysisId, ids);
      if (data) {
        toast.success("Analysis complete!");
      }
    } catch (err: any) {
      logger.error("Summarize error:", err);
      toast.error(err.message || "Failed to analyze video");
    } finally {
      setIsLoading(false);
    }
  };

  const pollAnalysis = async (analysisId: string, videoIds: string[]) => {
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
        
        // Update progress state
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
        } else if (statusData.status === "failed") {
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

      setVideoIds([video.platform_id || videoIds[0]]);
      setVideoData(vData);
      setSummaryData(sData);
      setTranscript(transcript_text);
      setMetadata(mData);
      setActiveView("analysis");
      
      saveHistory({
        title: vData.title,
        videoIds: [video.platform_id || videoIds[0]],
        videoData: vData,
        summaryData: sData,
        transcript: transcript_text,
        metadata: mData,
        status: "completed"
      });

      setAnalysisStatus(null);
      setAnalysisProgress(0);
      setHistoryItems(await fetchHistory());
      return data;
    }
    return null;
  };

  const handleTimestampClick = (seconds: number) => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: "seekTo", args: [seconds, true] }),
      "*"
    );
  };

  const handleBackToDashboard = () => {
    setActiveView("dashboard");
    setVideoData(null);
    setSummaryData(null);
    setVideoIds([]);
    setSelectedSpace(null);
    setActiveAnalysisId(null);
    setChatMessages([]);
  };

  const handleExport = async (format: "json" | "markdown") => {
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
  };

  const loadChatHistory = async (analysisId: string) => {
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
  };

  const handleToolClick = (toolId: string, value?: string) => {
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
      setIsChatOpen(true);
      handleSendMessage("Create a podcast-style script that covers the main topics of this video in a conversational tone. Include an intro, main discussion points, and a closing summary.");
      toast.info("Generating podcast script...");
    } else if (toolId === "deepdive") {
      setIsChatOpen(true);
      handleSendMessage("Provide an in-depth academic analysis of this video's content, including key arguments, evidence, critical evaluation, and connections to broader topics.");
      toast.info("Generating deep-dive analysis...");
    } else if (toolId === "notes") {
      setIsChatOpen(true);
      handleSendMessage("Create comprehensive study notes from this video. Include key definitions, important concepts, examples mentioned, and a brief summary of each major section.");
      toast.info("Generating study notes...");
    } else if (toolId === "ask" && value) {
      setIsChatOpen(true);
      handleSendMessage(value);
    } else if (toolId === "action" && value) {
      setIsChatOpen(true);
      handleSendMessage(value);
    }
  };

  const handleLoadHistoryItem = async (item: HistoryItem) => {
    if (!getAuthToken()) {
      toast.error("Please sign in to view history items");
      return;
    }
    
    setVideoIds(item.videoIds);
    setVideoData(item.videoData);
    setSummaryData(item.summaryData);
    setTranscript(item.transcript);
    setMetadata(item.metadata);
    setActiveAnalysisId(item.id);
    setActiveView("analysis");
    setChatMessages([]);

    // Load chat history from backend
    if (item.id && getAuthToken()) {
      loadChatHistory(item.id);
    }

    // Fetch full details if it's already completed to ensure transcript is loaded
    if (item.status === "completed") {
      try {
        const res = await apiFetch(`/analysis/${item.id}`);
        if (res.ok) {
          const data = await res.json();
          const { analysis, video, transcript_text, transcript_segments } = data;
          
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

          setSummaryData(sData);
          setTranscript(transcript_text);
        }
      } catch (err) {
        logger.error("Failed to fetch full analysis details:", err);
      }
    }

    if (item.status === "pending" || item.status === "queued" || (!item.summaryData.overview && item.status !== "failed")) {
        setAnalysisStatus("pending");
        setActiveAnalysisId(item.id);
        toast.info("Resuming analysis processing...");
        await pollAnalysis(item.id, item.videoIds);
        toast.success("Analysis restored and completed!");
    } else {
        toast.success(`Loaded: ${item.title}`);
    }
  };

  const handleDeleteHistoryItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteHistory(id, id); 
    setHistoryItems(prev => prev.filter(item => item.id !== id));
    toast.success("Item removed from history");
  };

  const handleClearHistory = async () => {
    await clearHistory();
    setHistoryItems([]);
    toast.success("History cleared!");
  };

  const getRelativeDate = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const handleSidebarClick = (view: string | { type: string; id: string; name: string }) => {
    if (typeof view === "string") {
      if (view === "Search" || view === "Add Content") {
        setActiveView("dashboard");
        setSelectedSpace(null);
      } else if (view === "History") {
        setActiveView("history");
        setSelectedSpace(null);
      } else if (view === "My Library") {
        setActiveView("library");
        setSelectedSpace(null);
      } else if (view === "Analysis") {
        if (videoData) {
          setActiveView("analysis");
          setSelectedSpace(null);
        } else toast.error("No active analysis. Start a search first.");
      } else if (view === "Settings") {
        setActiveView("settings");
        setSelectedSpace(null);
      }
    } else if (view.type === "Space") {
      const updatedSpaces = getSpaces();
      const space = updatedSpaces.find(s => s.id === view.id);
      if (space) {
        setSelectedSpace(space);
        setActiveView("space");
      }
    }
  };

  const handleCreateNewSpace = async (name: string) => {
    const space = await createSpace(name);
    if (space) {
       setSpaces([...spaces, space]);
       toast.success(`Space "${name}" created`);
    }
  };

  const handleRenameSpace = async (id: string, name: string) => {
    await renameSpace(id, name);
    setSpaces(prev => prev.map(s => s.id === id ? { ...s, name } : s));
    toast.success("Space renamed");
  };

  const handleDeleteSpace = async (id: string) => {
    setDeleteSpaceConfirmId(id);
  };

  const confirmDeleteSpace = async () => {
    if (!deleteSpaceConfirmId) return;
    await deleteSpace(deleteSpaceConfirmId);
    setSpaces(prev => prev.filter(s => s.id !== deleteSpaceConfirmId));
    if (selectedSpace?.id === deleteSpaceConfirmId) {
      setSelectedSpace(null);
      setActiveView("dashboard");
    }
    toast.success("Space deleted");
    setDeleteSpaceConfirmId(null);
  };

  const handleAddToSpace = async (spaceId: string) => {
    if (activeView === "analysis" && videoIds.length > 0) {
      const space = spaces.find(s => s.id === spaceId);
      await addVideoToSpace(spaceId, videoIds[0]);
      setSpaces(await fetchSpaces());
      toast.success(`Added to ${space?.name}`);
    }
  };

  const submitFeedback = () => {
    if (feedbackText.trim()) {
      toast.success("Thank you for your feedback!");
      setIsFeedbackOpen(false);
      setFeedbackText("");
    }
  };

  return (
    <div className="flex bg-white h-screen overflow-hidden text-foreground">
      {/* Sidebar - hidden on mobile unless toggled, always visible on desktop unless focus mode */}
      {!isFocusMode && (
        <>
          {/* Mobile overlay */}
          <AnimatePresence>
            {isSidebarOpen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 lg:hidden"
                onClick={() => setIsSidebarOpen(false)}
              />
            )}
          </AnimatePresence>
          <div className={cn(
            "fixed lg:relative z-50 lg:z-auto transition-transform duration-300 ease-out",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}>
            <Sidebar 
              onViewChange={(view) => {
                handleSidebarClick(view);
                // Close sidebar on mobile after navigation
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }} 
              activeView={
                activeView === "dashboard" ? "Search" : 
                activeView === "space" ? selectedSpace?.name :
                activeView === "settings" ? "Settings" :
                activeView.charAt(0).toUpperCase() + activeView.slice(1)
              }
              recents={historyItems.slice(0, 5).map(h => h.title)}
              spaces={spaces}
              onCreateSpace={handleCreateNewSpace}
              onRenameSpace={handleRenameSpace}
              onDeleteSpace={handleDeleteSpace}
              user={user}
              credits={credits}
              onLogout={handleLogout}
              onAuthSuccess={fetchUserData}
              onTopUp={() => setIsTopUpOpen(true)}
            />
          </div>
        </>
      )}
      
      {/* ... Feedback Dialog ... */}
      <Dialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
        {/* ... Feedback Dialog Content ... */}
        <DialogContent className="rounded-3xl border-gray-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Send Feedback</DialogTitle>
            <DialogDescription className="text-sm font-medium text-gray-500">
              Help us improve YouLearn. What's on your mind?
            </DialogDescription>
          </DialogHeader>
          <Textarea 
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="I love the synthesis mode but..." 
            className="min-h-[120px] rounded-2xl border-gray-100 focus:ring-1 focus:ring-black"
          />
          <DialogFooter>
            <Button onClick={submitFeedback} className="rounded-xl font-semibold text-sm h-10 px-6 bg-black text-white">Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isProfileUpdateOpen} onOpenChange={setIsProfileUpdateOpen}>
        <DialogContent className="rounded-3xl border-gray-100 shadow-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Update Profile</DialogTitle>
            <DialogDescription className="text-xs font-medium text-gray-500">
              Change your display name below.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input 
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Full Name"
              className="rounded-2xl border-gray-100 focus:ring-1 focus:ring-black h-12 px-4 font-medium"
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button onClick={handleUpdateProfile} className="rounded-xl flex-1 font-semibold text-sm bg-black text-white px-8">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTopUpOpen} onOpenChange={setIsTopUpOpen}>
        <DialogContent className="rounded-[2.5rem] border-gray-100 shadow-2xl max-w-2xl p-0 overflow-hidden bg-white">
          <DialogTitle className="sr-only">Top Up Credits</DialogTitle>
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="p-8 md:p-10 bg-gray-50/50 border-r border-gray-100">
               <div className="flex items-center gap-2 mb-6 text-black">
                 <div className="p-2 bg-black rounded-xl">
                   <Coins className="h-5 w-5 text-white" />
                 </div>
                 <span className="text-sm font-bold">Top Up Credits</span>
               </div>
               <h2 className="text-3xl font-bold tracking-tight leading-none mb-4">Fuel Your Learning.</h2>
               <p className="text-sm font-medium text-gray-500 mb-8 max-w-[240px]">Get access to more deep-dives, podcast synthesis, and advanced AI models.</p>
               
               <div className="space-y-4">
                  <div className="flex items-center gap-3 text-xs font-medium text-gray-500">
                    <div className="h-1 w-1 rounded-full bg-black" />
                    Unlimited Transcript Extraction
                  </div>
                  <div className="flex items-center gap-3 text-xs font-medium text-gray-500">
                    <div className="h-1 w-1 rounded-full bg-black" />
                    Advanced AI Reasoning Models
                  </div>
                  <div className="flex items-center gap-3 text-xs font-medium text-gray-500">
                    <div className="h-1 w-1 rounded-full bg-black" />
                    Export to PDF, MD, & Notion
                  </div>
               </div>
            </div>

            <div className="p-8 md:p-10 space-y-6">
               <button 
                 onClick={() => handlePayment("starter")}
                 className="w-full group relative p-6 bg-white border border-gray-100 rounded-[2rem] text-left hover:border-black hover:shadow-xl transition-all"
               >
                 <div className="flex justify-between items-start mb-2">
                   <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 group-hover:text-black">Starter</span>
                   <span className="text-2xl font-bold">₹499</span>
                 </div>
                 <h3 className="text-xl font-bold mb-1">500 Credits</h3>
                 <p className="text-[10px] font-bold text-gray-400 group-hover:text-gray-500 transition-colors">Perfect for occasional researchers.</p>
               </button>

               <button 
                 onClick={() => handlePayment("pro")}
                 className="w-full group relative p-6 bg-black text-white border border-black rounded-[2rem] text-left hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)] transition-all overflow-hidden"
               >
                 <div className="absolute top-4 right-4 px-2 py-0.5 bg-white/20 rounded-full text-[9px] font-semibold uppercase backdrop-blur-md">Best Value</div>
                 <div className="flex justify-between items-start mb-2">
                   <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Pro Miner</span>
                   <span className="text-2xl font-bold">₹1499</span>
                 </div>
                 <h3 className="text-xl font-bold mb-1">2000 Credits</h3>
                 <p className="text-[10px] font-bold text-white/40 group-hover:text-white/60 transition-colors">For serious learners and power users.</p>
               </button>

               <p className="text-[10px] font-medium text-center text-gray-400 px-4">Secure payment via Razorpay. Credits expire 12 months from purchase.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Space Confirmation */}
      <Dialog open={!!deleteSpaceConfirmId} onOpenChange={() => setDeleteSpaceConfirmId(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Space</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this space? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDeleteSpaceConfirmId(null)} className="flex-1 rounded-lg">Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteSpace} className="flex-1 rounded-lg">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {activeView === "analysis" && (
        <>
          <AIChatSidebar 
            messages={chatMessages}
            onSendMessage={handleSendMessage}
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            isLoading={isChatLoading}
            contextSnippet={contextSnippet}
            onClearContext={() => setContextSnippet(null)}
          />
          {!isChatOpen && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              onClick={() => setIsChatOpen(true)}
              className="fixed bottom-8 right-8 w-14 h-14 bg-black text-white rounded-2xl shadow-2xl flex items-center justify-center z-50 hover:scale-110 active:scale-95 transition-all"
            >
              <MessageSquare className="h-6 w-6" />
            </motion.button>
          )}
        </>
      )}
      
      <main id="main-content" role="main" aria-label="Main content" className="flex-1 relative overflow-y-auto scrollbar-thin">
        {/* Top Bar */}
        <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 px-6 py-2.5 flex items-center justify-between">
           <div className="flex items-center gap-3 min-w-0">
              {isFocusMode && (
                <button 
                  onClick={() => setIsFocusMode(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-all shrink-0"
                >
                  <PlusCircle className="h-5 w-5 rotate-45" />
                </button>
              )}
              {!isFocusMode && (
                <button 
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-all shrink-0 lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </button>
              )}
              {!isFocusMode && (
                <div className="flex items-center gap-1.5 shrink-0 lg:hidden">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <path d="M4 6h2v12H4V6zm6 0h2v12h-2V6z" fill="currentColor"/>
                  </svg>
                </div>
              )}
              {activeView === "analysis" && videoData ? (
                <div className="flex items-center gap-2 min-w-0">
                  <button 
                    onClick={() => setActiveView("dashboard")} 
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
                    aria-label="Back to dashboard"
                  >
                    <ChevronLeft className="h-4 w-4 text-gray-400" />
                  </button>
                  <h1 className="text-sm font-medium text-foreground truncate">{videoData.title}</h1>
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-gray-50 p-0.5 rounded-lg border border-gray-100">
                   {(["Beginner", "Intermediate", "Expert"] as const).map((level) => (
                      <button
                        key={level}
                        onClick={() => setExpertise(level)}
                        className={cn(
                          "px-3 py-1.5 text-xs rounded-md transition-all",
                          expertise === level ? "bg-white text-foreground font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {level}
                      </button>
                   ))}
                </div>
              )}
           </div>
           
           <div className="flex items-center gap-2 shrink-0">
              {activeView === "analysis" && activeAnalysisId && summaryData && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport("markdown")}
                    className="rounded-lg h-8 px-3 text-xs font-medium border-gray-200 gap-1.5 hidden sm:inline-flex"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Export MD
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport("json")}
                    className="rounded-lg h-8 px-3 text-xs font-medium border-gray-200 gap-1.5 hidden md:inline-flex"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Export JSON
                  </Button>
                </>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsTopUpOpen(true)}
                className="rounded-full h-8 px-4 text-xs font-medium bg-green-600 hover:bg-green-700 text-white hidden sm:inline-flex"
              >
                Upgrade
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFocusMode(!isFocusMode)}
                className={cn(
                  "rounded-lg h-8 px-3 text-xs font-medium border-gray-200 hidden md:inline-flex",
                  isFocusMode && "bg-gray-900 text-white border-gray-900"
                )}
              >
                {isFocusMode ? "Exit Focus" : "New Exam"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const url = window.location.href;
                  navigator.clipboard.writeText(url);
                  toast.success("Link copied!");
                }}
                className="rounded-lg h-8 px-3 text-xs font-medium border-gray-200 hidden md:inline-flex"
              >
                Share
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
           </div>
        </div>

        <AnimatePresence mode="wait">
          {activeView === "analysis" && videoData ? (
            <motion.div 
              key="analysis"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full"
            >
              <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                <div className="max-w-4xl mx-auto space-y-6 pb-20">
                  <div className={cn(
                    "transition-all duration-500 ease-in-out origin-top relative group",
                    isVideoMinimized ? "h-0 opacity-0 pointer-events-none mb-0 overflow-hidden" : "h-auto opacity-100"
                  )}>
                    {!isVideoMinimized && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsVideoMinimized(true)}
                        className="absolute top-4 right-6 z-50 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Minimize Video"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    <VideoPreview 
                      videoId={videoIds[0]} 
                      {...videoData}
                      thumbnail={`https://img.youtube.com/vi/${videoIds[0]}/maxresdefault.jpg`}
                      iframeRef={iframeRef} 
                    />
                  </div>

                  {isVideoMinimized && (
                    <motion.div 
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="sticky top-0 z-40 pb-4"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsVideoMinimized(false)}
                        className="w-full rounded-2xl border-dashed border-gray-200 bg-gray-50/50 hover:bg-gray-100 transition-all font-bold uppercase tracking-widest text-[10px] h-10 gap-2"
                      >
                        <Play className="h-3 w-3" /> Show Video Player
                      </Button>
                    </motion.div>
                  )}
                  
                  {isLoading || (activeAnalysisId && !summaryData) ? (
                    <motion.div 
                      key="loading"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="py-12"
                    >
                      <div className="mb-12 bg-gray-50/50 border border-gray-100 p-8 rounded-[2.5rem] shadow-sm">
                        <div className="flex items-end justify-between mb-8">
                           <div>
                             <h2 className="text-2xl font-bold mb-2">Analyzing Intelligence</h2>
                             <div className="flex items-center gap-3">
                               <div className="flex items-center gap-1.5">
                                 <div className={cn("h-1.5 w-1.5 rounded-full animate-pulse", analysisProgress < 30 ? "bg-amber-500" : analysisProgress < 70 ? "bg-blue-500" : "bg-green-500")} />
                                 <span className="text-xs font-medium text-gray-400">
                                   {analysisProgress < 20 ? "Extracting Metadata" : 
                                    analysisProgress < 50 ? "Generating Transcript" : 
                                    analysisProgress < 80 ? "AI Synthesis Pipeline" : 
                                    "Polishing Results"}
                                 </span>
                               </div>
                             </div>
                           </div>
                           <div className="text-right">
                             <p className="text-xs font-medium text-gray-300 mb-1">Overall Progress</p>
                             <div className="flex flex-col items-end">
                               <span className="text-4xl font-bold leading-none text-black">{analysisProgress}%</span>
                               {estimatedRemaining !== null && estimatedRemaining > 0 && (
                                 <span className="text-xs font-medium text-blue-500 mt-2">
                                   Est. Remaining: {Math.floor(estimatedRemaining / 60)}:{String(estimatedRemaining % 60).padStart(2, '0')}
                                 </span>
                               )}
                             </div>
                           </div>
                        </div>
                        
                        <div className="relative h-4 w-full bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-inner">
                           <motion.div 
                             className="absolute inset-y-0 left-0 bg-black"
                             initial={{ width: 0 }}
                             animate={{ width: `${analysisProgress}%` }}
                             transition={{ duration: 0.8, ease: "circOut" }}
                           />
                        </div>
                        
                        <div className="grid grid-cols-4 gap-2 mt-4">
                           {[25, 50, 75, 100].map((step) => (
                             <div key={step} className={cn(
                               "h-1 rounded-full transition-colors duration-500",
                               analysisProgress >= step ? "bg-black" : "bg-gray-200"
                             )} />
                           ))}
                        </div>
                      </div>
                      <div className="opacity-40 grayscale pointer-events-none">
                        <LoadingSkeleton />
                      </div>
                    </motion.div>
                  ) : summaryData ? (
                    <SummaryDisplay 
                      {...summaryData}
                      transcript={transcript}
                      transcript_segments={summaryData.transcript_segments}
                      onTimestampClick={handleTimestampClick}
                      spaces={spaces}
                      onAddToSpace={handleAddToSpace}
                      currentTime={currentTime}
                    />
                  ) : null}
                </div>
              </div>
              
              <LearnTools 
                onToolClick={handleToolClick} 
                hasQuiz={!!summaryData?.quiz?.length}
                hasFlashcards={!!summaryData?.flashcards?.length}
                hasRoadmap={!!summaryData?.roadmap}
                hasMindMap={!!summaryData?.mind_map?.nodes?.length}
                isChatLoading={isChatLoading}
                sets={[
                  ...(summaryData?.quiz?.length ? [{ id: 'quiz-set', name: `Quiz (${summaryData.quiz.length} questions)`, date: 'Generated', type: 'quiz' }] : []),
                  ...(summaryData?.flashcards?.length ? [{ id: 'flashcard-set', name: `Flashcards (${summaryData.flashcards.length} cards)`, date: 'Generated', type: 'flashcards' }] : []),
                  ...(summaryData?.roadmap ? [{ id: 'roadmap-set', name: `Learning Roadmap`, date: 'Generated', type: 'roadmap' }] : []),
                ]}
              />

              {/* Mobile Learn Tools Toggle */}
              <button
                onClick={() => setIsMobileLearnOpen(!isMobileLearnOpen)}
                className="lg:hidden fixed bottom-6 right-6 z-50 w-14 h-14 bg-black text-white rounded-2xl shadow-xl flex items-center justify-center hover:bg-gray-800 transition-all"
                aria-label="Open learning tools"
              >
                <GraduationCap className="h-6 w-6" />
              </button>

              {/* Mobile Learn Tools Panel */}
              <AnimatePresence>
                {isMobileLearnOpen && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }}
                      className="lg:hidden fixed inset-0 bg-black/20 z-40"
                      onClick={() => setIsMobileLearnOpen(false)}
                    />
                    <motion.div 
                      initial={{ y: "100%" }} 
                      animate={{ y: 0 }} 
                      exit={{ y: "100%" }}
                      transition={{ type: "spring", damping: 25, stiffness: 300 }}
                      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[70vh] overflow-y-auto"
                    >
                      <div className="p-1 flex justify-center">
                        <div className="w-10 h-1 rounded-full bg-gray-200" />
                      </div>
                      <LearnTools 
                        onToolClick={(id, v) => { handleToolClick(id, v); setIsMobileLearnOpen(false); }}
                        hasQuiz={!!summaryData?.quiz?.length}
                        hasFlashcards={!!summaryData?.flashcards?.length}
                        hasRoadmap={!!summaryData?.roadmap}
                        hasMindMap={!!summaryData?.mind_map?.nodes?.length}
                        isChatLoading={isChatLoading}
                        sets={[
                          ...(summaryData?.quiz?.length ? [{ id: 'quiz-set', name: `Quiz (${summaryData.quiz.length} questions)`, date: 'Generated', type: 'quiz' }] : []),
                          ...(summaryData?.flashcards?.length ? [{ id: 'flashcard-set', name: `Flashcards (${summaryData.flashcards.length} cards)`, date: 'Generated', type: 'flashcards' }] : []),
                          ...(summaryData?.roadmap ? [{ id: 'roadmap-set', name: `Learning Roadmap`, date: 'Generated', type: 'roadmap' }] : []),
                        ]}
                        isMobile
                      />
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </motion.div>
            ) : activeView === "history" || activeView === "library" || activeView === "space" ? (
            <motion.div 
              key={activeView + (selectedSpace?.id || "")}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto py-16 px-6"
            >
              {/* View Heading */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-foreground">
                  {activeView === "history" ? "History" : activeView === "library" ? "My Library" : selectedSpace?.name || "Space"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeView === "history" ? "All your previously analyzed videos" : 
                   activeView === "library" ? "Videos saved to your spaces" :
                   `${selectedSpace?.videoIds.length ?? 0} videos in this space`}
                </p>
              </div>

              {!getAuthToken() ? (
                <div className="text-center py-24">
                  <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-gray-100">
                    <UserIcon className="h-7 w-7 text-gray-200" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-1">Sign in to continue</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                    Log in to access your saved history, library, and learning spaces.
                  </p>
                  <Button onClick={() => setActiveView("dashboard")} className="rounded-xl font-semibold text-sm h-10 px-6 bg-black text-white hover:bg-gray-900">Back to Search</Button>
                </div>
              ) : ((activeView === "history" && historyItems.length > 0) || 
                (activeView === "library" && historyItems.some(h => spaces.some(s => s.videoIds.includes(h.videoIds[0])))) || 
                (activeView === "space" && (selectedSpace?.videoIds.length ?? 0) > 0)) ? (
                <div className="grid gap-3">
                  {(activeView === "space" ? 
                    historyItems.filter(h => selectedSpace?.videoIds.includes(h.videoIds[0])) : 
                    activeView === "library" ?
                    historyItems.filter(h => spaces.some(s => s.videoIds.includes(h.videoIds[0]))) :
                    historyItems
                  ).map((item) => (
                    <motion.button 
                      key={item.id} 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => handleLoadHistoryItem(item)}
                      className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-gray-200 hover:shadow-md transition-all text-left group"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                         <div className="w-24 h-16 bg-gray-100 rounded-xl overflow-hidden shrink-0 border border-gray-50 relative">
                            <img src={`https://img.youtube.com/vi/${item.videoIds[0]}/mqdefault.jpg`} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            {item.status && item.status !== "completed" && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <span className="text-[9px] font-semibold uppercase text-white bg-amber-500 px-1.5 py-0.5 rounded">
                                  {item.status === "failed" ? "Failed" : "Processing"}
                                </span>
                              </div>
                            )}
                         </div>
                         <div className="min-w-0">
                           <h3 className="text-sm font-semibold group-hover:text-black transition-colors line-clamp-1">{item.title}</h3>
                           <div className="flex items-center gap-2 mt-1.5">
                             <span className="text-xs text-muted-foreground">
                               {getRelativeDate(item.date)}
                             </span>
                             {item.videoIds.length > 1 && (
                               <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">
                                 {item.videoIds.length} videos
                               </span>
                             )}
                           </div>
                         </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button 
                          onClick={(e) => handleDeleteHistoryItem(e, item.id)}
                          className="p-2 hover:bg-red-50 text-gray-200 hover:text-red-500 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          aria-label="Delete item"
                        >
                           <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <ChevronRight className="h-4 w-4 text-gray-200 group-hover:text-gray-400 transition-all" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-24">
                  <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-gray-100">
                    {activeView === "history" ? (
                      <HistoryIcon className="h-7 w-7 text-gray-200" />
                    ) : activeView === "library" ? (
                      <LibraryIcon className="h-7 w-7 text-gray-200" />
                    ) : (
                      <FolderOpen className="h-7 w-7 text-gray-200" />
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-1">
                    {activeView === "history" ? "No history yet" : activeView === "library" ? "Your library is empty" : "This space is empty"}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                    {activeView === "history" 
                      ? "Start analyzing a video and it will appear here." 
                      : activeView === "library"
                      ? "Add videos to spaces to build your library."
                      : "Add videos to this space to get started."}
                  </p>
                  <Button 
                    onClick={() => setActiveView("dashboard")} 
                    className="rounded-xl font-semibold text-sm h-10 px-6 bg-black text-white hover:bg-gray-900"
                  >
                    Start Learning
                  </Button>
                </div>
              )}
            </motion.div>
          ) : activeView === "settings" ? (
            <motion.div 
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-4xl mx-auto py-16 px-6"
            >
              <h1 className="text-2xl font-bold text-foreground mb-8">Settings</h1>
              
              {!user ? (
                <div className="text-center py-24">
                  <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-gray-100">
                    <UserIcon className="h-7 w-7 text-gray-200" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-1">Sign in to continue</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">Log in to manage your account settings and data.</p>
                  <Button onClick={() => (document.querySelector('[data-auth-trigger]') as HTMLElement)?.click()} className="rounded-xl font-semibold text-sm h-10 px-6 bg-black text-white hover:bg-gray-900">Sign In</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-8 bg-white border border-gray-100 rounded-3xl shadow-sm space-y-6">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Account Profile</h3>
                      <div className="flex items-center gap-4 mb-4">
                        <Avatar className="h-14 w-14 rounded-2xl border-2 border-white shadow-md">
                          <AvatarImage src={user.avatar_url} />
                          <AvatarFallback className="bg-black text-white text-lg font-bold rounded-2xl">
                            {user.name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-base font-bold line-clamp-1">{user.name}</p>
                          <p className="text-sm text-muted-foreground line-clamp-1">{user.email}</p>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setNewName(user.name);
                          setIsProfileUpdateOpen(true);
                        }} 
                        className="w-full rounded-2xl h-11 font-medium text-sm border-gray-100 hover:bg-gray-50"
                      >
                        Manage Account
                      </Button>
                    </div>

                    <div className="border-t pt-6">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Credits & Plan</h3>
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl p-6 border border-gray-100 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-semibold uppercase text-gray-400 mb-1">Balance</p>
                          <div className="flex items-center gap-2">
                             <Coins className="h-5 w-5 text-amber-500 fill-amber-500" />
                             <p className="text-xl font-bold">{credits ?? 0} Credits</p>
                          </div>
                        </div>
                        <Button onClick={() => setIsTopUpOpen(true)} className="rounded-xl bg-black text-white px-4 font-semibold text-xs h-10 shadow-lg">Add Credits</Button>
                      </div>
                      <p className="text-xs font-medium text-muted-foreground text-center mt-4">Standard Plan — Active</p>
                    </div>
                  </div>

                  <div className="space-y-6 flex flex-col h-full bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden min-h-[400px]">
                    <div className="p-8 flex-1 flex flex-col">
                       <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-6">Activity Log</h3>
                       <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                         {transactions.length > 0 ? (
                           transactions.map((tx: any) => (
                             <div key={tx.id} className="flex items-center justify-between p-4 bg-gray-50/50 border border-gray-100/50 rounded-2xl group hover:border-gray-200 transition-all">
                               <div className="flex items-center gap-3">
                                 <div className={cn(
                                   "w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
                                   tx.amount > 0 ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
                                 )}>
                                   <Coins className="h-4 w-4" />
                                 </div>
                                 <div>
                                   <p className="text-xs font-semibold text-foreground capitalize group-hover:text-black transition-colors">
                                     {tx.operation.replace('_', ' ')}
                                   </p>
                                   <p className="text-[10px] text-muted-foreground opacity-60">
                                     {new Date(tx.created_at).toLocaleDateString()} at {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                   </p>
                                 </div>
                               </div>
                               <span className={cn("text-xs font-bold", tx.amount > 0 ? "text-green-600" : "text-amber-600")}>
                                 {tx.amount > 0 ? "+" : ""}{tx.amount}
                               </span>
                             </div>
                           ))
                         ) : (
                           <div className="flex flex-col items-center justify-center h-full text-center py-20 opacity-20">
                              <Coins className="h-12 w-12 mb-3" />
                              <p className="text-xs font-medium">No activity recorded</p>
                           </div>
                         )}
                       </div>
                    </div>
                  </div>

                  <div className="mt-6 p-8 bg-white border border-gray-100 rounded-3xl shadow-sm space-y-4">
                     <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Privacy & Data</h3>
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <Trash2 className="h-4 w-4 text-muted-foreground" />
                           <span className="text-sm font-bold">Delete History</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleClearHistory}
                          className="rounded-xl h-8 px-4 text-xs font-medium text-red-500 hover:bg-red-50"
                        >
                          Clear
                        </Button>
                     </div>
                     <div className="flex items-center justify-between border-t pt-4">
                        <div className="flex items-center gap-3">
                           <Download className="h-4 w-4 text-muted-foreground" />
                           <span className="text-sm font-bold">Export My Data</span>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            const data = JSON.stringify({ 
                              user, 
                              history: historyItems, 
                              spaces,
                              exportedAt: new Date().toISOString()
                            }, null, 2);
                            const blob = new Blob([data], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `youlearn-data-export.json`;
                            a.click();
                            toast.success("Downloading your data...");
                          }}
                          className="rounded-xl h-8 px-4 text-xs font-medium border-gray-100"
                        >
                          Download
                        </Button>
                     </div>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <UrlInput 
                onSubmit={handleSubmit} 
                isLoading={isLoading} 
                onUploadComplete={(id) => toast.success(`Video uploaded (ID: ${id}). Analysis will begin shortly.`)} 
                analysisStyle={analysisStyle}
                onStyleChange={setAnalysisStyle}
              />
              
              <div className="max-w-4xl mx-auto px-6 pb-20">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                    <section>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-6">Recent Spaces</h3>
                      {spaces.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3">
                          {spaces.slice(0, 3).map(space => (
                            <button 
                              key={space.id} 
                              onClick={() => handleSidebarClick({ type: "Space", id: space.id, name: space.name })}
                              className="w-full flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-gray-200 transition-all text-left shadow-sm group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-50 rounded-xl group-hover:bg-white transition-colors">
                                   <FolderOpen className="h-4 w-4 text-gray-400" />
                                </div>
                                <span className="text-sm font-bold">{space.name}</span>
                              </div>
                              <span className="text-[10px] font-semibold text-muted-foreground">{space.videoIds.length} videos</span>
                            </button>
                          ))}
                          <Button onClick={() => toast.info("Use the sidebar to create new spaces!")} variant="ghost" className="w-full h-12 rounded-2xl border border-dashed text-muted-foreground gap-2">
                             <PlusCircle className="h-4 w-4" />
                             Manage Spaces in Sidebar
                          </Button>
                        </div>
                      ) : (
                        <div className="bg-gray-50/50 rounded-3xl p-8 border border-dashed border-gray-200 text-center">
                           <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                              <PlusCircle className="h-6 w-6 text-gray-400" />
                           </div>
                           <p className="text-sm font-bold text-gray-600">Create your first space</p>
                           <p className="text-xs text-gray-400 mt-1">Organize your learning by topics</p>
                           <Button onClick={() => toast.info("Use the sidebar to create new spaces!")} variant="outline" className="mt-4 rounded-xl font-medium text-xs h-8">Add Space</Button>
                        </div>
                      )}
                    </section>
                    
                    <section>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-6">Continue Learning</h3>
                      <div className="space-y-3">
                         {historyItems.slice(0, 3).map((item) => (
                           <button 
                             key={item.id} 
                             onClick={() => handleLoadHistoryItem(item)}
                             className="w-full flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-2xl hover:border-gray-200 hover:shadow-sm transition-all text-left group"
                           >
                              <div className="w-14 h-10 bg-gray-100 rounded-xl overflow-hidden shrink-0 border border-gray-50">
                                 <img 
                                   src={`https://img.youtube.com/vi/${item.videoIds[0]}/default.jpg`} 
                                   alt="" 
                                   className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                                 />
                              </div>
                              <div className="min-w-0 flex-1">
                                 <p className="text-sm font-semibold truncate group-hover:text-black transition-colors">{item.title}</p>
                                 <p className="text-xs text-muted-foreground mt-0.5">{getRelativeDate(item.date)}</p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-gray-200 group-hover:text-gray-400 shrink-0 transition-colors" />
                           </button>
                         ))}
                         {historyItems.length > 3 && (
                           <Button onClick={() => setActiveView("history")} variant="link" className="w-full text-center text-xs font-medium text-muted-foreground">View all history</Button>
                         )}
                         {historyItems.length === 0 && (
                           <div className="py-10 text-center">
                              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-gray-100">
                                 <HistoryIcon className="h-5 w-5 text-gray-300" />
                              </div>
                              <p className="text-sm font-medium text-gray-400">No recent activity</p>
                              <p className="text-xs text-gray-300 mt-1">Your analyzed videos will show up here</p>
                           </div>
                         )}
                      </div>
                    </section>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Index;
