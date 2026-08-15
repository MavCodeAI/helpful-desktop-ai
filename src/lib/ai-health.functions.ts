import { createServerFn } from "@tanstack/react-start";

export type ProviderHealth = {
  configured: boolean;
  purpose: string;
  env: string;
  message: string;
};

export type AiHealth = {
  ok: boolean;
  generatedAt: string;
  providers: {
    llm: ProviderHealth;
    stt: ProviderHealth;
    realtime: ProviderHealth;
  };
  recommendations: string[];
};

const configured = (value: string | undefined) => Boolean(value?.trim());

/**
 * Server-only configuration health. It intentionally returns no key material.
 * The client can use this to explain setup problems without exposing secrets.
 */
export const getAiHealth = createServerFn({ method: "GET" }).handler(async (): Promise<AiHealth> => {
  const llmConfigured = configured(process.env.LOVABLE_API_KEY);
  const sttConfigured = configured(process.env.DEEPGRAM_API_KEY);
  const realtimeConfigured = configured(process.env.GEMINI_API_KEY);
  const recommendations: string[] = [];

  if (!llmConfigured) {
    recommendations.push("Set LOVABLE_API_KEY for multilingual text replies and AI actions.");
  }
  if (!sttConfigured) {
    recommendations.push("Set DEEPGRAM_API_KEY for browser microphone transcription.");
  }
  if (!realtimeConfigured) {
    recommendations.push("Set GEMINI_API_KEY only if Gemini Live realtime audio is enabled.");
  }

  return {
    ok: llmConfigured && sttConfigured,
    generatedAt: new Date().toISOString(),
    providers: {
      llm: {
        configured: llmConfigured,
        purpose: "Multilingual chat, intent extraction, summaries and safe action plans",
        env: "LOVABLE_API_KEY",
        message: llmConfigured ? "Configured: Google Gemini 2.5 Flash through the Lovable gateway." : "Missing server configuration.",
      },
      stt: {
        configured: sttConfigured,
        purpose: "Multilingual speech-to-text with Deepgram Nova-3",
        env: "DEEPGRAM_API_KEY",
        message: sttConfigured ? "Configured: short-lived browser tokens can be minted." : "Missing server configuration.",
      },
      realtime: {
        configured: realtimeConfigured,
        purpose: "Optional low-latency realtime audio provider",
        env: "GEMINI_API_KEY",
        message: realtimeConfigured ? "Configured: Gemini Live can be enabled after server-side proxy hardening." : "Optional and currently disabled.",
      },
    },
    recommendations,
  };
});
