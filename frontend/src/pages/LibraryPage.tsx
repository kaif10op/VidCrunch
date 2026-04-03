import { motion } from "framer-motion";
import { Library as LibraryIcon, Trash2, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useSpacesContext } from "@/contexts/SpacesContext";
import { useAnalysisContext } from "@/contexts/AnalysisContext";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { getRelativeDate } from "@/lib/utils";

export default function LibraryPage() {
  const { historyItems, spaces, handleDeleteHistoryItem } = useSpacesContext();
  const { handleLoadHistoryItem } = useAnalysisContext();
  const { user } = useAuthContext();

  const libraryItems = historyItems.filter(h => 
    spaces.some(s => s.videoIds.includes(h.videoIds[0]))
  );

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-6 text-center">
        <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-5 border border-primary/10">
          <LibraryIcon className="h-6 w-6 text-primary/50" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-1">Sign in to see your library</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
          Log in to access your videos saved to spaces.
        </p>
        <Link to="/">
          <Button className="rounded-full font-semibold text-sm h-10 px-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20">Back Home</Button>
        </Link>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-5xl mx-auto py-10 px-6 w-full"
    >
      <div className="mb-10 space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary/[0.08] border border-primary/20">
          <LibraryIcon className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">Library</span>
        </div>
        <h2 className="text-3xl font-extrabold text-foreground tracking-tight">
          Saved <span className="text-gradient">spaces</span>
        </h2>
        <p className="text-sm text-muted-foreground max-w-lg">
          Your curated collection of videos and learning tools organized by topic.
        </p>
      </div>

      {libraryItems.length > 0 ? (
        <div className="grid gap-3">
          {libraryItems.map((item, i) => (
            <motion.button 
              key={item.id} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => handleLoadHistoryItem(item)}
              className="flex items-center justify-between p-3.5 rounded-xl border border-white/[0.06] bg-card/40 backdrop-blur-sm hover:border-primary/20 hover:bg-card/60 transition-all text-left group w-full"
            >
              <div className="flex items-center gap-4 min-w-0">
                 <div className="w-24 h-16 rounded-lg overflow-hidden shrink-0 border border-white/[0.06] relative bg-secondary/20">
                    <img src={`https://img.youtube.com/vi/${item.videoIds[0]}/mqdefault.jpg`} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
                 </div>
                 <div className="min-w-0">
                   <h3 className="text-sm font-bold group-hover:text-primary transition-colors line-clamp-1">{item.title}</h3>
                   <div className="flex items-center gap-2 mt-1">
                     <span className="text-xs text-muted-foreground">{getRelativeDate(item.date)}</span>
                   </div>
                 </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteHistoryItem(item.id); }}
                  className="p-2 hover:bg-destructive/10 text-muted-foreground/20 hover:text-destructive rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  aria-label="Delete item"
                >
                   <Trash2 className="h-3.5 w-3.5" />
                </button>
                <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary transition-all" />
              </div>
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-5 border border-primary/10">
            <LibraryIcon className="h-6 w-6 text-primary/50" />
          </div>
          <h3 className="text-base font-bold text-foreground mb-1">Your library is empty</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">Add videos to spaces to build your library.</p>
          <Link to="/dashboard">
            <Button className="rounded-full font-semibold text-sm h-10 px-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20">Start Learning</Button>
          </Link>
        </div>
      )}
    </motion.div>
  );
}
