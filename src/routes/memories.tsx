import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useUILang } from "@/hooks/use-ui-lang";
import { ArrowLeft, Trash2, Plus, Brain } from "lucide-react";
import {
  loadMemories, addMemory, removeMemory, clearMemories,
} from "@/lib/persona";

export const Route = createFileRoute("/memories")({
  component: MemoriesPage,
  head: () => ({
    meta: [
      { title: "Memory Manager · Alpha" },
      { name: "description", content: "View and delete facts Alpha remembers about you." },
    ],
  }),
});

function MemoriesPage() {
  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("");
  const { isUrdu } = useUILang();

  const refresh = () => setItems(loadMemories());
  useEffect(() => { refresh(); }, []);

  const onAdd = () => {
    const t = draft.trim();
    if (!t) return;
    addMemory(t);
    setDraft("");
    refresh();
  };

  const onRemove = (i: number) => { removeMemory(i); refresh(); };
  const onClear = () => {
    if (items.length === 0) return;
    if (confirm(isUrdu ? `${items.length} یادداشتیں حذف کر دیں؟ یہ واپس نہیں ہو سکتا۔` : `Delete all ${items.length} memories? This can't be undone.`)) {
      clearMemories();
      refresh();
    }
  };

  const filtered = filter.trim()
    ? items.map((t, i) => ({ t, i })).filter(({ t }) => t.toLowerCase().includes(filter.toLowerCase()))
    : items.map((t, i) => ({ t, i }));

  return (
    <main
      dir={isUrdu ? "rtl" : "ltr"}
      className="relative min-h-dvh text-white/90"
      style={{
        background:
          "radial-gradient(ellipse at top, oklch(0.18 0.05 260) 0%, oklch(0.09 0.02 240) 60%)",
      }}
    >
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-6 sm:py-10">
        <header className="flex items-center justify-between gap-3 mb-6">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-1.5 text-xs text-white/70 hover:text-white transition touch-manipulation"
          >
            <ArrowLeft className="w-4 h-4 rtl:scale-x-[-1]" /> {isUrdu ? "واپس" : "Back"}
          </Link>
          <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-300/80">
            {items.length}/25 {isUrdu ? "محفوظ" : "stored"}
          </div>
        </header>

        <div className="flex items-center gap-2.5 mb-2">
          <Brain className="w-5 h-5 text-violet-300" />
          <h1 className="text-xl sm:text-2xl font-semibold">{isUrdu ? "یادداشتیں" : "Memory Manager"}</h1>
        </div>
        <p className="text-xs sm:text-sm text-white/60 mb-6">
          {isUrdu ? "Alpha کی محفوظ یادداشتیں — یہ ڈیٹا صرف اسی browser میں local رہتا ہے۔" : <>Facts Alpha remembers about you — saved via <span className="text-white/80">“yaad rakho”</span> or auto-extracted from chats. Fully local to this browser.</>}
        </p>

        {/* Add new */}
        <div className="glass-card rounded-xl p-3 sm:p-4 mb-4">
          <div className="text-[10px] uppercase tracking-widest text-white/60 mb-2">{isUrdu ? "یادداشت شامل کریں" : "Add a memory"}</div>
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onAdd(); }}
              placeholder={isUrdu ? "مثلاً مجھے مختصر اردو جواب پسند ہیں" : "e.g. I prefer concise answers in Urdu"}
              className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-cyan-400/40"
            />
            <button
              onClick={onAdd}
              disabled={!draft.trim()}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-cyan-400/20 border border-cyan-400/40 text-cyan-100 px-3 py-2 text-sm hover:bg-cyan-400/30 disabled:opacity-40 touch-manipulation"
            >
              <Plus className="w-4 h-4" /> {isUrdu ? "شامل کریں" : "Add"}
            </button>
          </div>
        </div>

        {/* Filter + clear */}
        {items.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={isUrdu ? "یادداشتیں تلاش کریں…" : "Search memories…"}
              className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/35 focus:outline-none focus:border-cyan-400/40"
            />
            <button
              onClick={onClear}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-red-500/10 border border-red-400/30 text-red-200 px-3 py-2 text-xs hover:bg-red-500/20 touch-manipulation"
            >
              <Trash2 className="w-3.5 h-3.5" /> {isUrdu ? "سب صاف کریں" : "Clear all"}
            </button>
          </div>
        )}

        {/* List */}
        {items.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <Brain className="w-8 h-8 mx-auto mb-2 text-white/30" />
            <div className="text-sm text-white/60">{isUrdu ? "ابھی کوئی یادداشت نہیں۔" : "No memories yet."}</div>
            <div className="text-xs text-white/40 mt-1">
              {isUrdu ? <>گفتگو میں <span className="text-white/70">“یاد رکھو …”</span> کہیں، یا اوپر نئی یادداشت شامل کریں۔</> : <>Say <span className="text-white/70">“yaad rakho …”</span> during a chat, or add one above.</>}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-xs text-white/50 text-center py-8">{isUrdu ? "کوئی نتیجہ نہیں ملا۔" : "No matches."}</div>
        ) : (
          <ul className="space-y-2">
            {filtered.map(({ t, i }) => (
              <li
                key={`${i}-${t}`}
                className="glass-item flex items-start gap-3 p-3 rounded-lg group"
              >
                <div className="mt-0.5 text-[10px] font-mono text-violet-300/70 min-w-[24px]">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="flex-1 text-sm text-white/90 break-words">{t}</div>
                <button
                  onClick={() => onRemove(i)}
                  className="min-h-10 min-w-10 inline-flex items-center justify-center opacity-60 hover:opacity-100 hover:text-red-300 transition shrink-0 touch-manipulation"
                  aria-label={isUrdu ? `یادداشت ${i + 1} حذف کریں` : `Delete memory ${i + 1}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
