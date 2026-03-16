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
      <DialogContent className="rounded-[32px] max-w-2xl p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-white">
          <div className="flex items-center px-6 h-20 border-b border-gray-50 gap-4">
            <Search className="h-6 w-6 text-gray-400" />
            <input 
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in Library"
              className="flex-1 bg-transparent text-xl focus:outline-none placeholder:text-gray-300 font-medium"
            />
            <div className="px-2 py-1 bg-gray-50 rounded-lg border border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">ESC</div>
          </div>
          
          <div className="max-h-[60vh] overflow-y-auto p-4 scrollbar-thin">
            {searchQuery.trim() === "" ? (
              <div className="py-12 text-center">
                <p className="text-sm font-bold text-gray-400">Search for videos, spaces or topics</p>
                <div className="flex items-center justify-center gap-6 mt-6">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                     <div className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                     Videos
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                     <div className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                     Spaces
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {isSearchLoading ? (
                  <div className="py-12 text-center">
                     <p className="text-sm font-bold text-gray-400">Searching...</p>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div>
                     <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] px-3 mb-3">Found in Library</h4>
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
                           className="w-full flex items-center gap-4 p-3 hover:bg-gray-50 rounded-[20px] transition-all group text-left"
                         >
                           <div className="w-16 h-10 bg-gray-100 rounded-xl overflow-hidden shrink-0 border border-gray-50">
                             {result.thumbnail ? (
                               <img src={result.thumbnail} alt="" className="w-full h-full object-cover" />
                             ) : (
                               <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                 <Search className="h-4 w-4 text-gray-200" />
                               </div>
                             )}
                           </div>
                           <div className="min-w-0 flex-1">
                             <p className="text-sm font-bold truncate group-hover:text-black transition-colors">{result.title}</p>
                             <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold truncate block">{result.subtitle}</span>
                           </div>
                           <ArrowRight className="h-4 w-4 text-gray-200 group-hover:text-black transition-all" />
                         </button>
                       ))}
                     </div>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                     <p className="text-sm font-bold text-gray-400">No results found for "{searchQuery}"</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-4 bg-gray-50/50 border-t border-gray-50 flex items-center justify-between">
             <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                   <div className="px-1.5 py-0.5 bg-white rounded border border-gray-200 text-[9px] font-bold text-gray-400">↑↓</div>
                   <span className="text-[9px] font-bold text-gray-400 uppercase">Navigate</span>
                </div>
                <div className="flex items-center gap-1.5">
                   <div className="px-1.5 py-0.5 bg-white rounded border border-gray-200 text-[9px] font-bold text-gray-400">ENTER</div>
                   <span className="text-[9px] font-bold text-gray-400 uppercase">Open</span>
                </div>
             </div>
             <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">TubeBrain Search</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
