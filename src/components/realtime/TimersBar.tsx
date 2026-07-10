import { X, Timer as TimerIcon } from "lucide-react";
import { formatRemaining, type Timer } from "@/lib/utilities/timers";

interface Props {
  timers: Timer[];
  onRemove: (id: string) => void;
}

/** Floating pill showing active timers with countdowns. */
export function TimersBar({ timers, onRemove }: Props) {
  if (timers.length === 0) return null;
  const now = Date.now();
  return (
    <div className="fixed bottom-4 left-4 z-30 flex flex-col gap-1.5 max-w-[240px]">
      {timers.map((t) => {
        const remaining = t.endsAt - now;
        const done = remaining <= 0;
        return (
          <div
            key={t.id}
            className={`glass-card flex items-center gap-2 px-3 py-2 rounded-full border ${
              done ? "border-emerald-400/50 bg-emerald-400/10" : "border-cyan-400/30 bg-cyan-400/[0.05]"
            }`}
          >
            <TimerIcon className={`w-3.5 h-3.5 shrink-0 ${done ? "text-emerald-300" : "text-cyan-300"}`} />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-widest text-white/60 truncate">{t.label}</div>
              <div className={`text-sm font-semibold tabular-nums ${done ? "text-emerald-200" : "text-white/90"}`}>
                {done ? "Done!" : formatRemaining(remaining)}
              </div>
            </div>
            <button
              onClick={() => onRemove(t.id)}
              className="shrink-0 p-1 rounded-full hover:bg-white/10 text-white/60 hover:text-white"
              aria-label="Dismiss timer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
