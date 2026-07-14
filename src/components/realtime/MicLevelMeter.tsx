import { memo } from "react";

type Props = {
  /** Raw RMS 0..~0.5 from analyser. */
  level: number;
  /** User sensitivity multiplier. */
  sensitivity?: number;
  /** Number of bars. */
  bars?: number;
  /** Compact = short bars for inline use next to a control. */
  size?: "sm" | "md";
  ariaLabel?: string;
  className?: string;
};

/** Visual mic-level meter (cyan → amber → red) driven by analyser RMS. */
export const MicLevelMeter = memo(function MicLevelMeter({
  level,
  sensitivity = 1,
  bars = 20,
  size = "md",
  ariaLabel = "Microphone level",
  className = "",
}: Props) {
  const norm = Math.max(0, Math.min(1, (level * sensitivity) / 0.35));
  const filled = Math.round(norm * bars);
  const base = size === "sm" ? 4 : 6;
  const step = size === "sm" ? 0.3 : 0.4;
  const cutoffAmber = Math.floor(bars * 0.7);
  const cutoffRed = Math.floor(bars * 0.85);
  return (
    <div
      className={`flex items-center gap-0.5 h-4 ${className}`}
      role="meter"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(norm * 100)}
    >
      {Array.from({ length: bars }).map((_, i) => {
        const on = i < filled;
        const hue =
          i < cutoffAmber ? "bg-cyan-300" : i < cutoffRed ? "bg-amber-300" : "bg-red-400";
        return (
          <span
            key={i}
            className={`flex-1 rounded-sm transition-opacity duration-75 ${on ? hue : "bg-white/10"}`}
            style={{ height: `${base + i * step}px`, opacity: on ? 1 : 0.35 }}
          />
        );
      })}
    </div>
  );
});
