import { motion } from "framer-motion";
import { FolderOpen, Trash2, ChevronRight } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useSpacesContext } from "@/contexts/SpacesContext";
import { useAnalysisContext } from "@/contexts/AnalysisContext";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { getRelativeDate } from "@/lib/utils";

export default function SpacePage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const { historyItems, spaces, handleDeleteHistoryItem } = useSpacesContext();
  const { handleLoadHistoryItem } = useAnalysisContext();
  const { user } = useAuthContext();

  const selectedSpace = spaces.find(s => s.id === spaceId);
  const spaceItems = historyItems.filter(h => 
    selectedSpace?.videoIds.includes(h.videoIds[0])
  );

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-6 text-center">
        <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-gray-100">
          <FolderOpen className="h-7 w-7 text-gray-200" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-1">Sign in to see your space</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
          Log in to access your learning spaces.
        </p>
        <Link to="/">
          <Button className="rounded-xl font-semibold text-sm h-10 px-6 bg-black text-white hover:bg-gray-900">Back Home</Button>
        </Link>
      </div>
    );
  }

  if (!selectedSpace) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-6 text-center">
        <h3 className="text-lg font-bold text-foreground mb-1">Space not found</h3>
        <Link to="/dashboard">
          <Button variant="outline" className="mt-4">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-5xl mx-auto py-16 px-6 overflow-y-auto w-full"
    >
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground">{selectedSpace.name}</h2>
        <p className="text-sm text-muted-foreground mt-1">{selectedSpace.videoIds.length} videos in this space</p>
      </div>

      {spaceItems.length > 0 ? (
        <div className="grid gap-3">
          {spaceItems.map((item) => (
            <motion.button 
              key={item.id} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => handleLoadHistoryItem(item)}
              className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-gray-200 hover:shadow-md transition-all text-left group w-full"
            >
              <div className="flex items-center gap-4 min-w-0">
                 <div className="w-24 h-16 bg-gray-100 rounded-xl overflow-hidden shrink-0 border border-gray-50 relative">
                    <img src={`https://img.youtube.com/vi/${item.videoIds[0]}/mqdefault.jpg`} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                 </div>
                 <div className="min-w-0">
                   <h3 className="text-sm font-semibold group-hover:text-black transition-colors line-clamp-1">{item.title}</h3>
                   <div className="flex items-center gap-2 mt-1.5">
                     <span className="text-xs text-muted-foreground">
                       {getRelativeDate(item.date)}
                     </span>
                   </div>
                 </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteHistoryItem(item.id); }}
                  className="p-2 hover:bg-red-50 text-gray-200 hover:text-red-500 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                  aria-label="Delete item"
                >
                   <Trash2 className="h-3.5 w-3.5" />
                </button>
                <ChevronRight className="h-4 w-4 text-gray-200 group-hover:text-gray-400 transition-all" />
              </div>
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="text-center py-24">
          <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-gray-100">
            <FolderOpen className="h-7 w-7 text-gray-200" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">This space is empty</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">Add videos to this space to get started.</p>
          <Link to="/dashboard">
            <Button className="rounded-xl font-semibold text-sm h-10 px-6 bg-black text-white hover:bg-gray-900">Start Learning</Button>
          </Link>
        </div>
      )}
    </motion.div>
  );
}
