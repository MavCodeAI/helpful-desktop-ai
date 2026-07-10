import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { detectIntent, type Intent } from "@/lib/intents";
import { openExternal, isElectron } from "@/lib/electron-bridge";
import { addNoteRaw } from "@/lib/utilities/notes";

export type ActionEntry = Intent & { at: number; opened: boolean };

type Options = {
  confirmBeforeOpen?: boolean;
  onTimer?: (seconds: number, label: string) => void;
};

/**
 * Detects intents in user utterances and either auto-executes them (in-app
 * actions), auto-opens the target URL, or asks for confirmation via a
 * sonner toast. Keeps the last 5 entries for the on-screen list.
 */
export function useIntentActions(opts: Options = {}) {
  const { confirmBeforeOpen = false, onTimer } = opts;
  const [actions, setActions] = useState<ActionEntry[]>([]);
  const [autoOpen, setAutoOpen] = useState(true);
  const autoOpenRef = useRef(true);
  const confirmRef = useRef(confirmBeforeOpen);
  const onTimerRef = useRef(onTimer);
  useEffect(() => { autoOpenRef.current = autoOpen; }, [autoOpen]);
  useEffect(() => { confirmRef.current = confirmBeforeOpen; }, [confirmBeforeOpen]);
  useEffect(() => { onTimerRef.current = onTimer; }, [onTimer]);

  const pushAction = useCallback((intent: Intent, opened: boolean) => {
    setActions((prev) => [{ ...intent, at: Date.now(), opened }, ...prev].slice(0, 5));
  }, []);

  const openUrl = useCallback(async (intent: Intent) => {
    const ok = await openExternal(intent.url);
    if (!ok) {
      toast.error("Popup blocked", {
        description: intent.label,
        action: { label: "Open", onClick: () => window.open(intent.url, "_blank", "noopener,noreferrer") },
      });
    }
    pushAction(intent, ok);
  }, [pushAction]);

  const runInApp = useCallback(async (intent: Intent) => {
    const a = intent.action!;
    switch (a.type) {
      case "timer": {
        onTimerRef.current?.(a.seconds, a.label);
        toast.success(intent.label, { description: "Timer started" });
        pushAction(intent, true);
        break;
      }
      case "note": {
        addNoteRaw(a.text);
        toast.success("Note saved", { description: a.text.slice(0, 80) });
        pushAction(intent, true);
        break;
      }
      case "clipboard-copy": {
        try {
          await navigator.clipboard.writeText(a.text);
          toast.success("Copied to clipboard", { description: a.text.slice(0, 80) });
          pushAction(intent, true);
        } catch {
          toast.error("Clipboard blocked");
          pushAction(intent, false);
        }
        break;
      }
      case "clipboard-read": {
        try {
          const t = await navigator.clipboard.readText();
          toast(t ? `Clipboard: ${t.slice(0, 80)}` : "Clipboard is empty");
          pushAction(intent, true);
        } catch {
          toast.error("Clipboard blocked");
          pushAction(intent, false);
        }
        break;
      }
      case "screenshot": {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          const track = stream.getVideoTracks()[0];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const IC: any = (window as any).ImageCapture;
          if (!IC) throw new Error("ImageCapture unavailable");
          const bmp: ImageBitmap = await new IC(track).grabFrame();
          track.stop();
          const canvas = document.createElement("canvas");
          canvas.width = bmp.width; canvas.height = bmp.height;
          canvas.getContext("2d")!.drawImage(bmp, 0, 0);
          canvas.toBlob((blob) => {
            if (!blob) return;
            const a2 = document.createElement("a");
            a2.href = URL.createObjectURL(blob);
            a2.download = `alpha-${Date.now()}.png`;
            a2.click();
            URL.revokeObjectURL(a2.href);
          }, "image/png");
          toast.success("Screenshot saved");
          pushAction(intent, true);
        } catch {
          toast.error("Screenshot cancelled or unsupported");
          pushAction(intent, false);
        }
        break;
      }
      case "coming-soon": {
        toast(`${a.feature} — coming soon`, {
          description: "Smart Home controls will be added in a future update.",
        });
        pushAction(intent, false);
        break;
      }
    }
  }, [pushAction]);

  const execute = useCallback(async (intent: Intent) => {
    if (intent.action) return runInApp(intent);
    if (!autoOpenRef.current) { pushAction(intent, false); return; }
    if (confirmRef.current && !isElectron()) {
      // Ask before opening
      pushAction(intent, false);
      toast(intent.label, {
        description: intent.url,
        action: { label: "Open", onClick: () => openUrl(intent) },
        cancel: { label: "Cancel", onClick: () => {} },
      });
      return;
    }
    await openUrl(intent);
  }, [openUrl, runInApp, pushAction]);

  const handleUserText = useCallback((text: string) => {
    const intent = detectIntent(text);
    if (!intent) return;
    void execute(intent);
  }, [execute]);

  return { actions, autoOpen, setAutoOpen, handleUserText };
}
