import { AlertTriangle, ChevronDown, Copy, RefreshCw, Settings2 } from "lucide-react";
import type { VoiceErrorInfo } from "@/lib/voice-errors";

type Props = {
  error: VoiceErrorInfo;
  cooldown: number;
  onRetry: () => void;
  onOpenSettings: () => void;
};

export function VoiceErrorCard({ error, cooldown, onRetry, onOpenSettings }: Props) {
  const copyTechnical = () => {
    void navigator.clipboard?.writeText(error.technical || error.message);
  };

  return (
    <div className="mt-4 w-full max-w-xl mx-auto text-left rounded-2xl border border-red-300/25 bg-red-950/30 backdrop-blur-xl shadow-[0_14px_50px_rgba(0,0,0,0.28)] overflow-hidden" role="alert" aria-live="assertive">
      <div className="flex items-start gap-3 px-4 py-3 border-b border-red-200/10">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-400/15 text-red-200">
          <AlertTriangle className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-sm font-semibold text-red-100">{error.title}</h3>
            <span className="rounded-full border border-red-200/15 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-red-200/60">{error.code.replace("_", " ")}</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-red-100/75">{error.message}</p>
        </div>
      </div>
      <div className="px-4 py-3 space-y-3">
        <div className="rounded-lg border border-amber-200/15 bg-amber-200/5 px-3 py-2 text-xs leading-relaxed text-amber-100/80">
          <span className="font-semibold text-amber-100">What to do: </span>{error.action}
        </div>
        <div className="flex flex-wrap gap-2">
          {error.canRetry && cooldown === 0 && (
            <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-300/15 px-3 py-2 text-xs font-medium text-cyan-100 border border-cyan-200/20 hover:bg-cyan-300/25">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Try again
            </button>
          )}
          {error.canRetry && cooldown > 0 && (
            <span className="inline-flex items-center rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60">Retry available in {cooldown}s</span>
          )}
          <button type="button" onClick={onOpenSettings} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10">
            <Settings2 className="h-3.5 w-3.5" aria-hidden /> Open settings
          </button>
        </div>
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-[10px] text-white/45 hover:text-white/70">
            <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" aria-hidden /> Technical details
          </summary>
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
            <code className="min-w-0 flex-1 break-words text-[10px] leading-relaxed text-white/55">{error.technical}</code>
            <button type="button" onClick={copyTechnical} className="shrink-0 rounded p-1 text-white/45 hover:bg-white/10 hover:text-white/80" aria-label="Copy technical details" title="Copy technical details">
              <Copy className="h-3 w-3" aria-hidden />
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
