import { 
  Mic, 
  Headphones,
  Video,
  FileText,
  HelpCircle,
  Layers,
  StickyNote,
  GraduationCap,
  Settings2,
  Plus,
  Send,
  CheckCircle2,
  Loader2,
  Brain,
  Map
} from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface LearnToolsProps {
  onToolClick?: (toolId: string, value?: string) => void;
  sets?: { id: string; name: string; date: string; type: string }[];
  hasQuiz?: boolean;
  hasFlashcards?: boolean;
  hasRoadmap?: boolean;
  hasMindMap?: boolean;
  isChatLoading?: boolean;
  isMobile?: boolean;
}

const LearnTools = ({ onToolClick, sets = [], hasQuiz, hasFlashcards, hasRoadmap, hasMindMap, isChatLoading, isMobile }: LearnToolsProps) => {
  const [question, setQuestion] = useState("");
  const [lastClicked, setLastClicked] = useState<string | null>(null);

  const tools = [
    { id: 'podcast', name: 'Podcast', icon: <Headphones className="h-5 w-5" />, type: 'chat' },
    { id: 'deepdive', name: 'Deep Dive', icon: <Video className="h-5 w-5" />, type: 'chat' },
    { id: 'roadmap', name: 'Summary', icon: <FileText className="h-5 w-5" />, type: 'scroll', available: hasRoadmap },
    { id: 'quiz', name: 'Quiz', icon: <HelpCircle className="h-5 w-5" />, type: 'scroll', available: hasQuiz },
    { id: 'flashcards', name: 'Flashcards', icon: <Layers className="h-5 w-5" />, type: 'scroll', available: hasFlashcards },
    { id: 'notes', name: 'Notes', icon: <StickyNote className="h-5 w-5" />, type: 'chat' },
    { id: 'mindmap', name: 'Mind Map', icon: <GraduationCap className="h-5 w-5" />, type: 'scroll', available: hasMindMap },
  ];

  const handleAsk = () => {
    if (question.trim()) {
      onToolClick?.("ask", question.trim());
      setQuestion("");
    }
  };

  const handleToolClick = (toolId: string) => {
    setLastClicked(toolId);
    onToolClick?.(toolId);
  };

  return (
    <aside className={cn(
      "bg-white flex-col overflow-hidden",
      isMobile 
        ? "flex w-full h-auto border-0" 
        : "hidden lg:flex w-[340px] border-l h-screen"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-sm font-semibold text-foreground">Learn Tab</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1 hover:bg-gray-100 rounded transition-colors">
            <Plus className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Generate Section */}
      <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-thin">
        <h3 className="text-xs font-semibold text-muted-foreground mb-4">Generate</h3>
        <div className="grid grid-cols-2 gap-3">
          {tools.map((tool) => {
            const isActive = lastClicked === tool.id && isChatLoading;
            const isAvailable = tool.type === 'scroll' && tool.available;
            return (
              <button
                key={tool.id}
                onClick={() => handleToolClick(tool.id)}
                disabled={isActive}
                className={cn(
                  "flex items-center justify-between p-3.5 rounded-xl border transition-all text-left group relative",
                  isActive 
                    ? "bg-blue-50 border-blue-200 cursor-wait" 
                    : "bg-gray-50/80 border-gray-100 hover:bg-gray-100/80 hover:border-gray-200"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className={cn(
                    "transition-colors",
                    isActive ? "text-blue-600 animate-pulse" : "text-gray-600 group-hover:text-gray-900"
                  )}>
                    {isActive ? <Loader2 className="h-5 w-5 animate-spin" /> : tool.icon}
                  </span>
                  <span className="text-sm font-medium text-foreground">{tool.name}</span>
                </div>
                {isAvailable ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                ) : tool.type === 'chat' ? (
                  <span className="text-[9px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">AI</span>
                ) : (
                  <Settings2 className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
                )}
              </button>
            );
          })}
        </div>

        {/* My Sets Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-muted-foreground">Generated Content</h3>
            <span className="text-xs text-muted-foreground">{sets.length}</span>
          </div>
          {sets.length > 0 ? (
            <div className="space-y-2">
              {sets.map((set) => (
                <button 
                  key={set.id} 
                  onClick={() => handleToolClick(set.type)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50/80 border border-gray-100 hover:bg-gray-100/80 transition-all group text-left"
                >
                  <div className="flex items-center gap-3">
                    {set.type === 'quiz' ? <Brain className="h-4 w-4 text-red-400" /> :
                     set.type === 'flashcards' ? <Layers className="h-4 w-4 text-purple-400" /> :
                     set.type === 'roadmap' ? <Map className="h-4 w-4 text-purple-400" /> :
                     <FileText className="h-4 w-4 text-gray-400" />}
                    <div>
                      <p className="text-sm font-medium text-foreground">{set.name}</p>
                      <p className="text-[11px] text-muted-foreground">{set.date}</p>
                    </div>
                  </div>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 opacity-60" />
                </button>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center">
              <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-3 border border-gray-100">
                <Layers className="h-4 w-4 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-400">No sets yet</p>
              <p className="text-xs text-gray-300 mt-1">Generate flashcards or quizzes to create sets</p>
            </div>
          )}
        </div>
      </div>

      {/* Ask Anything Input */}
      <div className="px-5 py-4 border-t border-gray-100">
        <div className="relative">
          <input 
            type="text" 
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyUp={(e) => e.key === "Enter" && handleAsk()}
            placeholder="Ask anything" 
            className="w-full h-11 pl-4 pr-20 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-200 text-sm transition-all placeholder:text-gray-400"
          />
          <div className="absolute inset-y-0 right-2 flex items-center gap-1">
            {question.trim() ? (
              <Button 
                onClick={handleAsk}
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 rounded-lg text-gray-500 hover:text-gray-900 transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            <button 
              onClick={() => toast.info("Voice input coming soon!")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-black transition-colors"
              aria-label="Voice input (coming soon)"
            >
              <Mic className="h-3 w-3" />
              Voice
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default LearnTools;
