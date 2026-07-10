import { useRef } from "react";
import { X } from "lucide-react";
import { useFocusTrap, useSwipeClose } from "@/hooks/use-drawer-a11y";
import type { LiteMode } from "@/lib/realtime/constants";
import type { ProviderId, Pace } from "@/lib/voice-providers";
import type { PersonaId, LangCode } from "@/lib/persona";
import { EngineSection } from "@/components/realtime/settings/EngineSection";
import { VoicePaceSection } from "@/components/realtime/settings/VoicePaceSection";
import { MicSection } from "@/components/realtime/settings/MicSection";
import { PerformanceSection } from "@/components/realtime/settings/PerformanceSection";
import { TriggersSection } from "@/components/realtime/settings/TriggersSection";
import { DesktopSection } from "@/components/realtime/settings/DesktopSection";
import { ComingSoonSection } from "@/components/realtime/settings/ComingSoonSection";
import { PersonaSection } from "@/components/realtime/settings/PersonaSection";

export interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  provider: ProviderId;
  changeProvider: (p: ProviderId) => void;
  geminiKeyReady: boolean;
  geminiKeyError: string | null;
  currentVoice: string;
  voiceList: readonly string[];
  changeVoice: (v: string) => void;
  pace: Pace;
  changePace: (p: Pace) => void;
  rate: number;
  changeRate: (r: number) => void;
  active: boolean;
  micPermission: "unknown" | "granted" | "denied" | "prompt";
  sensitivity: number;
  changeSensitivity: (v: number) => void;
  micTest: boolean;
  startMicTestMode: () => void;
  stopMicTest: () => void;
  level: number;
  autoRate: boolean;
  toggleAutoRate: (v: boolean) => void;
  liteMode: LiteMode;
  liteActive: boolean;
  changeLiteMode: (v: LiteMode) => void;
  sttLatency: number | null;
  ttsLatency: number | null;
  latency: number | null;
  wakeClap: boolean;
  wakeWord: boolean;
  wakeHotkey: boolean;
  toggleWakeClap: (v: boolean) => void;
  toggleWakeWord: (v: boolean) => void;
  toggleWakeHotkey: (v: boolean) => void;
  confirmBeforeOpen: boolean;
  toggleConfirmBeforeOpen: (v: boolean) => void;
  desktopAutoLaunch: boolean;
  toggleDesktopAutoLaunch: (v: boolean) => void;
  persona: PersonaId;
  customPrompt: string;
  lang: LangCode;
  memories: string[];
  changePersona: (p: PersonaId) => void;
  changeCustomPrompt: (v: string) => void;
  changeLang: (l: LangCode) => void;
  addMemory: (t: string) => void;
  removeMemory: (i: number) => void;
  clearMemories: () => void;
}

export function SettingsDrawer(props: SettingsDrawerProps) {
  const drawerRef = useRef<HTMLElement | null>(null);
  useSwipeClose(drawerRef, "right", props.onClose, props.open);
  useFocusTrap(drawerRef, props.open);
  if (!props.open) return null;

  const {
    onClose, provider, changeProvider, geminiKeyReady, geminiKeyError,
    currentVoice, voiceList, changeVoice, pace, changePace, rate, changeRate,
    active, micPermission, sensitivity, changeSensitivity,
    micTest, startMicTestMode, stopMicTest, level,
    autoRate, toggleAutoRate, liteMode, liteActive, changeLiteMode,
    sttLatency, ttsLatency, latency,
    wakeClap, wakeWord, wakeHotkey,
    toggleWakeClap, toggleWakeWord, toggleWakeHotkey,
    confirmBeforeOpen, toggleConfirmBeforeOpen,
    desktopAutoLaunch, toggleDesktopAutoLaunch,
    persona, customPrompt, lang, memories,
    changePersona, changeCustomPrompt, changeLang,
    addMemory, removeMemory, clearMemories,
  } = props;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Voice settings"
    >
      <button
        aria-label="Close settings"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <aside
        ref={drawerRef}
        className="glass-card relative h-full w-full max-w-[100vw] sm:w-[420px] rounded-none sm:rounded-l-2xl overflow-hidden flex flex-col animate-slide-in-right"
        style={{ animation: "slideInRight 0.25s ease-out" }}
      >
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 sm:px-5 py-3 sm:py-4 bg-[oklch(0.13_0.02_240/0.75)] backdrop-blur-xl border-b border-white/10">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white/90 tracking-wide truncate">
              Voice Settings
            </h2>
            <div className="text-[10px] uppercase tracking-widest text-white/60 mt-0.5 truncate">
              {provider === "gemini" ? "Gemini Live" : "HF Realtime"} · {currentVoice}
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-full hover:bg-white/5 text-white/60 hover:text-white"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-5 py-4 space-y-6">
          <VoicePaceSection
            currentVoice={currentVoice}
            voiceList={voiceList}
            changeVoice={changeVoice}
            pace={pace}
            changePace={changePace}
            rate={rate}
            changeRate={changeRate}
          />
          <MicSection
            active={active}
            micPermission={micPermission}
            sensitivity={sensitivity}
            changeSensitivity={changeSensitivity}
            micTest={micTest}
            startMicTestMode={startMicTestMode}
            stopMicTest={stopMicTest}
            level={level}
          />
          <PerformanceSection
            autoRate={autoRate}
            toggleAutoRate={toggleAutoRate}
            liteMode={liteMode}
            liteActive={liteActive}
            changeLiteMode={changeLiteMode}
            sttLatency={sttLatency}
            ttsLatency={ttsLatency}
            latency={latency}
          />
          <TriggersSection
            wakeClap={wakeClap}
            wakeWord={wakeWord}
            wakeHotkey={wakeHotkey}
            toggleClap={toggleWakeClap}
            toggleWord={toggleWakeWord}
            toggleHotkey={toggleWakeHotkey}
          />
          <DesktopSection
            confirmBeforeOpen={confirmBeforeOpen}
            toggleConfirmBeforeOpen={toggleConfirmBeforeOpen}
            desktopAutoLaunch={desktopAutoLaunch}
            toggleDesktopAutoLaunch={toggleDesktopAutoLaunch}
          />
          <PersonaSection
            persona={persona}
            customPrompt={customPrompt}
            lang={lang}
            memories={memories}
            changePersona={changePersona}
            changeCustomPrompt={changeCustomPrompt}
            changeLang={changeLang}
            addMemory={addMemory}
            removeMemory={removeMemory}
            clearMemories={clearMemories}
          />
          <ComingSoonSection />
        </div>
      </aside>
    </div>
  );
}