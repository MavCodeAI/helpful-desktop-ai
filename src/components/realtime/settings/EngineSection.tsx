import type { ProviderId } from "@/lib/voice-providers";

interface Props {
  active: boolean;
  provider: ProviderId;
  changeProvider: (p: ProviderId) => void;
  geminiKeyReady: boolean;
}

export function EngineSection({ active, provider, changeProvider, geminiKeyReady }: Props) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/80 font-semibold">
          Engine · STT/TTS
        </h3>
        {active && <span className="text-[10px] text-amber-300/80">Restart to apply</span>}
      </div>
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {(["hf", "gemini"] as ProviderId[]).map((p) => (
          <button
            key={p}
            onClick={() => changeProvider(p)}
            className={`glass-item ${provider === p ? "glass-item-active" : ""} text-xs px-3 py-2 rounded-md text-left`}
          >
            <div className="font-semibold">{p === "hf" ? "HF Realtime" : "Gemini Live"}</div>
            <div className="text-[10px] text-white/60 mt-0.5">
              {p === "hf" ? "Free · anon quota" : "Server key"}
            </div>
          </button>
        ))}
      </div>
      {provider === "gemini" && (
        <div className="text-[10px] text-white/50 px-1">
          {geminiKeyReady
            ? "✓ Gemini key configured on server"
            : "⚠ Server key missing — set GEMINI_API_KEY env"}
        </div>
      )}
    </section>
  );
}
