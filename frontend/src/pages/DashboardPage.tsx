import { motion } from "framer-motion";
import { FolderOpen, PlusCircle, History as HistoryIcon } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import UrlInput from "@/components/UrlInput";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/contexts/AuthContext";
import { useAnalysisContext } from "@/contexts/AnalysisContext";
import { useSpacesContext } from "@/contexts/SpacesContext";
import { getRelativeDate } from "@/lib/utils";

export default function DashboardPage() {
  const { user } = useAuthContext();
  const { 
    handleSubmit, 
    isLoading, 
    analysisStyle, 
    setAnalysisStyle,
    handleLoadHistoryItem
  } = useAnalysisContext();
  const { spaces, historyItems } = useSpacesContext();

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pb-20"
    >
      {/* Hero Section */}
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-8">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground">
          Ready to learn, {user?.name?.split(' ')[0] || 'stranger'}?
        </h1>
      </div>

      <UrlInput 
        onSubmit={handleSubmit} 
        isLoading={isLoading} 
        onUploadComplete={(id) => toast.success(`Video uploaded (ID: ${id}). Analysis will begin shortly.`)} 
        analysisStyle={analysisStyle}
        onStyleChange={setAnalysisStyle}
      />
      
      <div className="max-w-5xl mx-auto px-6 mt-12 space-y-12">
         {/* Spaces Grid */}
         <section>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-foreground">Spaces</h3>
              <Link to="/library" className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">View all</Link>
            </div>
            {spaces.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {spaces.slice(0, 6).map(space => (
                  <Link 
                    key={space.id} 
                    to={`/space/${space.id}`}
                    className="flex flex-col p-5 bg-white dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-[32px] hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-md transition-all text-left shadow-sm group aspect-square justify-between"
                  >
                    <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center group-hover:bg-black dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-black transition-colors">
                       <FolderOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-base font-bold block truncate text-foreground">{space.name}</span>
                      <span className="text-xs text-muted-foreground font-medium">{space.videoIds.length} items</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50/50 dark:bg-gray-900/50 rounded-[40px] p-12 border border-dashed border-gray-200 dark:border-gray-800 text-center">
                 <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <PlusCircle className="h-8 w-8 text-gray-200 dark:text-gray-600" />
                 </div>
                 <p className="text-base font-bold text-gray-600 dark:text-gray-400">Create your first space</p>
                 <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Organize your learning by topics</p>
                 <Button onClick={() => toast.info("Use the sidebar to create new spaces!")} variant="outline" className="mt-6 rounded-2xl font-bold text-sm h-10 px-6 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800">Add Space</Button>
              </div>
            )}
         </section>

         {/* Recent Videos Row */}
         <section>
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-lg font-bold text-foreground">Recents</h3>
               <Link to="/history" className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">View history</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
               {historyItems.slice(0, 3).map((item) => (
                 <button 
                   key={item.id} 
                   onClick={() => handleLoadHistoryItem(item)}
                   className="flex flex-col bg-white dark:bg-gray-900/50 rounded-[32px] overflow-hidden hover:shadow-lg transition-all text-left group border border-gray-50 dark:border-gray-800 shadow-sm"
                 >
                    <div className="aspect-video w-full bg-gray-100 dark:bg-gray-800 overflow-hidden relative">
                       <img 
                         src={`https://img.youtube.com/vi/${item.videoIds[0]}/maxresdefault.jpg`} 
                         alt="" 
                         className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                       />
                       <div className="absolute inset-0 bg-black/5 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="p-5">
                       <p className="text-sm font-bold truncate group-hover:text-black dark:group-hover:text-white transition-colors text-foreground">{item.title}</p>
                       <div className="flex items-center gap-2 mt-2">
                         <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{getRelativeDate(item.date)}</span>
                         <span className="w-1 h-1 rounded-full bg-gray-200 dark:bg-gray-800" />
                         <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold truncate max-w-[100px]">{item.videoData?.channel}</span>
                       </div>
                    </div>
                 </button>
               ))}
               {historyItems.length === 0 && (
                 <div className="col-span-full py-12 text-center bg-gray-50/50 dark:bg-gray-900/50 rounded-[40px] border border-dashed border-gray-200 dark:border-gray-800 text-center">
                    <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100 dark:border-gray-700">
                       <HistoryIcon className="h-8 w-8 text-gray-200 dark:text-gray-600" />
                    </div>
                    <p className="text-base font-bold text-gray-400 dark:text-gray-500">No recent activity</p>
                    <Link to="/dashboard" className="mt-2 text-xs font-semibold text-gray-300 dark:text-gray-600 hover:text-foreground transition-colors">Start learning something new</Link>
                 </div>
               )}
            </div>
         </section>
      </div>
    </motion.div>
  );
}
