// Server functions: Gemini screen understanding + concise AI answers.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateGeminiText, geminiUserText } from "./gemini-text.server";

const DescribeInput = z.object({
  imageBase64: z.string().min(100),
  mimeType: z.string().default("image/png"),
  lang: z.string().default("auto"),
  userKey: z.string().trim().max(200).optional(),
});

const langLine = (lang: string) => {
  if (lang === "en") return "Answer in English.";
  if (lang === "ur") return "جواب اردو میں دیں۔ ہندی یا دیوناگری استعمال نہ کریں۔";
  if (lang === "ar") return "أجب باللغة العربية. لا تستخدم الهندية أو الديفاناغارية.";
  return "Answer in the same language the user typically speaks. Never use Hindi or Devanagari.";
};

export const describeScreen = createServerFn({ method: "POST" })
  .validator((v: unknown) => DescribeInput.parse(v))
  .handler(async ({ data }) => {
    const text = await generateGeminiText({
      systemInstruction: "You are Alpha's vision module. Describe what's on this screen concisely in 3–6 short lines. Focus on apps, windows, key text, and what the user seems to be doing.",
      contents: [{
        role: "user",
        parts: [
          { text: langLine(data.lang) },
          { inlineData: { mimeType: data.mimeType, data: data.imageBase64 } },
        ],
      }],
      temperature: 0.2,
      apiKey: data.userKey,
    });
    return { text };
  });

const AskInput = z.object({
  question: z.string().min(2).max(2000),
  lang: z.string().default("auto"),
  userKey: z.string().trim().max(200).optional(),
});

export const askAI = createServerFn({ method: "POST" })
  .validator((v: unknown) => AskInput.parse(v))
  .handler(async ({ data }) => {
    const text = await generateGeminiText({
      systemInstruction: `You are Alpha, a concise voice assistant. Give a short, direct answer in 2–5 sentences. ${langLine(data.lang)}`,
      contents: [geminiUserText(data.question)],
      temperature: 0.3,
      apiKey: data.userKey,
    });
    return { text };
  });
