import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { countryOption, type CountryCode } from "@/lib/locale";
import type { LangCode } from "@/lib/persona";
import { generateGeminiText, geminiUserText } from "./gemini-text.server";

export type WebSource = { title: string; url: string; snippet?: string };
export type WebSearchResult = { query: string; summary: string; sources: WebSource[] };

type SearchItem = {
  url?: string;
  title?: string;
  description?: string;
  markdown?: string;
};

type DuckTopic = {
  FirstURL?: string;
  Text?: string;
  Topics?: DuckTopic[];
};

const SUPPORTED_LANGS = ["auto", "en", "ur", "ar", "tr", "fr", "es"] as const;
const SUPPORTED_COUNTRIES = [
  "SA", "AE", "QA", "KW", "BH", "OM", "JO", "EG", "PK", "IN", "TR", "GB", "US", "CA", "AU", "FR", "ES", "DE", "MY", "ID", "NG", "ZA",
] as const;

async function firecrawlSearch(query: string, apiKey: string): Promise<SearchItem[]> {
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit: 5, scrapeOptions: { formats: ["markdown"], onlyMainContent: true } }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Firecrawl search failed [${res.status}]`);
  const json = await res.json() as { data?: SearchItem[] | { web?: SearchItem[] } };
  const raw = json?.data;
  return Array.isArray(raw) ? raw : Array.isArray(raw?.web) ? raw.web : [];
}

function flattenDuckTopics(topics: DuckTopic[] = []): SearchItem[] {
  const result: SearchItem[] = [];
  for (const topic of topics) {
    if (topic.Topics?.length) result.push(...flattenDuckTopics(topic.Topics));
    else if (topic.FirstURL && topic.Text) result.push({ url: topic.FirstURL, title: topic.Text });
  }
  return result;
}

async function duckDuckGoSearch(query: string): Promise<SearchItem[]> {
  const url = new URL("https://api.duckduckgo.com/");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("no_html", "1");
  url.searchParams.set("skip_disambig", "1");
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) return [];
  const json = await res.json() as { AbstractText?: string; AbstractURL?: string; Heading?: string; RelatedTopics?: DuckTopic[] };
  const items = flattenDuckTopics(json.RelatedTopics);
  if (json.AbstractText && json.AbstractURL) {
    items.unshift({ title: json.Heading || "Web result", url: json.AbstractURL, description: json.AbstractText });
  }
  return items.slice(0, 5);
}

function languageInstruction(lang: LangCode): string {
  switch (lang) {
    case "ur": return "Reply in natural Urdu script. Hindi and Devanagari are disabled.";
    case "ar": return "Reply in clear Arabic. Hindi and Devanagari are disabled.";
    case "en": return "Reply in clear English. Hindi and Devanagari are disabled.";
    case "tr": return "Reply in clear Turkish. Hindi and Devanagari are disabled.";
    case "fr": return "Reply in clear French. Hindi and Devanagari are disabled.";
    case "es": return "Reply in clear Spanish. Hindi and Devanagari are disabled.";
    default: return "Reply in the user's language. If Urdu is requested, use Urdu script. Hindi and Devanagari are disabled.";
  }
}

function fallbackSummary(query: string, items: SearchItem[], lang: LangCode): string {
  if (items.length === 0) {
    return lang === "ur" ? `ویب پر “${query}” کے لیے کوئی نتیجہ نہیں ملا۔` : lang === "ar" ? `لم يتم العثور على نتائج للبحث عن “${query}”.` : `No web results were found for “${query}”.`;
  }
  const prefix = lang === "ur" ? `ویب سرچ کے نتائج “${query}”:` : lang === "ar" ? `نتائج البحث عن “${query}”: ` : `Web results for “${query}”: `;
  return `${prefix}\n${items.slice(0, 5).map((item, index) => `${index + 1}. ${item.title ?? item.url}`).join("\n")}`;
}

async function summarize(query: string, items: SearchItem[], lang: LangCode, countryLabel: string, userKey?: string): Promise<string> {
  const context = items.slice(0, 5).map((item, index) => {
    const body = (item.markdown ?? item.description ?? "").slice(0, 2000);
    return `[${index + 1}] ${item.title ?? item.url ?? "Untitled"}\nURL: ${item.url ?? ""}\n${body}`;
  }).join("\n\n---\n\n");
  return generateGeminiText({
    systemInstruction: `Answer from the provided web sources only. ${languageInstruction(lang)} The user's selected market is ${countryLabel}. Give 3–6 short factual sentences and cite sources as [1], [2].`,
    contents: [geminiUserText(`QUESTION: ${query}\n\nSOURCES:\n${context}`)],
    temperature: 0.2,
    timeoutMs: 20_000,
    apiKey: userKey,
  });
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
    const contextualQuery = `${country.label} ${data.query}`.trim();
    let items: SearchItem[] = [];
    if (process.env.FIRECRAWL_API_KEY?.trim()) {
      try { items = await firecrawlSearch(contextualQuery, process.env.FIRECRAWL_API_KEY.trim()); } catch { /* use free fallback */ }
    }
    if (items.length === 0) items = await duckDuckGoSearch(contextualQuery);
    const sources: WebSource[] = items.slice(0, 5).map((item) => ({
      title: item.title ?? item.url ?? "Untitled",
      url: item.url ?? "",
      snippet: item.description,
    })).filter((source) => source.url);
    if (sources.length === 0) return { query: data.query, summary: fallbackSummary(data.query, items, data.lang as LangCode), sources: [] };

    let summary = fallbackSummary(data.query, items, data.lang as LangCode);
    try {
      summary = await summarize(data.query, items, data.lang as LangCode, country.label, data.userKey);
    } catch {
      // Keep a source-only result when Gemini is temporarily unavailable.
    }
    return { query: data.query, summary, sources };
  });
