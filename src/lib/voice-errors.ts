import type { ProviderId } from "@/lib/voice-providers";

export type VoiceErrorCode =
  | "hf_auth"
  | "hf_quota"
  | "hf_unavailable"
  | "gemini_config"
  | "gemini_auth"
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

  if (provider === "hf" && /401|unauthorized|login required|requirelogin|auth/.test(lower)) {
    return {
      code: "hf_auth",
      title: "Hugging Face voice is not connected",
      message: "The selected Hugging Face voice service requires a Hugging Face login session. It returned 401 Unauthorized, so Alpha could not create a voice session.",
      action: "Open Settings and switch to Gemini, or connect Hugging Face through a server-side authenticated proxy. Do not paste a token into the browser.",
      provider,
      canRetry: false,
      technical,
    };
  }

  if (provider === "hf" && /402|quota|limit|remainingsec|exhausted/.test(lower)) {
    return {
      code: "hf_quota",
      title: "Hugging Face voice limit reached",
      message: "The anonymous Hugging Face voice allowance is temporarily exhausted.",
      action: "Wait until the retry timer ends, or switch to Gemini for a more reliable pilot setup.",
      provider,
      canRetry: true,
      retryAfterSec: meta?.retryAfterSec,
      technical,
    };
  }

  if (provider === "hf" && /5\d\d|unavailable|did not accept|websocket/.test(lower)) {
    return {
      code: "hf_unavailable",
      title: "Hugging Face voice is temporarily unavailable",
      message: "The voice service did not accept the connection or is currently unavailable.",
      action: "Check your internet connection, retry once, or switch to Gemini in Settings.",
      provider,
      canRetry: true,
      technical,
    };
  }

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
      action: "Check your internet connection and try again. If the issue continues, switch voice provider in Settings.",
      provider,
      canRetry: true,
      technical,
    };
  }

  return {
    code: "unknown",
    title: "Voice session could not start",
    message: "Something prevented Alpha from starting voice mode.",
    action: "Try again. If it continues, open Settings, check the provider status, and send the technical details to support.",
    provider,
    canRetry: true,
    technical,
  };
}
