import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Server fn: given a conversation transcript + existing memories,
 * returns new long-term facts worth remembering. Client owns storage.
 */
export const extractMemoryFacts = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      transcript: z.string().trim().min(4).max(4000),
      existing: z.array(z.string()).max(400).default([]),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { facts: [] as string[] };

    const sys = `You extract long-term memory facts about a user from a voice conversation transcript.
Rules:
- Output ONLY a JSON object: {"facts": ["...", "..."]}
- Each fact ≤ 120 chars, self-contained, factual, timeless (name, preferences, likes, dislikes, goals, family, work, city, language).
- SKIP transient chit-chat, questions, temporary tasks, or things already in EXISTING.
- If nothing worth remembering, return {"facts": []}
- Never invent facts not in the transcript.`;

    const userMsg = `EXISTING MEMORIES:\n${data.existing.map((c, i) => `${i + 1}. ${c}`).join("\n") || "(none)"}\n\nTRANSCRIPT:\n${data.transcript}`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: userMsg },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) return { facts: [] as string[] };
      const json = await res.json();
      const text: string = json?.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed?.facts)) return { facts: [] as string[] };
      const facts = parsed.facts
        .filter((f: unknown): f is string => typeof f === "string")
        .map((f: string) => f.trim())
        .filter((f: string) => f.length >= 2 && f.length <= 160)
        .slice(0, 8);
      return { facts };
    } catch {
      return { facts: [] as string[] };
    }
  });
