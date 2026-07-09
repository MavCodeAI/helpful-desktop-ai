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
import { z } from "zod";

/**
 * TTS body schema.
 *
 * - `text` is capped at 4096 chars — the OpenAI TTS model's own hard limit.
 * - `voice` restricted to the supported set so a bad value fails fast
 *   client-side (400) instead of returning an opaque upstream error.
 * - `speed` clamped to the model's supported range.
 */
const ttsBodySchema = z.object({
  text: z.string().trim().min(1, "Nothing to say").max(4096, "Text too long for one utterance"),
  voice: z.enum(["onyx", "alloy", "echo", "fable", "nova", "shimmer"]).optional(),
  speed: z.number().min(0.25).max(4).optional(),
});

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return new Response("Invalid JSON body", { status: 400 });
        }

        const parsed = ttsBodySchema.safeParse(raw);
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          return new Response(issue?.message || "Invalid TTS request", { status: 400 });
        }
        const { text, voice, speed } = parsed.data;

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Voice service is not configured", { status: 500 });

        let upstream: Response;
        try {
          upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openai/gpt-4o-mini-tts",
              input: text,
              voice: voice || "onyx",
              speed: speed ?? 1,
              response_format: "mp3",
              instructions:
                "Speak calmly, precisely, and with a subtle refined British accent, like a sophisticated AI butler.",
            }),
          });
        } catch (e) {
          console.error("[/api/tts] upstream fetch failed", e);
          return new Response("Cannot reach voice service — please retry.", { status: 502 });
        }

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
