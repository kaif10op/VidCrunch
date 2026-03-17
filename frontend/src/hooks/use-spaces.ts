import { useState, useCallback } from "react";
import {
  getHistory,
  getSpaces,
  fetchHistory,
  fetchSpaces,
  createSpace,
  addVideoToSpace,
  removeVideoFromSpace,
  deleteHistory,
  clearHistory,
  renameSpace,
  deleteSpace,
  uploadDocument,
  fetchSpaceDocuments,
  addDocumentToSpace,
  removeDocumentFromSpace,
  fetchSpaceNotes,
  createSpaceNote,
  deleteSpaceNote,
  updateSpaceNote,
  sendSpaceChat,
  HistoryItem,
  Space,
  DocumentData,
  NoteData,
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
      await addVideoToSpace(spaceId, videoId);
      setSpaces(await fetchSpaces());
      toast.success("Added to space");
    },
    []
  );

  const handleRemoveVideoFromSpace = useCallback(async (spaceId: string, videoId: string) => {
    await removeVideoFromSpace(spaceId, videoId);
    setSpaces(await fetchSpaces());
    toast.success("Removed from space");
  }, []);

  const handleDeleteHistoryItem = useCallback(async (id: string) => {
    await deleteHistory(id);
    setHistoryItems((prev) => prev.filter((item) => item.id !== id));
    toast.success("Item removed from history");
  }, []);

  const handleClearHistory = useCallback(async () => {
    await clearHistory();
    setHistoryItems([]);
    toast.success("History cleared!");
  }, []);

  const handleUploadDocument = useCallback(async (spaceId: string, file: File) => {
    const doc = await uploadDocument(file);
    if (doc) {
      await addDocumentToSpace(spaceId, doc.id);
      toast.success(`Document "${file.name}" uploaded`);
      return doc;
    }
    return null;
  }, []);

  const handleCreateNote = useCallback(async (spaceId: string, title: string, content: string) => {
    const note = await createSpaceNote(spaceId, title, content);
    if (note) {
      toast.success("Note created");
      return note;
    }
    return null;
  }, []);

  const handleSendChat = useCallback(async (spaceId: string, message: string, onChunk: (chunk: string) => void) => {
    await sendSpaceChat(spaceId, message, onChunk);
  }, []);

  const handleRemoveDocument = useCallback(async (spaceId: string, docId: string) => {
    await removeDocumentFromSpace(spaceId, docId);
    toast.success("Document removed from space");
  }, []);

  const handleDeleteNote = useCallback(async (spaceId: string, noteId: string) => {
    await deleteSpaceNote(spaceId, noteId);
    toast.success("Note deleted");
  }, []);

  const handleUpdateNote = useCallback(async (spaceId: string, noteId: string, title: string, content: string) => {
    const note = await updateSpaceNote(spaceId, noteId, title, content);
    if (note) {
      toast.success("Note updated");
      return note;
    }
    return null;
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
    handleRemoveVideoFromSpace,
    handleDeleteHistoryItem,
    handleClearHistory,
    handleUploadDocument,
    handleRemoveDocument,
    handleCreateNote,
    handleDeleteNote,
    handleUpdateNote,
    handleSendChat,
  };
}
