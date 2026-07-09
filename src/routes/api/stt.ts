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

/** Upstream STT model caps at 25 MB; enforce the same to fail fast. */
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
/** Any recording smaller than this is almost certainly silence / a tap. */
const MIN_AUDIO_BYTES = 512;
/** Whitelist of MIME types the browser MediaRecorder actually produces. */
const ALLOWED_MIME_PREFIXES = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav"];

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
        if (!key) return new Response("Voice service is not configured", { status: 500 });

        // 0. Optional streaming: /api/stt?stream=1 forwards SSE deltas so the
        //    UI can render the transcript progressively as words arrive.
        const wantStream = new URL(request.url).searchParams.get("stream") === "1";

        // 1. Parse multipart defensively — a bad body should be a 400.
        let inbound: FormData;
        try {
          inbound = await request.formData();
        } catch {
          return new Response("Invalid form body", { status: 400 });
        }

        // 2. Validate the `file` part: presence, shape, MIME, and size.
        const file = inbound.get("file") as File | Blob | null;
        if (!file || typeof (file as Blob).arrayBuffer !== "function") {
          return new Response("Audio file required", { status: 400 });
        }
        const blob = file as Blob;
        if (blob.size < MIN_AUDIO_BYTES) {
          return new Response("Recording too short", { status: 400 });
        }
        if (blob.size > MAX_AUDIO_BYTES) {
          return new Response("Recording too long (max 25 MB)", { status: 413 });
        }
        const mime = (blob.type || "").toLowerCase();
        if (mime && !ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p))) {
          return new Response("Unsupported audio format", { status: 415 });
        }

        // 3. Rebuild multipart so we can add `model` and ensure a filename
        //    with an extension the upstream STT can sniff.
        const forward = new FormData();
        const name = (file as File).name || "recording.webm";
        forward.append("file", blob, name);
        forward.append("model", "openai/gpt-4o-transcribe");
        if (wantStream) forward.append("stream", "true");

        // 4. Call the upstream gateway — catch network drops separately.
        let upstream: Response;
        try {
          upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
            method: "POST",
            // Do NOT set Content-Type: fetch computes the multipart boundary for us.
            headers: { Authorization: `Bearer ${key}` },
            body: forward,
          });
        } catch (e) {
          console.error("[/api/stt] upstream fetch failed", e);
          return new Response("Cannot reach transcription service — please retry.", {
            status: 502,
          });
        }

        if (!upstream.ok) {
          const errText = await upstream.text().catch(() => "");
          return new Response(errText || "STT failed", { status: upstream.status });
        }

        // 5a. Streaming: pipe the SSE body through unchanged so the client
        //     can read `transcript.text.delta` / `transcript.text.done` events.
        if (wantStream && upstream.body) {
          return new Response(upstream.body, {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache, no-transform",
              "X-Accel-Buffering": "no",
            },
          });
        }

        // 5b. Non-streaming: forward JSON body as-is.
        const text = await upstream.text().catch(() => "");
        return new Response(text, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
