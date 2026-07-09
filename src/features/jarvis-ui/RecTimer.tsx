import { useEffect, useState } from "react";

/** MM:SS elapsed timer since `startedAt` (or null → renders nothing). */
export function RecTimer({ startedAt, paused }: { startedAt: number | null; paused: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt == null || paused) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [startedAt, paused]);
  if (startedAt == null) return null;
  const secs = Math.floor((now - startedAt) / 1000);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return (
    <span className="font-mono text-[11px] tabular-nums text-foreground/80">
      {mm}:{ss}
    </span>
  );
}
