/**
 * MicPermissionBanner — proactive, actionable UX around the browser mic
 * permission. Shown only when there's something the user should act on:
 *
 *  - "prompt" state → CTA button that fires a one-shot getUserMedia to
 *    surface the native prompt. Stream is released immediately; the point
 *    is just to unblock the permission bit so the next real recording
 *    starts without a modal delay.
 *
 *  - "denied" state → Friendly explanation + Reload button. Most browsers
 *    won't re-prompt without a reload after an explicit deny, so a
 *    "try again" button would be misleading — Reload is the real action.
 *
 * "granted" and "unknown" render nothing. This banner never appears mid-
 * conversation (caller gates on phase === "idle").
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { classifyMicError } from "@/lib/mic-permission";
import type { MicPermissionState } from "@/hooks/useMicPermission";

export function MicPermissionBanner({ state }: { state: MicPermissionState }) {
  const [requesting, setRequesting] = useState(false);

  if (state === "granted" || state === "unknown") return null;

  if (state === "prompt") {
    const requestPermission = async () => {
      setRequesting(true);
      try {
        // Minimal constraints — we only need the prompt to fire and the
        // permission bit to flip. Release the stream immediately so no
        // OS-level mic indicator lingers.
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        // useMicPermission's onchange listener will flip `state` to
        // "granted" automatically; no manual state update needed here.
      } catch (err) {
        const info = classifyMicError(err);
        toast.error(info.title, { description: info.description, duration: 8000 });
      } finally {
        setRequesting(false);
      }
    };

    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-jarvis/30 bg-jarvis/5 px-4 py-3 max-w-[26rem] motion-safe:animate-fade-in"
      >
        <Mic className="w-5 h-5 text-jarvis flex-shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-[12rem] text-left">
          <div className="text-sm font-medium text-foreground">Allow microphone access</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            JARVIS needs to hear you. Your voice never leaves the assistant pipeline.
          </div>
        </div>
        <Button
          size="sm"
          onClick={requestPermission}
          disabled={requesting}
          className="bg-jarvis text-jarvis-foreground hover:bg-jarvis/90"
        >
          {requesting ? "Waiting…" : "Allow mic"}
        </Button>
      </div>
    );
  }

  // Denied
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 max-w-[28rem] motion-safe:animate-fade-in"
    >
      <MicOff className="w-5 h-5 text-destructive flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-[13rem] text-left">
        <div className="text-sm font-medium text-foreground">Microphone blocked</div>
        <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
          Click the lock icon in the address bar → Site settings → set
          Microphone to <span className="text-foreground/90 font-medium">Allow</span>,
          then reload.
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => window.location.reload()}
        className="gap-1.5"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Reload
      </Button>
    </div>
  );
}
