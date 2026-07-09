import { useMemo, useState } from "react";
import type { Thread } from "@/lib/chat-history";

export function useThreadFilter(threads: Thread[]) {
  const [historyQuery, setHistoryQuery] = useState<string>("");
  const filteredThreads = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      t.messages.some((m) => m.text.toLowerCase().includes(q))
    );
  }, [threads, historyQuery]);
  return { historyQuery, setHistoryQuery, filteredThreads };
}