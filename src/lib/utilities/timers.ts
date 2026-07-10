// In-app timers. Parses human duration ("5 minute", "2 hour 30 sec"), ticks
// once per second, notifies + beeps on expiry.
import { useCallback, useEffect, useRef, useState } from "react";
import { notify } from "@/lib/electron-bridge";

export type Timer = { id: string; label: string; endsAt: number; total: number };

const UNITS: Record<string, number> = {
  s: 1, sec: 1, secs: 1, second: 1, seconds: 1,
  m: 60, min: 60, mins: 60, minute: 60, minutes: 60,
  h: 3600, hr: 3600, hrs: 3600, hour: 3600, hours: 3600,
};

/** Parse "5 minute", "2h 30m", "45 sec", "1 minute 20 seconds" → seconds. */
export function parseDuration(text: string): number | null {
  const t = text.toLowerCase();
  const re = /(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)\b/g;
  let total = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const n = parseFloat(m[1]);
    const unit = UNITS[m[2]] ?? 0;
    total += n * unit;
  }
  return total > 0 ? Math.round(total) : null;
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.0);
    setTimeout(() => ctx.close(), 1200);
  } catch { /* audio blocked */ }
}

export function useTimers() {
  const [timers, setTimers] = useState<Timer[]>([]);
  const [, tick] = useState(0);
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (timers.length === 0) return;
    const iv = window.setInterval(() => {
      tick((n) => n + 1);
      const now = Date.now();
      for (const t of timers) {
        if (now >= t.endsAt && !firedRef.current.has(t.id)) {
          firedRef.current.add(t.id);
          beep();
          notify("Alpha · Timer", t.label);
        }
      }
    }, 1000);
    return () => window.clearInterval(iv);
  }, [timers]);

  const add = useCallback((seconds: number, label = "Timer") => {
    const t: Timer = { id: crypto.randomUUID(), label, endsAt: Date.now() + seconds * 1000, total: seconds };
    setTimers((prev) => [...prev, t]);
    return t;
  }, []);

  const remove = useCallback((id: string) => {
    firedRef.current.delete(id);
    setTimers((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { timers, add, remove };
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return "0:00";
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
