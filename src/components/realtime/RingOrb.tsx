import { Mic, Square, Loader2 } from "lucide-react";
import type { VoiceStatus } from "@/lib/voice-providers";

type Props = {
  status: VoiceStatus;
  active: boolean;
  disabled: boolean;
  onStart: () => void;
  onStop: () => void;
};

export function RingOrb({ status, active, disabled, onStart, onStop }: Props) {
  return (
    <section className="lg:col-span-8 flex items-center justify-center gap-4 sm:gap-16">
      <button
        onClick={onStart}
        disabled={active || disabled}
        aria-label="Start voice session"
        aria-busy={status === "connecting"}
        className={`side-btn ${!active && !disabled ? "mic-ring" : ""} ${active || disabled ? "opacity-40 cursor-not-allowed" : "hover:border-cyan-400/40"}`}
      >
        {status === "connecting" ? (
          <Loader2 className="w-5 h-5 text-cyan-200 animate-spin" strokeWidth={1.75} />
        ) : (
          <Mic className="w-5 h-5 text-cyan-200" strokeWidth={1.75} />
        )}
      </button>

      <button
        type="button"
        onClick={active ? onStop : onStart}
        disabled={disabled && !active}
        aria-label={active ? "Stop voice session" : "Start voice session"}
        className={`ring-orb ${status} ${disabled && !active ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <div className="ring ring-outer" />
        <div className="ring ring-mid" />
        <div className="ring ring-inner" />
        <div className="bars" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />
          ))}
        </div>
      </button>

      <button
        onClick={onStop}
        disabled={!active}
        aria-label="Stop voice session"
        className={`side-btn ${!active ? "opacity-40 cursor-not-allowed" : "hover:border-red-400/40"}`}
      >
        <Square className="w-4 h-4 text-foreground fill-foreground" />
      </button>
    </section>
  );
}