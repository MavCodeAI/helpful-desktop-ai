// Client-side only — survives across renders within a session, cleared on reload.
// Keeps repeated queries from hammering the backend without mixing market/language contexts.

import { webSearchSummarize, type WebSearchResult } from "@/lib/web-search.functions";
import type { CountryCode } from "@/lib/locale";
import type { LangCode } from "@/lib/persona";

const DEFAULT_TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 40;

type Entry = { at: number; result: WebSearchResult };
export type WebSearchContext = { country?: CountryCode; lang?: LangCode; geminiKey?: string; tavilyKey?: string };

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<WebSearchResult>>();

function normalizedContext(context: WebSearchContext = {}): Required<WebSearchContext> {
  return { country: context.country ?? "SA", lang: context.lang ?? "auto", geminiKey: context.geminiKey ?? "", tavilyKey: context.tavilyKey ?? "" };
}

function normKey(q: string, context: WebSearchContext = {}): string {
  const ctx = normalizedContext(context);
  return `${ctx.country}:${ctx.lang}:${ctx.tavilyKey ? "tavily" : "server-search"}:${q.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

function evictIfNeeded() {
  if (cache.size <= MAX_ENTRIES) return;
  let oldestKey: string | null = null;
  let oldestAt = Infinity;
  for (const [key, value] of cache) {
    if (value.at < oldestAt) { oldestAt = value.at; oldestKey = key; }
  }
  if (oldestKey) cache.delete(oldestKey);
}

export function readCachedWebSearch(query: string, ttlMs = DEFAULT_TTL_MS, context: WebSearchContext = {}): WebSearchResult | null {
  const key = normKey(query, context);
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttlMs) { cache.delete(key); return null; }
  return hit.result;
}

export async function cachedWebSearch(query: string, ttlMs = DEFAULT_TTL_MS, context: WebSearchContext = {}): Promise<WebSearchResult> {
  const ctx = normalizedContext(context);
  const key = normKey(query, ctx);
  const cached = readCachedWebSearch(query, ttlMs, ctx);
  if (cached) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  const p = (async () => {
    try {
      const result = await webSearchSummarize({ data: { query, country: ctx.country, lang: ctx.lang, userKey: ctx.geminiKey || undefined, tavilyKey: ctx.tavilyKey || undefined } });
      if (result.sources.length > 0) { cache.set(key, { at: Date.now(), result }); evictIfNeeded(); }
      return result;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

export function clearWebSearchCache() {
  cache.clear();
  inflight.clear();
}
