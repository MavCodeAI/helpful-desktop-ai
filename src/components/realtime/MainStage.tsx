import type { RefObject } from "react";
import { AuroraField } from "@/components/realtime/AuroraField";
import { HeaderPill } from "@/components/realtime/HeaderPill";
import { RingOrb } from "@/components/realtime/RingOrb";
import { MessageStream } from "@/components/realtime/MessageStream";
import { ActionsList } from "@/components/realtime/ActionsList";
import { StatusPill } from "@/components/realtime/StatusPill";
import { VoiceErrorCard } from "@/components/realtime/VoiceErrorCard";
import { ChatComposer } from "@/components/realtime/ChatComposer";
import { JARVISHud } from "@/components/realtime/JARVISHud";
import { QuickSkills } from "@/components/realtime/QuickSkills";
import type { useVoiceSettings } from "@/hooks/use-voice-settings";
import type { useRealtimeSession } from "@/hooks/use-realtime-session";
import type { useThreadHistory } from "@/hooks/use-thread-history";
import type { useAutoScroll } from "@/hooks/use-auto-scroll";
import type { useIntentActions } from "@/hooks/use-intent-actions";

type Settings = ReturnType<typeof useVoiceSettings>;
type Session = ReturnType<typeof useRealtimeSession>;
type History = ReturnType<typeof useThreadHistory>;
type AutoScroll = ReturnType<typeof useAutoScroll>;
type Intents = ReturnType<typeof useIntentActions>;

interface Props {
  pageRef: RefObject<HTMLDivElement | null>;
  settings: Settings;
  session: Session;
  history: History;
  scroll: AutoScroll;
  intents: Intents;
  active: boolean;
  disabled: boolean;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onOpenNotes: () => void;
  onOpenChat: () => void;
  onSendText: (text: string) => void | Promise<void>;
  textBusy: boolean;
  onCreateNote: (text: string) => void | Promise<void>;
  notePending: boolean;
}

/** The visible page — aurora backdrop, header, orb, chat rail, status/actions. */
export function MainStage({
  pageRef, settings, session, history, scroll, intents,
  active, disabled, onOpenHistory, onOpenSettings, onOpenNotes, onOpenChat,
  onSendText, textBusy, onCreateNote, notePending,
}: Props) {
  const { provider, currentVoice, pace, rate } = settings;
  const {
    status, partial, error, errorInfo, cooldown, level, latency, sttLatency, ttsLatency,
    micTest, micPermission, start, stop,
  } = session;
  const { messages } = history;
  const { scrollRef, atBottom, unread, onScroll, jumpToLatest } = scroll;
  const {
    actions, autoOpen, setAutoOpen,
    pendingApproval, approvePending, rejectPending,
  } = intents;
  const showInlineComposer = messages.length > 0 || !!partial;

  return (
    <div ref={pageRef} className="contents">
      <AuroraField />
      <HeaderPill
        provider={provider}
        currentVoice={currentVoice}
        pace={pace}
        rate={rate}
        threadCount={history.threads.length}
        messageCount={messages.length}
        onOpenHistory={onOpenHistory}
        onOpenSettings={onOpenSettings}
        onOpenNotes={onOpenNotes}
        onOpenChat={onOpenChat}
      />

      <JARVISHud
        status={status}
        active={active}
        level={level}
        sensitivity={settings.sensitivity}
        latency={latency}
        sttLatency={sttLatency}
        ttsLatency={ttsLatency}
        onStop={stop}
      />
      <QuickSkills lang={settings.lang} onRun={onSendText} />

      <div className={`relative z-10 flex-1 grid grid-cols-1 items-center gap-6 px-4 sm:px-6 pb-6 ${showInlineComposer || messages.length > 0 ? "lg:grid-cols-12" : ""}`}>
        <RingOrb
          status={status}
          active={active}
          disabled={disabled}
          onStart={start}
          onStop={stop}
        />
        {showInlineComposer || messages.length > 0 ? (
          <aside className="lg:col-span-4 w-full max-w-2xl mx-auto lg:mx-0 lg:max-w-none lg:self-stretch lg:flex lg:flex-col lg:justify-center relative min-h-[120px] animate-fade-in">
            {messages.length > 0 && (
              <div className="flex items-center justify-end gap-1 mb-2">
                <button
                  onClick={() => history.newConversation()}
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] text-cyan-200 hover:bg-cyan-400/10 border border-cyan-400/20"
                  aria-label="New chat"
                  title="New chat"
                >
                  + New
                </button>
                <button
                  onClick={() => history.setMessages([])}
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] text-muted-foreground hover:text-foreground hover:bg-white/5 border border-white/10"
                  aria-label="Clear chat"
                  title="Clear chat"
                >
                  Clear
                </button>
              </div>
            )}
            <MessageStream
              ref={scrollRef}
              messages={messages}
              partial={partial}
              status={status}
              atBottom={atBottom}
              unread={unread}
              onScroll={onScroll}
              onJumpToLatest={jumpToLatest}
            />
            {showInlineComposer && (
              <div className="mt-3">
                <ChatComposer lang={settings.lang} onSend={onSendText} busy={textBusy} onNote={onCreateNote} notePending={notePending} placeholder="Reply with text…" />
              </div>
            )}
          </aside>
        ) : null}

      </div>


      <section className="relative z-10 px-4 sm:px-6 pb-6 text-center">
        <ActionsList
          actions={actions}
          autoOpen={autoOpen}
          onToggleAutoOpen={setAutoOpen}
          pendingApproval={pendingApproval}
          onApprove={approvePending}
          onReject={rejectPending}
        />
        <StatusPill
          status={status}
          disabled={disabled}
          active={active}
          cooldown={cooldown}
          micTest={micTest}
          level={level}
          sensitivity={settings.sensitivity}
          sttLatency={sttLatency}
          ttsLatency={ttsLatency}
          latency={latency}
          rate={rate}
          autoRate={settings.autoRate}
        />
        {errorInfo ? (
          <VoiceErrorCard
            error={errorInfo}
            cooldown={cooldown}
            onRetry={start}
            onOpenSettings={onOpenSettings}
          />
        ) : micPermission === "denied" ? (
          <div className="mt-3 text-xs text-amber-300/90 max-w-md mx-auto">
            Microphone access is blocked. Open Android/browser site settings, allow microphone access, and try again.
          </div>
        ) : null}
      </section>
    </div>
  );
}