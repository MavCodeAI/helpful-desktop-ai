import { useEffect, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Animated bars used inside the orb while listening. Purely visual, driven
 *  by shared mic amplitude. */
export function OrbWaveBars({ level, hue }: { level: number; hue: number }) {
  const [, force] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const tick = () => { force((n) => (n + 1) & 0xffff); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);
  const bars = 7;
  const now = Date.now() / 140;
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => {
        const wave = Math.abs(Math.sin(now + i * 0.7));
        const h = 8 + wave * (12 + level * 50);
        return (
          <span
            key={i}
            className="rounded-full"
            style={{
              width: 3,
              height: `${h}px`,
              background: `hsl(${hue} 95% 75%)`,
              boxShadow: `0 0 8px hsl(${hue} 95% 65% / 0.8)`,
              opacity: 0.4 + wave * 0.6,
            }}
          />
        );
      })}
    </div>
  );
}
