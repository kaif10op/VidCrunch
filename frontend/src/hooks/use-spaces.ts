import { useState, useCallback } from "react";
import {
  getHistory,
  getSpaces,
  fetchHistory,
  fetchSpaces,
  createSpace,
  addVideoToSpace,
  deleteHistory,
  clearHistory,
  renameSpace,
  deleteSpace,
  HistoryItem,
  Space,
} from "@/lib/storage";
import { getAuthToken } from "@/lib/api";
import { toast } from "sonner";

export function useSpaces() {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>(() => getHistory());
  const [spaces, setSpaces] = useState<Space[]>(() => getSpaces());

  const refreshHistory = useCallback(async () => {
    const items = await fetchHistory();
    setHistoryItems(items);
    return items;
  }, []);

  const refreshSpaces = useCallback(async () => {
    const items = await fetchSpaces();
    setSpaces(items);
    return items;
  }, []);

  const handleCreateNewSpace = useCallback(async (name: string) => {
    const space = await createSpace(name);
    if (space) {
      setSpaces((prev) => [...prev, space]);
      toast.success(`Space "${name}" created`);
    }
  }, []);

  const handleRenameSpace = useCallback(async (id: string, name: string) => {
    await renameSpace(id, name);
    setSpaces((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
    toast.success("Space renamed");
  }, []);

  const handleDeleteSpace = useCallback(
    async (id: string, selectedSpaceId?: string | null) => {
      await deleteSpace(id);
      setSpaces((prev) => prev.filter((s) => s.id !== id));
      toast.success("Space deleted");
      return selectedSpaceId === id;
    },
    []
  );

  const handleAddToSpace = useCallback(
    async (spaceId: string, videoId: string) => {
      const space = spaces.find((s) => s.id === spaceId);
      await addVideoToSpace(spaceId, videoId);
      setSpaces(await fetchSpaces());
      toast.success(`Added to ${space?.name}`);
    },
    [spaces]
  );

  const handleDeleteHistoryItem = useCallback(async (id: string) => {
    await deleteHistory(id, id);
    setHistoryItems((prev) => prev.filter((item) => item.id !== id));
    toast.success("Item removed from history");
  }, []);

  const handleClearHistory = useCallback(async () => {
    await clearHistory();
    setHistoryItems([]);
    toast.success("History cleared!");
  }, []);

  return {
    historyItems,
    setHistoryItems,
    spaces,
    setSpaces,
    refreshHistory,
    refreshSpaces,
    handleCreateNewSpace,
    handleRenameSpace,
    handleDeleteSpace,
    handleAddToSpace,
    handleDeleteHistoryItem,
    handleClearHistory,
  };
}
