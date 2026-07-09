/**
 * JARVIS UI preview — visual-only prototype of a new voice UI.
 * Inspired by hf-realtime-voice: single giant orb, minimal chrome,
 * live caption rail at the bottom. No backend calls; mic level only
 * drives the orb so you can feel it.
 *
 * Route: /jarvis-preview
 * If approved, port these visuals into /jarvis.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Mic } from "lucide-react";
import { useMicLevel } from "@/hooks/useMicLevel";

export const Route = createFileRoute("/jarvis-preview")({
  component: JarvisPreview,
  ssr: false,
  head: () => ({
    meta: [
      { title: "JARVIS — UI Preview" },
      { name: "description", content: "Voice UI prototype." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type State = "idle" | "listening" | "thinking" | "speaking";

const CAPTIONS: Record<State, string> = {
  idle: "Tap the orb to speak",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
};

function JarvisPreview() {
  const [state, setState] = useState<State>("idle");
  const { level, active } = useMicLevel(state === "listening");
  const [transcript, setTranscript] = useState<{ role: "you" | "jarvis"; text: string }[]>([]);

  // Demo cycle: after tapping, simulate listening → thinking → speaking → idle.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleTap = () => {
    if (state !== "idle") {
      setState("idle");
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    setState("listening");
    timerRef.current = setTimeout(() => {
      setTranscript((t) => [...t, { role: "you", text: "Hello JARVIS, what's the weather like?" }]);
      setState("thinking");
      timerRef.current = setTimeout(() => {
        setState("speaking");
        setTranscript((t) => [...t, { role: "jarvis", text: "Clear skies, 24°C. Perfect afternoon." }]);
        timerRef.current = setTimeout(() => setState("idle"), 2200);
      }, 1400);
    }, 3200);
  };

  // Orb reactive scale: idle breathing, listening → mic level, others → subtle pulse.
  const scale = useMemo(() => {
    if (state === "listening") return 1 + Math.min(0.35, level * 0.9);
    if (state === "thinking") return 1.02;
    if (state === "speaking") return 1.08;
    return 1;
  }, [state, level]);

  const glow = state === "listening" ? 0.4 + level * 0.6 : state === "speaking" ? 0.9 : 0.5;

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-[#05070d] text-foreground">
      {/* Ambient background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 40%, hsl(200 90% 50% / 0.18), transparent 60%), radial-gradient(40% 40% at 50% 80%, hsl(280 80% 55% / 0.12), transparent 70%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 [background:linear-gradient(180deg,transparent,rgba(0,0,0,0.6))]" />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-5 py-4">
        <Link
          to="/jarvis"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 backdrop-blur hover:bg-white/10"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to JARVIS
        </Link>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-white/60">
            UI Preview
          </span>
        </div>
      </header>

      {/* Orb stage */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 pt-8 pb-40 md:pt-16">
        <button
          type="button"
          onClick={handleTap}
          aria-label={CAPTIONS[state]}
          className="group relative grid place-items-center outline-none"
        >
          {/* Outer halo */}
          <div
            className="absolute h-[380px] w-[380px] rounded-full blur-3xl transition-opacity duration-500"
            style={{
              opacity: glow,
              background:
                "radial-gradient(closest-side, hsl(195 100% 60% / 0.55), hsl(260 90% 60% / 0.25) 60%, transparent 75%)",
            }}
          />
          {/* Rotating conic ring */}
          <div
            className="absolute h-[300px] w-[300px] rounded-full opacity-70 [mask-image:radial-gradient(closest-side,transparent_58%,#000_60%,#000_72%,transparent_74%)]"
            style={{
              background:
                "conic-gradient(from 0deg, hsl(200 100% 65%), hsl(280 90% 65%), hsl(200 100% 65%))",
              animation: state === "idle" ? "spin 14s linear infinite" : "spin 4s linear infinite",
            }}
          />
          {/* Core orb */}
          <div
            className="relative h-[220px] w-[220px] rounded-full transition-transform duration-150 ease-out"
            style={{
              transform: `scale(${scale})`,
              background:
                "radial-gradient(circle at 35% 30%, hsl(210 100% 85%) 0%, hsl(210 100% 60%) 25%, hsl(230 80% 30%) 60%, hsl(240 60% 10%) 100%)",
              boxShadow:
                "inset 0 0 60px hsl(210 100% 80% / 0.35), inset 0 -20px 60px hsl(240 60% 10%), 0 0 80px hsl(210 100% 60% / 0.5)",
            }}
          >
            {/* Specular highlight */}
            <div
              className="absolute left-[18%] top-[15%] h-[40%] w-[40%] rounded-full blur-2xl"
              style={{ background: "hsl(0 0% 100% / 0.35)" }}
            />
            {/* Center mic when idle */}
            {state === "idle" && (
              <div className="absolute inset-0 grid place-items-center">
                <Mic className="h-8 w-8 text-white/80 drop-shadow" />
              </div>
            )}
            {/* Live level bars when listening */}
            {state === "listening" && (
              <div className="absolute inset-0 grid place-items-center">
                <div className="flex items-end gap-1.5">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const h = 8 + Math.min(40, level * 80 + Math.sin(Date.now() / 120 + i) * 6);
                    return (
                      <span
                        key={i}
                        className="w-1.5 rounded-full bg-white/90"
                        style={{ height: `${h}px` }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </button>

        {/* Caption */}
        <p className="mt-10 font-mono text-sm tracking-[0.3em] text-white/70 uppercase">
          {CAPTIONS[state]}
        </p>
        <p className="mt-2 text-xs text-white/40">
          {state === "listening" && active ? "Mic live" : state === "idle" ? "Tap orb or Space" : "\u00A0"}
        </p>
      </main>

      {/* Bottom transcript rail */}
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4 pb-6">
        <div className="mx-auto max-w-2xl">
          <div className="pointer-events-auto rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-xl">
            {transcript.length === 0 ? (
              <p className="text-center text-xs text-white/40">
                Your conversation will appear here.
              </p>
            ) : (
              <div className="max-h-40 space-y-2 overflow-y-auto">
                {transcript.slice(-6).map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.role === "you" ? "justify-end" : "justify-start"}`}
                  >
                    <span
                      className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${
                        m.role === "you"
                          ? "bg-white/10 text-white"
                          : "bg-transparent text-white/85"
                      }`}
                    >
                      {m.text}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="mt-3 text-center text-[10px] uppercase tracking-[0.25em] text-white/30">
            Preview • not connected to backend
          </p>
        </div>
      </footer>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
