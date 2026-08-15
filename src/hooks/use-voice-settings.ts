import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type ProviderId,
  type Pace,
  GEMINI_VOICES,
} from "@/lib/voice-providers";

import { DEFAULTS, type LiteMode } from "@/lib/realtime/constants";
import { loadSettings, persist } from "@/lib/realtime/storage";
import { getGeminiKey } from "@/lib/gemini-key.functions";
import {
  type PersonaId, type LangCode,
  loadPersona, savePersona, loadCustomPrompt, saveCustomPrompt,
  loadLang, saveLang, loadMemories, saveMemories, addMemory, removeMemory, clearMemories,
  buildPersonaSystemPrompt,
} from "@/lib/persona";
import {
  type CountryCode, type TimezoneMode,
  loadCountry, saveCountry, loadTimezoneMode, saveTimezoneMode,
} from "@/lib/locale";

type Options = {
  onStop: () => void;
  onSessionReset: () => void;
  onLiveRate: (r: number) => void;
};


/**
 * All persisted voice/provider settings + their change handlers.
 * Gemini readiness comes from the server; an optional user key can be applied
 * from Settings for a direct connection test and a session-scoped voice flow.
 */
export function useVoiceSettings({ onStop, onSessionReset, onLiveRate }: Options) {
  const [provider, setProvider] = useState<ProviderId>("gemini");
  const [geminiKey, setGeminiKey] = useState("");
  const [tavilyKey, setTavilyKey] = useState("");
  const [geminiKeyReady, setGeminiKeyReady] = useState(false);
  const [geminiKeyError, setGeminiKeyError] = useState<string | null>(null);
  const [hfVoice, setHfVoice] = useState<string>(DEFAULTS.hfVoice);
  const [geminiVoice, setGeminiVoice] = useState<string>(DEFAULTS.geminiVoice);
  const [pace, setPace] = useState<Pace>(DEFAULTS.pace);
  const [rate, setRate] = useState<number>(DEFAULTS.rate);
  const [sensitivity, setSensitivity] = useState<number>(DEFAULTS.sensitivity);
  const [autoRate, setAutoRate] = useState<boolean>(DEFAULTS.autoRate);
  const [liteMode, setLiteMode] = useState<LiteMode>(DEFAULTS.liteMode);
  const [wakeClap, setWakeClap] = useState<boolean>(DEFAULTS.wakeClap);
  const [wakeWord, setWakeWord] = useState<boolean>(DEFAULTS.wakeWord);
  const [wakeHotkey, setWakeHotkey] = useState<boolean>(DEFAULTS.wakeHotkey);
  const [confirmBeforeOpen, setConfirmBeforeOpen] = useState<boolean>(DEFAULTS.confirmBeforeOpen);
  const [desktopAutoLaunch, setDesktopAutoLaunch] = useState<boolean>(DEFAULTS.desktopAutoLaunch);
  const [persona, setPersonaState] = useState<PersonaId>("alpha");
  const [customPrompt, setCustomPromptState] = useState<string>("");
  const [lang, setLangState] = useState<LangCode>("auto");
  const [country, setCountryState] = useState<CountryCode>("SA");
  const [timezoneMode, setTimezoneModeState] = useState<TimezoneMode>("country");
  const [memories, setMemoriesState] = useState<string[]>([]);

  useEffect(() => {
    const s = loadSettings();
    setGeminiKey(s.geminiKeyValidated ? s.geminiKey : "");
    setTavilyKey(s.tavilyKey);
    setHfVoice(s.hfVoice);
    setGeminiVoice(s.geminiVoice);
    setPace(s.pace);
    setRate(s.rate);
    setSensitivity(s.sensitivity);
    setAutoRate(s.autoRate);
    setLiteMode(s.liteMode);
    setWakeClap(s.wakeClap);
    setWakeWord(s.wakeWord);
    setWakeHotkey(s.wakeHotkey);
    setConfirmBeforeOpen(s.confirmBeforeOpen);
    setDesktopAutoLaunch(s.desktopAutoLaunch);
    setPersonaState(loadPersona());
    setCustomPromptState(loadCustomPrompt());
    setLangState(loadLang());
    setCountryState(loadCountry());
    setTimezoneModeState(loadTimezoneMode());
    setMemoriesState(loadMemories());
    // Gemini Live is the single production voice path. Keep the HF adapter for
    // internal rollback compatibility, but migrate every persisted user to Gemini.
    const migrationKey = "alpha_voice_provider_migrated_v3";
    localStorage.setItem(migrationKey, "1");
    setProvider("gemini");
    persist.provider("gemini");
    getGeminiKey()
      .then((result) => {
        const localValidated = s.geminiKeyValidated && Boolean(s.geminiKey);
        setGeminiKeyReady(localValidated);
        setGeminiKeyError(localValidated ? null : (result.configured ? "Apply & Test a Gemini key to activate AI features on this device." : result.error));
      })
      .catch(() => {
        setGeminiKeyReady(false);
        setGeminiKeyError("Could not read server voice configuration.");
      });
  }, []);

  const applyTavilyKey = useCallback((value: string) => {
    setTavilyKey(value.trim());
    persist.tavilyKey(value.trim());
  }, []);

  const applyGeminiKey = useCallback((value: string) => {
    const next = value.trim();
    onStop();
    setGeminiKey(next);
    persist.geminiKey(next);
    persist.geminiKeyValidated(Boolean(next));
    setGeminiKeyReady(Boolean(next));
    setGeminiKeyError(next ? null : "No Gemini key has been applied on this device.");
    onSessionReset();
  }, [onStop, onSessionReset]);

  const changeProvider = useCallback((p: ProviderId) => {
    onStop();
    setProvider(p);
    persist.provider(p);
    onSessionReset();
  }, [onStop, onSessionReset]);

  const changeVoice = useCallback((v: string) => {
    setGeminiVoice(v);
    persist.geminiVoice(v);
    onStop();
  }, [onStop]);

  const changePace = useCallback((p: Pace) => {
    setPace(p);
    persist.pace(p);
    onStop();
  }, [onStop]);

  const changeRate = useCallback((r: number) => {
    setRate(r);
    persist.rate(r);
    onLiveRate(r);
  }, [onLiveRate]);

  const changeSensitivity = useCallback((s: number) => {
    setSensitivity(s);
    persist.sensitivity(s);
  }, []);

  const toggleAutoRate = useCallback((v: boolean) => {
    setAutoRate(v);
    persist.autoRate(v);
  }, []);

  const changeLiteMode = useCallback((v: LiteMode) => {
    setLiteMode(v);
    persist.liteMode(v);
  }, []);

  const toggleWakeClap = useCallback((v: boolean) => {
    setWakeClap(v); persist.wakeClap(v);
  }, []);
  const toggleWakeWord = useCallback((v: boolean) => {
    setWakeWord(v); persist.wakeWord(v);
  }, []);
  const toggleWakeHotkey = useCallback((v: boolean) => {
    setWakeHotkey(v); persist.wakeHotkey(v);
  }, []);
  const toggleConfirmBeforeOpen = useCallback((v: boolean) => {
    setConfirmBeforeOpen(v); persist.confirmBeforeOpen(v);
  }, []);
  const toggleDesktopAutoLaunch = useCallback((v: boolean) => {
    setDesktopAutoLaunch(v); persist.desktopAutoLaunch(v);
  }, []);

  const changePersona = useCallback((p: PersonaId) => {
    setPersonaState(p); savePersona(p); onStop();
  }, [onStop]);
  const changeCustomPrompt = useCallback((v: string) => {
    setCustomPromptState(v); saveCustomPrompt(v);
  }, []);
  const changeLang = useCallback((l: LangCode) => {
    setLangState(l); saveLang(l); onStop();
  }, [onStop]);
  const changeCountry = useCallback((next: CountryCode) => {
    setCountryState(next); saveCountry(next); onStop();
  }, [onStop]);
  const changeTimezoneMode = useCallback((next: TimezoneMode) => {
    setTimezoneModeState(next); saveTimezoneMode(next); onStop();
  }, [onStop]);
  const addMemoryUi = useCallback((text: string) => {
    addMemory(text); setMemoriesState(loadMemories());
  }, []);
  const removeMemoryUi = useCallback((idx: number) => {
    removeMemory(idx); setMemoriesState(loadMemories());
  }, []);
  const clearMemoriesUi = useCallback(() => {
    clearMemories(); setMemoriesState([]);
  }, []);

  const currentVoice = geminiVoice;
  const voiceList = GEMINI_VOICES;

  const systemPrompt = useMemo(
    () => buildPersonaSystemPrompt({ persona, customPrompt, lang, memories, country, timezoneMode }),
    [persona, customPrompt, lang, memories, country, timezoneMode],
  );

  return {
    provider, geminiKey, geminiKeyReady, geminiKeyError, applyGeminiKey, tavilyKey, applyTavilyKey,
    hfVoice, geminiVoice, pace, rate, sensitivity, autoRate, liteMode,
    wakeClap, wakeWord, wakeHotkey,
    confirmBeforeOpen, desktopAutoLaunch,
    persona, customPrompt, lang, country, timezoneMode, memories, systemPrompt,
    currentVoice, voiceList,
    setRate,
    changeProvider, changeVoice, changePace, changeRate,
    changeSensitivity, toggleAutoRate, changeLiteMode,
    toggleWakeClap, toggleWakeWord, toggleWakeHotkey,
    toggleConfirmBeforeOpen, toggleDesktopAutoLaunch,
    changePersona, changeCustomPrompt, changeLang, changeCountry, changeTimezoneMode,
    addMemory: addMemoryUi, removeMemory: removeMemoryUi, clearMemories: clearMemoriesUi,
  };
}
