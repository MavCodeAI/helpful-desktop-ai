// Watchlist: topics Alpha keeps an eye on. localStorage-backed, cross-tab synced.
import { useCallback, useEffect, useState } from "react";

export type Watch = {
  id: string;
  topic: string;
  createdAt: number;
  checkedAt: number | null;
  summary: string | null;
  sources: { title: string; url: string }[];
  changed: boolean;
};

const KEY = "alpha_watchlist_v1";
const listeners = new Set<() => void>();

function notify() { listeners.forEach((fn) => fn()); }

function read(): Watch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Watch[]) : [];
  } catch { return []; }
}

function write(items: Watch[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, 50))); } catch { /* quota */ }
  notify();
}

export function addWatchRaw(topic: string): Watch | null {
  const t = topic.trim();
  if (!t) return null;
  const existing = read();
  if (existing.some((w) => w.topic.toLowerCase() === t.toLowerCase())) return null;
  const w: Watch = {
    id: crypto.randomUUID(),
    topic: t,
    createdAt: Date.now(),
    checkedAt: null,
    summary: null,
    sources: [],
    changed: false,
  };
  write([w, ...existing]);
  return w;
}

export function removeWatchRaw(id: string) {
  write(read().filter((w) => w.id !== id));
}

export function clearWatchesRaw() { write([]); }

export function applyCheckRaw(
  id: string,
  summary: string,
  sources: { title: string; url: string }[],
) {
  write(read().map((w) => {
    if (w.id !== id) return w;
    const changed = !!w.summary && w.summary.trim() !== summary.trim();
    return { ...w, summary, sources, changed, checkedAt: Date.now() };
  }));
}

export function markSeenRaw(id: string) {
  write(read().map((w) => (w.id === id ? { ...w, changed: false } : w)));
}

export function useWatchlist() {
  const [watches, setWatches] = useState<Watch[]>(() => read());

  useEffect(() => {
    const sync = () => setWatches(read());
    listeners.add(sync);
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) sync(); };
    window.addEventListener("storage", onStorage);
    return () => { listeners.delete(sync); window.removeEventListener("storage", onStorage); };
  }, []);

  return {
    watches,
    add: useCallback((t: string) => addWatchRaw(t), []),
    remove: useCallback((id: string) => removeWatchRaw(id), []),
    clear: useCallback(() => clearWatchesRaw(), []),
    applyCheck: useCallback(applyCheckRaw, []),
    markSeen: useCallback(markSeenRaw, []),
  };
}
