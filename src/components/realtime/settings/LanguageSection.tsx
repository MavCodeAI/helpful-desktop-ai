import { SectionHeader } from "./SectionHeader";
import { useUILang } from "@/hooks/use-ui-lang";
import type { LangCode } from "@/lib/persona";

interface Props {
  lang: LangCode;
  changeLang: (l: LangCode) => void;
}

const LANGS: { id: LangCode; labelEn: string; labelUr: string }[] = [
  { id: "auto", labelEn: "Auto", labelUr: "خودکار" },
  { id: "en", labelEn: "English", labelUr: "English" },
  { id: "ur", labelEn: "اردو", labelUr: "اردو" },
  { id: "ar", labelEn: "العربية", labelUr: "العربية" },
];

export function LanguageSection({ lang, changeLang }: Props) {
  const { isUrdu } = useUILang();
  return (
    <section>
      <SectionHeader>{isUrdu ? "زبان (جواب)" : "Language (reply)"}</SectionHeader>
      <div className="grid grid-cols-4 gap-1.5">
        {LANGS.map((l) => (
          <button
            key={l.id}
            onClick={() => changeLang(l.id)}
            aria-pressed={lang === l.id}
            className={`px-2 py-2 rounded-md text-xs border transition min-h-11 ${
              lang === l.id
                ? "bg-white/15 text-white border-white/30"
                : "bg-white/[0.03] text-white/70 border-white/10 hover:bg-white/[0.06]"
            }`}
          >
            {isUrdu ? l.labelUr : l.labelEn}
          </button>
        ))}
      </div>
    </section>
  );
}
