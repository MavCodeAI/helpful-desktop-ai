// Server functions: screen understanding + AI web-answer.
import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const DescribeInput = z.object({
  imageBase64: z.string().min(100),
  mimeType: z.string().default("image/png"),
  lang: z.string().default("auto"),
});

const langLine = (lang: string) => {
  if (lang === "en") return "Answer in English.";
  if (lang === "ur") return "جواب اردو میں دیں۔";
  if (lang === "ar") return "أجب باللغة العربية.";
  return "Answer in the same language the user typically speaks.";
};

export const describeScreen = createServerFn({ method: "POST" })
  .validator((v: unknown) => DescribeInput.parse(v))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY missing");
    const gw = createLovableAiGatewayProvider(key);
    const model = gw("google/gemini-2.5-flash");
    const dataUrl = `data:${data.mimeType};base64,${data.imageBase64}`;
    const result = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `You are Alpha's vision module. Describe what's on this screen concisely (3-6 short lines). Focus on apps, windows, key text, and what the user seems to be doing. ${langLine(data.lang)}`,
            },
            { type: "image", image: dataUrl },
          ],
        },
      ],
    });
    return { text: result.text };
  });

const AskInput = z.object({
  question: z.string().min(2).max(2000),
  lang: z.string().default("auto"),
});

export const askAI = createServerFn({ method: "POST" })
  .validator((v: unknown) => AskInput.parse(v))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY missing");
    const gw = createLovableAiGatewayProvider(key);
    const model = gw("google/gemini-2.5-flash");
    const result = await generateText({
      model,
      messages: [
        {
          role: "system",
          content: `You are Alpha, a concise voice assistant. Give a short, direct answer (2-5 sentences). ${langLine(data.lang)}`,
        },
        { role: "user", content: data.question },
      ],
    });
    return { text: result.text };
  });
