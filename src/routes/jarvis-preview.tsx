/**
 * JARVIS UI preview — visual prototype matching the HF-realtime-voice style.
 * State machine with color-coded orb:
 *   idle       → violet   "TAP TO START"
 *   connecting → amber    "CONNECTING"
 *   listening  → cyan     waveform bars (user speaking)
 *   speaking   → violet   speaker icon (assistant replying)
 *
 * Route: /jarvis-preview  (visual only, no backend)
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Mic, Square, Volume2, Loader2 } from "lucide-react";
import { useMicLevel } from "@/hooks/useMicLevel";

export const Route = createFileRoute("/jarvis-preview")({
  component: JarvisPreview,
  ssr: false,
  head: () => ({
    meta: [
      { title: "JARVIS — UI Preview" },
      { name: "description", content: "Voice UI prototype." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type State = "idle" | "connecting" | "listening" | "speaking";

const THEME: Record<State, { hue: number; label: string; sub: string }> = {
  idle:       { hue: 258, label: "TAP TO START", sub: "" },
  connecting: { hue: 48,  label: "CONNECTING",   sub: "" },
  listening:  { hue: 180, label: "LISTENING",    sub: "speak now" },
  speaking:   { hue: 258, label: "SPEAKING",     sub: "assistant" },
};

type Msg = { role: "you" | "assistant"; text: string };

const DEMO_LINES: Msg[] = [
  { role: "you",       text: "Yeah, sooner." },
  { role: "assistant", text: "I'm not quite sure what you mean. Could you tell me a bit more?" },
  { role: "you",       text: "What type of update did you push?" },
  { role: "assistant", text: "I'm sorry, it sounds like you were cut off. What type of what?" },
];

function JarvisPreview() {
  const [state, setState] = useState<State>("idle");
  const [messages, setMessages] = useState<Msg[]>([]);
  const { level, active } = useMicLevel(state === "listening");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };

  const startSession = () => {
    if (state !== "idle") { stopSession(); return; }
    setState("connecting");
    timerRef.current = setTimeout(() => cycleTurn(0), 1400);
  };

  const cycleTurn = (i: number) => {
    setState("listening");
    timerRef.current = setTimeout(() => {
      setMessages((m) => [...m, DEMO_LINES[(i * 2) % DEMO_LINES.length]]);
      setState("speaking");
      timerRef.current = setTimeout(() => {
        setMessages((m) => [...m, DEMO_LINES[(i * 2 + 1) % DEMO_LINES.length]]);
        cycleTurn(i + 1);
      }, 2400);
    }, 2600);
  };

  const stopSession = () => {
    clearTimer();
    setState("idle");
  };

  const { hue, label, sub } = THEME[state];

  return (
    <div
      className="relative min-h-dvh w-full overflow-hidden font-mono text-white"
      style={{ background: "radial-gradient(120% 90% at 50% 40%, #0f1424 0%, #05070d 55%, #02030a 100%)" }}
    >
      {/* Top bar */}
      <header className="relative z-20 flex items-center justify-between px-5 py-4">
        <Link
          to="/jarvis"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 backdrop-blur hover:bg-white/[0.08]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.25em] text-white/50">
          UI Preview
        </span>
      </header>

      {/* Stage: orb centered, side buttons flanking, chat rail on the right */}
      <main className="relative z-10 grid min-h-[calc(100dvh-72px)] grid-cols-12 items-center gap-6 px-6 pb-10">
        {/* Left/center: orb + side buttons */}
        <div className="col-span-12 lg:col-span-8 flex items-center justify-center">
          <div className="relative flex items-center gap-10 md:gap-16">
            {/* Left side button — mic with arc indicator */}
            <SideButton
              icon={<Mic className="h-5 w-5" />}
              hue={hue}
              level={state === "listening" ? level : 0}
              showArc
              onClick={startSession}
              ariaLabel="Start"
            />

            {/* Center orb */}
            <Orb state={state} hue={hue} level={level} onTap={startSession} label={label} sub={sub} />

            {/* Right side button — stop */}
            <SideButton
              icon={<Square className="h-4 w-4 fill-current" />}
              hue={hue}
              level={0}
              onClick={stopSession}
              ariaLabel="Stop"
              muted
            />
          </div>
        </div>

        {/* Right: chat rail */}
        <aside className="col-span-12 lg:col-span-4 self-stretch lg:self-center flex flex-col gap-3 max-h-[70dvh] overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <EmptyRail hue={hue} />
          ) : (
            messages.slice(-6).map((m, i) => <Bubble key={i} msg={m} />)
          )}
        </aside>
      </main>

      {/* Mic status footer */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 text-center text-[10px] uppercase tracking-[0.3em] text-white/25">
        {state === "listening" && active ? "mic live" : "preview • not connected"}
      </div>

      <style>{`
        @keyframes jspin { to { transform: rotate(360deg); } }
        @keyframes jbreathe { 0%,100% { transform: scale(1); opacity: .85 } 50% { transform: scale(1.05); opacity: 1 } }
      `}</style>
    </div>
  );
}

/* ---------------- Orb ---------------- */

function Orb({
  state, hue, level, onTap, label, sub,
}: {
  state: State; hue: number; level: number; onTap: () => void; label: string; sub: string;
}) {
  const active = state !== "idle";
  const scale = state === "listening" ? 1 + Math.min(0.18, level * 0.5) : state === "speaking" ? 1.04 : 1;

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={onTap}
        aria-label={label}
        className="group relative grid place-items-center outline-none"
        style={{ width: 320, height: 320 }}
      >
        {/* Outer glow */}
        <div
          className="absolute inset-0 rounded-full blur-3xl transition-opacity duration-500"
          style={{
            opacity: active ? 0.55 : 0.35,
            background: `radial-gradient(closest-side, hsl(${hue} 90% 60% / 0.55), transparent 70%)`,
          }}
        />

        {/* Outer thin ring */}
        <div
          className="absolute rounded-full border transition-colors duration-500"
          style={{
            width: 300, height: 300,
            borderColor: `hsl(${hue} 90% 65% / ${active ? 0.55 : 0.25})`,
            boxShadow: `0 0 40px hsl(${hue} 90% 55% / ${active ? 0.35 : 0.15}) inset`,
          }}
        />
        {/* Inner ring */}
        <div
          className="absolute rounded-full border transition-colors duration-500"
          style={{
            width: 240, height: 240,
            borderColor: `hsl(${hue} 90% 70% / ${active ? 0.75 : 0.35})`,
            boxShadow: `0 0 30px hsl(${hue} 90% 60% / ${active ? 0.45 : 0.2}) inset, 0 0 20px hsl(${hue} 90% 60% / 0.25)`,
          }}
        />

        {/* Core disc */}
        <div
          className="relative rounded-full transition-transform duration-150 ease-out"
          style={{
            width: 200, height: 200,
            transform: `scale(${scale})`,
            background: `radial-gradient(circle at 50% 42%, hsl(${hue} 95% 72% / 0.55) 0%, hsl(${hue} 85% 45% / 0.45) 45%, hsl(${hue} 80% 20% / 0.35) 100%)`,
            boxShadow: `inset 0 0 60px hsl(${hue} 100% 70% / 0.35), inset 0 -25px 60px hsl(${hue} 90% 20% / 0.6), 0 0 60px hsl(${hue} 90% 55% / 0.4)`,
            animation: state === "speaking" ? "jbreathe 1.6s ease-in-out infinite" : undefined,
          }}
        >
          {/* Center content per state */}
          <div className="absolute inset-0 grid place-items-center">
            {state === "idle" && (
              <div className="text-[10px] tracking-[0.35em] text-white/70">TAP</div>
            )}
            {state === "connecting" && (
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: `hsl(${hue} 90% 70%)` }} />
            )}
            {state === "listening" && <WaveBars level={level} hue={hue} />}
            {state === "speaking" && <Volume2 className="h-10 w-10" style={{ color: `hsl(${hue} 90% 80%)` }} />}
          </div>
        </div>
      </button>

      {/* Caption */}
      <div className="mt-8 text-center">
        <div
          className="text-[11px] tracking-[0.4em]"
          style={{ color: `hsl(${hue} 30% 65%)` }}
        >
          {label}
        </div>
        {sub && <div className="mt-1 text-[10px] tracking-[0.25em] text-white/30">{sub}</div>}
      </div>
    </div>
  );
}

/* ---------------- Wave bars (listening state) ---------------- */

function WaveBars({ level, hue }: { level: number; hue: number }) {
  const [, force] = useState(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => { force((n) => (n + 1) & 0xffff); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const bars = 7;
  const now = Date.now() / 140;
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: bars }).map((_, i) => {
        const wave = Math.abs(Math.sin(now + i * 0.7));
        const h = 8 + wave * (16 + level * 60);
        const opacity = 0.4 + wave * 0.6;
        return (
          <span
            key={i}
            className="rounded-full"
            style={{
              width: 3,
              height: `${h}px`,
              background: `hsl(${hue} 95% 75%)`,
              boxShadow: `0 0 8px hsl(${hue} 95% 65% / 0.8)`,
              opacity,
            }}
          />
        );
      })}
    </div>
  );
}

/* ---------------- Side button (mic / stop) ---------------- */

function SideButton({
  icon, hue, level, onClick, ariaLabel, showArc, muted,
}: {
  icon: React.ReactNode; hue: number; level: number;
  onClick: () => void; ariaLabel: string;
  showArc?: boolean; muted?: boolean;
}) {
  const size = 56;
  const arcActive = showArc && level > 0.01;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="relative grid place-items-center rounded-full outline-none transition-transform active:scale-95"
      style={{ width: size, height: size }}
    >
      {/* Arc indicator (mic-level activity), only on the mic side */}
      {showArc && (
        <svg
          className="absolute -inset-1"
          viewBox="0 0 64 64"
          fill="none"
          aria-hidden
        >
          <circle
            cx="32" cy="32" r="30"
            stroke={`hsl(${hue} 90% 60% / ${arcActive ? 0.9 : 0.35})`}
            strokeWidth="1.5"
            strokeDasharray={`${40 + level * 90} 200`}
            strokeLinecap="round"
            transform="rotate(120 32 32)"
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
          color: muted ? "rgba(255,255,255,0.8)" : `hsl(${hue} 90% 85%)`,
          boxShadow: muted ? "none" : `0 0 20px hsl(${hue} 80% 50% / 0.25)`,
        }}
      >
        {icon}
      </div>
    </button>
  );
}

/* ---------------- Chat bubbles ---------------- */

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "you";
  return (
    <div
      className="rounded-2xl border border-white/10 bg-[#0d1220]/80 p-4 backdrop-blur-xl animate-fade-in"
      style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.35)" }}
    >
      <div
        className="mb-1.5 text-[10px] font-semibold tracking-[0.25em] uppercase"
        style={{ color: isUser ? "hsl(180 90% 65%)" : "hsl(258 90% 75%)" }}
      >
        {isUser ? "You" : "Assistant"}
      </div>
      <div className="font-sans text-sm leading-relaxed text-white/90">{msg.text}</div>
    </div>
  );
}

function EmptyRail({ hue }: { hue: number }) {
  return (
    <div
      className="rounded-2xl border border-dashed p-6 text-center text-xs text-white/40"
      style={{ borderColor: `hsl(${hue} 40% 40% / 0.25)` }}
    >
      Conversation will stream here.
    </div>
  );
}
