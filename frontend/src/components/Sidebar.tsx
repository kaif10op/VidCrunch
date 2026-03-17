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
      "border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-black h-screen flex flex-col transition-all duration-300 shrink-0", 
      isCollapsed ? "w-[80px]" : "w-[240px]",
      className
    )}>
      {/* Logo & Toggle */}
      <div className={cn("flex items-center justify-between px-5 pt-5 pb-4", isCollapsed && "px-3")}>
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-black dark:bg-white rounded flex items-center justify-center">
              <span className="text-white dark:text-black text-[12px] font-bold">TB</span>
            </div>
            <span className="font-bold text-lg tracking-tight text-foreground">TubeBrain</span>
          </div>
        )}
        <button 
          onClick={() => onCollapse(!isCollapsed)}
          className={cn(
            "p-1.5 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-lg text-gray-400 hover:text-foreground transition-all",
            isCollapsed && "mx-auto"
          )}
        >
          {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Add Content */}
      <div className="px-3 mb-4">
        <Link
          to="/dashboard"
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all text-left text-foreground",
            isCollapsed && "justify-center px-0 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-900"
          )}
          title={isCollapsed ? "Add content" : undefined}
        >
          <Plus className="h-4 w-4" />
          {!isCollapsed && <span>Add content</span>}
        </Link>
      </div>

      {/* Nav */}
      <nav className="px-3 space-y-0.5 mb-2" aria-label="Main navigation">
        {navItems.map((item) => (
          <Link 
            key={item.name}
            to={item.path}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-all text-left",
              currentPath === item.path 
                ? "bg-gray-100 dark:bg-gray-900 text-foreground font-medium" 
                : "text-muted-foreground hover:bg-gray-50 dark:hover:bg-gray-900 hover:text-foreground",
              isCollapsed && "justify-center px-0"
            )}
            title={isCollapsed ? item.name : undefined}
          >
            <item.icon className="h-4 w-4" />
            {!isCollapsed && item.name}
          </Link>
        ))}
      </nav>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-4">
        {/* Spaces */}
        {user && !isCollapsed && (
          <div>
            <h3 className="px-3 text-xs font-medium text-muted-foreground mb-2 mt-4">Spaces</h3>
            
            {/* New Space Button */}
            <button 
              onClick={() => setIsCreatingSpace(true)}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Space</span>
            </button>
            
            <div className="space-y-0.5 mt-1">
              {isCreatingSpace && (
                <div className="px-3 py-2 flex flex-col gap-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg mb-2 border border-gray-100 dark:border-gray-800">
                  <input
                    autoFocus
                    value={newSpaceName}
                    onChange={(e) => setNewSpaceName(e.target.value)}
                    onKeyUp={(e) => e.key === "Enter" && handleCreateSpace()}
                    placeholder="Space name..."
                    className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 text-sm p-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 dark:text-white"
                  />
                  <div className="flex items-center gap-2">
                    <Button onClick={handleCreateSpace} size="sm" className="h-7 bg-black dark:bg-white text-white dark:text-black rounded-lg text-xs flex-1">Add</Button>
                    <button onClick={() => setIsCreatingSpace(false)} className="p-1 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-all dark:text-gray-400"><X className="h-4 w-4" /></button>
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
                        className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-sm p-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 w-full dark:text-white"
                      />
                      <button onClick={handleRename} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-green-600">
                        <Check className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <Link 
                      to={`/space/${space.id}`}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-1.5 text-sm rounded-lg transition-all text-left",
                        currentPath === `/space/${space.id}` ? "bg-gray-100 dark:bg-gray-900 text-foreground font-medium" : "text-muted-foreground hover:bg-gray-50 dark:hover:bg-gray-900 hover:text-foreground"
                      )}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      <span className="truncate pr-8">{space.name}</span>
                      
                      <div className="absolute right-2 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all">
                        <button 
                          onClick={(e) => handleStartRename(e, space)}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-400 hover:text-black dark:hover:text-white"
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </button>
                        <button 
                          onClick={(e) => handleDeleteSpace(e, space.id)}
                          className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 rounded text-gray-400 hover:text-red-500"
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

        {/* My Library */}
        {user && !isCollapsed && (
          <div className="mt-4">
            <Link
              to="/library"
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors text-left",
                currentPath === "/library" ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>My Library</span>
              <ChevronRight className="h-3 w-3 text-gray-300 dark:text-gray-600" />
            </Link>
          </div>
        )}
        
        {user && isCollapsed && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <Link
              to="/library"
              className={cn(
                "p-2 rounded-lg transition-all",
                currentPath === "/library" ? "bg-gray-100 dark:bg-gray-900 text-foreground" : "text-muted-foreground hover:bg-gray-50 dark:hover:bg-gray-900 hover:text-foreground"
              )}
              title="My Library"
            >
              <Library className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
      {/* Bottom Section */}
      <div className={cn("mt-auto px-3 pb-4", isCollapsed && "px-1")}>
        {user ? (
          <div className="space-y-2">
             {!isCollapsed && (
              <button 
                onClick={onTopUp}
                className="w-full h-8 flex items-center justify-center text-[11px] font-semibold text-[#00a86b] bg-[#e6f9f1] dark:bg-[#00a86b]/10 hover:bg-[#d5f2e4] dark:hover:bg-[#00a86b]/20 rounded-lg transition-colors border border-[#ccf0dd] dark:border-[#00a86b]/30"
              >
                Upgrade Plan
              </button>
            )}
            
            <Link 
              to="/settings"
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-2xl transition-all group",
                currentPath === "/settings" ? "bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800" : "hover:bg-gray-50 dark:hover:bg-gray-900",
                isCollapsed && "px-2 justify-center"
              )}
              title={isCollapsed ? "Settings" : undefined}
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 rounded-xl">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback className="text-[12px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                    {user.name?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="flex flex-col items-start overflow-hidden">
                    <span className="text-sm font-bold truncate max-w-[110px] text-foreground">{user.name || "User"}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Free Plan</span>
                  </div>
                )}
              </div>
              {!isCollapsed && <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-700 group-hover:text-foreground transition-colors" />}
            </Link>
          </div>
        ) : (
          <div className="px-1">
            <AuthDialog onSuccess={onAuthSuccess} />
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;

