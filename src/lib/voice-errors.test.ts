// @ts-nocheck
import { classifyVoiceError } from "./voice-errors";

describe("classifyVoiceError", () => {
  it("explains how to configure Gemini without exposing a key", () => {
    const result = classifyVoiceError("GEMINI_API_KEY is not configured on the server.", "gemini");
    expect(result.code).toBe("gemini_config");
    expect(result.action).toContain("Vercel");
  });

  it("explains Gemini 1007 as a Live setup/protocol rejection", () => {
    const result = classifyVoiceError("Gemini Live setup rejected (1007: invalid frame payload).", "gemini");
    expect(result.code).toBe("gemini_protocol");
    expect(result.message).toContain("setup payload");
    expect(result.action).toContain("Apply & Test");
  });

  it("turns Gemini service failures into a retryable network action", () => {
    const result = classifyVoiceError("Gemini connection timed out.", "gemini", { retryAfterSec: 42 });
    expect(result.code).toBe("network");
    expect(result.canRetry).toBe(true);
    expect(result.retryAfterSec).toBe(42);
    expect(result.action).toContain("Gemini Live");
  });

  it("turns microphone permission failures into a device action", () => {
    const result = classifyVoiceError("Microphone blocked. Enable it in your browser settings.", "gemini");
    expect(result.code).toBe("microphone");
    expect(result.action).toContain("microphone");
  });
});
