import { motion } from "framer-motion";
import { LayoutDashboard, Search, History, Settings, Library } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "react-router-dom";

interface BottomNavProps {
  onViewChange: (view: string) => void;
  activeView?: string;
  className?: string;
}

export function BottomNav({ onViewChange, activeView, className }: BottomNavProps) {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    { id: "dashboard", icon: LayoutDashboard, label: "Home", path: "/dashboard" },
    { id: "search-modal", icon: Search, label: "Search", path: "#search" },
    { id: "history", icon: History, label: "History", path: "/history" },
    { id: "library", icon: Library, label: "Library", path: "/library" },
    { id: "settings", icon: Settings, label: "Menu", path: "/settings" },
  ];

  return (
    <div className={cn(
      "fixed bottom-6 left-6 right-6 z-[60] lg:hidden",
      className
    )}>
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-primary/80 backdrop-blur-2xl border border-primary-foreground/10 rounded-[32px] p-2 flex items-center justify-between shadow-2xl shadow-primary/20"
      >
        {navItems.map((item) => {
          const isActive = currentPath === item.path;
          const Icon = item.icon;

          if (item.id === "search-modal") {
            return (
              <button
                key={item.id}
                onClick={() => onViewChange("search-modal")}
                aria-label={item.label}
                className="relative flex flex-col items-center justify-center py-2 px-1 flex-1 group"
              >
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300",
                  "text-primary-foreground/50 group-active:scale-95"
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[8px] font-black uppercase tracking-widest mt-1 transition-all text-primary-foreground/40">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={item.id}
              to={item.path}
              aria-label={item.label}
              className="relative flex flex-col items-center justify-center py-2 px-1 flex-1 group"
            >
              <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300",
                isActive ? "bg-primary-foreground text-primary scale-110 shadow-lg" : "text-primary-foreground/50 group-active:scale-95"
              )}>
                <Icon className="h-5 w-5" />
              </div>
              <span className={cn(
                "text-[8px] font-black uppercase tracking-widest mt-1 transition-all",
                isActive ? "text-primary-foreground opacity-100" : "text-primary-foreground/40"
              )}>
                {item.label}
              </span>
              {isActive && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute -bottom-1 w-1 h-1 bg-primary-foreground rounded-full"
                />
              )}
            </Link>
          );
        })}
      </motion.div>
    </div>
  );
}
