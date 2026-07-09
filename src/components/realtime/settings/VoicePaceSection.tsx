import { RATE_OPTIONS } from "@/lib/realtime/constants";
import type { Pace } from "@/lib/voice-providers";

interface Props {
  currentVoice: string;
  voiceList: readonly string[];
  changeVoice: (v: string) => void;
  pace: Pace;
  changePace: (p: Pace) => void;
  rate: number;
  changeRate: (r: number) => void;
}

export function VoicePaceSection({ currentVoice, voiceList, changeVoice, pace, changePace, rate, changeRate }: Props) {
  return (
    <section>
      <h3 className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/80 font-semibold mb-2">
        Voice & Pace
      </h3>
      <div className="text-[10px] uppercase tracking-widest text-white/60 mb-1.5">Voice</div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 mb-3">
        {voiceList.map((v) => (
          <button
            key={v}
            onClick={() => changeVoice(v)}
            className={`glass-item ${currentVoice === v ? "glass-item-active" : ""} text-xs px-2 py-2 rounded-md min-h-11`}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-white/60 mb-1.5">Pace</div>
      <div className="grid grid-cols-3 gap-1 mb-3">
        {(["slow", "natural", "brisk"] as Pace[]).map((p) => (
          <button
            key={p}
            onClick={() => changePace(p)}
            className={`glass-item ${pace === p ? "glass-item-active-violet" : ""} text-xs px-2 py-2 rounded-md min-h-11 capitalize`}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-white/60 mb-1.5">
        Speed <span className="text-white/55 normal-case tracking-normal">(live)</span>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {RATE_OPTIONS.map((r) => (
          <button
            key={r}
            onClick={() => changeRate(r)}
            className={`glass-item ${Math.abs(rate - r) < 0.01 ? "glass-item-active" : ""} text-xs px-2 py-2 rounded-md min-h-11`}
          >
            {r}×
          </button>
        ))}
      </div>
    </section>
  );
}