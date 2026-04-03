import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, History, Library, Coins, Settings, Diamond } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { AuthDialog } from "./AuthDialog";
import { useAuthContext } from "@/contexts/AuthContext";
import { useUIContext } from "@/contexts/UIContext";
import { Button } from "./ui/button";

export function TopNav() {
  const location = useLocation();
  const currentPath = location.pathname;
  const { user, credits } = useAuthContext();
  const { setIsTopUpOpen } = useUIContext();

  const navItems = user ? [
    { name: "Dashboard", path: "/dashboard", icon: LayoutGrid },
    { name: "History", path: "/history", icon: History },
    { name: "Spaces", path: "/library", icon: Library },
  ] : [];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-background/60 backdrop-blur-3xl supports-[backdrop-filter]:bg-background/40 shadow-sm shadow-black/20">
      <div className="flex h-[60px] items-center px-4 md:px-6 w-full gap-4 md:gap-8">
        
        {/* Logo Section */}
        <Link to={user ? "/dashboard" : "/"} className="hover:opacity-90 transition-opacity outline-none z-10 shrink-0">
          <Logo />
        </Link>
        
        {/* Center Nav */}
        <div className="flex-1 flex items-center justify-start md:justify-center h-full relative">
          <nav className="hidden md:flex h-full items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "relative flex items-center h-full px-4 text-sm font-semibold transition-colors outline-none group",
                  currentPath === item.path ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {currentPath === item.path && (
                  <motion.div
                    layoutId="topnav-active"
                    className="absolute bottom-[-1px] left-0 right-0 h-[3px] bg-primary rounded-t-full shadow-[0_-2px_8px_rgba(139,92,246,0.5)]"
                    initial={false}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative flex items-center gap-2">
                   <item.icon className={cn(
                     "h-4 w-4 transition-transform duration-300", 
                     currentPath === item.path ? "text-primary scale-110" : "opacity-60 group-hover:scale-110"
                   )} />
                   {item.name}
                </span>
              </Link>
            ))}
          </nav>
        </div>
        
        {/* Right Actions */}
        <div className="flex items-center gap-3 md:gap-4 shrink-0">
           {user ? (
             <>
               <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.02]">
                 <Coins className="h-3.5 w-3.5 text-primary" />
                 <span className="text-xs font-bold">{credits ?? 0}</span>
               </div>
               
               <Button
                  onClick={() => setIsTopUpOpen(true)}
                  className="hidden sm:flex h-8 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-bold shadow-lg shadow-primary/5 transition-all gap-1.5 px-4"
               >
                 <Diamond className="h-3.5 w-3.5 fill-primary/30" />
                 Upgrade
               </Button>
               
               <Link to="/settings" className="flex items-center justify-center h-8 w-8 md:h-9 md:w-9 rounded-xl hover:bg-white/[0.04] group transition-colors">
                 <Settings className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-transform group-hover:rotate-90 duration-500" />
               </Link>

               <Link to="/settings" className="hover:scale-105 transition-transform group">
                 <Avatar className="h-8 w-8 md:h-9 md:w-9 rounded-xl border border-white/[0.08] shadow-sm group-hover:border-primary/50 transition-colors">
                   <AvatarImage src={user.avatar_url} />
                   <AvatarFallback className="text-sm font-bold bg-primary text-primary-foreground rounded-xl">
                     {user.name?.charAt(0).toUpperCase() || "U"}
                   </AvatarFallback>
                 </Avatar>
               </Link>
             </>
           ) : (
             <AuthDialog onSuccess={() => {}} />
           )}
        </div>
      </div>
    </header>
  );
}
