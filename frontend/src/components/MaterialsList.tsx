import { motion } from "framer-motion";
import { 
  FileText, 
  Video as VideoIcon, 
  StickyNote, 
  Trash2, 
  Plus, 
  Upload, 
  ExternalLink,
  Loader2
} from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { cn, getRelativeDate } from "@/lib/utils";
import type { HistoryItem, DocumentData, NoteData } from "@/types";

interface MaterialsListProps {
  videos: HistoryItem[];
  documents: DocumentData[];
  notes: NoteData[];
  onAddVideo: () => void;
  onUploadDoc: (file: File) => void;
  onCreateNote: () => void;
  onDeleteVideo: (id: string) => void;
  onDeleteDoc: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onViewVideo: (item: HistoryItem) => void;
  onViewDoc: (id: string) => void;
  onViewNote: (note: NoteData) => void;
}

export default function MaterialsList({
  videos,
  documents,
  notes,
  onAddVideo,
  onUploadDoc,
  onCreateNote,
  onDeleteVideo,
  onDeleteDoc,
  onDeleteNote,
  onViewVideo,
  onViewDoc,
  onViewNote,
}: MaterialsListProps) {
  const [activeTab, setActiveTab] = useState<"all" | "videos" | "documents" | "notes">("all");

  const filterMaterials = () => {
    const v = videos.map(item => ({ ...item, type: "video" as const }));
    const d = documents.map(item => ({ ...item, type: "document" as const }));
    const n = notes.map(item => ({ ...item, type: "note" as const }));
    
    let combined = [...v, ...d, ...n];
    
    if (activeTab === "videos") return v;
    if (activeTab === "documents") return d;
    if (activeTab === "notes") return n;
    
    return combined.sort((a, b) => {
      const dateA = new Date((a as any).createdAt || (a as any).date).getTime();
      const dateB = new Date((b as any).createdAt || (b as any).date).getTime();
      return dateB - dateA;
    });
  };

  const filtered = filterMaterials();

  return (
    <div className="space-y-6">
      {/* Tabs & Actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex bg-gray-50/50 p-1 rounded-2xl border border-gray-100/50">
          {(["all", "videos", "documents", "notes"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-xl transition-all capitalize",
                activeTab === tab 
                  ? "bg-white text-black shadow-sm ring-1 ring-black/5" 
                  : "text-muted-foreground hover:text-black"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
           <label className="cursor-pointer">
             <input 
               type="file" 
               className="hidden" 
               accept=".pdf,.docx,.txt"
               onChange={(e) => e.target.files?.[0] && onUploadDoc(e.target.files[0])} 
             />
             <Button variant="outline" size="sm" className="rounded-xl gap-2 border-gray-100 hover:bg-gray-50 text-xs font-bold h-9 bg-white shadow-sm">
               <Upload className="h-3.5 w-3.5" />
               Upload Doc
             </Button>
           </label>
           <Button onClick={onCreateNote} variant="outline" size="sm" className="rounded-xl gap-2 border-gray-100 hover:bg-gray-50 text-xs font-bold h-9 bg-white shadow-sm">
             <Plus className="h-3.5 w-3.5" />
             New Note
           </Button>
           <Button onClick={onAddVideo} className="rounded-xl gap-2 text-xs font-bold h-9 shadow-lg shadow-black/10">
             <VideoIcon className="h-3.5 w-3.5" />
             Add Video
           </Button>
        </div>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item: any) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={item.id}
              className="group bg-white border border-gray-100 rounded-3xl p-4 hover:border-black/10 hover:shadow-xl hover:shadow-black/[0.02] transition-all relative flex flex-col h-full"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center border",
                  item.type === "video" ? "bg-red-50 border-red-100 text-red-500" :
                  item.type === "document" ? "bg-blue-50 border-blue-100 text-blue-500" :
                  "bg-orange-50 border-orange-100 text-orange-500"
                )}>
                  {item.type === "video" ? <VideoIcon className="h-5 w-5" /> :
                   item.type === "document" ? <FileText className="h-5 w-5" /> :
                   <StickyNote className="h-5 w-5" />}
                </div>
                <button 
                  onClick={() => item.type === "video" ? onDeleteVideo(item.id) : item.type === "document" ? onDeleteDoc(item.id) : onDeleteNote(item.id)}
                  className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-xl transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1">
                <h3 className="text-[13px] font-bold text-black line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                  {item.title || (item as any).videoData?.title}
                </h3>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
                  {item.type} • {getRelativeDate(item.createdAt || item.date)}
                </p>
                {item.type === "document" && item.status === "processing" && (
                   <div className="mt-2 flex items-center gap-2 text-[10px] text-blue-500 font-bold bg-blue-50 px-2.5 py-1 rounded-lg w-fit">
                     <Loader2 className="h-3 w-3 animate-spin" />
                     Extracting Knowledge...
                   </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                <button 
                  onClick={() => item.type === "video" ? onViewVideo(item) : item.type === "document" ? onViewDoc(item.id) : onViewNote(item)}
                  className="text-[11px] font-bold text-black flex items-center gap-1.5 hover:gap-2 transition-all p-1"
                >
                  {item.type === "video" ? "Watch & Study" : item.type === "document" ? "Read Content" : "Edit Note"}
                  <ExternalLink className="h-3 w-3 opacity-30" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="py-32 text-center bg-gray-50/30 rounded-[3rem] border border-dashed border-gray-200">
           <div className="w-16 h-16 bg-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-sm">
              <FileText className="h-7 w-7 text-gray-200" />
           </div>
           <h3 className="text-lg font-bold text-black font-display">No materials here yet</h3>
           <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto font-medium">
             Start filling your space by adding videos, uploading documents, or taking notes.
           </p>
        </div>
      )}
    </div>
  );
}
