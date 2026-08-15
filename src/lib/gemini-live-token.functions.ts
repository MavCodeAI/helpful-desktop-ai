import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { GEMINI_LIVE_MODEL_PATH } from "./gemini-live-config";

export type GeminiLiveTokenResult =
  | { configured: true; token: string; expiresAt: string }
  | { configured: false; status: "missing" | "invalid" | "provider_error"; error: string };

export type GeminiLiveConnectionTestResult =
  | { ok: true; model: string; latencyMs: number }
  | { ok: false; model: string; latencyMs: number; error: string; closeCode?: number };

type MintedToken =
  | { ok: true; token: string; expiresAt: string }
  | { ok: false; status: "missing" | "invalid" | "provider_error"; error: string };

function resolveApiKey(userKey?: string) {
  return (userKey || process.env.GEMINI_API_KEY || "").trim();
}

async function mintGeminiLiveToken(apiKey: string): Promise<MintedToken> {
  if (!apiKey) {
    return { ok: false, status: "missing", error: "GEMINI_API_KEY is not configured on the server." };
  }
  if (apiKey.length < 20) {
    return { ok: false, status: "invalid", error: "GEMINI_API_KEY appears invalid." };
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
        liveConnectConstraints: {
          model: GEMINI_LIVE_MODEL_PATH,
          config: {
            responseModalities: ["AUDIO"],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const providerText = await response.text().catch(() => "");
      const detail = providerText.toLowerCase().includes("api key")
        ? "Google rejected the configured API key."
        : `Gemini token service returned HTTP ${response.status}.`;
      return { ok: false, status: "provider_error", error: detail };
    }

    const payload = await response.json() as { name?: unknown };
    if (typeof payload.name !== "string" || !payload.name) {
      return { ok: false, status: "provider_error", error: "Gemini token service returned no usable token." };
    }

    return { ok: true, token: payload.name, expiresAt };
  } catch {
    return { ok: false, status: "provider_error", error: "Could not reach the Gemini token service." };
  }
}

function liveSetupMessage() {
  return {
    setup: {
      model: GEMINI_LIVE_MODEL_PATH,
      generationConfig: {
        responseModalities: ["AUDIO"],
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
  };
}

async function probeLiveWebSocket(token: string): Promise<{ ok: true; latencyMs: number } | { ok: false; latencyMs: number; error: string; closeCode?: number }> {
  const startedAt = performance.now();
  const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token)}`;

  return await new Promise((resolve) => {
    let settled = false;
    const finish = (result: { ok: true; latencyMs: number } | { ok: false; latencyMs: number; error: string; closeCode?: number }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };
    const timeout = setTimeout(() => {
      try { ws.close(); } catch {}
      finish({ ok: false, latencyMs: Math.round(performance.now() - startedAt), error: "Gemini Live handshake timed out." });
    }, 10_000);
    const ws = new WebSocket(url);

    ws.addEventListener("open", () => {
      try {
        ws.send(JSON.stringify(liveSetupMessage()));
      } catch {
        finish({ ok: false, latencyMs: Math.round(performance.now() - startedAt), error: "Could not send the Gemini Live setup message." });
      }
    });
    ws.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(typeof event.data === "string" ? event.data : String(event.data)) as {
          setupComplete?: unknown;
          error?: { message?: string; code?: number; status?: string };
        };
        if (payload.setupComplete !== undefined) {
          try { ws.close(); } catch {}
          finish({ ok: true, latencyMs: Math.round(performance.now() - startedAt) });
        } else if (payload.error) {
          try { ws.close(); } catch {}
          finish({
            ok: false,
            latencyMs: Math.round(performance.now() - startedAt),
            error: payload.error.message || payload.error.status || "Gemini rejected the Live setup message.",
            closeCode: payload.error.code,
          });
        }
      } catch {
        finish({ ok: false, latencyMs: Math.round(performance.now() - startedAt), error: "Gemini returned an invalid Live setup response." });
      }
    });
    ws.addEventListener("error", () => {
      finish({ ok: false, latencyMs: Math.round(performance.now() - startedAt), error: "Gemini Live WebSocket could not be opened." });
    });
    ws.addEventListener("close", (event) => {
      if (!settled) {
        finish({
          ok: false,
          latencyMs: Math.round(performance.now() - startedAt),
          error: event.reason || `Gemini closed the Live handshake (${event.code || "unknown"}).`,
          closeCode: event.code,
        });
      }
    });
  });
}

/** Issues a short-lived, single-use Gemini Live token. The long-lived API key never leaves the server. */
export const getGeminiLiveToken = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ userKey: z.string().trim().max(200).optional() }).parse(input ?? {}))
  .handler(async ({ data }): Promise<GeminiLiveTokenResult> => {
    const result = await mintGeminiLiveToken(resolveApiKey(data.userKey));
    return result.ok
      ? { configured: true, token: result.token, expiresAt: result.expiresAt }
      : { configured: false, status: result.status, error: result.error };
  });

/** Mints a one-use token and verifies the real Gemini Live setup handshake server-side. */
export const testGeminiLiveConnection = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ userKey: z.string().trim().max(200).optional() }).parse(input ?? {}))
  .handler(async ({ data }): Promise<GeminiLiveConnectionTestResult> => {
    const minted = await mintGeminiLiveToken(resolveApiKey(data.userKey));
    if (!minted.ok) {
      return { ok: false, model: GEMINI_LIVE_MODEL_PATH, latencyMs: 0, error: minted.error };
    }
    const result = await probeLiveWebSocket(minted.token);
    return { ...result, model: GEMINI_LIVE_MODEL_PATH };
  });
