import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Share2, 
  ChevronLeft,
  ChevronRight,
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
  Coins,
  Play,
  MoreHorizontal,
  Menu,
  FileDown,
  Upload,
  GraduationCap,
  ArrowRight,
  LayoutDashboard,
  Library,
  Settings,
  Wallet,
  Bell,
  LogOut,
  HelpCircle,
  AlertCircle
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
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
  setAuthToken,
  authApi,
  creditApi,
  paymentApi,
  exportApi,
  chatApi,
  analysisApi,
  searchApi,
  removeAuthToken 
} from "@/lib/api";
import { extractVideoId, POLL_INTERVAL_MS, POLL_MAX_ATTEMPTS, MAX_RECENTS_SHOWN, MAX_CHAT_HISTORY_CONTEXT, STORAGE_KEYS, API_BASE_URL } from "@/lib/constants";
import { logger } from "@/lib/logger";

const Index = () => {
  const [activeView, setActiveView] = useState<"dashboard" | "analysis" | "history" | "library" | "space" | "settings">("dashboard");
  const [expertise, setExpertise] = useState<"Beginner" | "Intermediate" | "Expert">("Intermediate");
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
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
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("profile");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [generatingTools, setGeneratingTools] = useState<string[]>([]);
  const [isAutoScroll, setIsAutoScroll] = useState(true);

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

  const fetchUserData = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setCredits(null);
      return;
    }
    try {
      const [userRes, creditRes, hItems, sItems] = await Promise.all([
        authApi.getMe(),
        creditApi.getBalance(),
        fetchHistory(),
        fetchSpaces()
      ]);

      setHistoryItems(hItems);
      setSpaces(sItems);

      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData);
        localStorage.setItem(STORAGE_KEYS.USER_NAME, userData.name || '');
        localStorage.setItem(STORAGE_KEYS.USER_EMAIL, userData.email || '');
        
        // Sync settings
        if (userData.settings) {
          if (userData.settings.expertise) {
            const exp = userData.settings.expertise.charAt(0).toUpperCase() + userData.settings.expertise.slice(1);
            setExpertise(exp as any);
          }
        }
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
  }, []); // Empty deps: all used functions are stable (imported or setters)

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
      const res = await authApi.updateMe({ 
        name: newName.trim(),
        settings: {
          expertise: expertise.toLowerCase(),
        }
      });
      if (res.ok) {
        const updatedUser = await res.json();
        setUser(updatedUser);
        localStorage.setItem(STORAGE_KEYS.USER_NAME, updatedUser.name);
        toast.success("Profile and settings updated!");
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
    // Handle OAuth redirect: read token from URL query params after server-side OAuth flow
    const params = new URLSearchParams(window.location.search);
    const oauthToken = params.get("token");
    const oauthError = params.get("error");

    if (oauthError) {
      toast.error("Sign-in failed. Please try again.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (oauthToken) {
      setAuthToken(oauthToken);
      // Clean up URL so the token doesn't stay in browser history
      window.history.replaceState({}, "", window.location.pathname);
    }

    fetchUserData();

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fetchUserData]); // fetchUserData is stable due to useCallback

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
        const response = await fetch(`${API_BASE_URL}/api/chat/${activeAnalysisId}`, {
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
        const responseData = await apiFetch("/api/videos/analyze", {
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
      const res = await apiFetch("/api/videos/analyze", {
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
        if (statusData.status_message !== undefined) {
          setStatusMessage(statusData.status_message);
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
          setAnalysisStatus("failed");
          const errorMsg = statusData.error || "Analysis task failed";
          toast.error(errorMsg);
          setStatusMessage(`Failed: ${errorMsg}`);
          completed = true; // Stop polling immediately
          throw new Error(errorMsg);
        }
      } catch (e: any) {
        logger.warn("Polling attempt failed:", e);
        if (e.message?.includes("failed")) {
          completed = true; // Stop polling on definitive failure
        }
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
      setHistoryItems(await fetchHistory());
    }
    return data;
  };

  const handleGenerateTool = async (toolId: string) => {
    if (!activeAnalysisId) return;
    
    setGeneratingTools(prev => [...prev, toolId]);
    try {
      const toolTypeMap: Record<string, string> = {
        'quiz': 'quiz',
        'roadmap': 'roadmap',
        'mindmap': 'mind_map',
        'flashcards': 'flashcards',
        'takeaways': 'takeaways'
      };
      
      const backendToolType = toolTypeMap[toolId];
      if (!backendToolType) return;

      const res = await analysisApi.generateTool(activeAnalysisId, backendToolType);
      if (res.ok) {
        const updatedAnalysis = await res.json();
        
        // Update summaryData with new tool
        setSummaryData(prev => {
          if (!prev) return null;
          return {
            ...prev,
            [backendToolType]: updatedAnalysis[backendToolType]
          };
        });
        
        toast.success(`${toolId.charAt(0).toUpperCase() + toolId.slice(1)} generated!`);
        
        // Update history item
        setHistoryItems(await fetchHistory());
      } else {
        toast.error(`Failed to generate ${toolId}`);
      }
    } catch (err) {
      logger.error(`Generation error for ${toolId}:`, err);
      toast.error("An error occurred during generation");
    } finally {
      setGeneratingTools(prev => prev.filter(id => id !== toolId));
    }
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
      if (view === "Search") {
        setIsSearchModalOpen(true);
        return;
      }
      if (view === "Add Content") {
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
        setIsSettingsModalOpen(true);
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
    <div className="flex bg-background min-h-screen h-screen overflow-hidden text-foreground">
      {/* Sidebar - hidden on mobile unless toggled, always visible on desktop unless focus mode */}
      <AnimatePresence>
        {!isFocusMode && (
          <motion.div
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ duration: 0.5, ease: "circOut" }}
            className="z-50"
          >
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
              isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
              isSidebarCollapsed ? "lg:w-[72px]" : "lg:w-[240px]"
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
                  activeView === "settings" ? "settings" :
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
                isCollapsed={isSidebarCollapsed}
                setIsCollapsed={setIsSidebarCollapsed}
                className={isSidebarCollapsed ? "w-[72px]" : "w-[240px]"}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* ... Feedback Dialog ... */}
      <Dialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
        <DialogContent className="rounded-3xl border-border bg-card shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Send Feedback</DialogTitle>
            <DialogDescription className="text-sm font-medium text-muted-foreground">
              Help us improve YouLearn. What's on your mind?
            </DialogDescription>
          </DialogHeader>
          <Textarea 
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="I love the synthesis mode but..." 
            className="min-h-[120px] rounded-2xl border-border bg-secondary/50 focus:ring-1 focus:ring-primary"
          />
          <DialogFooter>
            <Button onClick={submitFeedback} className="rounded-xl font-semibold text-sm h-10 px-6 bg-primary text-primary-foreground hover:bg-primary/90">Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isProfileUpdateOpen} onOpenChange={setIsProfileUpdateOpen}>
        <DialogContent className="rounded-3xl border-border bg-card shadow-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Update Profile</DialogTitle>
            <DialogDescription className="text-xs font-medium text-muted-foreground">
              Change your display name below.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input 
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Full Name"
              className="rounded-2xl border-border bg-secondary/50 focus:ring-1 focus:ring-primary h-12 px-4 font-medium"
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button onClick={handleUpdateProfile} className="rounded-xl flex-1 font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 px-8">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTopUpOpen} onOpenChange={setIsTopUpOpen}>
        <DialogContent className="rounded-[2.5rem] border-border shadow-2xl max-w-2xl p-0 overflow-hidden bg-card">
          <DialogTitle className="sr-only text-foreground">Top Up Credits</DialogTitle>
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="p-8 md:p-10 bg-secondary/30 border-r border-border">
               <div className="flex items-center gap-2 mb-6 text-foreground">
                 <div className="p-2 bg-primary rounded-xl">
                   <Coins className="h-5 w-5 text-primary-foreground" />
                 </div>
                 <span className="text-sm font-bold">Top Up Credits</span>
               </div>
               <h2 className="text-3xl font-bold tracking-tight leading-none mb-4 text-foreground">Fuel Your Learning.</h2>
               <p className="text-sm font-medium text-muted-foreground mb-8 max-w-[240px]">Get access to more deep-dives, podcast synthesis, and advanced AI models.</p>
               
               <div className="space-y-4">
                  <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    Unlimited Transcript Extraction
                  </div>
                  <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    Advanced AI Reasoning Models
                  </div>
                  <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    Export to PDF, MD, & Notion
                  </div>
               </div>
            </div>

            <div className="p-8 md:p-10 space-y-6">
               <button 
                 onClick={() => handlePayment("starter")}
                 className="w-full group relative p-6 bg-card border border-border rounded-[2rem] text-left hover:border-primary hover:shadow-xl transition-all"
               >
                 <div className="flex justify-between items-start mb-2">
                   <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-primary">Starter</span>
                   <span className="text-2xl font-bold text-foreground">₹499</span>
                 </div>
                 <h3 className="text-xl font-bold mb-1 text-foreground">500 Credits</h3>
                 <p className="text-[10px] font-bold text-muted-foreground group-hover:text-muted-foreground/80 transition-colors">Perfect for occasional researchers.</p>
               </button>

               <button 
                 onClick={() => handlePayment("pro")}
                 className="w-full group relative p-6 bg-primary text-primary-foreground border border-primary rounded-[2rem] text-left hover:shadow-[0_20px_40px_rgba(var(--primary-rgb),0.2)] transition-all overflow-hidden"
               >
                 <div className="absolute top-4 right-4 px-2 py-0.5 bg-background/20 rounded-full text-[9px] font-semibold uppercase backdrop-blur-md">Best Value</div>
                 <div className="flex justify-between items-start mb-2">
                   <span className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/50">Pro Miner</span>
                   <span className="text-2xl font-bold">₹1499</span>
                 </div>
                 <h3 className="text-xl font-bold mb-1">2000 Credits</h3>
                 <p className="text-[10px] font-bold text-primary-foreground/40 group-hover:text-primary-foreground/60 transition-colors">For serious learners and power users.</p>
               </button>
        <p className="text-[10px] font-medium text-center text-muted-foreground px-4">Secure payment via Razorpay. Credits expire 12 months from purchase.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Space Confirmation */}
      {/* Settings Modal */}
      <Dialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen}>
        <DialogContent className="max-w-4xl p-0 border-none bg-background/50 backdrop-blur-xl overflow-hidden rounded-[40px] shadow-2xl">
          <div className="flex flex-col lg:flex-row h-[600px]">
            {/* Sidebar */}
            <div className="w-full lg:w-64 bg-card border-r border-border p-8 flex flex-col gap-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center">
                  <Settings className="h-5 w-5 text-primary-foreground" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Settings</h2>
              </div>
              
              <nav className="flex flex-col gap-1">
                {[
                  { id: 'profile', label: 'Profile', icon: UserIcon },
                  { id: 'billing', label: 'Credits & Billing', icon: Wallet },
                  { id: 'notifications', label: 'Notifications', icon: Bell },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSettingsTab(tab.id)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all",
                      settingsTab === tab.id 
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/10" 
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>

              <div className="mt-auto pt-8 border-t border-border">
                <button 
                  onClick={() => {
                    handleLogout();
                    setIsSettingsModalOpen(false);
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-destructive hover:bg-destructive/10 transition-all w-full text-left"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-10 lg:p-12">
              <AnimatePresence mode="wait">
                {settingsTab === 'profile' && user && (
                  <motion.div
                    key="profile"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    <div className="flex items-center gap-6">
                      <Avatar className="h-24 w-24 rounded-[32px] border-4 border-background shadow-xl">
                        <AvatarImage src={user.avatar_url} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-black">
                          {user.name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-2xl font-black text-foreground">{user.name}</h3>
                        <p className="text-sm font-medium text-muted-foreground">{user.email}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Full Name</label>
                        <Input 
                          value={newName} 
                          onChange={(e) => setNewName(e.target.value)}
                          className="h-14 rounded-2xl border-border bg-secondary/50 px-6 font-bold focus:ring-primary h-14" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Email Address</label>
                        <Input 
                          value={user.email} 
                          disabled
                          className="h-14 rounded-2xl border-border px-6 font-bold bg-secondary/30 text-muted-foreground opacity-50 cursor-not-allowed" 
                        />
                      </div>
                    </div>

                    <div className="space-y-6 pt-4">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cognitive Expertise</label>
                        <div className="flex gap-3">
                          {['Beginner', 'Intermediate', 'Expert'].map((level) => (
                            <button
                              key={level}
                              onClick={() => setExpertise(level as any)}
                              className={cn(
                                "flex-1 px-4 py-3 rounded-2xl text-xs font-bold transition-all border-2",
                                expertise === level 
                                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/10" 
                                  : "bg-background text-muted-foreground border-border hover:border-primary/50"
                              )}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium ml-1">Adjusts the depth of synthesis and study tools.</p>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Platform Theme</label>
                        <div className="flex gap-3">
                           {['Light', 'Dark', 'System'].map((t) => (
                            <button
                              key={t}
                              onClick={() => {
                                if (t === 'Dark') document.documentElement.classList.add('dark');
                                else if (t === 'Light') document.documentElement.classList.remove('dark');
                                // 'System' could be handled with a media query listener
                                toast.success(`Theme set to ${t}`);
                              }}
                              className={cn(
                                "flex-1 px-4 py-3 rounded-2xl text-xs font-bold transition-all border-2",
                                (t === 'Dark' && document.documentElement.classList.contains('dark')) || 
                                (t === 'Light' && !document.documentElement.classList.contains('dark'))
                                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/10" 
                                  : "bg-card text-muted-foreground border-border hover:border-primary/50"
                              )}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-6">
                      <Button 
                        onClick={handleUpdateProfile}
                        disabled={isLoading || newName === user.name}
                        className="h-14 px-10 rounded-[24px] bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl shadow-primary/10 font-bold"
                      >
                        Save Changes
                      </Button>
                    </div>
                  </motion.div>
                )}

                {settingsTab === 'billing' && (
                  <motion.div
                    key="billing"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-10"
                  >
                    <div className="bg-primary text-primary-foreground p-10 rounded-[40px] shadow-2xl shadow-primary/20 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-background/10 rounded-full blur-3xl group-hover:bg-background/20 transition-all duration-500" />
                      <div className="relative z-10">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-foreground/40 mb-4 block">Total Balance</span>
                        <div className="flex items-end gap-3">
                          <Coins className="h-10 w-10 text-amber-400 fill-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.3)]" />
                          <h4 className="text-6xl font-black">{credits ?? 0}</h4>
                          <span className="text-lg font-bold text-primary-foreground/40 mb-2">Credits</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-8 rounded-[32px] border border-border bg-card hover:shadow-xl hover:shadow-primary/5 transition-all">
                        <h5 className="font-black text-lg mb-2 text-foreground">Standard Plan</h5>
                        <p className="text-sm font-medium text-muted-foreground mb-6">Perfect for occasional learning and research.</p>
                        <ul className="space-y-3 mb-8">
                           {['60 mins analysis / day', 'Basic study tools', 'Email support'].map(f => (
                             <li key={f} className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                               {f}
                             </li>
                           ))}
                        </ul>
                        <Button className="w-full h-12 rounded-xl bg-secondary text-muted-foreground font-bold uppercase tracking-widest text-[10px] cursor-not-allowed">Current Plan</Button>
                      </div>

                      <div className="p-8 rounded-[32px] border-2 border-primary bg-card shadow-2xl shadow-primary/5 relative group">
                        <div className="absolute -top-3 right-8 bg-primary text-primary-foreground px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Growth</div>
                        <h5 className="font-black text-lg mb-2 text-foreground">Pro Access</h5>
                        <p className="text-sm font-medium text-muted-foreground mb-6">Unlimited synthesis and advanced cognitive mapping.</p>
                        <ul className="space-y-3 mb-8">
                           {['Unlimited analysis', 'All study sets & tools', 'Priority support', 'Early access'].map(f => (
                             <li key={f} className="flex items-center gap-2 text-xs font-bold text-foreground">
                               <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                               {f}
                             </li>
                           ))}
                        </ul>
                        <Button onClick={() => setIsTopUpOpen(true)} className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">Upgrade Now</Button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {settingsTab === 'notifications' && (
                  <motion.div
                    key="notifications"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col items-center justify-center h-full text-center space-y-6"
                  >
                    <div className="w-20 h-20 bg-secondary rounded-[28px] flex items-center justify-center border border-border">
                      <Bell className="h-10 w-10 text-muted-foreground/20" />
                    </div>
                    <div>
                      <h4 className="text-xl font-black mb-2 text-foreground">Coming Soon</h4>
                      <p className="text-sm font-medium text-muted-foreground max-w-[280px]">We're building a smarter notification system to keep you updated on your learning progress.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleteSpaceConfirmId} onOpenChange={() => setDeleteSpaceConfirmId(null)}>
        <DialogContent className="rounded-2xl max-w-sm border-border bg-card shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete Space</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete this space? All associated notes and links will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setDeleteSpaceConfirmId(null)} className="flex-1 rounded-lg hover:bg-secondary text-muted-foreground">Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteSpace} className="flex-1 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Search Modal */}
      <Dialog open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen}>
        <DialogContent className="rounded-[32px] max-w-2xl p-0 overflow-hidden border-border bg-card shadow-2xl">
          <div className="bg-card">
            <div className="flex items-center px-6 h-20 border-b border-border gap-4">
              <Search className="h-6 w-6 text-muted-foreground" />
              <input 
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search in Library"
                className="flex-1 bg-transparent text-xl focus:outline-none placeholder:text-muted-foreground/30 font-medium text-foreground"
              />
              <div className="px-2 py-1 bg-secondary rounded-lg border border-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider">ESC</div>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto p-4 scrollbar-thin">
              {searchQuery.trim() === "" ? (
                <div className="py-12 text-center">
                  <p className="text-sm font-bold text-muted-foreground">Search for videos, spaces or topics</p>
                  <div className="flex items-center justify-center gap-6 mt-6">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                       <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                       Videos
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                       <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                       Spaces
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {isSearchLoading ? (
                    <div className="py-12 text-center text-muted-foreground font-bold">
                       <p className="animate-pulse">Searching...</p>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div>
                       <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-3 mb-3 opacity-50">Found in Library</h4>
                       <div className="space-y-1">
                         {searchResults.map(result => (
                           <button 
                             key={result.id}
                             onClick={() => {
                               if (result.type === "video" || result.type === "analysis" || result.type === "transcript") {
                                 handleLoadHistoryItem({
                                   id: result.video_id || result.id,
                                   title: result.title,
                                   videoIds: [result.platform_id || result.video_id || result.id],
                                   date: new Date().toISOString(),
                                   status: "ready"
                                 } as any);
                               }
                               setIsSearchModalOpen(false);
                               setSearchQuery("");
                             }}
                             className="w-full flex items-center gap-4 p-3 hover:bg-secondary rounded-[20px] transition-all group text-left"
                           >
                             <div className="w-16 h-10 bg-secondary rounded-xl overflow-hidden shrink-0 border border-border">
                               {result.thumbnail ? (
                                 <img src={result.thumbnail} alt="" className="w-full h-full object-cover" />
                               ) : (
                                 <div className="w-full h-full flex items-center justify-center bg-secondary">
                                   <Search className="h-4 w-4 text-muted-foreground" />
                                 </div>
                               )}
                             </div>
                             <div className="min-w-0 flex-1">
                               <p className="text-sm font-bold truncate text-foreground group-hover:text-primary transition-colors">{result.title}</p>
                               <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold truncate block">{result.subtitle}</span>
                             </div>
                             <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-all" />
                           </button>
                         ))}
                       </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                       <p className="text-sm font-bold text-muted-foreground">No results found for "{searchQuery}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-secondary/50 border-t border-border flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                     <div className="px-1.5 py-0.5 bg-background rounded border border-border text-[9px] font-bold text-muted-foreground">↑↓</div>
                     <span className="text-[9px] font-bold text-muted-foreground uppercase">Navigate</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                     <div className="px-1.5 py-0.5 bg-background rounded border border-border text-[9px] font-bold text-muted-foreground">ENTER</div>
                     <span className="text-[9px] font-bold text-muted-foreground uppercase">Open</span>
                  </div>
               </div>
               <p className="text-[9px] font-bold text-muted-foreground opacity-30 uppercase tracking-widest">TubeBrain Search</p>
            </div>
          </div>
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
          {!isChatOpen && !isFocusMode && (
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

      {/* Main Content Area */}
      <main id="main-content" className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Sticky Header */}
        <AnimatePresence>
          {!isFocusMode && (
            <motion.header
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="h-16 flex items-center justify-between px-6 bg-background/80 backdrop-blur-xl border-b border-border sticky top-0 z-40 transition-all"
            >
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className="p-2 hover:bg-secondary rounded-xl transition-all shrink-0 border border-transparent hover:border-border hidden md:block"
                >
                  <Menu className="h-5 w-5 text-muted-foreground" />
                </button>
                
                <div className="flex items-center gap-2 text-muted-foreground/30 mx-2 hidden md:flex">
                   <div className="w-1.5 h-1.5 rounded-full bg-border" />
                </div>

                {activeView === "analysis" && videoData ? (
                  <div className="flex items-center gap-3 min-w-0">
                    <h1 className="text-sm font-bold text-foreground truncate max-w-[300px]">{videoData.title}</h1>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 p-1 bg-secondary/50 rounded-xl border border-border">
                     {(["Beginner", "Expert"] as const).map((level) => (
                        <button
                          key={level}
                          onClick={() => setExpertise(level === "Beginner" ? "Beginner" : "Expert")}
                          className={cn(
                            "px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all",
                            ((level === "Beginner" && expertise === "Beginner") || (level === "Expert" && expertise === "Expert")) 
                              ? "bg-card text-foreground shadow-sm border border-border" 
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {level}
                        </button>
                     ))}
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                 <div className="hidden lg:flex items-center gap-2">
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => setIsFocusMode(!isFocusMode)}
                     className={cn(
                       "rounded-xl h-9 px-4 text-xs font-bold uppercase tracking-wider transition-all gap-2",
                       isFocusMode ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-secondary border border-border"
                     )}
                   >
                     <GraduationCap className="h-4 w-4" />
                     Focus Mode
                   </Button>
                 </div>

                 <div className="w-px h-4 bg-border mx-1 hidden sm:block" />

                 <Button
                   variant="default"
                   size="sm"
                   onClick={() => setIsTopUpOpen(true)}
                   className="rounded-xl h-9 px-5 text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/5"
                 >
                   Upgrade
                 </Button>
                 
                 <div className="relative group">
                    <Avatar className="h-9 w-9 border-2 border-border group-hover:border-primary transition-all cursor-pointer">
                       <AvatarImage src={user?.avatar_url} />
                       <AvatarFallback className="bg-secondary text-[10px] font-bold">{user?.name?.slice(0, 2).toUpperCase() || "ME"}</AvatarFallback>
                    </Avatar>
                 </div>
              </div>
            </motion.header>
          )}
        </AnimatePresence>

        {/* Content Wrapper */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
        <AnimatePresence mode="wait">
          {activeView === "analysis" && videoData ? (
            <motion.div 
              key="analysis"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-[calc(100vh-64px)] overflow-hidden"
            >
              {/* Main Content Area */}
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                <div className={cn(
                  "p-8 lg:p-12 transition-all duration-700 ease-in-out",
                  isFocusMode ? "max-w-5xl mx-auto pt-24 pb-32" : "container mx-auto"
                )}>
                  <div className={cn(
                    "flex flex-col lg:flex-row gap-8 lg:gap-12 transition-all duration-700",
                    isFocusMode && "lg:gap-16"
                  )}>
                    {/* Left Column - Video & Analysis */}
                    <div className={cn(
                      "flex-1 min-w-0 transition-all duration-700",
                      isFocusMode ? "lg:w-[65%]" : ""
                    )}>
                      {/* Video Player Section */}
                      <div className={cn(
                        "transition-all duration-500 ease-in-out origin-top relative group rounded-[40px] overflow-hidden shadow-2xl shadow-foreground/5 border border-border",
                        isVideoMinimized ? "h-0 opacity-0 mb-0" : "h-auto opacity-100 mb-8"
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
                            className="w-full rounded-[24px] border border-border bg-card hover:bg-secondary transition-all font-bold uppercase tracking-widest text-[10px] h-12 gap-3"
                          >
                            <Play className="h-4 w-4" /> Show Video Player
                          </Button>
                        </motion.div>
                      )}
 
                      {/* Content States: Loading, Summary, or Empty */}
                      <AnimatePresence mode="wait">
                        {isLoading || (activeAnalysisId && !summaryData) ? (
                          <motion.div 
                            key="loading"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="py-12"
                          >
                            <div className="bg-secondary/30 border border-border p-10 rounded-[40px] shadow-sm">
                              <div className="flex items-end justify-between mb-10">
                                 <div>
                                   <h2 className="text-3xl font-bold mb-3 text-foreground">Synthesizing Knowledge</h2>
                                   <div className="flex items-center gap-3">
                                     <div className="flex items-center gap-2">
                                       <div className={cn("h-2 w-2 rounded-full animate-pulse", analysisProgress < 30 ? "bg-amber-500" : analysisProgress < 70 ? "bg-blue-500" : "bg-emerald-500")} />
                                       <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                         {analysisProgress < 20 ? "Pre-processing" : 
                                          analysisProgress < 50 ? "Transcript Extraction" : 
                                          analysisProgress < 80 ? "AI Analysis" : 
                                          "Finalizing"}
                                       </span>
                                     </div>
                                   </div>
                                 </div>
                                 <div className="text-right">
                                   <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Progress</p>
                                   <div className="flex flex-col items-end">
                                   <div className="flex flex-col items-center">
                                     <span className="text-5xl font-black leading-none text-foreground">{analysisProgress}%</span>
                                     {statusMessage && (
                                       <p className="text-[10px] font-extrabold text-primary uppercase tracking-[0.2em] mt-4 animate-pulse">
                                         {statusMessage}
                                       </p>
                                     )}
                                   </div>
                                   </div>
                                 </div>
                              </div>
                              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                 <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${analysisProgress}%` }}
                                  className="h-full bg-primary transition-all duration-500"
                                 />
                              </div>
                              <div className="grid grid-cols-4 gap-2 mt-10">
                                 {[25, 50, 75, 100].map((step) => (
                                   <div key={step} className={cn(
                                     "h-1.5 rounded-full transition-colors duration-500",
                                     analysisProgress >= step ? "bg-primary" : "bg-muted"
                                   )} />
                                 ))}
                              </div>
                            </div>
                            <div className="opacity-40 grayscale pointer-events-none mt-12">
                              <LoadingSkeleton />
                            </div>
                          </motion.div>
                        ) : analysisStatus === "failed" ? (
                           <motion.div 
                             key="error"
                             initial={{ opacity: 0, scale: 0.95 }}
                             animate={{ opacity: 1, scale: 1 }}
                             exit={{ opacity: 0, scale: 1.05 }}
                             className="py-12"
                           >
                             <div className="bg-destructive/5 border border-destructive/20 p-12 rounded-[40px] text-center shadow-2xl shadow-destructive/10">
                               <div className="w-20 h-20 bg-destructive/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
                                 <AlertCircle className="h-10 w-10 text-destructive" />
                               </div>
                               <h2 className="text-3xl font-bold mb-4 text-foreground">Analysis Failed</h2>
                               <p className="text-muted-foreground text-sm font-medium mb-10 max-w-md mx-auto leading-relaxed">
                                 {statusMessage?.replace("Failed: ", "") || "We encountered an unexpected error while processing this video. This might be due to a restricted video or a temporary service interruption."}
                               </p>
                               <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                 <Button 
                                   variant="outline" 
                                   onClick={() => {
                                     setActiveView("dashboard");
                                     setActiveAnalysisId(null);
                                     setAnalysisStatus(null);
                                   }}
                                   className="rounded-2xl h-12 px-8 font-bold uppercase tracking-widest text-[10px] border-border hover:bg-secondary"
                                 >
                                   Back to Dashboard
                                 </Button>
                                 <Button 
                                   onClick={() => {
                                      // Re-trigger summarize for the same IDs
                                      handleSubmit(videoIds);
                                   }}
                                   className="rounded-2xl h-12 px-8 font-bold uppercase tracking-widest text-[10px] bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                                 >
                                   Try Again
                                 </Button>
                               </div>
                             </div>
                           </motion.div>
                         ) : summaryData ? (
                          <motion.div
                            key="summary"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-8"
                          >
                            <SummaryDisplay 
                              {...summaryData}
                              transcript={transcript}
                              transcript_segments={summaryData.transcript_segments}
                              onTimestampClick={handleTimestampClick}
                              spaces={spaces}
                              onAddToSpace={handleAddToSpace}
                              currentTime={currentTime}
                              isAutoScroll={isAutoScroll}
                              setIsAutoScroll={setIsAutoScroll}
                            />
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>

                    {/* Right Column - Desktop Study Tools (Hidden in Focus Mode) */}
                    {!isFocusMode && (
                      <div className="hidden lg:block w-[350px] shrink-0 sticky top-24 self-start">
                        <LearnTools 
                          onToolClick={handleToolClick} 
                          hasQuiz={!!summaryData?.quiz}
                          hasFlashcards={!!summaryData?.flashcards}
                          hasRoadmap={!!summaryData?.roadmap}
                          hasMindMap={!!summaryData?.mind_map}
                          onGenerate={handleGenerateTool}
                          generatingTools={generatingTools}
                          sets={summaryData ? [
                            ...(summaryData.quiz ? [{ id: 'quiz', name: 'Knowledge Quiz', date: 'Generated', type: 'quiz' }] : []),
                            ...(summaryData.flashcards ? [{ id: 'flashcards', name: 'Brain Cards', date: 'Generated', type: 'flashcards' }] : []),
                            ...(summaryData.roadmap ? [{ id: 'roadmap', name: 'Learning Path', date: 'Generated', type: 'roadmap' }] : []),
                            ...(summaryData.mind_map ? [{ id: 'mind_map', name: 'Mind Map', date: 'Generated', type: 'mind_map' }] : []),
                          ] : []}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Mobile Study Tools (Hidden in Focus Mode) */}
              {!isFocusMode && (
                <>
                  <button
                    onClick={() => setIsMobileLearnOpen(!isMobileLearnOpen)}
                    className="lg:hidden fixed bottom-6 right-6 z-50 w-14 h-14 bg-black text-white rounded-2xl shadow-xl flex items-center justify-center hover:bg-gray-800 transition-all"
                    aria-label="Open learning tools"
                  >
                    <GraduationCap className="h-6 w-6" />
                  </button>

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
                          className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl shadow-2xl max-h-[70vh] overflow-y-auto border-t border-border"
                        >
                          <div className="p-1 flex justify-center sticky top-0 bg-card z-10">
                            <div className="w-10 h-1 rounded-full bg-border" />
                          </div>
                          <LearnTools 
                            onToolClick={(id, v) => { handleToolClick(id, v); setIsMobileLearnOpen(false); }}
                            hasQuiz={!!summaryData?.quiz?.length}
                            hasFlashcards={!!summaryData?.flashcards?.length}
                            hasRoadmap={!!summaryData?.roadmap}
                            hasMindMap={!!summaryData?.mind_map?.nodes?.length}
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
                </>
              )}
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
                  <div className="w-16 h-16 bg-secondary rounded-3xl flex items-center justify-center mx-auto mb-6 border border-border shadow-sm">
                    <UserIcon className="h-7 w-7 text-muted-foreground/30" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-1">Sign in to continue</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                    Log in to access your saved history, library, and learning spaces.
                  </p>
                  <Button onClick={() => setActiveView("dashboard")} className="rounded-xl font-semibold text-sm h-10 px-6">Back to Search</Button>
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
                      className="flex items-center justify-between p-4 bg-card border border-border rounded-2xl hover:border-primary/20 hover:shadow-lg hover:shadow-foreground/5 transition-all text-left group"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                         <div className="w-24 h-16 bg-muted rounded-xl overflow-hidden shrink-0 border border-border relative">
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
          ) : (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="pb-32"
            >
              <div className="absolute inset-0 bg-dot-pattern opacity-[0.03] pointer-events-none" />
              
              {/* Hero Section */}
              <div className="max-w-4xl mx-auto px-6 pt-24 pb-12 text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1, duration: 0.8 }}
                >
                  <span className="inline-block px-4 py-1.5 mb-6 rounded-full bg-primary/5 text-primary text-[10px] font-black uppercase tracking-[0.2em] border border-primary/10">
                    Your Personal Learning Accelerator
                  </span>
                  <h1 className="text-4xl md:text-7xl font-black tracking-tight text-foreground leading-[1.05] mb-6">
                    Unlock Knowledge <br/>
                    <span className="text-muted-foreground/40">In Seconds.</span>
                  </h1>
                  <p className="text-lg text-muted-foreground/60 max-w-2xl mx-auto mb-10 font-medium leading-relaxed">
                    Ready to learn, {user?.name?.split(' ')[0] || 'stranger'}? Paste any video link or upload a file to begin your deep-dive.
                  </p>
                </motion.div>
              </div>

              <UrlInput 
                onSubmit={handleSubmit} 
                isLoading={isLoading} 
                onUploadComplete={async (videoId, analysisId) => {
                  if (!analysisId) return;
                  setVideoIds([videoId]);
                  setVideoData({
                    title: "Processing Upload...",
                    channel: "Upload",
                    duration: "N/A",
                    views: "N/A",
                    likes: "N/A",
                    published: new Date().toISOString()
                  });
                  setSummaryData(null);
                  setTranscript(null);
                  setMetadata(null);
                  setActiveAnalysisId(analysisId);
                  setAnalysisStatus("pending");
                  setActiveView("analysis");
                  
                  // Refresh history so it shows "processing"
                  setHistoryItems(await fetchHistory());

                  const data = await pollAnalysis(analysisId, [videoId]);
                  if (data) {
                    toast.success("Analysis complete!");
                  }
                }} 
                analysisStyle={analysisStyle}
                onStyleChange={setAnalysisStyle}
              />
              
              <div className="max-w-5xl mx-auto px-6 mt-20 space-y-20">
                 {/* Spaces Grid */}
                 <section>
                    <div className="flex items-end justify-between mb-8 px-2">
                      <div>
                        <h3 className="text-2xl font-black text-foreground">Spaces</h3>
                        <p className="text-xs font-medium text-muted-foreground mt-1">Organized collections of your best insights.</p>
                      </div>
                      <button 
                        onClick={() => setActiveView("library")}
                        className="text-xs font-bold text-primary hover:underline uppercase tracking-widest"
                      >
                        View all
                      </button>
                    </div>
                    {spaces.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {spaces.slice(0, 6).map((space, i) => (
                          <motion.button 
                            key={space.id} 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 + i * 0.05 }}
                            onClick={() => handleSidebarClick({ type: "Space", id: space.id, name: space.name })}
                            className="group flex flex-col p-8 bg-card border border-border rounded-[40px] hover:border-primary hover:shadow-2xl hover:shadow-primary/5 transition-all text-left relative overflow-hidden aspect-square"
                          >
                            <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity">
                               <FolderOpen className="h-32 w-32 -mr-16 -mt-16 rotate-12" />
                            </div>
                            
                            <div className="w-14 h-14 bg-secondary rounded-2xl flex items-center justify-center mb-auto group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 group-hover:rotate-6">
                               <FolderOpen className="h-6 w-6" />
                            </div>
                            
                            <div className="relative z-10">
                              <span className="text-xl font-black block truncate text-foreground mb-1">{space.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{space.videoIds.length} Materials</span>
                                <div className="h-1 w-1 rounded-full bg-border" />
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active</span>
                              </div>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-secondary/20 rounded-[40px] p-12 border border-dashed border-border text-center">
                         <div className="w-16 h-16 bg-card rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-border">
                            <PlusCircle className="h-8 w-8 text-muted-foreground/30" />
                         </div>
                         <p className="text-base font-bold text-foreground">Create your first space</p>
                         <p className="text-sm text-muted-foreground mt-1">Organize your learning by topics</p>
                         <Button onClick={() => toast.info("Use the sidebar to create new spaces!")} variant="outline" className="mt-6 rounded-2xl font-bold text-sm h-10 px-6">Add Space</Button>
                      </div>
                    )}
                 </section>

                 {/* Recent Videos Row */}
                 <section>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-bold">Recents</h3>
                      <button onClick={() => setActiveView("history")} className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">View history</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                       {historyItems.slice(0, 3).map((item) => (
                         <button 
                            key={item.id} 
                            onClick={() => handleLoadHistoryItem(item)}
                            className="flex flex-col bg-card rounded-[32px] overflow-hidden hover:shadow-lg transition-all text-left group border border-border shadow-sm"
                          >
                             <div className="aspect-video w-full bg-muted overflow-hidden relative">
                                <img 
                                  src={`https://img.youtube.com/vi/${item.videoIds[0]}/maxresdefault.jpg`} 
                                  alt="" 
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                />
                                <div className="absolute inset-0 bg-foreground/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                             </div>
                             <div className="p-5">
                                <p className="text-sm font-bold truncate group-hover:text-primary transition-colors text-foreground">{item.title}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{getRelativeDate(item.date)}</span>
                                  <span className="w-1 h-1 rounded-full bg-border" />
                                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold truncate max-w-[100px]">{item.videoData?.channel}</span>
                                </div>
                             </div>
                         </button>
                       ))}
                       {historyItems.length === 0 && (
                          <div className="col-span-full py-12 text-center bg-secondary/20 rounded-[40px] border border-dashed border-border">
                             <div className="w-16 h-16 bg-card rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-border">
                                <HistoryIcon className="h-8 w-8 text-muted-foreground/30" />
                             </div>
                             <p className="text-base font-bold text-muted-foreground">No recent activity</p>
                             <Button onClick={() => setActiveView("dashboard")} variant="link" className="mt-2 text-xs font-semibold text-muted-foreground/50">Start learning something new</Button>
                          </div>
                       )}
                    </div>
                 </section>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      {!isFocusMode && (
        <BottomNav 
          activeView={activeView} 
          onViewChange={(view) => {
            if (view === "search-modal") {
              setIsSearchModalOpen(true);
            } else {
              handleSidebarClick(view);
            }
          }}
        />
      )}
    </div>
  );
};

export default Index;
