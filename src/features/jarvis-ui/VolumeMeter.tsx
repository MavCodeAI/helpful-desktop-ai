/**
 * Volume meter with a colored quality zone and peak-hold marker.
 * See src/routes/jarvis.tsx history for full spec.
 */
export function VolumeMeter({ level, peak, sensitivity = 1 }: { level: number; peak: number; sensitivity?: number }) {
  const scaledLevel = Math.max(0, Math.min(1, level * sensitivity));
  const scaledPeak = Math.max(0, Math.min(1, peak * sensitivity));
  const pct = scaledLevel * 100;
  const peakPct = scaledPeak * 100;
  const zone =
    scaledPeak < 0.05 ? "silent" :
    scaledLevel < 0.15 ? "quiet" :
    scaledPeak > 0.9 ? "clip" :
    "good";
  const barColor =
    zone === "silent" ? "bg-muted-foreground/40" :
    zone === "quiet" ? "bg-red-400" :
    zone === "clip" ? "bg-amber-400" :
    "bg-emerald-400";
  const label =
    zone === "silent" ? "No signal" :
    zone === "quiet" ? "Too quiet" :
    zone === "clip" ? "Clipping" :
    "Good";
  const labelColor =
    zone === "silent" ? "text-muted-foreground/70" :
    zone === "quiet" ? "text-red-300" :
    zone === "clip" ? "text-amber-300" :
    "text-emerald-300";
  return (
    <div className="flex items-center gap-2 min-w-0" role="meter" aria-label={`Input level ${Math.round(pct)}%, ${label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <div className="relative h-2 w-32 sm:w-40 rounded-full bg-white/5 overflow-hidden ring-1 ring-white/10">
        <div className="absolute inset-y-0 left-[15%] right-[15%] bg-emerald-400/5" aria-hidden="true" />
        <div
          className={`absolute inset-y-0 left-0 ${barColor} transition-[width] duration-75 ease-out`}
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
        {scaledPeak > 0.02 && (
          <div
            className={`absolute top-0 bottom-0 w-[2px] ${zone === "clip" ? "bg-amber-200" : "bg-white/70"}`}
            style={{ left: `calc(${peakPct}% - 1px)` }}
            aria-hidden="true"
          />
        )}
      </div>
      <span className={`text-[9px] font-semibold uppercase tracking-[0.2em] whitespace-nowrap ${labelColor}`}>
        {label}
      </span>
    </div>
  );
}
