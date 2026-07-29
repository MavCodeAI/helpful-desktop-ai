import { useRef } from "react";
import { useFocusTrap } from "@/hooks/use-drawer-a11y";

export function ConfirmModal({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(dialogRef, true);
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby={description ? "confirm-modal-description" : undefined}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div ref={dialogRef} className="glass p-6 max-w-sm w-full">
        <h2 id="confirm-modal-title" className="text-base font-semibold text-white/95">{title}</h2>
        {description && <p id="confirm-modal-description" className="mt-2 text-sm text-white/60 leading-relaxed">{description}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="glass-item px-4 py-2 text-sm rounded-md min-h-11"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`glass-item ${danger ? "glass-item-danger" : "glass-item-active"} px-4 py-2 text-sm rounded-md min-h-11`}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
