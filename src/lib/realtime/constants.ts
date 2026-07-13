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
  wakeClap: "wake_clap",
  wakeWord: "wake_word",
  wakeHotkey: "wake_hotkey",
  confirmBeforeOpen: "confirm_before_open",
  desktopAutoLaunch: "desktop_auto_launch",
  persona: "alpha_persona",
  customPrompt: "alpha_persona_custom",
  lang: "alpha_lang",
  webCitations: "web_citations",
  wakePhrases: "wake_phrases",
  hotkeyCombo: "hotkey_combo",
} as const;

export const WEB_CITATIONS_DEFAULT = true;

export function loadWebCitations(): boolean {
  if (typeof window === "undefined") return WEB_CITATIONS_DEFAULT;
  try {
    const v = window.localStorage.getItem(STORAGE_KEYS.webCitations);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch { /* ignore */ }
  return WEB_CITATIONS_DEFAULT;
}

export function saveWebCitations(v: boolean): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEYS.webCitations, v ? "1" : "0"); } catch { /* ignore */ }
}

export const RATE_OPTIONS = [0.8, 1.0, 1.2, 1.5] as const;

export const DEFAULTS = {
  hfVoice: "alloy",
  geminiVoice: "Aoede",
  pace: "natural" as const,
  rate: 1.0,
  sensitivity: 1,
  autoRate: false,
  liteMode: "auto" as const,
  wakeClap: false,
  wakeWord: false,
  wakeHotkey: true,
  confirmBeforeOpen: false,
  desktopAutoLaunch: false,
};

export type LiteMode = "auto" | "on" | "off";

/** Human-readable hotkey combo — Ctrl+Shift+A (A for Alpha). */
export const HOTKEY_LABEL = "Ctrl+Shift+A";
