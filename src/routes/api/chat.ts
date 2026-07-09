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
import { JARVIS_SYSTEM_PROMPT } from "@/lib/jarvis-prompt";

/** One message in the conversation, matching OpenAI's chat schema. */
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Shape of the JSON body the client POSTs to this endpoint. */
interface ChatRequestBody {
  /** Complete history (excluding the system prompt, which is added server-side). */
  messages?: ChatMessage[];
}

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
        // Parse and validate input up front — a bad body is the caller's bug,
        // not something to forward to the upstream model.
        const { messages } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("messages required", { status: 400 });
        }

        // Secret must stay server-side. Read at request time (Cloudflare
        // Workers inject env per-request; module scope may be undefined).
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        // Prepend the JARVIS system prompt so the caller can never override it.
        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            stream: true,
            messages: [{ role: "system", content: JARVIS_SYSTEM_PROMPT }, ...messages],
          }),
        });

        // Surface upstream failures verbatim so the UI can show a real reason.
        if (!upstream.ok) {
          const text = await upstream.text().catch(() => "");
          return new Response(text || "Upstream error", { status: upstream.status });
        }

        // Pass the SSE body straight through — do NOT wrap in a TransformStream,
        // that would force the runtime to buffer and defeat progressive rendering.
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
