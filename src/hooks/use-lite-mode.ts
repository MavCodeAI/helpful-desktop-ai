import { useEffect, useState } from "react";
import type { LiteMode } from "@/lib/realtime/constants";

/**
 * Resolves the effective lite-mode flag and toggles the `perf-lite` class on
 * <html>. Auto mode probes device memory, cores, and reduced-motion once.
 */
export function useLiteMode(mode: LiteMode): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    let resolved = false;
    if (mode === "on") resolved = true;
    else if (mode === "off") resolved = false;
    else {
      const nav = navigator as Navigator & { deviceMemory?: number };
      const lowMem = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4;
      const lowCpu =
        typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 4;
      const reduced =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      resolved = lowMem || lowCpu || reduced;
    }
    setActive(resolved);
    document.documentElement.classList.toggle("perf-lite", resolved);
  }, [mode]);
  return active;
}