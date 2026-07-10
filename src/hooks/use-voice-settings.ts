import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type ProviderId,
  type Pace,
  HF_VOICES,
  GEMINI_VOICES,
} from "@/lib/voice-providers";

import { DEFAULTS, type LiteMode } from "@/lib/realtime/constants";
import { loadSettings, persist } from "@/lib/realtime/storage";
import {
  type PersonaId, type LangCode,
  loadPersona, savePersona, loadCustomPrompt, saveCustomPrompt,
  loadLang, saveLang, loadMemories, saveMemories, addMemory, removeMemory, clearMemories,
  buildPersonaSystemPrompt,
} from "@/lib/persona";

type Options = {
  onStop: () => void;
  onSessionReset: () => void;
  onLiveRate: (r: number) => void;
};


/**
 * All persisted voice/provider settings + their change handlers.
 * Gemini key is fetched from the server (GEMINI_API_KEY env) — no UI input.
 */
export function useVoiceSettings({ onStop, onSessionReset, onLiveRate }: Options) {
  const [provider, setProvider] = useState<ProviderId>("hf");
  const geminiKey = "";
  const geminiKeyError: string | null = null;
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
  const [memories, setMemoriesState] = useState<string[]>([]);

  useEffect(() => {
    const s = loadSettings();
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
    setMemoriesState(loadMemories());
    setProvider("hf");
    persist.provider("hf");
  }, []);

  const changeProvider = useCallback((p: ProviderId) => {
    onStop();
    setProvider(p);
    persist.provider(p);
    onSessionReset();
  }, [onStop, onSessionReset]);

  const changeVoice = useCallback((v: string) => {
    if (provider === "gemini") {
      setGeminiVoice(v);
      persist.geminiVoice(v);
    } else {
      setHfVoice(v);
      persist.hfVoice(v);
    }
    onStop();
  }, [provider, onStop]);

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
  const addMemoryUi = useCallback((text: string) => {
    addMemory(text); setMemoriesState(loadMemories());
  }, []);
  const removeMemoryUi = useCallback((idx: number) => {
    removeMemory(idx); setMemoriesState(loadMemories());
  }, []);
  const clearMemoriesUi = useCallback(() => {
    clearMemories(); setMemoriesState([]);
  }, []);

  const currentVoice = provider === "gemini" ? geminiVoice : hfVoice;
  const voiceList = provider === "gemini" ? GEMINI_VOICES : HF_VOICES;

  const systemPrompt = useMemo(
    () => buildPersonaSystemPrompt({ persona, customPrompt, lang, memories }),
    [persona, customPrompt, lang, memories],
  );

  return {
    provider, geminiKey, geminiKeyError,
    hfVoice, geminiVoice, pace, rate, sensitivity, autoRate, liteMode,
    wakeClap, wakeWord, wakeHotkey,
    confirmBeforeOpen, desktopAutoLaunch,
    persona, customPrompt, lang, memories, systemPrompt,
    currentVoice, voiceList,
    setRate,
    changeProvider, changeVoice, changePace, changeRate,
    changeSensitivity, toggleAutoRate, changeLiteMode,
    toggleWakeClap, toggleWakeWord, toggleWakeHotkey,
    toggleConfirmBeforeOpen, toggleDesktopAutoLaunch,
    changePersona, changeCustomPrompt, changeLang,
    addMemory: addMemoryUi, removeMemory: removeMemoryUi, clearMemories: clearMemoriesUi,
  };
}
