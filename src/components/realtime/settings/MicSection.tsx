interface Props {
  active: boolean;
  micPermission: "unknown" | "granted" | "denied" | "prompt";
  sensitivity: number;
  changeSensitivity: (v: number) => void;
  micTest: boolean;
  startMicTestMode: () => void;
  stopMicTest: () => void;
  level: number;
}

export function MicSection({
  active, micPermission, sensitivity, changeSensitivity,
  micTest, startMicTestMode, stopMicTest, level,
}: Props) {
  return (
    <section>
      <h3 className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/80 font-semibold mb-2">
        Device & Microphone
      </h3>
      <div className="glass-item flex items-center justify-between text-xs mb-3 px-3 py-2 rounded-md">
        <span className="text-white/60">Mic permission</span>
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
            micPermission === "granted" ? "text-emerald-300" :
            micPermission === "denied"  ? "text-red-300" :
            "text-amber-300"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${
            micPermission === "granted" ? "bg-emerald-400" :
            micPermission === "denied"  ? "bg-red-400" :
            "bg-amber-400"
          }`} />
          {micPermission === "unknown" ? "unknown" : micPermission}
        </span>
      </div>
      <div className="text-[10px] uppercase tracking-widest text-white/60 mb-1.5">
        Sensitivity <span className="text-white/55 normal-case tracking-normal">({sensitivity.toFixed(1)}×)</span>
      </div>
      <input
        type="range"
        min={0.5}
        max={3}
        step={0.1}
        value={sensitivity}
        onChange={(e) => changeSensitivity(parseFloat(e.target.value))}
        className="w-full accent-cyan-400"
        aria-label="Mic sensitivity"
      />
      <div className="flex justify-between text-[9px] text-white/60 mt-0.5 mb-3">
        <span>Quiet room</span>
        <span>Loud room</span>
      </div>
      <button
        onClick={micTest ? stopMicTest : startMicTestMode}
        disabled={active}
        className={`glass-item ${micTest ? "glass-item-danger" : ""} w-full text-xs px-3 py-2 rounded-md`}
      >
        {micTest ? "■ Stop mic test" : "🎤 Test mic (no send)"}
      </button>
      {micTest && (
        <div className="mt-2 flex items-center gap-0.5 h-4" aria-label="Mic level">
          {Array.from({ length: 20 }).map((_, i) => {
            const norm = Math.min(1, (level * sensitivity) / 0.35);
            const on = norm * 20 > i;
            const hue = i < 14 ? "bg-cyan-300" : i < 17 ? "bg-amber-300" : "bg-red-400";
            return (
              <span
                key={i}
                className={`flex-1 rounded-sm transition-opacity duration-75 ${on ? hue : "bg-white/10"}`}
                style={{ height: `${6 + i * 0.4}px`, opacity: on ? 1 : 0.35 }}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}