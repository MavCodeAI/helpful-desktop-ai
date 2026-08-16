import { useEffect, useState } from "react";
import { loadLang, type LangCode } from "@/lib/persona";

/** Read current UI language; only Urdu and English are supported. */
export function useUILang() {
  const [lang, setLang] = useState<LangCode>(() =>
    typeof window === "undefined" ? "ur" : loadLang(),
  );
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "alpha_lang") setLang(loadLang());
    };
    const onLanguageChange = () => setLang(loadLang());
    window.addEventListener("storage", onStorage);
    window.addEventListener("alpha-language-change", onLanguageChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("alpha-language-change", onLanguageChange);
    };
  }, []);
  return { lang, isUrdu: lang === "ur", isArabic: false };
}
