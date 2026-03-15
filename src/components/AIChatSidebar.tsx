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
      <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 bg-black rounded-xl flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
           </div>
           <div>
              <p className="text-xs font-black uppercase italic tracking-tighter">AI Assistant</p>
              <p className="text-[8px] font-bold text-muted-foreground uppercase leading-none">Powered by YouLearn AI</p>
           </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-xl transition-all"
        >
          <Minimize2 className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      <div className="flex-1 p-4 overflow-y-auto" ref={scrollRef}>
        <div className="space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-10 px-4">
               <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
                  <MessageSquare className="h-6 w-6 text-gray-300" />
               </div>
               <p className="text-sm font-bold text-foreground">Ask anything about the video!</p>
               <p className="text-[10px] font-medium text-muted-foreground mt-2 leading-relaxed">
                  I can explain concepts, find specific details, or summarize the transcript for you.
               </p>
            </div>
          )}
          
          {messages.map((msg, i) => (
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              key={i}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "flex-row-reverse" : ""
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border",
                msg.role === "assistant" ? "bg-black border-black" : "bg-white border-gray-200"
              )}>
                {msg.role === "assistant" ? (
                  <Bot className="h-4 w-4 text-white" />
                ) : (
                  <User className="h-4 w-4 text-gray-500" />
                )}
              </div>
              <div className={cn(
                "max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm",
                msg.role === "assistant" 
                  ? "bg-gray-50 text-foreground font-medium rounded-tl-none" 
                  : "bg-black text-white font-bold rounded-tr-none"
              )}>
                {msg.content}
              </div>
            </motion.div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-black flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl rounded-tl-none border border-gray-100">
                <div className="flex gap-1.5">
                   <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                   <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                   <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-white border-t border-gray-50 space-y-3">
        {contextSnippet && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="p-3 bg-gray-50 rounded-2xl border border-gray-100 relative group"
          >
            <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">Context Snippet</p>
            <p className="text-[10px] font-medium text-foreground line-clamp-2 leading-relaxed">
              "{contextSnippet}"
            </p>
            <button 
              onClick={onClearContext}
              className="absolute -top-2 -right-2 p-1 bg-white border border-gray-100 rounded-full shadow-lg hover:bg-gray-50 transition-all"
            >
              <X className="h-2 w-2" />
            </button>
          </motion.div>
        )}
        
        <div className="relative">
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
            className="w-full bg-gray-50 border-none rounded-2xl p-4 text-xs font-medium focus:ring-1 focus:ring-black min-h-[56px] max-h-[120px] resize-none pr-12"
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !contextSnippet) || isLoading}
            className="absolute right-3 bottom-3 p-2 bg-black text-white rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-20 disabled:scale-100"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[9px] text-center text-muted-foreground font-bold uppercase tracking-tight">Shift + Enter for new line</p>
      </div>
    </motion.div>
  );
};

export default AIChatSidebar;
