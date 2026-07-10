import { HOTKEY_LABEL } from "@/lib/realtime/constants";

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
}: { title: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
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

export function TriggersSection({
  wakeClap, wakeWord, wakeHotkey, toggleClap, toggleWord, toggleHotkey,
}: Props) {
  return (
    <section>
      <h3 className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/80 font-semibold mb-2">
        Wake Triggers
      </h3>
      <div className="space-y-1.5">
        <Row
          title="Hotkey"
          sub={`Press ${HOTKEY_LABEL} to start`}
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
          title='Wake word "Hey Alpha"'
          sub="Chrome / Edge only · always-on mic"
          checked={wakeWord}
          onChange={toggleWord}
        />
      </div>
      {(wakeClap || wakeWord) && (
        <p className="text-[10px] text-amber-300/70 mt-2 leading-relaxed">
          Mic stays open in the background while enabled. Disable to release it.
        </p>
      )}
    </section>
  );
}
