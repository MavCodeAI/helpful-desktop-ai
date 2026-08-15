import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { countryOption, type CountryCode } from "@/lib/locale";
import type { LangCode } from "@/lib/persona";
import { generateGeminiGroundedText, generateGeminiText, geminiUserText } from "./gemini-text.server";

export type WebSource = { title: string; url: string; snippet?: string };
export type WebSearchProvider = "tavily" | "gemini" | "none";
export type WebSearchResult = { query: string; summary: string; sources: WebSource[]; provider: WebSearchProvider };

const SUPPORTED_LANGS = ["auto", "en", "ur"] as const;
const SUPPORTED_COUNTRIES = ["SA", "AE", "QA", "KW", "BH", "OM", "JO", "EG", "PK", "TR", "GB", "US", "CA", "AU", "FR", "ES", "DE", "MY", "ID", "NG", "ZA"] as const;

type TavilyResult = { title?: string; url?: string; content?: string };

function languageInstruction(lang: LangCode): string {
  return lang === "ur" ? "Reply in natural Urdu script only. Hindi, Devanagari and Roman Urdu are strictly disabled." : "Reply in clear English only. Hindi, Devanagari and Roman Urdu are strictly disabled.";
}

function unavailableSummary(query: string, lang: LangCode): string {
  return lang === "ur" ? `“${query}” کے لیے تازہ ویب نتائج حاصل نہیں ہو سکے۔ Tavily یا Gemini API key اور internet connection چیک کریں۔` : `Live web results for “${query}” were unavailable. Check the Tavily or Gemini API key and internet connection.`;
}

function getTavilyKey(userKey?: string) {
  return userKey?.trim() || process.env.TAVILY_API_KEY?.trim() || "";
}

async function searchTavily(query: string, country: string, userKey?: string): Promise<WebSource[]> {
  const key = getTavilyKey(userKey);
  if (!key) throw new Error("TAVILY_API_KEY is not configured");
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: key, query: `${country} ${query}`.trim(), search_depth: "basic", topic: "general", max_results: 5, include_answer: false, include_raw_content: false }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Tavily search failed with status ${response.status}`);
  const json = await response.json() as { results?: TavilyResult[] };
  const sources = (json.results ?? []).map((item) => ({ title: item.title?.trim() || "Web source", url: item.url?.trim() || "", snippet: item.content?.trim() })).filter((item) => item.url);
  if (!sources.length) throw new Error("Tavily returned no usable results");
  return sources;
}

async function summarizeTavily(query: string, country: string, lang: LangCode, sources: WebSource[], geminiKey?: string): Promise<string> {
  const sourceText = sources.map((source, index) => `[${index + 1}] ${source.title}\nURL: ${source.url}\n${source.snippet ?? ""}`).join("\n\n");
  return generateGeminiText({
    systemInstruction: `Summarize the provided live web search results for the user. Market: ${country}. ${languageInstruction(lang)} Give a concise, useful answer in 3–6 factual sentences. Cite the supplied sources as [1], [2] when applicable. Do not invent facts or sources.`,
    contents: [geminiUserText(`Question: ${query}\n\nLive Tavily results:\n${sourceText}`)],
    temperature: 0.2,
    timeoutMs: 30_000,
    apiKey: geminiKey,
  });
}

export const webSearchSummarize = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    query: z.string().trim().min(2).max(400),
    country: z.enum(SUPPORTED_COUNTRIES).default("SA"),
    lang: z.enum(SUPPORTED_LANGS).default("auto"),
    userKey: z.string().trim().max(200).optional(),
    tavilyKey: z.string().trim().max(200).optional(),
  }).parse(input))
  .handler(async ({ data }): Promise<WebSearchResult> => {
    const country = countryOption(data.country as CountryCode);
    const lang: LangCode = data.lang === "ur" ? "ur" : "en";
    try {
      const sources = await searchTavily(data.query, country.label, data.tavilyKey);
      const summary = await summarizeTavily(data.query, country.label, lang, sources, data.userKey);
      return { query: data.query, summary, sources, provider: "tavily" };
    } catch {
      try {
        const grounded = await generateGeminiGroundedText({
          systemInstruction: `Use Google Search grounding as a fallback to answer the user's question with current, relevant web information. The selected market is ${country.label}. ${languageInstruction(lang)} Give a concise answer in 3–6 factual sentences and cite grounded sources as [1], [2] when applicable. Do not invent sources or facts.`,
          contents: [geminiUserText(`${country.label} ${data.query}`.trim())],
          temperature: 0.2,
          timeoutMs: 30_000,
          apiKey: data.userKey,
        });
        return { query: data.query, summary: grounded.text, sources: grounded.sources.slice(0, 5), provider: "gemini" };
      } catch {
        return { query: data.query, summary: unavailableSummary(data.query, lang), sources: [], provider: "none" };
      }
    }
  });
