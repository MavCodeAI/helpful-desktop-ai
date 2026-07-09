import { Settings2, History } from "lucide-react";
import type { Pace, ProviderId } from "@/lib/voice-providers";

type Props = {
  provider: ProviderId;
  currentVoice: string;
  pace: Pace;
  rate: number;
  threadCount: number;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
};

export function HeaderPill({
  provider, currentVoice, pace, rate, threadCount, onOpenHistory, onOpenSettings,
}: Props) {
  return (
    <header className="relative z-10 flex items-center justify-between mx-3 sm:mx-6 mt-3 sm:mt-4 px-4 sm:px-6 py-2.5 glass-pill rounded-full">
      <div className="text-xs tracking-widest uppercase text-muted-foreground">
        Realtime · S2S
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenHistory}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 border border-white/10 rounded-full flex items-center gap-1.5 hover:border-cyan-400/40 transition-colors"
          aria-label="Open conversation history"
          title="History"
        >
          <History className="w-3.5 h-3.5 text-cyan-300/90" strokeWidth={1.75} />
          <span className="hidden sm:inline">History</span>
          <span className="text-white/60 tabular-nums">{threadCount}</span>
        </button>
        <div className="hidden sm:flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/60">
          <span className="text-cyan-300/80">{provider === "gemini" ? "Gemini" : "HF"}</span>
          <span>·</span>
          <span className="truncate max-w-[80px] normal-case tracking-normal text-white/60">{currentVoice}</span>
          <span>·</span>
          <span className="normal-case tracking-normal text-white/60">{pace} · {rate}×</span>
        </div>
        <button
          onClick={onOpenSettings}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 border border-white/10 rounded-full flex items-center gap-1.5 hover:border-cyan-400/40 transition-colors"
          aria-label="Open voice settings"
          title="Voice settings"
        >
          <Settings2 className="w-3.5 h-3.5 text-cyan-300/90" strokeWidth={1.75} />
          <span>Settings</span>
        </button>
      </div>
    </header>
  );
}