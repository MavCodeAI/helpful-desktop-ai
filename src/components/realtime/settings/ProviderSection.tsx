import { AlertCircle, CheckCircle2, Radio, Settings2 } from "lucide-react";
import type { ProviderId } from "@/lib/voice-providers";
import { SectionHeader } from "./SectionHeader";
import { useUILang } from "@/hooks/use-ui-lang";

type Props = {
  provider: ProviderId;
  changeProvider: (provider: ProviderId) => void;
  geminiReady: boolean;
  geminiError: string | null;
};

export function ProviderSection({ provider, changeProvider, geminiReady, geminiError }: Props) {
  const { isUrdu } = useUILang();
  return (
    <section>
      <SectionHeader>{isUrdu ? "Voice provider" : "Voice provider"}</SectionHeader>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Voice provider">
          <button
            type="button"
            role="radio"
            aria-checked={provider === "gemini"}
            onClick={() => changeProvider("gemini")}
            className={`rounded-lg border px-3 py-2 text-left transition ${provider === "gemini" ? "border-cyan-300/60 bg-cyan-300/10" : "border-white/10 bg-white/[0.02] hover:bg-white/5"}`}
          >
            <span className="flex items-center gap-1.5 text-xs text-white/90"><Radio className="w-3.5 h-3.5 text-cyan-300" />Gemini Live</span>
            <span className="block mt-1 text-[10px] leading-relaxed text-white/50">Secure server token; recommended for production.</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={provider === "hf"}
            onClick={() => changeProvider("hf")}
            className={`rounded-lg border px-3 py-2 text-left transition ${provider === "hf" ? "border-violet-300/60 bg-violet-300/10" : "border-white/10 bg-white/[0.02] hover:bg-white/5"}`}
          >
            <span className="flex items-center gap-1.5 text-xs text-white/90"><Settings2 className="w-3.5 h-3.5 text-violet-300" />Hugging Face</span>
            <span className="block mt-1 text-[10px] leading-relaxed text-white/50">Requires an authenticated HF Space session.</span>
          </button>
        </div>

        {provider === "gemini" ? (
          <div className={`flex items-start gap-2 rounded-lg border p-2.5 ${geminiReady ? "border-emerald-300/20 bg-emerald-300/5" : "border-amber-300/25 bg-amber-300/5"}`}>
            {geminiReady ? <CheckCircle2 className="mt-0.5 w-3.5 h-3.5 shrink-0 text-emerald-300" /> : <AlertCircle className="mt-0.5 w-3.5 h-3.5 shrink-0 text-amber-300" />}
            <p className="text-[10px] leading-relaxed text-white/70">
              {geminiReady
                ? "Gemini server configuration is ready. A short-lived token is created only when you start voice mode."
                : (geminiError || "Add GEMINI_API_KEY in Vercel Project Settings, then redeploy.")}
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300/25 bg-amber-300/5 p-2.5">
            <AlertCircle className="mt-0.5 w-3.5 h-3.5 shrink-0 text-amber-300" />
            <p className="text-[10px] leading-relaxed text-white/70">
              {isUrdu
                ? "Hugging Face Space 401 دے سکتا ہے کیونکہ اسے browser login session درکار ہے۔ بہتر reliability کے لیے Gemini Live منتخب کریں۔"
                : "This Hugging Face Space can return 401 because it requires a browser login session. Gemini Live is recommended for reliable voice."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
