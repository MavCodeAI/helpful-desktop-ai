import { useRef } from "react";
import { useFocusTrap } from "@/hooks/use-drawer-a11y";
import type { Thread } from "@/lib/chat-history";

export function DeleteConfirmModal({
  thread,
  onCancel,
  onConfirm,
}: {
  thread: Thread;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(dialogRef, true);
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-thread-title"
    >
      <div ref={dialogRef} className="glass p-6 max-w-sm w-full">
        <h2 id="delete-thread-title" className="text-base font-semibold text-white/95">
          Delete conversation?
        </h2>
        <p className="mt-2 text-sm text-white/60 break-words">
          <span className="text-white/85">“{thread.title}”</span>
          <span className="text-white/60">
            {" "}
            — {thread.messages.length} message{thread.messages.length === 1 ? "" : "s"}. This can't
            be undone.
          </span>
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="glass-item px-4 py-2 text-sm rounded-md" autoFocus>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="glass-item glass-item-danger px-4 py-2 text-sm rounded-md"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}