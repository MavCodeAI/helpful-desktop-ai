import { useState } from "react";
import { Trash2 } from "lucide-react";
import { PERSONAS, type PersonaId, type LangCode } from "@/lib/persona";

interface Props {
  persona: PersonaId;
  customPrompt: string;
  lang: LangCode;
  memories: string[];
  changePersona: (p: PersonaId) => void;
  changeCustomPrompt: (v: string) => void;
  changeLang: (l: LangCode) => void;
  addMemory: (t: string) => void;
  removeMemory: (i: number) => void;
  clearMemories: () => void;
}

const LANGS: { id: LangCode; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "en", label: "English" },
  { id: "ur", label: "اردو" },
  { id: "ar", label: "العربية" },
];

const PERSONA_OPTIONS: { id: PersonaId; label: string }[] = [
  { id: "alpha",  label: PERSONAS.alpha.name },
  { id: "jarvis", label: PERSONAS.jarvis.name },
  { id: "friday", label: PERSONAS.friday.name },
  { id: "custom", label: "Custom" },
];

export function PersonaSection(p: Props) {
  const [draft, setDraft] = useState("");

  const addDraft = () => {
    const t = draft.trim();
    if (!t) return;
    p.addMemory(t);
    setDraft("");
  };

  return (
    <section className="space-y-3">
      <h3 className="text-[10px] uppercase tracking-widest text-white/50">Persona & Memory</h3>

      {/* Persona picker */}
      <div>
        <div className="text-xs text-white/70 mb-1.5">Personality</div>
        <div className="grid grid-cols-2 gap-1.5">
          {PERSONA_OPTIONS.map((o) => (
            <button
              key={o.id}
              onClick={() => p.changePersona(o.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs border transition ${
                p.persona === o.id
                  ? "bg-white/15 text-white border-white/30"
                  : "bg-white/[0.03] text-white/70 border-white/10 hover:bg-white/[0.06]"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom prompt */}
      {p.persona === "custom" && (
        <div>
          <div className="text-xs text-white/70 mb-1.5">Custom system prompt</div>
          <textarea
            value={p.customPrompt}
            onChange={(e) => p.changeCustomPrompt(e.target.value)}
            placeholder="You are ..."
            className="w-full h-24 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-white/90 placeholder:text-white/30 resize-none focus:outline-none focus:border-white/30"
          />
        </div>
      )}

      {/* Language */}
      <div>
        <div className="text-xs text-white/70 mb-1.5">Reply language</div>
        <div className="grid grid-cols-4 gap-1.5">
          {LANGS.map((l) => (
            <button
              key={l.id}
              onClick={() => p.changeLang(l.id)}
              className={`px-2 py-1.5 rounded-lg text-xs border transition ${
                p.lang === l.id
                  ? "bg-white/15 text-white border-white/30"
                  : "bg-white/[0.03] text-white/70 border-white/10 hover:bg-white/[0.06]"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Memories */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-xs text-white/70">
            Long-term memories <span className="text-white/40">({p.memories.length}/25)</span>
          </div>
          {p.memories.length > 0 && (
            <button
              onClick={p.clearMemories}
              className="text-[10px] uppercase tracking-widest text-white/50 hover:text-white/80"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex gap-1.5 mb-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addDraft()}
            placeholder="I live in Karachi, I love coffee…"
            className="flex-1 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-white/90 placeholder:text-white/30 focus:outline-none focus:border-white/30"
          />
          <button
            onClick={addDraft}
            disabled={!draft.trim()}
            className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white/90 disabled:opacity-40"
          >
            Add
          </button>
        </div>
        {p.memories.length === 0 ? (
          <div className="text-[11px] text-white/40 italic">
            Say "remember that ..." to auto-save.
          </div>
        ) : (
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {p.memories.map((m, i) => (
              <li
                key={`${i}-${m.slice(0, 12)}`}
                className="flex items-start gap-1.5 px-2 py-1.5 rounded bg-white/[0.03] border border-white/[0.06] text-[11px] text-white/80"
              >
                <span className="flex-1 min-w-0 break-words">{m}</span>
                <button
                  onClick={() => p.removeMemory(i)}
                  className="shrink-0 text-white/40 hover:text-white/80"
                  aria-label="Remove"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
