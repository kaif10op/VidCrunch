import { useState, useRef, useEffect } from "react";
import { 
  Send, 
  Bot, 
  User, 
  X, 
  MessageSquare, 
  Sparkles,
  ChevronRight,
  Minimize2,
  Maximize2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIChatSidebarProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;
  contextSnippet?: string | null;
  onClearContext?: () => void;
}

const FormattedContent = ({ content }: { content: string }) => {
  // Simple markdown-lite formatter
  const lines = content.split("\n");
  
  return (
    <div className="space-y-2">
      {lines.map((line, idx) => {
        let processedLine = line.trim();
        
        // Handle Bullet Points
        if (processedLine.startsWith("* ") || processedLine.startsWith("- ")) {
          const point = processedLine.slice(2);
          return (
            <div key={idx} className="flex gap-2 ml-1">
              <span className="text-gray-400 mt-1.5">•</span>
              <span className="flex-1 text-inherit">
                <BoldParser text={point} />
              </span>
            </div>
          );
        }

        // Standard line
        return (
          <p key={idx} className="min-h-[1em]">
            <BoldParser text={line} />
          </p>
        );
      })}
    </div>
  );
};

const BoldParser = ({ text }: { text: string }) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <span key={i} className="font-black text-black">{part.slice(2, -2)}</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

const AIChatSidebar = ({
  messages,
  onSendMessage,
  isOpen,
  onClose,
  isLoading,
  contextSnippet,
  onClearContext
}: AIChatSidebarProps) => {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = () => {
    if (input.trim() || contextSnippet) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: isOpen ? 0 : 300, opacity: isOpen ? 1 : 0 }}
      transition={{ type: "spring", damping: 20, stiffness: 100 }}
      className={cn(
        "fixed right-0 top-0 h-screen w-80 bg-white border-l border-gray-100 shadow-2xl z-[60] flex flex-col",
        !isOpen && "pointer-events-none"
      )}
    >
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white/70 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center gap-3">
           <div className="w-9 h-9 bg-gradient-to-br from-black to-gray-700 rounded-2xl flex items-center justify-center shadow-lg">
              <Sparkles className="h-4 w-4 text-white" />
           </div>
           <div>
              <p className="text-[10px] font-black uppercase italic tracking-widest text-black">AI Assistant</p>
              <div className="flex items-center gap-1.5">
                <div className={cn("w-1.5 h-1.5 rounded-full", isLoading ? "bg-green-500 animate-pulse" : "bg-gray-300")} />
                <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-tight">{isLoading ? "Processing..." : "Ready to help"}</p>
              </div>
           </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-gray-100/50 rounded-2xl transition-all group"
        >
          <X className="h-4 w-4 text-gray-400 group-hover:text-black" />
        </button>
      </div>

      <div className="flex-1 p-4 overflow-y-auto" ref={scrollRef}>
        <div className="space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-12 px-6">
               <div className="w-14 h-14 bg-gray-50/50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-gray-100/50 shadow-inner">
                  <MessageSquare className="h-6 w-6 text-gray-300" />
               </div>
               <h3 className="text-sm font-black text-foreground tracking-tight">How can I help today?</h3>
               <p className="text-[10px] font-medium text-muted-foreground mt-2 leading-relaxed opacity-70">
                  Ask me about specific timestamps, complex concepts, or request a summary.
               </p>
               <div className="mt-8">
                 <Button 
                   variant="outline" 
                   size="sm" 
                   className="rounded-[1.25rem] text-[9px] font-black uppercase tracking-widest gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100/50 hover:from-blue-100 hover:to-indigo-100 text-blue-600 transition-all shadow-sm hover:shadow-md py-5 w-full"
                   onClick={() => onSendMessage("What is the current status of the 'Frontend Syncing Logic' task and what have we implemented so far?")}
                 >
                   <Sparkles className="h-3 w-3 animate-pulse" /> Discuss Current Task
                 </Button>
               </div>
            </div>
          )}
          
          {messages.map((msg, i) => (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              key={i}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "flex-row-reverse" : ""
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 border transition-all shadow-sm",
                msg.role === "assistant" 
                  ? "bg-black border-black shadow-black/20" 
                  : "bg-white border-gray-100 shadow-gray-200/50"
              )}>
                {msg.role === "assistant" ? (
                  <Bot className="h-4 w-4 text-white" />
                ) : (
                  <User className="h-4 w-4 text-gray-500" />
                )}
              </div>
              <div className={cn(
                "max-w-[85%] p-4 rounded-[1.5rem] text-[11px] leading-snug transition-all",
                msg.role === "assistant" 
                  ? "bg-white border border-gray-100 text-foreground font-medium rounded-tl-none shadow-sm shadow-gray-100/50" 
                  : "bg-gradient-to-br from-black to-gray-800 text-white font-bold rounded-tr-none shadow-md shadow-black/10"
              )}>
                {msg.role === "assistant" ? (
                  <FormattedContent content={msg.content} />
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            </motion.div>
          ))}
          
          {isLoading && !messages[messages.length - 1]?.content && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-2xl bg-black flex items-center justify-center shrink-0 shadow-lg shadow-black/20">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-white border border-gray-100 p-4 rounded-[1.5rem] rounded-tl-none shadow-sm">
                <div className="flex gap-1.5">
                   <div className="w-1.5 h-1.5 bg-gray-200 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                   <div className="w-1.5 h-1.5 bg-gray-200 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                   <div className="w-1.5 h-1.5 bg-gray-200 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-white/70 backdrop-blur-xl border-t border-gray-100 space-y-4">
        {contextSnippet && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="p-3 bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-200/50 relative group shadow-sm"
          >
            <div className="flex items-center gap-2 mb-1">
              <Bot className="h-2 w-2 text-indigo-500" />
              <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Context Applied</p>
            </div>
            <p className="text-[10px] font-medium text-foreground line-clamp-2 leading-relaxed opacity-80 italic">
              "{contextSnippet}"
            </p>
            <button 
              onClick={onClearContext}
              className="absolute -top-2 -right-2 p-1.5 bg-white border border-gray-100 rounded-full shadow-md hover:bg-gray-50 transition-all active:scale-90"
            >
              <X className="h-2 w-2 text-gray-400" />
            </button>
          </motion.div>
        )}
        
        <div className="relative group">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask a question..."
            className="w-full bg-gray-50/50 border border-transparent group-focus-within:border-gray-200 group-focus-within:bg-white rounded-[1.5rem] p-4 text-xs font-semibold focus:ring-4 focus:ring-black/5 min-h-[56px] max-h-[160px] resize-none pr-12 transition-all outline-none"
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !contextSnippet) || isLoading}
            className="absolute right-3 bottom-3 p-2.5 bg-black text-white rounded-[1rem] shadow-lg shadow-black/20 hover:scale-110 hover:shadow-xl active:scale-95 transition-all disabled:opacity-20 disabled:scale-100 disabled:shadow-none"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[9px] text-center text-muted-foreground font-bold uppercase tracking-widest opacity-40">Shift + Enter for new line</p>
      </div>
    </motion.div>
  );
};

export default AIChatSidebar;
