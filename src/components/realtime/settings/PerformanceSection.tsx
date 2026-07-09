import type { LiteMode } from "@/lib/realtime/constants";

interface Props {
  autoRate: boolean;
  toggleAutoRate: (v: boolean) => void;
  liteMode: LiteMode;
  liteActive: boolean;
  changeLiteMode: (v: LiteMode) => void;
  sttLatency: number | null;
  ttsLatency: number | null;
  latency: number | null;
}

export function PerformanceSection({
  autoRate, toggleAutoRate, liteMode, liteActive, changeLiteMode,
  sttLatency, ttsLatency, latency,
}: Props) {
  return (
    <section>
      <h3 className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/80 font-semibold mb-2">
        Performance
      </h3>
      <label className={`glass-item ${autoRate ? "glass-item-active" : ""} flex items-start gap-2.5 text-xs cursor-pointer p-3 rounded-md mb-3`}>
        <input
          type="checkbox"
          checked={autoRate}
          onChange={(e) => toggleAutoRate(e.target.checked)}
          className="accent-cyan-400 mt-0.5"
        />
        <span className="flex-1">
          <div className="font-semibold">Auto-adapt speed</div>
          <div className="text-[10px] text-white/65 mt-0.5">
            Nudges playback speed up when latency rises, so replies feel responsive.
          </div>
        </span>
      </label>
      <div className="mb-3">
        <div className="flex items-baseline justify-between mb-1.5">
          <div className="text-[10px] uppercase tracking-widest text-white/60">
            Lite mode <span className="text-white/45 normal-case tracking-normal">(blur & motion)</span>
          </div>
          <div className="text-[10px] text-white/60">{liteActive ? "active" : "off"}</div>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {(["auto", "on", "off"] as const).map((m) => (
            <button
              key={m}
              onClick={() => changeLiteMode(m)}
              className={`glass-item ${liteMode === m ? "glass-item-active" : ""} text-xs px-2 py-2 rounded-md min-h-11 capitalize`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="text-[10px] text-white/60 mt-1.5">
          Drops backdrop-blur and pauses aurora animations for smoother frames on low-end GPUs.
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="glass-item rounded-md px-2 py-2" style={{ borderColor: "oklch(0.82 0.14 200 / 0.35)" }}>
          <div className="text-[9px] uppercase tracking-widest text-cyan-300/80">STT</div>
          <div className="text-xs tabular-nums text-white/90 mt-0.5">
            {sttLatency != null ? `${sttLatency}ms` : "—"}
          </div>
        </div>
        <div className="glass-item rounded-md px-2 py-2" style={{ borderColor: "oklch(0.72 0.18 300 / 0.35)" }}>
          <div className="text-[9px] uppercase tracking-widest text-violet-300/80">TTS</div>
          <div className="text-xs tabular-nums text-white/90 mt-0.5">
            {ttsLatency != null ? `${ttsLatency}ms` : "—"}
          </div>
        </div>
        <div className="glass-item rounded-md px-2 py-2">
          <div className="text-[9px] uppercase tracking-widest text-white/65">Σ Total</div>
          <div className="text-xs tabular-nums text-white/90 mt-0.5">
            {latency != null ? `${latency}ms` : "—"}
          </div>
        </div>
      </div>
    </section>
  );
}