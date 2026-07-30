import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Trash2, Plus, Radar, RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useWatchlist } from "@/lib/utilities/watchlist";
import { webSearchSummarize } from "@/lib/web-search.functions";

export const Route = createFileRoute("/watch")({
  component: WatchPage,
  head: () => ({
    meta: [
      { title: "Watchlist · Alpha" },
      { name: "description", content: "Topics Alpha keeps an eye on — refresh to get an AI summary of what changed." },
      { property: "og:title", content: "Watchlist · Alpha" },
      { property: "og:description", content: "Track topics and get AI summaries of what changed, on demand." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function timeAgo(ts: number | null) {
  if (!ts) return "never checked";
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function WatchPage() {
  const { watches, add, remove, clear, applyCheck, markSeen } = useWatchlist();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const onAdd = () => {
    const t = draft.trim();
    if (!t) return;
    if (!add(t)) { toast.info("Ye topic pehle se watchlist me hai."); return; }
    setDraft("");
  };

  const check = async (id: string, topic: string) => {
    setBusy(id);
    try {
      const res = await webSearchSummarize({ data: { query: `Latest updates: ${topic}` } });
      applyCheck(id, res.summary, res.sources.map((s) => ({ title: s.title, url: s.url })));
      toast.success(`Updated — ${topic}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Check failed");
    } finally {
      setBusy(null);
    }
  };

  const checkAll = async () => {
    for (const w of watches) await check(w.id, w.topic);
  };

  return (
    <main
      className="relative min-h-dvh text-white/90"
      style={{
        background:
          "radial-gradient(ellipse at top, oklch(0.18 0.05 260) 0%, oklch(0.09 0.02 240) 60%)",
      }}
    >
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-6 sm:py-10">
        <header className="flex items-center justify-between gap-3 mb-6">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-300/80">
            {watches.length}/50 topics
          </div>
        </header>

        <div className="flex items-center gap-2.5 mb-2">
          <Radar className="w-5 h-5 text-cyan-300" />
          <h1 className="text-xl sm:text-2xl font-semibold">Watchlist</h1>
        </div>
        <p className="text-xs sm:text-sm text-white/60 mb-6">
          Topics Alpha watches for you. Tap refresh to pull a fresh AI summary from the web — changes are flagged.
        </p>

        <div className="glass-card rounded-xl p-3 sm:p-4 mb-4">
          <div className="text-[10px] uppercase tracking-widest text-white/60 mb-2">Add a topic</div>
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onAdd(); }}
              placeholder="e.g. OpenAI model releases"
              className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-cyan-400/40"
            />
            <button
              onClick={onAdd}
              disabled={!draft.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-cyan-400/20 border border-cyan-400/40 text-cyan-100 px-3 py-2 text-sm hover:bg-cyan-400/30 disabled:opacity-40"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>

        {watches.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={checkAll}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs hover:border-cyan-400/40 disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} /> Check all
            </button>
            <div className="flex-1" />
            <button
              onClick={() => { if (confirm(`Remove all ${watches.length} topics?`)) clear(); }}
              className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 border border-red-400/30 text-red-200 px-2.5 py-2 text-xs hover:bg-red-500/20"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear all
            </button>
          </div>
        )}

        {watches.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <Radar className="w-8 h-8 mx-auto mb-2 text-white/30" />
            <div className="text-sm text-white/60">No topics yet.</div>
            <div className="text-xs text-white/40 mt-1">Add something you want Alpha to keep an eye on.</div>
          </div>
        ) : (
          <ul className="space-y-3">
            {watches.map((w) => (
              <li key={w.id} className="glass-card rounded-xl p-3 sm:p-4">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-sm font-medium">{w.topic}</h2>
                      {w.changed && (
                        <span className="shrink-0 rounded-full border border-amber-400/40 bg-amber-400/20 px-1.5 text-[10px] font-semibold text-amber-100">
                          NEW
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-white/45">{timeAgo(w.checkedAt)}</div>
                  </div>
                  <button
                    onClick={() => check(w.id, w.topic)}
                    disabled={busy !== null}
                    className="shrink-0 grid h-8 w-8 place-items-center rounded-full border border-white/10 hover:border-cyan-400/40 disabled:opacity-40"
                    aria-label={`Refresh ${w.topic}`}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${busy === w.id ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    onClick={() => remove(w.id)}
                    className="shrink-0 grid h-8 w-8 place-items-center rounded-full border border-white/10 text-red-200/80 hover:border-red-400/40"
                    aria-label={`Remove ${w.topic}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {w.summary && (
                  <div className="mt-3" onMouseEnter={() => w.changed && markSeen(w.id)}>
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/80">{w.summary}</p>
                    {w.sources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {w.sources.map((s) => (
                          <a
                            key={s.url}
                            href={s.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-cyan-200 hover:border-cyan-400/40"
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            <span className="truncate">{s.title || s.url}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
