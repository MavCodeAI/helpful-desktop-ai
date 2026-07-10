import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useVoiceApp } from "@/hooks/use-voice-app";
import { MainStage } from "@/components/realtime/MainStage";
import { OverlayHost } from "@/components/realtime/OverlayHost";
import { TimersBar } from "@/components/realtime/TimersBar";

const NotesDrawer = lazy(() =>
  import("@/components/realtime/NotesDrawer").then((m) => ({ default: m.NotesDrawer }))
);

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const {
    overlays, settings, history, session, scroll, intents,
    liteActive, pageRef, active, disabled,
    timers, showNotes, setShowNotes,
    sendText, textBusy,
  } = useVoiceApp();

  return (
    <main
      className="relative min-h-dvh flex flex-col overflow-hidden"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <MainStage
        pageRef={pageRef}
        settings={settings}
        session={session}
        history={history}
        scroll={scroll}
        intents={intents}
        active={active}
        disabled={disabled}
        onOpenHistory={() => overlays.setShowHistory(true)}
        onOpenSettings={() => overlays.setShowVoiceMenu(true)}
        onOpenNotes={() => setShowNotes(true)}
      />

      <TimersBar timers={timers.timers} onRemove={timers.remove} />

      <OverlayHost
        overlays={overlays}
        settings={settings}
        history={history}
        session={session}
        liteActive={liteActive}
        active={active}
      />

      {showNotes && (
        <Suspense fallback={null}>
          <NotesDrawer open={showNotes} onClose={() => setShowNotes(false)} />
        </Suspense>
      )}
    </main>
  );
}
