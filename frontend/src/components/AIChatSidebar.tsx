import { useState, useRef, useEffect } from "react";
import { 
  Send, 
  Bot, 
  User, 
  X, 
  MessageSquare, 
  Sparkles,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { RichMessage } from "./RichMessage";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIChatSidebarProps {
  messages: Message[];
  onSendMessage: (message: string, forcedContext?: string | null) => void;
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;
  contextSnippet?: string | null;
  onClearContext?: () => void;
}


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
        "fixed right-0 top-0 h-screen w-80 max-w-[calc(100vw-3rem)] bg-card border-l border-border shadow-2xl z-[60] flex flex-col backdrop-blur-xl",
        !isOpen && "pointer-events-none"
      )}
    >
      <div className="p-4 border-b border-border flex items-center justify-between bg-card/70 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center gap-3">
           <div className="w-9 h-9 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/10">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
           </div>
           <div>
              <p className="text-[10px] font-bold text-foreground">AI Assistant</p>
              <div className="flex items-center gap-1.5">
                <div className={cn("w-1.5 h-1.5 rounded-full", isLoading ? "bg-emerald-500 animate-pulse" : "bg-muted")} />
                <p className="text-[8px] font-medium text-muted-foreground">{isLoading ? "Processing..." : "Ready to help"}</p>
              </div>
           </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-secondary rounded-2xl transition-all group focus:outline-none focus:ring-2 focus:ring-primary/20"
          aria-label="Close chat"
        >
          <X className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
        </button>
      </div>

      <div className="flex-1 p-4 overflow-y-auto" ref={scrollRef} role="log" aria-label="Chat messages" aria-live="polite">
        <div className="space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-12 px-6">
               <div className="w-14 h-14 bg-secondary rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-border shadow-inner">
                  <MessageSquare className="h-6 w-6 text-muted-foreground/30" />
               </div>
               <h3 className="text-sm font-semibold text-foreground">How can I help today?</h3>
               <p className="text-[10px] font-medium text-muted-foreground mt-2 leading-relaxed opacity-70">
                  Ask me about specific timestamps, complex concepts, or request a summary.
               </p>
               <div className="mt-6 space-y-2">
                 {[
                   { label: "Summarize Key Points", prompt: "Summarize the key points and main takeaways from this video." },
                   { label: "Explain a Concept", prompt: "What are the most important concepts explained in this video?" },
                   { label: "Create Study Notes", prompt: "Create concise study notes from this video's content." },
                 ].map((suggestion) => (
                   <Button 
                     key={suggestion.label}
                     variant="outline" 
                     size="sm" 
                     className="rounded-2xl text-[9px] font-medium gap-2 border-border hover:bg-secondary text-muted-foreground transition-all w-full py-4 justify-start"
                     onClick={() => onSendMessage(suggestion.prompt)}
                   >
                     <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                     {suggestion.label}
                   </Button>
                 ))}
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
                  ? "bg-primary border-primary shadow-primary/20" 
                  : "bg-card border-border shadow-primary/5"
              )}>
                {msg.role === "assistant" ? (
                  <Bot className="h-4 w-4 text-primary-foreground" />
                ) : (
                  <User className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className={cn(
                "max-w-[85%] p-4 rounded-[1.5rem] text-[11px] leading-snug transition-all",
                msg.role === "assistant" 
                  ? "bg-card border border-border text-foreground font-medium rounded-tl-none shadow-lg shadow-foreground/5" 
                  : "bg-primary text-primary-foreground font-bold rounded-tr-none shadow-lg shadow-primary/10"
              )}>
                {msg.role === "assistant" ? (
                  <RichMessage content={msg.content} role="assistant" />
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            </motion.div>
          ))}
          
          {isLoading && !messages[messages.length - 1]?.content && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-2xl bg-primary shadow-primary/20 flex items-center justify-center shrink-0 shadow-lg">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="bg-card border border-border p-4 rounded-[1.5rem] rounded-tl-none shadow-sm">
                <div className="flex gap-1.5">
                   <div className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                   <div className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                   <div className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-card/70 backdrop-blur-xl border-t border-border space-y-4">
        {contextSnippet && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="p-3 bg-secondary rounded-2xl border border-border relative group shadow-sm"
          >
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-2 w-2 text-primary" />
              <p className="text-[8px] font-medium text-muted-foreground">Context Applied</p>
            </div>
            <p className="text-[10px] font-medium text-foreground line-clamp-2 leading-relaxed opacity-80 italic">
              "{contextSnippet}"
            </p>
            <button 
              onClick={onClearContext}
              className="absolute -top-2 -right-2 p-1.5 bg-background border border-border rounded-full shadow-md hover:bg-secondary transition-all active:scale-90"
            >
              <X className="h-2 w-2 text-muted-foreground" />
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
            className="w-full bg-secondary/50 border border-transparent group-focus-within:border-border group-focus-within:bg-card rounded-[1.5rem] p-4 text-xs font-semibold focus:ring-4 focus:ring-primary/5 min-h-[56px] max-h-[160px] resize-none pr-12 transition-all outline-none"
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !contextSnippet) || isLoading}
            className="absolute right-3 bottom-3 p-2.5 bg-primary text-primary-foreground rounded-[1rem] shadow-lg shadow-primary/20 hover:scale-110 hover:shadow-xl active:scale-95 transition-all disabled:opacity-20 disabled:scale-100 disabled:shadow-none"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[9px] text-center text-muted-foreground font-medium opacity-40">Shift + Enter for new line</p>
      </div>
    </motion.div>
  );
};

export default AIChatSidebar;
