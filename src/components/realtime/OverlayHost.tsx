import { Suspense, lazy } from "react";
import type { Thread } from "@/lib/chat-history";
import type { useOverlays } from "@/hooks/use-overlays";
import type { useVoiceSettings } from "@/hooks/use-voice-settings";
import type { useThreadHistory } from "@/hooks/use-thread-history";
import type { useRealtimeSession } from "@/hooks/use-realtime-session";

const HistoryDrawer = lazy(() =>
  import("@/components/realtime/HistoryDrawer").then((m) => ({ default: m.HistoryDrawer }))
);
const SettingsDrawer = lazy(() =>
  import("@/components/realtime/SettingsDrawer").then((m) => ({ default: m.SettingsDrawer }))
);
const DeleteConfirmModal = lazy(() =>
  import("@/components/realtime/DeleteConfirmModal").then((m) => ({ default: m.DeleteConfirmModal }))
);
const ChatDrawer = lazy(() =>
  import("@/components/realtime/ChatDrawer").then((m) => ({ default: m.ChatDrawer }))
);

type Overlays = ReturnType<typeof useOverlays>;
type Settings = ReturnType<typeof useVoiceSettings>;
type History = ReturnType<typeof useThreadHistory>;
type Session = ReturnType<typeof useRealtimeSession>;

interface Props {
  overlays: Overlays;
  settings: Settings;
  history: History;
  session: Session;
  liteActive: boolean;
  active: boolean;
  onSendText: (text: string) => void | Promise<void>;
  textBusy: boolean;
  onCreateNote: (text: string) => void | Promise<void>;
  notePending: boolean;
}

export function OverlayHost({ overlays, settings, history, session, liteActive, active, onSendText, textBusy, onCreateNote, notePending }: Props) {
  const {
    showHistory, setShowHistory,
    showVoiceMenu, setShowVoiceMenu,
    showChat, setShowChat,
    pendingDelete, setPendingDelete,
  } = overlays;

  return (
    <Suspense fallback={null}>
      {showHistory && (
        <HistoryDrawer
          open={showHistory}
          onClose={() => setShowHistory(false)}
          threads={history.threads}
          filteredThreads={history.filteredThreads}
          activeThreadId={history.activeThreadId}
          historyQuery={history.historyQuery}
          setHistoryQuery={history.setHistoryQuery}
          renamingId={history.renamingId}
          renameDraft={history.renameDraft}
          setRenameDraft={history.setRenameDraft}
          beginRename={history.beginRename}
          commitRename={history.commitRename}
          cancelRename={history.cancelRename}
          openThread={history.openThread}
          onRequestDelete={(t: Thread) => setPendingDelete(t)}
          onNewConversation={history.newConversation}
        />
      )}
      {pendingDelete && (
        <DeleteConfirmModal
          thread={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const id = pendingDelete.id;
            setPendingDelete(null);
            history.removeThread(id);
          }}
        />
      )}
      {showVoiceMenu && (
        <SettingsDrawer
          open={showVoiceMenu}
          onClose={() => setShowVoiceMenu(false)}
          provider={settings.provider}
          changeProvider={settings.changeProvider}
          geminiKeyReady={!!settings.geminiKey}
          geminiKeyError={settings.geminiKeyError}
          currentVoice={settings.currentVoice}
          voiceList={settings.voiceList}
          changeVoice={settings.changeVoice}
          pace={settings.pace}
          changePace={settings.changePace}
          rate={settings.rate}
          changeRate={settings.changeRate}
          active={active}
          micPermission={session.micPermission}
          sensitivity={settings.sensitivity}
          changeSensitivity={settings.changeSensitivity}
          micTest={session.micTest}
          startMicTestMode={session.startMicTestMode}
          stopMicTest={session.stopMicTestMode}
          level={session.level}
          autoRate={settings.autoRate}
          toggleAutoRate={settings.toggleAutoRate}
          liteMode={settings.liteMode}
          liteActive={liteActive}
          changeLiteMode={settings.changeLiteMode}
          sttLatency={session.sttLatency}
          ttsLatency={session.ttsLatency}
          latency={session.latency}
          wakeClap={settings.wakeClap}
          wakeWord={settings.wakeWord}
          wakeHotkey={settings.wakeHotkey}
          toggleWakeClap={settings.toggleWakeClap}
          toggleWakeWord={settings.toggleWakeWord}
          toggleWakeHotkey={settings.toggleWakeHotkey}
          confirmBeforeOpen={settings.confirmBeforeOpen}
          toggleConfirmBeforeOpen={settings.toggleConfirmBeforeOpen}
          desktopAutoLaunch={settings.desktopAutoLaunch}
          toggleDesktopAutoLaunch={settings.toggleDesktopAutoLaunch}
          persona={settings.persona}
          customPrompt={settings.customPrompt}
          lang={settings.lang}
          memories={settings.memories}
          changePersona={settings.changePersona}
          changeCustomPrompt={settings.changeCustomPrompt}
          changeLang={settings.changeLang}
          addMemory={settings.addMemory}
          removeMemory={settings.removeMemory}
          clearMemories={settings.clearMemories}
        />
      )}
      {showChat && (
        <ChatDrawer
          open={showChat}
          onClose={() => setShowChat(false)}
          messages={history.messages}
          lang={settings.lang}
          onSend={onSendText}
          busy={textBusy}
          onNote={onCreateNote}
          notePending={notePending}
          onClear={() => history.setMessages([])}
          onNewChat={() => { history.newConversation(); }}
        />
      )}
    </Suspense>
  );
}
