import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MessageSchema = z.object({
  role: z.enum(["you", "assistant"]),
  text: z.string(),
});

export const chatReply = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      messages: z.array(MessageSchema).min(1).max(50),
      systemPrompt: z.string().min(1).max(8000),
    }).parse(input),
  )
  .handler(async ({ data }): Promise<{ text: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured (LOVABLE_API_KEY missing).");

    const msgs = [
      { role: "system" as const, content: data.systemPrompt },
      ...data.messages.map((m) => ({
        role: m.role === "you" ? ("user" as const) : ("assistant" as const),
        content: m.text,
      })),
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: msgs }),
    });
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached. Try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Lovable Cloud.");
      throw new Error(`AI reply failed [${res.status}]: ${body}`);
    }
    const json = await res.json();
    const text = (json?.choices?.[0]?.message?.content ?? "").trim();
    return { text: text || "…" };
  });
