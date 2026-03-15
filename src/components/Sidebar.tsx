import { 
  Plus, 
  Search, 
  History, 
  LayoutGrid, 
  Library, 
  ChevronRight,
  ChevronDown,
  X,
  Zap,
  TrendingUp,
  Settings,
  LogOut,
  User as UserIcon,
  Coins,
  MoreHorizontal,
  Trash2,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Space } from "@/lib/storage";
import { useState, useEffect } from "react";
import { AuthDialog } from "./AuthDialog";
import { authApi, creditApi, removeAuthToken, getAuthToken } from "@/lib/api";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface SidebarProps {
  className?: string;
  onViewChange?: (view: string | { type: string; id: string; name: string }) => void;
  activeView?: string;
  recents?: string[];
  spaces?: Space[];
  onCreateSpace?: (name: string) => void;
  onRenameSpace?: (id: string, name: string) => void;
  onDeleteSpace?: (id: string) => void;
  user: any;
  credits: number | null;
  onLogout: () => void;
  onAuthSuccess: () => void;
  onTopUp?: () => void;
}

const Sidebar = ({ 
  className, 
  onViewChange, 
  activeView, 
  recents = [], 
  spaces = [],
  onCreateSpace,
  onRenameSpace,
  onDeleteSpace,
  user,
  credits,
  onLogout,
  onAuthSuccess,
  onTopUp
}: SidebarProps) => {
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const navItems = user 
    ? [
        { name: "Search", icon: Search },
        { name: "History", icon: History },
        { name: "My Library", icon: Library },
      ]
    : [
        { name: "Search", icon: Search },
      ];

  const handleCreateSpace = () => {
    if (newSpaceName.trim()) {
      onCreateSpace?.(newSpaceName.trim());
      setNewSpaceName("");
      setIsCreatingSpace(false);
    }
  };

  const handleStartRename = (e: React.MouseEvent, space: Space) => {
    e.stopPropagation();
    setEditingSpaceId(space.id);
    setEditingName(space.name);
  };

  const handleRename = () => {
    if (editingSpaceId && editingName.trim()) {
      onRenameSpace?.(editingSpaceId, editingName.trim());
      setEditingSpaceId(null);
    }
  };

  const handleDeleteSpace = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteSpace?.(id);
  };

  return (
    <aside className={cn("w-64 border-r bg-white h-screen flex flex-col p-4", className)}>
      <div className="flex items-center gap-2 mb-8 px-2">
        <div className="w-8 h-8 bg-black rounded-xl flex items-center justify-center">
          <span className="text-white font-black text-xl leading-none">y</span>
        </div>
        <span className="font-display font-bold text-xl tracking-tight">YouLearn</span>
      </div>

      <nav className="space-y-1 mb-8">
        {navItems.map((item) => (
          <button 
            key={item.name}
            onClick={() => onViewChange?.(item.name)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-all text-left",
              activeView === item.name 
                ? "bg-gray-100 text-black font-bold shadow-sm" 
                : "hover:bg-gray-50 text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto space-y-8 scrollbar-none pb-4">
        {user && (
          <div>
            <h3 className="px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Recents</h3>
            <div className="space-y-0.5">
              {recents.length > 0 ? (
                recents.map((item, i) => (
                  <button 
                    key={i} 
                    onClick={() => onViewChange?.("History")}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold rounded-xl hover:bg-gray-50 text-muted-foreground hover:text-foreground transition-all text-left"
                  >
                    <div className="w-1.5 h-1.5 bg-gray-200 rounded-full shrink-0" />
                    <span className="truncate">{item}</span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-[10px] text-muted-foreground font-bold uppercase tracking-wider opacity-50">Empty</p>
              )}
            </div>
          </div>
        )}

        {user && (
          <div>
             <div className="flex items-center justify-between px-3 mb-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Spaces</h3>
                <button 
                  onClick={() => setIsCreatingSpace(true)}
                  className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <Plus className="h-3 w-3" />
                </button>
             </div>
            
            <div className="space-y-0.5">
              {isCreatingSpace && (
                <div className="px-3 py-2 flex flex-col gap-2 bg-gray-50 rounded-2xl mb-2">
                  <input
                    autoFocus
                    value={newSpaceName}
                    onChange={(e) => setNewSpaceName(e.target.value)}
                    onKeyUp={(e) => e.key === "Enter" && handleCreateSpace()}
                    placeholder="Space name..."
                    className="bg-white border-none text-xs p-2.5 rounded-xl focus:ring-1 focus:ring-black shadow-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Button onClick={handleCreateSpace} size="sm" className="h-8 bg-black text-white rounded-xl text-[10px] font-black uppercase flex-1 shadow-sm">Add</Button>
                    <button onClick={() => setIsCreatingSpace(false)} className="p-1.5 hover:bg-white rounded-xl transition-all"><X className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
              
              {spaces.length > 0 ? (
                spaces.map((space) => (
                  <div key={space.id} className="group relative">
                    {editingSpaceId === space.id ? (
                      <div className="px-3 py-1.5 flex items-center gap-2">
                        <input
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyUp={(e) => e.key === "Enter" && handleRename()}
                          onBlur={handleRename}
                          className="bg-gray-50 border-none text-xs p-1.5 rounded-lg focus:ring-1 focus:ring-black w-full"
                        />
                        <button onClick={handleRename} className="p-1 hover:bg-gray-100 rounded-lg text-green-600">
                          <Check className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => onViewChange?.({ type: "Space", id: space.id, name: space.name })}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 text-xs font-bold rounded-xl transition-all text-left",
                          activeView === space.name ? "bg-gray-100 text-black shadow-sm" : "text-muted-foreground hover:bg-gray-50 hover:text-foreground"
                        )}
                      >
                        <LayoutGrid className="h-4 w-4" />
                        <span className="truncate pr-8">{space.name}</span>
                        
                        <div className="absolute right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all bg-inherit">
                          <button 
                            onClick={(e) => handleStartRename(e, space)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-black"
                          >
                            <MoreHorizontal className="h-3 w-3" />
                          </button>
                          <button 
                            onClick={(e) => handleDeleteSpace(e, space.id)}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </button>
                    )}
                  </div>
                ))
              ) : (
                !isCreatingSpace && <p className="px-3 py-2 text-[10px] text-muted-foreground font-bold uppercase tracking-wider opacity-50">No collections</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="pt-6 border-t mt-auto">
        <button 
          onClick={() => onViewChange?.("Settings")}
          className={cn(
            "w-full flex items-center justify-between px-3 py-3 rounded-2xl transition-all group",
            activeView === "Settings" ? "bg-black text-white shadow-xl scale-[1.02]" : "bg-white border border-gray-100 hover:border-gray-200"
          )}
        >
           <div className="flex items-center gap-3">
              {user ? (
                <Avatar className="h-5 w-5 border border-white/20">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback className={cn("text-[8px] font-black uppercase", activeView === "Settings" ? "bg-white text-black" : "bg-black text-white")}>
                    {user.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <Settings className={cn("h-4 w-4 transition-colors", activeView === "Settings" ? "text-white" : "text-muted-foreground group-hover:text-black")} />
              )}
              <span className="text-xs font-bold">{user ? "Profile" : "Settings"}</span>
           </div>
           {user && credits !== null && activeView !== "Settings" && (
             <div 
               onClick={(e) => { e.stopPropagation(); onTopUp?.(); }}
               className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100 cursor-pointer hover:bg-amber-100 transition-colors"
             >
               <Coins className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />
               <span className="text-[9px] font-black text-amber-600">{credits}</span>
             </div>
           )}
           <ChevronRight className={cn("h-3 w-3 transition-colors", activeView === "Settings" ? "text-white/50" : "text-gray-300")} />
        </button>

        {!user && (
          <div className="mt-3">
            <AuthDialog onSuccess={onAuthSuccess} />
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;

