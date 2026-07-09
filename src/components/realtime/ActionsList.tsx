import type { Intent } from "@/lib/intents";

type Action = Intent & { at: number; opened: boolean };

type Props = {
  actions: Action[];
  autoOpen: boolean;
  onToggleAutoOpen: (v: boolean) => void;
};

export function ActionsList({ actions, autoOpen, onToggleAutoOpen }: Props) {
  if (actions.length === 0) return null;
  return (
    <div className="max-w-2xl mx-auto mb-3 space-y-1.5">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-white/60 px-1">
        <span>Actions</span>
        <label className="flex items-center gap-1.5 cursor-pointer normal-case tracking-normal">
          <input
            type="checkbox"
            checked={autoOpen}
            onChange={(e) => onToggleAutoOpen(e.target.checked)}
            className="accent-cyan-400"
          />
          <span className="text-white/65">Auto-open</span>
        </label>
      </div>
      {actions.map((a, i) => (
        <div
          key={a.at + "-" + i}
          className="flex items-center gap-2 text-left rounded-lg border border-cyan-400/20 bg-cyan-400/[0.04] px-3 py-2 text-xs"
        >
          <span className="text-cyan-300/80 uppercase tracking-wider text-[10px] font-semibold shrink-0">
            {a.kind}
          </span>
          <span className="text-white/85 truncate flex-1">{a.label}</span>
          {a.opened ? (
            <span className="text-[10px] text-emerald-300/80 shrink-0">opened ✓</span>
          ) : (
            <a
              href={a.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[10px] px-2 py-0.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20 shrink-0"
            >
              Open
            </a>
          )}
        </div>
      ))}
    </div>
  );
}