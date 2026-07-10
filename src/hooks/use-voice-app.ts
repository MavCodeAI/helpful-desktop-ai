import { useCallback, useEffect } from "react";
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
import type { VoiceMessage } from "@/lib/voice-providers";

/**
 * Top-level orchestrator — wires every voice hook together and resolves the
 * circular deps between settings ↔ session ↔ history ↔ scroll via a single
 * late-bound `sessionRef`. Returns everything the JSX needs.
 */
export function useVoiceApp() {
  const overlays = useOverlays();
  const { setShowHistory, setShowKeyModal, anyOverlay } = overlays;
  const intents = useIntentActions();

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
    onRequestKey: () => setShowKeyModal(true),
  });
  const liteActive = useLiteMode(settings.liteMode);

  const history = useThreadHistory({
    onBeforeSwitch: () => sessionRef.current.stop(),
    onSwitched: () => { sessionRef.current.clearPartial(); setShowHistory(false); },
  });
  const { messages, setMessages } = history;

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
    onFinalMessage: handleFinalMessage,
    onRateAdapt: settings.setRate,
    onRequestKey: () => setShowKeyModal(true),
  });

  const scroll = useAutoScroll({ messages, partial: session.partial, status: session.status });
  // Narrow dep to the stable setter; the whole `session` object is a fresh
  // reference on every render and would re-fire this effect needlessly.
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
    onTrigger: session.start,
  });

  return { overlays, settings, history, session, scroll, intents, liteActive, pageRef, active, disabled };
}