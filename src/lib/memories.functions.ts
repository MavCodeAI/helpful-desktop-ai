import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateGeminiText, geminiUserText } from "./gemini-text.server";

/**
 * Server fn: given a conversation transcript + existing memories,
 * returns new long-term facts worth remembering. Client owns storage.
 */
export const extractMemoryFacts = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      transcript: z.string().trim().min(4).max(4000),
      existing: z.array(z.string()).max(400).default([]),
      userKey: z.string().trim().max(200).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const sys = `You extract long-term memory facts about a user from a voice conversation transcript.
Rules:
- Output ONLY a JSON object: {"facts": ["...", "..."]}
- Each fact ≤ 120 chars, self-contained, factual, timeless (name, preferences, likes, dislikes, goals, family, work, city, language).
- SKIP transient chit-chat, questions, temporary tasks, or things already in EXISTING.
- If nothing worth remembering, return {"facts": []}
- Never invent facts not in the transcript.
- Never use Hindi or Devanagari; preserve Urdu in Urdu script.`;
    const userMsg = `EXISTING MEMORIES:\n${data.existing.map((c, i) => `${i + 1}. ${c}`).join("\n") || "(none)"}\n\nTRANSCRIPT:\n${data.transcript}`;

    try {
      const text = await generateGeminiText({
        model: "gemini-2.5-flash",
        systemInstruction: sys,
        contents: [geminiUserText(userMsg)],
        temperature: 0.1,
        responseMimeType: "application/json",
        timeoutMs: 20_000,
        apiKey: data.userKey,
      });
      const parsed = JSON.parse(text) as { facts?: unknown };
      if (!Array.isArray(parsed?.facts)) return { facts: [] as string[] };
      const facts = parsed.facts
        .filter((fact: unknown): fact is string => typeof fact === "string")
        .map((fact: string) => fact.trim())
        .filter((fact: string) => fact.length >= 2 && fact.length <= 160)
        .slice(0, 8);
      return { facts };
    } catch {
      return { facts: [] as string[] };
    }
  });
