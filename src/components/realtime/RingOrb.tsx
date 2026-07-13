import { Mic, Loader2 } from "lucide-react";
import type { VoiceStatus } from "@/lib/voice-providers";

type Props = {
  status: VoiceStatus;
  active: boolean;
  disabled: boolean;
  onStart: () => void;
  onStop: () => void;
};

export function RingOrb({ status, active, disabled, onStart, onStop }: Props) {
  const idle = !active && !disabled;
  const label = active
    ? "Stop"
    : status === "connecting"
    ? "Connecting…"
    : "Tap to talk";

  return (
    <section className="lg:col-span-8 flex flex-col items-center justify-center gap-5">
      <button
        type="button"
        onClick={active ? onStop : onStart}
        disabled={disabled && !active}
        aria-label={active ? "Stop voice session" : "Start voice session"}
        aria-busy={status === "connecting"}
        className={`ring-orb ${status} ${idle ? "mic-ring" : ""} ${disabled && !active ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <div className="ring ring-outer" />
        <div className="ring ring-mid" />
        <div className="ring ring-inner" />
        {active ? (
          <div className="bars" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
        ) : status === "connecting" ? (
          <Loader2 className="w-10 h-10 text-cyan-200 animate-spin" strokeWidth={1.5} aria-hidden />
        ) : (
          <Mic className="w-12 h-12 text-cyan-200/90" strokeWidth={1.25} aria-hidden />
        )}
      </button>
      <div className="text-[11px] uppercase tracking-[0.25em] text-cyan-200/70 select-none">
        {label}
      </div>
    </section>
  );
}
