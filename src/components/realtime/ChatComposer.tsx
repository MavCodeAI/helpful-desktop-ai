import { useRef, useState, type KeyboardEvent } from "react";
import { Send, Loader2, StickyNote } from "lucide-react";
import type { LangCode } from "@/lib/persona";


type Props = {
  lang?: LangCode;
  onSend: (text: string) => void | Promise<void>;
  onNote?: (text: string) => void | Promise<void>;
  notePending?: boolean;
  busy?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
};

export function ChatComposer({ onSend, onNote, notePending, busy, placeholder = "Type a message…", autoFocus }: Props) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  const submit = async () => {
    const t = value.trim();
    if (!t || busy) return;
    setValue("");
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
          placeholder={placeholder}
          className="w-full resize-none bg-transparent outline-none text-sm text-foreground placeholder:text-white/30 max-h-40 py-1.5"
          style={{ minHeight: "1.75rem" }}
        />

      </div>

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
