/**
 * Text-to-speech endpoint: POST /api/tts
 *
 * Synthesises the JARVIS assistant's reply into MP3 audio using OpenAI's
 * `gpt-4o-mini-tts` model, routed through the Lovable AI Gateway. The client
 * plays the returned audio blob directly via an `<audio>` element.
 *
 * We use non-streaming (single-response) MP3 rather than SSE PCM because the
 * client just wants a playable file, and MP3 keeps the browser code trivial.
 */
import { createFileRoute } from "@tanstack/react-router";

/** JSON body accepted by this endpoint. */
interface TTSBody {
  /** The text JARVIS should speak. Required. */
  text?: string;
  /** Optional voice id (e.g. "onyx", "alloy"). Defaults to "onyx" for a deeper butler tone. */
  voice?: string;
}

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      /**
       * POST handler.
       *
       * Request:  `{ text: string, voice?: string }`
       * Response: `audio/mpeg` binary stream, or plain-text error with
       *           upstream status on failure.
       */
      POST: async ({ request }) => {
        const { text, voice } = (await request.json()) as TTSBody;
        // Empty input would still cost a gateway call — reject fast.
        if (!text || !text.trim()) return new Response("text required", { status: 400 });

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input: text,
            voice: voice || "onyx",
            response_format: "mp3",
            // `instructions` steers prosody without needing SSML.
            instructions:
              "Speak calmly, precisely, and with a subtle refined British accent, like a sophisticated AI butler.",
          }),
        });

        if (!upstream.ok) {
          const t = await upstream.text().catch(() => "");
          return new Response(t || "TTS failed", { status: upstream.status });
        }

        // Forward the audio stream unchanged so playback can start ASAP.
        return new Response(upstream.body, {
          headers: { "Content-Type": "audio/mpeg" },
        });
      },
    },
  },
});
