import { createContext, useContext, type ReactNode } from "react";
import { useSpaces as useSpacesHook } from "@/hooks/use-spaces.ts";
import type { HistoryItem, Space } from "@/types";

interface SpacesContextValue {
  historyItems: HistoryItem[];
  setHistoryItems: React.Dispatch<React.SetStateAction<HistoryItem[]>>;
  spaces: Space[];
  setSpaces: React.Dispatch<React.SetStateAction<Space[]>>;
  refreshHistory: () => Promise<HistoryItem[]>;
  refreshSpaces: () => Promise<Space[]>;
  handleCreateNewSpace: (name: string) => Promise<void>;
  handleRenameSpace: (id: string, name: string) => Promise<void>;
  handleDeleteSpace: (id: string, selectedSpaceId?: string | null) => Promise<boolean>;
  handleAddToSpace: (spaceId: string, videoId: string) => Promise<void>;
  handleDeleteHistoryItem: (id: string) => Promise<void>;
  handleClearHistory: () => Promise<void>;
}

const SpacesContext = createContext<SpacesContextValue | null>(null);

export function SpacesProvider({ children }: { children: ReactNode }) {
  const spacesHook = useSpacesHook();

  return (
    <SpacesContext.Provider value={spacesHook}>
      {children}
    </SpacesContext.Provider>
  );
}

export function useSpacesContext() {
  const ctx = useContext(SpacesContext);
  if (!ctx) throw new Error("useSpacesContext must be used within SpacesProvider");
  return ctx;
}
