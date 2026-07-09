import { useCallback, useState } from "react";
import { upsertThread, saveThreads, type Thread } from "@/lib/chat-history";

export function useThreadRename(
  threadsRef: React.MutableRefObject<Thread[]>,
  setThreads: (t: Thread[]) => void,
) {
  const [renamingId, setRenamingId] = useState<string>("");
  const [renameDraft, setRenameDraft] = useState<string>("");

  const beginRename = useCallback((t: Thread) => {
    setRenamingId(t.id);
    setRenameDraft(t.title);
  }, []);

  const cancelRename = useCallback(() => {
    setRenamingId("");
    setRenameDraft("");
  }, []);

  const commitRename = useCallback(() => {
    const id = renamingId;
    if (!id) return;
    const existing = threadsRef.current.find((x) => x.id === id);
    if (!existing) { cancelRename(); return; }
    const title = renameDraft.trim().slice(0, 80) || existing.title;
    if (title === existing.title) { cancelRename(); return; }
    const updated: Thread = { ...existing, title, updatedAt: Date.now() };
    const next = upsertThread(threadsRef.current, updated);
    setThreads(next);
    saveThreads(next);
    cancelRename();
  }, [renamingId, renameDraft, cancelRename, threadsRef, setThreads]);

  return { renamingId, renameDraft, setRenameDraft, beginRename, commitRename, cancelRename };
}