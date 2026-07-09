/**
 * Voice-mode segmented control — 3-way toggle for the JARVIS header.
 *
 * Purely presentational: parent owns state, we render buttons and call
 * `onChange` on click. Realtime mode shows a tiny "beta" hint because it
 * depends on an OpenAI key the user must supply on first use.
 */
import type { VoiceMode } from "@/lib/voice-mode";
import { VOICE_MODE_META } from "@/lib/voice-mode";
import { Radio, Hand, Waves } from "lucide-react";

const ICONS: Record<VoiceMode, React.ComponentType<{ className?: string }>> = {
  ptt: Hand,
  vad: Waves,
  realtime: Radio,
};

const ORDER: VoiceMode[] = ["ptt", "vad", "realtime"];

export function VoiceModeToggle({
  mode,
  onChange,
  disabled = false,
}: {
  mode: VoiceMode;
  onChange: (m: VoiceMode) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Voice interaction mode"
      className="hidden md:inline-flex items-center rounded-full glass-pill p-0.5 gap-0.5"
    >
      {ORDER.map((m) => {
        const meta = VOICE_MODE_META[m];
        const Icon = ICONS[m];
        const selected = mode === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${meta.label} mode — ${meta.desc}`}
            title={meta.desc}
            disabled={disabled}
            onClick={() => onChange(m)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 min-h-9 text-[11px] uppercase tracking-[0.18em] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jarvis disabled:opacity-40 disabled:cursor-not-allowed ${
              selected
                ? "bg-jarvis/20 text-jarvis shadow-[0_0_16px_-6px_var(--jarvis-glow)]"
                : "text-foreground/60 hover:text-foreground hover:bg-white/[0.06]"
            }`}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{meta.short}</span>
          </button>
        );
      })}
    </div>
  );
}
