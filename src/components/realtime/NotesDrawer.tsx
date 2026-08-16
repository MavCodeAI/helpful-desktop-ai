import { useEffect, useRef, useState } from "react";
import { X, Trash2, StickyNote, Plus, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useFocusTrap, useSwipeClose } from "@/hooks/use-drawer-a11y";
import { useNotes } from "@/lib/utilities/notes";
import { useAiNotesEnabled } from "@/hooks/use-ai-notes-enabled";
import { useUILang } from "@/hooks/use-ui-lang";
import { generateNote } from "@/lib/note-ai.functions";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NotesDrawer({ open, onClose }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  useSwipeClose(ref, "left", onClose, open);
  useFocusTrap(ref, open);
  const { notes, add, remove, clear } = useNotes();
  const { isUrdu } = useUILang();
  const copy = isUrdu ? {
    title: "یادداشتیں", close: "یادداشتیں بند کریں", aiOn: "AI فعال ہے — بند کرنے کے لیے دبائیں", aiOff: "AI بند ہے — فعال کرنے کے لیے دبائیں", aiLabel: "AI", on: "فعال", off: "بند", clearAll: "سب صاف کریں", aiDisabled: "AI mode بند ہے — header سے فعال کریں", aiModeOn: "AI mode فعال — مختصر خیال لکھیں", toggleAi: "AI note mode تبدیل کریں", aiPlaceholder: "AI: مختصر خیال → صاف یادداشت…", addPlaceholder: "یادداشت شامل کریں…", add: "شامل کریں", noNotes: "ابھی کوئی یادداشت نہیں۔", helper: "کہیں “یاد رکھو …”، اوپر لکھیں، یا AI کے لیے ✨ دبائیں۔", justAdded: "ابھی شامل ہوئی", delete: "یادداشت حذف کریں", dialog: "یادداشتیں"
  } : {
    title: "Notes", close: "Close notes", aiOn: "AI note generation is ON — click to disable", aiOff: "AI note generation is OFF — click to enable", aiLabel: "AI", on: "on", off: "off", clearAll: "Clear all", aiDisabled: "AI mode is disabled — enable it from the header", aiModeOn: "AI mode ON — write a rough idea", toggleAi: "Toggle AI-generate mode", aiPlaceholder: "AI: rough idea → clean note…", addPlaceholder: "Add a note…", add: "Add", noNotes: "No notes yet.", helper: "Say ‘note: buy milk’, type above, or hit ✨ for AI.", justAdded: "just added", delete: "Delete note", dialog: "Notes"
  };
  const [aiEnabled, setAiEnabled] = useAiNotesEnabled();

  const [draft, setDraft] = useState("");
  const [aiMode, setAiMode] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());

  // Seed known IDs on first open
  useEffect(() => {
    if (open && seenIds.current.size === 0) {
      seenIds.current = new Set(notes.map((n) => n.id));
    }
  }, [open, notes]);

  // Flash new notes for 2s + scroll top
  useEffect(() => {
    const fresh: string[] = [];
    for (const n of notes) if (!seenIds.current.has(n.id)) fresh.push(n.id);
    if (fresh.length === 0) return;
    fresh.forEach((id) => seenIds.current.add(id));
    setFlashIds((prev) => { const next = new Set(prev); fresh.forEach((id) => next.add(id)); return next; });
    if (open && listRef.current) listRef.current.scrollTop = 0;
    const t = setTimeout(() => {
      setFlashIds((prev) => { const next = new Set(prev); fresh.forEach((id) => next.delete(id)); return next; });
    }, 2000);
    return () => clearTimeout(t);
  }, [notes, open]);

  // Autofocus input on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const t = draft.trim();
    if (!t) return;
    if (aiMode && aiEnabled) {
      setAiBusy(true);
      try {
        const res = await generateNote({ data: { prompt: t } });
        add(res.text);
        setDraft("");
        const summary = res.text.length > 60 ? res.text.slice(0, 60) + "…" : res.text;
        toast.success("✨ AI note added", { description: summary });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "AI note failed");
      } finally {
        setAiBusy(false);
      }
    } else {
      add(t);
      setDraft("");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true" aria-label={copy.dialog}>
      <button aria-label={copy.close} className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <aside
        ref={ref}
        className="glass-card relative h-full w-full max-w-[100vw] sm:w-[400px] rounded-none sm:rounded-r-2xl overflow-hidden flex flex-col"
        style={{ animation: "slideInLeft 0.25s ease-out" }}
      >
        <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 bg-[oklch(0.13_0.02_240/0.75)] backdrop-blur-xl border-b border-white/10">
          <div className="flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-cyan-300" />
            <h2 className="text-sm font-semibold text-white/90">Notes</h2>
            <span className="text-[10px] text-white/50 tabular-nums">{notes.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setAiEnabled(!aiEnabled); if (aiEnabled) setAiMode(false); }}
              aria-pressed={aiEnabled}
              title={aiEnabled ? copy.aiOn : copy.aiOff}
              className={`text-[10px] px-2 py-1 rounded-full border flex items-center gap-1 transition-colors ${
                aiEnabled
                  ? "bg-cyan-400/15 border-cyan-400/40 text-cyan-200"
                  : "bg-white/5 border-white/10 text-white/50 hover:text-white/80"
              }`}
            >
              <Sparkles className="w-3 h-3" strokeWidth={1.75} />
              <span>{copy.aiLabel} {aiEnabled ? copy.on : copy.off}</span>
            </button>
            {notes.length > 0 && (
              <button
                onClick={clear}
                className="min-h-11 px-2 text-[10px] text-white/50 hover:text-red-300 rounded hover:bg-white/5 touch-manipulation"
              >{copy.clearAll}</button>
            )}
            <button onClick={onClose} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-full hover:bg-white/5 text-white/60 hover:text-white touch-manipulation" aria-label={copy.close}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="shrink-0 px-3 py-3 border-b border-white/10 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAiMode((v) => !v)}
            disabled={!aiEnabled}
            aria-pressed={aiMode && aiEnabled}
            title={
              !aiEnabled
                ? copy.aiDisabled
                : aiMode
                  ? copy.aiModeOn
                  : copy.toggleAi
            }
            className={`shrink-0 min-h-11 min-w-11 grid place-items-center rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              aiMode && aiEnabled
                ? "bg-cyan-400/20 border-cyan-400/50 text-cyan-200"
                : "bg-white/5 border-white/10 text-white/60 hover:text-white/90"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={aiMode && aiEnabled ? copy.aiPlaceholder : copy.addPlaceholder}
            className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-400/50"
          />
          <button
            type="submit"
            disabled={!draft.trim() || aiBusy}
            className="shrink-0 px-3 py-2 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-cyan-100 text-sm hover:bg-cyan-500/30 disabled:opacity-40 flex items-center gap-1"
          >
            {aiBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{aiMode && aiEnabled ? copy.aiLabel : copy.add}</span>
          </button>
        </form>

        <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2">
          {notes.length === 0 ? (
            <div className="text-center text-xs text-white/50 mt-8 px-4 leading-relaxed">
              {copy.noNotes}<br />
              {copy.helper}
            </div>
          ) : (
            notes.map((n) => {
              const flash = flashIds.has(n.id);
              return (
                <div
                  key={n.id}
                  className={
                    "group rounded-md p-3 border transition-all duration-500 " +
                    (flash
                      ? "bg-cyan-400/10 border-cyan-300/60 shadow-[0_0_0_1px_rgba(103,232,249,0.35),0_0_24px_-4px_rgba(103,232,249,0.55)]"
                      : "glass-item border-white/10")
                  }
                >
                  <div className="text-xs text-white/85 whitespace-pre-wrap break-words">{n.text}</div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-white/40 tabular-nums flex items-center gap-1.5">
                      {new Date(n.at).toLocaleString()}
                      {flash && <span className="text-cyan-300/90">· {copy.justAdded}</span>}
                    </span>
                    <button
                      onClick={() => remove(n.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-white/50 hover:text-red-300 p-1"
                      aria-label={copy.delete}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
