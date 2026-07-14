import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { KeyRound, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { useUILang } from "@/hooks/use-ui-lang";

const GEMINI_KEY_LS = "gemini_api_key";

export function ApiKeysSection() {
  const { isUrdu } = useUILang();
  const [hasKey, setHasKey] = useState(false);
  const [masked, setMasked] = useState("");

  useEffect(() => {
    const read = () => {
      try {
        const k = window.localStorage.getItem(GEMINI_KEY_LS) ?? "";
        setHasKey(!!k);
        setMasked(k ? `${k.slice(0, 4)}••••${k.slice(-4)}` : "");
      } catch { setHasKey(false); setMasked(""); }
    };
    read();
    const onStorage = (e: StorageEvent) => { if (e.key === GEMINI_KEY_LS) read(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <section>
      <SectionHeader>{isUrdu ? "API کیز" : "API keys"}</SectionHeader>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <KeyRound className="w-3.5 h-3.5 text-cyan-300/80 shrink-0" />
          <span className="text-xs text-white/85 font-medium">Gemini</span>
          {hasKey ? (
            <span className="ms-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-emerald-300/90">
              <CheckCircle2 className="w-3 h-3" />
              {isUrdu ? "محفوظ" : "Saved"}
            </span>
          ) : (
            <span className="ms-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-amber-300/90">
              <AlertCircle className="w-3 h-3" />
              {isUrdu ? "غائب" : "Missing"}
            </span>
          )}
        </div>
        {hasKey && (
          <div className="font-mono text-[11px] text-white/55 tracking-wider select-all">{masked}</div>
        )}
        <Link
          to="/api-settings"
          className="w-full inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white/90"
        >
          <span>{hasKey ? (isUrdu ? "کیز اور ماڈلز منظم کریں" : "Manage keys & test models") : (isUrdu ? "API کی شامل کریں" : "Add API key")}</span>
          <ExternalLink className="w-3 h-3" aria-hidden />
        </Link>
        <p className="text-[10px] leading-relaxed text-white/50">
          {isUrdu
            ? "کیز صرف اس براؤزر میں رہتی ہیں (localStorage)۔"
            : "Keys stay in this browser (localStorage)."}
        </p>
      </div>
    </section>
  );
}
