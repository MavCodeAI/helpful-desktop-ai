import type React from "react";

/** Small circular button that flanks the orb (mic on the left, stop on the
 *  right). Mic variant paints a mic-level arc around itself. */
export function OrbSideButton({
  icon, hue, level, onClick, ariaLabel, showArc, muted, disabled,
}: {
  icon: React.ReactNode; hue: number; level: number;
  onClick: () => void; ariaLabel: string;
  showArc?: boolean; muted?: boolean; disabled?: boolean;
}) {
  const size = 48;
  const arcActive = showArc && level > 0.01;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      className="relative grid place-items-center rounded-full outline-none transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-jarvis focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      style={{ width: size, height: size }}
    >
      {showArc && (
        <svg className="absolute -inset-1" viewBox="0 0 56 56" fill="none" aria-hidden>
          <circle
            cx="28" cy="28" r="26"
            stroke={`hsl(${hue} 90% 60% / ${arcActive ? 0.9 : 0.3})`}
            strokeWidth="1.5"
            strokeDasharray={`${34 + level * 80} 180`}
            strokeLinecap="round"
            transform="rotate(120 28 28)"
            style={{ filter: `drop-shadow(0 0 4px hsl(${hue} 90% 60% / 0.6))` }}
          />
        </svg>
      )}
      <div
        className="grid place-items-center rounded-full backdrop-blur"
        style={{
          width: size, height: size,
          background: muted
            ? "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))"
            : `linear-gradient(180deg, hsl(${hue} 40% 20% / 0.55), hsl(${hue} 30% 10% / 0.55))`,
          border: `1px solid hsl(${hue} 50% 60% / ${muted ? 0.15 : 0.35})`,
          color: muted ? "rgba(255,255,255,0.85)" : `hsl(${hue} 90% 85%)`,
          boxShadow: muted ? "none" : `0 0 18px hsl(${hue} 80% 50% / 0.25)`,
        }}
      >
        {icon}
      </div>
    </button>
  );
}
