// Simple localStorage-backed quick notes with cross-listener sync.
import { useCallback, useEffect, useState } from "react";

export type Note = { id: string; text: string; at: number };

const KEY = "alpha_notes_v1";
const listeners = new Set<() => void>();

function notify() { listeners.forEach((fn) => fn()); }

function read(): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function write(notes: Note[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(notes.slice(0, 200))); } catch { /* quota */ }
  notify();
}

export function addNoteRaw(text: string): Note | null {
  const t = text.trim();
  if (!t) return null;
  const existing = read();
  // Dedupe: same text within 3s
  if (existing.length > 0 && existing[0].text === t && Date.now() - existing[0].at < 3000) {
    return existing[0];
  }
  const note: Note = { id: crypto.randomUUID(), text: t, at: Date.now() };
  write([note, ...existing]);
  return note;
}

export function removeNoteRaw(id: string) {
  write(read().filter((n) => n.id !== id));
}

export function clearNotesRaw() { write([]); }

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>(() => read());

  useEffect(() => {
    const sync = () => setNotes(read());
    listeners.add(sync);
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) sync(); };
    window.addEventListener("storage", onStorage);
    return () => { listeners.delete(sync); window.removeEventListener("storage", onStorage); };
  }, []);

  const add = useCallback((text: string) => addNoteRaw(text), []);
  const remove = useCallback((id: string) => removeNoteRaw(id), []);
  const clear = useCallback(() => clearNotesRaw(), []);

  return { notes, add, remove, clear };
}
