import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateGeminiText, geminiModelText, geminiUserText, type GeminiContent } from "./gemini-text.server";

const LangSchema = z.enum(["auto", "en", "ur", "ar", "tr", "fr", "es"]);

const MessageSchema = z.object({
  role: z.enum(["you", "assistant"]),
  text: z.string().trim().min(1).max(12000),
});

const languagePolicy = (lang: z.infer<typeof LangSchema>) => {
  switch (lang) {
    case "en": return "Reply in clear, natural English.";
    case "ur": return "جواب صاف اور قدرتی اردو میں دیں؛ ضرورت پر Roman Urdu یا English technical terms رکھیں۔ ہندی یا دیوناگری ہرگز استعمال نہ کریں۔";
    case "ar": return "أجب باللغة العربية الواضحة والطبيعية. لا تستخدم الهندية أو الديفاناغارية.";
    case "tr": return "Reply in clear, natural Turkish. Do not use Hindi or Devanagari.";
    case "fr": return "Reply in clear, natural French. Do not use Hindi or Devanagari.";
    case "es": return "Reply in clear, natural Spanish. Do not use Hindi or Devanagari.";
    default: return "Reply in the same language the user used. Preserve names and technical terms when appropriate. Never use Hindi or Devanagari; for Urdu requests use Urdu script.";
  }
};

const SAFETY_POLICY = `
You are operating as a Saudi-Arabia-first productivity assistant.
You may explain, draft, summarize, search, organize, and prepare actions.
Never send a message, publish content, delete data, make a purchase, transfer money, change account settings, or modify an external system without a separate explicit user approval step.
If an action needs approval, describe the exact action, target, and important parameters before asking for approval.
Never claim an external action succeeded unless the integration returns a verified success result.
Use the user's selected country and timezone context for dates and times; if no country is supplied, use Asia/Riyadh.
`;

export const chatReply = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      messages: z.array(MessageSchema).min(1).max(50),
      systemPrompt: z.string().trim().min(1).max(8000),
      lang: LangSchema.default("auto"),
      userKey: z.string().trim().max(200).optional(),
    }).parse(input),
  )
  .handler(async ({ data }): Promise<{ text: string }> => {
    const contents: GeminiContent[] = data.messages.map((message) =>
      message.role === "you" ? geminiUserText(message.text) : geminiModelText(message.text),
    );
    const text = await generateGeminiText({
      systemInstruction: `${data.systemPrompt}\n\n${languagePolicy(data.lang)}\n${SAFETY_POLICY}`,
      contents,
      temperature: 0.3,
      apiKey: data.userKey,
    });
    return { text };
  });
