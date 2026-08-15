import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { KeyRound, CheckCircle2, AlertCircle, ExternalLink, Loader2 } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { useUILang } from "@/hooks/use-ui-lang";
import { getAiHealth, type AiHealth } from "@/lib/ai-health.functions";

function StatusLine({ label, configured, env, isUrdu }: { label: string; configured: boolean; env: string; isUrdu: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      {configured ? <CheckCircle2 className="w-3 h-3 text-emerald-300" /> : <AlertCircle className="w-3 h-3 text-amber-300" />}
      <span className="text-white/80">{label}</span>
      <code className="ms-auto text-[9px] text-white/45">{env}</code>
      <span className={configured ? "text-emerald-300/90" : "text-amber-300/90"}>
        {configured ? (isUrdu ? "فعال" : "Ready") : (isUrdu ? "غائب" : "Missing")}
      </span>
    </div>
  );
}

export function ApiKeysSection() {
  const { isUrdu } = useUILang();
  const [health, setHealth] = useState<AiHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getAiHealth()
      .then((result) => { if (alive) setHealth(result); })
      .catch(() => { if (alive) setHealth(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <section>
      <SectionHeader>{isUrdu ? "AI APIs" : "AI APIs"}</SectionHeader>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <KeyRound className="w-3.5 h-3.5 text-cyan-300/80 shrink-0" />
          <span className="text-xs text-white/85 font-medium">{isUrdu ? "Server configuration" : "Server configuration"}</span>
          {loading ? (
            <Loader2 className="ms-auto w-3 h-3 animate-spin text-white/60" />
          ) : (
            <span className={`ms-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-widest ${health?.ok ? "text-emerald-300/90" : "text-amber-300/90"}`}>
              {health?.ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              {health?.ok ? (isUrdu ? "تیار" : "Ready") : (isUrdu ? "توجہ درکار" : "Action needed")}
            </span>
          )}
        </div>

        {health ? (
          <div className="space-y-1.5 rounded-lg border border-white/10 bg-black/10 p-2">
            <StatusLine label={isUrdu ? "جوابات اور actions" : "Replies & actions"} configured={health.providers.llm.configured} env={health.providers.llm.env} isUrdu={isUrdu} />
            <StatusLine label={isUrdu ? "آواز سے متن" : "Speech to text"} configured={health.providers.stt.configured} env={health.providers.stt.env} isUrdu={isUrdu} />
            <StatusLine label={isUrdu ? "Realtime audio (اختیاری)" : "Realtime audio (optional)"} configured={health.providers.realtime.configured} env={health.providers.realtime.env} isUrdu={isUrdu} />
          </div>
        ) : (
          <p className="text-[10px] text-amber-200/80">{isUrdu ? "سرور configuration status دستیاب نہیں۔" : "Server configuration status unavailable."}</p>
        )}

        <Link
          to="/api-settings"
          className="w-full inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white/90"
        >
          <span>{isUrdu ? "API documentation اور test" : "API documentation & test"}</span>
          <ExternalLink className="w-3 h-3" aria-hidden />
        </Link>
        <p className="text-[10px] leading-relaxed text-white/50">
          {isUrdu
            ? "Production secrets server پر رہتے ہیں؛ browser یا mobile app میں محفوظ نہیں کیے جاتے۔"
            : "Production secrets stay on the server; they are never stored in the browser or mobile app."}
        </p>
      </div>
    </section>
  );
}
