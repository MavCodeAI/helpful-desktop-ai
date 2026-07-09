import { createFileRoute } from "@tanstack/react-router";

interface TTSBody {
  text?: string;
  voice?: string;
}

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { text, voice } = (await request.json()) as TTSBody;
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
            instructions: "Speak calmly, precisely, and with a subtle refined British accent, like a sophisticated AI butler.",
          }),
        });

        if (!upstream.ok) {
          const t = await upstream.text().catch(() => "");
          return new Response(t || "TTS failed", { status: upstream.status });
        }

        return new Response(upstream.body, {
          headers: { "Content-Type": "audio/mpeg" },
        });
      },
    },
  },
});
