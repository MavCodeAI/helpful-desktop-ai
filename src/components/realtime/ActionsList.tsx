import type { Intent } from "@/lib/intents";
import type { PendingApproval } from "@/hooks/use-intent-actions";

type Action = Intent & { at: number; opened: boolean };

type Props = {
  actions: Action[];
  autoOpen: boolean;
  onToggleAutoOpen: (v: boolean) => void;
  pendingApproval: PendingApproval | null;
  onApprove: () => void | Promise<void>;
  onReject: () => void;
};

export function ActionsList({
  actions,
  autoOpen,
  onToggleAutoOpen,
  pendingApproval,
  onApprove,
  onReject,
}: Props) {
  if (actions.length === 0 && !pendingApproval) return null;
  const pendingIsNative = Boolean(pendingApproval?.intent.action);

  return (
    <div className="max-w-2xl mx-auto mb-3 space-y-2 text-left">
      {pendingApproval && (
        <div
          role="alertdialog"
          aria-label="Action approval required"
          aria-describedby="approval-description"
          className="rounded-xl border border-amber-300/35 bg-amber-300/[0.08] px-4 py-3 shadow-lg shadow-amber-900/10"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-amber-200" aria-hidden="true">!</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-200">Approval required</p>
              <p id="approval-description" className="mt-1 text-sm text-white/90">
                {pendingIsNative ? "Alpha wants permission for this desktop action:" : "Alpha is ready to open an external app or link:"}
              </p>
              <p className="mt-1 text-[11px] text-white/60">Review the details before approving. Alpha will not send a message or submit a form without your confirmation.</p>
              <div className="mt-3 rounded-lg border border-amber-200/15 bg-black/15 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/75">Action</p>
                <p className="mt-1 text-xs text-amber-100/90">{pendingApproval.intent.label}</p>
                {pendingApproval.intent.prefilled ? (
                  <div className="mt-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Draft preview</p>
                    <p className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-white/75">{pendingApproval.intent.prefilled}</p>
                  </div>
                ) : null}
                {pendingApproval.intent.url ? (
                  <p className="mt-2 break-all text-[11px] text-white/50" title={pendingApproval.intent.url}>{pendingApproval.intent.url}</p>
                ) : (
                  <p className="mt-2 text-[11px] text-white/50">No external link will be opened.</p>
                )}
              </div>
              {!pendingIsNative && <p className="mt-2 text-[11px] text-amber-100/75">After approval, Alpha will open the destination. You may still need to press Send or Submit there.</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void onApprove()}
                  className="min-h-11 rounded-full border border-emerald-300/35 bg-emerald-300/15 px-4 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-300/25 touch-manipulation"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={onReject}
                  className="min-h-11 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-white/75 hover:bg-white/10 touch-manipulation"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {actions.length > 0 && (
        <>
          <div className="flex items-center justify-between px-1 text-[10px] uppercase tracking-widest text-white/60">
            <span>Actions</span>
            <label className="flex cursor-pointer items-center gap-1.5 normal-case tracking-normal">
              <input
                type="checkbox"
                checked={autoOpen}
                onChange={(e) => onToggleAutoOpen(e.target.checked)}
                className="accent-cyan-400"
              />
                  <span className="text-white/65">Open approved links automatically</span>
            </label>
          </div>
          {actions.map((a, i) => (
            <div
              key={a.at + "-" + i}
              className="flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.04] px-3 py-2 text-xs"
            >
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-cyan-300/80">
                {a.kind}
              </span>
              <span className="flex-1 truncate text-white/85">{a.label}</span>
              {a.opened ? (
                <span className="shrink-0 text-[10px] text-emerald-300/80">opened ✓</span>
              ) : (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="min-h-10 shrink-0 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[10px] text-cyan-200 hover:bg-cyan-400/20 touch-manipulation"
                >
                  Open
                </a>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
