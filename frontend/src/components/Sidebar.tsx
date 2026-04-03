import { 
  Plus, 
  History, 
  LayoutGrid, 
  Library, 
  X,
  Zap,
  Settings,
  Coins,
  MoreHorizontal,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Space } from "@/lib/storage";
import { useState } from "react";
import { AuthDialog } from "./AuthDialog";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

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
    <motion.aside 
      initial={false}
      animate={{ width: isCollapsed ? 76 : 280 }}
      transition={{ type: "spring", damping: 28, stiffness: 220 }}
      className={cn(
        "relative h-full shrink-0 overflow-hidden flex flex-col bg-background/30 backdrop-blur-3xl", 
        className
      )}
    >
      {/* Brand Header */}
      <div className={cn(
        "w-full h-16 shrink-0 flex items-center mb-2 mt-2",
        isCollapsed ? "px-3 justify-center" : "px-5"
      )}>
        <div className={cn("flex items-center", isCollapsed ? "w-full justify-center" : "flex-1 gap-3")}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-primary to-[hsl(234,89%,64%)] shadow-lg shadow-primary/30">
            <Zap className="h-5 w-5 fill-white text-white" />
          </div>

          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="flex min-w-0 flex-col"
              >
                <span className="text-base font-bold tracking-tight text-foreground">VidCrunch</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Workspace</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {!isCollapsed && (
          <button 
            onClick={() => onCollapse?.(!isCollapsed)}
            className="group flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] transition-all hover:bg-white/[0.08]"
            title="Collapse Sidebar"
          >
            <PanelLeftClose className="h-4 w-4 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
          </button>
        )}
      </div>

      {isCollapsed && (
        <div className="flex justify-center mt-1">
          <button 
            onClick={() => onCollapse?.(false)}
            className="group flex h-8 w-8 items-center justify-center rounded-[10px] transition-all hover:bg-white/[0.08]"
            title="Expand Sidebar"
          >
            <PanelLeftOpen className="h-4 w-4 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
          </button>
        </div>
      )}

      {/* Main Nav */}
      <nav className="flex-none mt-2 space-y-1.5 px-4" aria-label="Main navigation">
        {navItems.map((item) => (
          <Tooltip key={item.name} delayDuration={0}>
            <TooltipTrigger asChild>
              <Link 
                to={item.path}
                className={cn(
                  "group relative flex items-center gap-3.5 overflow-hidden rounded-[12px] px-3.5 py-2.5 text-left transition-all duration-200",
                  currentPath === item.path 
                    ? "bg-primary/10 text-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] border border-primary/10" 
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground active:scale-[0.98] border border-transparent",
                  isCollapsed && "mx-auto h-[46px] w-[46px] justify-center px-0 rounded-[14px]"
                )}
              >
                {currentPath === item.path && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-primary"
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  />
                )}
                <item.icon className={cn(
                  "relative z-10 h-5 w-5 shrink-0 transition-transform duration-300",
                  currentPath === item.path 
                    ? "text-primary" 
                    : "text-muted-foreground group-hover:text-foreground group-hover:scale-110"
                )} />
                <AnimatePresence>
                   {!isCollapsed && (
                     <motion.span 
                       initial={{ opacity: 0, filter: "blur(4px)" }}
                       animate={{ opacity: 1, filter: "blur(0px)" }}
                       exit={{ opacity: 0, filter: "blur(4px)" }}
                       className="relative z-10 text-[13px] font-bold"
                     >
                       {item.name}
                     </motion.span>
                   )}
                </AnimatePresence>
              </Link>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right" sideOffset={16} className="text-xs font-bold bg-card border border-white/[0.08] px-3 py-2 rounded-xl shadow-xl">
                {item.name}
              </TooltipContent>
            )}
          </Tooltip>
        ))}
      </nav>

      {/* Spaces List */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-4 pt-8 pb-4">
        {user && (
          <div className="space-y-3">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-2 mb-1">
                 <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Spaces</h3>
                 <button 
                   onClick={() => setIsCreatingSpace(true)}
                   className="p-1 hover:bg-white/[0.08] rounded-[8px] text-muted-foreground hover:text-foreground transition-all"
                 >
                   <Plus className="h-4 w-4" />
                 </button>
              </div>
            )}
            
            <div className="space-y-1">
              <AnimatePresence>
                {isCreatingSpace && !isCollapsed && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                    className="mb-3 flex flex-col gap-2 rounded-[14px] border border-white/[0.08] bg-black/40 px-3 py-3 overflow-hidden shadow-xl"
                  >
                    <input
                      autoFocus
                      value={newSpaceName}
                      onChange={(e) => setNewSpaceName(e.target.value)}
                      onKeyUp={(e) => e.key === "Enter" && handleCreateSpace()}
                      placeholder="Space name..."
                      className="bg-transparent border-b border-white/[0.1] text-xs pb-2 focus:outline-none focus:border-primary text-foreground font-bold placeholder:text-muted-foreground/40 transition-colors"
                    />
                    <div className="flex items-center gap-2 pt-1">
                      <Button onClick={handleCreateSpace} size="sm" className="h-7 rounded-[8px] text-[10px] flex-1 font-bold bg-primary text-primary-foreground hover:bg-primary/90">Add Space</Button>
                      <button onClick={() => setIsCreatingSpace(false)} className="p-1.5 hover:bg-white/[0.08] rounded-[8px] transition-all text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
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
                        className="bg-black/40 border border-white/[0.08] text-xs p-2.5 rounded-[10px] focus:outline-none focus:ring-1 focus:ring-primary w-full text-foreground font-bold"
                      />
                    </div>
                  ) : (
                    <Link 
                      to={`/space/${space.id}`}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-[12px] px-3.5 py-2.5 text-left transition-all duration-200 border border-transparent",
                        currentPath === `/space/${space.id}` 
                          ? "bg-white/[0.03] text-foreground border-white/[0.05]" 
                          : "text-muted-foreground/70 hover:bg-white/[0.03] hover:text-foreground",
                        isCollapsed && "mx-auto h-[46px] w-[46px] justify-center px-0 rounded-[14px]"
                      )}
                      title={isCollapsed ? space.name : undefined}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full transition-all shrink-0",
                        currentPath === `/space/${space.id}` 
                          ? "bg-primary shadow-[0_0_8px_rgba(139,92,246,0.8)]" 
                          : "border border-muted-foreground/30 group-hover:border-primary/50 group-hover:bg-primary/20 bg-transparent"
                      )} />
                      <AnimatePresence>
                         {!isCollapsed && (
                           <motion.div 
                             initial={{ opacity: 0 }}
                             animate={{ opacity: 1 }}
                             exit={{ opacity: 0 }}
                             className="flex-1 flex items-center justify-between min-w-0"
                           >
                             <span className="truncate pr-2 font-bold text-[13px]">{space.name}</span>
                             <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all">
                               <button 
                                 onClick={(e) => handleStartRename(e, space)}
                                 className="p-1.5 hover:bg-white/[0.08] rounded-[8px] text-muted-foreground/50 hover:text-foreground transition-colors"
                               >
                                 <MoreHorizontal className="h-3.5 w-3.5" />
                               </button>
                               <button 
                                 onClick={(e) => handleDeleteSpace(e, space.id)}
                                 className="p-1.5 hover:bg-destructive/15 rounded-[8px] text-muted-foreground/50 hover:text-destructive transition-colors"
                               >
                                 <Trash2 className="h-3.5 w-3.5" />
                               </button>
                             </div>
                           </motion.div>
                         )}
                      </AnimatePresence>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User Footer */}
      <div className={cn("mt-auto p-4 shrink-0 relative z-10", isCollapsed && "p-3")}>
        {user ? (
          <div className="flex flex-col gap-3">
             <div className="flex ml-1.5 items-center justify-between">
                {!isCollapsed && (
                  <div className="flex items-center gap-2 px-1">
                    <Coins className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[11px] font-bold text-foreground/80">{credits ?? 0} credits</span>
                  </div>
                )}
                {!isCollapsed && (
                  <button 
                    onClick={onTopUp}
                    className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary transition-colors hover:bg-primary/20 hover:scale-105 active:scale-95"
                  >
                    Top up
                  </button>
                )}
             </div>
             
             <Link 
               to="/settings"
               className={cn(
                 "flex items-center gap-3 transition-all group rounded-[16px] p-2 hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06]",
                 isCollapsed && "justify-center p-1.5"
               )}
             >
               <Avatar className="h-10 w-10 rounded-[12px] shrink-0 border border-white/[0.05] shadow-lg">
                 <AvatarImage src={user.avatar_url} />
                 <AvatarFallback className="text-sm font-black bg-gradient-to-br from-card to-background text-foreground rounded-[12px]">
                   {user.name?.charAt(0).toUpperCase() || "U"}
                 </AvatarFallback>
               </Avatar>
               <AnimatePresence>
                 {!isCollapsed && (
                   <motion.div 
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     className="flex-1 flex items-center justify-between min-w-0"
                   >
                        <div className="flex flex-col items-start overflow-hidden flex-1">
                          <span className="text-[13px] font-bold truncate w-full text-foreground/90 group-hover:text-foreground transition-colors">{user.name || "Your Profile"}</span>
                          <span className="text-[10px] text-muted-foreground/70 font-semibold">Workspace Settings</span>
                        </div>
                        <Settings className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-transform duration-500 group-hover:rotate-180" />
                   </motion.div>
                 )}
               </AnimatePresence>
             </Link>
          </div>
        ) : (
          <AuthDialog onSuccess={onAuthSuccess} />
        )}
      </div>
    </motion.aside>
  );
};

export default Sidebar;
