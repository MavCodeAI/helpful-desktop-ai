import { useRef } from "react";
import { useFocusTrap } from "@/hooks/use-drawer-a11y";

export function GeminiKeyModal({
  value,
  onChange,
  onSave,
  onCancel,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(dialogRef, true);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gemini-key-title"
    >
      <div ref={dialogRef} className="glass p-6 max-w-md w-full">
        <h2 id="gemini-key-title" className="text-lg font-semibold mb-1">
          Gemini API Key
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Get one at{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-cyan-300"
          >
            aistudio.google.com/apikey
          </a>
        </p>
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="AIza…"
          className="glass-input w-full px-3 py-2 rounded-md text-sm"
          autoFocus
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="glass-item px-4 py-2 text-sm rounded-md">
            Cancel
          </button>
          <button onClick={onSave} className="glass-item glass-item-active px-4 py-2 text-sm rounded-md">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}