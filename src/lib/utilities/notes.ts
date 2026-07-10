// Simple localStorage-backed quick notes. Zero deps, zero server round-trip.
import { useCallback, useEffect, useState } from "react";

export type Note = { id: string; text: string; at: number };

const KEY = "alpha_notes_v1";

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
}

export function addNoteRaw(text: string): Note {
  const note: Note = { id: crypto.randomUUID(), text: text.trim(), at: Date.now() };
  const list = [note, ...read()];
  write(list);
  return note;
}

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  useEffect(() => { setNotes(read()); }, []);

  const add = useCallback((text: string) => {
    const n = addNoteRaw(text);
    setNotes((prev) => [n, ...prev]);
    return n;
  }, []);

  const remove = useCallback((id: string) => {
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      write(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setNotes([]);
    write([]);
  }, []);

  return { notes, add, remove, clear };
}
