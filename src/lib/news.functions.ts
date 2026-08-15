import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { countryOption, type CountryCode } from "@/lib/locale";
import type { LangCode } from "@/lib/persona";
import { generateGeminiText, geminiUserText } from "./gemini-text.server";

export type NewsItem = {
  title: string;
  url: string;
  domain?: string;
  seenDate?: string;
  sourceCountry?: string;
};

export type NewsResult = {
  query: string;
  country: CountryCode;
  summary: string;
  items: NewsItem[];
  provider: "gdelt" | "google-rss";
};

type GdeltArticle = {
  title?: string;
  url?: string;
  domain?: string;
  seendate?: string;
  sourcecountry?: string;
};

type GoogleRssItem = {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  source?: string;
};

const SUPPORTED_LANGS = ["auto", "en", "ur", "ar", "tr", "fr", "es"] as const;
const SUPPORTED_COUNTRIES = [
  "SA", "AE", "QA", "KW", "BH", "OM", "JO", "EG", "PK", "IN", "TR", "GB", "US", "CA", "AU", "FR", "ES", "DE", "MY", "ID", "NG", "ZA",
] as const;

const InputSchema = z.object({
  query: z.string().trim().max(180).default("latest news"),
  country: z.enum(SUPPORTED_COUNTRIES).default("SA"),
  lang: z.enum(SUPPORTED_LANGS).default("auto"),
  userKey: z.string().trim().max(200).optional(),
});

function languageInstruction(lang: LangCode): string {
  switch (lang) {
    case "ur": return "Write the summary in natural Urdu script. Hindi and Devanagari are disabled.";
    case "ar": return "اكتب الملخص باللغة العربية الواضحة. لا تستخدم الهندية أو الديفاناغارية.";
    case "en": return "Write the summary in clear English. Do not use Hindi or Devanagari.";
    case "tr": return "Write the summary in clear Turkish. Do not use Hindi or Devanagari.";
    case "fr": return "Write the summary in clear French. Do not use Hindi or Devanagari.";
    case "es": return "Write the summary in clear Spanish. Do not use Hindi or Devanagari.";
    default: return "Use the user's question language, but never use Hindi or Devanagari. If Urdu is requested, use Urdu script.";
  }
}

function fallbackSummary(items: NewsItem[], lang: LangCode, countryLabel: string): string {
  if (items.length === 0) {
    return lang === "ur"
      ? `${countryLabel} کے لیے حالیہ خبریں نہیں مل سکیں۔`
      : lang === "ar"
        ? `لم يتم العثور على أخبار حديثة عن ${countryLabel}.`
        : `No recent news was found for ${countryLabel}.`;
  }
  const prefix = lang === "ur"
    ? `${countryLabel} کی تازہ دستیاب خبریں:`
    : lang === "ar"
      ? `أحدث الأخبار المتاحة عن ${countryLabel}:`
      : `Latest available news for ${countryLabel}:`;
  return `${prefix}\n${items.slice(0, 5).map((item, index) => `${index + 1}. ${item.title}`).join("\n")}`;
}

async function summarizeNews(query: string, items: NewsItem[], lang: LangCode, countryLabel: string, userKey?: string): Promise<string> {
  if (items.length === 0) return fallbackSummary(items, lang, countryLabel);
  const context = items.slice(0, 8).map((item, index) => `[${index + 1}] ${item.title}\nURL: ${item.url}`).join("\n\n");
  try {
    return await generateGeminiText({
      systemInstruction: `You summarize current news from the supplied headlines only. ${languageInstruction(lang)} Give 3–6 concise sentences, mention uncertainty when headlines are incomplete, and cite sources as [1], [2].`,
      contents: [geminiUserText(`COUNTRY: ${countryLabel}\nQUESTION: ${query}\nHEADLINES:\n${context}`)],
      temperature: 0.2,
      timeoutMs: 20_000,
      apiKey: userKey,
    });
  } catch {
    return fallbackSummary(items, lang, countryLabel);
  }
}

async function fetchGdeltNews(query: string): Promise<NewsItem[]> {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("maxrecords", "8");
  url.searchParams.set("format", "json");
  url.searchParams.set("sort", "datedesc");
  url.searchParams.set("timespan", "48h");

  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`GDELT returned HTTP ${response.status}.`);
  const json = await response.json() as { articles?: GdeltArticle[] };
  return (json.articles ?? []).map((item) => ({
    title: item.title?.trim() || "Untitled article",
    url: item.url?.trim() || "",
    domain: item.domain?.trim() || undefined,
    seenDate: item.seendate?.trim() || undefined,
    sourceCountry: item.sourcecountry?.trim() || undefined,
  })).filter((item) => item.url && item.title).slice(0, 8);
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function readXmlTag(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return match?.[1] ? decodeXml(match[1]) : undefined;
}

function googleNewsLanguage(lang: LangCode): string {
  switch (lang) {
    case "ur": return "ur";
    case "ar": return "ar";
    case "tr": return "tr";
    case "fr": return "fr";
    case "es": return "es";
    default: return "en";
  }
}

async function fetchGoogleNewsRss(query: string, country: CountryCode, lang: LangCode, countryLabel: string): Promise<NewsItem[]> {
  const language = googleNewsLanguage(lang);
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", `${countryLabel} ${query}`.trim());
  url.searchParams.set("hl", `${language}-${country.toLowerCase()}`);
  url.searchParams.set("gl", country);
  url.searchParams.set("ceid", `${country}:${language}`);

  const response = await fetch(url, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Google News RSS returned HTTP ${response.status}.`);
  const xml = await response.text();
  const itemBlocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);
  return itemBlocks.map((block) => {
    const articleUrl = readXmlTag(block, "link") || "";
    let domain: string | undefined;
    try { domain = new URL(articleUrl).hostname.replace(/^www\./, ""); } catch { /* keep undefined */ }
    return {
      title: readXmlTag(block, "title") || "Untitled article",
      url: articleUrl,
      domain,
      seenDate: readXmlTag(block, "pubDate"),
      sourceCountry: country,
    };
  }).filter((item) => item.url && item.title).slice(0, 8);
}

export const getLatestNews = createServerFn({ method: "POST" })
  .validator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<NewsResult> => {
    const selected = countryOption(data.country as CountryCode);
    const userQuery = data.query.trim() || "latest news";
    const gdeltQuery = userQuery.toLowerCase() === "latest news"
      ? `sourcecountry:${selected.code}`
      : `sourcecountry:${selected.code} ${userQuery}`;

    let items: NewsItem[] = [];
    let provider: NewsResult["provider"] = "gdelt";
    try {
      items = await fetchGdeltNews(gdeltQuery);
    } catch {
      // Google News RSS is the keyless secondary source.
    }
    if (items.length === 0) {
      try {
        items = await fetchGoogleNewsRss(userQuery, selected.code, data.lang as LangCode, selected.label);
        provider = "google-rss";
      } catch {
        // Keep an empty, localized result instead of failing the voice action.
      }
    }

    return {
      query: userQuery,
      country: selected.code,
      summary: await summarizeNews(userQuery, items, data.lang as LangCode, selected.label, data.userKey),
      items,
      provider,
    };
  });
