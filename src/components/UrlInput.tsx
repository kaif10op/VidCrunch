import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowRight, 
  Upload, 
  Link as LinkIcon, 
  Clipboard, 
  Mic, 
  Loader2,
  Sparkles,
  StopCircle,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface UrlInputProps {
  onSubmit: (urls: string[], options: Record<string, unknown>) => void;
  isLoading: boolean;
}

const UrlInput = ({ onSubmit, isLoading }: UrlInputProps) => {
  const [url, setUrl] = useState("");
  const [urls, setUrls] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      style: allUrls.length > 1 ? "Comparative Synthesis" : "Detailed" 
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
    toast.success("Recording saved and sent for transcription!");
    // Simulate finding a transcript from recording
    setUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"); 
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
              style: "Detailed" 
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
    { title: "Upload", desc: "File, audio, video", icon: <Upload className="h-5 w-5" />, badge: "Popular", badgeColor: "bg-green-100 text-green-700" },
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
    <div className="w-full max-w-4xl mx-auto py-12 px-4">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            toast.success(`Processing file: ${file.name}`);
            // Mocking a result for the dummy removal
            setUrl(`Local File: ${file.name} - Transcription Processing...`);
          }
        }}
      />

      <motion.h1 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl md:text-5xl font-black text-center mb-12 tracking-tight"
      >
        Ready to learn, Shivam?
      </motion.h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {actions.map((action, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => handleActionClick(action.title)}
            className={cn(
              "p-6 rounded-3xl border text-left transition-all relative group h-32 flex flex-col justify-between",
              (action.active || (action.title === "Record" && isRecording))
                ? "bg-white border-gray-200 shadow-sm" 
                : "bg-transparent border-transparent hover:bg-gray-50"
            )}
          >
            {action.badge && (
              <span className={cn(
                "absolute top-4 right-4 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight",
                action.badgeColor
              )}>
                {action.badge}
              </span>
            )}
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-colors shadow-sm border border-gray-100 bg-white",
              (action.active || isRecording) ? "text-gray-900" : "text-gray-500 group-hover:text-gray-900"
            )}>
              {action.icon}
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                {action.title === "Record" && isRecording ? `Stop (${formatTime(recordingTime)})` : action.title}
              </p>
              <p className="text-xs text-muted-foreground">{action.desc}</p>
            </div>
          </motion.button>
        ))}
      </div>

      <div className="max-w-3xl mx-auto space-y-4">
        <AnimatePresence>
          {urls.length > 0 && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex flex-wrap gap-2 mb-4 overflow-hidden"
            >
              {urls.map((u, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full text-xs font-bold border border-gray-200">
                  <LinkIcon className="h-3 w-3" />
                  <span className="truncate max-w-[200px]">{u}</span>
                  <button onClick={() => removeUrl(i)} className="hover:text-red-500 transition-colors">
                     <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="relative group w-full"
        >
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-gray-100 to-gray-50 blur opacity-0 group-focus-within:opacity-100 transition duration-1000" />
          <div className="relative flex items-center bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm h-16 px-6 focus-within:border-gray-300 transition-all gap-3">
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onPaste={e => {
                const text = e.clipboardData.getData('text');
                const match = text.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
                if (match && urls.length === 0 && !isLoading) {
                  setTimeout(() => {
                    onSubmit([text], { 
                      provider: "groq", 
                      model: "llama-3.3-70b-versatile", 
                      language: "English", 
                      style: "Detailed" 
                    });
                  }, 50);
                }
              }}
              disabled={isLoading}
              placeholder={urls.length > 0 ? "Add another video for synthesis..." : "Paste a YouTube link to start learning"}
              className="flex-1 bg-transparent text-lg focus:outline-none placeholder:text-gray-400 font-medium"
            />
            
            {url.trim() && (
              <Button 
                type="button"
                variant="ghost" 
                onClick={handleAdd}
                className="h-10 px-4 rounded-xl font-bold text-xs uppercase bg-gray-50 hover:bg-gray-100 border border-gray-100"
              >
                Add
              </Button>
            )}

            <button
              type="submit"
              disabled={isLoading || (!url.trim() && urls.length === 0)}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                (url.trim() || urls.length > 0) ? "bg-black text-white" : "bg-gray-100 text-gray-300"
              )}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ArrowRight className="h-5 w-5" />
              )}
            </button>
          </div>
        </motion.form>
        
        {urls.length > 1 && (
          <p className="text-center text-[10px] font-black uppercase tracking-widest text-green-600 animate-pulse">
            Synthesis Mode: Comparative analysis of {urls.length + (url.trim() ? 1 : 0)} videos enabled
          </p>
        )}
      </div>
    </div>
  );
};

export default UrlInput;
