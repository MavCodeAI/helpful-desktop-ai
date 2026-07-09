/**
 * TTS user preferences (voice, speed, volume) persisted in localStorage.
 *
 * - `voice`  → passed to /api/tts and forwarded to the model.
 * - `speed`  → passed to /api/tts (0.5–2.0, model-side speed change).
 * - `volume` → applied client-side on the <audio> element (0.0–1.0).
 */

export type TTSVoice = "onyx" | "alloy" | "echo" | "fable" | "nova" | "shimmer";

export interface TTSSettings {
  voice: TTSVoice;
  speed: number;
  volume: number;
  /** Multiplier applied to mic level/peak before the VolumeMeter classifies
   *  the zone. 1.0 = raw signal; <1 tolerates louder rooms, >1 boosts quiet
   *  mics. Persisted so a user's room calibration survives reloads. */
  micSensitivity: number;
  /** When true, JARVIS nudges TTS speed up slightly under high measured
   *  round-trip latency so the perceived pace stays responsive. The user's
   *  `speed` is treated as a baseline; the adjustment is bounded (±0.3×). */
  autoAdaptivePace: boolean;
}

export const DEFAULT_TTS_SETTINGS: TTSSettings = {
  voice: "onyx",
  speed: 1.0,
  volume: 1.0,
  micSensitivity: 1.0,
  autoAdaptivePace: false,
};

/**
 * Derive an effective speaking rate from a base user speed and recent
 * pipeline latency (STT + TTS handshake, ms). When adaptive mode is off,
 * returns the base unchanged. Adjustment is clamped so it never drifts
 * more than ±0.3× from what the user set — nobody expects auto-mode to
 * hijack their preferred pace, only to compensate for slow networks.
 */
export function adaptiveSpeed(base: number, latencyMs: number, enabled: boolean): number {
  if (!enabled) return base;
  // Under 1s round-trip everything already feels snappy — no adjustment.
  // Beyond that, add ~0.1× per extra second, capped at +0.3×.
  const extra = Math.max(0, latencyMs - 1000) / 1000;
  const bump = Math.min(0.3, extra * 0.1);
  return Math.min(2, Math.max(0.5, base + bump));
}

export const VOICE_OPTIONS: { id: TTSVoice; label: string }[] = [
  { id: "onyx", label: "Onyx — Deep butler" },
  { id: "alloy", label: "Alloy — Neutral" },
  { id: "echo", label: "Echo — Warm" },
  { id: "fable", label: "Fable — Storyteller" },
  { id: "nova", label: "Nova — Bright" },
  { id: "shimmer", label: "Shimmer — Soft" },
];

/** Quick-pick pace presets — for the settings sheet chip row. */
export const SPEED_PRESETS: { id: string; label: string; value: number }[] = [
  { id: "slow", label: "Slow", value: 0.8 },
  { id: "normal", label: "Normal", value: 1.0 },
  { id: "fast", label: "Fast", value: 1.2 },
  { id: "faster", label: "Faster", value: 1.5 },
];

/** Human-readable label for the closest pace preset to a given speed value. */
export function paceLabel(speed: number): string {
  let best = SPEED_PRESETS[1];
  let bestDist = Math.abs(speed - best.value);
  for (const p of SPEED_PRESETS) {
    const d = Math.abs(speed - p.value);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best.label;
}

const KEY = "jarvis.tts.settings.v1";

/** Load settings from localStorage; falls back to defaults. Safe on SSR. */
export function loadTTSSettings(): TTSSettings {
  if (typeof window === "undefined") return DEFAULT_TTS_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_TTS_SETTINGS;
    return { ...DEFAULT_TTS_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_TTS_SETTINGS;
  }
}

/**
 * Persist settings to localStorage. Swallows quota/serialisation errors —
 * settings are a convenience, not core data; losing them just resets to
 * defaults on the next visit, which is preferable to a crash mid-slider.
 */
export function saveTTSSettings(s: TTSSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (e) {
    console.warn("[tts-settings] persist failed", e);
  }
}
