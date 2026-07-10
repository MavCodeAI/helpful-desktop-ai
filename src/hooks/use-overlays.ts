import { useMemo, useState } from "react";
import { useOverlayStack } from "@/hooks/use-overlay-stack";
import type { Thread } from "@/lib/chat-history";

/**
 * Bundles all top-level overlay state (history, settings, delete-confirm)
 * plus Escape-priority + any-open reporting.
 */
export function useOverlays() {
  const [showHistory, setShowHistory] = useState(false);
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Thread | null>(null);

  const stack = useMemo(() => [
    { open: showHistory,     close: () => setShowHistory(false) },
    { open: showVoiceMenu,   close: () => setShowVoiceMenu(false) },
    { open: !!pendingDelete, close: () => setPendingDelete(null) },
  ], [showHistory, showVoiceMenu, pendingDelete]);
  const anyOverlay = useOverlayStack(stack);

  return {
    showHistory, setShowHistory,
    showVoiceMenu, setShowVoiceMenu,
    pendingDelete, setPendingDelete,
    anyOverlay,
  };
}
