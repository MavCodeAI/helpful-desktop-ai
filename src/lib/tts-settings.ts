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

/** Persist settings to localStorage. */
export function saveTTSSettings(s: TTSSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}
