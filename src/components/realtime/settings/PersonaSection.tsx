import { SectionHeader } from "./SectionHeader";
import { useUILang } from "@/hooks/use-ui-lang";
import { PERSONAS, type PersonaId } from "@/lib/persona";

interface Props {
  persona: PersonaId;
  customPrompt: string;
  changePersona: (p: PersonaId) => void;
  changeCustomPrompt: (v: string) => void;
}

const PERSONA_OPTIONS: { id: PersonaId; label: string }[] = [
  { id: "alpha",  label: PERSONAS.alpha.name },
  { id: "jarvis", label: PERSONAS.jarvis.name },
  { id: "friday", label: PERSONAS.friday.name },
  { id: "custom", label: "Custom" },
];

export function PersonaSection({ persona, customPrompt, changePersona, changeCustomPrompt }: Props) {
  const { isUrdu } = useUILang();
  return (
    <section className="space-y-3">
      <SectionHeader>{isUrdu ? "شخصیت" : "Persona"}</SectionHeader>

      <div>
        <div className="text-xs text-white/70 mb-1.5">{isUrdu ? "شخصیت" : "Personality"}</div>
        <div className="grid grid-cols-2 gap-1.5">
          {PERSONA_OPTIONS.map((o) => (
            <button
              key={o.id}
              onClick={() => changePersona(o.id)}
              aria-pressed={persona === o.id}
              className={`px-2.5 py-1.5 rounded-lg text-xs border transition ${
                persona === o.id
                  ? "bg-white/15 text-white border-white/30"
                  : "bg-white/[0.03] text-white/70 border-white/10 hover:bg-white/[0.06]"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {persona === "custom" && (
        <div>
          <div className="text-xs text-white/70 mb-1.5">
            {isUrdu ? "اپنی مرضی کا system prompt" : "Custom system prompt"}
          </div>
          <textarea
            value={customPrompt}
            onChange={(e) => changeCustomPrompt(e.target.value)}
            placeholder="You are ..."
            className="w-full h-24 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-white/90 placeholder:text-white/30 resize-none focus:outline-none focus:border-white/30"
          />
        </div>
      )}
    </section>
  );
}
