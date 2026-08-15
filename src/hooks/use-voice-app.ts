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
import { cachedWebSearch } from "@/lib/web-search-cache";
import { extractMemoryFacts } from "@/lib/memories.functions";
import { chatReply } from "@/lib/chat-reply.functions";
import { generateNote } from "@/lib/note-ai.functions";
import { addNoteRaw } from "@/lib/utilities/notes";
import { matchNoteIntent } from "@/lib/intents";
import { isAiNotesEnabled } from "@/hooks/use-ai-notes-enabled";
import { trackPilotEvent } from "@/lib/pilot-telemetry";
import {
  configureCapacitorShell,
  isCapacitorAndroid,
  listenForCapacitorAppState,
} from "@/lib/capacitor-native";

/**
 * Top-level orchestrator — wires every voice hook together and resolves the
 * circular deps between settings ↔ session ↔ history ↔ scroll via a single
 * late-bound `sessionRef`. Returns everything the JSX needs.
 */
export function useVoiceApp() {
  const overlays = useOverlays();
  const { setShowHistory, anyOverlay } = overlays;

  useEffect(() => {
    trackPilotEvent("app_opened", { desktop: isElectron(), mobile: isCapacitorAndroid() });
  }, []);

  const [showNotes, setShowNotes] = useState(false);
  const timers = useTimers();

  const sessionRef = useMutableRef<{
    stop: () => void;
    clearPartial: () => void;
    setLiveRate: (r: number) => void;
    reset: () => void;
    bumpUnread: () => void;
  }>({ stop: () => {}, clearPartial: () => {}, setLiveRate: () => {}, reset: () => {}, bumpUnread: () => {} });

  useEffect(() => {
    let disposed = false;
    let disposeAppState = () => {};
    void configureCapacitorShell();
    void listenForCapacitorAppState((isActive) => {
      if (!isActive) sessionRef.current.stop();
    }).then((dispose) => {
      if (disposed) dispose();
      else disposeAppState = dispose;
    });
    return () => {
      disposed = true;
      disposeAppState();
    };
  }, [sessionRef]);

  const settings = useVoiceSettings({
    onStop: () => sessionRef.current.stop(),
    onSessionReset: () => sessionRef.current.reset(),
    onLiveRate: (r) => sessionRef.current.setLiveRate(r),
  });
  const liteActive = useLiteMode(settings.liteMode);

  const setMessagesRef = useRef<((updater: (prev: VoiceMessage[]) => VoiceMessage[]) => void) | null>(null);

  // Web search + AI summary: appends assistant message with optional citations.
  const runWebSearch = useCallback(async (query: string) => {
    const setMessages = setMessagesRef.current;
    if (!setMessages) return;
    setMessages((prev) => [...prev, { role: "assistant", text: `🔎 Searching the web for "${query}"…` }]);
    try {
      const { loadWebCitations } = await import("@/lib/realtime/constants");
      const showCitations = loadWebCitations();
      const res = await cachedWebSearch(query);
      let text: string;
      if (showCitations) {
        const sources = res.sources.map((s, i) => `[${i + 1}] ${s.title}\n${s.url}`).join("\n");
        text = sources ? `${res.summary}\n\n**Sources:**\n${sources}` : res.summary;
      } else {
        // Strip inline [1], [2] refs when citations are off
        text = res.summary.replace(/\s*\[\d+\]/g, "").replace(/\s{2,}/g, " ").trim();
      }
      setMessages((prev) => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === "assistant" && next[i].text.startsWith("🔎 Searching")) {
            next[i] = { role: "assistant", text };
            return next;
          }
        }
        return [...next, { role: "assistant", text }];
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Web search failed";
      toast.error(msg);
      setMessages((prev) => prev.filter((m) => !m.text.startsWith("🔎 Searching")));
    }
  }, []);

  const intents = useIntentActions({
    confirmBeforeOpen: settings.confirmBeforeOpen,
    lang: settings.lang,
    onTimer: (seconds, label) => { timers.add(seconds, label); },
    onAssistantReply: (text) => setMessagesRef.current?.((prev) => [...prev, { role: "assistant", text }]),
    onUserContext: (text) => setMessagesRef.current?.((prev) => [...prev, { role: "you", text }]),
    onSearch: runWebSearch,
  });

  const history = useThreadHistory({
    onBeforeSwitch: () => sessionRef.current.stop(),
    onSwitched: () => { sessionRef.current.clearPartial(); setShowHistory(false); },
  });
  const { messages, setMessages } = history;
  useEffect(() => { setMessagesRef.current = setMessages; }, [setMessages]);

  // Buffer recent turns; on assistant reply, extract long-term facts via AI.
  const turnBufRef = useRef<string>("");
  const handleFinalMessage = useCallback((m: VoiceMessage, ctx: { atBottom: boolean }) => {
    setMessages((prev) => [...prev, m]);
    if (!ctx.atBottom && m.role === "assistant") sessionRef.current.bumpUnread();
    if (m.role === "you") intents.handleUserText(m.text);
    turnBufRef.current += `\n${m.role === "you" ? "User" : "Assistant"}: ${m.text}`;
    if (m.role === "assistant") {
      const transcript = turnBufRef.current.trim();
      turnBufRef.current = "";
      if (transcript.length >= 40) {
        extractMemoryFacts({ data: { transcript, existing: loadMemories() } })
          .then((res) => {
            const existing = new Set(loadMemories().map((s) => s.toLowerCase()));
            for (const f of res.facts ?? []) {
              if (!existing.has(f.toLowerCase())) addMemory(f);
            }
          })
          .catch(() => { /* silent */ });
      }
    }
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
      reset: () => { session.clearError(); session.setCooldown(0); },
      bumpUnread: scroll.bumpUnread,
    };
  }, [
    session.stop, session.setPartial, session.setLiveRate,
    session.clearError, session.setCooldown,
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

  // Text chat: send user text → intent-shortcut for notes, else AI reply.
  const [textBusy, setTextBusy] = useState(false);
  const sendText = useCallback(async (text: string) => {
    trackPilotEvent("chat_sent", { characters: text.length, lang: settings.lang });
    const userMsg: VoiceMessage = { role: "you", text };
    handleFinalMessage(userMsg, { atBottom: scroll.atBottom });

    // Shortcut: "note: X" style commands → save directly + open drawer, skip AI.
    const noteBody = matchNoteIntent(text);
    if (noteBody) {
      const saved = addNoteRaw(noteBody);
      if (saved) {
        const summary = saved.text.length > 60 ? saved.text.slice(0, 60) + "…" : saved.text;
        toast.success("📝 Note saved", { description: summary });
        overlays.setShowChat(false);
        setShowNotes(true);
        handleFinalMessage(
          { role: "assistant", text: `✅ Note saved: "${summary}"` },
          { atBottom: scroll.atBottom },
        );
      }
      return;
    }

    setTextBusy(true);
    try {
      const convo = [...messages, userMsg];
      const res = await chatReply({ data: { messages: convo, systemPrompt: settings.systemPrompt, lang: settings.lang } });
      handleFinalMessage({ role: "assistant", text: res.text }, { atBottom: scroll.atBottom });
    } catch (e) {
      trackPilotEvent("chat_failed", { lang: settings.lang });
      toast.error(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setTextBusy(false);
    }
  }, [handleFinalMessage, messages, settings.lang, settings.systemPrompt, scroll.atBottom, overlays, setShowNotes]);

  // From ChatComposer's "Note" button: turn current text into an AI-crafted note.
  const [notePending, setNotePending] = useState(false);
  const createAiNote = useCallback(async (rawPrompt: string) => {
    const t = rawPrompt.trim();
    if (!t) { setShowNotes(true); return; }
    if (!isAiNotesEnabled()) {
      const saved = addNoteRaw(t);
      if (saved) {
        toast.success("📝 Note saved", { description: saved.text.slice(0, 60) });
        overlays.setShowChat(false);
        setShowNotes(true);
      }
      return;
    }
    setNotePending(true);
    try {
      const res = await generateNote({ data: { prompt: t } });
      const saved = addNoteRaw(res.text);
      if (saved) {
        const summary = saved.text.length > 60 ? saved.text.slice(0, 60) + "…" : saved.text;
        toast.success("✨ AI note saved", { description: summary });
        overlays.setShowChat(false);
        setShowNotes(true);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI note failed");
    } finally {
      setNotePending(false);
    }
  }, [overlays, setShowNotes]);

  return {
    overlays, settings, history, session, scroll, intents,
    liteActive, pageRef, active, disabled,
    timers, showNotes, setShowNotes,
    sendText, textBusy,
    createAiNote, notePending,
  };
}
