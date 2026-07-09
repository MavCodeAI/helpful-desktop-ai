/**
 * Ephemeral token minting for OpenAI Realtime API.
 *
 * The browser never touches the raw OPENAI_API_KEY. We call OpenAI's
 * `/v1/realtime/sessions` endpoint server-side, which returns a short-lived
 * (~1 minute) `client_secret` the browser uses to establish the WebRTC peer
 * connection directly to OpenAI. See:
 * https://platform.openai.com/docs/guides/realtime
 */
import { createFileRoute } from "@tanstack/react-router";
import { JARVIS_SYSTEM_PROMPT } from "@/lib/jarvis-prompt";

const REALTIME_MODEL = "gpt-4o-realtime-preview";

export const Route = createFileRoute("/api/realtime-token")({
  server: {
    handlers: {
      POST: async () => {
        const key = process.env.OPENAI_API_KEY;
        if (!key) {
          return new Response(
            "Realtime mode needs your OpenAI API key — add OPENAI_API_KEY in project settings.",
            { status: 501 },
          );
        }

        let upstream: Response;
        try {
          upstream = await fetch("https://api.openai.com/v1/realtime/sessions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: REALTIME_MODEL,
              voice: "verse",
              // Server VAD lets OpenAI detect turn boundaries automatically.
              turn_detection: { type: "server_vad" },
              instructions: JARVIS_SYSTEM_PROMPT,
              modalities: ["audio", "text"],
            }),
          });
        } catch (e) {
          console.error("[/api/realtime-token] upstream fetch failed", e);
          return new Response("Cannot reach OpenAI — please retry.", { status: 502 });
        }

        const body = await upstream.text().catch(() => "");
        if (!upstream.ok) {
          console.error("[/api/realtime-token] OpenAI error", upstream.status, body);
          return new Response(body || "OpenAI session creation failed", {
            status: upstream.status,
          });
        }

        return new Response(body, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
