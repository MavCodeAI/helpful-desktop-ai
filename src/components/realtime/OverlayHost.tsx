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
const GeminiKeyModal = lazy(() =>
  import("@/components/realtime/GeminiKeyModal").then((m) => ({ default: m.GeminiKeyModal }))
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
}

/** All lazy-loaded drawers/modals gated behind Suspense. */
export function OverlayHost({ overlays, settings, history, session, liteActive, active }: Props) {
  const {
    showHistory, setShowHistory,
    showVoiceMenu, setShowVoiceMenu,
    showKeyModal, setShowKeyModal,
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
          geminiKey={settings.geminiKey}
          onOpenKeyModal={() => setShowKeyModal(true)}
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
        />
      )}
      {showKeyModal && (
        <GeminiKeyModal
          value={settings.geminiKey}
          onChange={settings.setGeminiKey}
          onSave={() => { settings.saveKey(); setShowKeyModal(false); }}
          onCancel={() => setShowKeyModal(false)}
        />
      )}
    </Suspense>
  );
}