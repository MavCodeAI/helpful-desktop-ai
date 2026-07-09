import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/stt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const inbound = await request.formData();
        const file = inbound.get("file") as File | Blob | null;
        if (!file || typeof (file as Blob).arrayBuffer !== "function") {
          return new Response("file required", { status: 400 });
        }

        const forward = new FormData();
        const name = (file as File).name || "recording.webm";
        forward.append("file", file, name);
        forward.append("model", "openai/gpt-4o-transcribe");

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: forward,
        });

        const text = await upstream.text();
        if (!upstream.ok) return new Response(text || "STT failed", { status: upstream.status });
        return new Response(text, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
