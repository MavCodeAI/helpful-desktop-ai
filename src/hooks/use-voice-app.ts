import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useOverlays } from "@/hooks/use-overlays";
import { usePageInert } from "@/hooks/use-page-inert";
import { useLiteMode } from "@/hooks/use-lite-mode";
import { useRealtimeSession } from "@/hooks/use-realtime-session";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import { useThreadHistory } from "@/hooks/use-thread-history";
import { useVoiceSettings } from "@/hooks/use-voice-settings";
import { useIntentActions } from "@/hooks/use-intent-actions";
import { useMutableRef } from "@/hooks/use-mutable-ref";
import { useWakeTriggers } from "@/hooks/use-wake-triggers";
import { useTimers } from "@/lib/utilities/timers";
import { onGlobalHotkey, onTrayAction, isElectron } from "@/lib/electron-bridge";
import type { VoiceMessage } from "@/lib/voice-providers";
import { LANG_STT_CODE, loadMemories, addMemory } from "@/lib/persona";
import { webSearchSummarize } from "@/lib/web-search.functions";
import { extractMemoryFacts } from "@/lib/memories.functions";

/**
 * Top-level orchestrator — wires every voice hook together and resolves the
 * circular deps between settings ↔ session ↔ history ↔ scroll via a single
 * late-bound `sessionRef`. Returns everything the JSX needs.
 */
export function useVoiceApp() {
  const overlays = useOverlays();
  const { setShowHistory, anyOverlay } = overlays;
  const [showNotes, setShowNotes] = useState(false);
  const timers = useTimers();

  const sessionRef = useMutableRef<{
    stop: () => void;
    clearPartial: () => void;
    setLiveRate: (r: number) => void;
    reset: () => void;
    bumpUnread: () => void;
  }>({ stop: () => {}, clearPartial: () => {}, setLiveRate: () => {}, reset: () => {}, bumpUnread: () => {} });

  const settings = useVoiceSettings({
    onStop: () => sessionRef.current.stop(),
    onSessionReset: () => sessionRef.current.reset(),
    onLiveRate: (r) => sessionRef.current.setLiveRate(r),
  });
  const liteActive = useLiteMode(settings.liteMode);

  const setMessagesRef = useRef<((updater: (prev: VoiceMessage[]) => VoiceMessage[]) => void) | null>(null);

  const intents = useIntentActions({
    confirmBeforeOpen: settings.confirmBeforeOpen,
    lang: settings.lang,
    onTimer: (seconds, label) => { timers.add(seconds, label); },
    onAssistantReply: (text) => setMessagesRef.current?.((prev) => [...prev, { role: "assistant", text }]),
    onUserContext: (text) => setMessagesRef.current?.((prev) => [...prev, { role: "you", text }]),
  });

  const history = useThreadHistory({
    onBeforeSwitch: () => sessionRef.current.stop(),
    onSwitched: () => { sessionRef.current.clearPartial(); setShowHistory(false); },
  });
  const { messages, setMessages } = history;
  useEffect(() => { setMessagesRef.current = setMessages; }, [setMessages]);

  const handleFinalMessage = useCallback((m: VoiceMessage, ctx: { atBottom: boolean }) => {
    setMessages((prev) => [...prev, m]);
    if (!ctx.atBottom && m.role === "assistant") sessionRef.current.bumpUnread();
    if (m.role === "you") intents.handleUserText(m.text);
  }, [setMessages, intents, sessionRef]);

  const session = useRealtimeSession({
    provider: settings.provider, geminiKey: settings.geminiKey,
    hfVoice: settings.hfVoice, geminiVoice: settings.geminiVoice,
    pace: settings.pace, rate: settings.rate,
    sensitivity: settings.sensitivity, autoRate: settings.autoRate,
    systemPrompt: settings.systemPrompt,
    onFinalMessage: handleFinalMessage,
    onRateAdapt: settings.setRate,
    onRequestKey: () => {},
  });

  const scroll = useAutoScroll({ messages, partial: session.partial, status: session.status });
  useEffect(() => { session.setAtBottom(scroll.atBottom); }, [scroll.atBottom, session.setAtBottom]);

  useEffect(() => {
    sessionRef.current = {
      stop: session.stop,
      clearPartial: () => session.setPartial(null),
      setLiveRate: session.setLiveRate,
      reset: () => { session.setError(null); session.setCooldown(0); },
      bumpUnread: scroll.bumpUnread,
    };
  }, [
    session.stop, session.setPartial, session.setLiveRate,
    session.setError, session.setCooldown,
    scroll.bumpUnread, sessionRef,
  ]);

  const pageRef = usePageInert(anyOverlay);
  const active = session.status === "listening" || session.status === "speaking" || session.status === "connecting";
  const disabled = session.cooldown > 0;

  // Wake triggers — clap / "hey alpha" / Ctrl+Shift+A → start session
  useWakeTriggers({
    enableClap: settings.wakeClap,
    enableWakeWord: settings.wakeWord,
    enableHotkey: settings.wakeHotkey,
    active,
    disabled,
    wakeLang: LANG_STT_CODE[settings.lang],
    onTrigger: session.start,
  });

  // Electron: OS-level global hotkey + tray Start/Stop
  useEffect(() => {
    if (!isElectron()) return;
    const offHk = onGlobalHotkey(() => {
      if (!active && !disabled) session.start();
    });
    const offTray = onTrayAction((a) => {
      if (a === "start" && !active && !disabled) session.start();
      else if (a === "stop" && active) session.stop();
    });
    return () => { offHk(); offTray(); };
  }, [active, disabled, session.start, session.stop]);

  return {
    overlays, settings, history, session, scroll, intents,
    liteActive, pageRef, active, disabled,
    timers, showNotes, setShowNotes,
  };
}
