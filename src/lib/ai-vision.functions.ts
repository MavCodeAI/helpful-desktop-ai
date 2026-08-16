// Server functions: Gemini screen understanding + concise AI answers.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateGeminiText, geminiUserText } from "./gemini-text.server";

const DescribeInput = z.object({
  imageBase64: z.string().min(100),
  mimeType: z.string().default("image/png"),
  lang: z.enum(["en", "ur"]).default("ur"),
  userKey: z.string().trim().max(200).optional(),
});

const langLine = (lang: "en" | "ur") => {
  return lang === "ur"
    ? "جواب صرف قدرتی اردو رسم الخط میں دیں۔ ہندی، دیوناگری اور Roman Urdu استعمال نہ کریں۔"
    : "Answer only in clear English. Never use Hindi or Devanagari.";
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
  lang: z.enum(["en", "ur"]).default("ur"),
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
