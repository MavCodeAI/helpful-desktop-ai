/**
 * Chat streaming endpoint: POST /api/chat
 *
 * Accepts the full conversation history from the client and streams the
 * assistant's reply back as Server-Sent Events. The client parses those
 * SSE `data:` frames incrementally so the user sees the answer appear
 * word-by-word, and can start speaking it via TTS as soon as it completes.
 *
 * Why we forward the raw upstream stream unchanged: the Lovable AI Gateway
 * already emits OpenAI-compatible SSE. Passing it through avoids buffering
 * the whole reply on the server (higher latency) and keeps the endpoint
 * dead-simple.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { JARVIS_SYSTEM_PROMPT } from "@/lib/jarvis-prompt";
import { gatewayFetch, readGatewayKey } from "@/lib/server/gateway-client";

/**
 * Wire schema for the chat body.
 *
 * - The `system` role is intentionally excluded — we prepend our own system
 *   prompt server-side and never let a client override it.
 * - `content` is capped at 8 KB per message and the whole conversation at
 *   100 turns to cap upstream cost and keep responses bounded.
 */
const chatBodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1, "Empty message").max(8000, "Message too long"),
      }),
    )
    .min(1, "At least one message is required")
    .max(100, "Conversation too long — start a new one"),
});

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      /**
       * POST handler.
       *
       * Request body: `{ messages: ChatMessage[] }`
       * Response: `text/event-stream` (SSE) with OpenAI chat-completion deltas,
       *   or a plain-text error body with the upstream status on failure.
       */
      POST: async ({ request }) => {
        // 1. Parse the JSON body defensively — a malformed body is a 400,
        //    not a 500. `request.json()` throws on bad JSON.
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return new Response("Invalid JSON body", { status: 400 });
        }

        // 2. Validate shape / length / roles with zod. The first issue's
        //    message is returned so the client can surface something
        //    specific ("Message too long", "Conversation too long", …).
        const parsed = chatBodySchema.safeParse(raw);
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          return new Response(issue?.message || "Invalid request body", { status: 400 });
        }
        const { messages } = parsed.data;

        // 3. Secret must stay server-side. Read at request time (Cloudflare
        //    Workers inject env per-request; module scope may be undefined).
        if (!readGatewayKey()) return new Response("AI service is not configured", { status: 500 });

        // 4. Call the upstream gateway. Network failure here is separate
        //    from a non-2xx response and needs its own catch.
        let upstream: Response;
        try {
          upstream = await gatewayFetch("/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              stream: true,
              messages: [{ role: "system", content: JARVIS_SYSTEM_PROMPT }, ...messages],
            }),
          });
        } catch (e) {
          console.error("[/api/chat] upstream fetch failed", e);
          return new Response("Cannot reach AI service — please retry.", { status: 502 });
        }

        // 5. Surface upstream failures verbatim so the UI can show a real
        //    reason (client's `friendlyError` maps 429/402/401 to copy).
        if (!upstream.ok) {
          const text = await upstream.text().catch(() => "");
          return new Response(text || "Upstream error", { status: upstream.status });
        }

        // 6. Pass the SSE body straight through — do NOT wrap in a
        //    TransformStream, that would force the runtime to buffer and
        //    defeat progressive rendering.
        return new Response(upstream.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
