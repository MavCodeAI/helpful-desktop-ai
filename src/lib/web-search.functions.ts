import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { countryOption, type CountryCode } from "@/lib/locale";
import type { LangCode } from "@/lib/persona";
import { generateGeminiGroundedText, geminiUserText } from "./gemini-text.server";

export type WebSource = { title: string; url: string; snippet?: string };
export type WebSearchProvider = "gemini" | "none";
export type WebSearchResult = { query: string; summary: string; sources: WebSource[]; provider: WebSearchProvider };

const SUPPORTED_LANGS = ["auto", "en", "ur"] as const;
const SUPPORTED_COUNTRIES = [
  "SA", "AE", "QA", "KW", "BH", "OM", "JO", "EG", "PK", "TR", "GB", "US", "CA", "AU", "FR", "ES", "DE", "MY", "ID", "NG", "ZA",
] as const;

function languageInstruction(lang: LangCode): string {
  return lang === "ur"
    ? "Reply in natural Urdu script only. Hindi, Devanagari and Roman Urdu are strictly disabled."
    : "Reply in clear English only. Hindi, Devanagari and Roman Urdu are strictly disabled.";
}

function unavailableSummary(query: string, lang: LangCode): string {
  return lang === "ur"
    ? `Gemini سے “${query}” کے لیے تازہ ویب نتائج حاصل نہیں ہو سکے۔ براہِ کرم Gemini API key اور internet connection چیک کریں۔`
    : `Gemini could not retrieve live web results for “${query}”. Check the Gemini API key and internet connection.`;
}

export const webSearchSummarize = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    query: z.string().trim().min(2).max(400),
    country: z.enum(SUPPORTED_COUNTRIES).default("SA"),
    lang: z.enum(SUPPORTED_LANGS).default("auto"),
    userKey: z.string().trim().max(200).optional(),
  }).parse(input))
  .handler(async ({ data }): Promise<WebSearchResult> => {
    const country = countryOption(data.country as CountryCode);
    const lang: LangCode = data.lang === "ur" ? "ur" : "en";
    const contextualQuery = `${country.label} ${data.query}`.trim();

    try {
      const grounded = await generateGeminiGroundedText({
        systemInstruction: `Use Google Search grounding to answer the user's question with current, relevant web information. The selected market is ${country.label}. ${languageInstruction(lang)} Give a concise answer in 3–6 factual sentences and cite grounded sources as [1], [2] when applicable. Do not invent sources or facts.`,
        contents: [geminiUserText(contextualQuery)],
        temperature: 0.2,
        timeoutMs: 30_000,
        apiKey: data.userKey,
      });
      const sources = grounded.sources.slice(0, 5).map((source) => ({
        title: source.title,
        url: source.url,
      }));
      return { query: data.query, summary: grounded.text, sources, provider: "gemini" };
    } catch {
      return { query: data.query, summary: unavailableSummary(data.query, lang), sources: [], provider: "none" };
    }
  });
