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
  Check,
  HelpCircle,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Space } from "@/lib/storage";
import { useState, useEffect } from "react";
import { AuthDialog } from "./AuthDialog";
import { authApi, creditApi, removeAuthToken, getAuthToken } from "@/lib/api";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

import { Link, useLocation } from "react-router-dom";

interface SidebarProps {
  className?: string;
  spaces?: Space[];
  onCreateSpace?: (name: string) => void;
  onRenameSpace?: (id: string, name: string) => void;
  onDeleteSpace?: (id: string) => void;
  user: { name?: string; email?: string; avatar_url?: string } | null;
  credits: number | null;
  onLogout: () => void;
  onAuthSuccess: () => void;
  onTopUp?: () => void;
  isCollapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
  onViewChange?: (view: any) => void;
  activeView?: string;
  recents?: string[];
  setIsCollapsed?: (collapsed: boolean) => void;
  setIsFocusMode?: (focus: boolean) => void;
}

const Sidebar = ({ 
  className, 
  spaces = [],
  onCreateSpace,
  onRenameSpace,
  onDeleteSpace,
  user,
  credits,
  onLogout,
  onAuthSuccess,
  onTopUp,
  isCollapsed,
  onCollapse
}: SidebarProps) => {
  const location = useLocation();
  const currentPath = location.pathname;

  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const navItems = user 
    ? [
        { name: "Dashboard", icon: LayoutGrid, path: "/dashboard" },
        { name: "History", icon: History, path: "/history" },
        { name: "Library", icon: Library, path: "/library" },
      ]
    : [
        { name: "Home", icon: LayoutGrid, path: "/" },
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
    <aside className={cn(
      "border-r border-border bg-card h-screen flex flex-col transition-all duration-500 shrink-0", 
      isCollapsed ? "w-20" : "w-72",
      className
    )}>
      {/* Logo & Toggle */}
      <div className={cn("flex items-center justify-between px-6 pt-6 pb-4", isCollapsed && "px-4")}>
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Zap className="text-primary-foreground h-4 w-4 fill-primary-foreground" />
            </div>
            <span className="font-bold text-xl tracking-tight text-foreground">TubeBrain</span>
          </div>
        )}
        {isCollapsed && (
           <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
              <Zap className="text-primary-foreground h-5 w-5 fill-primary-foreground" />
           </div>
        )}
      </div>

      {/* Nav */}
      <nav className="px-4 space-y-1 mt-6" aria-label="Main navigation">
        {navItems.map((item) => (
          <Link 
            key={item.name}
            to={item.path}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-all text-left group",
              currentPath === item.path 
                ? "bg-secondary text-foreground font-bold" 
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
              isCollapsed && "justify-center px-0"
            )}
            title={isCollapsed ? item.name : undefined}
          >
            <item.icon className={cn(
              "h-5 w-5 transition-transform group-hover:scale-110",
              currentPath === item.path ? "text-primary" : "text-muted-foreground/50"
            )} />
            {!isCollapsed && <span>{item.name}</span>}
          </Link>
        ))}
      </nav>

      <div className="w-full px-6 my-4">
        <div className="h-px bg-border w-full" />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 pb-4">
        {/* Spaces */}
        {user && !isCollapsed && (
          <div>
            <div className="flex items-center justify-between px-3 mb-3">
               <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Spaces</h3>
               <button 
                 onClick={() => setIsCreatingSpace(true)}
                 className="p-1 hover:bg-secondary rounded-lg text-muted-foreground transition-all"
               >
                 <Plus className="h-3.5 w-3.5" />
               </button>
            </div>
            
            <div className="space-y-1">
              {isCreatingSpace && (
                <div className="px-3 py-3 flex flex-col gap-2 bg-secondary/30 rounded-2xl mb-2 border border-border animate-in fade-in slide-in-from-top-2">
                  <input
                    autoFocus
                    value={newSpaceName}
                    onChange={(e) => setNewSpaceName(e.target.value)}
                    onKeyUp={(e) => e.key === "Enter" && handleCreateSpace()}
                    placeholder="Space name..."
                    className="bg-background border border-border text-sm p-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground font-medium"
                  />
                  <div className="flex items-center gap-2">
                    <Button onClick={handleCreateSpace} size="sm" className="h-8 rounded-xl text-xs flex-1 font-bold">Create</Button>
                    <button onClick={() => setIsCreatingSpace(false)} className="p-1.5 hover:bg-secondary rounded-xl transition-all text-muted-foreground"><X className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
              
              {spaces.map((space) => (
                <div key={space.id} className="group relative">
                  {editingSpaceId === space.id ? (
                    <div className="px-3 py-1.5 flex items-center gap-2">
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyUp={(e) => e.key === "Enter" && handleRename()}
                        onBlur={handleRename}
                        className="bg-card border border-border text-sm p-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 w-full text-foreground font-medium"
                      />
                    </div>
                  ) : (
                    <Link 
                      to={`/space/${space.id}`}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-xl transition-all text-left group",
                        currentPath === `/space/${space.id}` ? "bg-secondary text-foreground font-bold" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                      )}
                    >
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full transition-all",
                        currentPath === `/space/${space.id}` ? "bg-primary scale-125" : "bg-muted-foreground/30 group-hover:bg-muted-foreground/60"
                      )} />
                      <span className="truncate flex-1">{space.name}</span>
                      
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                        <button 
                          onClick={(e) => handleStartRename(e, space)}
                          className="p-1 hover:bg-card rounded-lg text-muted-foreground hover:text-foreground"
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </button>
                        <button 
                          onClick={(e) => handleDeleteSpace(e, space.id)}
                          className="p-1 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {user && isCollapsed && (
           <div className="mt-8 flex flex-col items-center gap-4">
              <div className="w-8 h-px bg-border" />
              {spaces.slice(0, 5).map(space => (
                 <Link 
                   key={space.id}
                   to={`/space/${space.id}`}
                   className={cn(
                     "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                     currentPath === `/space/${space.id}` ? "bg-secondary text-primary font-bold" : "text-muted-foreground hover:bg-secondary/50"
                   )}
                   title={space.name}
                 >
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      currentPath === `/space/${space.id}` ? "bg-primary" : "bg-muted-foreground/30"
                    )} />
                 </Link>
              ))}
           </div>
        )}
      </div>

      {/* Bottom Section */}
      <div className={cn("mt-auto px-4 pb-6", isCollapsed && "px-2")}>
        {user ? (
          <div className="space-y-3">
             <div className="bg-secondary/30 rounded-2xl p-4 border border-border">
                {!isCollapsed && (
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Coins className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-[11px] font-black text-foreground">{credits ?? 0} Credits</span>
                    </div>
                    <button 
                      onClick={onTopUp}
                      className="text-[10px] font-black uppercase text-primary hover:underline"
                    >
                      Refill
                    </button>
                  </div>
                )}
                
                <Link 
                  to="/settings"
                  className={cn(
                    "w-full flex items-center gap-3 transition-all group",
                    isCollapsed && "justify-center"
                  )}
                >
                  <Avatar className="h-9 w-9 rounded-xl border border-border group-hover:border-primary transition-all">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback className="text-[12px] font-black bg-primary text-primary-foreground">
                      {user.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex flex-col items-start overflow-hidden flex-1">
                      <span className="text-sm font-bold truncate w-full text-foreground group-hover:text-primary transition-colors">{user.name || "User"}</span>
                      <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-black">Free Plan</span>
                    </div>
                  )}
                  {!isCollapsed && <Settings className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-foreground transition-colors" />}
                </Link>
             </div>
          </div>
        ) : (
          <div className="px-2">
            <AuthDialog onSuccess={onAuthSuccess} />
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;

