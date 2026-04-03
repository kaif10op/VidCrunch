import { Search, ArrowRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useUIContext } from "@/contexts/UIContext";
import { useAnalysisContext } from "@/contexts/AnalysisContext";
import { useEffect } from "react";

export default function SearchModal() {
  const {
    isSearchModalOpen,
    setIsSearchModalOpen,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearchLoading,
    handleSearch
  } = useUIContext();

  const { handleLoadHistoryItem } = useAnalysisContext();

  useEffect(() => {
    if (isSearchModalOpen) {
      handleSearch(searchQuery);
    }
  }, [searchQuery, isSearchModalOpen, handleSearch]);

  return (
    <Dialog open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen}>
      <DialogContent className="rounded-[32px] max-w-2xl p-0 overflow-hidden border border-border shadow-2xl bg-card">
        <div>
          <div className="flex items-center px-6 h-20 border-b border-border gap-4">
            <Search className="h-6 w-6 text-muted-foreground" />
            <input 
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in Library"
              className="flex-1 bg-transparent text-xl focus:outline-none placeholder:text-muted-foreground/30 font-medium text-foreground"
            />
            <div className="px-2 py-1 bg-secondary rounded-lg border border-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider">ESC</div>
          </div>
          
          <div className="max-h-[60vh] overflow-y-auto p-4 scrollbar-thin">
            {searchQuery.trim() === "" ? (
              <div className="py-12 text-center">
                <p className="text-sm font-bold text-muted-foreground">Search for videos, spaces or topics</p>
                <div className="flex items-center justify-center gap-6 mt-6">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest">
                     <div className="w-1.5 h-1.5 rounded-full bg-muted" />
                     Videos
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest">
                     <div className="w-1.5 h-1.5 rounded-full bg-muted" />
                     Spaces
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {isSearchLoading ? (
                  <div className="py-12 text-center">
                     <p className="text-sm font-bold text-muted-foreground">Searching...</p>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div>
                     <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-3 mb-3">Found in Library</h4>
                     <div className="space-y-1">
                       {searchResults.map(result => (
                         <button 
                           key={result.id}
                           onClick={() => {
                             if (result.type === "video" || result.type === "analysis" || result.type === "transcript") {
                               handleLoadHistoryItem({
                                 id: result.video_id || result.id,
                                 title: result.title,
                                 videoIds: [result.platform_id || result.video_id || result.id],
                                 date: new Date().toISOString(),
                                 status: "completed",
                                 videoData: {
                                    title: result.title,
                                    channel: "",
                                    duration: "",
                                    views: "",
                                    likes: "",
                                    published: ""
                                 },
                                 summaryData: {} as any,
                                 transcript: "",
                                 metadata: {
                                    title: result.title,
                                    channel: "",
                                    duration: "",
                                    thumbnails: [{ url: result.thumbnail || "", width: 120, height: 90 }]
                                 }
                               });
                             }
                             setIsSearchModalOpen(false);
                             setSearchQuery("");
                           }}
                           className="w-full flex items-center gap-4 p-3 hover:bg-secondary rounded-[20px] transition-all group text-left"
                         >
                           <div className="w-16 h-10 bg-muted rounded-xl overflow-hidden shrink-0 border border-border">
                             {result.thumbnail ? (
                               <img src={result.thumbnail} alt="" className="w-full h-full object-cover" />
                             ) : (
                               <div className="w-full h-full flex items-center justify-center bg-secondary">
                                 <Search className="h-4 w-4 text-muted-foreground/30" />
                               </div>
                             )}
                           </div>
                           <div className="min-w-0 flex-1">
                             <p className="text-sm font-bold truncate group-hover:text-foreground transition-colors">{result.title}</p>
                             <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold truncate block">{result.subtitle}</span>
                           </div>
                           <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground transition-all" />
                         </button>
                       ))}
                     </div>
                  </div>
                ) : (
                   <div className="py-12 text-center">
                     <p className="text-sm font-bold text-muted-foreground">No results found for "{searchQuery}"</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-4 bg-secondary/50 border-t border-border flex items-center justify-between">
             <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                   <div className="px-1.5 py-0.5 bg-card rounded border border-border text-[9px] font-bold text-muted-foreground">↑↓</div>
                   <span className="text-[9px] font-bold text-muted-foreground uppercase">Navigate</span>
                </div>
                <div className="flex items-center gap-1.5">
                   <div className="px-1.5 py-0.5 bg-card rounded border border-border text-[9px] font-bold text-muted-foreground">ENTER</div>
                   <span className="text-[9px] font-bold text-muted-foreground uppercase">Open</span>
                </div>
             </div>
             <p className="text-[9px] font-bold text-muted-foreground/30 uppercase tracking-widest">TubeBrain Search</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
