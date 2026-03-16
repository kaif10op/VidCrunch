import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { searchApi } from "@/lib/api";
import { logger } from "@/lib/logger";

interface UIContextValue {
  isFocusMode: boolean;
  setIsFocusMode: (val: boolean) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (val: boolean) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (val: boolean) => void;
  isVideoMinimized: boolean;
  setIsVideoMinimized: (val: boolean) => void;
  isMobileLearnOpen: boolean;
  setIsMobileLearnOpen: (val: boolean) => void;
  
  // Modals
  isFeedbackOpen: boolean;
  setIsFeedbackOpen: (val: boolean) => void;
  isProfileUpdateOpen: boolean;
  setIsProfileUpdateOpen: (val: boolean) => void;
  isTopUpOpen: boolean;
  setIsTopUpOpen: (val: boolean) => void;
  isSearchModalOpen: boolean;
  setIsSearchModalOpen: (val: boolean) => void;
  
  // Theme & Accessibility
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
  accessibility: {
    highContrast: boolean;
    screenReader: boolean;
    dyslexicFont: boolean;
  };
  updateAccessibility: (key: keyof UIContextValue["accessibility"], val: boolean) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: any[];
  isSearchLoading: boolean;
  handleSearch: (query: string) => Promise<void>;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isVideoMinimized, setIsVideoMinimized] = useState(false);
  const [isMobileLearnOpen, setIsMobileLearnOpen] = useState(false);
  
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isProfileUpdateOpen, setIsProfileUpdateOpen] = useState(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  
  const [theme, setTheme] = useState<"light" | "dark" | "system">(() => {
    return (localStorage.getItem("tube-theme") as any) || "system";
  });

  const [accessibility, setAccessibility] = useState({
    highContrast: localStorage.getItem("tube-hc") === "true",
    screenReader: localStorage.getItem("tube-sr") === "true",
    dyslexicFont: localStorage.getItem("tube-df") === "true",
  });

  const updateAccessibility = useCallback((key: keyof typeof accessibility, val: boolean) => {
    setAccessibility(prev => {
      const next = { ...prev, [key]: val };
      localStorage.setItem(`tube-${key === 'highContrast' ? 'hc' : key === 'screenReader' ? 'sr' : 'df'}`, String(val));
      return next;
    });
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);

  // Apply Theme & Accessibility Classes
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Theme
    root.classList.remove("light", "dark");
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
    localStorage.setItem("tube-theme", theme);

    // Accessibility
    root.classList.toggle("high-contrast", accessibility.highContrast);
    root.classList.toggle("dyslexic-font", accessibility.dyslexicFont);
    
    // ARIA for Screen Readers
    if (accessibility.screenReader) {
      root.setAttribute("data-screen-reader", "true");
    } else {
      root.removeAttribute("data-screen-reader");
    }
  }, [theme, accessibility]);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearchLoading(true);
    try {
      const res = await searchApi.query(query);
      if (res.ok) {
        setSearchResults(await res.json());
      }
    } catch (err) {
      logger.error("Search failed:", err);
    } finally {
      setIsSearchLoading(false);
    }
  }, []);

  // CMD+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <UIContext.Provider
      value={{
        isFocusMode,
        setIsFocusMode,
        isSidebarOpen,
        setIsSidebarOpen,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        isVideoMinimized,
        setIsVideoMinimized,
        isMobileLearnOpen,
        setIsMobileLearnOpen,
        isFeedbackOpen,
        setIsFeedbackOpen,
        isProfileUpdateOpen,
        setIsProfileUpdateOpen,
        isTopUpOpen,
        setIsTopUpOpen,
        isSearchModalOpen,
        setIsSearchModalOpen,
        theme,
        setTheme,
        accessibility,
        updateAccessibility,
        searchQuery,
        setSearchQuery,
        searchResults,
        isSearchLoading,
        handleSearch,
      }}
    >
      {children}
    </UIContext.Provider>
  );
}

export function useUIContext() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUIContext must be used within UIProvider");
  return ctx;
}
