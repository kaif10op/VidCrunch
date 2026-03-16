import { useState } from "react";
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Save, 
  Trash2, 
  FileText,
  Type,
  Maximize2,
  Check,
  X
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

const NotesTool = () => {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("Study Session Notes");
  const [isSaved, setIsSaved] = useState(true);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setIsSaved(false);
    // Simulate auto-save
    setTimeout(() => setIsSaved(true), 1500);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-250px)] bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-3 border-b border-gray-50 bg-gray-50/50 sticky top-0 z-10">
        <div className="flex bg-white rounded-xl border border-gray-100 p-0.5">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg hover:bg-gray-50"><Bold className="h-3 w-3" /></Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg hover:bg-gray-50"><Italic className="h-3 w-3" /></Button>
        </div>
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <div className="flex bg-white rounded-xl border border-gray-100 p-0.5">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg hover:bg-gray-50"><List className="h-3 w-3" /></Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg hover:bg-gray-50"><ListOrdered className="h-3 w-3" /></Button>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors">
            {isSaved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none">
        {/* Title Input */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-black uppercase tracking-tighter text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-lg">Draft</span>
          </div>
          <input 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-black w-full bg-transparent focus:outline-none placeholder:text-gray-200 tracking-tight"
            placeholder="Note Title"
          />
        </div>

        {/* Editor Area */}
        <div className="px-8 pb-8">
          <textarea 
            value={content}
            onChange={handleContentChange}
            className="w-full min-h-[400px] text-sm leading-relaxed text-gray-600 bg-transparent focus:outline-none resize-none scrollbar-none font-medium placeholder:text-gray-200"
            placeholder="Start drafting your insights here... Click the AI chat below to help summarize or expand your thoughts."
          />
        </div>
      </div>

      {/* Footer Stats */}
      <div className="p-4 bg-gray-900 border-t border-gray-800 flex items-center justify-between text-[10px] font-black text-gray-400 px-8 uppercase tracking-widest">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1.5"><Type className="h-3 w-3" /> {content.split(/\s+/).filter(Boolean).length} Words</span>
          <span className="flex items-center gap-1.5"><FileText className="h-3 w-3" /> {content.length} Chars</span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-500">
          <div className={cn("w-1.5 h-1.5 rounded-full bg-emerald-500", !isSaved && "animate-pulse")} />
          <span>{isSaved ? "Saved" : "Saving"}</span>
        </div>
      </div>
    </div>
  );
};

export default NotesTool;
