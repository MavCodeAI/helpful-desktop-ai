import { useEffect, useState } from "react";
import { X, Plus, Keyboard, RotateCcw } from "lucide-react";
import {
  formatHotkey, loadHotkey, saveHotkey, DEFAULT_HOTKEY,
  loadWakePhrases, saveWakePhrases, DEFAULT_WAKE_PHRASES,
  type HotkeyCombo,
} from "@/lib/realtime/constants";

interface Props {
  wakeClap: boolean;
  wakeWord: boolean;
  wakeHotkey: boolean;
  toggleClap: (v: boolean) => void;
  toggleWord: (v: boolean) => void;
  toggleHotkey: (v: boolean) => void;
}

function Row({
  title, sub, checked, onChange,
}: { title: string; sub: React.ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="glass-item flex items-center justify-between gap-3 px-3 py-2 rounded-md cursor-pointer">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-white/90">{title}</div>
        <div className="text-[10px] text-white/60 mt-0.5">{sub}</div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="shrink-0 h-4 w-4 accent-cyan-400"
      />
    </label>
  );
}

function HotkeyRecorder({ combo, onSave }: { combo: HotkeyCombo; onSave: (c: HotkeyCombo) => void }) {
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Ignore lone modifier presses
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;
      const next: HotkeyCombo = {
        ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey,
        key: e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase(),
      };
      // Require at least one modifier to avoid accidental triggers
      if (!next.ctrl && !next.shift && !next.alt && !next.meta) return;
      onSave(next);
      setRecording(false);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [recording, onSave]);

  return (
    <div className="glass-item rounded-md px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-xs font-semibold text-white/90 flex items-center gap-1.5">
          <Keyboard className="w-3.5 h-3.5" /> Hotkey combo
        </div>
        <button
          onClick={() => { onSave(DEFAULT_HOTKEY); }}
          className="text-[10px] text-white/50 hover:text-white/80 flex items-center gap-1"
          title="Reset to default"
        >
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-md bg-black/30 border border-white/10 px-3 py-2 font-mono text-sm text-cyan-200 text-center tabular-nums">
          {recording ? <span className="text-amber-300 animate-pulse">Press keys…</span> : formatHotkey(combo)}
        </div>
        <button
          onClick={() => setRecording((v) => !v)}
          className={`shrink-0 px-3 py-2 rounded-md text-xs border transition ${
            recording
              ? "bg-amber-400/20 border-amber-400/40 text-amber-100"
              : "bg-cyan-400/15 border-cyan-400/40 text-cyan-100 hover:bg-cyan-400/25"
          }`}
        >
          {recording ? "Cancel" : "Record"}
        </button>
      </div>
      <div className="text-[10px] text-white/50 mt-1.5">Include at least one modifier (Ctrl/Shift/Alt/Cmd).</div>
    </div>
  );
}

function WakePhrasesEditor({
  phrases, onSave,
}: { phrases: string[]; onSave: (p: string[]) => void }) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const t = draft.trim().toLowerCase();
    if (t.length < 2) return;
    if (phrases.some((p) => p.toLowerCase() === t)) { setDraft(""); return; }
    onSave([...phrases, t]);
    setDraft("");
  };

  const remove = (i: number) => onSave(phrases.filter((_, idx) => idx !== i));
  const resetDefaults = () => onSave([...DEFAULT_WAKE_PHRASES]);

  return (
    <div className="glass-item rounded-md px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-xs font-semibold text-white/90">Wake phrases</div>
        <button
          onClick={resetDefaults}
          className="text-[10px] text-white/50 hover:text-white/80 flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {phrases.length === 0 ? (
          <div className="text-[10px] text-white/45">No phrases — add one below.</div>
        ) : phrases.map((p, i) => (
          <span
            key={`${i}-${p}`}
            className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 border border-violet-400/30 px-2 py-0.5 text-[11px] text-violet-100"
          >
            {p}
            <button
              onClick={() => remove(i)}
              className="opacity-70 hover:opacity-100 hover:text-red-300"
              aria-label={`Remove ${p}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="e.g. hey jarvis"
          className="flex-1 rounded-md bg-black/30 border border-white/10 px-2.5 py-1.5 text-xs text-white placeholder:text-white/35 focus:outline-none focus:border-cyan-400/40"
        />
        <button
          onClick={add}
          disabled={draft.trim().length < 2}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-cyan-400/20 border border-cyan-400/40 text-cyan-100 text-xs hover:bg-cyan-400/30 disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
      <div className="text-[10px] text-white/50 mt-1.5">Case-insensitive substring match against the recognizer transcript.</div>
    </div>
  );
}

export function TriggersSection({
  wakeClap, wakeWord, wakeHotkey, toggleClap, toggleWord, toggleHotkey,
}: Props) {
  const [combo, setCombo] = useState<HotkeyCombo>(DEFAULT_HOTKEY);
  const [phrases, setPhrases] = useState<string[]>([]);

  useEffect(() => {
    setCombo(loadHotkey());
    setPhrases(loadWakePhrases());
  }, []);

  const updateCombo = (c: HotkeyCombo) => { setCombo(c); saveHotkey(c); };
  const updatePhrases = (p: string[]) => { setPhrases(p); saveWakePhrases(p); };

  return (
    <section>
      <h3 className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/80 font-semibold mb-2">
        Wake Triggers
      </h3>
      <div className="space-y-1.5">
        <Row
          title="Hotkey"
          sub={<>Press <span className="text-cyan-300 font-mono">{formatHotkey(combo)}</span> to start</>}
          checked={wakeHotkey}
          onChange={toggleHotkey}
        />
        <Row
          title="Clap to wake"
          sub="Two claps within 1.5 s · uses mic"
          checked={wakeClap}
          onChange={toggleClap}
        />
        <Row
          title="Wake word"
          sub="Chrome / Edge only · always-on mic"
          checked={wakeWord}
          onChange={toggleWord}
        />
      </div>

      {wakeHotkey && (
        <div className="mt-3">
          <HotkeyRecorder combo={combo} onSave={updateCombo} />
        </div>
      )}
      {wakeWord && (
        <div className="mt-3">
          <WakePhrasesEditor phrases={phrases} onSave={updatePhrases} />
        </div>
      )}

      {(wakeClap || wakeWord) && (
        <p className="text-[10px] text-amber-300/70 mt-2 leading-relaxed">
          Mic stays open in the background while enabled. Disable to release it.
        </p>
      )}
    </section>
  );
}
