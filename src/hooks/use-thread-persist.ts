import { useEffect } from "react";
import { deriveTitle, saveThreads, upsertThread, type Thread } from "@/lib/chat-history";
import type { VoiceMessage } from "@/lib/voice-providers";

/** Persist messages into the active thread whenever they change. */
export function useThreadPersist(
  threadsRef: React.MutableRefObject<Thread[]>,
  activeThreadId: string,
  messages: VoiceMessage[],
  setThreads: (t: Thread[]) => void,
) {
  useEffect(() => {
    const id = activeThreadId;
    if (!id) return;
    const existing = threadsRef.current.find((t) => t.id === id);
    if (!existing) return;
    if (
      existing.messages.length === messages.length &&
      existing.messages.every((m, i) => m.text === messages[i]?.text && m.role === messages[i]?.role)
    ) {
      return;
    }
    const updated: Thread = {
      ...existing,
      messages,
      updatedAt: Date.now(),
      title: existing.title === "New conversation" ? deriveTitle(messages) : existing.title,
    };
    const next = upsertThread(threadsRef.current, updated);
    setThreads(next);
    saveThreads(next);
  }, [messages, activeThreadId, threadsRef, setThreads]);
}