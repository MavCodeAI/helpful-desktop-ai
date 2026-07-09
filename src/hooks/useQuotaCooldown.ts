/**
 * Countdown timer for 402 (credits exhausted) / 429 (rate limit) responses.
 *
 * When the gateway returns a `Retry-After` header we honor it exactly;
 * otherwise we use a sensible default so the UI still shows a meaningful
 * cooldown instead of nothing.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_COOLDOWN_SEC = 30;

export function useQuotaCooldown() {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [reason, setReason] = useState<"quota" | "rate" | null>(null);
  const endsAtRef = useRef<number>(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) setReason(null);
    }, 250);
    return () => window.clearInterval(id);
  }, [secondsLeft]);

  const start = useCallback((seconds: number, kind: "quota" | "rate") => {
    const safe = Math.min(600, Math.max(1, Math.floor(seconds)));
    endsAtRef.current = Date.now() + safe * 1000;
    setReason(kind);
    setSecondsLeft(safe);
  }, []);

  /**
   * Inspect a failed Response and start a cooldown if it looks like a
   * quota/rate limit. Returns true if a cooldown was started.
   */
  const startFromResponse = useCallback(
    async (res: Response): Promise<boolean> => {
      if (res.status !== 402 && res.status !== 429) return false;
      const header = res.headers.get("retry-after");
      let secs = DEFAULT_COOLDOWN_SEC;
      if (header) {
        const asInt = parseInt(header, 10);
        if (Number.isFinite(asInt) && asInt > 0) secs = asInt;
        else {
          const asDate = Date.parse(header);
          if (Number.isFinite(asDate)) {
            secs = Math.max(1, Math.round((asDate - Date.now()) / 1000));
          }
        }
      }
      start(secs, res.status === 402 ? "quota" : "rate");
      return true;
    },
    [start],
  );

  /** Parse an error message like "402 credits exhausted" and start a cooldown. */
  const startFromErrorMessage = useCallback(
    (msg: string): boolean => {
      const m = msg.toLowerCase();
      if (m.includes("402") || m.includes("credit") || m.includes("quota")) {
        start(DEFAULT_COOLDOWN_SEC, "quota");
        return true;
      }
      if (m.includes("429") || m.includes("rate")) {
        start(DEFAULT_COOLDOWN_SEC, "rate");
        return true;
      }
      return false;
    },
    [start],
  );

  const clear = useCallback(() => {
    endsAtRef.current = 0;
    setSecondsLeft(0);
    setReason(null);
  }, []);

  return {
    secondsLeft,
    reason,
    active: secondsLeft > 0,
    start,
    startFromResponse,
    startFromErrorMessage,
    clear,
  };
}
