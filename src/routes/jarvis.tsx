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
  SendHorizontal,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
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
  const [composerText, setComposerText] = useState("");

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
  const micButtonRef = useRef<HTMLButtonElement | null>(null);
  const phaseRef2 = useRef<Phase>("idle");
  const spaceHeldRef = useRef(false);
  const [scrolledUp, setScrolledUp] = useState(false);
  const [thinkStageIdx, setThinkStageIdx] = useState(0);
  const [lastFailed, setLastFailed] = useState<string | null>(null);
  const reduced = useReducedMotion();

  // Keep phaseRef2 in sync so global keyboard handlers can read latest phase.
  useEffect(() => {
    phaseRef2.current = phase;
  }, [phase]);


  // Auto-scroll transcript ONLY when the user hasn't scrolled up to read history.
  useEffect(() => {
    const el = transcriptRef.current;
    if (!el || scrolledUp) return;
    el.scrollTop = el.scrollHeight;
  }, [partial, messages, scrolledUp]);

  // Track whether the user has scrolled up; if so, show a "scroll to bottom" pill.
  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setScrolledUp(distance > 60);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Cycle "Reading → Analyzing → Composing" while thinking (before first token).
  useEffect(() => {
    if (phase !== "thinking" || partial) {
      setThinkStageIdx(0);
      return;
    }
    const id = setInterval(() => setThinkStageIdx((i) => (i + 1) % THINKING_STAGES.length), 900);
    return () => clearInterval(id);
  }, [phase, partial]);


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

  /**
   * Push-to-talk: hold Space to start listening, release to send.
   * Ignored while the user is typing in an input/textarea/contenteditable,
   * during auto-repeat, or when any modifier is held (Cmd/Ctrl/Alt/Meta).
   */
  useEffect(() => {
    const isEditable = (el: EventTarget | null) => {
      const t = el as HTMLElement | null;
      if (!t) return false;
      const tag = t.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable;
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (isEditable(e.target)) return;
      if (phaseRef2.current !== "idle") return;
      e.preventDefault();
      spaceHeldRef.current = true;
      startListening();
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (!spaceHeldRef.current) return;
      spaceHeldRef.current = false;
      if (isEditable(e.target)) return;
      e.preventDefault();
      if (phaseRef2.current === "listening") stopListening();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  /* ---------- TTS settings ---------- */

  const updateTts = (patch: Partial<TTSSettings>) => {
    const next = { ...tts, ...patch };
    setTts(next);
    saveTTSSettings(next);
    if (audioRef.current && patch.volume !== undefined) {
      audioRef.current.volume = patch.volume;
    }
    // Persistence confirmation — subtle, single-line so it doesn't fight sliders.
    const label =
      patch.voice !== undefined ? `Voice: ${patch.voice}`
      : patch.speed !== undefined ? `Speed: ${patch.speed.toFixed(2)}×`
      : patch.volume !== undefined ? `Volume: ${Math.round(patch.volume * 100)}%`
      : "Settings saved";
    toast.success("Saved", { description: label, duration: 1400 });
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
          haptic(8);
          toast.success("Ready for your next message", { duration: 1500 });
        };
        await audio.play();
      } catch (e) {
        console.error(e);
        setPhase("idle");
        toast.error(friendlyError(e, "Voice playback failed"));
      }
    },
    [tts]
  );

  /* ---------- Chat (LLM streaming) ---------- */

  const sendToChat = useCallback(
    async (userText: string) => {
      const next: ChatMsg[] = [...messages, { role: "user", content: userText }];
      setMessages(next);
      setLastFailed(null);
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
        if (!res.ok || !res.body) {
          const body = await res.text().catch(() => "");
          throw new Error(`${res.status} ${body}`);
        }

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
        const reason = friendlyError(e, "JARVIS is unavailable");
        toast.error(reason);
        // Roll back the optimistic user message so retry doesn't duplicate it.
        setMessages(messages);
        setLastFailed(userText);
        setPhase("idle");
      } finally {
        abortRef.current = null;
        // Return focus to the mic so keyboard users can immediately talk again.
        setTimeout(() => micButtonRef.current?.focus(), 0);
      }
    },
    [messages, speak]
  );

  /** Cancel an in-flight LLM stream; keeps whatever tokens already arrived. */
  const stopGenerating = () => {
    abortRef.current?.abort();
  };

  /** Send a typed message via the text composer. */
  const handleTextSend = () => {
    const text = composerText.trim();
    if (!text || phase !== "idle") return;
    setComposerText("");
    haptic(8);
    void sendToChat(text);
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
          toast.error(friendlyError(e, "Transcription failed"));
          setPhase("idle");
        }
      };

      rec.start();
      setPhase("listening");
    } catch (e) {
      console.error(e);
      toast.error("Microphone access denied — enable it in browser settings.");
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
    haptic(12);
    if (phase === "listening") {
      stopListening();
    } else if (phase === "idle") {
      startListening();
    } else if (phase === "speaking") {
      // Barge-in: stop TTS AND immediately start listening — feels seamless.
      stopPlayback();
      toast("Interrupted — I'm listening", { duration: 1500 });
      // stopPlayback flips phase to idle synchronously → startListening's guard passes.
      // Use a microtask so state settles first.
      queueMicrotask(() => startListening());
    } else if (phase === "thinking") {
      stopGenerating();
    }
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

  const stagedThinkingLabel = `${THINKING_STAGES[thinkStageIdx]}…`;
  const statusLabel = {
    idle: "Ready. Tap to speak.",
    listening: recPaused ? "Paused" : "Listening…",
    thinking: partial ? "Responding…" : stagedThinkingLabel,
    speaking: playPaused ? "Paused" : "Speaking…",
  }[phase];

  return (
    <main className="min-h-dvh flex flex-col relative overflow-hidden">
      {/* Orb is rendered inside the mic cluster (below) so it always hugs the button. */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-jarvis/15 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-jarvis motion-safe:animate-pulse" />
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

          {/* Account menu — replaces the raw license chip with a proper avatar dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                aria-label="Account menu"
                className="min-h-11 min-w-11 rounded-full p-0 hover:bg-jarvis/10"
              >
                <Avatar className="h-9 w-9 border border-jarvis/40">
                  <AvatarFallback className="bg-jarvis/15 text-jarvis text-xs font-mono tracking-wider">
                    {(license?.slice(0, 2) || "JV").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Licensed as
                <div className="mt-1 font-mono text-foreground truncate">{license}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-between px-4 sm:px-6 pt-8 pb-6 [@media(max-height:640px)]:pt-2 [@media(max-height:640px)]:pb-2 [@media(max-height:640px)]:gap-2 relative gap-6">
        <h1 className="sr-only">JARVIS Voice Assistant</h1>

        {/* Top zone — orb wraps the mic button. On short/landscape screens (< 640px tall)
            the orb + mic shrink so all three zones stay on one screen. */}
        <div className="relative z-10 flex flex-col items-center gap-3 sm:gap-5 mt-2 sm:mt-16 [@media(max-height:640px)]:mt-0 [@media(max-height:640px)]:gap-2">
          <div className="relative flex items-center justify-center w-[240px] h-[240px] sm:w-[420px] sm:h-[420px] [@media(max-height:640px)]:w-[120px] [@media(max-height:640px)]:h-[120px] [@media(max-height:480px)]:hidden">
            <div
              className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
                phase === "idle" ? "opacity-50" : phase === "speaking" ? "opacity-95" : "opacity-80"
              } ${reduced ? "opacity-30" : ""}`}
              aria-hidden="true"
            >
              <HologramSafe level={reduced ? 0 : micLevel} />
            </div>
          </div>




          {/* SR-only status for assistive tech (visible pill removed) */}
          <p className="sr-only" role="status" aria-live="polite">
            {statusLabel}
          </p>

        </div>

        {/* Middle zone — only idle-state replay affordance now; active controls live above the composer. */}
        <div className="relative z-10 flex flex-col items-center gap-3 min-h-[40px]">
          {phase === "idle" && lastSpokenRef.current && (
            <Button variant="ghost" size="sm" onClick={restartPlayback}>
              <RotateCcw className="w-4 h-4 mr-1.5" /> Replay last reply
            </Button>
          )}
        </div>


        {/* Bottom zone — transcript + unified composer row (mic + textarea + send/stop). */}
        <div className="relative z-10 w-full max-w-2xl flex flex-col items-center gap-3">
          <div className="relative w-full">

          <div
            ref={transcriptRef}
            className="w-full space-y-4 max-h-[280px] sm:max-h-[340px] [@media(max-height:640px)]:max-h-[140px] overflow-y-auto rounded-xl border border-jarvis/20 bg-background/70 backdrop-blur-md p-4 scroll-smooth"
          >
            {messages.length === 0 && !partial && !lastFailed && (
              <p className="text-center text-sm text-muted-foreground italic">
                Say hello to begin — tap the mic, type a message, or hold Space to talk.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                <span className="text-[10px] uppercase tracking-widest opacity-60 mb-1 px-1">
                  {m.role === "user" ? "You" : "Jarvis"}
                </span>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed space-y-2 [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-md [&_pre]:overflow-x-auto [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline [&_a]:text-jarvis [&_p]:my-1 [&_strong]:text-foreground ${
                    m.role === "user"
                      ? "bg-jarvis/10 border border-jarvis/20 text-foreground rounded-tr-sm"
                      : "bg-transparent text-jarvis/90 rounded-tl-sm"
                  }`}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            {partial && (
              <div className="flex flex-col items-start">
                <span className="text-[10px] uppercase tracking-widest opacity-60 mb-1 px-1">
                  Jarvis
                </span>
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed space-y-2 [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-md [&_pre]:overflow-x-auto [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline [&_a]:text-jarvis [&_p]:my-1 [&_strong]:text-foreground text-jarvis/90">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{partial}</ReactMarkdown>
                  <span className="inline-block w-2 h-4 bg-jarvis/70 ml-1 align-middle motion-safe:animate-pulse" />
                </div>
              </div>
            )}
            {lastFailed && phase === "idle" && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs">
                <span className="text-destructive">Last message failed to send.</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    const t = lastFailed;
                    setLastFailed(null);
                    void sendToChat(t);
                  }}
                >
                  <RotateCcw className="w-3 h-3 mr-1" /> Retry
                </Button>
              </div>
            )}
          </div>


          {/* Unified composer — mic + textarea + send/stop in one row. */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (phase === "thinking") stopGenerating();
              else handleTextSend();
            }}
            className="mt-3 flex items-end gap-2 rounded-2xl border border-jarvis/25 bg-background/70 backdrop-blur-md p-2 focus-within:border-jarvis/60 transition-colors"
          >
            {/* Mic button — inline, leading position */}
            <button
              type="button"
              ref={micButtonRef}
              onClick={handleMicClick}
              className="relative shrink-0 min-h-11 min-w-11 h-11 w-11 rounded-xl border border-jarvis/40 bg-background/60 flex items-center justify-center transition-transform motion-safe:hover:scale-105 motion-safe:active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jarvis"
              aria-label={statusLabel}
            >
              {phase === "listening" && !recPaused && !reduced && (
                <span className="absolute inset-0 rounded-xl border border-jarvis animate-[jarvis-ring_1.5s_ease-out_infinite]" />
              )}
              {phase === "thinking" ? (
                <Loader2 className="w-5 h-5 text-jarvis motion-safe:animate-spin" />
              ) : phase === "speaking" || (phase === "listening" && !recPaused) ? (
                <>
                  <WaveBars level={micLevel} active={phase === "speaking" || !recPaused} mode={phase === "speaking" ? "speaking" : "listening"} />
                  <span className="sr-only">
                    {phase === "speaking" ? "JARVIS is speaking" : "Listening to your voice"}
                  </span>
                </>
              ) : (
                <Mic className="w-5 h-5 text-jarvis" />
              )}
            </button>

            <Textarea
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleTextSend();
                }
              }}
              placeholder={
                phase === "idle"
                  ? "Type a message, or hold Space to talk…"
                  : phase === "speaking"
                  ? "JARVIS is speaking — tap mic to interrupt…"
                  : phase === "listening"
                  ? "Listening…"
                  : "Thinking… tap Stop to cancel"
              }
              disabled={phase !== "idle"}
              rows={1}
              className="min-h-11 max-h-32 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-2 py-2.5 text-sm"
              aria-label="Message JARVIS"
            />

            {phase === "thinking" ? (
              <Button
                type="submit"
                size="icon"
                variant="destructive"
                className="shrink-0 min-h-11 min-w-11 rounded-xl"
                aria-label="Stop generating"
              >
                <Square className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={phase !== "idle" || !composerText.trim()}
                className="shrink-0 min-h-11 min-w-11 rounded-xl"
                aria-label="Send message"
              >
                <SendHorizontal className="w-4 h-4" />
              </Button>
            )}
          </form>



          {/* Scroll-to-bottom pill — appears only when the user scrolled up during streaming. */}
          {scrolledUp && (
            <button
              onClick={() => {
                const el = transcriptRef.current;
                if (el) el.scrollTop = el.scrollHeight;
                setScrolledUp(false);
              }}
              className="absolute left-1/2 -translate-x-1/2 -top-4 flex items-center gap-1.5 rounded-full border border-jarvis/40 bg-background/90 backdrop-blur-md px-3 py-1.5 text-xs text-jarvis shadow-lg hover:bg-jarvis/10 transition-colors motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1"
              aria-label="Scroll to latest message"
            >
              <ArrowDown className="w-3.5 h-3.5" /> New reply
            </button>
          )}

          {/* SR-only live region — announces streaming chunks to assistive tech
              (aria-live on the visual bubble would spam; polite here batches). */}
          <div className="sr-only" aria-live="polite" aria-atomic="false">
            {partial}
          </div>
          </div>
        </div>

      </div>
    </main>
  );
}
