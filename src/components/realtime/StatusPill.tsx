import type { VoiceStatus } from "@/lib/voice-providers";

type Props = {
  status: VoiceStatus;
  disabled: boolean;
  active: boolean;
  cooldown: number;
  micTest: boolean;
  level: number;
  sensitivity: number;
  sttLatency: number | null;
  ttsLatency: number | null;
  latency: number | null;
  rate: number;
  autoRate: boolean;
};

export function StatusPill({
  status, disabled, active, cooldown, micTest, level, sensitivity,
  sttLatency, ttsLatency, latency, rate, autoRate,
}: Props) {
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm sm:text-xs text-cyan-200/90 font-light tracking-wide">
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          status === "listening" ? "bg-cyan-300 animate-pulse" :
          status === "speaking"  ? "bg-violet-300 animate-pulse" :
          status === "connecting"? "bg-amber-300 animate-pulse" :
          status === "error"     ? "bg-red-400" :
                                   "bg-white/30"
        }`}
        aria-hidden
      />
      {disabled && !active && `Retry in ${cooldown}s`}
      {!disabled && status === "idle" && "Tap the mic to begin"}
      {status === "connecting" && "Connecting…"}
      {status === "listening" && "Listening"}
      {status === "speaking" && "Speaking"}
      {!disabled && status === "error" && "Error"}
      {micTest && status === "idle" && <span className="text-amber-300/90">Mic test</span>}
      {(active || micTest) && (
        <div className="flex items-center gap-0.5 h-3" aria-label="Mic input level" title="Mic input">
          {Array.from({ length: 12 }).map((_, i) => {
            const norm = Math.min(1, (level * sensitivity) / 0.35);
            const on = norm * 12 > i;
            const hue = i < 8 ? "bg-cyan-300" : i < 10 ? "bg-amber-300" : "bg-red-400";
            return (
              <span
                key={i}
                className={`w-[3px] rounded-sm transition-opacity duration-75 ${on ? hue : "bg-white/10"}`}
                style={{ height: `${4 + i * 0.6}px`, opacity: on ? 1 : 0.4 }}
              />
            );
          })}
        </div>
      )}
      {sttLatency != null && (
        <span
          className="tabular-nums text-[10px] px-1.5 py-0.5 rounded-full border border-cyan-400/20 bg-cyan-400/5 text-cyan-200/90"
          title="STT: your last speech → first transcript"
        >
          STT {sttLatency}ms
        </span>
      )}
      {ttsLatency != null && (
        <span
          className="tabular-nums text-[10px] px-1.5 py-0.5 rounded-full border border-violet-400/20 bg-violet-400/5 text-violet-200/90"
          title="TTS: first transcript → first assistant audio"
        >
          TTS {ttsLatency}ms
        </span>
      )}
      {latency != null && (
        <span
          className="tabular-nums text-[10px] px-1.5 py-0.5 rounded-full border border-white/10 text-white/70"
          title="Total: your last speech → first assistant audio"
        >
          Σ {latency}ms
        </span>
      )}
      <span
        className="text-[10px] text-white/60"
        title={autoRate ? "Auto-adapting to latency" : "Playback speed"}
      >
        {rate.toFixed(2).replace(/\.?0+$/, "")}×{autoRate ? " · auto" : ""}
      </span>
    </div>
  );
}