import { motion } from "framer-motion";
import { History as HistoryIcon, Trash2, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useSpacesContext } from "@/contexts/SpacesContext";
import { useAnalysisContext } from "@/contexts/AnalysisContext";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { getRelativeDate } from "@/lib/utils";

export default function HistoryPage() {
  const { historyItems, handleDeleteHistoryItem } = useSpacesContext();
  const { handleLoadHistoryItem } = useAnalysisContext();
  const { user } = useAuthContext();

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-6 text-center">
        <div className="w-16 h-16 bg-secondary rounded-3xl flex items-center justify-center mx-auto mb-6 border border-border">
          <HistoryIcon className="h-7 w-7 text-muted-foreground/30" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-1">Sign in to see your history</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
          Log in to access your previously analyzed videos.
        </p>
        <Link to="/">
          <Button className="rounded-xl font-semibold text-sm h-10 px-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/10">Back Home</Button>
        </Link>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="max-w-6xl mx-auto py-12 px-8 overflow-y-auto w-full h-full scrollbar-thin"
    >
      <div className="mb-12 space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 border border-border">
          <HistoryIcon className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Session History</span>
        </div>
        <h2 className="text-4xl font-black text-foreground tracking-tight">Recent <span className="text-muted-foreground/40">Knowledge.</span></h2>
        <p className="text-sm font-medium text-muted-foreground/60 max-w-lg leading-relaxed">
          Revisit your previously analyzed videos and continue your learning journey right where you left off.
        </p>
      </div>

      {historyItems.length > 0 ? (
        <div className="grid gap-4">
          {historyItems.map((item) => (
            <motion.div 
              key={item.id} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => handleLoadHistoryItem(item)}
              className="flex items-center justify-between p-4 bg-card border border-border rounded-2xl hover:border-primary/20 hover:shadow-md transition-all text-left group w-full cursor-pointer"
            >
              <div className="flex items-center gap-4 min-w-0">
                 <div className="w-24 h-16 bg-secondary rounded-xl overflow-hidden shrink-0 border border-border relative">
                    <img src={`https://img.youtube.com/vi/${item.videoIds[0]}/mqdefault.jpg`} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    {item.status && item.status !== "completed" && (
                      <div className="absolute inset-0 bg-background/40 flex items-center justify-center">
                        <span className="text-[9px] font-semibold uppercase text-white bg-amber-500 px-1.5 py-0.5 rounded">
                          {item.status === "failed" ? "Failed" : "Processing"}
                        </span>
                      </div>
                    )}
                 </div>
                 <div className="min-w-0">
                   <h3 className="text-sm font-semibold group-hover:text-primary transition-colors line-clamp-1">{item.title}</h3>
                   <div className="flex items-center gap-2 mt-1.5">
                     <span className="text-xs text-muted-foreground">
                       {getRelativeDate(item.date)}
                     </span>
                     {item.videoIds.length > 1 && (
                       <span className="text-[9px] font-bold bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded-full">
                         {item.videoIds.length} videos
                       </span>
                     )}
                   </div>
                 </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteHistoryItem(item.id); }}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground/30 hover:text-red-500 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                  aria-label="Delete item"
                >
                   <Trash2 className="h-3.5 w-3.5" />
                </button>
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-all" />
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-24">
          <div className="w-16 h-16 bg-secondary rounded-3xl flex items-center justify-center mx-auto mb-6 border border-border">
            <HistoryIcon className="h-7 w-7 text-muted-foreground/30" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">No history yet</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">Start analyzing a video and it will appear here.</p>
          <Link to="/dashboard">
            <Button className="rounded-xl font-semibold text-sm h-10 px-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/10">Start Learning</Button>
          </Link>
        </div>
      )}
    </motion.div>
  );
}
