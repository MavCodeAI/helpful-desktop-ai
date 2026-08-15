import { createServerFn } from "@tanstack/react-start";

export type GeminiLiveTokenResult =
  | { configured: true; token: string; expiresAt: string }
  | { configured: false; status: "missing" | "invalid" | "provider_error"; error: string };

/**
 * Issues a short-lived, single-use Gemini Live token. The long-lived API key
 * never leaves the server. See https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens
 */
export const getGeminiLiveToken = createServerFn({ method: "GET" }).handler(async (): Promise<GeminiLiveTokenResult> => {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) {
    return {
      configured: false,
      status: "missing",
      error: "GEMINI_API_KEY is not configured on the server.",
    };
  }
  if (apiKey.length < 20) {
    return {
      configured: false,
      status: "invalid",
      error: "GEMINI_API_KEY appears invalid.",
    };
  }

  const now = Date.now();
  const expiresAt = new Date(now + 30 * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(now + 60 * 1000).toISOString();

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        uses: 1,
        expireTime: expiresAt,
        newSessionExpireTime,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const providerText = await response.text().catch(() => "");
      const detail = providerText.toLowerCase().includes("api key")
        ? "Google rejected the configured API key."
        : `Gemini token service returned HTTP ${response.status}.`;
      return { configured: false, status: "provider_error", error: detail };
    }

    const payload = await response.json() as { name?: unknown };
    if (typeof payload.name !== "string" || !payload.name) {
      return {
        configured: false,
        status: "provider_error",
        error: "Gemini token service returned no usable token.",
      };
    }

    return { configured: true, token: payload.name, expiresAt };
  } catch {
    return {
      configured: false,
      status: "provider_error",
      error: "Could not reach the Gemini token service.",
    };
  }
});
