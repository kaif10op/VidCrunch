import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search,
  ArrowRight, 
  Upload, 
  Link as LinkIcon, 
  Clipboard, 
  Mic, 
  Loader2,
  StopCircle,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch, getAuthToken } from "@/lib/api";
import { API_BASE_URL } from "@/lib/constants";

interface UrlInputProps {
  onSubmit: (urls: string[], options: Record<string, unknown>) => void;
  isLoading: boolean;
  onUploadComplete?: (videoId: string, analysisId: string) => void;
  analysisStyle?: string;
  onStyleChange?: (style: string) => void;
}

const ANALYSIS_STYLES = [
  { id: "", label: "Auto", desc: "AI chooses best style" },
  { id: "Detailed", label: "Detailed", desc: "In-depth analysis" },
  { id: "Academic Research", label: "Academic", desc: "Research-focused" },
  { id: "Quick Summary", label: "Quick", desc: "Brief overview" },
  { id: "Podcast Script", label: "Podcast", desc: "Conversational script" },
  { id: "Study Guide", label: "Study Guide", desc: "Exam preparation" },
];

const UrlInput = ({ onSubmit, isLoading, onUploadComplete, analysisStyle = "", onStyleChange }: UrlInputProps) => {
  const [url, setUrl] = useState("");
  const [urls, setUrls] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (file: File) => {
    const allowedTypes = ["video/mp4", "video/x-matroska", "video/quicktime", "video/webm", "audio/mpeg", "audio/wav", "audio/mp3", "audio/m4a"];
    
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp4|mkv|mov|webm|mp3|wav|m4a)$/i)) {
      toast.error(`Unsupported file type: ${file.type || file.name.split('.').pop()}`);
      return;
    }

    const maxSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxSize) {
      toast.error("File too large. Maximum size is 500MB.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = getAuthToken();
      
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percent);
        }
      });

      const uploadPromise = new Promise<{ id: string; title: string; analysis_id: string }>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch {
              reject(new Error("Invalid response"));
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error.detail || `Upload failed: ${xhr.status}`));
            } catch {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
      });

      xhr.open("POST", `${API_BASE_URL}/api/videos/upload`);
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }
      xhr.send(formData);

      const result = await uploadPromise;
      
      toast.success(`"${result.title}" uploaded! Processing will begin shortly.`);
      
      if (onUploadComplete && result.id) {
        onUploadComplete(result.id, result.analysis_id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [onUploadComplete]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    if (url.trim() && !urls.includes(url.trim())) {
      setUrls(prev => [...prev, url.trim()]);
      setUrl("");
    }
  };

  const removeUrl = (idx: number) => {
    setUrls(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const allUrls = url.trim() ? [...urls, url.trim()] : urls;
    if (allUrls.length === 0) return;
    
    onSubmit(allUrls, { 
      provider: "groq", 
      model: "llama-3.3-70b-versatile", 
      language: "English", 
      style: analysisStyle || (allUrls.length > 1 ? "Comparative Synthesis" : "Detailed")
    });
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
    toast.info("Recording started... Speaking now will be captured.");
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    toast.info("Voice recording is not yet available. Stay tuned!");
    setRecordingTime(0);
  };

  const handleActionClick = async (title: string) => {
    if (title === "Paste") {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          setUrl(text);
          const match = text.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
          if (match && urls.length === 0 && !isLoading) {
            onSubmit([text], { 
              provider: "groq", 
              model: "llama-3.3-70b-versatile", 
              language: "English", 
              style: analysisStyle || "Detailed" 
            });
          }
        }
      } catch (err) {
        toast.error("Failed to read clipboard");
      }
    } else if (title === "Link") {
      document.querySelector("input")?.focus();
    } else if (title === "Upload") {
      fileInputRef.current?.click();
    } else if (title === "Record") {
      if (isRecording) stopRecording();
      else startRecording();
    }
  };

  const actions = [
    { title: "Upload", desc: isUploading ? "Uploading..." : "File, audio, video", icon: isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />, badge: isUploading ? undefined : "Popular", badgeColor: "bg-green-100 text-green-700" },
    { title: "Link", desc: "YouTube, Website", icon: <LinkIcon className="h-5 w-5" />, active: true },
    { title: "Paste", desc: "Copied Text", icon: <Clipboard className="h-5 w-5" /> },
    { title: "Record", desc: isRecording ? "Stop Recording" : "Record Lecture", icon: isRecording ? <StopCircle className="h-5 w-5 text-red-500 animate-pulse" /> : <Mic className="h-5 w-5" /> }
  ];

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-6">
      {/* Action Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {actions.map((action, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ 
              delay: i * 0.1,
              duration: 0.5,
              ease: [0.23, 1, 0.32, 1]
            }}
            whileHover={{ 
              y: -8,
              scale: 1.02,
              transition: { duration: 0.3, ease: "easeOut" }
            }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleActionClick(action.title)}
            aria-label={action.title}
            className={cn(
              "flex flex-col items-center justify-center p-6 rounded-[40px] bg-card border border-border shadow-sm hover:shadow-2xl hover:shadow-foreground/5 hover:border-primary transition-all group aspect-square relative overflow-hidden",
              (action.title === "Record" && isRecording) && "border-red-500/50 bg-red-500/5"
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 mb-4 z-10",
              (action.title === "Record" && isRecording) ? "bg-red-500 text-white" : "bg-secondary text-foreground group-hover:bg-primary group-hover:text-primary-foreground group-hover:rotate-6"
            )}>
              {action.icon}
            </div>
            <span className="text-sm font-bold text-foreground z-10">{action.title}</span>
            <span className="text-[10px] text-muted-foreground mt-1.5 text-center line-clamp-1 z-10 font-medium">
              {action.title === "Upload" && isUploading ? `${uploadProgress}%` : action.desc}
            </span>
            {action.title === "Upload" && isUploading && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-secondary z-20">
                <div 
                  className="h-full bg-primary transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }} 
                />
              </div>
            )}
          </motion.button>
        ))}
      </div>

      {/* Hidden file input for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*,.mp4,.mkv,.mov,.webm,.mp3,.wav,.m4a"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="max-w-5xl mx-auto space-y-4">
        {urls.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {urls.map((u, i) => (
              <div key={i} className="flex items-center gap-2 bg-secondary px-3 py-1.5 rounded-xl text-xs font-bold border border-border text-muted-foreground">
                <LinkIcon className="h-3 w-3" />
                <span className="truncate max-w-[200px]">{u}</span>
                <button onClick={() => removeUrl(i)} className="hover:text-destructive transition-colors">
                   <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative group">
          <form
            onSubmit={handleSubmit}
            className="relative flex items-center bg-card border border-border rounded-[32px] px-6 h-16 shadow-sm focus-within:shadow-md focus-within:border-primary/50 transition-all gap-4"
          >
            <Search className="h-5 w-5 text-muted-foreground/50" />
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              disabled={isLoading}
              placeholder="Learn anything"
              className="flex-1 bg-transparent text-lg focus:outline-none placeholder:text-muted-foreground/30 font-medium"
            />
            
            <button
              type="submit"
              disabled={isLoading || (!url.trim() && urls.length === 0)}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                (url.trim() || urls.length > 0) ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground/30"
              )}
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          </form>
        </div>

        
        {urls.length > 1 && (
          <p className="text-center text-xs font-medium text-emerald-600 dark:text-emerald-400 animate-pulse">
            Synthesis Mode: Comparative analysis of {urls.length + (url.trim() ? 1 : 0)} videos enabled
          </p>
        )}

        {/* Analysis Style Selector */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-2 justify-center flex-wrap pt-2"
        >
          <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider mr-1">Style:</span>
          {ANALYSIS_STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => onStyleChange?.(s.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                (analysisStyle || "") === s.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary hover:text-foreground"
              )}
              title={s.desc}
            >
              {s.label}
            </button>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default UrlInput;
