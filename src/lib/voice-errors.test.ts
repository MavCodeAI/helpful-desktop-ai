import { describe, expect, it } from "vitest";
import { classifyVoiceError } from "./voice-errors";

describe("classifyVoiceError", () => {
  it("explains that HF 401 is an OAuth/session problem", () => {
    const result = classifyVoiceError("HF session failed: 401 Unauthorized. login_required", "hf");
    expect(result.code).toBe("hf_auth");
    expect(result.title).toContain("Hugging Face");
    expect(result.action).toContain("Gemini");
    expect(result.canRetry).toBe(false);
  });

  it("explains how to configure Gemini without exposing a key", () => {
    const result = classifyVoiceError("GEMINI_API_KEY is not configured on the server.", "gemini");
    expect(result.code).toBe("gemini_config");
    expect(result.action).toContain("Vercel");
  });

  it("preserves cooldown metadata for provider quota errors", () => {
    const result = classifyVoiceError("HF free anon quota exhausted.", "hf", { retryAfterSec: 42 });
    expect(result.code).toBe("hf_quota");
    expect(result.retryAfterSec).toBe(42);
  });

  it("turns microphone permission failures into a device action", () => {
    const result = classifyVoiceError("Microphone blocked. Enable it in your browser settings.", "gemini");
    expect(result.code).toBe("microphone");
    expect(result.action).toContain("microphone");
  });
});
