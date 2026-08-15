import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LangSchema = z.enum(["auto", "en", "ur", "ar", "hi", "tr", "fr", "es"]);

const MessageSchema = z.object({
  role: z.enum(["you", "assistant"]),
  text: z.string().trim().min(1).max(12000),
});

const languagePolicy = (lang: z.infer<typeof LangSchema>) => {
  switch (lang) {
    case "en": return "Reply in clear, natural English.";
    case "ur": return "جواب صاف اور قدرتی اردو میں دیں؛ ضرورت پر Roman Urdu یا English technical terms رکھیں۔";
    case "ar": return "أجب باللغة العربية الواضحة والطبيعية.";
    case "hi": return "उत्तर स्पष्ट और स्वाभाविक हिंदी में दें।";
    case "tr": return "Reply in clear, natural Turkish.";
    case "fr": return "Reply in clear, natural French.";
    case "es": return "Reply in clear, natural Spanish.";
    default: return "Reply in the same language the user used. Preserve names and technical terms when appropriate.";
  }
};

const SAFETY_POLICY = `
You are operating as a Saudi-Arabia-first productivity assistant.
You may explain, draft, summarize, search, organize, and prepare actions.
Never send a message, publish content, delete data, make a purchase, transfer money, change account settings, or modify an external system without a separate explicit user approval step.
If an action needs approval, describe the exact action, target, and important parameters before asking for approval.
Never claim an external action succeeded unless the integration returns a verified success result.
Use Asia/Riyadh as the default timezone for dates and times.
`;

export const chatReply = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      messages: z.array(MessageSchema).min(1).max(50),
      systemPrompt: z.string().trim().min(1).max(8000),
      lang: LangSchema.default("auto"),
    }).parse(input),
  )
  .handler(async ({ data }): Promise<{ text: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY?.trim();
    if (!apiKey) throw new Error("AI is not configured yet. Add LOVABLE_API_KEY to the server environment.");

    const model = process.env.LOVABLE_MODEL?.trim() || "google/gemini-2.5-flash";
    const msgs = [
      { role: "system" as const, content: `${data.systemPrompt}\n\n${languagePolicy(data.lang)}\n${SAFETY_POLICY}` },
      ...data.messages.map((m) => ({
        role: m.role === "you" ? ("user" as const) : ("assistant" as const),
        content: m.text,
      })),
    ];

    let res: Response;
    try {
      res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
        body: JSON.stringify({ model, messages: msgs, temperature: 0.3 }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error("AI reply timed out. Please try again.");
      }
      throw new Error("AI service is temporarily unreachable. Please try again.");
    }

    if (!res.ok) {
      if (res.status === 429) throw new Error("AI rate limit reached. Please try again shortly.");
      if (res.status === 402) throw new Error("AI credits are exhausted. Add credits to the configured AI gateway.");
      throw new Error(`AI reply failed with status ${res.status}.`);
    }

    const json = await res.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    const text = typeof json?.choices?.[0]?.message?.content === "string"
      ? json.choices[0].message.content.trim()
      : "";
    return { text: text || "I could not generate a reply. Please try again." };
  });
