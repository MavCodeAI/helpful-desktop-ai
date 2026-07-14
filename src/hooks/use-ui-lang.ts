import { useEffect, useState } from "react";
import { loadLang, type LangCode } from "@/lib/persona";

/** Read current UI language; returns { isUrdu, isArabic, lang } and stays live. */
export function useUILang() {
  const [lang, setLang] = useState<LangCode>(() =>
    typeof window === "undefined" ? "auto" : loadLang(),
  );
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "alpha_lang") setLang(loadLang());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return { lang, isUrdu: lang === "ur", isArabic: lang === "ar" };
}
