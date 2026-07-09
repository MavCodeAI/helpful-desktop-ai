/**
 * Voice pipeline phase machine — pure, no React, no side effects.
 *
 * States:
 *   idle → listening → thinking → speaking → idle
 *
 * Sub-states (paused) are tracked as boolean flags orthogonal to `phase`
 * so a recording that's mid-utterance-paused stays in `listening`, and a
 * TTS that's mid-playback-paused stays in `speaking`. This matches how
 * MediaRecorder and Audio elements actually behave.
 *
 * Transitions returned as `null` mean "no-op" — the reducer keeps the
 * previous state. That makes it safe to fire events speculatively.
 *
 * Tested in phase-machine.test.ts — do not add side effects here.
 */

export type Phase = "idle" | "listening" | "thinking" | "speaking";

export const THINKING_STAGES = ["Reading", "Analyzing", "Composing", "Refining"] as const;

/** Preview-parity color language: each phase has a hue that drives the orb,
 *  rings, glow, side buttons, caption tint, and message role labels. */
export const PHASE_HUE: Record<Phase, number> = {
  idle: 200,       // cyan  — resting
  listening: 195,  // bright cyan — user speaking
  thinking: 48,    // amber — connecting / composing
  speaking: 210,   // deeper cyan — assistant replying
};

export const PHASE_CAPTION: Record<Phase, string> = {
  idle: "TAP TO START",
  listening: "LISTENING",
  thinking: "THINKING",
  speaking: "SPEAKING",
};

export type VoiceState = {
  phase: Phase;
  recPaused: boolean;
  playPaused: boolean;
  error: string | null;
};

export const INITIAL_VOICE_STATE: VoiceState = {
  phase: "idle",
  recPaused: false,
  playPaused: false,
  error: null,
};

export type VoiceEvent =
  /**
   * Escape hatch — set phase directly. Used by the current JarvisPage
   * during migration so we can adopt the reducer surface without also
   * rewriting every transition site. Prefer the semantic events below
   * for new code so invalid transitions become no-ops instead of silent
   * jumps between unrelated states.
   */
  | { type: "SET_PHASE"; phase: Phase }
  | { type: "START_LISTENING" }
  | { type: "PAUSE_RECORDING" }
  | { type: "RESUME_RECORDING" }
  | { type: "STOP_LISTENING" }         // listening → thinking
  | { type: "CANCEL" }                  // any → idle
  | { type: "THINKING_DONE" }           // thinking → speaking
  | { type: "PAUSE_PLAYBACK" }
  | { type: "RESUME_PLAYBACK" }
  | { type: "PLAYBACK_DONE" }           // speaking → idle
  /**
   * Multi-entry semantic events. Unlike STOP_LISTENING / THINKING_DONE
   * they don't require a source phase — they model "the app just decided
   * to start X" from any state (text input, prompt chip, restart button,
   * or the voice pipeline). Always clear pause flags + error.
   */
  | { type: "START_THINKING" }          // any → thinking
  | { type: "START_SPEAKING" }          // any → speaking
  /**
   * Realtime bridge — the WebRTC pipeline has its own connection state
   * machine that lives in `RealtimeClient`, but the orb/caption still
   * mirror the app-level phase. `REALTIME_LIVE` skips the strict
   * `START_LISTENING` guard (which requires idle) because the transition
   * is thinking → listening on connect. It's a distinct semantic ("we're
   * live on the wire") not just "user tapped mic".
   */
  | { type: "REALTIME_LIVE" }           // any → listening
  | { type: "ERROR"; message: string }; // any → idle + error

export function voiceReducer(state: VoiceState, event: VoiceEvent): VoiceState {
  switch (event.type) {
    case "SET_PHASE":
      if (state.phase === event.phase) return state;
      return { ...state, phase: event.phase, error: null };
    case "START_LISTENING":
      if (state.phase !== "idle") return state;
      return { phase: "listening", recPaused: false, playPaused: false, error: null };
    case "PAUSE_RECORDING":
      if (state.phase !== "listening" || state.recPaused) return state;
      return { ...state, recPaused: true };
    case "RESUME_RECORDING":
      if (state.phase !== "listening" || !state.recPaused) return state;
      return { ...state, recPaused: false };
    case "STOP_LISTENING":
      if (state.phase !== "listening") return state;
      return { phase: "thinking", recPaused: false, playPaused: false, error: null };
    case "CANCEL":
      return INITIAL_VOICE_STATE;
    case "THINKING_DONE":
      if (state.phase !== "thinking") return state;
      return { phase: "speaking", recPaused: false, playPaused: false, error: null };
    case "PAUSE_PLAYBACK":
      if (state.phase !== "speaking" || state.playPaused) return state;
      return { ...state, playPaused: true };
    case "RESUME_PLAYBACK":
      if (state.phase !== "speaking" || !state.playPaused) return state;
      return { ...state, playPaused: false };
    case "PLAYBACK_DONE":
      if (state.phase !== "speaking") return state;
      return INITIAL_VOICE_STATE;
    case "START_THINKING":
      if (state.phase === "thinking") return state;
      return { phase: "thinking", recPaused: false, playPaused: false, error: null };
    case "START_SPEAKING":
      if (state.phase === "speaking") return state;
      return { phase: "speaking", recPaused: false, playPaused: false, error: null };
    case "REALTIME_LIVE":
      if (state.phase === "listening") return state;
      return { phase: "listening", recPaused: false, playPaused: false, error: null };
    case "ERROR":
      return { ...INITIAL_VOICE_STATE, error: event.message };
    default:
      return state;
  }
}
