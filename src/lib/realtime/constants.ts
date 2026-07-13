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

export type HotkeyCombo = {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  key: string; // single character, lowercase (e.g. "a")
};

export const DEFAULT_HOTKEY: HotkeyCombo = {
  ctrl: true, shift: true, alt: false, meta: false, key: "a",
};

export const DEFAULT_WAKE_PHRASES = [
  "hey alpha", "hi alpha", "ok alpha", "alpha wake",
  "aey alpha", "او الفا", "الو الفا",
  "مرحبا الفا", "مرحبا ألفا", "يا ألفا", "يا الفا",
] as const;

export function formatHotkey(h: HotkeyCombo): string {
  const parts: string[] = [];
  if (h.ctrl) parts.push("Ctrl");
  if (h.meta) parts.push("Cmd");
  if (h.alt) parts.push("Alt");
  if (h.shift) parts.push("Shift");
  parts.push(h.key.length === 1 ? h.key.toUpperCase() : h.key);
  return parts.join("+");
}

export function loadHotkey(): HotkeyCombo {
  if (typeof window === "undefined") return DEFAULT_HOTKEY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.hotkeyCombo);
    if (!raw) return DEFAULT_HOTKEY;
    const p = JSON.parse(raw);
    if (p && typeof p.key === "string" && p.key.length >= 1) {
      return {
        ctrl: !!p.ctrl, shift: !!p.shift, alt: !!p.alt, meta: !!p.meta,
        key: String(p.key).toLowerCase(),
      };
    }
  } catch { /* ignore */ }
  return DEFAULT_HOTKEY;
}

export function saveHotkey(h: HotkeyCombo): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.hotkeyCombo, JSON.stringify(h));
    window.dispatchEvent(new CustomEvent("alpha:wake-settings"));
  } catch { /* ignore */ }
}

export function loadWakePhrases(): string[] {
  if (typeof window === "undefined") return [...DEFAULT_WAKE_PHRASES];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.wakePhrases);
    if (!raw) return [...DEFAULT_WAKE_PHRASES];
    const p = JSON.parse(raw);
    if (Array.isArray(p)) {
      const clean = p.map((s) => String(s).trim().toLowerCase()).filter((s) => s.length >= 2);
      return clean.length ? clean : [...DEFAULT_WAKE_PHRASES];
    }
  } catch { /* ignore */ }
  return [...DEFAULT_WAKE_PHRASES];
}

export function saveWakePhrases(list: string[]): void {
  if (typeof window === "undefined") return;
  const clean = list.map((s) => s.trim().toLowerCase()).filter((s) => s.length >= 2).slice(0, 20);
  try { window.localStorage.setItem(STORAGE_KEYS.wakePhrases, JSON.stringify(clean)); } catch { /* ignore */ }
}

