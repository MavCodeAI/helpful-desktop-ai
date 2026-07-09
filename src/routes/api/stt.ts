/**
 * Speech-to-text endpoint: POST /api/stt
 *
 * Receives a recorded audio blob from the browser (WebM or MP4 depending
 * on the platform) and returns a JSON transcript from OpenAI's
 * `gpt-4o-transcribe` model via the Lovable AI Gateway.
 *
 * The endpoint is a thin proxy: we re-package the incoming multipart form
 * because the Gateway needs `model` alongside `file`, and we cannot forward
 * the browser's original FormData directly (it lacks the `model` field and
 * may not include a filename with the right extension).
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/stt")({
  server: {
    handlers: {
      /**
       * POST handler.
       *
       * Request:  `multipart/form-data` with a `file` field containing the
       *           recorded audio (WebM/Opus or MP4/AAC).
       * Response: JSON string from the transcription API, typically
       *           `{ "text": "..." }`. On failure, plain-text error body
       *           with the upstream status code.
       */
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        // Read the browser's multipart body. `file` may be a File or a Blob;
        // structural check avoids TS `instanceof` complaints in edge runtimes.
        const inbound = await request.formData();
        const file = inbound.get("file") as File | Blob | null;
        if (!file || typeof (file as Blob).arrayBuffer !== "function") {
          return new Response("file required", { status: 400 });
        }

        // Rebuild multipart so we can add `model` and ensure a filename with
        // an extension the upstream STT can sniff.
        const forward = new FormData();
        const name = (file as File).name || "recording.webm";
        forward.append("file", file, name);
        forward.append("model", "openai/gpt-4o-transcribe");

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          // Do NOT set Content-Type: fetch computes the multipart boundary for us.
          headers: { Authorization: `Bearer ${key}` },
          body: forward,
        });

        const text = await upstream.text();
        if (!upstream.ok) return new Response(text || "STT failed", { status: upstream.status });
        // Body is already JSON; forward as-is so the client can `res.json()`.
        return new Response(text, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
