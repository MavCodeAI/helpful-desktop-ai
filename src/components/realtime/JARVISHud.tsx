import { Activity, Mic, Radio, Sparkles, Square } from "lucide-react";
import type { VoiceStatus } from "@/lib/voice-providers";

type Props = {
  status: VoiceStatus;
  active: boolean;
  level: number;
  sensitivity: number;
  latency: number | null;
  sttLatency: number | null;
  ttsLatency: number | null;
  onStop: () => void;
};

const stateCopy: Record<VoiceStatus, { label: string; hint: string; tone: string }> = {
  idle: { label: "Ready", hint: "Say “Hey Alpha” or tap the mic", tone: "text-white/70" },
  connecting: { label: "Connecting", hint: "Opening a secure voice session", tone: "text-amber-200" },
  listening: { label: "Listening", hint: "I’m listening for your next instruction", tone: "text-cyan-200" },
  speaking: { label: "Speaking", hint: "Alpha is responding", tone: "text-violet-200" },
  error: { label: "Needs attention", hint: "Open Settings to check the connection", tone: "text-red-200" },
};

export function JARVISHud({
  status,
  active,
  level,
  sensitivity,
  latency,
  sttLatency,
  ttsLatency,
  onStop,
}: Props) {
  const copy = stateCopy[status];
  const normalized = Math.min(1, Math.max(0, (level * sensitivity) / 0.35));
  const bars = Array.from({ length: 18 }, (_, index) => {
    const wave = 0.18 + Math.abs(Math.sin(index * 1.7)) * 0.68;
    const intensity = active ? Math.min(1, normalized * 1.4 + wave * 0.18) : 0.2;
    return Math.max(5, Math.round(7 + intensity * 25));
  });

  return (
    <section
      className="relative z-10 mx-auto mt-3 w-[min(92vw,760px)] rounded-2xl border border-cyan-300/15 bg-slate-950/35 px-4 py-3 shadow-[0_0_40px_rgba(34,211,238,0.08)] backdrop-blur-md"
      aria-label="Alpha JARVIS voice HUD"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-cyan-300/25 bg-cyan-300/10 ${active ? "animate-pulse" : ""}`}>
            {status === "listening" ? <Mic className="h-4 w-4 text-cyan-200" /> : status === "speaking" ? <Radio className="h-4 w-4 text-violet-200" /> : status === "connecting" ? <Activity className="h-4 w-4 text-amber-200" /> : <Sparkles className="h-4 w-4 text-cyan-200" />}
          </span>
          <div className="min-w-0">
            <div className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] ${copy.tone}`}>
              <span>Alpha Core</span>
              <span className="h-1 w-1 rounded-full bg-current opacity-60" />
              <span>{copy.label}</span>
            </div>
            <p className="truncate text-xs text-white/45">{copy.hint}</p>
          </div>
        </div>
        {active && (
          <button
            type="button"
            onClick={onStop}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-red-300/25 bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-100 transition hover:bg-red-400/20 focus:outline-none focus:ring-2 focus:ring-red-300/50"
            aria-label="Stop Alpha voice session"
          >
            <Square className="h-3 w-3 fill-current" />
            Stop
          </button>
        )}
      </div>

      <div className="mt-3 flex h-9 items-center justify-center gap-1" aria-label="Live voice waveform">
        {bars.map((height, index) => (
          <span
            key={index}
            className={`w-1 rounded-full transition-all duration-100 ${active ? (status === "speaking" ? "bg-violet-300/80" : "bg-cyan-300/80") : "bg-white/15"}`}
            style={{ height: `${height}px`, opacity: active ? 0.45 + (index % 4) * 0.12 : 0.35 }}
          />
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-[10px] text-white/45">
        <span className="rounded-full border border-white/10 px-2 py-0.5">Gemini Live</span>
        {sttLatency != null && <span className="rounded-full border border-cyan-300/15 px-2 py-0.5">STT {sttLatency}ms</span>}
        {ttsLatency != null && <span className="rounded-full border border-violet-300/15 px-2 py-0.5">TTS {ttsLatency}ms</span>}
        {latency != null && <span className="rounded-full border border-white/10 px-2 py-0.5">Total {latency}ms</span>}
      </div>
    </section>
  );
}
