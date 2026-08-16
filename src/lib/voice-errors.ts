import type { ProviderId } from "@/lib/voice-providers";

export type VoiceErrorCode =
  | "gemini_config"
  | "gemini_auth"
  | "gemini_protocol"
  | "microphone"
  | "network"
  | "unknown";

export type VoiceErrorInfo = {
  code: VoiceErrorCode;
  title: string;
  message: string;
  action: string;
  provider: ProviderId;
  canRetry: boolean;
  retryAfterSec?: number;
  technical?: string;
};

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function classifyVoiceError(
  raw: string,
  provider: ProviderId,
  meta?: { retryAfterSec?: number },
): VoiceErrorInfo {
  const technical = textOf(raw).trim() || "Voice session could not be started.";
  const lower = technical.toLowerCase();

  if (provider === "gemini" && /missing|not configured|invalid_format|invalid.*key|AIza/.test(lower)) {
    return {
      code: "gemini_config",
      title: "Gemini voice is not configured",
      message: "Alpha cannot issue a secure Gemini Live session because GEMINI_API_KEY is missing or invalid on Vercel.",
      action: "Add GEMINI_API_KEY in Vercel Project Settings → Environment Variables, redeploy, then retry.",
      provider,
      canRetry: true,
      technical,
    };
  }

  if (provider === "gemini" && /1007|invalid frame|invalid payload|setup.*(invalid|failed)|payload.*(invalid|data)/.test(lower)) {
    return {
      code: "gemini_protocol",
      title: "Gemini Live setup was rejected",
      message: "Google received the connection but rejected the Live API setup payload or model configuration.",
      action: "Retry after the app update. If it continues, confirm the selected Gemini key has access to the configured Live model and run Apply & Test again.",
      provider,
      canRetry: true,
      technical,
    };
  }

  if (provider === "gemini" && /401|403|1008|4001|4003|auth|rejected.*api key|configured api key/.test(lower)) {
    return {
      code: "gemini_auth",
      title: "Gemini authentication failed",
      message: "Google rejected the Gemini Live session token or the API key does not have Live API access.",
      action: "Create a fresh Google AI Studio key, add it to Vercel as GEMINI_API_KEY, redeploy, and retry.",
      provider,
      canRetry: true,
      technical,
    };
  }

  if (/microphone|mic|notallowed|permission|access microphone/.test(lower)) {
    return {
      code: "microphone",
      title: "Microphone access is needed",
      message: "Alpha could not access the device microphone.",
      action: "Allow microphone access for this site/app in Android settings or browser site settings, then try again.",
      provider,
      canRetry: true,
      technical,
    };
  }

  if (/network|internet|timed out|timeout|connection|websocket/.test(lower)) {
    return {
      code: "network",
      title: "Voice connection failed",
      message: "Alpha could not reach the voice service.",
      action: "Check your internet connection and try Gemini Live again.",
      provider,
      canRetry: true,
      retryAfterSec: meta?.retryAfterSec,
      technical,
    };
  }

  return {
    code: "unknown",
    title: "Voice session could not start",
    message: "Something prevented Alpha from starting voice mode.",
    action:
      "Try Gemini Live again. If it continues, open Settings, run Apply & Test for Gemini, and review the technical details.",
    provider,
    canRetry: true,
    technical,
  };
}
