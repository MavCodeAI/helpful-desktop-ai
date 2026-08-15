import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateGeminiText, geminiUserText } from "./gemini-text.server";

export const generateNote = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      prompt: z.string().trim().min(2).max(500),
      userKey: z.string().trim().max(200).optional(),
    }).parse(input),
  )
  .handler(async ({ data }): Promise<{ text: string }> => {
    const sys = `You turn a rough idea into ONE concise note.
Rules:
- Reply in the same language as the prompt (Urdu/Roman Urdu/English).
- 1–3 short lines, plain text (no markdown, no quotes, no headings).
- Actionable and specific. No filler.
- Output ONLY the note text.
- Never use Hindi or Devanagari; use Urdu script for Urdu prompts.`;
    const text = await generateGeminiText({
      systemInstruction: sys,
      contents: [geminiUserText(data.prompt)],
      temperature: 0.2,
      apiKey: data.userKey,
    });
    return { text: text.replace(/^['"`]|['"`]$/g, "").trim() || data.prompt };
  });
