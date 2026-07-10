// Global on/off toggle for AI-powered note generation.
import { useCallback, useEffect, useState } from "react";

const KEY = "alpha_ai_notes_enabled";
const listeners = new Set<() => void>();
function notify() { listeners.forEach((fn) => fn()); }

function read(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw === null ? true : raw === "1";
  } catch { return true; }
}

function write(v: boolean) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* quota */ }
  notify();
}

export function isAiNotesEnabled(): boolean { return read(); }

export function useAiNotesEnabled(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => read());
  useEffect(() => {
    const sync = () => setEnabled(read());
    listeners.add(sync);
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) sync(); };
    window.addEventListener("storage", onStorage);
    return () => { listeners.delete(sync); window.removeEventListener("storage", onStorage); };
  }, []);
  const set = useCallback((v: boolean) => write(v), []);
  return [enabled, set];
}
