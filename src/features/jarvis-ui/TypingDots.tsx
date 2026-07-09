import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Three-dot typing/thinking indicator. Hue-driven to match preview caption
 *  palette; bounces gently so it reads as "waiting" without being noisy.
 *  Respects reduced motion (falls back to a soft pulse). */
export function TypingDots({ hue, label }: { hue: number; label?: string }) {
  const reduced = useReducedMotion();
  const color = `hsl(${hue} 85% 70%)`;
  const glow = `hsl(${hue} 90% 60% / 0.55)`;
  return (
    <div
      className="flex items-center gap-2 sm:gap-1.5 py-1"
      role="status"
      aria-live="polite"
      aria-label={label ?? "Loading"}
    >
      {[0, 160, 320].map((delay) => (
        <span
          key={delay}
          className={`inline-block w-2 h-2 sm:w-1.5 sm:h-1.5 rounded-full ${
            reduced ? "motion-safe:animate-pulse" : "motion-safe:animate-bounce"
          }`}
          style={{
            background: color,
            boxShadow: `0 0 6px ${glow}`,
            animationDelay: `${delay}ms`,
            animationDuration: "1s",
          }}
        />
      ))}
    </div>
  );
}
