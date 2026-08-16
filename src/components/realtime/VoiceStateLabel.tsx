import { Loader2, Mic, MicOff, Volume2 } from "lucide-react";
import type { VoiceStatus } from "@/lib/voice-providers";

type Props = {
  status: VoiceStatus;
  active: boolean;
  disabled?: boolean;
};

const STATE_COPY: Record<VoiceStatus, { label: string; hint: string }> = {
  idle: { label: "Ready", hint: "Tap the microphone or type a command" },
  connecting: { label: "Connecting", hint: "Preparing your secure voice session" },
  listening: { label: "Listening", hint: "Speak naturally — Alpha is listening" },
  speaking: { label: "Speaking", hint: "Alpha is preparing your response" },
  error: { label: "Needs attention", hint: "Check the message below or try again" },
};

export function VoiceStateLabel({ status, active, disabled = false }: Props) {
  const state = disabled ? { label: "Cooling down", hint: "Please wait a moment before trying again" } : STATE_COPY[status];
  const Icon = status === "speaking" ? Volume2 : status === "error" ? MicOff : status === "idle" ? Mic : Loader2;
  const spinning = status === "connecting";

  return (
    <div className="mx-auto flex w-full max-w-sm items-center justify-center gap-2 px-3 text-center" aria-live="polite">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${status === "error" ? "border-rose-300/30 bg-rose-300/10 text-rose-200" : active ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-200" : "border-white/10 bg-white/[0.04] text-white/60"}`}>
        <Icon className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} aria-hidden="true" />
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-xs font-semibold tracking-wide text-white/85">{state.label}</span>
        <span className="block truncate text-[11px] text-white/45">{state.hint}</span>
      </span>
    </div>
  );
}
