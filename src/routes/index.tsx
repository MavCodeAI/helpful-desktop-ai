import { createFileRoute } from "@tanstack/react-router";
import { useVoiceApp } from "@/hooks/use-voice-app";
import { MainStage } from "@/components/realtime/MainStage";
import { OverlayHost } from "@/components/realtime/OverlayHost";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const {
    overlays, settings, history, session, scroll, intents,
    liteActive, pageRef, active, disabled,
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
      />

      <OverlayHost
        overlays={overlays}
        settings={settings}
        history={history}
        session={session}
        liteActive={liteActive}
        active={active}
      />
    </main>
  );
}
