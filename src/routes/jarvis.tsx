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
  Loader2,
  X,
} from "lucide-react";
import { loadVoiceMode, saveVoiceMode, type VoiceMode } from "@/lib/voice-mode";
import { RealtimeClient, RealtimeError } from "@/lib/realtime-client";
import { readSttResponse } from "@/lib/stt-stream";
import { useMicPermission } from "@/hooks/useMicPermission";
import { useQuotaCooldown } from "@/hooks/useQuotaCooldown";

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
  SPEED_PRESETS,
  paceLabel,
  adaptiveSpeed,
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
// HologramSafe removed — orb visuals are now inline in the preview-parity cluster below.
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
  if (err?.name === "TypeError" || msg.includes("failed to fetch"))
    return "Network error — please retry.";
  if (msg.includes("429") || msg.includes("rate"))
    return "Rate limit reached — slow down and retry.";
  if (msg.includes("402") || msg.includes("credit"))
    return "AI credits exhausted — top up in your workspace.";
  if (msg.includes("401") || msg.includes("unauthorized"))
    return "Session expired — please sign in again.";
  return fallback;
}

/** Cycle short verbs during the "thinking" phase so it feels alive. */
const THINKING_STAGES = ["Reading", "Analyzing", "Composing", "Refining"] as const;

/**
 * Hard cap on a single composed message. Mirrors the server's zod schema
 * in /api/chat so we can reject over-long input in the UI with a friendly
 * toast instead of round-tripping to a 400.
 */


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

/** Preview-parity color language: each phase has a hue that drives the orb,
 *  rings, glow, side buttons, caption tint, and message role labels. */
const PHASE_HUE: Record<Phase, number> = {
  idle: 258,       // violet — resting
  listening: 180,  // cyan   — user speaking
  thinking: 48,    // amber  — connecting / composing
  speaking: 258,   // violet — assistant replying
};
const PHASE_CAPTION: Record<Phase, string> = {
  idle: "TAP TO START",
  listening: "LISTENING",
  thinking: "THINKING",
  speaking: "SPEAKING",
};

/** Animated bars used inside the orb while listening. Purely visual, driven
 *  by shared mic amplitude. */
function OrbWaveBars({ level, hue }: { level: number; hue: number }) {
  const [, force] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const tick = () => { force((n) => (n + 1) & 0xffff); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);
  const bars = 7;
  const now = Date.now() / 140;
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => {
        const wave = Math.abs(Math.sin(now + i * 0.7));
        const h = 8 + wave * (12 + level * 50);
        return (
          <span
            key={i}
            className="rounded-full"
            style={{
              width: 3,
              height: `${h}px`,
              background: `hsl(${hue} 95% 75%)`,
              boxShadow: `0 0 8px hsl(${hue} 95% 65% / 0.8)`,
              opacity: 0.4 + wave * 0.6,
            }}
          />
        );
      })}
    </div>
  );
}

/** Three-dot typing/thinking indicator. Hue-driven to match preview caption
 *  palette; bounces gently so it reads as "waiting" without being noisy.
 *  Respects reduced motion (falls back to a soft pulse). */
function TypingDots({ hue, label }: { hue: number; label?: string }) {
  const reduced = useReducedMotion();
  const color = `hsl(${hue} 85% 70%)`;
  const glow = `hsl(${hue} 90% 60% / 0.55)`;
  return (
    <div
      className="flex items-center gap-2 sm:gap-1.5 py-1"
      role="status"
      aria-live="polite"
      aria-label={label ?? "Loading"}
    >
      {[0, 160, 320].map((delay) => (
        <span
          key={delay}
          className={`inline-block w-2 h-2 sm:w-1.5 sm:h-1.5 rounded-full ${
            reduced ? "motion-safe:animate-pulse" : "motion-safe:animate-bounce"
          }`}
          style={{
            background: color,
            boxShadow: `0 0 6px ${glow}`,
            animationDelay: `${delay}ms`,
            animationDuration: "1s",
          }}
        />
      ))}
    </div>
  );
}

/** Small circular button that flanks the orb (mic on the left, stop on the
 *  right). Mic variant paints a mic-level arc around itself. */
function OrbSideButton({
  icon, hue, level, onClick, ariaLabel, showArc, muted, disabled,
}: {
  icon: React.ReactNode; hue: number; level: number;
  onClick: () => void; ariaLabel: string;
  showArc?: boolean; muted?: boolean; disabled?: boolean;
}) {
  const size = 48;
  const arcActive = showArc && level > 0.01;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      className="relative grid place-items-center rounded-full outline-none transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-jarvis focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      style={{ width: size, height: size }}
    >
      {showArc && (
        <svg className="absolute -inset-1" viewBox="0 0 56 56" fill="none" aria-hidden>
          <circle
            cx="28" cy="28" r="26"
            stroke={`hsl(${hue} 90% 60% / ${arcActive ? 0.9 : 0.3})`}
            strokeWidth="1.5"
            strokeDasharray={`${34 + level * 80} 180`}
            strokeLinecap="round"
            transform="rotate(120 28 28)"
            style={{ filter: `drop-shadow(0 0 4px hsl(${hue} 90% 60% / 0.6))` }}
          />
        </svg>
      )}
      <div
        className="grid place-items-center rounded-full backdrop-blur"
        style={{
          width: size, height: size,
          background: muted
            ? "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))"
            : `linear-gradient(180deg, hsl(${hue} 40% 20% / 0.55), hsl(${hue} 30% 10% / 0.55))`,
          border: `1px solid hsl(${hue} 50% 60% / ${muted ? 0.15 : 0.35})`,
          color: muted ? "rgba(255,255,255,0.85)" : `hsl(${hue} 90% 85%)`,
          boxShadow: muted ? "none" : `0 0 18px hsl(${hue} 80% 50% / 0.25)`,
        }}
      >
        {icon}
      </div>
    </button>
  );
}

/**
 * Scrolling live waveform — rolling buffer of mic amplitudes rendered as
 * vertical bars. Bars slide right→left every frame; newest sample lands
 * at the right edge. Height maps to loudness. Purely visual, driven by
 * `level` (0..1) from the shared analyser.
 */
function LiveWaveform({ level, paused }: { level: number; paused: boolean }) {
  const BARS = 40;
  const bufferRef = useRef<number[]>(Array(BARS).fill(0.05));
  const [, force] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const tick = () => {
      const buf = bufferRef.current;
      // Shift left, push newest sample (or a whisper of noise when paused).
      const sample = paused
        ? 0.04 + Math.random() * 0.02
        : Math.max(0.05, Math.min(1, level * 1.4));
      for (let i = 0; i < BARS - 1; i++) buf[i] = buf[i + 1];
      buf[BARS - 1] = sample;
      force((n) => (n + 1) & 0xffff);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [level, paused, reduced]);

  const H = 24;
  const W = BARS * 3; // 2px bar + 1px gap
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="shrink-0" aria-hidden="true">
      {bufferRef.current.map((v, i) => {
        const barH = Math.max(2, v * H);
        const x = i * 3;
        const y = (H - barH) / 2;
        // Fade older samples slightly for depth.
        const ageOpacity = 0.35 + (i / BARS) * 0.65;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={2}
            height={barH}
            rx={1}
            className={paused ? "fill-amber-400/70" : "fill-emerald-400"}
            opacity={ageOpacity}
          />
        );
      })}
    </svg>
  );
}

/**
 * Volume meter with a colored quality zone and peak-hold marker.
 *
 * Reads the smoothed `level` (0..1) for the animated bar and the unsmoothed
 * `peak` (0..1) for a thin overlay marker that snaps to loud bursts and
 * decays slowly — the same convention as any audio-app input meter. Colors
 * encode capture quality at a glance:
 *
 *   - < 0.15   → red      "too quiet — speak louder / move closer"
 *   - 0.15–0.85 → emerald "good input level"
 *   - > 0.85   → amber    "clipping risk — back off"
 *
 * Purely visual; the actual STT capture always proceeds regardless.
 */
function VolumeMeter({ level, peak, sensitivity = 1 }: { level: number; peak: number; sensitivity?: number }) {
  // Sensitivity scales the raw signal BEFORE zone classification, so raising
  // it lets a quiet mic still register "Good" while lowering it prevents a
  // loud room from constantly showing "Clipping". The bar reflects the
  // scaled value the user actually sees.
  const scaledLevel = Math.max(0, Math.min(1, level * sensitivity));
  const scaledPeak = Math.max(0, Math.min(1, peak * sensitivity));
  const pct = scaledLevel * 100;
  const peakPct = scaledPeak * 100;
  const zone =
    scaledPeak < 0.05 ? "silent" :
    scaledLevel < 0.15 ? "quiet" :
    scaledPeak > 0.9 ? "clip" :
    "good";
  const barColor =
    zone === "silent" ? "bg-muted-foreground/40" :
    zone === "quiet" ? "bg-red-400" :
    zone === "clip" ? "bg-amber-400" :
    "bg-emerald-400";
  const label =
    zone === "silent" ? "No signal" :
    zone === "quiet" ? "Too quiet" :
    zone === "clip" ? "Clipping" :
    "Good";
  const labelColor =
    zone === "silent" ? "text-muted-foreground/70" :
    zone === "quiet" ? "text-red-300" :
    zone === "clip" ? "text-amber-300" :
    "text-emerald-300";
  return (
    <div className="flex items-center gap-2 min-w-0" role="meter" aria-label={`Input level ${Math.round(pct)}%, ${label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <div className="relative h-2 w-32 sm:w-40 rounded-full bg-white/5 overflow-hidden ring-1 ring-white/10">
        {/* Ideal-zone shading — subtle emerald tint between 15% and 85%. */}
        <div className="absolute inset-y-0 left-[15%] right-[15%] bg-emerald-400/5" aria-hidden="true" />
        {/* Live level bar. */}
        <div
          className={`absolute inset-y-0 left-0 ${barColor} transition-[width] duration-75 ease-out`}
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
        {/* Peak-hold marker — 2px vertical line that decays slowly. */}
        {scaledPeak > 0.02 && (
          <div
            className={`absolute top-0 bottom-0 w-[2px] ${zone === "clip" ? "bg-amber-200" : "bg-white/70"}`}
            style={{ left: `calc(${peakPct}% - 1px)` }}
            aria-hidden="true"
          />
        )}
      </div>
      <span className={`text-[9px] font-semibold uppercase tracking-[0.2em] whitespace-nowrap ${labelColor}`}>
        {label}
      </span>
    </div>
  );
}

/** MM:SS elapsed timer since `startedAt` (or "--:--" when null). */
function RecTimer({ startedAt, paused }: { startedAt: number | null; paused: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt == null || paused) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [startedAt, paused]);
  if (startedAt == null) return null;
  const secs = Math.floor((now - startedAt) / 1000);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return (
    <span className="font-mono text-[11px] tabular-nums text-foreground/80">
      {mm}:{ss}
    </span>
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

  // Voice interaction mode: push-to-talk, auto-VAD, or realtime streaming.
  const [mode, setMode] = useState<VoiceMode>(() => loadVoiceMode());
  // Realtime session state — only meaningful when mode === "realtime".
  const [realtimeOn, setRealtimeOn] = useState(false);
  const realtimeRef = useRef<RealtimeClient | null>(null);
  // Live transcript captions during realtime (user + assistant).
  const [rtUserPartial, setRtUserPartial] = useState("");
  const [rtAsstPartial, setRtAsstPartial] = useState("");

  // --- Voice control sub-states ---
  const [recPaused, setRecPaused] = useState(false);
  const [recStartedAt, setRecStartedAt] = useState<number | null>(null);
  const [playPaused, setPlayPaused] = useState(false);

  // --- TTS settings ---
  const [tts, setTts] = useState<TTSSettings>(loadTTSSettings);
  const lastSpokenRef = useRef<string>(""); // for "restart playback"

  // --- Pipeline latency metrics (ms) ---
  // sttMs   : time from POST /api/stt → final transcript resolved.
  // ttsMs   : time from POST /api/tts → audio.play() resolved (first sound).
  // Both are 0 until the first turn completes. They power the visible
  // latency badges AND the auto-adaptive speaking rate — so "where is the
  // delay coming from?" and "should I speak faster?" share one signal.
  const [sttMs, setSttMs] = useState(0);
  const [ttsMs, setTtsMs] = useState(0);
  // True end-to-end latency for realtime: server-VAD speech_stopped → first
  // assistant audio frame. Reflects what the user actually feels.
  const [e2eMs, setE2eMs] = useState(0);

  // Mic permission state (granted/denied/prompt/unknown) — surfaced as a
  // small dot in the listening strip so the user knows why capture may fail.
  const micPerm = useMicPermission();

  // Countdown for 402 (quota) / 429 (rate) responses so the user sees exactly
  // how long to wait, instead of a generic error toast repeated on each retry.
  const cooldown = useQuotaCooldown();

  // --- Mic test overlay ---
  // Continuously renders a big meter without touching the STT pipeline, so
  // the user can confirm capture and calibrate sensitivity in isolation.
  const [micTestOpen, setMicTestOpen] = useState(false);

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
  // Smooth-follow so streaming partials glide into view instead of snapping.
  useEffect(() => {
    const el = transcriptRef.current;
    if (!el || scrolledUp) return;
    const prefersReduced = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: prefersReduced ? "auto" : "smooth" });
  }, [partial, rtUserPartial, rtAsstPartial, messages, scrolledUp]);

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

  // Re-pin transcript to bottom after viewport changes (window resize, mobile
  // orientation flip, virtual-keyboard show/hide via visualViewport). Without
  // this the aside can be left mid-scroll and bubbles appear cropped after a
  // rotate. Skips when the user has intentionally scrolled up.
  useEffect(() => {
    const onResize = () => {
      const el = transcriptRef.current;
      if (!el || scrolledUp) return;
      // Use `auto` (no smooth) since resize is a layout event, not content flow.
      el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, [scrolledUp]);


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

  // Guard so bootstrap runs exactly once even if TanStack's `navigate`
  // identity changes between renders (which would otherwise re-load
  // localStorage over live in-memory state and wipe an in-flight message).
  const bootstrappedRef = useRef(false);
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    const k = getLicense();
    if (!k) {
      navigate({ to: "/" });
      return;
    }
    setLicense(k);

    // Load threads; create the first one if empty. Bootstrap runs once so a
    // storage failure here only warns — the app still works with in-memory
    // messages that just won't persist across reloads.
    try {
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
    } catch (e) {
      console.error("[jarvis] bootstrap failed", e);
      toast.warning("Conversation history unavailable", {
        description: "Your messages this session won't be saved.",
      });
      // Fall back to an in-memory thread so the UI still has an activeId.
      const t = createThread();
      setThreads([t]);
      setActiveId(t.id);
      setMessages([]);
    }
  }, [navigate]);


  /**
   * Persist current messages into the active thread whenever they change.
   *
   * Wrapped in try/catch because `upsertThread` can throw when localStorage
   * is full (quota exceeded). We toast a single warning so the user knows
   * their conversation isn't being saved, but the in-memory UI keeps
   * working — losing persistence is not worth a crashed render.
   */
  const storageToastShownRef = useRef(false);
  const activeIdRef = useRef(activeId);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);
  useEffect(() => {
    const id = activeIdRef.current;
    if (!id) return;
    const current = threads.find((t) => t.id === id);
    // Skip write when the active thread is empty and messages are empty too.
    if (!current && messages.length === 0) return;
    // Skip write when messages are byte-identical to the persisted thread —
    // otherwise merely OPENING an old conversation bumps its `updatedAt` and
    // reorders the sidebar, plus wastes a localStorage round-trip.
    if (
      current &&
      current.messages.length === messages.length &&
      current.messages.every(
        (m, i) => m.role === messages[i].role && m.content === messages[i].content,
      )
    ) {
      return;
    }
    const updated: Thread = {
      id,
      title: deriveTitle(messages) || current?.title || "New conversation",
      updatedAt: Date.now(),
      messages,
    };
    try {
      const list = upsertThread(updated);
      setThreads(list);
    } catch (e) {
      console.error("[jarvis] persist thread failed", e);
      if (!storageToastShownRef.current) {
        storageToastShownRef.current = true;
        toast.error(
          e instanceof Error ? e.message : "Couldn't save conversation to browser storage.",
        );
      }
    }
    // threads intentionally omitted: we read the latest via the find() above,
    // and including it would re-run the effect after every write we just made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);


  /**
   * Push-to-talk: hold Space to start listening, release to send.
   * Ignored while the user is typing in an input/textarea/contenteditable,
   * during auto-repeat, or when any modifier is held (Cmd/Ctrl/Alt/Meta).
   *
   * We route every handler through `handlersRef` (updated each render, below)
   * so the keyboard listener always calls the CURRENT `startListening`,
   * `sendToChat`, etc. — never a stale first-render closure. Without this
   * indirection, voice-triggered `sendToChat` would ship an empty message
   * list to the server on every Space press after the first, wiping the
   * conversation context.
   */
  const handlersRef = useRef({
    startListening: () => {},
    stopListening: () => {},
    cancelRecording: () => {},
    stopPlayback: () => {},
    stopGenerating: () => {},
  });

  useEffect(() => {
    const isEditable = (el: EventTarget | null) => {
      const t = el as HTMLElement | null;
      if (!t) return false;
      const tag = t.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable;
    };
    const onDown = (e: KeyboardEvent) => {
      // Escape — universal cancel/stop
      if (e.key === "Escape") {
        if (phaseRef2.current === "listening") {
          e.preventDefault();
          handlersRef.current.cancelRecording();
        } else if (phaseRef2.current === "speaking") {
          e.preventDefault();
          handlersRef.current.stopPlayback();
        } else if (phaseRef2.current === "thinking") {
          e.preventDefault();
          handlersRef.current.stopGenerating();
        }
        return;
      }
      if (e.code !== "Space" || e.repeat) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (isEditable(e.target)) return;
      if (phaseRef2.current !== "idle") return;
      e.preventDefault();
      spaceHeldRef.current = true;
      handlersRef.current.startListening();
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (!spaceHeldRef.current) return;
      spaceHeldRef.current = false;
      if (isEditable(e.target)) return;
      e.preventDefault();
      if (phaseRef2.current === "listening") handlersRef.current.stopListening();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
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
      patch.voice !== undefined
        ? `Voice: ${patch.voice}`
        : patch.speed !== undefined
          ? `Speed: ${patch.speed.toFixed(2)}×`
          : patch.volume !== undefined
            ? `Volume: ${Math.round(patch.volume * 100)}%`
            : patch.micSensitivity !== undefined
              ? `Mic sensitivity: ${patch.micSensitivity.toFixed(2)}×`
              : patch.autoAdaptivePace !== undefined
                ? `Auto-adaptive pace: ${patch.autoAdaptivePace ? "On" : "Off"}`
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
      const t0 = performance.now();
      try {
        setPhase("speaking");
        setPlayPaused(false);
        lastSpokenRef.current = text;

        // Adaptive pace: use the user's base speed unless auto-adaptive is
        // on, in which case nudge it up in proportion to the most recent
        // total pipeline latency (STT + TTS). Bounded inside adaptiveSpeed.
        const effectiveSpeed = adaptiveSpeed(
          tts.speed,
          sttMs + ttsMs,
          tts.autoAdaptivePace,
        );

        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: tts.voice, speed: effectiveSpeed }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          await cooldown.startFromResponse(res);
          throw new Error(body || `${res.status}`);
        }
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
        // Measured from request start to first audible playback — this is
        // the metric that maps to "how long did I wait to hear a reply?".
        setTtsMs(Math.round(performance.now() - t0));
      } catch (e) {
        console.error(e);
        setPhase("idle");
        toast.error(friendlyError(e, "Voice playback failed"));
      }
    },
    [tts, sttMs, ttsMs],
  );

  /* ---------- Chat (LLM streaming) ---------- */

  const sendToChat = useCallback(
    async (userText: string) => {
      const next: ChatMsg[] = [...messages, { role: "user", content: userText }];
      // Batch: commit the user message AND clear the STT partial in the same
      // render so the trailing "You" bubble's DOM node is reused (stable key
      // `msg-${messages.length}`) — no unmount/remount, no fade-in slide,
      // no caret jump, no italic flash.
      setMessages(next);
      setRtUserPartial("");
      setLastFailed(null);
      setPhase("thinking");
      const controller = new AbortController();
      abortRef.current = controller;
      let full = "";
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const body = await res.text().catch(() => "");
          await cooldown.startFromResponse(res);
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
        const finalText = full.trim();
        if (finalText) {
          setMessages([...next, { role: "assistant", content: finalText }]);
          await speak(finalText);
        } else {
          // Stream ended with no content — surface a real error instead of an empty bubble.
          toast.error("Empty response — please retry.");
          setMessages(messages);
          setLastFailed(userText);
          setPhase("idle");
        }
      } catch (e: unknown) {
        if ((e as { name?: string })?.name === "AbortError") {
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
    [messages, speak],
  );

  /** Cancel an in-flight LLM stream; keeps whatever tokens already arrived. */
  const stopGenerating = () => {
    abortRef.current?.abort();
  };

  /**
   * Hard-cancel any in-flight SSE stream (STT transcription OR assistant tokens)
   * and clear partial transcripts safely. Used by the visible Cancel pill.
   * Aborting the controller triggers the reader's AbortError path, which
   * releases the reader in `finally` — no socket leak.
   */
  const cancelStream = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRtUserPartial("");
    setRtAsstPartial("");
    setPartial("");
    setPhase("idle");
  };


  /* ---------- Recording controls ---------- */

  const startListening = async () => {
    // Guard via ref, not `phase` closure — otherwise barge-in
    // (stopPlayback → queueMicrotask(startListening)) reads the stale
    // "speaking" phase from the render that scheduled the microtask
    // and bails before the setPhase("idle") from stopPlayback commits.
    if (mediaRef.current) return;
    try {
      // Tight constraints — mono @ 16 kHz + AEC/NS shrinks the STT upload
      // ~4× vs stereo/48kHz defaults without hurting speech recognition,
      // so the round-trip to Whisper feels noticeably snappier.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      // 24 kbps mono Opus is transparent for speech; the smaller blob means
      // the POST body is done uploading before the recorder even flushes,
      // shaving hundreds of ms off perceived end-to-end latency.
      const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 24000 });
      mediaRef.current = rec;
      chunksRef.current = [];
      setRecPaused(false);

      // 100 ms timeslice → the browser flushes small chunks continuously
      // instead of holding one giant blob until stop(), so the upload can
      // start streaming rather than block on rec.onstop.
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);

      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        mediaRef.current = null;
        setRecStartedAt(null);
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 1500) {
          toast.error("Recording too short");
          setPhase("idle");
          return;
        }
        setPhase("thinking");
        setRtUserPartial("");
        // Wire STT into the same abort channel as the chat stream so Escape /
        // stopGenerating cancel transcription mid-flight instead of letting it
        // silently complete and auto-send.
        const sttController = new AbortController();
        abortRef.current = sttController;
        const sttT0 = performance.now();
        try {
          const fd = new FormData();
          const ext = mime.includes("mp4") ? "mp4" : "webm";
          fd.append("file", blob, `recording.${ext}`);
          // Stream so partial transcript deltas appear as words are recognized.
          const res = await fetch("/api/stt?stream=1", {
            method: "POST",
            body: fd,
            signal: sttController.signal,
          });
          if (!res.ok) {
            const body = await res.text().catch(() => "");
            await cooldown.startFromResponse(res);
            throw new Error(body || `${res.status}`);
          }

          // Unified reader (SSE ↔ JSON) — see src/lib/stt-stream.ts and
          // src/lib/stt-stream.test.ts for delta/final-commit tests.
          const finalText = await readSttResponse(res, (acc) => setRtUserPartial(acc));
          // Measured from POST send to final-transcript resolution — covers
          // upload + model inference + streaming completion.
          setSttMs(Math.round(performance.now() - sttT0));

          const text = finalText.trim();
          if (!text) {
            setRtUserPartial("");
            toast.error("Didn't catch that");
            setPhase("idle");
            return;
          }
          // Snap the caret's text to the final transcript BEFORE sendToChat
          // batches its commit. Both updates land in the same render tick,
          // so the trailing "You" bubble simply drops its caret in place.
          setRtUserPartial(text);
          await sendToChat(text);
        } catch (e) {
          // User-initiated cancel (Escape / stopGenerating) — silent teardown.
          if ((e as { name?: string })?.name === "AbortError") {
            setRtUserPartial("");
            setPhase("idle");
            return;
          }
          console.error(e);
          setRtUserPartial("");
          toast.error(friendlyError(e, "Transcription failed"));
          setPhase("idle");
        } finally {
          // Reader cleanup lives inside readSttResponse's finally block.
          // Only clear abortRef if it still points at OUR controller — sendToChat
          // may have overwritten it with its own controller for the LLM stream.
          if (abortRef.current === sttController) abortRef.current = null;
        }
      };

      rec.start(100);
      setRecStartedAt(Date.now());
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
        mediaRef.current = null;
        setRtUserPartial("");
        setPhase("idle");
        setRecPaused(false);
        setRecStartedAt(null);
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
      audioRef.current.onended = null;
      audioRef.current = null;
    }
    // Release the blob URL so it doesn't leak if the user navigates away
    // before `speak()` runs again (which would have revoked it).
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
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

  // Keep handlersRef pointing at the CURRENT versions of these functions so
  // the keyboard listener (which was bound once on mount) never invokes
  // stale first-render closures. Critical for voice PTT: without this,
  // Space-hold recordings post-first-message would call render-0's
  // sendToChat with empty history, wiping conversation context.
  //
  // Sync inside useEffect (post-commit) — mutating refs during render is a
  // React anti-pattern that can leave torn state when a render is discarded
  // by concurrent mode / Suspense.
  useEffect(() => {
    handlersRef.current = {
      startListening,
      stopListening,
      cancelRecording,
      stopPlayback,
      stopGenerating,
    };
  });


  /* ---------- Orb tap dispatch ---------- */


  const handleMicClick = () => {
    haptic(12);
    // Realtime: orb is a connect/disconnect toggle. Referenced via ref because
    // connectRealtime is defined below in source order but hoisted at runtime.
    if (mode === "realtime") {
      if (realtimeOn || realtimeRef.current) {
        disconnectRealtimeRef.current?.();
      } else {
        void connectRealtimeRef.current?.();
      }
      return;
    }
    // VAD: orb pauses/resumes hands-free mode by switching modes visually,
    // but the actual auto-listen is driven by the mic level effect above.
    // Tapping while listening = cancel current utterance.
    if (mode === "vad" && phase === "listening") {
      cancelRecording();
      return;
    }
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

  // Forward refs so handleMicClick (defined above the realtime callbacks) can
  // reach them without hoisting issues under TanStack's code-splitter.
  const connectRealtimeRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const disconnectRealtimeRef = useRef<() => void>(() => {});

  /* ---------- Thread actions ---------- */

  const newConversation = () => {
    // Cancel anything in progress.
    if (phase === "listening") cancelRecording();
    if (phase === "speaking") stopPlayback();
    const t = createThread();
    try {
      const list = upsertThread(t);
      setThreads(list);
      setActiveId(t.id);
      setMessages([]);
      setPartial("");
    } catch (e) {
      console.error("[jarvis] newConversation failed", e);
      toast.error(
        e instanceof Error ? e.message : "Couldn't start a new conversation.",
      );
    }
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
    try {
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
    } catch (e) {
      console.error("[jarvis] removeThread failed", e);
      toast.error(
        e instanceof Error ? e.message : "Couldn't delete that conversation.",
      );
    }
  };

  const signOut = () => {
    clearLicense();
    navigate({ to: "/" });
  };

  // Live mic amplitude → volumetric orb density.
  // Passive analyser runs while page is mounted; the recording MediaRecorder
  // uses its own independent stream, so both can coexist.
  const { level: micLevel, peak: micPeak, active: micActive, latencyMs: micLatency } = useMicLevel(!!license);

  /* ---------- Auto-VAD (mode === "vad") ---------- */
  //
  // Watches the passive mic amplitude from useMicLevel. When speech is
  // detected while idle we auto-start recording; when the level stays below
  // the silence floor for `SILENCE_MS` while listening we auto-stop and let
  // the existing STT→LLM→TTS pipeline take over. Uses refs, not state, so
  // rapid mic-level updates don't rebind the effect every frame.
  const vadRef = useRef({ lastLoud: 0, armed: false });
  useEffect(() => {
    // Only arm in VAD mode; other modes leave voice control fully manual.
    vadRef.current.armed = mode === "vad";
    if (mode !== "vad") vadRef.current.lastLoud = 0;
  }, [mode]);

  useEffect(() => {
    if (mode !== "vad" || !micActive) return;
    const SPEECH_THRESHOLD = 0.06; // RMS above this = speaking
    const SILENCE_MS = 900;         // silence this long → send
    const MIN_UTTERANCE_MS = 400;   // ignore ultra-short blips

    const now = Date.now();
    if (micLevel > SPEECH_THRESHOLD) {
      vadRef.current.lastLoud = now;
      // Barge-in: user speaks while JARVIS is talking → stop playback.
      if (phaseRef2.current === "speaking") {
        stopPlayback();
        queueMicrotask(() => startListening());
        return;
      }
      if (phaseRef2.current === "idle") {
        void startListening();
      }
    } else if (phaseRef2.current === "listening" && !recPaused) {
      const silenceFor = now - vadRef.current.lastLoud;
      const talkedFor = recStartedAt ? now - recStartedAt : 0;
      if (silenceFor > SILENCE_MS && talkedFor > MIN_UTTERANCE_MS) {
        stopListening();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micLevel, micActive, mode, recPaused, recStartedAt]);

  /* ---------- Realtime (mode === "realtime") ---------- */

  // Disconnect the WebRTC session cleanly whenever we leave realtime mode or
  // the component unmounts. Also mirror new user/assistant transcripts into
  // the persistent `messages` history when a turn completes.
  const rtMirroredUserRef = useRef("");
  const rtMirroredAsstRef = useRef("");

  const disconnectRealtime = useCallback(() => {
    realtimeRef.current?.close();
    realtimeRef.current = null;
    setRealtimeOn(false);
    setRtUserPartial("");
    setRtAsstPartial("");
    setPhase("idle");
  }, []);

  const connectRealtime = useCallback(async () => {
    if (realtimeRef.current) return;
    setPhase("thinking");
    const client = new RealtimeClient();
    realtimeRef.current = client;
    client.on((e) => {
      if (e.type === "connected") {
        setRealtimeOn(true);
        setPhase("listening");
        toast.success("Live connection open", { duration: 1500 });
      } else if (e.type === "disconnected") {
        setRealtimeOn(false);
        setPhase("idle");
      } else if (e.type === "user_transcript") {
        setRtUserPartial(e.text);
        if (e.final && e.text.trim() && e.text !== rtMirroredUserRef.current) {
          rtMirroredUserRef.current = e.text;
          setMessages((m) => [...m, { role: "user", content: e.text.trim() }]);
          setRtUserPartial("");
        }
      } else if (e.type === "assistant_transcript") {
        setRtAsstPartial(e.text);
        if (e.final && e.text.trim() && e.text !== rtMirroredAsstRef.current) {
          rtMirroredAsstRef.current = e.text;
          setMessages((m) => [...m, { role: "assistant", content: e.text.trim() }]);
          setRtAsstPartial("");
        }
      } else if (e.type === "e2e_latency") {
        // True end-to-end (speech_stopped → first assistant audio). Ignore
        // absurd outliers — a stalled session can produce huge deltas.
        if (e.ms > 0 && e.ms < 30_000) setE2eMs(e.ms);
      } else if (e.type === "error") {
        toast.error(e.message);
        // In-session quota errors from the OpenAI Realtime service — start
        // the cooldown and gracefully fall back to the sequential VAD
        // pipeline so the user isn't stuck.
        if (cooldown.startFromErrorMessage(e.message)) {
          disconnectRealtime();
          setMode("vad");
          saveVoiceMode("vad");
          toast.message("Switched to Auto voice while realtime cools down");
        }
      }
    });
    try {
      await client.connect();
    } catch (err) {
      console.error("[realtime] connect failed", err);
      const msg = err instanceof Error ? err.message : "Realtime connection failed";
      // 501 = OPENAI_API_KEY not configured; 402/429 = quota — either way,
      // fall back to the sequential VAD pipeline so voice keeps working.
      if (err instanceof RealtimeError) {
        if (err.status === 402 || err.status === 429) {
          cooldown.start(err.retryAfterSec ?? 30, err.status === 402 ? "quota" : "rate");
        }
      }
      toast.error(msg.length < 200 ? msg : "Realtime connection failed");
      disconnectRealtime();
      // Auto-fallback per user's fallback preference (error-only trigger).
      setMode("vad");
      saveVoiceMode("vad");
      toast.message("Switched to Auto voice", {
        description: "Realtime is unavailable right now — using the standard pipeline.",
      });
    }
  }, [disconnectRealtime, cooldown]);

  // Teardown on unmount / mode change away from realtime.
  useEffect(() => {
    if (mode !== "realtime" && realtimeRef.current) disconnectRealtime();
    return () => {
      realtimeRef.current?.close();
      realtimeRef.current = null;
    };
  }, [mode, disconnectRealtime]);

  // Sync forward refs so handleMicClick can call the latest closures.
  useEffect(() => {
    connectRealtimeRef.current = connectRealtime;
    disconnectRealtimeRef.current = disconnectRealtime;
  });

  // Also sync realtime status into the visible phase so the orb reflects
  // it (listening halo while connected, idle otherwise). We only touch phase
  // when in realtime mode to avoid stepping on the other pipelines.
  useEffect(() => {
    if (mode !== "realtime") return;
    setPhase(realtimeOn ? "listening" : "idle");
  }, [mode, realtimeOn]);

  // changeMode removed — Auto-VAD is the only supported mode.

  const stagedThinkingLabel = `${THINKING_STAGES[thinkStageIdx]}…`;
  const statusLabel = {
    idle: "Ready. Tap to speak.",
    listening: recPaused ? "Paused" : "Listening…",
    thinking: partial ? "Responding…" : stagedThinkingLabel,
    speaking: playPaused ? "Paused" : "Speaking…",
  }[phase];

  // Debounced announcement — visual statusLabel updates immediately, but the
  // screen-reader live region only speaks after the phase has been stable for
  // ~450ms. Rapid transitions (idle→listening→idle during a hot-key stutter,
  // or thinking-stage cycling) collapse into a single announcement so VO/TB
  // don't queue overlapping speech. MUST live above the license early return
  // so hook order stays stable across the null→licensed transition.
  const [announcedLabel, setAnnouncedLabel] = useState(statusLabel);
  useEffect(() => {
    const t = setTimeout(() => setAnnouncedLabel(statusLabel), 450);
    return () => clearTimeout(t);
  }, [statusLabel]);

  if (!license) return null;



  return (
    <main
      className="flex flex-col relative overflow-hidden"
      style={{ height: "100dvh", minHeight: "560px" }}
    >
      {/* Full-screen mic test overlay — pure diagnostic surface. Runs while
          `micTestOpen` is true and, crucially, never touches the STT
          pipeline: it only re-renders the ambient meter data that
          `useMicLevel` already produces. Nothing here is sent anywhere. */}
      {micTestOpen && (
        <div
          className="fixed inset-0 z-[60] bg-background/85 backdrop-blur-md flex items-center justify-center p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Microphone test"
        >
          <div className="glass-pill rounded-3xl px-6 py-6 w-full max-w-md flex flex-col items-center gap-5">
            <div className="flex items-center justify-between w-full">
              <span className="font-display tracking-widest text-jarvis text-sm">MIC TEST</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMicTestOpen(false)}
                aria-label="Close mic test"
                className="h-8 w-8 rounded-full p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Speak normally — nothing here is sent to the assistant.
              Use the sensitivity slider to make the meter match your voice.
            </p>
            {/* Meter — full width, taller so it's easy to read from a distance. */}
            <div className="w-full flex flex-col items-center gap-2">
              <div className="w-full rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-2 flex items-center gap-3">
                <VolumeMeter level={micLevel} peak={micPeak} sensitivity={tts.micSensitivity} />
              </div>
              <div className="grid grid-cols-3 gap-2 w-full text-[10px] font-mono tabular-nums text-foreground/60">
                <span className="text-center"><span className="uppercase tracking-[0.2em] text-foreground/40 block">Level</span>{Math.round(micLevel * 100)}%</span>
                <span className="text-center"><span className="uppercase tracking-[0.2em] text-foreground/40 block">Peak</span>{Math.round(micPeak * 100)}%</span>
                <span className="text-center"><span className="uppercase tracking-[0.2em] text-foreground/40 block">In</span>{micLatency}ms</span>
              </div>
            </div>
            <div className="w-full">
              <div className="flex justify-between mb-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Sensitivity
                </label>
                <span className="text-[11px] text-jarvis font-mono">{tts.micSensitivity.toFixed(2)}×</span>
              </div>
              <Slider
                min={0.3}
                max={3}
                step={0.05}
                value={[tts.micSensitivity]}
                onValueChange={([v]) => updateTts({ micSensitivity: v })}
              />
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setMicTestOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      )}
      {/* Aurora ambient background — the signature Liquid Glass look */}
      <div className="aurora-field" aria-hidden="true">
        <div
          className="aurora-accent"
          style={{
            width: "40vmax",
            height: "40vmax",
            left: "30%",
            top: "40%",
            background: "radial-gradient(circle, var(--aurora-c), transparent 60%)",
          }}
        />
      </div>

      {/* Floating glass header pill — centered top, doesn't take vertical space */}
      <header className="relative z-40 flex items-center gap-2 sm:gap-4 md:gap-5 lg:gap-6 mx-3 sm:mx-6 md:mx-8 mt-3 sm:mt-4 px-3 sm:px-5 md:px-6 py-2.5 glass-pill rounded-full">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Hex logo mark — geometric identity, not generic Sparkles */}
          <div className="relative w-8 h-8 shrink-0" aria-hidden="true">
            <svg viewBox="0 0 32 32" className="w-full h-full">
              <defs>
                <linearGradient id="jarvis-mark-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--jarvis)" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="var(--jarvis)" stopOpacity="0.4" />
                </linearGradient>
              </defs>
              <polygon
                points="16,2 29,9 29,23 16,30 3,23 3,9"
                fill="none"
                stroke="url(#jarvis-mark-grad)"
                strokeWidth="1.5"
              />
              <polygon
                points="16,8 24,12.5 24,19.5 16,24 8,19.5 8,12.5"
                fill="url(#jarvis-mark-grad)"
                opacity="0.25"
              />
              <circle
                cx="16"
                cy="16"
                r="2.5"
                fill="var(--jarvis)"
                className="motion-safe:animate-pulse"
              />
            </svg>
          </div>
          <div className="flex flex-col leading-none shrink-0">
            <span className="font-display tracking-[0.25em] text-sm text-jarvis whitespace-nowrap">
              JARVIS
            </span>
            <span className="mt-0.5 text-[9px] uppercase tracking-[0.35em] text-muted-foreground/70 whitespace-nowrap">
              Voice only
            </span>
          </div>
        </div>

        {/* Auto-VAD is the only mode — toggle removed. */}

        <div className="flex items-center gap-1 sm:gap-2 md:gap-3 shrink-0">
          {/* Mic activity — reflects the true state of the useMicLevel hook,
              not user intent. Green pulses with input, dim when hook is down
              (tab hidden, permission denied, not-yet-granted). Hidden on
              mobile to give the title room; orb aria-label already conveys
              mic state to screen readers. */}
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            title={micActive ? "Mic active" : "Mic inactive"}
            className={`hidden sm:inline-flex items-center gap-1.5 rounded-full glass-pill px-2.5 min-h-11 min-w-11 transition-colors ${
              micActive ? "text-emerald-400" : "text-muted-foreground/60"
            }`}
          >
            {micActive ? (
              <Mic className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <MicOff className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {/* Visible-to-SR-only text: TalkBack and older VoiceOver builds
                announce live-region CHANGES only when text-node children
                change, not when aria-label alone flips. Keeping the state
                word in DOM text guarantees the transition is announced. */}
            <span className="sr-only">
              {micActive ? "Microphone active" : "Microphone inactive"}
            </span>
            <span
              aria-hidden="true"
              className={`w-1.5 h-1.5 rounded-full ${
                micActive
                  ? "bg-emerald-400 motion-safe:animate-pulse"
                  : "bg-muted-foreground/40"
              }`}
              style={
                micActive
                  ? { transform: `scale(${1 + Math.min(micLevel * 1.5, 1.2)})` }
                  : undefined
              }
            />
          </div>

          {/* History drawer */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Conversation history"
                title="History"
                className="text-muted-foreground hover:text-foreground min-h-11 min-w-11 h-11 w-11 rounded-full"
              >
                <History className="w-4 h-4" />
              </Button>
            </SheetTrigger>

            <SheetContent side="left" className="w-[85vw] sm:w-[320px] flex flex-col">
              <SheetHeader>
                <SheetTitle className="font-display tracking-widest text-jarvis">
                  Conversations
                </SheetTitle>
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
                    <button onClick={() => openThread(t.id)} className="flex-1 text-left">
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
              <Button
                variant="ghost"
                size="icon"
                aria-label="Voice settings"
                title="Voice"
                className="text-muted-foreground hover:text-foreground min-h-11 min-w-11 h-11 w-11 rounded-full"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-[85vw] sm:w-[340px]">
              <SheetHeader>
                <SheetTitle className="font-display tracking-widest text-jarvis">
                  Voice Settings
                </SheetTitle>
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
                      Speed <span className="text-foreground/40 normal-case tracking-normal">— {paceLabel(tts.speed)}</span>
                    </label>
                    <span className="text-xs text-jarvis font-mono">{tts.speed.toFixed(2)}×</span>
                  </div>
                  {/* Preset chips — one-tap coarse control. The slider below
                      stays available for fine-tuning. Highlighted chip is
                      whichever preset is closest to the current speed. */}
                  <div className="flex gap-1.5 mb-3" role="group" aria-label="Speed presets">
                    {SPEED_PRESETS.map((p) => {
                      const selected = paceLabel(tts.speed) === p.label;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => updateTts({ speed: p.value })}
                          aria-pressed={selected}
                          className={`flex-1 min-h-9 rounded-full text-[11px] font-mono tracking-wider border transition-colors ${
                            selected
                              ? "bg-jarvis/20 border-jarvis/60 text-jarvis"
                              : "bg-white/[0.02] border-white/10 text-foreground/70 hover:bg-white/[0.06] hover:text-foreground"
                          }`}
                        >
                          {p.label}
                          <span className="ml-1 text-[9px] opacity-70">{p.value}×</span>
                        </button>
                      );
                    })}
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

                {/* ---------- Microphone section ---------- */}
                {/* Sensitivity slider retunes the meter thresholds without
                    touching the raw mic gain — so calibration is purely a
                    visual/UX decision and never affects STT quality. The
                    inline meter here IS the test mode: it renders live,
                    unconditionally, and nothing captured here is sent to
                    the assistant. */}
                <div className="pt-4 border-t border-white/5">
                  <div className="flex justify-between mb-2">
                    <label className="text-xs uppercase tracking-widest text-muted-foreground">
                      Mic sensitivity
                    </label>
                    <span className="text-xs text-jarvis font-mono">{tts.micSensitivity.toFixed(2)}×</span>
                  </div>
                  <Slider
                    min={0.3}
                    max={3}
                    step={0.05}
                    value={[tts.micSensitivity]}
                    onValueChange={([v]) => updateTts({ micSensitivity: v })}
                    aria-label="Microphone meter sensitivity"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground/70">
                    Adjusts the volume-meter zones only — raise for quiet mics, lower for loud rooms.
                  </p>

                  <div className="mt-3 rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2.5 flex items-center gap-3">
                    <VolumeMeter level={micLevel} peak={micPeak} sensitivity={tts.micSensitivity} />
                    <span className="text-[10px] font-mono tabular-nums text-foreground/50 ml-auto">
                      {micActive ? "live" : "off"}
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full mt-3"
                    onClick={() => setMicTestOpen((v) => !v)}
                    aria-pressed={micTestOpen}
                  >
                    <Mic className="w-4 h-4 mr-1.5" />
                    {micTestOpen ? "Close mic test" : "Full-screen mic test"}
                  </Button>
                </div>

                {/* ---------- Auto-adaptive pace ---------- */}
                <div className="pt-4 border-t border-white/5">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-jarvis"
                      checked={tts.autoAdaptivePace}
                      onChange={(e) => updateTts({ autoAdaptivePace: e.target.checked })}
                    />
                    <span className="flex-1">
                      <span className="block text-xs uppercase tracking-widest text-muted-foreground">
                        Auto-adaptive pace
                      </span>
                      <span className="block text-[10px] text-muted-foreground/70 mt-0.5">
                        Nudges speaking rate up (max +0.3×) when STT + TTS round-trip exceeds ~1s, so replies feel responsive on slow networks.
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            </SheetContent>
          </Sheet>


          {/* Account menu — replaces the raw license chip with a proper avatar dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                aria-label="Account menu"
                className="min-h-11 min-w-11 h-11 w-11 rounded-full p-0 hover:bg-jarvis/10"
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
              <DropdownMenuItem
                onClick={signOut}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <h1 className="sr-only">JARVIS Voice Assistant</h1>

      {/* ==================================================================
          PREVIEW-PARITY SHELL — orb + composer (left), chat rail (right)
          ================================================================== */}
      <div className="flex-1 flex justify-center min-h-0 overflow-hidden px-4 sm:px-6 pt-3 sm:pt-5 pb-2">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 min-h-0 relative">
          {/* LEFT — orb stage, welcome, strips, composer */}
          <div className="lg:col-span-8 flex flex-col min-h-0 overflow-hidden">
            {/* Orb cluster — preview-parity: side buttons flanking a color-coded orb. */}
            {(() => {
              const hue = PHASE_HUE[phase];
              const isEmpty = messages.length === 0 && !partial && !lastFailed;
              const showSides = !isEmpty || phase !== "idle";
              const core = isEmpty ? 200 : 140;
              const innerRing = core + 40;
              const outerRing = core + 100;
              const orbScale =
                phase === "listening" ? 1 + Math.min(0.18, micLevel * 0.5)
                : phase === "speaking" ? 1.04
                : 1;

              const stopHandler = () => {
                if (phase === "listening") cancelRecording();
                else if (phase === "thinking") stopGenerating();
                else if (phase === "speaking") stopPlayback();
              };
              const stopDisabled = phase === "idle";

              return (
                <div
                  className={`flex flex-col items-center shrink-0 transition-all duration-500 px-4 sm:px-6 ${
                    isEmpty ? "gap-4 pt-6 sm:pt-10 lg:pt-14 pb-4" : "gap-3 pt-6 pb-3"
                  }`}
                >
                  <div className="relative flex items-center justify-center gap-8 sm:gap-14">
                    {showSides && (
                      <OrbSideButton
                        icon={<Mic className="h-4 w-4" />}
                        hue={hue}
                        level={phase === "listening" ? micLevel : 0}
                        showArc
                        onClick={handleMicClick}
                        ariaLabel={phase === "idle" ? "Start listening" : "Toggle mic"}
                      />
                    )}

                    <button
                      type="button"
                      ref={micButtonRef}
                      onClick={handleMicClick}
                      aria-label={`${statusLabel} — tap orb to ${phase === "idle" ? "talk" : phase === "listening" ? "send" : phase === "speaking" ? "interrupt" : "stop"}`}
                      aria-keyshortcuts={phase === "idle" ? "Space" : "Escape"}
                      title={phase === "idle" ? "Hold Space to talk" : "Press Esc to cancel"}
                      className="group relative grid place-items-center rounded-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-jarvis focus-visible:ring-offset-4 focus-visible:ring-offset-background transition-transform duration-300 motion-safe:hover:scale-[1.03] motion-safe:active:scale-[0.97]"
                      style={{ width: outerRing, height: outerRing }}
                    >
                      <div
                        className="absolute inset-0 rounded-full blur-3xl transition-opacity duration-500"
                        style={{
                          opacity: phase === "idle" ? 0.35 : 0.55,
                          background: `radial-gradient(closest-side, hsl(${hue} 90% 60% / 0.55), transparent 70%)`,
                        }}
                        aria-hidden="true"
                      />
                      <div
                        className="absolute rounded-full border transition-colors duration-500"
                        style={{
                          width: outerRing, height: outerRing,
                          borderColor: `hsl(${hue} 90% 65% / ${phase === "idle" ? 0.25 : 0.55})`,
                          boxShadow: `0 0 40px hsl(${hue} 90% 55% / ${phase === "idle" ? 0.15 : 0.35}) inset`,
                        }}
                        aria-hidden="true"
                      />
                      <div
                        className="absolute rounded-full border transition-colors duration-500"
                        style={{
                          width: innerRing, height: innerRing,
                          borderColor: `hsl(${hue} 90% 70% / ${phase === "idle" ? 0.35 : 0.75})`,
                          boxShadow: `0 0 26px hsl(${hue} 90% 60% / ${phase === "idle" ? 0.2 : 0.45}) inset, 0 0 18px hsl(${hue} 90% 60% / 0.22)`,
                        }}
                        aria-hidden="true"
                      />
                      <div
                        className="relative rounded-full transition-transform duration-150 ease-out"
                        style={{
                          width: core, height: core,
                          transform: `scale(${reduced ? 1 : orbScale})`,
                          background: `radial-gradient(circle at 50% 42%, hsl(${hue} 95% 72% / 0.55) 0%, hsl(${hue} 85% 45% / 0.45) 45%, hsl(${hue} 80% 20% / 0.35) 100%)`,
                          boxShadow: `inset 0 0 60px hsl(${hue} 100% 70% / 0.35), inset 0 -25px 60px hsl(${hue} 90% 20% / 0.6), 0 0 60px hsl(${hue} 90% 55% / 0.4)`,
                        }}
                      >
                        <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
                          {phase === "idle" && (
                            <Mic className="text-white/85" style={{ width: core * 0.28, height: core * 0.28 }} />
                          )}
                          {phase === "thinking" && (
                            <Loader2
                              className="motion-safe:animate-spin"
                              style={{ width: core * 0.32, height: core * 0.32, color: `hsl(${hue} 90% 75%)` }}
                            />
                          )}
                          {phase === "listening" && <OrbWaveBars level={micLevel} hue={hue} />}
                          {phase === "speaking" && (
                            <Volume2 style={{ width: core * 0.36, height: core * 0.36, color: `hsl(${hue} 90% 82%)` }} />
                          )}
                        </div>
                      </div>
                    </button>

                    {showSides && (
                      <OrbSideButton
                        icon={<Square className="h-3.5 w-3.5 fill-current" />}
                        hue={hue}
                        level={0}
                        onClick={stopHandler}
                        ariaLabel="Stop"
                        muted
                        disabled={stopDisabled}
                      />
                    )}
                  </div>

                  <div
                    className="text-[10px] sm:text-[11px] tracking-[0.35em] font-mono select-none"
                    style={{ color: `hsl(${hue} 30% 68%)` }}
                    aria-hidden="true"
                  >
                    {phase === "thinking" && partial ? "RESPONDING" : PHASE_CAPTION[phase]}
                  </div>

                  <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                    {announcedLabel}
                  </div>
                </div>
              );
            })()}

            {/* Spacer to push controls to bottom (preview-parity: no welcome/chips) */}
            <div className="flex-1 min-h-0" />


            {/* Listening / thinking / speaking strips */}
            {(phase === "listening" || phase === "thinking" || phase === "speaking") && (
              <div className="shrink-0 flex flex-col items-center gap-2 px-4 sm:px-6 pb-2">
                {phase === "listening" && (
                  <div className="flex flex-col items-center gap-2 motion-safe:animate-[spring-in_0.3s_ease-out] w-full max-w-md">
                    <div
                      className={`glass-pill flex items-center gap-3 rounded-full px-3 py-1.5 border ${
                        recPaused ? "border-amber-400/40" : "border-emerald-400/40"
                      }`}
                      role="status"
                      aria-live="polite"
                      aria-label={recPaused ? "Recording paused" : "Recording in progress"}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            recPaused
                              ? "bg-amber-400"
                              : "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)] motion-safe:animate-pulse"
                          }`}
                        />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/80">
                          {recPaused ? "Paused" : "Rec"}
                        </span>
                      </span>
                      <LiveWaveform level={micLevel} paused={recPaused} />
                      <RecTimer startedAt={recStartedAt} paused={recPaused} />
                    </div>

                    {/* Volume meter — instant pass/fail feedback so the user
                        can tell if their voice is actually being captured. */}
                    <div className="glass-pill flex items-center gap-3 rounded-full px-3 py-1.5">
                      <VolumeMeter level={micLevel} peak={micPeak} sensitivity={tts.micSensitivity} />
                    </div>

                    {/* Live metrics — input latency, last STT round-trip, last
                        TTS round-trip, and the *effective* pace (adaptive if
                        enabled). Splitting STT/TTS makes it obvious where
                        delay actually comes from — network, model, or both. */}
                    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] font-mono tabular-nums text-foreground/60">
                      <span title="Audio input latency (browser-reported)">
                        <span className="uppercase tracking-[0.2em] text-foreground/40 mr-1">In</span>
                        {micLatency ? `${micLatency}ms` : "—"}
                      </span>
                      <span className="text-foreground/20">·</span>
                      <span title="Last speech-to-text round-trip (upload + transcription)">
                        <span className="uppercase tracking-[0.2em] text-foreground/40 mr-1">STT</span>
                        {sttMs ? `${sttMs}ms` : "—"}
                      </span>
                      <span className="text-foreground/20">·</span>
                      <span title="Last text-to-speech round-trip (request → first sound)">
                        <span className="uppercase tracking-[0.2em] text-foreground/40 mr-1">TTS</span>
                        {ttsMs ? `${ttsMs}ms` : "—"}
                      </span>
                      {e2eMs > 0 && (
                        <>
                          <span className="text-foreground/20">·</span>
                          <span title="True end-to-end latency: you stopped speaking → first assistant audio (realtime only)">
                            <span className="uppercase tracking-[0.2em] text-foreground/40 mr-1">E2E</span>
                            {e2eMs}ms
                          </span>
                        </>
                      )}
                      <span className="text-foreground/20">·</span>
                      <span title={tts.autoAdaptivePace ? "Speaking rate — auto-adapts to pipeline latency" : "Speaking rate"}>
                        <span className="uppercase tracking-[0.2em] text-foreground/40 mr-1">Pace</span>
                        {(() => {
                          const eff = adaptiveSpeed(tts.speed, sttMs + ttsMs, tts.autoAdaptivePace);
                          return (
                            <>
                              {paceLabel(eff)} {eff.toFixed(2)}×
                              {tts.autoAdaptivePace && Math.abs(eff - tts.speed) > 0.01 && (
                                <span className="ml-1 text-jarvis/80">auto</span>
                              )}
                            </>
                          );
                        })()}
                      </span>
                    </div>


                    <div className="glass-pill flex flex-wrap items-center justify-center gap-1 rounded-full px-1.5 py-1" role="group" aria-label="Recording controls">
                      {recPaused ? (
                        <Button variant="ghost" size="sm" onClick={resumeRecording} className="h-11 sm:h-8 rounded-full px-3" aria-label="Resume recording" title="Resume recording">
                          <Play className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Resume
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={pauseRecording} className="h-11 sm:h-8 rounded-full px-3" aria-label="Pause recording" title="Pause recording">
                          <Pause className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Pause
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {phase === "speaking" && (
                  <div className="glass-pill flex flex-wrap items-center justify-center gap-1 rounded-full px-1.5 py-1 motion-safe:animate-[spring-in_0.3s_ease-out]" role="group" aria-label="Playback controls">
                    {playPaused ? (
                      <Button variant="ghost" size="sm" onClick={resumePlayback} className="h-11 sm:h-8 rounded-full px-3" aria-label="Resume playback" title="Resume playback">
                        <Play className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Resume
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={pausePlayback} className="h-11 sm:h-8 rounded-full px-3" aria-label="Pause playback" title="Pause playback">
                        <Pause className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Pause
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={restartPlayback} className="h-11 sm:h-8 rounded-full px-3" aria-label="Restart playback from beginning" title="Restart">
                      <RotateCcw className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Restart
                    </Button>
                  </div>
                )}
                {phase === "thinking" && (
                  <div className="glass-pill flex items-center gap-1 rounded-full px-1.5 py-1 motion-safe:animate-[spring-in_0.3s_ease-out]" role="group" aria-label="Streaming controls">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={cancelStream}
                      className="h-11 sm:h-8 rounded-full px-3 text-red-300 hover:text-red-200 hover:bg-red-500/10"
                      aria-label="Cancel — stop streaming and clear partial transcript"
                      title="Cancel (Esc)"
                    >
                      <X className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Cancel
                    </Button>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* RIGHT — preview-style chat rail (dark cards) */}
          <aside
            ref={transcriptRef}
            role="log"
            aria-label="Conversation"
            aria-live="polite"
            className="lg:col-span-4 self-stretch lg:self-center flex flex-col gap-3 min-w-0 min-h-0 lg:max-h-[70dvh] max-h-full overflow-y-auto overflow-x-hidden pr-1 pb-2 [scrollbar-width:thin] [scrollbar-color:oklch(0.6_0.05_240_/_0.3)_transparent]"
          >
            {messages.length === 0 && !partial && !rtUserPartial && !rtAsstPartial && !lastFailed && phase === "idle" ? null : (
              <>
                {(() => {
                  /**
                   * Unified render list. The pending "You" bubble (while STT
                   * streams) shares the SAME stable key as the trailing user
                   * message once sendToChat commits it — so React reuses the
                   * same DOM node during the partial→final swap. No unmount,
                   * no fade-in slide, no caret jump.
                   */
                  type Item =
                    | { key: string; kind: "msg"; role: "user" | "assistant"; content: string; animate: boolean }
                    | { key: string; kind: "pending-user"; text: string };

                  const items: Item[] = messages.map((m, i) => ({
                    key: `slot-${i}`,
                    kind: "msg" as const,
                    role: m.role,
                    content: m.content,
                    // User bubbles never animate on mount — that translate-slide
                    // is what caused the caret jump when a pending bubble was
                    // replaced. Assistant bubbles still fade in for polish.
                    animate: m.role === "assistant",
                  }));

                  const showPending = phase === "listening" || rtUserPartial.length > 0;
                  if (showPending) {
                    items.push({
                      key: `slot-${messages.length}`,
                      kind: "pending-user",
                      text: rtUserPartial,
                    });
                  }

                  return items.map((it) => {
                    if (it.kind === "msg") {
                      return (
                        <div
                          key={it.key}
                          className={`min-w-0 max-w-full rounded-2xl border border-white/10 bg-[#0d1220]/80 p-3.5 sm:p-4 backdrop-blur-xl ${it.animate ? "motion-safe:animate-fade-in" : ""}`}
                          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.35)" }}
                        >
                          <div
                            className="mb-1.5 text-[10px] font-semibold tracking-[0.25em] uppercase"
                            style={{ color: it.role === "user" ? "hsl(180 90% 65%)" : "hsl(258 90% 75%)" }}
                          >
                            {it.role === "user" ? "You" : "Assistant"}
                          </div>
                          <div className="font-sans text-[15px] sm:text-sm leading-[1.65] sm:leading-relaxed text-white/90 break-words [overflow-wrap:anywhere] hyphens-auto [&_p]:my-1 [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px] sm:[&_code]:text-xs [&_code]:break-words [&_pre]:bg-white/5 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline [&_a]:break-all [&_a]:text-jarvis">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{it.content}</ReactMarkdown>
                          </div>
                        </div>
                      );
                    }
                    // pending-user — same shell as a committed "You" msg so
                    // that swapping to the msg variant is a no-op class-wise.
                    return (
                      <div
                        key={it.key}
                        className="min-w-0 max-w-full rounded-2xl border border-white/10 bg-[#0d1220]/80 p-3.5 sm:p-4 backdrop-blur-xl"
                        style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.35)" }}
                      >
                        <div className="mb-1.5 text-[10px] font-semibold tracking-[0.25em] uppercase" style={{ color: "hsl(180 90% 65%)" }}>
                          You
                        </div>
                        {it.text ? (
                          <div className="font-sans text-[15px] sm:text-sm leading-[1.65] sm:leading-relaxed text-white/90 break-words [overflow-wrap:anywhere] hyphens-auto">
                            {it.text}
                            {/* Caret is inside the text flow with a fixed
                                width so removing it doesn't reflow the line. */}
                            <span
                              className="inline-block w-[2px] h-4 bg-cyan-400/80 ml-1 align-middle motion-safe:animate-pulse transition-opacity duration-150"
                              aria-hidden="true"
                            />
                          </div>
                        ) : (
                          <TypingDots hue={PHASE_HUE.listening} label="Listening" />
                        )}
                      </div>
                    );
                  });
                })()}


                {phase === "thinking" && !partial && !rtAsstPartial && !rtUserPartial && (
                  <div
                    className="min-w-0 max-w-full rounded-2xl border border-white/10 bg-[#0d1220]/80 p-3.5 sm:p-4 backdrop-blur-xl motion-safe:animate-fade-in"
                    style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.35)" }}
                  >
                    <div className="mb-1.5 text-[10px] font-semibold tracking-[0.25em] uppercase" style={{ color: "hsl(48 90% 70%)" }}>
                      Thinking
                    </div>
                    <TypingDots hue={PHASE_HUE.thinking} label="Thinking" />

                  </div>
                )}

                {(phase === "speaking" || partial || rtAsstPartial) && (
                <div
                    className="min-w-0 max-w-full rounded-2xl border border-white/10 bg-[#0d1220]/80 p-3.5 sm:p-4 backdrop-blur-xl motion-safe:animate-fade-in"
                    style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.35)" }}
                  >
                    <div className="mb-1.5 text-[10px] font-semibold tracking-[0.25em] uppercase" style={{ color: "hsl(258 90% 75%)" }}>
                      {partial || rtAsstPartial ? "Responding" : "Speaking"}
                    </div>
                    {partial || rtAsstPartial ? (
                      <div className="font-sans text-[15px] sm:text-sm leading-[1.65] sm:leading-relaxed text-white/90 break-words [overflow-wrap:anywhere] hyphens-auto [&_p]:my-1 [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px] sm:[&_code]:text-xs [&_code]:break-words [&_pre]:bg-white/5 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_a]:underline [&_a]:break-all [&_a]:text-jarvis">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{partial || rtAsstPartial}</ReactMarkdown>
                        <span className="inline-block w-2 h-4 bg-jarvis/70 ml-1 align-middle motion-safe:animate-pulse" />
                      </div>
                    ) : (
                      <TypingDots hue={PHASE_HUE.speaking} label="Speaking" />

                    )}
                  </div>
                )}




              </>
            )}
          </aside>

          {/* Scroll-to-bottom pill */}
          {scrolledUp && (
            <button
              onClick={() => {
                const el = transcriptRef.current;
                if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
                setScrolledUp(false);
              }}
              className="absolute right-4 sm:right-6 bottom-4 sm:bottom-6 flex items-center gap-1.5 glass-pill rounded-full min-h-11 sm:min-h-0 px-4 sm:px-3.5 py-2 sm:py-1.5 text-sm sm:text-xs text-foreground hover:bg-white/[0.1] transition-colors motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
              aria-label="Scroll to latest message"
            >
              <ArrowDown className="w-3.5 h-3.5" /> New reply
            </button>
          )}
        </div>
      </div>


      {/* ==================================================================
          BOTTOM RAIL — hints + SR-only live region
          ================================================================== */}
      <div
        className="relative z-30 w-full flex flex-col items-center px-3 sm:px-6 pb-2 sm:pb-3"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
      >
        {/* Keyboard shortcut hints — subtle */}
        <div className="hidden md:flex items-center justify-center gap-3 text-[9px] uppercase tracking-[0.25em] text-muted-foreground/40">
          <span className="inline-flex items-center gap-1">
            <kbd className="glass-pill rounded px-1.5 py-0.5 font-mono text-[10px] text-foreground/90">
              Space
            </kbd>
            hold to talk
          </span>
          <span className="opacity-40">•</span>
          <span className="inline-flex items-center gap-1">
            <kbd className="glass-pill rounded px-1.5 py-0.5 font-mono text-[10px] text-foreground/90">
              Esc
            </kbd>
            cancel
          </span>
        </div>

        {/* SR-only live region — streamed chunks for assistive tech */}
        <div className="sr-only" aria-live="polite" aria-atomic="false">
          {partial}
        </div>
      </div>
    </main>
  );
}
