import { useRef, useState, type KeyboardEvent } from "react";
import { Send, Loader2, StickyNote, Mic, MicOff, ShieldCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useDeepgramLive } from "@/hooks/use-deepgram-live";
import { checkDeepgramKey } from "@/lib/deepgram-token.functions";
import { loadLang } from "@/lib/persona";

type Props = {
  onSend: (text: string) => void | Promise<void>;
  onNote?: (text: string) => void | Promise<void>;
  notePending?: boolean;
  busy?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
};

export function ChatComposer({ onSend, onNote, notePending, busy, placeholder = "Type a message…", autoFocus }: Props) {
  const [value, setValue] = useState("");
  const [interim, setInterim] = useState("");
  const [keyCheck, setKeyCheck] = useState<{ status: "idle" | "checking" | "ok" | "bad"; message: string }>({ status: "idle", message: "" });
  const taRef = useRef<HTMLTextAreaElement>(null);
  const runCheck = useServerFn(checkDeepgramKey);

  const checkKey = async () => {
    setKeyCheck({ status: "checking", message: "" });
    try {
      const r = await runCheck();
      setKeyCheck({ status: r.ok ? "ok" : "bad", message: r.message });
    } catch (e) {
      setKeyCheck({ status: "bad", message: e instanceof Error ? e.message : "Check failed" });
    }
    setTimeout(() => setKeyCheck((s) => ({ ...s, status: "idle" })), 6000);
  };

  const live = useDeepgramLive({
    lang: loadLang(),
    onFinal: (text) => {
      setValue((prev) => (prev ? `${prev.trimEnd()} ${text}` : text) + " ");
      requestAnimationFrame(() => taRef.current?.focus());
    },
    onInterim: setInterim,
  });

  const submit = async () => {
    const t = value.trim();
    if (!t || busy) return;
    if (live.status === "listening") live.stop();
    setValue("");
    setInterim("");
    await onSend(t);
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const handleNote = async () => {
    if (!onNote || notePending) return;
    const t = value.trim();
    await onNote(t);
    if (t) setValue("");
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const listening = live.status === "listening";
  const connecting = live.status === "connecting";

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void submit(); }}
      className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur px-3 py-2 focus-within:border-cyan-400/40 transition-colors"
    >
      <div className="flex-1 relative">
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          autoFocus={autoFocus}
          placeholder={listening ? "Listening… speak now" : placeholder}
          className="w-full resize-none bg-transparent outline-none text-sm text-foreground placeholder:text-white/30 max-h-40 py-1.5"
          style={{ minHeight: "1.75rem" }}
        />
        {interim && (
          <div className="pointer-events-none absolute inset-x-0 -bottom-1 translate-y-full text-[11px] text-cyan-300/70 italic truncate">
            {interim}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => live.toggle()}
        disabled={busy || connecting}
        aria-label={listening ? "Stop live transcription" : "Start live transcription"}
        title={listening ? "Stop mic" : "Live voice → text (Deepgram)"}
        className={`shrink-0 w-9 h-9 grid place-items-center rounded-full border transition-colors ${
          listening
            ? "bg-red-500/20 border-red-400/40 text-red-200 animate-pulse"
            : "bg-white/5 border-white/10 text-white/70 hover:text-cyan-200 hover:border-cyan-400/40"
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {connecting ? (
          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
        ) : listening ? (
          <MicOff className="w-4 h-4" strokeWidth={1.75} />
        ) : (
          <Mic className="w-4 h-4" strokeWidth={1.75} />
        )}
      </button>

      {onNote && (
        <button
          type="button"
          onClick={handleNote}
          disabled={notePending || busy}
          aria-label="Save as note (AI can polish it)"
          title={value.trim() ? "Save as note (AI polishes if enabled)" : "Open Notes"}
          className="shrink-0 h-9 px-2.5 grid place-items-center rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-cyan-200 hover:border-cyan-400/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
        >
          {notePending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} />
          ) : (
            <StickyNote className="w-3.5 h-3.5" strokeWidth={1.75} />
          )}
          <span className="text-[11px] hidden sm:inline">Note</span>
        </button>
      )}
      <button
        type="submit"
        disabled={busy || !value.trim()}
        aria-label="Send message"
        className="shrink-0 w-9 h-9 grid place-items-center rounded-full bg-cyan-400/15 border border-cyan-400/30 text-cyan-200 hover:bg-cyan-400/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {busy ? (
          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
        ) : (
          <Send className="w-4 h-4" strokeWidth={1.75} />
        )}
      </button>
    </form>
  );
}
