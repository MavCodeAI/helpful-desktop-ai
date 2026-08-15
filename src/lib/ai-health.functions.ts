import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
export const getAiHealth = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ userKey: z.string().trim().max(200).optional() }).parse(input ?? {}))
  .handler(async ({ data }): Promise<AiHealth> => {
  const geminiConfigured = configured(data.userKey) || configured(process.env.GEMINI_API_KEY);
  const sttConfigured = configured(process.env.DEEPGRAM_API_KEY);
  const recommendations: string[] = [];

  if (!geminiConfigured) {
    recommendations.push("Set GEMINI_API_KEY for Gemini chat, actions, summaries, vision and realtime voice.");
  }
  if (!sttConfigured) {
    recommendations.push("Set DEEPGRAM_API_KEY for browser microphone transcription.");
  }

  return {
    ok: geminiConfigured && sttConfigured,
    generatedAt: new Date().toISOString(),
    providers: {
      llm: {
        configured: geminiConfigured,
        purpose: "Gemini multilingual chat, intent extraction, summaries, vision and safe action plans",
        env: "GEMINI_API_KEY",
        message: geminiConfigured ? "Configured: Google Gemini 2.5 Flash through the server-side Gemini API." : "Missing GEMINI_API_KEY in the server environment.",
      },
      stt: {
        configured: sttConfigured,
        purpose: "Multilingual speech-to-text with Deepgram Nova-3",
        env: "DEEPGRAM_API_KEY",
        message: sttConfigured ? "Configured: short-lived browser tokens can be minted." : "Missing server configuration.",
      },
      realtime: {
        configured: geminiConfigured,
        purpose: "Low-latency Gemini Live realtime audio provider",
        env: "GEMINI_API_KEY",
        message: geminiConfigured ? "Configured: Gemini Live short-lived session tokens are issued server-side." : "Missing GEMINI_API_KEY; Gemini Live is unavailable until it is added to Vercel.",
      },
    },
    recommendations,
  };
  });
