import { useCallback, useEffect, useRef, useState } from "react";
import { extractMemoryFacts } from "@/lib/memories.functions";

export type Memory = {
  id: string;
  content: string;
  source: "manual" | "auto";
  created_at: string;
  updated_at: string;
};
import { toast } from "sonner";

const STORAGE_KEY = "jarvis.memories.v1";
function storageKey() { return STORAGE_KEY; }

function load(): Memory[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as Memory[]) : [];
  } catch { return []; }
}

function save(rows: Memory[]) {
  try { window.localStorage.setItem(storageKey(), JSON.stringify(rows)); }
  catch { /* noop */ }
}

function uid() {
  return (
    (crypto as { randomUUID?: () => string }).randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );
}

export function useMemories(options: { geminiKey?: string } = {}) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const geminiKeyRef = useRef(options.geminiKey ?? "");
  const [loading, setLoading] = useState(true);
  const memRef = useRef<Memory[]>([]);

  useEffect(() => { geminiKeyRef.current = options.geminiKey ?? ""; }, [options.geminiKey]);
  useEffect(() => { memRef.current = memories; save(memories); }, [memories]);

  const refresh = useCallback(async () => {
    setMemories(load());
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const add = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (trimmed.length < 2) return;
    const now = new Date().toISOString();
    const row: Memory = { id: uid(), content: trimmed, source: "manual", created_at: now, updated_at: now };
    setMemories((prev) => [row, ...prev]);
    toast.success("Memory saved");
  }, []);

  const remove = useCallback(async (id: string) => {
    setMemories((p) => p.filter((m) => m.id !== id));
  }, []);

  const clearAll = useCallback(async () => {
    setMemories([]);
    toast.success("All memories cleared");
  }, []);

  const extractFrom = useCallback(async (transcript: string) => {
    if (transcript.trim().length < 20) return;
    try {
      const existing = memRef.current.map((m) => m.content);
      const res = await extractMemoryFacts({ data: { transcript, existing, userKey: geminiKeyRef.current || undefined } });
      const facts = res.facts ?? [];
      if (facts.length === 0) return;
      const existingLower = new Set(existing.map((c) => c.toLowerCase()));
      const now = new Date().toISOString();
      const fresh: Memory[] = (facts as string[])
        .filter((f: string) => !existingLower.has(f.toLowerCase()))
        .map((content: string) => ({ id: uid(), content, source: "auto" as const, created_at: now, updated_at: now }));
      if (fresh.length === 0) return;
      setMemories((prev) => [...fresh, ...prev]);
    } catch (e) {
      console.warn("extractMemoryFacts failed", e);
    }
  }, []);

  return { memories, loading, refresh, add, remove, clearAll, extractFrom, memRef };

}
