// Central storage keys and tunables for the realtime voice UI.
// Single source of truth — do not inline these strings elsewhere.

export const STORAGE_KEYS = {
  provider: "voice_provider",
  geminiKey: "gemini_api_key",
  hfVoice: "voice_hf",
  geminiVoice: "voice_gemini",
  pace: "voice_pace",
  rate: "voice_rate",
  sensitivity: "voice_sensitivity",
  autoRate: "voice_auto_rate",
  perfLite: "perfLite",
} as const;

export const RATE_OPTIONS = [0.8, 1.0, 1.2, 1.5] as const;

export const DEFAULTS = {
  hfVoice: "alloy",
  geminiVoice: "Aoede",
  pace: "natural" as const,
  rate: 1.0,
  sensitivity: 1,
  autoRate: false,
  liteMode: "auto" as const,
};

export type LiteMode = "auto" | "on" | "off";