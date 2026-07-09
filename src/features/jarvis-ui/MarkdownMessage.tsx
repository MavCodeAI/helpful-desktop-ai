/**
 * Lazy markdown renderer.
 *
 * `react-markdown` + `remark-gfm` + their `mdast`/`micromark`/`hast` trees
 * add ~180 KB (raw) to any chunk that imports them at module scope.
 * Wrapping in `React.lazy` moves that weight into a separate chunk that
 * loads on demand — the first assistant/user bubble that renders markdown
 * pays the cost once, then it's cached in the module graph.
 *
 * Fallback is intentionally the raw string wrapped in `<span>` so partial
 * streams (`{partial || rtAsstPartial}`) still show *something* immediately
 * while the chunk resolves; once loaded, ReactMarkdown re-renders with
 * proper formatting. No layout jump because the parent bubble owns the
 * typographic styles (via `[&_p]:my-1` etc.).
 */
import { lazy, Suspense } from "react";

const ReactMarkdown = lazy(() => import("react-markdown"));
// remark-gfm is loaded eagerly inside the same lazy chunk boundary via
// a top-level dynamic import so both land in the same async graph node.
const remarkGfmPromise = import("remark-gfm").then((m) => m.default);

// Cache the resolved plugin so every message reuses the same array reference
// — ReactMarkdown treats a new `remarkPlugins` array as a config change and
// re-parses; keeping the reference stable lets memoization kick in.
let cachedPlugins: unknown[] | null = null;
function usePlugins(): unknown[] | null {
  if (cachedPlugins) return cachedPlugins;
  // Fire-and-remember — resolves in the same microtask as the lazy chunk.
  void remarkGfmPromise.then((p) => {
    cachedPlugins = [p];
  });
  return cachedPlugins;
}

/**
 * Idle-prefetch the markdown chunk once, so the first assistant bubble
 * doesn't wait on the network. We fire from `requestIdleCallback` (or a
 * short `setTimeout` fallback in browsers without it) so we never
 * contend with the initial paint / hydration burst on `/jarvis`. Idle
 * usually fires within a few hundred ms — well before any LLM round-trip
 * finishes, so by the time the first response streams in, the chunk is
 * already in the module cache and `<Suspense>` never shows its fallback.
 */
let prefetched = false;
export function prefetchMarkdown(): void {
  if (prefetched || typeof window === "undefined") return;
  prefetched = true;
  const run = () => {
    void import("react-markdown");
    void remarkGfmPromise;
  };
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void })
    .requestIdleCallback;
  if (ric) ric(run);
  else setTimeout(run, 250);
}

export function MarkdownMessage({ children }: { children: string }) {
  const plugins = usePlugins();
  return (
    <Suspense fallback={<span>{children}</span>}>
      {/* Casting: remark plugins are typed as PluggableList but lazy import
          erases the narrow type. Runtime behavior is unchanged. */}
      <ReactMarkdown remarkPlugins={plugins as never}>{children}</ReactMarkdown>
    </Suspense>
  );
}
