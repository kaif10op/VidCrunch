import { 
  Headphones,
  Video,
  FileText,
  HelpCircle,
  Layers,
  StickyNote,
  Plus,
  Brain,
  Map as MapIcon,
  Search,
  Settings2,
  Mic,
  X,
  Rocket,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Download,
  LayoutGrid,
  MoreHorizontal
} from "lucide-react";
import { useState, useMemo, Suspense, lazy } from "react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

const QuizTab = lazy(() => import("./QuizTab"));
const MindMapTab = lazy(() => import("./MindMapTab"));
const Flashcards = lazy(() => import("./Flashcards"));
const NotesTool = lazy(() => import("./NotesTool"));

interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

interface RoadmapStep {
  step: number;
  task: string;
  description: string;
}

interface MindMapData {
  nodes: { id: string; label: string }[];
  edges: { source: string; target: string; label?: string }[];
}

interface LearnToolsProps {
  onToolClick?: (toolId: string, value?: string) => void;
  sets?: { id: string; name: string; date: string; type: string }[];
  hasQuiz?: boolean;
  hasFlashcards?: boolean;
  hasRoadmap?: boolean;
  hasMindMap?: boolean;
  isChatLoading?: boolean;
  isMobile?: boolean;
  onGenerate?: (toolId: string) => void;
  generatingTools?: string[];
  quizData?: QuizQuestion[];
  roadmapData?: { title: string; steps: RoadmapStep[] };
  mindMapData?: MindMapData;
  flashcardsData?: { front: string; back: string }[];
  podcastData?: { audioUrl?: string; script?: string };
  activeSidebarTab?: string;
  onSidebarTabChange?: (tab: string) => void;
  onAIAction?: (action: string, context: string) => void;
}

const LearnTools = ({ 
  onToolClick, 
  sets = [], 
  hasQuiz, 
  hasFlashcards, 
  hasRoadmap, 
  hasMindMap, 
  isChatLoading, 
  isMobile, 
  onGenerate, 
  generatingTools = [],
  quizData,
  roadmapData,
  mindMapData,
  flashcardsData,
  podcastData,
  activeSidebarTab = "learn",
  onSidebarTabChange,
  onAIAction
}: LearnToolsProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [askInput, setAskInput] = useState("");

  const tools = [
    { id: 'podcast', name: 'Podcast', icon: <Headphones className="h-4 w-4" />, color: 'text-indigo-600', bg: 'bg-indigo-50', available: !!podcastData },
    { id: 'video', name: 'Video', icon: <Video className="h-4 w-4" />, color: 'text-blue-600', bg: 'bg-blue-50', available: true },
    { id: 'summary', name: 'Summary', icon: <FileText className="h-4 w-4" />, color: 'text-sky-600', bg: 'bg-sky-50', available: true },
    { id: 'quiz', name: 'Quiz', icon: <HelpCircle className="h-4 w-4" />, color: 'text-rose-600', bg: 'bg-rose-50', available: hasQuiz || !!quizData },
    { id: 'flashcards', name: 'Flashcards', icon: <Layers className="h-4 w-4" />, color: 'text-orange-600', bg: 'bg-orange-50', available: hasFlashcards || !!flashcardsData },
    { id: 'notes', name: 'Notes', icon: <StickyNote className="h-4 w-4" />, color: 'text-amber-600', bg: 'bg-amber-50', available: true },
  ];

  const filteredSets = useMemo(() => 
    sets.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [searchQuery, sets]
  );

  const handleToolClick = (toolId: string) => {
    onToolClick?.(toolId);
  };

  const handleAsk = () => {
    if (askInput.trim()) {
      onToolClick?.('ask', askInput.trim());
      setAskInput("");
    }
  };

  const activeTabs = useMemo(() => {
    const tabs = [{ id: 'learn', name: 'Learn', icon: <LayoutGrid className="h-3 w-3" /> }];
    if (quizData) tabs.push({ id: 'quiz', name: 'Quiz', icon: <HelpCircle className="h-3 w-3" /> });
    if (flashcardsData) tabs.push({ id: 'flashcards', name: 'Flashcards', icon: <Layers className="h-3 w-3" /> });
    if (roadmapData) tabs.push({ id: 'roadmap', name: 'Roadmap', icon: <Brain className="h-3 w-3" /> });
    if (mindMapData) tabs.push({ id: 'mindmap', name: 'Mind Map', icon: <MapIcon className="h-3 w-3" /> });
    tabs.push({ id: 'notes', name: 'Notes', icon: <StickyNote className="h-3 w-3" /> });
    return tabs;
  }, [quizData, flashcardsData, roadmapData, mindMapData]);

  const renderActiveTool = () => {
    switch (activeSidebarTab) {
      case 'quiz':
        return quizData ? (
          <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading quiz...</div>}>
            <div className="sidebar-quiz-container scale-[0.85] origin-top -mt-4">
              <QuizTab 
                quiz={quizData} 
                onAIAction={(action, context) => {
                  let prompt = context;
                  if (action === 'hint') prompt = `Give me a helpful hint for this question: "${context}". Don't give me the answer directly.`;
                  if (action === 'explain') prompt = `Explain the concept behind this question like I'm 5 years old: "${context}"`;
                  if (action === 'walkthrough') prompt = `Walk me through the logical steps to arrive at the correct answer for this question: "${context}"`;
                  onAIAction?.(action, prompt);
                  // Also trigger the 'ask' tool click to open chat if needed
                  onToolClick?.('ask', prompt);
                }}
              />
            </div>
          </Suspense>
        ) : null;
      case 'flashcards':
        return flashcardsData ? (
          <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading flashcards...</div>}>
             <div className="scale-[0.85] origin-top -mt-4">
                <Flashcards cards={flashcardsData} />
             </div>
          </Suspense>
        ) : null;
      case 'roadmap':
        return roadmapData ? (
          <div className="relative pl-6 pr-2 py-8 space-y-12">
             <div className="absolute left-10 top-12 bottom-12 w-px border-l-2 border-dashed border-gray-100 z-0" />
             
             <div className="flex items-center gap-4 mb-4 relative z-10 bg-white pb-4">
                <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center shadow-xl shadow-black/10">
                   <Rocket className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">{roadmapData.title || "Mastery Path"}</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{roadmapData.steps.length} Milestones</p>
                </div>
             </div>

             {roadmapData.steps.map((step, i) => (
                <div key={i} className="relative z-10 flex items-start gap-6 group">
                   <div className={cn(
                     "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-black text-[10px] shadow-md transition-all group-hover:scale-110 border-2",
                     i === 0 ? "bg-black border-black text-white" : "bg-white border-gray-100 text-gray-400 group-hover:border-black group-hover:text-black"
                   )}>
                     {step.step}
                   </div>
                   <div className="flex-1 space-y-2 pt-0.5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Stage {step.step}</p>
                      <h4 className="text-sm font-bold text-gray-900 leading-tight group-hover:text-black transition-colors">{step.task}</h4>
                      <div className="p-5 rounded-[2rem] bg-gray-50/50 border border-gray-50 text-[11px] font-medium text-gray-500 leading-relaxed group-hover:bg-white group-hover:border-gray-100 group-hover:shadow-lg group-hover:shadow-black/5 transition-all">
                         {step.description}
                      </div>
                   </div>
                </div>
             ))}
          </div>
        ) : null;
      case 'mindmap':
        return mindMapData ? (
          <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading mind map...</div>}>
            <div className="h-[500px] border border-gray-100 bg-gray-50/30 rounded-3xl overflow-hidden mt-4">
              <MindMapTab mindMap={mindMapData} />
            </div>
          </Suspense>
        ) : null;
      case 'notes':
        return (
          <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading notes...</div>}>
            <div className="mt-4">
              <NotesTool />
            </div>
          </Suspense>
        );
      default:
        return null;
    }
  };

  return (
    <aside className={cn(
      "bg-white flex-col overflow-hidden relative",
      isMobile 
        ? "flex w-full h-auto border-0" 
        : "hidden lg:flex w-[380px] border-l border-gray-100 h-screen"
    )}>
      {/* Pinned Podcast Player (YouLearn Style) */}
      {podcastData?.audioUrl && (
        <div className="mx-6 mt-6 p-4 rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-100 flex items-center gap-4 group">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
            <Headphones className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">AI Podcast</p>
            <p className="text-xs font-bold truncate">Study Overview</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white w-1/3" />
              </div>
              <span className="text-[9px] font-bold">1:24</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
              <Pause className="h-4 w-4 fill-white" />
            </button>
            <button className="p-1.5 hover:bg-white/10 rounded-lg transition-colors hidden group-hover:block">
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Tabbed Header */}
      <div className="px-6 py-4 border-b border-gray-50 bg-white/50 backdrop-blur-md sticky top-0 z-20 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2">
           {activeTabs.map((tab) => (
             <button
               key={tab.id}
               onClick={() => onSidebarTabChange?.(tab.id)}
               className={cn(
                 "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border",
                 activeSidebarTab === tab.id 
                   ? "bg-black text-white border-black shadow-md" 
                   : "bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100"
               )}
             >
               {tab.icon}
               {tab.name}
               {tab.id !== 'learn' && (
                 <X 
                   className="h-3 w-3 ml-2 hover:text-red-400 transition-colors" 
                   onClick={(e) => {
                     e.stopPropagation();
                     onSidebarTabChange?.('learn');
                   }} 
                 />
               )}
             </button>
           ))}
           <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-xl bg-gray-50/50">
              <Plus className="h-4 w-4 text-gray-400" />
           </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-none pb-40">
        {activeSidebarTab === 'learn' ? (
          <div className="space-y-10">
            {/* Generate Section */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">Generate</h3>
              <div className="grid grid-cols-2 gap-3">
                {tools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => handleToolClick(tool.id)}
                    className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm transition-all group relative overflow-hidden h-14"
                  >
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105", tool.bg, tool.color)}>
                      {tool.icon}
                    </div>
                    <span className="text-[13px] font-bold text-gray-700 truncate flex-1 text-left">{tool.name}</span>
                    <Settings2 className="h-3.5 w-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-all transform translate-x-1 group-hover:translate-x-0" />
                    
                    {!tool.available && (
                       <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[9px] font-black uppercase tracking-tighter bg-black text-white px-2 py-0.5 rounded-lg">Generate</span>
                       </div>
                    )}
                  </button>
                ))}
                
                <button 
                  onClick={() => handleToolClick('roadmap')}
                  className="col-span-2 flex items-center gap-3 p-3 rounded-2xl border border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm transition-all group h-14"
                >
                   <div className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                      <Brain className="h-4 w-4" />
                   </div>
                   <span className="text-[13px] font-bold text-gray-700 flex-1 text-left">Lesson Plan</span>
                   <span className="text-[9px] font-black bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-lg uppercase">New</span>
                   <Settings2 className="h-3.5 w-3.5 text-gray-300 opacity-0 group-hover:opacity-100" />
                </button>
              </div>
            </div>

            {/* My Sets Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">My Sets</h3>
                <div className="flex items-center gap-2">
                   <Search className="h-3.5 w-3.5 text-gray-300 cursor-pointer hover:text-black transition-colors" />
                   <div className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">
                      <span className="text-[10px] font-bold text-gray-400">{filteredSets.length}</span>
                   </div>
                </div>
              </div>

              {filteredSets.length > 0 ? (
                <div className="space-y-2">
                  {filteredSets.map((set) => (
                    <button 
                      key={set.id} 
                      onClick={() => onSidebarTabChange?.(set.type)}
                      className="w-full flex items-center gap-4 p-4 rounded-[24px] bg-white border border-gray-100 hover:border-gray-200 transition-all group"
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm",
                        set.type === 'quiz' ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-500"
                      )}>
                        {set.type === 'quiz' ? <Brain className="h-5 w-5" /> : <StickyNote className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-bold text-gray-800">{set.name}</p>
                        <p className="text-[10px] font-medium text-gray-400 mt-0.5">{set.date}</p>
                      </div>
                      <MoreHorizontal className="h-4 w-4 text-gray-300" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center bg-gray-50/20 rounded-[32px] border border-dashed border-gray-100">
                   <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">Empty Library</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          renderActiveTool()
        )}
      </div>

      {/* Large Bottom Input Section */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white/95 to-transparent pt-10">
         <div className="relative group">
            <textarea 
               value={askInput}
               onChange={(e) => setAskInput(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAsk())}
               placeholder="Ask anything"
               className="w-full h-16 bg-gray-50/50 border border-gray-100 rounded-[2rem] pl-6 pr-24 py-5 text-sm font-medium focus:outline-none focus:bg-white focus:border-gray-200 focus:ring-4 focus:ring-black/5 transition-all scrollbar-none resize-none"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
               <button 
                  onClick={handleAsk}
                  className="bg-black text-white p-2.5 rounded-2xl shadow-xl shadow-black/10 hover:scale-105 transition-all"
               >
                  <Mic className="h-4 w-4" />
                  <span className="sr-only">Voice</span>
               </button>
               <div className="bg-black text-[10px] font-bold text-white px-3 py-2 rounded-2xl">Voice</div>
            </div>
         </div>
      </div>
    </aside>
  );
};

export default LearnTools;
