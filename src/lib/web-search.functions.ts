import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type WebSource = { title: string; url: string; snippet?: string };
export type WebSearchResult = { query: string; summary: string; sources: WebSource[] };

type FirecrawlSearchItem = {
  url?: string;
  title?: string;
  description?: string;
  markdown?: string;
};

async function firecrawlSearch(query: string, apiKey: string): Promise<FirecrawlSearchItem[]> {
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      limit: 5,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
  });
  if (!res.ok) throw new Error(`Firecrawl search failed [${res.status}]: ${await res.text()}`);
  const json = await res.json();
  const raw = json?.data;
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.web) ? raw.web : [];
  return list as FirecrawlSearchItem[];
}

async function summarize(query: string, items: FirecrawlSearchItem[], apiKey: string): Promise<string> {
  const context = items.slice(0, 5).map((it, i) => {
    const body = (it.markdown ?? it.description ?? "").slice(0, 2000);
    return `[${i + 1}] ${it.title ?? it.url ?? "Untitled"}\nURL: ${it.url ?? ""}\n${body}`;
  }).join("\n\n---\n\n");

  const sys = `You answer the user's question from the provided web sources.
Rules:
- Reply in the same language as the question (Urdu/Hindi/English).
- 3–6 short sentences. Concrete, factual, no fluff.
- Cite sources inline as [1], [2] matching the numbered list.
- If sources conflict or are insufficient, say so briefly.`;

  const userMsg = `QUESTION: ${query}\n\nSOURCES:\n${context}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: userMsg },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI summary failed [${res.status}]: ${await res.text()}`);
  const json = await res.json();
  return (json?.choices?.[0]?.message?.content ?? "").trim();
}

export const webSearchSummarize = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ query: z.string().trim().min(2).max(400) }).parse(input),
  )
  .handler(async ({ data }): Promise<WebSearchResult> => {
    const fcKey = process.env.FIRECRAWL_API_KEY;
    const aiKey = process.env.LOVABLE_API_KEY;
    if (!fcKey) throw new Error("Web search is not configured (FIRECRAWL_API_KEY missing).");
    if (!aiKey) throw new Error("AI summary is not configured (LOVABLE_API_KEY missing).");

    const items = await firecrawlSearch(data.query, fcKey);
    const sources: WebSource[] = items.slice(0, 5).map((it) => ({
      title: it.title ?? it.url ?? "Untitled",
      url: it.url ?? "",
      snippet: it.description,
    })).filter((s) => s.url);

    if (sources.length === 0) {
      return { query: data.query, summary: "No relevant web results found.", sources: [] };
    }

    const summary = await summarize(data.query, items, aiKey);
    return { query: data.query, summary, sources };
  });
