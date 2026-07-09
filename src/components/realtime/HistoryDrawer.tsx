import { useRef } from "react";
import { X, Plus } from "lucide-react";
import { useFocusTrap, useSwipeClose } from "@/hooks/use-drawer-a11y";
import type { Thread } from "@/lib/chat-history";
import { ThreadRow } from "@/components/realtime/history/ThreadRow";
import { HistorySearch } from "@/components/realtime/history/HistorySearch";

export interface HistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  threads: Thread[];
  filteredThreads: Thread[];
  activeThreadId: string;
  historyQuery: string;
  setHistoryQuery: (v: string) => void;
  renamingId: string;
  renameDraft: string;
  setRenameDraft: (v: string) => void;
  beginRename: (t: Thread) => void;
  commitRename: () => void;
  cancelRename: () => void;
  openThread: (id: string) => void;
  onRequestDelete: (t: Thread) => void;
  onNewConversation: () => void;
}

export function HistoryDrawer(props: HistoryDrawerProps) {
  const drawerRef = useRef<HTMLElement | null>(null);
  useSwipeClose(drawerRef, "left", props.onClose, props.open);
  useFocusTrap(drawerRef, props.open);
  if (!props.open) return null;

  const {
    onClose,
    threads,
    filteredThreads,
    activeThreadId,
    historyQuery,
    setHistoryQuery,
    renamingId,
    renameDraft,
    setRenameDraft,
    beginRename,
    commitRename,
    cancelRename,
    openThread,
    onRequestDelete,
    onNewConversation,
  } = props;

  return (
    <div
      className="fixed inset-0 z-40 flex"
      role="dialog"
      aria-modal="true"
      aria-label="Conversation history"
    >
      <aside
        ref={drawerRef}
        className="glass-card relative h-full w-full max-w-[100vw] sm:w-[340px] rounded-none sm:rounded-r-2xl overflow-hidden flex flex-col"
        style={{ animation: "slideInLeft 0.25s ease-out" }}
      >
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 sm:px-5 py-3 sm:py-4 border-b border-white/10">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white/90 tracking-wide truncate">
              Conversations
            </h2>
            <div className="text-[10px] uppercase tracking-widest text-white/60 mt-0.5 truncate">
              {threads.length} saved · this browser
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-full hover:bg-white/5 text-white/60 hover:text-white"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="shrink-0 px-3 sm:px-5 pt-3 sm:pt-4 pb-2">
          <button
            onClick={onNewConversation}
            className="glass-item glass-item-active w-full text-sm px-3 py-2 rounded-md flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            New conversation
          </button>
        </div>
        <div className="shrink-0 px-3 sm:px-5 pb-3">
          <HistorySearch historyQuery={historyQuery} setHistoryQuery={setHistoryQuery} />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 sm:px-3 pb-4 space-y-1.5">
          {threads.length === 0 && (
            <div className="text-xs text-white/60 italic px-2 py-4 text-center">
              No conversations yet.
            </div>
          )}
          {threads.length > 0 && filteredThreads.length === 0 && (
            <div className="text-xs text-white/60 italic px-2 py-4 text-center">
              No matches for “{historyQuery}”.
            </div>
          )}
          {filteredThreads.map((t) => (
            <ThreadRow
              key={t.id}
              t={t}
              isActive={t.id === activeThreadId}
              isRenaming={t.id === renamingId}
              renameDraft={renameDraft}
              setRenameDraft={setRenameDraft}
              beginRename={beginRename}
              commitRename={commitRename}
              cancelRename={cancelRename}
              openThread={openThread}
              onRequestDelete={onRequestDelete}
            />
          ))}
        </div>
      </aside>
      <button
        aria-label="Close history"
        className="flex-1 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
    </div>
  );
}