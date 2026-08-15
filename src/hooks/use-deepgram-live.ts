import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getDeepgramToken } from "@/lib/deepgram-token.functions";
import type { LangCode } from "@/lib/persona";
import { containsHindiScript, voiceTranscriptError } from "@/lib/voice-providers";

type Status = "idle" | "connecting" | "listening" | "error";

type Opts = {
  lang: LangCode;
  /** Called on every finalized segment — append to composer text. */
  onFinal: (text: string) => void;
  /** Called on interim (partial) — show ghost text; empty string clears. */
  onInterim?: (text: string) => void;
};

/**
 * Live streaming STT via Deepgram Nova-3.
 * - Mints short-lived token from server fn (API key never leaves server).
 * - Opens WS with `token` sub-protocol (browsers can't set Authorization header).
 * - Streams MediaRecorder opus chunks; Deepgram auto-detects container.
 */
export function useDeepgramLive({ lang, onFinal, onInterim }: Opts) {
  const [status, setStatus] = useState<Status>("idle");
  const wsRef = useRef<WebSocket | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blockedHindiRef = useRef(false);

  const stop = useCallback(() => {
    if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; }
    try { recRef.current?.state !== "inactive" && recRef.current?.stop(); } catch { /* noop */ }
    recRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "CloseStream" }));
        }
      } catch { /* noop */ }
      try { wsRef.current.close(); } catch { /* noop */ }
      wsRef.current = null;
    }
    onInterim?.("");
    setStatus("idle");
  }, [onInterim]);

  const start = useCallback(async () => {
    if (status === "listening" || status === "connecting") return;
    blockedHindiRef.current = false;
    setStatus("connecting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      toast.error("Microphone access denied.");
      setStatus("error");
      return;
    }
    streamRef.current = stream;

    let token: string;
    try {
      const res = await getDeepgramToken();
      token = res.token;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to get Deepgram token.");
      stream.getTracks().forEach((t) => t.stop());
      setStatus("error");
      return;
    }

    // Only Urdu and English are supported. Explicit locale prevents Urdu from
    // falling back to a Hindi/Devanagari transcription model.
    const language = lang === "ur" ? "ur" : "en";
    const params = new URLSearchParams({
      model: "nova-3",
      language,
      interim_results: "true",
      smart_format: "true",
      punctuate: "true",
      endpointing: "300",
    });
    const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;

    // Browsers can't set Authorization on WS — Deepgram accepts token via Sec-WebSocket-Protocol.
    const ws = new WebSocket(url, ["token", token]);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("listening");
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data);
      };
      rec.start(250);
      // Keep alive — Deepgram closes idle sockets.
      keepAliveRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "KeepAlive" }));
      }, 8000);
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data as string);
        const transcript: string = msg?.channel?.alternatives?.[0]?.transcript ?? "";
        if (!transcript) return;
        if (containsHindiScript(transcript)) {
          onInterim?.("");
          if (!blockedHindiRef.current) {
            blockedHindiRef.current = true;
            toast.error(voiceTranscriptError(lang));
          }
          return;
        }
        if (msg.is_final) { onFinal(transcript); onInterim?.(""); }
        else onInterim?.(transcript);
      } catch { /* noop */ }
    };

    ws.onerror = () => { toast.error("Live STT connection error."); };
    ws.onclose = () => { if (status !== "idle") stop(); };
  }, [lang, onFinal, onInterim, status, stop]);

  useEffect(() => () => stop(), [stop]);

  return { status, start, stop, toggle: () => (status === "idle" || status === "error" ? start() : stop()) };
}
