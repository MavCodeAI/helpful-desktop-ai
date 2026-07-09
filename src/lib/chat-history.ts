/**
 * Chat history persistence (localStorage-based, per browser).
 *
 * A conversation is a `Thread` with an id, title, updated timestamp, and its
 * ordered messages. Threads are stored under a single key so the sidebar can
 * hydrate quickly without scanning multiple entries.
 */

export type ChatMsg = { role: "user" | "assistant"; content: string };

export interface Thread {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMsg[];
}

const KEY = "jarvis.chat.threads.v1";

/** Read the full list of saved threads, most-recent first. */
export function loadThreads(): Thread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Thread[];
    return arr.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/** Overwrite the thread list. */
export function saveThreads(threads: Thread[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(threads));
}

/** Insert or update a thread by id. Returns the new sorted list. */
export function upsertThread(thread: Thread): Thread[] {
  const all = loadThreads().filter((t) => t.id !== thread.id);
  const next = [thread, ...all].sort((a, b) => b.updatedAt - a.updatedAt);
  saveThreads(next);
  return next;
}

/** Delete a thread by id. Returns the remaining list. */
export function deleteThread(id: string): Thread[] {
  const next = loadThreads().filter((t) => t.id !== id);
  saveThreads(next);
  return next;
}

/** Generate a short thread title from the first user message. */
export function deriveTitle(messages: ChatMsg[]): string {
  const first = messages.find((m) => m.role === "user")?.content ?? "New conversation";
  const clean = first.replace(/\s+/g, " ").trim();
  return clean.length > 48 ? clean.slice(0, 45) + "…" : clean || "New conversation";
}

/** Create a fresh empty thread. */
export function createThread(): Thread {
  return {
    id: `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title: "New conversation",
    updatedAt: Date.now(),
    messages: [],
  };
}
