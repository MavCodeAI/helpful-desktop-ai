import { useEffect } from "react";

/**
 * Priority stack for overlay Escape handling. Later entries have higher
 * priority — first matching open overlay swallows the keystroke. Also
 * reports whether any overlay is open so the caller can mark the page inert.
 */
export interface OverlayEntry {
  open: boolean;
  close: () => void;
}

export function useOverlayStack(entries: OverlayEntry[]): boolean {
  const any = entries.some((e) => e.open);
  useEffect(() => {
    if (!any) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Iterate from highest priority (last) to lowest.
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (entry.open) {
          e.preventDefault();
          entry.close();
          return;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [any, entries]);
  return any;
}