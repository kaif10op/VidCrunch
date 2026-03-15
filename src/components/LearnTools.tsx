import { 
  MessageCircle, 
  Target, 
  Rocket, 
  Box, 
  Mic, 
  FileText,
  Search,
  Sparkles,
  Zap,
  Layout,
  Map,
  Layers,
  Clock,
  ChevronDown,
  Send
} from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

interface LearnToolsProps {
  onToolClick?: (toolId: string, value?: string) => void;
}

const LearnTools = ({ onToolClick }: LearnToolsProps) => {
  const [question, setQuestion] = useState("");

  const tools = [
    { id: 'podcast', name: 'Podcast Mode', icon: <MessageCircle className="h-4 w-4" />, desc: 'Convert to audio dialog', badge: 'AI' },
    { id: 'quiz', name: 'Interactive Quiz', icon: <Target className="h-4 w-4" />, desc: 'Test your knowledge', active: true },
    { id: 'roadmap', name: 'Mastery Roadmap', icon: <Rocket className="h-4 w-4" />, desc: 'Step-by-step guide' },
    { id: 'mindmap', name: 'Mind Map', icon: <Map className="h-4 w-4" />, desc: 'Visual connections' },
    { id: 'flashcards', name: 'Smart Flashcards', icon: <Layers className="h-4 w-4" />, desc: 'Memory practice' },
    { id: 'deepdive', name: 'Deep Dive', icon: <Sparkles className="h-4 w-4" />, desc: 'Advanced analysis' },
  ];

  const suggestedActivities = [
    { name: 'Explain like I\'m 5', icon: <Zap className="h-3 w-3" /> },
    { name: 'Critical Review', icon: <FileText className="h-3 w-3" /> },
    { name: 'Practical Exercise', icon: <Layout className="h-3 w-3" /> },
  ];

  const handleAsk = () => {
    if (question.trim()) {
      onToolClick?.("ask", question.trim());
      setQuestion("");
    }
  };

  return (
    <aside className="w-80 border-l bg-gray-50/30 h-screen flex flex-col p-6 overflow-y-auto scrollbar-none">
      <div className="mb-8">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-6">Learning Tools</h3>
        <div className="grid grid-cols-1 gap-3">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => onToolClick?.(tool.id)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-100 hover:border-gray-300 transition-all text-left shadow-sm hover:shadow-md group"
            >
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-900 group-hover:bg-white transition-colors border border-gray-50">
                {tool.icon}
              </div>
              <div className="flex-1 min-w-0">
                 <div className="flex items-center justify-between mb-0.5">
                   <p className="text-sm font-bold text-foreground">{tool.name}</p>
                   {tool.badge && (
                      <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">{tool.badge}</span>
                   )}
                 </div>
                 <p className="text-[10px] text-muted-foreground font-medium">{tool.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Suggested Actions</h3>
        <div className="flex flex-wrap gap-2">
          {suggestedActivities.map((act, i) => (
            <button 
              key={i} 
              onClick={() => onToolClick?.("action", act.name)}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-100 rounded-xl text-[10px] font-bold hover:border-gray-300 transition-all shadow-sm"
            >
              {act.icon}
              {act.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto">
        <div className="relative group">
           <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
             <Mic className="h-4 w-4 text-gray-400" />
           </div>
           <input 
             type="text" 
             value={question}
             onChange={(e) => setQuestion(e.target.value)}
             onKeyUp={(e) => e.key === "Enter" && handleAsk()}
             placeholder="Ask anything about the video..." 
             className="w-full h-12 pl-12 pr-12 rounded-2xl border border-gray-100 bg-white shadow-sm focus:outline-none focus:border-gray-300 text-sm font-medium transition-all"
           />
           <div className="absolute inset-y-0 right-3 flex items-center">
             <Button 
               onClick={handleAsk}
               variant="ghost" 
               size="icon" 
               className="h-8 w-8 rounded-xl text-gray-400 hover:text-gray-900 transition-colors"
             >
               <Send className="h-4 w-4" />
             </Button>
           </div>
        </div>
        <p className="text-center text-[9px] text-gray-400 mt-3 font-semibold uppercase tracking-wider">Powered by YouLearn AI</p>
      </div>
    </aside>
  );
};

export default LearnTools;
