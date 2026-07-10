import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const generateNote = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ prompt: z.string().trim().min(2).max(500) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ text: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured (LOVABLE_API_KEY missing).");

    const sys = `You turn a rough idea into ONE concise note.
Rules:
- Reply in the same language as the prompt (Urdu/Roman Urdu/English).
- 1–3 short lines, plain text (no markdown, no quotes, no headings).
- Actionable and specific. No filler.
- Output ONLY the note text.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: data.prompt },
        ],
      }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("Rate limit. Try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`Note generation failed [${res.status}]`);
    }
    const json = await res.json();
    const text = (json?.choices?.[0]?.message?.content ?? "").trim().replace(/^["'`]|["'`]$/g, "");
    return { text: text || data.prompt };
  });
