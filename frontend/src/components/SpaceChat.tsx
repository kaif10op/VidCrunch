import { useState, useRef, useEffect } from "react";
import { 
  Send, 
  Bot, 
  User, 
  Sparkles,
  ChevronRight,
  MessageSquare,
  Loader2
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { RichMessage } from "./RichMessage";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SpaceChatProps {
  spaceId: string;
  onSendChat: (spaceId: string, message: string, onChunk: (chunk: string) => void) => Promise<void>;
  initialMessages?: Message[];
}


export default function SpaceChat({ spaceId, onSendChat, initialMessages = [] }: SpaceChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      let currentResponse = "";
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);
      
      await onSendChat(spaceId, userMsg.content, (chunk) => {
        currentResponse += chunk;
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content = currentResponse;
          return newMessages;
        });
      });
    } catch (err) {
      console.error("Space chat error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-white/70 backdrop-blur-xl">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-gradient-to-br from-black to-gray-700 rounded-2xl flex items-center justify-center shadow-lg">
              <Sparkles className="h-5 w-5 text-white" />
           </div>
           <div>
              <p className="text-xs font-bold text-black font-display">Space Genius</p>
              <div className="flex items-center gap-1.5">
                <div className={cn("w-1.5 h-1.5 rounded-full", isLoading ? "bg-green-500 animate-pulse" : "bg-gray-300")} />
                <p className="text-[10px] font-medium text-muted-foreground">{isLoading ? "Synthesizing..." : "Context set"}</p>
              </div>
           </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-6" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="text-center py-24 px-6">
             <div className="w-16 h-16 bg-gray-50/50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 border border-gray-100/50">
                <MessageSquare className="h-7 w-7 text-gray-300" />
             </div>
             <h3 className="text-md font-bold text-foreground font-display">Ask your Space</h3>
             <p className="text-xs font-medium text-muted-foreground mt-2 leading-relaxed opacity-70">
                I can answer questions based on all videos, documents, and notes in this space.
             </p>
             <div className="mt-8 space-y-2">
               {[
                 "Summarize everything in this space",
                 "What are the common themes?",
                 "Help me study for an exam"
               ].map((prompt) => (
                 <Button 
                   key={prompt}
                   variant="outline" 
                   size="sm" 
                   className="rounded-2xl text-[10px] font-medium gap-2 border-gray-100 hover:bg-gray-50 text-gray-600 w-full py-5 justify-start text-left"
                   onClick={() => { setInput(prompt); }}
                 >
                   <ChevronRight className="h-3 w-3 text-gray-300" />
                   {prompt}
                 </Button>
               ))}
             </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            key={i}
            className={cn("flex gap-4", msg.role === "user" ? "flex-row-reverse" : "justify-start")}
          >
            <div className={cn(
              "w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm transition-all",
              msg.role === "assistant" ? "bg-black border-black shadow-black/20" : "bg-white border-gray-100 shadow-gray-200/50"
            )}>
              {msg.role === "assistant" ? <Bot className="h-5 w-5 text-white" /> : <User className="h-5 w-5 text-gray-500" />}
            </div>
            <div className={cn(
              "max-w-[85%] p-4 rounded-[1.75rem] text-xs leading-relaxed transition-all",
              msg.role === "assistant" 
                ? "bg-gray-50/50 border border-gray-100/50 text-foreground font-medium rounded-tl-none shadow-sm" 
                : "bg-black text-white font-bold rounded-tr-none shadow-md"
            )}>
              {msg.role === "assistant" ? <RichMessage content={msg.content} role="assistant" /> : <p>{msg.content}</p>}
            </div>
          </motion.div>
        ))}

        {isLoading && !messages[messages.length - 1]?.content && (
          <div className="flex gap-4">
            <div className="w-9 h-9 rounded-2xl bg-black flex items-center justify-center shrink-0 shadow-lg shadow-black/20">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="bg-gray-50/50 border border-gray-100/50 p-4 rounded-[1.75rem] rounded-tl-none shadow-sm flex items-center gap-2">
               <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
               <span className="text-[10px] text-muted-foreground font-medium animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-gray-50">
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
            placeholder="Search across all materials..."
            className="w-full bg-gray-50/50 border border-transparent group-focus-within:border-gray-200 group-focus-within:bg-white rounded-[1.5rem] p-4 text-xs font-semibold focus:ring-4 focus:ring-black/5 min-h-[60px] max-h-[160px] resize-none pr-12 transition-all outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-3 bottom-3 p-2.5 bg-black text-white rounded-[1rem] shadow-lg shadow-black/20 hover:scale-110 active:scale-95 transition-all disabled:opacity-20 disabled:scale-100"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
