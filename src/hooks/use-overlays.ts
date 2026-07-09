import { useMemo, useState } from "react";
import { useOverlayStack } from "@/hooks/use-overlay-stack";
import type { Thread } from "@/lib/chat-history";

/**
 * Bundles all top-level overlay state (history, settings, delete-confirm,
 * gemini-key) plus Escape-priority + any-open reporting. Keeps `index.tsx`
 * free of one-off `useState` toggles.
 */
export function useOverlays() {
  const [showHistory, setShowHistory] = useState(false);
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Thread | null>(null);

  // Order = ascending priority; last-opened swallows Escape first.
  const stack = useMemo(() => [
    { open: showHistory,     close: () => setShowHistory(false) },
    { open: showVoiceMenu,   close: () => setShowVoiceMenu(false) },
    { open: !!pendingDelete, close: () => setPendingDelete(null) },
    { open: showKeyModal,    close: () => setShowKeyModal(false) },
  ], [showHistory, showVoiceMenu, pendingDelete, showKeyModal]);
  const anyOverlay = useOverlayStack(stack);

  return {
    showHistory, setShowHistory,
    showVoiceMenu, setShowVoiceMenu,
    showKeyModal, setShowKeyModal,
    pendingDelete, setPendingDelete,
    anyOverlay,
  };
}