import { describe, it, expect } from "vitest";
import type { VoiceState } from "./phase-machine";
import {
  INITIAL_VOICE_STATE,
  voiceReducer,
  PHASE_HUE,
  PHASE_CAPTION,
} from "./phase-machine";

describe("voiceReducer", () => {
  it("starts in idle with no error", () => {
    expect(INITIAL_VOICE_STATE.phase).toBe("idle");
    expect(INITIAL_VOICE_STATE.error).toBeNull();
  });

  it("full happy-path cycle", () => {
    let s = INITIAL_VOICE_STATE;
    s = voiceReducer(s, { type: "START_LISTENING" });
    expect(s.phase).toBe("listening");
    s = voiceReducer(s, { type: "STOP_LISTENING" });
    expect(s.phase).toBe("thinking");
    s = voiceReducer(s, { type: "THINKING_DONE" });
    expect(s.phase).toBe("speaking");
    s = voiceReducer(s, { type: "PLAYBACK_DONE" });
    expect(s.phase).toBe("idle");
  });

  it("pause/resume recording keeps phase = listening", () => {
    let s = voiceReducer(INITIAL_VOICE_STATE, { type: "START_LISTENING" });
    s = voiceReducer(s, { type: "PAUSE_RECORDING" });
    expect(s.phase).toBe("listening");
    expect(s.recPaused).toBe(true);
    s = voiceReducer(s, { type: "RESUME_RECORDING" });
    expect(s.recPaused).toBe(false);
  });

  it("pause/resume playback keeps phase = speaking", () => {
    let s: VoiceState = { ...INITIAL_VOICE_STATE, phase: "speaking" };
    s = voiceReducer(s, { type: "PAUSE_PLAYBACK" });
    expect(s.playPaused).toBe(true);
    s = voiceReducer(s, { type: "RESUME_PLAYBACK" });
    expect(s.playPaused).toBe(false);
  });

  it("invalid transitions are no-ops", () => {
    // Can't stop what you haven't started.
    const s = voiceReducer(INITIAL_VOICE_STATE, { type: "STOP_LISTENING" });
    expect(s).toBe(INITIAL_VOICE_STATE);
    // Can't skip thinking.
    const s2 = voiceReducer(INITIAL_VOICE_STATE, { type: "THINKING_DONE" });
    expect(s2).toBe(INITIAL_VOICE_STATE);
  });

  it("CANCEL from any phase returns to idle", () => {
    const speaking: VoiceState = { ...INITIAL_VOICE_STATE, phase: "speaking", playPaused: true };
    expect(voiceReducer(speaking, { type: "CANCEL" })).toEqual(INITIAL_VOICE_STATE);
  });

  it("ERROR resets to idle with message", () => {
    const s = voiceReducer(
      { ...INITIAL_VOICE_STATE, phase: "thinking" },
      { type: "ERROR", message: "boom" },
    );
    expect(s.phase).toBe("idle");
    expect(s.error).toBe("boom");
  });

  it("SET_PHASE escape hatch jumps to any phase and clears error", () => {
    const errored: VoiceState = { ...INITIAL_VOICE_STATE, error: "prev" };
    const s = voiceReducer(errored, { type: "SET_PHASE", phase: "listening" });
    expect(s.phase).toBe("listening");
    expect(s.error).toBeNull();
  });

  it("SET_PHASE to same phase is a no-op (referential stability)", () => {
    const s = voiceReducer(INITIAL_VOICE_STATE, { type: "SET_PHASE", phase: "idle" });
    expect(s).toBe(INITIAL_VOICE_STATE);
  });

  it("has hue + caption for every phase", () => {
    for (const p of ["idle", "listening", "thinking", "speaking"] as const) {
      expect(PHASE_HUE[p]).toBeGreaterThan(0);
      expect(PHASE_CAPTION[p]).toBeTruthy();
    }
  });
});
