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

// Resolve react-markdown AND remark-gfm together inside the same lazy chunk.
// Previous approach kept plugins in a module-level variable that was `null`
// on first render and updated by a fire-and-forget `.then()` — but that
// mutation never triggered a React re-render, so the first bubble rendered
// without GFM (no tables, strikethrough, task lists). Awaiting both here
// means Suspense holds the fallback until both are ready, and the resolved
// module reference is stable for every subsequent bubble.
const MarkdownWithGfm = lazy(async () => {
  const [{ default: ReactMarkdown }, { default: remarkGfm }] = await Promise.all([
    import("react-markdown"),
    import("remark-gfm"),
  ]);
  const plugins = [remarkGfm];
  return {
    default: function MarkdownInner({ children }: { children: string }) {
      return <ReactMarkdown remarkPlugins={plugins}>{children}</ReactMarkdown>;
    },
  };
});

/**
 * Idle-prefetch the markdown chunk once, so the first assistant bubble
 * doesn't wait on the network. Fires from `requestIdleCallback` (or a
 * short `setTimeout` fallback) to avoid contending with initial paint.
 */
let prefetched = false;
export function prefetchMarkdown(): void {
  if (prefetched || typeof window === "undefined") return;
  prefetched = true;
  const run = () => {
    void import("react-markdown");
    void import("remark-gfm");
  };
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void })
    .requestIdleCallback;
  if (ric) ric(run);
  else setTimeout(run, 250);
}

export function MarkdownMessage({ children }: { children: string }) {
  return (
    <Suspense fallback={<span>{children}</span>}>
      <MarkdownWithGfm>{children}</MarkdownWithGfm>
    </Suspense>
  );
}
