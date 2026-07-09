// localStorage-backed threaded chat history.
// Small, dependency-free — mirrors the "Jarvis Companion perfect2" pattern.

import type { VoiceMessage } from "@/lib/voice-providers";

export type ChatMsg = VoiceMessage;

export interface Thread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMsg[];
}

const KEY = "voice_threads_v1";
const ACTIVE_KEY = "voice_active_thread_v1";
const MAX_THREADS = 40;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export function loadThreads(): Thread[] {
  if (typeof window === "undefined") return [];
  const arr = safeParse<Thread[]>(localStorage.getItem(KEY), []);
  return Array.isArray(arr) ? arr : [];
}

export function saveThreads(threads: Thread[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(threads.slice(0, MAX_THREADS)));
}

export function loadActiveId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ACTIVE_KEY) || "";
}

export function saveActiveId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_KEY, id);
}

export function deriveTitle(messages: ChatMsg[]): string {
  const first = messages.find((m) => m.role === "you" && m.text.trim());
  if (!first) return "New conversation";
  const t = first.text.trim().replace(/\s+/g, " ");
  return t.length > 42 ? t.slice(0, 42) + "…" : t;
}

export function createThread(): Thread {
  const now = Date.now();
  return {
    id: `t_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    title: "New conversation",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function upsertThread(threads: Thread[], t: Thread): Thread[] {
  const idx = threads.findIndex((x) => x.id === t.id);
  const next = idx === -1 ? [t, ...threads] : threads.map((x) => (x.id === t.id ? t : x));
  // Keep most recently updated first.
  return next.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_THREADS);
}

export function deleteThread(threads: Thread[], id: string): Thread[] {
  return threads.filter((t) => t.id !== id);
}