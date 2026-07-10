// Typed, defensive localStorage wrappers for realtime UI settings.
// Any read failure falls back to DEFAULTS; writes swallow QuotaExceededError.

import type { Pace, ProviderId } from "@/lib/voice-providers";
import { DEFAULTS, STORAGE_KEYS, type LiteMode } from "./constants";

export interface VoiceSettings {
  provider: ProviderId | null;
  geminiKey: string;
  hfVoice: string;
  geminiVoice: string;
  pace: Pace;
  rate: number;
  sensitivity: number;
  autoRate: boolean;
  liteMode: LiteMode;
  wakeClap: boolean;
  wakeWord: boolean;
  wakeHotkey: boolean;
  confirmBeforeOpen: boolean;
  desktopAutoLaunch: boolean;
}

const isBrowser = () => typeof window !== "undefined";

function safeGet(key: string): string | null {
  if (!isBrowser()) return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function safeSet(key: string, value: string): void {
  if (!isBrowser()) return;
  try { window.localStorage.setItem(key, value); } catch { /* quota / private mode */ }
}

function readBool(key: string, fallback: boolean): boolean {
  const v = safeGet(key);
  if (v === "1") return true;
  if (v === "0") return false;
  return fallback;
}

export function loadSettings(): VoiceSettings {
  const rawRate = parseFloat(safeGet(STORAGE_KEYS.rate) || "");
  const rawSens = parseFloat(safeGet(STORAGE_KEYS.sensitivity) || "");
  const lite = safeGet(STORAGE_KEYS.perfLite);
  return {
    provider: (safeGet(STORAGE_KEYS.provider) as ProviderId | null) || null,
    geminiKey: safeGet(STORAGE_KEYS.geminiKey) || "",
    hfVoice: safeGet(STORAGE_KEYS.hfVoice) || DEFAULTS.hfVoice,
    geminiVoice: safeGet(STORAGE_KEYS.geminiVoice) || DEFAULTS.geminiVoice,
    pace: (safeGet(STORAGE_KEYS.pace) as Pace | null) || DEFAULTS.pace,
    rate: !Number.isNaN(rawRate) && rawRate > 0 ? rawRate : DEFAULTS.rate,
    sensitivity: !Number.isNaN(rawSens) && rawSens > 0 ? rawSens : DEFAULTS.sensitivity,
    autoRate: safeGet(STORAGE_KEYS.autoRate) === "1",
    liteMode:
      lite === "on" || lite === "off" || lite === "auto"
        ? (lite as LiteMode)
        : DEFAULTS.liteMode,
    wakeClap: readBool(STORAGE_KEYS.wakeClap, DEFAULTS.wakeClap),
    wakeWord: readBool(STORAGE_KEYS.wakeWord, DEFAULTS.wakeWord),
    wakeHotkey: readBool(STORAGE_KEYS.wakeHotkey, DEFAULTS.wakeHotkey),
    confirmBeforeOpen: readBool(STORAGE_KEYS.confirmBeforeOpen, DEFAULTS.confirmBeforeOpen),
    desktopAutoLaunch: readBool(STORAGE_KEYS.desktopAutoLaunch, DEFAULTS.desktopAutoLaunch),
  };
}

export const persist = {
  provider: (v: ProviderId) => safeSet(STORAGE_KEYS.provider, v),
  geminiKey: (v: string) => safeSet(STORAGE_KEYS.geminiKey, v),
  hfVoice: (v: string) => safeSet(STORAGE_KEYS.hfVoice, v),
  geminiVoice: (v: string) => safeSet(STORAGE_KEYS.geminiVoice, v),
  pace: (v: Pace) => safeSet(STORAGE_KEYS.pace, v),
  rate: (v: number) => safeSet(STORAGE_KEYS.rate, String(v)),
  sensitivity: (v: number) => safeSet(STORAGE_KEYS.sensitivity, String(v)),
  autoRate: (v: boolean) => safeSet(STORAGE_KEYS.autoRate, v ? "1" : "0"),
  liteMode: (v: LiteMode) => safeSet(STORAGE_KEYS.perfLite, v),
  wakeClap: (v: boolean) => safeSet(STORAGE_KEYS.wakeClap, v ? "1" : "0"),
  wakeWord: (v: boolean) => safeSet(STORAGE_KEYS.wakeWord, v ? "1" : "0"),
  wakeHotkey: (v: boolean) => safeSet(STORAGE_KEYS.wakeHotkey, v ? "1" : "0"),
  confirmBeforeOpen: (v: boolean) => safeSet(STORAGE_KEYS.confirmBeforeOpen, v ? "1" : "0"),
  desktopAutoLaunch: (v: boolean) => safeSet(STORAGE_KEYS.desktopAutoLaunch, v ? "1" : "0"),
};
