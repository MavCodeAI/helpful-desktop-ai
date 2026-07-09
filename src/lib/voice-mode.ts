/**
 * Voice mode selection — persisted per browser.
 *
 * Three modes trade off latency vs. cost vs. reliability:
 *  - "ptt"      : Push-to-talk. Sequential STT→LLM→TTS via Lovable AI.
 *  - "vad"      : Hands-free. Same pipeline, but auto-start/stop by silence.
 *  - "realtime" : True streaming voice-to-voice via OpenAI Realtime API.
 *                 Requires OPENAI_API_KEY secret to be configured.
 */

export type VoiceMode = "ptt" | "vad" | "realtime";

const KEY = "jarvis.voice.mode.v1";

export function loadVoiceMode(): VoiceMode {
  // Auto-VAD is the only supported mode right now.
  return "vad";
}

export function saveVoiceMode(mode: VoiceMode): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* non-fatal */
  }
}

export const VOICE_MODE_META: Record<
  VoiceMode,
  { label: string; short: string; desc: string }
> = {
  ptt: {
    label: "Push",
    short: "Push",
    desc: "Hold Space or tap the orb to talk. Reliable, low cost.",
  },
  vad: {
    label: "Auto",
    short: "Auto",
    desc: "Hands-free. I listen and reply when you stop talking.",
  },
  realtime: {
    label: "Live",
    short: "Live",
    desc: "Realtime streaming voice via OpenAI. Fastest, higher cost.",
  },
};
