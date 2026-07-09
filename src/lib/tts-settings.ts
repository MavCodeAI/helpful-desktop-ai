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
}

export const DEFAULT_TTS_SETTINGS: TTSSettings = {
  voice: "onyx",
  speed: 1.0,
  volume: 1.0,
};

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
