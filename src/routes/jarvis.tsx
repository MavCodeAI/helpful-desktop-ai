import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff, Loader2, LogOut, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLicense, clearLicense } from "@/lib/license";
import { toast } from "sonner";

export const Route = createFileRoute("/jarvis")({
  component: JarvisPage,
  ssr: false,
  head: () => ({
    meta: [
      { title: "JARVIS Console" },
      { name: "description", content: "Voice-first AI assistant." },
    ],
  }),
});

type Msg = { role: "user" | "assistant"; content: string };
type Phase = "idle" | "listening" | "thinking" | "speaking";

function JarvisPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [partial, setPartial] = useState("");
  const [license, setLicense] = useState<string | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const k = getLicense();
    if (!k) {
      navigate({ to: "/" });
      return;
    }
    setLicense(k);
  }, [navigate]);

  const signOut = () => {
    clearLicense();
    navigate({ to: "/" });
  };

  const speak = useCallback(async (text: string) => {
    try {
      setPhase("speaking");
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setPhase("idle");
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (e) {
      console.error(e);
      setPhase("idle");
      toast.error("Voice playback failed");
    }
  }, []);

  const sendToChat = useCallback(
    async (userText: string) => {
      const next: Msg[] = [...messages, { role: "user", content: userText }];
      setMessages(next);
      setPhase("thinking");
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next }),
        });
        if (!res.ok || !res.body) throw new Error(await res.text());
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = "";
        let buffer = "";
        setPartial("");
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const l = line.trim();
            if (!l.startsWith("data:")) continue;
            const data = l.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                full += delta;
                setPartial(full);
              }
            } catch {
              /* ignore */
            }
          }
        }
        setPartial("");
        setMessages([...next, { role: "assistant", content: full }]);
        if (full.trim()) await speak(full);
        else setPhase("idle");
      } catch (e) {
        console.error(e);
        toast.error("JARVIS is unavailable");
        setPhase("idle");
      }
    },
    [messages, speak]
  );

  const startListening = async () => {
    if (phase !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      mediaRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 1500) {
          toast.error("Recording too short");
          setPhase("idle");
          return;
        }
        setPhase("thinking");
        try {
          const fd = new FormData();
          const ext = mime.includes("mp4") ? "mp4" : "webm";
          fd.append("file", blob, `recording.${ext}`);
          const res = await fetch("/api/stt", { method: "POST", body: fd });
          if (!res.ok) throw new Error(await res.text());
          const json = await res.json();
          const text = (json.text || "").trim();
          if (!text) {
            toast.error("Didn't catch that");
            setPhase("idle");
            return;
          }
          await sendToChat(text);
        } catch (e) {
          console.error(e);
          toast.error("Transcription failed");
          setPhase("idle");
        }
      };
      rec.start();
      setPhase("listening");
    } catch (e) {
      console.error(e);
      toast.error("Microphone access denied");
    }
  };

  const stopListening = () => {
    if (mediaRef.current && phase === "listening") mediaRef.current.stop();
  };

  const handleMicClick = () => {
    if (phase === "listening") stopListening();
    else if (phase === "idle") startListening();
    else if (phase === "speaking" && audioRef.current) {
      audioRef.current.pause();
      setPhase("idle");
    }
  };

  if (!license) return null;

  const statusLabel = {
    idle: "Ready. Tap to speak.",
    listening: "Listening…",
    thinking: "Processing…",
    speaking: "Speaking…",
  }[phase];

  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b border-jarvis/15 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-jarvis animate-pulse" />
          <span className="font-display tracking-[0.3em] text-sm text-jarvis">JARVIS</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-muted-foreground hidden sm:inline">
            {license}
          </span>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground">
            <LogOut className="w-4 h-4 mr-1.5" /> Sign out
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 relative">
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-jarvis/10 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-2xl">
          {/* Orb */}
          <button
            onClick={handleMicClick}
            className="relative w-48 h-48 rounded-full border-2 border-jarvis/40 flex items-center justify-center jarvis-glow transition-transform hover:scale-105 active:scale-95 cursor-pointer bg-card/40"
            aria-label={statusLabel}
          >
            {phase === "listening" && (
              <>
                <span className="absolute inset-0 rounded-full border-2 border-jarvis animate-[jarvis-ring_1.5s_ease-out_infinite]" />
                <span className="absolute inset-0 rounded-full border-2 border-jarvis animate-[jarvis-ring_1.5s_ease-out_infinite_0.5s]" />
              </>
            )}
            <div
              className={`w-24 h-24 rounded-full bg-jarvis/80 ${
                phase !== "idle" ? "animate-[jarvis-pulse_1.5s_ease-in-out_infinite]" : ""
              }`}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              {phase === "thinking" ? (
                <Loader2 className="w-10 h-10 text-primary-foreground animate-spin" />
              ) : phase === "speaking" ? (
                <Volume2 className="w-10 h-10 text-primary-foreground" />
              ) : phase === "listening" ? (
                <Mic className="w-10 h-10 text-primary-foreground" />
              ) : (
                <MicOff className="w-10 h-10 text-primary-foreground/70" />
              )}
            </div>
          </button>

          <p className="text-sm uppercase tracking-[0.3em] text-jarvis/80 jarvis-text-glow">
            {statusLabel}
          </p>

          {/* Transcript */}
          <div className="w-full space-y-3 max-h-[280px] overflow-y-auto rounded-xl border border-jarvis/15 bg-card/40 backdrop-blur-sm p-4">
            {messages.length === 0 && !partial && (
              <p className="text-center text-sm text-muted-foreground italic">
                Say hello to begin.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-sm ${m.role === "user" ? "text-foreground" : "text-jarvis"}`}
              >
                <span className="text-xs uppercase tracking-widest opacity-60 mr-2">
                  {m.role === "user" ? "You" : "Jarvis"}
                </span>
                {m.content}
              </div>
            ))}
            {partial && (
              <div className="text-sm text-jarvis">
                <span className="text-xs uppercase tracking-widest opacity-60 mr-2">Jarvis</span>
                {partial}
                <span className="inline-block w-2 h-4 bg-jarvis/70 ml-1 align-middle animate-pulse" />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
