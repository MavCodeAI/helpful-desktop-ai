import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { detectIntent, type Intent } from "@/lib/intents";
import { openExternal, isElectron, readTextFile, writeTextFile } from "@/lib/electron-bridge";
import { addNoteRaw } from "@/lib/utilities/notes";
import { addMemory } from "@/lib/persona";
import { describeScreen, askAI } from "@/lib/ai-vision.functions";

export type ActionEntry = Intent & { at: number; opened: boolean };

type Options = {
  confirmBeforeOpen?: boolean;
  lang?: string;
  onTimer?: (seconds: number, label: string) => void;
  /** Push an assistant message into the chat (used by AI answer & screen vision). */
  onAssistantReply?: (text: string) => void;
  /** Push a user context message (e.g. file contents). */
  onUserContext?: (text: string) => void;
};

async function captureScreenBase64(): Promise<{ b64: string; mime: string } | null> {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  try {
    const track = stream.getVideoTracks()[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const IC: any = (window as any).ImageCapture;
    let bmp: ImageBitmap;
    if (IC) {
      bmp = await new IC(track).grabFrame();
    } else {
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      await new Promise((r) => setTimeout(r, 150));
      bmp = await createImageBitmap(video);
    }
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width; canvas.height = bmp.height;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/png"));
    if (!blob) return null;
    const buf = await blob.arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return { b64: btoa(bin), mime: "image/png" };
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

export function useIntentActions(opts: Options = {}) {
  const { confirmBeforeOpen = false, lang = "auto", onTimer, onAssistantReply, onUserContext } = opts;
  const [actions, setActions] = useState<ActionEntry[]>([]);
  const [autoOpen, setAutoOpen] = useState(true);
  const autoOpenRef = useRef(true);
  const confirmRef = useRef(confirmBeforeOpen);
  const langRef = useRef(lang);
  const onTimerRef = useRef(onTimer);
  const onReplyRef = useRef(onAssistantReply);
  const onCtxRef = useRef(onUserContext);
  useEffect(() => { autoOpenRef.current = autoOpen; }, [autoOpen]);
  useEffect(() => { confirmRef.current = confirmBeforeOpen; }, [confirmBeforeOpen]);
  useEffect(() => { langRef.current = lang; }, [lang]);
  useEffect(() => { onTimerRef.current = onTimer; }, [onTimer]);
  useEffect(() => { onReplyRef.current = onAssistantReply; }, [onAssistantReply]);
  useEffect(() => { onCtxRef.current = onUserContext; }, [onUserContext]);

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
      case "timer":
        onTimerRef.current?.(a.seconds, a.label);
        toast.success(intent.label, { description: "Timer started" });
        pushAction(intent, true);
        break;
      case "note":
        addNoteRaw(a.text);
        toast.success("Note saved", { description: a.text.slice(0, 80) });
        pushAction(intent, true);
        break;
      case "clipboard-copy":
        try {
          await navigator.clipboard.writeText(a.text);
          toast.success("Copied", { description: a.text.slice(0, 80) });
          pushAction(intent, true);
        } catch { toast.error("Clipboard blocked"); pushAction(intent, false); }
        break;
      case "clipboard-read":
        try {
          const t = await navigator.clipboard.readText();
          toast(t ? `Clipboard: ${t.slice(0, 80)}` : "Clipboard is empty");
          pushAction(intent, true);
        } catch { toast.error("Clipboard blocked"); pushAction(intent, false); }
        break;
      case "screenshot":
        try {
          const cap = await captureScreenBase64();
          if (!cap) throw new Error("no blob");
          const link = document.createElement("a");
          link.href = `data:${cap.mime};base64,${cap.b64}`;
          link.download = `alpha-${Date.now()}.png`;
          link.click();
          toast.success("Screenshot saved");
          pushAction(intent, true);
        } catch { toast.error("Screenshot cancelled"); pushAction(intent, false); }
        break;
      case "screen-vision":
        try {
          toast("Analyzing screen…");
          const cap = await captureScreenBase64();
          if (!cap) throw new Error("no capture");
          const { text } = await describeScreen({ data: { imageBase64: cap.b64, mimeType: cap.mime, lang: langRef.current } });
          onReplyRef.current?.(text);
          toast.success("Screen analyzed");
          pushAction(intent, true);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "failed";
          toast.error("Screen vision failed", { description: msg });
          pushAction(intent, false);
        }
        break;
      case "ai-answer":
        try {
          toast("Thinking…");
          const { text } = await askAI({ data: { question: a.question, lang: langRef.current } });
          onReplyRef.current?.(text);
          pushAction(intent, true);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "failed";
          toast.error("AI failed", { description: msg });
          pushAction(intent, false);
        }
        break;
      case "memory-add":
        addMemory(a.text);
        toast.success("Remembered", { description: a.text.slice(0, 80) });
        pushAction(intent, true);
        break;
      case "file-open":
        try {
          const res = await readTextFile();
          if (!res) { pushAction(intent, false); break; }
          onCtxRef.current?.(`(file: ${res.name})\n${res.content.slice(0, 4000)}`);
          toast.success("File loaded", { description: res.name });
          pushAction(intent, true);
        } catch (e) {
          toast.error("File open failed", { description: e instanceof Error ? e.message : "" });
          pushAction(intent, false);
        }
        break;
      case "file-save":
        try {
          const content = window.prompt("Content to save:") || "";
          if (!content) { pushAction(intent, false); break; }
          const ok = await writeTextFile("alpha-note.txt", content);
          if (ok) toast.success("File saved");
          pushAction(intent, ok);
        } catch (e) {
          toast.error("Save failed", { description: e instanceof Error ? e.message : "" });
          pushAction(intent, false);
        }
        break;
      case "coming-soon": {
        const now = Date.now();
        // throttle: only one smart-home toast per 8s to avoid spam
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        if (!w.__alphaCsAt || now - w.__alphaCsAt > 8000) {
          w.__alphaCsAt = now;
          toast(`${a.feature} — ابھی available نہیں`, {
            id: "coming-soon-smart-home",
            description: "Smart Home features آنے والی update میں شامل ہوں گے۔ فی الحال آپ کہہ سکتے ہیں: \"timer 5 minute\", \"note likho\", \"screen dekho\", \"YouTube kholo\"۔",
            duration: 5000,
          });
        }
        pushAction(intent, false);
        break;
      }

    }
  }, [pushAction]);

  const execute = useCallback(async (intent: Intent) => {
    if (intent.action) return runInApp(intent);
    if (!autoOpenRef.current) { pushAction(intent, false); return; }
    if (confirmRef.current && !isElectron()) {
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
