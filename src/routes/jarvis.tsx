/**
 * JARVIS console — the voice-first assistant page.
 *
 * State machine (`phase`):
 *
 *   idle       →  waiting for the user to tap the orb.
 *   listening  →  MediaRecorder is capturing microphone audio.
 *   thinking   →  audio uploaded → STT running, then chat streaming.
 *   speaking   →  TTS audio is playing back through the browser.
 *
 * Transitions are strictly one-way (idle → listening → thinking → speaking
 * → idle) so we never overlap operations. The orb is the single control:
 * a tap starts recording from idle, stops recording while listening, or
 * cancels playback while speaking.
 *
 * Route note: `ssr: false` because everything on this page depends on
 * browser APIs (MediaRecorder, getUserMedia, Audio, localStorage). SSR
 * would just render an empty shell and then rerun on the client anyway.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff, Loader2, LogOut, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLicense, clearLicense } from "@/lib/license";
import { toast } from "sonner";

export const Route = createFileRoute("/jarvis")({
  component: JarvisPage,
  ssr: false,
  head: () => ({
    meta: [
      { title: "JARVIS Console" },
      { name: "description", content: "Voice-first AI assistant." },
    ],
  }),
});

/** A single chat turn in the transcript UI and in the model request. */
type Msg = { role: "user" | "assistant"; content: string };

/** UI/interaction phase — see the file-level state machine comment. */
type Phase = "idle" | "listening" | "thinking" | "speaking";

function JarvisPage() {
  const navigate = useNavigate();

  // Full transcript, kept in memory only (no persistence in this build).
  const [messages, setMessages] = useState<Msg[]>([]);

  // Current phase — drives the orb icon, ring animations, and status text.
  const [phase, setPhase] = useState<Phase>("idle");

  // Live streaming reply while `thinking`. Committed into `messages` when done.
  const [partial, setPartial] = useState("");

  // Active license, shown in the header. `null` briefly before the mount check.
  const [license, setLicense] = useState<string | null>(null);

  // Refs to browser objects that must survive re-renders but don't affect UI.
  const mediaRef = useRef<MediaRecorder | null>(null); // active recorder
  const chunksRef = useRef<Blob[]>([]);                // captured audio chunks
  const audioRef = useRef<HTMLAudioElement | null>(null); // currently-playing TTS
  const streamRef = useRef<MediaStream | null>(null);  // mic stream (for teardown)

  // Gate: bounce back to the license page if no key is stored.
  useEffect(() => {
    const k = getLicense();
    if (!k) {
      navigate({ to: "/" });
      return;
    }
    setLicense(k);
  }, [navigate]);

  /** Sign out: clear license and return to the gate. */
  const signOut = () => {
    clearLicense();
    navigate({ to: "/" });
  };

  /**
   * Play the given text through TTS.
   *
   * Fetches an MP3 from /api/tts, wraps it in an object URL, and plays it
   * via a fresh `Audio` element. When playback ends we release the object
   * URL and return to `idle` so the user can speak again.
   *
   * @param text - The assistant reply to speak.
   */
  const speak = useCallback(async (text: string) => {
    try {
      setPhase("speaking");
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setPhase("idle");
        URL.revokeObjectURL(url); // avoid memory leak
      };
      await audio.play();
    } catch (e) {
      console.error(e);
      setPhase("idle");
      toast.error("Voice playback failed");
    }
  }, []);

  /**
   * Send a user utterance to the chat endpoint and stream back the reply.
   *
   * Appends the user's message immediately (optimistic UI), then reads the
   * SSE stream frame-by-frame, extracting `choices[0].delta.content`. When
   * the stream ends we commit the full reply to `messages` and hand it to
   * `speak()` for TTS playback.
   *
   * @param userText - The transcribed user speech to send to the model.
   */
  const sendToChat = useCallback(
    async (userText: string) => {
      const next: Msg[] = [...messages, { role: "user", content: userText }];
      setMessages(next);
      setPhase("thinking");
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next }),
        });
        if (!res.ok || !res.body) throw new Error(await res.text());

        // Manual SSE reader — enough for OpenAI-style `data: {...}\n\n` frames.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = "";       // accumulated assistant text so far
        let buffer = "";     // partial line carried across chunk boundaries
        setPartial("");

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Split on newlines; the last item may be incomplete → save for next chunk.
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const l = line.trim();
            if (!l.startsWith("data:")) continue;
            const data = l.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                full += delta;
                setPartial(full);
              }
            } catch {
              // Non-JSON keepalive lines etc. — safe to skip.
            }
          }
        }

        // Commit the finished reply and hand off to TTS.
        setPartial("");
        setMessages([...next, { role: "assistant", content: full }]);
        if (full.trim()) await speak(full);
        else setPhase("idle");
      } catch (e) {
        console.error(e);
        toast.error("JARVIS is unavailable");
        setPhase("idle");
      }
    },
    [messages, speak]
  );

  /**
   * Request microphone access and start recording.
   *
   * We pick a MIME type MediaRecorder actually supports (WebM on Chromium/
   * Firefox, MP4 on Safari). When the user taps again to stop, `onstop`
   * fires, we tear down the stream, guard against sub-second empty blobs,
   * upload for transcription, then feed the text into `sendToChat`.
   */
  const startListening = async () => {
    if (phase !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      mediaRef.current = rec;
      chunksRef.current = [];

      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);

      rec.onstop = async () => {
        // Always release the mic ASAP so the browser's recording indicator clears.
        stream.getTracks().forEach((t) => t.stop());

        const blob = new Blob(chunksRef.current, { type: mime });
        // Very short recordings (accidental double-tap) are almost never useful
        // and would waste a gateway call — reject client-side.
        if (blob.size < 1500) {
          toast.error("Recording too short");
          setPhase("idle");
          return;
        }
        setPhase("thinking");
        try {
          const fd = new FormData();
          // File extension must match the recorded container so the STT model
          // decodes correctly (Safari records mp4, others webm).
          const ext = mime.includes("mp4") ? "mp4" : "webm";
          fd.append("file", blob, `recording.${ext}`);
          const res = await fetch("/api/stt", { method: "POST", body: fd });
          if (!res.ok) throw new Error(await res.text());
          const json = await res.json();
          const text = (json.text || "").trim();
          if (!text) {
            toast.error("Didn't catch that");
            setPhase("idle");
            return;
          }
          await sendToChat(text);
        } catch (e) {
          console.error(e);
          toast.error("Transcription failed");
          setPhase("idle");
        }
      };

      rec.start();
      setPhase("listening");
    } catch (e) {
      console.error(e);
      toast.error("Microphone access denied");
    }
  };

  /** Stop the active recording (triggers the recorder's `onstop`). */
  const stopListening = () => {
    if (mediaRef.current && phase === "listening") mediaRef.current.stop();
  };

  /**
   * Single tap handler for the orb.
   *
   * Behaviour depends on the current phase:
   *   - idle       → start recording
   *   - listening  → stop recording (kicks off STT + chat)
   *   - speaking   → cancel playback and return to idle
   *   - thinking   → ignored (nothing safe to cancel mid-stream)
   */
  const handleMicClick = () => {
    if (phase === "listening") stopListening();
    else if (phase === "idle") startListening();
    else if (phase === "speaking" && audioRef.current) {
      audioRef.current.pause();
      setPhase("idle");
    }
  };

  // Wait for the license check to finish before rendering.
  if (!license) return null;

  // Human-readable status shown under the orb + used as the button's aria-label.
  const statusLabel = {
    idle: "Ready. Tap to speak.",
    listening: "Listening…",
    thinking: "Processing…",
    speaking: "Speaking…",
  }[phase];

  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Top bar: brand mark, license, sign-out */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-jarvis/15 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-jarvis animate-pulse" />
          <span className="font-display tracking-[0.3em] text-sm text-jarvis">JARVIS</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-muted-foreground hidden sm:inline">
            {license}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4 mr-1.5" /> Sign out
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 relative">
        {/* Decorative halo — pointer-events: none so it never intercepts clicks. */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-jarvis/10 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-2xl">
          {/* Orb — single primary control */}
          <button
            onClick={handleMicClick}
            className="relative w-48 h-48 rounded-full border-2 border-jarvis/40 flex items-center justify-center jarvis-glow transition-transform hover:scale-105 active:scale-95 cursor-pointer bg-card/40"
            aria-label={statusLabel}
          >
            {/* Expanding rings only while listening, staggered by 0.5s for depth. */}
            {phase === "listening" && (
              <>
                <span className="absolute inset-0 rounded-full border-2 border-jarvis animate-[jarvis-ring_1.5s_ease-out_infinite]" />
                <span className="absolute inset-0 rounded-full border-2 border-jarvis animate-[jarvis-ring_1.5s_ease-out_infinite_0.5s]" />
              </>
            )}
            <div
              className={`w-24 h-24 rounded-full bg-jarvis/80 ${
                phase !== "idle" ? "animate-[jarvis-pulse_1.5s_ease-in-out_infinite]" : ""
              }`}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              {phase === "thinking" ? (
                <Loader2 className="w-10 h-10 text-primary-foreground animate-spin" />
              ) : phase === "speaking" ? (
                <Volume2 className="w-10 h-10 text-primary-foreground" />
              ) : phase === "listening" ? (
                <Mic className="w-10 h-10 text-primary-foreground" />
              ) : (
                <MicOff className="w-10 h-10 text-primary-foreground/70" />
              )}
            </div>
          </button>

          <p className="text-sm uppercase tracking-[0.3em] text-jarvis/80 jarvis-text-glow">
            {statusLabel}
          </p>

          {/* Rolling transcript — user + assistant turns, plus live streaming text. */}
          <div className="w-full space-y-3 max-h-[280px] overflow-y-auto rounded-xl border border-jarvis/15 bg-card/40 backdrop-blur-sm p-4">
            {messages.length === 0 && !partial && (
              <p className="text-center text-sm text-muted-foreground italic">
                Say hello to begin.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-sm ${m.role === "user" ? "text-foreground" : "text-jarvis"}`}
              >
                <span className="text-xs uppercase tracking-widest opacity-60 mr-2">
                  {m.role === "user" ? "You" : "Jarvis"}
                </span>
                {m.content}
              </div>
            ))}
            {/* Live token stream — replaced by a real message once complete. */}
            {partial && (
              <div className="text-sm text-jarvis">
                <span className="text-xs uppercase tracking-widest opacity-60 mr-2">Jarvis</span>
                {partial}
                <span className="inline-block w-2 h-4 bg-jarvis/70 ml-1 align-middle animate-pulse" />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
