import { SectionHeader } from "./SectionHeader";
import { useUILang } from "@/hooks/use-ui-lang";
import { SUPPORTED_LANGUAGES, type LangCode } from "@/lib/persona";

interface Props {
  lang: LangCode;
  changeLang: (l: LangCode) => void;
}

export function LanguageSection({ lang, changeLang }: Props) {
  const { isUrdu, isArabic } = useUILang();
  const heading = isUrdu ? "زبان (جواب)" : isArabic ? "لغة الرد" : "Reply language";
  return (
    <section>
      <SectionHeader>{heading}</SectionHeader>
      <div className="grid grid-cols-4 gap-1.5">
        {SUPPORTED_LANGUAGES.map((language) => (
          <button
            key={language.code}
            onClick={() => changeLang(language.code)}
            aria-pressed={lang === language.code}
            title={language.label}
            className={`px-2 py-2 rounded-md text-xs border transition min-h-11 ${
              lang === language.code
                ? "bg-white/15 text-white border-white/30"
                : "bg-white/[0.03] text-white/70 border-white/10 hover:bg-white/[0.06]"
            }`}
          >
            {isUrdu || isArabic ? language.nativeLabel : language.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-white/50">
        {isUrdu
          ? "خودکار موڈ میں Alpha صارف کی بولی ہوئی زبان میں جواب دے گا۔"
          : isArabic
            ? "في الوضع التلقائي، يجيب Alpha بلغة المستخدم."
            : "Auto-detect follows the language spoken by the user."}
      </p>
    </section>
  );
}
