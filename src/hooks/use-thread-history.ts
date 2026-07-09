import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadThreads,
  saveThreads,
  loadActiveId,
  saveActiveId,
  createThread,
  deleteThread as removeThreadFn,
  upsertThread,
  type Thread,
} from "@/lib/chat-history";
import type { VoiceMessage } from "@/lib/voice-providers";
import { useThreadRename } from "./use-thread-rename";
import { useThreadFilter } from "./use-thread-filter";
import { useThreadPersist } from "./use-thread-persist";

type Options = {
  /** Called before switching/creating/deleting threads (e.g. stop current session). */
  onBeforeSwitch: () => void;
  /** Called after switching threads so the caller can clear session partials. */
  onSwitched: () => void;
};

/**
 * Thread list + active thread + persisted messages.
 * Bootstraps a default thread on first load (idempotent, StrictMode-safe).
 * Persists messages into the active thread whenever they change, deriving a
 * title from the first user turn.
 */
export function useThreadHistory({ onBeforeSwitch, onSwitched }: Options) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>("");
  const [messages, setMessages] = useState<VoiceMessage[]>([]);

  const threadsRef = useRef<Thread[]>([]);
  const activeIdRef = useRef<string>("");
  useEffect(() => { threadsRef.current = threads; }, [threads]);
  useEffect(() => { activeIdRef.current = activeThreadId; }, [activeThreadId]);

  const rename = useThreadRename(threadsRef, setThreads);
  const filter = useThreadFilter(threads);
  useThreadPersist(threadsRef, activeThreadId, messages, setThreads);

  // Bootstrap once.
  useEffect(() => {
    const existing = loadThreads();
    const savedActive = loadActiveId();
    if (existing.length === 0) {
      const t = createThread();
      setThreads([t]);
      setActiveThreadId(t.id);
      saveThreads([t]);
      saveActiveId(t.id);
      setMessages([]);
    } else {
      setThreads(existing);
      const active = existing.find((x) => x.id === savedActive) ?? existing[0];
      setActiveThreadId(active.id);
      saveActiveId(active.id);
      setMessages(active.messages);
    }
  }, []);

  const newConversation = useCallback(() => {
    onBeforeSwitch();
    const t = createThread();
    const next = upsertThread(threadsRef.current, t);
    setThreads(next);
    saveThreads(next);
    setActiveThreadId(t.id);
    saveActiveId(t.id);
    setMessages([]);
    onSwitched();
  }, [onBeforeSwitch, onSwitched]);

  const openThread = useCallback((id: string) => {
    if (id === activeIdRef.current) { onSwitched(); return; }
    onBeforeSwitch();
    const t = threadsRef.current.find((x) => x.id === id);
    if (!t) { onSwitched(); return; }
    setActiveThreadId(t.id);
    saveActiveId(t.id);
    setMessages(t.messages);
    onSwitched();
  }, [onBeforeSwitch, onSwitched]);

  const removeThread = useCallback((id: string) => {
    const next = removeThreadFn(threadsRef.current, id);
    if (id === activeIdRef.current) {
      onBeforeSwitch();
      if (next.length === 0) {
        const t = createThread();
        next.unshift(t);
      }
      const nextActive = next[0].id;
      setActiveThreadId(nextActive);
      saveActiveId(nextActive);
      setMessages(next[0].messages);
      onSwitched();
    }
    setThreads(next);
    saveThreads(next);
  }, [onBeforeSwitch, onSwitched]);

  return {
    threads, activeThreadId, messages, setMessages,
    ...rename,
    ...filter,
    newConversation, openThread, removeThread,
  };
}