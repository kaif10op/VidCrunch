import { useState, useRef, useEffect } from "react";
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
  Coins
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
  removeAuthToken 
} from "@/lib/api";

const extractVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

const Index = () => {
  const [activeView, setActiveView] = useState<"dashboard" | "analysis" | "history" | "library" | "space" | "settings">("dashboard");
  const [expertise, setExpertise] = useState<"Beginner" | "Intermediate" | "Expert">("Intermediate");
  const [isFocusMode, setIsFocusMode] = useState(false);
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
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);

  // User & Auth State
  const [user, setUser] = useState<any>(null);
  const [credits, setCredits] = useState<number | null>(null);

  const fetchTransactions = async () => {
    try {
      const res = await creditApi.getHistory();
      if (res.ok) {
        setTransactions(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
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
        localStorage.setItem('user_name', userData.name || '');
        localStorage.setItem('user_email', userData.email || '');
      }
      
      if (creditRes.ok) {
        const creditData = await creditRes.json();
        setCredits(creditData.balance);
        localStorage.setItem('user_balance', String(creditData.balance));
      }
      fetchTransactions();
    } catch (err) {
      console.error("Auth sync failed", err);
    }
  };

  const handleLogout = () => {
    removeAuthToken();
    setUser(null);
    setCredits(null);
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_balance');
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
        localStorage.setItem('user_name', updatedUser.name);
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

  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token && ["history", "library", "space", "settings"].includes(activeView)) {
      setActiveView("dashboard");
    }
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
      console.error("Payment initiation error:", err);
      toast.error(err.message || "Payment initiation failed");
    }
  };

  const handleSendMessage = async (content: string) => {
    const newUserMsg = { role: "user" as const, content: contextSnippet ? `[Context: ${contextSnippet}]\n\n${content}` : content };
    const updatedMessages = [...chatMessages, newUserMsg];
    setChatMessages(updatedMessages);
    setIsChatLoading(true);
    setContextSnippet(null);

    try {
      const backendUrl = "http://localhost:8000";
      
      const response = await fetch(`${backendUrl}/api/videos/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          urls: videoIds.map(id => `https://youtube.com/watch?v=${id}`),
          style: `Chat Mode: ${content}`,
          expertise,
          chatHistory: updatedMessages.slice(-5) // Send last 5 for context
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data?.summary?.overview || data?.answer || data?.summary || "I couldn't process that. Try asking something else!";
      
      setChatMessages([...updatedMessages, { role: "assistant", content: aiResponse as string }]);
    } catch (err) {
      toast.error("AI Assistant is having trouble. Try again.");
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

      setHistoryItems(await fetchHistory());

      const data = await pollAnalysis(analysisId, ids);
      if (data) {
        toast.success("Analysis complete!");
      }
    } catch (err: any) {
      console.error("Summarize error:", err);
      toast.error(err.message || "Failed to analyze video");
    } finally {
      setIsLoading(false);
    }
  };

  const pollAnalysis = async (analysisId: string, videoIds: string[]) => {
    let completed = false;
    let data = null;
    let attempts = 0;
    
    while (!completed && attempts < 60) {
      attempts++;
      await new Promise(r => setTimeout(r, 2000));
      try {
        const statusRes = await apiFetch(`/analysis/${analysisId}/status`);
        if (!statusRes.ok) continue;
        const statusData = await statusRes.json();
        
        // Update progress state
        if (statusData.progress_percentage !== undefined) {
          setAnalysisProgress(statusData.progress_percentage);
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
        console.warn("Polling attempt failed:", e);
      }
    }

    if (data) {
      const { analysis, video, transcript_text } = data;
      
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
        flashcards: analysis.flashcards
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

      setActiveAnalysisId(null);
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
  };

  const handleToolClick = (toolId: string, value?: string) => {
    if (["quiz", "roadmap", "mindmap"].includes(toolId)) {
      document.getElementById(toolId)?.scrollIntoView({ behavior: "smooth" });
    } else if (toolId === "podcast") {
      handleSubmit(videoIds, { expertise, provider: "groq", model: "llama-3.3-70b-versatile", language: "English", style: "Podcast Script" });
    } else if (toolId === "deepdive") {
      handleSubmit(videoIds, { expertise, provider: "groq", model: "llama-3.3-70b-versatile", language: "English", style: "Academic Research" });
    } else if (toolId === "ask" && value) {
      handleSubmit(videoIds, { expertise, provider: "groq", model: "llama-3.3-70b-versatile", language: "English", style: `Q&A Mode: ${value}` });
    } else if (toolId === "action" && value) {
      handleSubmit(videoIds, { expertise, provider: "groq", model: "llama-3.3-70b-versatile", language: "English", style: value });
    } else if (toolId === "flashcards") {
      handleSubmit(videoIds, { expertise, provider: "groq", model: "llama-3.3-70b-versatile", language: "English", style: "Flashcards Data JSON" });
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
    setActiveView("analysis");

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
    if (confirm("Are you sure you want to delete this space?")) {
      await deleteSpace(id);
      setSpaces(prev => prev.filter(s => s.id !== id));
      if (selectedSpace?.id === id) {
        setSelectedSpace(null);
        setActiveView("dashboard");
      }
      toast.success("Space deleted");
    }
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
      {!isFocusMode && (
        <Sidebar 
          onViewChange={handleSidebarClick} 
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
      )}
      
      {/* ... Feedback Dialog ... */}
      <Dialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
        {/* ... Feedback Dialog Content ... */}
        <DialogContent className="rounded-3xl border-gray-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">Send Feedback</DialogTitle>
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
            <Button onClick={submitFeedback} className="rounded-xl font-bold uppercase tracking-widest text-xs h-10 px-6 bg-black text-white">Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isProfileUpdateOpen} onOpenChange={setIsProfileUpdateOpen}>
        <DialogContent className="rounded-3xl border-gray-100 shadow-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">Update Profile</DialogTitle>
            <DialogDescription className="text-xs font-medium text-gray-500">
              Change your display name below.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input 
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Full Name"
              className="rounded-2xl border-gray-100 focus:ring-1 focus:ring-black h-12 px-4 font-bold"
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button onClick={handleUpdateProfile} className="rounded-xl flex-1 font-bold uppercase tracking-widest text-[10px] bg-black text-white px-8">Save</Button>
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
                 <span className="text-sm font-black uppercase tracking-tighter italic">Top Up Credits</span>
               </div>
               <h2 className="text-4xl font-black tracking-tighter uppercase italic leading-none mb-4">Fuel Your Learning.</h2>
               <p className="text-sm font-medium text-gray-500 mb-8 max-w-[240px]">Get access to more deep-dives, podcast synthesis, and advanced AI models.</p>
               
               <div className="space-y-4">
                  <div className="flex items-center gap-3 text-xs font-bold text-gray-400">
                    <div className="h-1 w-1 rounded-full bg-black" />
                    Unlimited Transcript Extraction
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold text-gray-400">
                    <div className="h-1 w-1 rounded-full bg-black" />
                    Advanced AI Reasoning Models
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold text-gray-400">
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
                   <span className="text-xs font-black uppercase tracking-widest text-gray-400 group-hover:text-black">Starter</span>
                   <span className="text-2xl font-black italic tracking-tighter">₹499</span>
                 </div>
                 <h3 className="text-xl font-black italic tracking-tighter uppercase mb-1">500 Credits</h3>
                 <p className="text-[10px] font-bold text-gray-400 group-hover:text-gray-500 transition-colors">Perfect for occasional researchers.</p>
               </button>

               <button 
                 onClick={() => handlePayment("pro")}
                 className="w-full group relative p-6 bg-black text-white border border-black rounded-[2rem] text-left hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)] transition-all overflow-hidden"
               >
                 <div className="absolute top-4 right-4 px-2 py-0.5 bg-white/20 rounded-full text-[8px] font-black uppercase tracking-tighter backdrop-blur-md">Best Value</div>
                 <div className="flex justify-between items-start mb-2">
                   <span className="text-xs font-black uppercase tracking-widest text-white/50">Pro Miner</span>
                   <span className="text-2xl font-black italic tracking-tighter">₹1499</span>
                 </div>
                 <h3 className="text-xl font-black italic tracking-tighter uppercase mb-1">2000 Credits</h3>
                 <p className="text-[10px] font-bold text-white/40 group-hover:text-white/60 transition-colors">For serious learners and power users.</p>
               </button>

               <p className="text-[8px] font-bold text-center text-gray-400 uppercase tracking-widest px-4">Secure payment via Razorpay. Credits expire 12 months from purchase.</p>
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
      
      <main className="flex-1 relative overflow-y-auto">
        {/* Advanced Top Bar */}
        <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-3 flex items-center justify-between">
           <div className="flex items-center gap-4">
              {isFocusMode && (
                <button 
                  onClick={() => setIsFocusMode(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-all"
                >
                  <PlusCircle className="h-5 w-5 rotate-45" />
                </button>
              )}
              <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-2xl border border-gray-100">
                 {(["Beginner", "Intermediate", "Expert"] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setExpertise(level)}
                      className={cn(
                        "px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                        expertise === level ? "bg-black text-white shadow-lg" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {level}
                    </button>
                 ))}
              </div>
           </div>
           
           <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFocusMode(!isFocusMode)}
                className={cn(
                  "rounded-xl h-9 px-4 text-[10px] font-black uppercase tracking-widest border-gray-100",
                  isFocusMode && "bg-black text-white border-black"
                )}
              >
                {isFocusMode ? "Exit Focus" : "Focus Mode"}
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
              <div className="flex-1 overflow-y-auto p-6 lg:p-10">
                <div className="max-w-5xl mx-auto space-y-8 pb-20">
                  <header className="flex items-center justify-between mb-2">
                    <Button 
                      variant="ghost" 
                      onClick={handleBackToDashboard}
                      className="gap-2 -ml-4 text-muted-foreground hover:text-foreground font-bold uppercase tracking-tight text-[10px]"
                    >
                      <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded-xl border-gray-100 font-bold uppercase tracking-tight text-[10px] h-8"
                        onClick={() => {
                          const url = window.location.href;
                          navigator.clipboard.writeText(url);
                          toast.success("Share link copied to clipboard!");
                        }}
                      >
                        <Share2 className="h-3 w-3 mr-2" /> Share
                      </Button>
                      <Button variant="outline" size="icon" className="rounded-xl border-gray-100 h-8 w-8">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </header>

                  <VideoPreview 
                    videoId={videoIds[0]} 
                    {...videoData}
                    thumbnail={`https://img.youtube.com/vi/${videoIds[0]}/maxresdefault.jpg`}
                    iframeRef={iframeRef} 
                  />
                  
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
                             <h2 className="text-3xl font-black tracking-tighter uppercase italic mb-2">Analyzing Intelligence</h2>
                             <div className="flex items-center gap-3">
                               <div className="flex items-center gap-1.5">
                                 <div className={cn("h-1.5 w-1.5 rounded-full animate-pulse", analysisProgress < 30 ? "bg-amber-500" : analysisProgress < 70 ? "bg-blue-500" : "bg-green-500")} />
                                 <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                   {analysisProgress < 20 ? "Extracting Metadata" : 
                                    analysisProgress < 50 ? "Generating Transcript" : 
                                    analysisProgress < 80 ? "AI Synthesis Pipeline" : 
                                    "Polishing Results"}
                                 </span>
                               </div>
                             </div>
                           </div>
                           <div className="text-right">
                             <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-1">Overall Progress</p>
                             <span className="text-5xl font-black italic tracking-tightest leading-none text-black">{analysisProgress}%</span>
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
                      onTimestampClick={handleTimestampClick}
                      spaces={spaces}
                      onAddToSpace={handleAddToSpace}
                      currentTime={currentTime}
                    />
                  ) : null}
                </div>
              </div>
              
              <LearnTools onToolClick={handleToolClick} />
            </motion.div>
            ) : activeView === "history" || activeView === "library" || activeView === "space" ? (
            <motion.div 
              key={activeView + (selectedSpace?.id || "")}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto py-16 px-6"
            >
              {!getAuthToken() ? (
                <div className="text-center py-20 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-4">Sign in required</h2>
                  <p className="text-muted-foreground font-bold mb-6 truncate max-w-sm mx-auto">Please log in to access your saved history, library, and learning spaces.</p>
                  <Button onClick={() => setActiveView("dashboard")} className="rounded-xl font-bold uppercase tracking-widest text-xs h-10 px-6 bg-black text-white">Back to Search</Button>
                </div>
              ) : ((activeView === "history" && historyItems.length > 0) || 
                (activeView === "library" && historyItems.some(h => spaces.some(s => s.videoIds.includes(h.videoIds[0])))) || 
                (activeView === "space" && (selectedSpace?.videoIds.length ?? 0) > 0)) ? (
                <div className="grid gap-4">
                  {(activeView === "space" ? 
                    historyItems.filter(h => selectedSpace?.videoIds.includes(h.videoIds[0])) : 
                    activeView === "library" ?
                    historyItems.filter(h => spaces.some(s => s.videoIds.includes(h.videoIds[0]))) :
                    historyItems
                  ).map((item) => (
                    <button 
                      key={item.id} 
                      onClick={() => handleLoadHistoryItem(item)}
                      className="flex items-center justify-between p-6 bg-white border border-gray-100 rounded-3xl hover:border-gray-300 transition-all text-left group shadow-sm relative overflow-hidden"
                    >
                      <div className="flex items-center gap-4">
                         <div className="w-16 h-12 bg-gray-100 rounded-xl overflow-hidden shrink-0 border">
                            <img src={`https://img.youtube.com/vi/${item.videoIds[0]}/default.jpg`} alt="" className="w-full h-full object-cover" />
                         </div>
                         <div>
                           <h3 className="text-lg font-bold group-hover:text-primary transition-colors line-clamp-1">{item.title}</h3>
                           <p className="text-sm text-muted-foreground font-medium mt-1">
                             {new Date(item.date).toLocaleDateString()}
                           </p>
                         </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => handleDeleteHistoryItem(e, item.id)}
                          className="p-2 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-xl transition-all"
                        >
                           <X className="h-4 w-4" />
                        </button>
                        <ChevronLeft className="h-5 w-5 text-gray-300 rotate-180 group-hover:text-foreground transition-all" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                  <p className="text-muted-foreground font-bold">This section is empty.</p>
                  <Button onClick={() => setActiveView("dashboard")} variant="link" className="mt-2 uppercase text-[10px] font-black tracking-widest">Start searching</Button>
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
              <h1 className="text-4xl font-black tracking-tight italic uppercase text-foreground mb-8 text-center underline decoration-black/5 decoration-4 underline-offset-8">Settings</h1>
              
              {!user ? (
                <div className="text-center py-20 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-4">Sign in required</h2>
                  <p className="text-muted-foreground font-bold mb-6">Please log in to manage your account and data.</p>
                  <Button onClick={() => (document.querySelector('[data-auth-trigger]') as HTMLElement)?.click()} className="rounded-xl font-bold uppercase tracking-widest text-xs h-10 px-6 bg-black text-white">Sign In</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-8 bg-white border border-gray-100 rounded-3xl shadow-sm space-y-6">
                    <div>
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Account Profile</h3>
                      <div className="flex items-center gap-4 mb-4">
                        <Avatar className="h-16 w-16 rounded-3xl border-2 border-white shadow-lg">
                          <AvatarImage src={user.avatar_url} />
                          <AvatarFallback className="bg-black text-white text-xl font-black italic uppercase rounded-3xl">
                            {user.name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-lg font-black uppercase tracking-tight line-clamp-1">{user.name}</p>
                          <p className="text-sm text-muted-foreground font-medium line-clamp-1">{user.email}</p>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setNewName(user.name);
                          setIsProfileUpdateOpen(true);
                        }} 
                        className="w-full rounded-2xl h-12 font-bold uppercase text-[10px] tracking-widest border-gray-100 hover:bg-gray-50"
                      >
                        Manage Account
                      </Button>
                    </div>

                    <div className="border-t pt-6">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Credits & Plan</h3>
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl p-6 border border-gray-100 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Balance</p>
                          <div className="flex items-center gap-2">
                             <Coins className="h-5 w-5 text-amber-500 fill-amber-500" />
                             <p className="text-2xl font-black uppercase tracking-tighter italic">{credits ?? 0} Credits</p>
                          </div>
                        </div>
                        <Button onClick={() => setIsTopUpOpen(true)} className="rounded-xl bg-black text-white px-4 font-bold uppercase text-[10px] tracking-widest h-10 shadow-lg">Add</Button>
                      </div>
                      <p className="text-[10px] font-bold text-muted-foreground text-center uppercase tracking-widest mt-4">Standard Plan — Active</p>
                    </div>
                  </div>

                  <div className="space-y-6 flex flex-col h-full bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden min-h-[400px]">
                    <div className="p-8 flex-1 flex flex-col">
                       <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-6">Activity Log</h3>
                       <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-none">
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
                                   <p className="text-[10px] font-black uppercase tracking-tight text-foreground group-hover:text-black transition-colors">
                                     {tx.operation.replace('_', ' ')}
                                   </p>
                                   <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                                     {new Date(tx.created_at).toLocaleDateString()} at {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                   </p>
                                 </div>
                               </div>
                               <span className={cn("text-xs font-black italic", tx.amount > 0 ? "text-green-600" : "text-amber-600")}>
                                 {tx.amount > 0 ? "+" : ""}{tx.amount}
                               </span>
                             </div>
                           ))
                         ) : (
                           <div className="flex flex-col items-center justify-center h-full text-center py-20 opacity-20">
                              <Coins className="h-12 w-12 mb-3" />
                              <p className="text-[10px] font-black uppercase tracking-widest">No activity recorded</p>
                           </div>
                         )}
                       </div>
                    </div>
                  </div>

                  <div className="mt-6 p-8 bg-white border border-gray-100 rounded-3xl shadow-sm space-y-4">
                     <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Privacy & Data</h3>
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <Trash2 className="h-4 w-4 text-muted-foreground" />
                           <span className="text-sm font-bold">Delete History</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleClearHistory}
                          className="rounded-xl h-8 px-4 text-[10px] font-black uppercase text-red-500 hover:bg-red-50"
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
                          className="rounded-xl h-8 px-4 text-[10px] font-black uppercase border-gray-100"
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
              <UrlInput onSubmit={handleSubmit} isLoading={isLoading} />
              
              <div className="max-w-4xl mx-auto px-6 pb-20">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                    <section>
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-6">Recent Spaces</h3>
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
                              <span className="text-[10px] font-black text-muted-foreground uppercase">{space.videoIds.length} videos</span>
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
                           <Button onClick={() => toast.info("Use the sidebar to create new spaces!")} variant="outline" className="mt-4 rounded-xl font-black uppercase text-[10px] tracking-widest h-8">Add Space</Button>
                        </div>
                      )}
                    </section>
                    
                    <section>
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-6">Continue Learning</h3>
                      <div className="space-y-3">
                         {historyItems.slice(0, 3).map((item) => (
                           <button 
                             key={item.id} 
                             onClick={() => handleLoadHistoryItem(item)}
                             className="w-full flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl hover:border-gray-200 transition-all text-left shadow-sm group"
                           >
                              <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center shrink-0 border border-gray-100 group-hover:bg-white transition-colors">
                                 <Search className="h-5 w-5 text-gray-400" />
                              </div>
                              <div className="min-w-0">
                                 <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{item.title}</p>
                                 <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight mt-0.5">{new Date(item.date).toLocaleDateString()}</p>
                              </div>
                           </button>
                         ))}
                         {historyItems.length > 3 && (
                           <Button onClick={() => setActiveView("history")} variant="link" className="w-full text-center text-[10px] font-black tracking-widest uppercase text-muted-foreground">View all history</Button>
                         )}
                         {historyItems.length === 0 && (
                           <div className="p-8 text-center bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">No recent searches</p>
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
