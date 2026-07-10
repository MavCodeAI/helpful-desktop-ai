import { useRef } from "react";
import { X, Trash2, StickyNote } from "lucide-react";
import { useFocusTrap, useSwipeClose } from "@/hooks/use-drawer-a11y";
import { useNotes } from "@/lib/utilities/notes";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NotesDrawer({ open, onClose }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  useSwipeClose(ref, "left", onClose, open);
  useFocusTrap(ref, open);
  const { notes, remove, clear } = useNotes();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true" aria-label="Notes">
      <button aria-label="Close notes" className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <aside
        ref={ref}
        className="glass-card relative h-full w-full max-w-[100vw] sm:w-[380px] rounded-none sm:rounded-r-2xl overflow-hidden flex flex-col"
        style={{ animation: "slideInLeft 0.25s ease-out" }}
      >
        <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 bg-[oklch(0.13_0.02_240/0.75)] backdrop-blur-xl border-b border-white/10">
          <div className="flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-cyan-300" />
            <h2 className="text-sm font-semibold text-white/90">Notes</h2>
            <span className="text-[10px] text-white/50 tabular-nums">{notes.length}</span>
          </div>
          <div className="flex items-center gap-1">
            {notes.length > 0 && (
              <button
                onClick={clear}
                className="text-[10px] text-white/50 hover:text-red-300 px-2 py-1 rounded hover:bg-white/5"
              >Clear all</button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/5 text-white/60 hover:text-white" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {notes.length === 0 ? (
            <div className="text-center text-xs text-white/50 mt-8 px-4">
              No notes yet. Try saying:<br />
              <span className="text-cyan-300/80 font-mono text-[11px]">"note likho: milk lena hai"</span>
            </div>
          ) : (
            notes.map((n) => (
              <div key={n.id} className="glass-item rounded-md p-3 group">
                <div className="text-xs text-white/85 whitespace-pre-wrap break-words">{n.text}</div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-white/40 tabular-nums">
                    {new Date(n.at).toLocaleString()}
                  </span>
                  <button
                    onClick={() => remove(n.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-white/50 hover:text-red-300 p-1"
                    aria-label="Delete note"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
