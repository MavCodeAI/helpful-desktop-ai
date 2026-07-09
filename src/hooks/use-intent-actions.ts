import { useCallback, useEffect, useRef, useState } from "react";
import { detectIntent, type Intent } from "@/lib/intents";

export type ActionEntry = Intent & { at: number; opened: boolean };

/**
 * Detects link-intents in user utterances and (optionally) auto-opens the
 * target URL in a new tab. Keeps the last 5 entries for the on-screen list.
 * `autoOpen` is mirrored to a ref so the callback stays referentially stable.
 */
export function useIntentActions() {
  const [actions, setActions] = useState<ActionEntry[]>([]);
  const [autoOpen, setAutoOpen] = useState(true);
  const autoOpenRef = useRef(true);
  useEffect(() => { autoOpenRef.current = autoOpen; }, [autoOpen]);

  const handleUserText = useCallback((text: string) => {
    const intent = detectIntent(text);
    if (!intent) return;
    let opened = false;
    if (autoOpenRef.current) {
      const w = window.open(intent.url, "_blank", "noopener,noreferrer");
      opened = !!w;
    }
    setActions((prev) => [{ ...intent, at: Date.now(), opened }, ...prev].slice(0, 5));
  }, []);

  return { actions, autoOpen, setAutoOpen, handleUserText };
}