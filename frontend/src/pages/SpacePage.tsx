import { motion, AnimatePresence } from "framer-motion";
import { 
  FolderOpen, 
  Trash2, 
  ChevronRight, 
  LayoutGrid, 
  MessageSquare, 
  MoreVertical,
  Settings,
  Plus,
  Check,
  Search
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useSpacesContext } from "@/contexts/SpacesContext";
import { useAnalysisContext } from "@/contexts/AnalysisContext";
import { useAuthContext } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import MaterialsList from "@/components/MaterialsList";
import SpaceChat from "@/components/SpaceChat";
import { fetchSpaceDocuments, fetchSpaceNotes, getDocumentUrl } from "@/lib/storage";
import type { DocumentData, NoteData } from "@/types";

export default function SpacePage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const { 
    historyItems, 
    spaces, 
    handleDeleteHistoryItem, 
    handleRemoveVideoFromSpace,
    handleAddToSpace,
    handleUploadDocument,
    handleRemoveDocument,
    handleCreateNote,
    handleDeleteNote,
    handleUpdateNote,
    handleSendChat
  } = useSpacesContext();
  const { handleLoadHistoryItem } = useAnalysisContext();
  const { user } = useAuthContext();

  const [activeTab, setActiveTab] = useState<"materials" | "chat">("materials");
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteData | null>(null);
  const [newNote, setNewNote] = useState({ title: "", content: "" });
  const [isAddVideoModalOpen, setIsAddVideoModalOpen] = useState(false);
  const [videoSearchQuery, setVideoSearchQuery] = useState("");

  const selectedSpace = spaces.find(s => s.id === spaceId);
  const spaceVideos = historyItems.filter(h => 
    selectedSpace?.videoIds.includes(h.videoIds?.[0])
  );

  useEffect(() => {
    if (spaceId) {
      loadMaterials();
    }
  }, [spaceId, spaces]);

  const loadMaterials = async () => {
    setIsLoading(true);
    try {
      if (spaceId) {
        const [docs, nts] = await Promise.all([
          fetchSpaceDocuments(spaceId),
          fetchSpaceNotes(spaceId)
        ]);
        setDocuments(docs);
        setNotes(nts);
      }
    } catch (err) {
      console.error("Failed to load space materials", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNoteSubmit = async () => {
    if (spaceId && newNote.title && newNote.content) {
      await handleCreateNote(spaceId, newNote.title, newNote.content);
      setIsNoteModalOpen(false);
      setNewNote({ title: "", content: "" });
      loadMaterials();
    }
  };

  const handleUpdateNoteSubmit = async () => {
    if (spaceId && editingNote) {
      await handleUpdateNote(spaceId, editingNote.id, editingNote.title, editingNote.content);
      setEditingNote(null);
      loadMaterials();
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto py-32 px-6 text-center">
        <div className="w-20 h-20 bg-gray-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 border border-gray-100">
          <FolderOpen className="h-10 w-10 text-gray-200" />
        </div>
        <h3 className="text-xl font-bold text-foreground font-display mb-2">Sign in to see your space</h3>
        <p className="text-sm text-muted-foreground mb-8 max-w-xs mx-auto font-medium">
          Access your personal learning repository from anywhere.
        </p>
        <Link to="/">
          <Button className="rounded-2xl font-bold text-sm h-12 px-8 shadow-lg shadow-black/10">Back Home</Button>
        </Link>
      </div>
    );
  }

  if (!selectedSpace) {
    return (
      <div className="max-w-4xl mx-auto py-32 px-6 text-center">
        <h3 className="text-xl font-bold text-foreground font-display mb-2">Space not found</h3>
        <Link to="/dashboard">
          <Button variant="outline" className="mt-4 rounded-2xl">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-screen w-full overflow-hidden bg-white">
      {/* Space Header */}
      <div className="px-6 py-6 border-b border-gray-50 flex items-center justify-between sticky top-0 bg-white z-10">
        <div>
          <h2 className="text-2xl font-bold text-black font-display tracking-tight leading-none">{selectedSpace.name}</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-gray-50 px-2 py-0.5 rounded-md">
                {spaceVideos.length} Videos
            </span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-gray-50 px-2 py-0.5 rounded-md">
                {documents.length} Docs
            </span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-gray-50 px-2 py-0.5 rounded-md">
                {notes.length} Notes
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100/50 p-1.5 rounded-2xl border border-gray-200/50">
            <button
               onClick={() => setActiveTab("materials")}
               className={cn(
                 "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                 activeTab === "materials" ? "bg-white text-black shadow-lg shadow-black/5" : "text-muted-foreground hover:text-black"
               )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Materials
            </button>
            <button
               onClick={() => setActiveTab("chat")}
               className={cn(
                 "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                 activeTab === "chat" ? "bg-white text-black shadow-lg shadow-black/5" : "text-muted-foreground hover:text-black"
               )}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Space Chat
            </button>
          </div>
          <Button variant="ghost" size="icon" className="rounded-2xl hover:bg-gray-50">
            <Settings className="h-5 w-5 text-gray-400" />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 relative">
        <AnimatePresence mode="wait">
          {activeTab === "materials" ? (
            <motion.div
              key="materials"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="h-full overflow-y-auto w-full px-6 py-8"
            >
              <MaterialsList 
                videos={spaceVideos}
                documents={documents}
                notes={notes}
                onAddVideo={() => setIsAddVideoModalOpen(true)}
                onUploadDoc={(file) => handleUploadDocument(spaceId!, file).then(loadMaterials)}
                onCreateNote={() => setIsNoteModalOpen(true)}
                onDeleteVideo={(vidId) => handleRemoveVideoFromSpace(spaceId!, vidId).then(loadMaterials)}
                onDeleteDoc={(docId) => handleRemoveDocument(spaceId!, docId).then(loadMaterials)}
                onDeleteNote={(noteId) => handleDeleteNote(spaceId!, noteId).then(loadMaterials)}
                onViewVideo={handleLoadHistoryItem}
                onViewDoc={(id) => window.open(getDocumentUrl(id), "_blank")}
                onViewNote={(note) => setEditingNote(note)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="h-full w-full p-6 lg:p-8"
            >
              <SpaceChat 
                spaceId={spaceId!}
                onSendChat={handleSendChat}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* New Note Modal */}
      <Dialog open={isNoteModalOpen} onOpenChange={setIsNoteModalOpen}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-display">New Space Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Title</label>
              <Input 
                placeholder="What's this note about?" 
                value={newNote.title}
                onChange={(e) => setNewNote(prev => ({ ...prev, title: e.target.value }))}
                className="rounded-2xl border-gray-100 bg-gray-50/50 focus:bg-white transition-all h-12"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Content</label>
              <Textarea 
                placeholder="Write your thoughts here..." 
                value={newNote.content}
                onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
                className="rounded-3xl border-gray-100 bg-gray-50/50 focus:bg-white transition-all min-h-[200px] resize-none"
              />
            </div>
            <Button onClick={handleCreateNoteSubmit} className="w-full h-12 rounded-2xl font-bold mt-4 shadow-lg shadow-black/10">
              Create Note
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Note Modal */}
      <Dialog open={!!editingNote} onOpenChange={(open) => !open && setEditingNote(null)}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-display">Edit Note</DialogTitle>
          </DialogHeader>
          {editingNote && (
            <div className="space-y-4 mt-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Title</label>
                <Input 
                  value={editingNote.title}
                  onChange={(e) => setEditingNote(prev => prev ? ({ ...prev, title: e.target.value }) : null)}
                  className="rounded-2xl border-gray-100 bg-gray-50/50 focus:bg-white transition-all h-12"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Content</label>
                <Textarea 
                  value={editingNote.content}
                  onChange={(e) => setEditingNote(prev => prev ? ({ ...prev, content: e.target.value }) : null)}
                  className="rounded-3xl border-gray-100 bg-gray-50/50 focus:bg-white transition-all min-h-[200px] resize-none"
                />
              </div>
              <Button onClick={handleUpdateNoteSubmit} className="w-full h-12 rounded-2xl font-bold mt-4 shadow-lg shadow-black/10">
                Update Note
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Video Modal */}
      <Dialog open={isAddVideoModalOpen} onOpenChange={setIsAddVideoModalOpen}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8 max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-display">Add Videos to Space</DialogTitle>
          </DialogHeader>
          
          <div className="relative mt-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search your history..." 
              value={videoSearchQuery}
              onChange={(e) => setVideoSearchQuery(e.target.value)}
              className="rounded-2xl border-gray-100 bg-gray-50/50 pl-11 h-12 focus:bg-white transition-all"
            />
          </div>

          <div className="flex-1 overflow-y-auto mt-6 space-y-2 pr-2 scrollbar-thin">
            {historyItems
              .filter(h => 
                selectedSpace && !selectedSpace.videoIds.includes(h.videoIds?.[0] || "") &&
                (h.title.toLowerCase().includes(videoSearchQuery.toLowerCase()) || 
                 h.videoData?.channel?.toLowerCase().includes(videoSearchQuery.toLowerCase()))
              )
              .map((item) => (
                <div 
                  key={item.id}
                  className="flex items-center justify-between p-4 rounded-2xl border border-gray-50 hover:border-black/5 hover:bg-gray-50/50 transition-all group"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {item.metadata?.thumbnails?.[0] && (
                        <img 
                        src={item.metadata.thumbnails[0].url} 
                        className="w-20 h-12 object-cover rounded-lg shadow-sm"
                        alt=""
                        />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-black truncate">{item.title}</p>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-tight">
                        {item.videoData?.channel} • {item.videoData?.duration}
                      </p>
                    </div>
                  </div>
                  <Button 
                    size="sm"
                    onClick={async () => {
                        if (item.videoIds?.[0]) {
                            await handleAddToSpace(spaceId!, item.videoIds[0]);
                            loadMaterials();
                        }
                    }}
                    className="rounded-xl font-bold text-[10px] h-8 px-4"
                  >
                    Add
                  </Button>
                </div>
              ))}
            
            {historyItems.filter(h => selectedSpace && !selectedSpace.videoIds.includes(h.videoIds?.[0] || "")).length === 0 && (
                <div className="text-center py-12">
                    <p className="text-sm text-muted-foreground font-medium">No more videos in history to add.</p>
                </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
