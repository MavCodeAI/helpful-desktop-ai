/**
 * JARVIS console — voice-first assistant page.
 *
 * Features:
 *  - Threaded chat history (localStorage-backed) with sidebar viewer.
 *  - TTS settings: voice, speed, volume — persisted per browser.
 *  - Voice controls:
 *      * Recording: start / pause / resume / stop.
 *      * Playback : pause / resume / restart / stop.
 *
 * Phase state machine:
 *   idle → listening → thinking → speaking → idle
 * `listening` may transiently be paused (MediaRecorder.pause) while phase
 * stays "listening" — tracked in `recPaused`. Same for `playPaused` in
 * "speaking".
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic,
  MicOff,
  Loader2,
  LogOut,
  Volume2,
  Pause,
  Play,
  Square,
  RotateCcw,
  Settings,
  History,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { getLicense, clearLicense } from "@/lib/license";
import {
  loadTTSSettings,
  saveTTSSettings,
  VOICE_OPTIONS,
  type TTSSettings,
  type TTSVoice,
} from "@/lib/tts-settings";
import {
  loadThreads,
  upsertThread,
  deleteThread,
  createThread,
  deriveTitle,
  type Thread,
  type ChatMsg,
} from "@/lib/chat-history";
import { HologramSafe } from "@/components/HologramSafe";
import { useMicLevel } from "@/hooks/useMicLevel";
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

type Phase = "idle" | "listening" | "thinking" | "speaking";

function JarvisPage() {
  const navigate = useNavigate();

  // --- License gate ---
  const [license, setLicense] = useState<string | null>(null);

  // --- Threads / history ---
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);

  // --- Chat phase + streaming ---
  const [phase, setPhase] = useState<Phase>("idle");
  const [partial, setPartial] = useState("");

  // --- Voice control sub-states ---
  const [recPaused, setRecPaused] = useState(false);
  const [playPaused, setPlayPaused] = useState(false);

  // --- TTS settings ---
  const [tts, setTts] = useState<TTSSettings>(loadTTSSettings);
  const lastSpokenRef = useRef<string>(""); // for "restart playback"

  // --- Browser API refs ---
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /* ---------- bootstrap ---------- */

  useEffect(() => {
    const k = getLicense();
    if (!k) {
      navigate({ to: "/" });
      return;
    }
    setLicense(k);

    // Load threads; create the first one if empty.
    const existing = loadThreads();
    if (existing.length === 0) {
      const t = createThread();
      const list = upsertThread(t);
      setThreads(list);
      setActiveId(t.id);
      setMessages([]);
    } else {
      setThreads(existing);
      setActiveId(existing[0].id);
      setMessages(existing[0].messages);
    }
  }, [navigate]);

  /** Persist current messages into the active thread whenever they change. */
  useEffect(() => {
    if (!activeId) return;
    const current = threads.find((t) => t.id === activeId);
    // Skip write when the active thread is empty and messages are empty too.
    if (!current && messages.length === 0) return;
    const updated: Thread = {
      id: activeId,
      title: deriveTitle(messages) || current?.title || "New conversation",
      updatedAt: Date.now(),
      messages,
    };
    const list = upsertThread(updated);
    setThreads(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  /* ---------- TTS settings ---------- */

  const updateTts = (patch: Partial<TTSSettings>) => {
    const next = { ...tts, ...patch };
    setTts(next);
    saveTTSSettings(next);
    // Live-apply volume to any in-flight playback.
    if (audioRef.current && patch.volume !== undefined) {
      audioRef.current.volume = patch.volume;
    }
  };

  /* ---------- Speak (TTS) ---------- */

  /**
   * Fetch TTS audio for `text` and play it. Stores the text in
   * `lastSpokenRef` so the "restart" button can replay it.
   */
  const speak = useCallback(
    async (text: string) => {
      try {
        setPhase("speaking");
        setPlayPaused(false);
        lastSpokenRef.current = text;

        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: tts.voice, speed: tts.speed }),
        });
        if (!res.ok) throw new Error(await res.text());
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        // Release any previous URL before overwriting.
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = url;

        const audio = new Audio(url);
        audio.volume = tts.volume;
        audioRef.current = audio;
        audio.onended = () => {
          setPhase("idle");
          setPlayPaused(false);
        };
        await audio.play();
      } catch (e) {
        console.error(e);
        setPhase("idle");
        toast.error("Voice playback failed");
      }
    },
    [tts]
  );

  /* ---------- Chat (LLM streaming) ---------- */

  const sendToChat = useCallback(
    async (userText: string) => {
      const next: ChatMsg[] = [...messages, { role: "user", content: userText }];
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
              /* skip keepalives */
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

  /* ---------- Recording controls ---------- */

  const startListening = async () => {
    if (phase !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      mediaRef.current = rec;
      chunksRef.current = [];
      setRecPaused(false);

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

  /** Pause the active recording without finishing it. */
  const pauseRecording = () => {
    if (mediaRef.current && phase === "listening" && !recPaused) {
      mediaRef.current.pause();
      setRecPaused(true);
    }
  };

  /** Resume a paused recording. */
  const resumeRecording = () => {
    if (mediaRef.current && phase === "listening" && recPaused) {
      mediaRef.current.resume();
      setRecPaused(false);
    }
  };

  /** Finish recording → triggers STT + chat. */
  const stopListening = () => {
    if (mediaRef.current && phase === "listening") mediaRef.current.stop();
  };

  /** Cancel recording entirely (throw away audio, return to idle). */
  const cancelRecording = () => {
    if (mediaRef.current && phase === "listening") {
      chunksRef.current = [];
      // Replace onstop with a no-op teardown to skip STT.
      mediaRef.current.onstop = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setPhase("idle");
        setRecPaused(false);
      };
      mediaRef.current.stop();
    }
  };

  /* ---------- Playback controls ---------- */

  const pausePlayback = () => {
    if (audioRef.current && phase === "speaking" && !playPaused) {
      audioRef.current.pause();
      setPlayPaused(true);
    }
  };
  const resumePlayback = () => {
    if (audioRef.current && phase === "speaking" && playPaused) {
      audioRef.current.play().catch(() => {});
      setPlayPaused(false);
    }
  };
  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPhase("idle");
    setPlayPaused(false);
  };
  /** Restart from beginning; if no audio loaded, re-request TTS. */
  const restartPlayback = async () => {
    if (audioRef.current && phase === "speaking") {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      setPlayPaused(false);
      return;
    }
    if (lastSpokenRef.current) await speak(lastSpokenRef.current);
  };

  /* ---------- Orb tap dispatch ---------- */

  const handleMicClick = () => {
    if (phase === "listening") stopListening();
    else if (phase === "idle") startListening();
    else if (phase === "speaking") stopPlayback();
  };

  /* ---------- Thread actions ---------- */

  const newConversation = () => {
    // Cancel anything in progress.
    if (phase === "listening") cancelRecording();
    if (phase === "speaking") stopPlayback();
    const t = createThread();
    const list = upsertThread(t);
    setThreads(list);
    setActiveId(t.id);
    setMessages([]);
    setPartial("");
  };

  const openThread = (id: string) => {
    if (phase === "listening") cancelRecording();
    if (phase === "speaking") stopPlayback();
    const t = threads.find((x) => x.id === id);
    if (!t) return;
    setActiveId(id);
    setMessages(t.messages);
    setPartial("");
  };

  const removeThread = (id: string) => {
    const list = deleteThread(id);
    if (list.length === 0) {
      const t = createThread();
      const seeded = upsertThread(t);
      setThreads(seeded);
      setActiveId(t.id);
      setMessages([]);
    } else {
      setThreads(list);
      if (id === activeId) {
        setActiveId(list[0].id);
        setMessages(list[0].messages);
      }
    }
  };

  const signOut = () => {
    clearLicense();
    navigate({ to: "/" });
  };

  // Live mic amplitude → volumetric orb density.
  // Passive analyser runs while page is mounted; the recording MediaRecorder
  // uses its own independent stream, so both can coexist.
  const micLevel = useMicLevel(!!license);

  if (!license) return null;

  const statusLabel = {
    idle: "Ready. Tap to speak.",
    listening: recPaused ? "Paused" : "Listening…",
    thinking: "Processing…",
    speaking: playPaused ? "Paused" : "Speaking…",
  }[phase];

  return (
    <main className="min-h-dvh flex flex-col relative overflow-hidden">
      {/* Orb is rendered inside the mic cluster (below) so it always hugs the button. */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-jarvis/15 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-jarvis animate-pulse" />
          <span className="font-display tracking-[0.3em] text-sm text-jarvis">JARVIS</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {/* History drawer */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Conversation history" className="text-muted-foreground hover:text-foreground min-h-11 min-w-11 sm:min-h-9 sm:min-w-0 px-2 sm:px-3">
                <History className="w-4 h-4 sm:mr-1.5" /> <span className="hidden sm:inline">History</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] sm:w-[320px] flex flex-col">

              <SheetHeader>
                <SheetTitle className="font-display tracking-widest text-jarvis">Conversations</SheetTitle>
              </SheetHeader>
              <Button onClick={newConversation} className="mt-4" variant="outline">
                <Plus className="w-4 h-4 mr-1.5" /> New conversation
              </Button>
              <div className="mt-4 flex-1 overflow-y-auto space-y-2">
                {threads.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">No conversations yet.</p>
                )}
                {threads.map((t) => (
                  <div
                    key={t.id}
                    className={`group flex items-center gap-2 rounded-lg border p-2.5 transition-colors ${
                      t.id === activeId
                        ? "border-jarvis/50 bg-jarvis/10"
                        : "border-border/50 hover:border-jarvis/30"
                    }`}
                  >
                    <button
                      onClick={() => openThread(t.id)}
                      className="flex-1 text-left"
                    >
                      <div className="text-sm truncate">{t.title}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(t.updatedAt).toLocaleString()} · {t.messages.length} msgs
                      </div>
                    </button>
                    <button
                      onClick={() => removeThread(t.id)}
                      className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>

          {/* TTS settings drawer */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Voice settings" className="text-muted-foreground hover:text-foreground min-h-11 min-w-11 sm:min-h-9 sm:min-w-0 px-2 sm:px-3">
                <Settings className="w-4 h-4 sm:mr-1.5" /> <span className="hidden sm:inline">Voice</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] sm:w-[340px]">

              <SheetHeader>
                <SheetTitle className="font-display tracking-widest text-jarvis">Voice Settings</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">
                    Voice
                  </label>
                  <Select
                    value={tts.voice}
                    onValueChange={(v) => updateTts({ voice: v as TTSVoice })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICE_OPTIONS.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-xs uppercase tracking-widest text-muted-foreground">
                      Speed
                    </label>
                    <span className="text-xs text-jarvis font-mono">{tts.speed.toFixed(2)}×</span>
                  </div>
                  <Slider
                    min={0.5}
                    max={2}
                    step={0.05}
                    value={[tts.speed]}
                    onValueChange={([v]) => updateTts({ speed: v })}
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-xs uppercase tracking-widest text-muted-foreground">
                      Volume
                    </label>
                    <span className="text-xs text-jarvis font-mono">
                      {Math.round(tts.volume * 100)}%
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={1}
                    step={0.05}
                    value={[tts.volume]}
                    onValueChange={([v]) => updateTts({ volume: v })}
                  />
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => speak("Systems online. All voice parameters updated.")}
                >
                  <Volume2 className="w-4 h-4 mr-1.5" /> Test voice
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <span className="text-xs font-mono text-muted-foreground hidden md:inline">
            {license}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            aria-label="Sign out"
            className="text-muted-foreground hover:text-foreground min-h-11 min-w-11 sm:min-h-9 sm:min-w-0 px-2 sm:px-3"
          >
            <LogOut className="w-4 h-4 sm:mr-1.5" /> <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-between px-4 sm:px-6 pt-8 pb-6 relative gap-6">
        <h1 className="sr-only">JARVIS Voice Assistant</h1>

        {/* Top zone — orb wraps the mic button so they read as one unit */}
        <div className="relative z-10 flex flex-col items-center gap-5 mt-6 sm:mt-16">
          {/* Orb sits behind the button, matching its center */}
          <div className="relative flex items-center justify-center">
            <div
              className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none w-[280px] h-[280px] sm:w-[420px] sm:h-[420px] transition-opacity duration-500 ${
                phase === "idle" ? "opacity-50" : phase === "speaking" ? "opacity-95" : "opacity-80"
              }`}
              aria-hidden="true"
            >
              <HologramSafe level={micLevel} />
            </div>
          <button
            onClick={handleMicClick}
            className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full border-2 border-jarvis/50 bg-background/70 backdrop-blur-md jarvis-glow flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jarvis focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={statusLabel}
          >
            {phase === "listening" && !recPaused && (
              <>
                <span className="absolute inset-0 rounded-full border-2 border-jarvis animate-[jarvis-ring_1.5s_ease-out_infinite]" />
                <span className="absolute inset-0 rounded-full border-2 border-jarvis animate-[jarvis-ring_1.5s_ease-out_infinite_0.5s]" />
              </>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              {phase === "thinking" ? (
                <Loader2 className="w-12 h-12 text-jarvis animate-spin" />
              ) : phase === "speaking" ? (
                <Volume2 className="w-12 h-12 text-jarvis" />
              ) : phase === "listening" ? (
                <Mic className="w-12 h-12 text-jarvis" />
              ) : (
                <Mic className="w-12 h-12 text-jarvis" />
              )}
            </div>
          </button>
          </div>



          {/* Status pill — solid background so text is readable over orb */}
          <div
            className="px-4 py-1.5 rounded-full bg-background/80 backdrop-blur-sm border border-jarvis/25"
            role="status"
            aria-live="polite"
          >
            <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-jarvis">
              {statusLabel}
            </p>
          </div>
        </div>

        {/* Middle zone — control clusters */}
        <div className="relative z-10 flex flex-col items-center gap-3 min-h-[40px]">
          {phase === "listening" && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {recPaused ? (
                <Button variant="outline" size="sm" onClick={resumeRecording}>
                  <Play className="w-4 h-4 mr-1.5" /> Resume
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={pauseRecording}>
                  <Pause className="w-4 h-4 mr-1.5" /> Pause
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={stopListening}>
                <Square className="w-4 h-4 mr-1.5" /> Send
              </Button>
              <Button variant="ghost" size="sm" onClick={cancelRecording}>
                Cancel
              </Button>
            </div>
          )}

          {phase === "speaking" && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {playPaused ? (
                <Button variant="outline" size="sm" onClick={resumePlayback}>
                  <Play className="w-4 h-4 mr-1.5" /> Resume
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={pausePlayback}>
                  <Pause className="w-4 h-4 mr-1.5" /> Pause
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={restartPlayback}>
                <RotateCcw className="w-4 h-4 mr-1.5" /> Restart
              </Button>
              <Button variant="outline" size="sm" onClick={stopPlayback}>
                <Square className="w-4 h-4 mr-1.5" /> Stop
              </Button>
            </div>
          )}

          {phase === "idle" && lastSpokenRef.current && (
            <Button variant="ghost" size="sm" onClick={restartPlayback}>
              <RotateCcw className="w-4 h-4 mr-1.5" /> Replay last reply
            </Button>
          )}
        </div>

        {/* Bottom zone — transcript pinned to the bottom */}
        <div className="relative z-10 w-full max-w-2xl space-y-3 max-h-[240px] overflow-y-auto rounded-xl border border-jarvis/20 bg-background/70 backdrop-blur-md p-4">
          {messages.length === 0 && !partial && (
            <p className="text-center text-sm text-muted-foreground italic">
              Say hello to begin — tap the mic and speak.
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
    </main>
  );
}
