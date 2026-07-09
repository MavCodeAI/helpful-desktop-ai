import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Scrolling live waveform — rolling buffer of mic amplitudes rendered as
 * vertical bars. Bars slide right→left every frame; newest sample lands
 * at the right edge. Height maps to loudness. Purely visual, driven by
 * `level` (0..1) from the shared analyser.
 */
export function LiveWaveform({ level, paused }: { level: number; paused: boolean }) {
  const BARS = 40;
  const bufferRef = useRef<number[]>(Array(BARS).fill(0.05));
  const [, force] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const tick = () => {
      const buf = bufferRef.current;
      const sample = paused
        ? 0.04 + Math.random() * 0.02
        : Math.max(0.05, Math.min(1, level * 1.4));
      for (let i = 0; i < BARS - 1; i++) buf[i] = buf[i + 1];
      buf[BARS - 1] = sample;
      force((n) => (n + 1) & 0xffff);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [level, paused, reduced]);

  const H = 24;
  const W = BARS * 3;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="shrink-0" aria-hidden="true">
      {bufferRef.current.map((v, i) => {
        const barH = Math.max(2, v * H);
        const x = i * 3;
        const y = (H - barH) / 2;
        const ageOpacity = 0.35 + (i / BARS) * 0.65;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={2}
            height={barH}
            rx={1}
            className={paused ? "fill-amber-400/70" : "fill-emerald-400"}
            opacity={ageOpacity}
          />
        );
      })}
    </svg>
  );
}
