import { X, Trash2, Pencil, Check } from "lucide-react";
import type { Thread } from "@/lib/chat-history";

interface Props {
  t: Thread;
  isActive: boolean;
  isRenaming: boolean;
  renameDraft: string;
  setRenameDraft: (v: string) => void;
  beginRename: (t: Thread) => void;
  commitRename: () => void;
  cancelRename: () => void;
  openThread: (id: string) => void;
  onRequestDelete: (t: Thread) => void;
}

export function ThreadRow({
  t, isActive, isRenaming, renameDraft, setRenameDraft,
  beginRename, commitRename, cancelRename, openThread, onRequestDelete,
}: Props) {
  return (
    <div className={`glass-item ${isActive ? "glass-item-active" : ""} group flex items-center gap-2 rounded-lg p-2.5`}>
      {isRenaming ? (
        <>
          <input
            autoFocus
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onFocus={(e) => {
              const el = e.currentTarget;
              window.setTimeout(() => {
                el.scrollIntoView({ block: "center", behavior: "smooth" });
              }, 320);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commitRename(); }
              else if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
            }}
            maxLength={80}
            className="glass-input flex-1 min-w-0 min-h-11 rounded px-3 py-2 text-xs sm:text-sm"
            aria-label="Rename conversation"
          />
          <button onClick={commitRename} className="min-h-10 min-w-10 inline-flex items-center justify-center rounded hover:bg-cyan-400/20 text-cyan-200 shrink-0 touch-manipulation" aria-label="Save name" title="Save">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={cancelRename} className="min-h-10 min-w-10 inline-flex items-center justify-center rounded hover:bg-white/10 text-white/60 shrink-0 touch-manipulation" aria-label="Cancel rename" title="Cancel">
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => openThread(t.id)}
            onDoubleClick={() => beginRename(t)}
            className="flex-1 min-h-11 text-left min-w-0 touch-manipulation"
          >
            <div className={`text-xs sm:text-sm truncate ${isActive ? "text-cyan-100" : "text-white/85"}`}>
              {t.title}
            </div>
            <div className="text-[10px] text-white/60 mt-0.5 flex items-center gap-1.5">
              <span>
                {new Date(t.updatedAt).toLocaleDateString()} ·{" "}
                {new Date(t.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span>·</span>
              <span className="tabular-nums">
                {t.messages.length} msg{t.messages.length === 1 ? "" : "s"}
              </span>
            </div>
          </button>
          <button
            onClick={() => beginRename(t)}
            className="min-h-10 min-w-10 inline-flex items-center justify-center rounded hover:bg-cyan-400/20 text-white/60 hover:text-cyan-200 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0 touch-manipulation"
            aria-label="Rename conversation" title="Rename"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onRequestDelete(t)}
            className="min-h-10 min-w-10 inline-flex items-center justify-center rounded hover:bg-red-500/20 text-white/60 hover:text-red-300 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0 touch-manipulation"
            aria-label="Delete conversation" title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
}