import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Plus, Trash2, Brain } from "lucide-react";
import { useUILang } from "@/hooks/use-ui-lang";

interface Props {
  memories: string[];
  addMemory: (t: string) => void;
  removeMemory: (i: number) => void;
  clearMemories: () => void;
  onCloseDrawer: () => void;
}

export function MemorySection({ memories, addMemory, removeMemory, clearMemories, onCloseDrawer }: Props) {
  const { isUrdu } = useUILang();
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");

  return (
    <section>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-white/60 hover:text-white/80 font-semibold mb-2.5"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5" aria-hidden />
          {isUrdu ? `یاداشت (${memories.length}/25)` : `Memory (${memories.length}/25)`}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div className="space-y-2">
          <p className="text-[11px] text-white/50 leading-relaxed">
            {isUrdu
              ? "وہ باتیں جو Alpha سیشن کے بیچ یاد رکھتا ہے۔"
              : "Facts Alpha remembers across sessions."}
          </p>
          <Link
            to="/memories"
            onClick={onCloseDrawer}
            className="inline-block text-[11px] text-cyan-300/90 hover:text-cyan-200 underline underline-offset-2 rounded"
          >
            {isUrdu ? "مکمل یاداشت مینیجر کھولیں ←" : "Open full memory manager →"}
          </Link>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const t = input.trim();
              if (t.length < 2) return;
              addMemory(t);
              setInput("");
            }}
            className="flex gap-1.5"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isUrdu ? "مثلاً: مجھے اردو میں جواب پسند ہیں" : "e.g. I prefer answers in Urdu"}
              maxLength={300}
              className="flex-1 bg-white/5 border border-white/10 rounded-md px-2.5 py-2 text-xs text-white/90 placeholder:text-white/50 focus:outline-none focus:border-cyan-400/60"
            />
            <button
              type="submit"
              disabled={input.trim().length < 2}
              aria-label={isUrdu ? "یاد شامل" : "Add memory"}
              className="shrink-0 px-2.5 rounded-md bg-cyan-400/20 hover:bg-cyan-400/30 text-cyan-100 disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </form>
          <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
            {memories.length === 0 && (
              <div className="text-[11px] text-white/60 italic py-2">
                {isUrdu
                  ? 'کہیں "یاد رکھو ..." اور Alpha خود سیکھ لے گا۔'
                  : "Say \"remember that ...\" and Alpha will save it."}
              </div>
            )}
            {memories.map((m, i) => (
              <div
                key={`${i}-${m.slice(0, 12)}`}
                className="group flex items-start gap-2 text-[11px] text-white/80 bg-white/5 border border-white/5 rounded-md px-2.5 py-1.5"
              >
                <span className="flex-1 leading-snug break-words">{m}</span>
                <button
                  onClick={() => removeMemory(i)}
                  className="shrink-0 opacity-40 group-hover:opacity-100 hover:text-red-300 transition rounded"
                  aria-label={isUrdu ? "حذف" : "Delete"}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          {memories.length > 0 && (
            <button
              onClick={clearMemories}
              className="w-full mt-1 text-[11px] px-3 py-1.5 rounded-md border border-red-400/20 bg-red-500/5 text-red-200/80 hover:bg-red-500/10 transition"
            >
              {isUrdu ? "سب کچھ بھول جائیں" : "Forget everything"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
