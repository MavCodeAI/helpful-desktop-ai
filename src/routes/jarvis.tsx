/**
 * JARVIS console — voice-first assistant page.
 *
 * Features:
 *  - Threaded chat history (localStorage-backed) with sidebar viewer.
 *  - TTS settings: voice, speed, volume — persisted per browser.
 *  - Voice controls:
 *      * Recording: start / pause / resume / stop.
 *      * Playback : pause / resume / restart / stop.
 *
 * Phase state machine:
 *   idle → listening → thinking → speaking → idle
 * `listening` may transiently be paused (MediaRecorder.pause) while phase
 * stays "listening" — tracked in `recPaused`. Same for `playPaused` in
 * "speaking".
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic,
  MicOff,
  Loader2,
  LogOut,
  Volume2,
  Pause,
  Play,
  Square,
  RotateCcw,
  Settings,
  History,
  Plus,
  Trash2,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getLicense, clearLicense } from "@/lib/license";
import {
  loadTTSSettings,
  saveTTSSettings,
  VOICE_OPTIONS,
  type TTSSettings,
  type TTSVoice,
} from "@/lib/tts-settings";
import {
  loadThreads,
  upsertThread,
  deleteThread,
  createThread,
  deriveTitle,
  type Thread,
  type ChatMsg,
} from "@/lib/chat-history";
import { HologramSafe } from "@/components/HologramSafe";
import { useMicLevel } from "@/hooks/useMicLevel";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Respect the OS reduced-motion setting — kills orb/wave/ring animations. */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Best-effort haptic feedback; silently no-ops where unsupported. */
function haptic(ms = 10) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}

/**
 * Convert a failed fetch (thrown Error / non-ok Response text) into a
 * user-facing reason. Gateway returns 429 (rate limit) and 402 (credits
 * exhausted) verbatim; network drops surface as TypeError.
 */
function friendlyError(e: unknown, fallback: string): string {
  const err = e as { message?: string; name?: string };
  const msg = (err?.message || "").toLowerCase();
  if (!navigator.onLine) return "You're offline — check your connection.";
  if (err?.name === "TypeError" || msg.includes("failed to fetch")) return "Network error — please retry.";
  if (msg.includes("429") || msg.includes("rate")) return "Rate limit reached — slow down and retry.";
  if (msg.includes("402") || msg.includes("credit")) return "AI credits exhausted — top up in your workspace.";
  if (msg.includes("401") || msg.includes("unauthorized")) return "Session expired — please sign in again.";
  return fallback;
}

/** Cycle short verbs during the "thinking" phase so it feels alive. */
const THINKING_STAGES = ["Reading", "Analyzing", "Composing", "Refining"] as const;


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

type Phase = "idle" | "listening" | "thinking" | "speaking";

/**
 * Audio-reactive vertical bars.
 *  - `smoothLevel` ref lerps toward the incoming `level` each frame → no jitter.
 *  - Per-bar heights are eased (lerp) toward their target → buttery motion.
 *  - Gradient stops shift from cool cyan (quiet) to hot white-cyan (loud) so
 *    the color itself communicates intensity.
 * Renders as SVG for crisp scaling and cheap per-frame updates.
 */
function WaveBars({
  level,
  active,
  mode,
}: {
  level: number;
  active: boolean;
  mode: "listening" | "speaking";
}) {
  const BARS = 7;
  const gradId = `wavebar-grad-${mode}`;
  const heightsRef = useRef<number[]>(Array(BARS).fill(0.15));
  const smoothLevelRef = useRef(0);
  const [, force] = useState(0);
  const phaseRef = useRef(0);
  const reduced = useReducedMotion();

  // Per-mode motion + palette profiles.
  //  listening → snappy follow (mic input is the truth, react fast).
  //  speaking  → slower, floatier easing (TTS is smooth, feel calm/warm).
  const profile =
    mode === "speaking"
      ? {
          levelLerp: 0.09,        // slower level tracking
          barLerp: 0.18,          // gentler bar easing
          phaseStep: 0.07,        // slower wobble
          barSpread: 0.75,        // wider wobble range → floatier
          // Warm violet → magenta → amber gradient
          top: (i: number) => `oklch(${0.82 + i * 0.12} ${0.16 + i * 0.04} ${300 - i * 20})`,
          mid: (i: number) => `oklch(${0.72 + i * 0.1} 0.2 ${325 - i * 10})`,
          bot: (i: number) => `oklch(${0.6 + i * 0.12} 0.2 ${350 - i * 5})`,
        }
      : {
          levelLerp: 0.28,        // fast, reactive to voice
          barLerp: 0.42,          // crisper bar snap
          phaseStep: 0.13,        // livelier wobble
          barSpread: 0.5,
          // Cool cyan → electric blue gradient (existing JARVIS palette)
          top: (i: number) => `oklch(${0.78 + i * 0.17} ${0.16 - i * 0.06} ${215 - i * 15})`,
          mid: (i: number) => `oklch(${0.7 + i * 0.15} 0.17 210)`,
          bot: (i: number) => `oklch(${0.55 + i * 0.15} 0.18 220)`,
        };

  useEffect(() => {
    if (!active || reduced) {
      // reduced-motion: freeze bars at a calm mid-height, skip the RAF loop.
      smoothLevelRef.current = reduced ? 0.4 : 0;
      heightsRef.current = heightsRef.current.map(() => (reduced ? 0.4 : 0.15));
      force((n) => n + 1);
      return;
    }
    let raf = 0;
    const loop = () => {
      phaseRef.current += profile.phaseStep;
      const target = Math.min(1, Math.max(0, level));
      smoothLevelRef.current += (target - smoothLevelRef.current) * profile.levelLerp;

      const base = 0.18 + smoothLevelRef.current * 0.82;
      const next = heightsRef.current.map((h, i) => {
        const wobble = (Math.sin(phaseRef.current + i * 0.85) + 1) / 2;
        const desired = Math.max(
          0.08,
          base * (1 - profile.barSpread / 2 + wobble * profile.barSpread),
        );
        return h + (desired - h) * profile.barLerp;
      });
      heightsRef.current = next;
      force((n) => (n + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, level, reduced, profile.phaseStep, profile.levelLerp, profile.barLerp, profile.barSpread]);

  const intensity = smoothLevelRef.current;
  const topStop = profile.top(intensity);
  const midStop = profile.mid(intensity);
  const botStop = profile.bot(intensity);

  return (
    <svg viewBox="0 0 84 60" className="w-20 h-14" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={topStop} />
          <stop offset="50%" stopColor={midStop} />
          <stop offset="100%" stopColor={botStop} />
        </linearGradient>
      </defs>
      {heightsRef.current.map((hNorm, i) => {
        const h = Math.max(4, hNorm * 56);
        const y = (60 - h) / 2;
        return (
          <rect
            key={i}
            x={i * 12 + 2}
            y={y}
            width={8}
            height={h}
            rx={4}
            fill={`url(#${gradId})`}
            style={{
              filter: `drop-shadow(0 0 ${4 + intensity * 10}px var(--jarvis-glow))`,
              transition: "filter 220ms ease-out",
            }}
          />
        );
      })}
    </svg>
  );
}

function JarvisPage() {
  const navigate = useNavigate();

  // --- License gate ---
  const [license, setLicense] = useState<string | null>(null);

  // --- Threads / history ---
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);

  // --- Chat phase + streaming ---
  const [phase, setPhase] = useState<Phase>("idle");
  const [partial, setPartial] = useState("");

  // --- Voice control sub-states ---
  const [recPaused, setRecPaused] = useState(false);
  const [playPaused, setPlayPaused] = useState(false);

  // --- TTS settings ---
  const [tts, setTts] = useState<TTSSettings>(loadTTSSettings);
  const lastSpokenRef = useRef<string>(""); // for "restart playback"

  // --- Browser API refs ---
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll transcript to bottom as new tokens stream in
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [partial, messages]);


  /* ---------- bootstrap ---------- */

  useEffect(() => {
    const k = getLicense();
    if (!k) {
      navigate({ to: "/" });
      return;
    }
    setLicense(k);

    // Load threads; create the first one if empty.
    const existing = loadThreads();
    if (existing.length === 0) {
      const t = createThread();
      const list = upsertThread(t);
      setThreads(list);
      setActiveId(t.id);
      setMessages([]);
    } else {
      setThreads(existing);
      setActiveId(existing[0].id);
      setMessages(existing[0].messages);
    }
  }, [navigate]);

  /** Persist current messages into the active thread whenever they change. */
  useEffect(() => {
    if (!activeId) return;
    const current = threads.find((t) => t.id === activeId);
    // Skip write when the active thread is empty and messages are empty too.
    if (!current && messages.length === 0) return;
    const updated: Thread = {
      id: activeId,
      title: deriveTitle(messages) || current?.title || "New conversation",
      updatedAt: Date.now(),
      messages,
    };
    const list = upsertThread(updated);
    setThreads(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  /* ---------- TTS settings ---------- */

  const updateTts = (patch: Partial<TTSSettings>) => {
    const next = { ...tts, ...patch };
    setTts(next);
    saveTTSSettings(next);
    // Live-apply volume to any in-flight playback.
    if (audioRef.current && patch.volume !== undefined) {
      audioRef.current.volume = patch.volume;
    }
  };

  /* ---------- Speak (TTS) ---------- */

  /**
   * Fetch TTS audio for `text` and play it. Stores the text in
   * `lastSpokenRef` so the "restart" button can replay it.
   */
  const speak = useCallback(
    async (text: string) => {
      try {
        setPhase("speaking");
        setPlayPaused(false);
        lastSpokenRef.current = text;

        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: tts.voice, speed: tts.speed }),
        });
        if (!res.ok) throw new Error(await res.text());
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        // Release any previous URL before overwriting.
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = url;

        const audio = new Audio(url);
        audio.volume = tts.volume;
        audioRef.current = audio;
        audio.onended = () => {
          setPhase("idle");
          setPlayPaused(false);
        };
        await audio.play();
      } catch (e) {
        console.error(e);
        setPhase("idle");
        toast.error("Voice playback failed");
      }
    },
    [tts]
  );

  /* ---------- Chat (LLM streaming) ---------- */

  const sendToChat = useCallback(
    async (userText: string) => {
      const next: ChatMsg[] = [...messages, { role: "user", content: userText }];
      setMessages(next);
      setPhase("thinking");
      const controller = new AbortController();
      abortRef.current = controller;
      let full = "";
      let aborted = false;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error(await res.text());

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        setPartial("");

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
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
              /* skip keepalives */
            }
          }
        }

        setPartial("");
        const finalText = full.trim() ? full : "";
        setMessages([...next, { role: "assistant", content: finalText + (aborted ? " _(stopped)_" : "") }]);
        if (finalText && !aborted) await speak(finalText);
        else setPhase("idle");
      } catch (e: unknown) {
        if ((e as { name?: string })?.name === "AbortError") {
          aborted = true;
          setPartial("");
          setMessages([
            ...next,
            { role: "assistant", content: (full.trim() || "_(no response)_") + " _(stopped)_" },
          ]);
          setPhase("idle");
          return;
        }
        console.error(e);
        toast.error("JARVIS is unavailable");
        setPhase("idle");
      } finally {
        abortRef.current = null;
      }
    },
    [messages, speak]
  );

  /** Cancel an in-flight LLM stream; keeps whatever tokens already arrived. */
  const stopGenerating = () => {
    abortRef.current?.abort();
  };

  /* ---------- Recording controls ---------- */

  const startListening = async () => {
    if (phase !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      mediaRef.current = rec;
      chunksRef.current = [];
      setRecPaused(false);

      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);

      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 1500) {
          toast.error("Recording too short");
          setPhase("idle");
          return;
        }
        setPhase("thinking");
        try {
          const fd = new FormData();
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

  /** Pause the active recording without finishing it. */
  const pauseRecording = () => {
    if (mediaRef.current && phase === "listening" && !recPaused) {
      mediaRef.current.pause();
      setRecPaused(true);
    }
  };

  /** Resume a paused recording. */
  const resumeRecording = () => {
    if (mediaRef.current && phase === "listening" && recPaused) {
      mediaRef.current.resume();
      setRecPaused(false);
    }
  };

  /** Finish recording → triggers STT + chat. */
  const stopListening = () => {
    if (mediaRef.current && phase === "listening") mediaRef.current.stop();
  };

  /** Cancel recording entirely (throw away audio, return to idle). */
  const cancelRecording = () => {
    if (mediaRef.current && phase === "listening") {
      chunksRef.current = [];
      // Replace onstop with a no-op teardown to skip STT.
      mediaRef.current.onstop = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setPhase("idle");
        setRecPaused(false);
      };
      mediaRef.current.stop();
    }
  };

  /* ---------- Playback controls ---------- */

  const pausePlayback = () => {
    if (audioRef.current && phase === "speaking" && !playPaused) {
      audioRef.current.pause();
      setPlayPaused(true);
    }
  };
  const resumePlayback = () => {
    if (audioRef.current && phase === "speaking" && playPaused) {
      audioRef.current.play().catch(() => {});
      setPlayPaused(false);
    }
  };
  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPhase("idle");
    setPlayPaused(false);
  };
  /** Restart from beginning; if no audio loaded, re-request TTS. */
  const restartPlayback = async () => {
    if (audioRef.current && phase === "speaking") {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      setPlayPaused(false);
      return;
    }
    if (lastSpokenRef.current) await speak(lastSpokenRef.current);
  };

  /* ---------- Orb tap dispatch ---------- */

  const handleMicClick = () => {
    if (phase === "listening") stopListening();
    else if (phase === "idle") startListening();
    else if (phase === "speaking") stopPlayback();
  };

  /* ---------- Thread actions ---------- */

  const newConversation = () => {
    // Cancel anything in progress.
    if (phase === "listening") cancelRecording();
    if (phase === "speaking") stopPlayback();
    const t = createThread();
    const list = upsertThread(t);
    setThreads(list);
    setActiveId(t.id);
    setMessages([]);
    setPartial("");
  };

  const openThread = (id: string) => {
    if (phase === "listening") cancelRecording();
    if (phase === "speaking") stopPlayback();
    const t = threads.find((x) => x.id === id);
    if (!t) return;
    setActiveId(id);
    setMessages(t.messages);
    setPartial("");
  };

  const removeThread = (id: string) => {
    const list = deleteThread(id);
    if (list.length === 0) {
      const t = createThread();
      const seeded = upsertThread(t);
      setThreads(seeded);
      setActiveId(t.id);
      setMessages([]);
    } else {
      setThreads(list);
      if (id === activeId) {
        setActiveId(list[0].id);
        setMessages(list[0].messages);
      }
    }
  };

  const signOut = () => {
    clearLicense();
    navigate({ to: "/" });
  };

  // Live mic amplitude → volumetric orb density.
  // Passive analyser runs while page is mounted; the recording MediaRecorder
  // uses its own independent stream, so both can coexist.
  const micLevel = useMicLevel(!!license);

  if (!license) return null;

  const statusLabel = {
    idle: "Ready. Tap to speak.",
    listening: recPaused ? "Paused" : "Listening…",
    thinking: partial ? "Responding…" : "Thinking…",
    speaking: playPaused ? "Paused" : "Speaking…",
  }[phase];

  return (
    <main className="min-h-dvh flex flex-col relative overflow-hidden">
      {/* Orb is rendered inside the mic cluster (below) so it always hugs the button. */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-jarvis/15 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-jarvis animate-pulse" />
          <span className="font-display tracking-[0.3em] text-sm text-jarvis">JARVIS</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {/* History drawer */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Conversation history" className="text-muted-foreground hover:text-foreground min-h-11 min-w-11 sm:min-h-9 sm:min-w-0 px-2 sm:px-3">
                <History className="w-4 h-4 sm:mr-1.5" /> <span className="hidden sm:inline">History</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] sm:w-[320px] flex flex-col">

              <SheetHeader>
                <SheetTitle className="font-display tracking-widest text-jarvis">Conversations</SheetTitle>
              </SheetHeader>
              <Button onClick={newConversation} className="mt-4" variant="outline">
                <Plus className="w-4 h-4 mr-1.5" /> New conversation
              </Button>
              <div className="mt-4 flex-1 overflow-y-auto space-y-2">
                {threads.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">No conversations yet.</p>
                )}
                {threads.map((t) => (
                  <div
                    key={t.id}
                    className={`group flex items-center gap-2 rounded-lg border p-2.5 transition-colors ${
                      t.id === activeId
                        ? "border-jarvis/50 bg-jarvis/10"
                        : "border-border/50 hover:border-jarvis/30"
                    }`}
                  >
                    <button
                      onClick={() => openThread(t.id)}
                      className="flex-1 text-left"
                    >
                      <div className="text-sm truncate">{t.title}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(t.updatedAt).toLocaleString()} · {t.messages.length} msgs
                      </div>
                    </button>
                    <button
                      onClick={() => removeThread(t.id)}
                      className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>

          {/* TTS settings drawer */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Voice settings" className="text-muted-foreground hover:text-foreground min-h-11 min-w-11 sm:min-h-9 sm:min-w-0 px-2 sm:px-3">
                <Settings className="w-4 h-4 sm:mr-1.5" /> <span className="hidden sm:inline">Voice</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] sm:w-[340px]">

              <SheetHeader>
                <SheetTitle className="font-display tracking-widest text-jarvis">Voice Settings</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">
                    Voice
                  </label>
                  <Select
                    value={tts.voice}
                    onValueChange={(v) => updateTts({ voice: v as TTSVoice })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICE_OPTIONS.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-xs uppercase tracking-widest text-muted-foreground">
                      Speed
                    </label>
                    <span className="text-xs text-jarvis font-mono">{tts.speed.toFixed(2)}×</span>
                  </div>
                  <Slider
                    min={0.5}
                    max={2}
                    step={0.05}
                    value={[tts.speed]}
                    onValueChange={([v]) => updateTts({ speed: v })}
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-xs uppercase tracking-widest text-muted-foreground">
                      Volume
                    </label>
                    <span className="text-xs text-jarvis font-mono">
                      {Math.round(tts.volume * 100)}%
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={1}
                    step={0.05}
                    value={[tts.volume]}
                    onValueChange={([v]) => updateTts({ volume: v })}
                  />
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => speak("Systems online. All voice parameters updated.")}
                >
                  <Volume2 className="w-4 h-4 mr-1.5" /> Test voice
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <span className="text-xs font-mono text-muted-foreground hidden md:inline">
            {license}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            aria-label="Sign out"
            className="text-muted-foreground hover:text-foreground min-h-11 min-w-11 sm:min-h-9 sm:min-w-0 px-2 sm:px-3"
          >
            <LogOut className="w-4 h-4 sm:mr-1.5" /> <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-between px-4 sm:px-6 pt-8 pb-6 relative gap-6">
        <h1 className="sr-only">JARVIS Voice Assistant</h1>

        {/* Top zone — orb wraps the mic button so they read as one unit */}
        <div className="relative z-10 flex flex-col items-center gap-5 mt-6 sm:mt-16">
          {/* Orb sits behind the button, matching its center */}
          <div className="relative flex items-center justify-center">
            <div
              className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none w-[280px] h-[280px] sm:w-[420px] sm:h-[420px] transition-opacity duration-500 ${
                phase === "idle" ? "opacity-50" : phase === "speaking" ? "opacity-95" : "opacity-80"
              }`}
              aria-hidden="true"
            >
              <HologramSafe level={micLevel} />
            </div>
          <button
            onClick={handleMicClick}
            className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full border-2 border-jarvis/50 bg-background/70 backdrop-blur-md jarvis-glow flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jarvis focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={statusLabel}
          >
            {phase === "listening" && !recPaused && (
              <>
                <span className="absolute inset-0 rounded-full border-2 border-jarvis animate-[jarvis-ring_1.5s_ease-out_infinite]" />
                <span className="absolute inset-0 rounded-full border-2 border-jarvis animate-[jarvis-ring_1.5s_ease-out_infinite_0.5s]" />
              </>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              {phase === "thinking" ? (
                <Loader2 className="w-12 h-12 text-jarvis animate-spin" />
              ) : phase === "speaking" || (phase === "listening" && !recPaused) ? (
                <WaveBars level={micLevel} active={phase === "speaking" || !recPaused} mode={phase === "speaking" ? "speaking" : "listening"} />
              ) : (
                <Mic className="w-11 h-11 text-jarvis drop-shadow-[0_0_12px_var(--jarvis-glow)]" />
              )}
            </div>
          </button>
          </div>



          {/* Status pill — solid background so text is readable over orb */}
          <div
            className="px-4 py-1.5 rounded-full bg-background/80 backdrop-blur-sm border border-jarvis/25"
            role="status"
            aria-live="polite"
          >
            <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-jarvis">
              {statusLabel}
            </p>
          </div>
        </div>

        {/* Middle zone — control clusters */}
        <div className="relative z-10 flex flex-col items-center gap-3 min-h-[40px]">
          {phase === "listening" && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {recPaused ? (
                <Button variant="outline" size="sm" onClick={resumeRecording}>
                  <Play className="w-4 h-4 mr-1.5" /> Resume
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={pauseRecording}>
                  <Pause className="w-4 h-4 mr-1.5" /> Pause
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={stopListening}>
                <Square className="w-4 h-4 mr-1.5" /> Send
              </Button>
              <Button variant="ghost" size="sm" onClick={cancelRecording}>
                Cancel
              </Button>
            </div>
          )}

          {phase === "speaking" && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {playPaused ? (
                <Button variant="outline" size="sm" onClick={resumePlayback}>
                  <Play className="w-4 h-4 mr-1.5" /> Resume
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={pausePlayback}>
                  <Pause className="w-4 h-4 mr-1.5" /> Pause
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={restartPlayback}>
                <RotateCcw className="w-4 h-4 mr-1.5" /> Restart
              </Button>
              <Button variant="outline" size="sm" onClick={stopPlayback}>
                <Square className="w-4 h-4 mr-1.5" /> Stop
              </Button>
            </div>
          )}

          {phase === "thinking" && (
            <Button variant="outline" size="sm" onClick={stopGenerating}>
              <Square className="w-4 h-4 mr-1.5" /> Stop generating
            </Button>
          )}

          {phase === "idle" && lastSpokenRef.current && (
            <Button variant="ghost" size="sm" onClick={restartPlayback}>
              <RotateCcw className="w-4 h-4 mr-1.5" /> Replay last reply
            </Button>
          )}
        </div>

        {/* Bottom zone — transcript pinned to the bottom, auto-scrolls as tokens stream in */}
        <div
          ref={transcriptRef}
          className="relative z-10 w-full max-w-2xl space-y-4 max-h-[280px] overflow-y-auto rounded-xl border border-jarvis/20 bg-background/70 backdrop-blur-md p-4 scroll-smooth"
        >
          {messages.length === 0 && !partial && (
            <p className="text-center text-sm text-muted-foreground italic">
              Say hello to begin — tap the mic and speak.
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className="text-sm">
              <span className="block text-[10px] uppercase tracking-widest opacity-60 mb-1">
                {m.role === "user" ? "You" : "Jarvis"}
              </span>
              <div
                className={`leading-relaxed space-y-2 [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-md [&_pre]:overflow-x-auto [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline [&_a]:text-jarvis [&_p]:my-1 [&_strong]:text-foreground ${
                  m.role === "user" ? "text-foreground" : "text-jarvis/90"
                }`}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          {partial && (
            <div className="text-sm">
              <span className="block text-[10px] uppercase tracking-widest opacity-60 mb-1">
                Jarvis
              </span>
              <div className="leading-relaxed space-y-2 [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-md [&_pre]:overflow-x-auto [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline [&_a]:text-jarvis [&_p]:my-1 [&_strong]:text-foreground text-jarvis/90">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{partial}</ReactMarkdown>
                <span className="inline-block w-2 h-4 bg-jarvis/70 ml-1 align-middle animate-pulse" />
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
