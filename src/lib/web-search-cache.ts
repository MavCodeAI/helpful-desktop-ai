// Small in-memory TTL cache for web search results.
// Client-side only — survives across renders within a session, cleared on reload.
// Keeps repeated queries from hammering the backend.

import { webSearchSummarize, type WebSearchResult } from "@/lib/web-search.functions";

const DEFAULT_TTL_MS = 5 * 60_000; // 5 minutes
const MAX_ENTRIES = 40;

type Entry = { at: number; result: WebSearchResult };

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<WebSearchResult>>();

function normKey(q: string): string {
  return q.toLowerCase().replace(/\s+/g, " ").trim();
}

function evictIfNeeded() {
  if (cache.size <= MAX_ENTRIES) return;
  let oldestKey: string | null = null;
  let oldestAt = Infinity;
  for (const [k, v] of cache) {
    if (v.at < oldestAt) {
      oldestAt = v.at;
      oldestKey = k;
    }
  }
  if (oldestKey) cache.delete(oldestKey);
}

export function readCachedWebSearch(
  query: string,
  ttlMs = DEFAULT_TTL_MS,
): WebSearchResult | null {
  const key = normKey(query);
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttlMs) {
    cache.delete(key);
    return null;
  }
  return hit.result;
}

/**
 * Cache-aware wrapper. Coalesces concurrent identical calls into one request,
 * caches successful results for `ttlMs`, and never caches empty-source results
 * (so a failed pull is retried on the next ask).
 */
export async function cachedWebSearch(
  query: string,
  ttlMs = DEFAULT_TTL_MS,
): Promise<WebSearchResult> {
  const key = normKey(query);
  const cached = readCachedWebSearch(query, ttlMs);
  if (cached) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  const p = (async () => {
    try {
      const result = await webSearchSummarize({ data: { query } });
      if (result.sources.length > 0) {
        cache.set(key, { at: Date.now(), result });
        evictIfNeeded();
      }
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
