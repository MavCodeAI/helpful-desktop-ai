import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { KeyRound, CheckCircle2, AlertCircle, ExternalLink, Loader2, Play, Search, ShieldCheck, XCircle } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { useUILang } from "@/hooks/use-ui-lang";
import { getAiHealth, type AiHealth } from "@/lib/ai-health.functions";
import { testGeminiLiveConnection } from "@/lib/gemini-live-token.functions";
import { testProviderConnection, type ApiTestResult } from "@/lib/api-test.functions";

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

function resultCopy(result: ApiTestResult, isUrdu: boolean): string {
  if (result.ok) return isUrdu ? "Gemini models اور realtime voice connection کام کر رہے ہیں۔" : "Gemini models and realtime voice connection are working.";
  if (result.hint) return result.hint;
  return isUrdu ? "Connection test ناکام رہا۔ key اور permissions چیک کریں۔" : "Connection test failed. Check the key and permissions.";
}

export interface ApiKeysSectionProps {
  geminiKey: string;
  onApplyGeminiKey: (value: string) => void;
  tavilyKey: string;
  onApplyTavilyKey: (value: string) => void;
}

export function ApiKeysSection({ geminiKey, onApplyGeminiKey, tavilyKey, onApplyTavilyKey }: ApiKeysSectionProps) {
  const { isUrdu } = useUILang();
  const [health, setHealth] = useState<AiHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [draftKey, setDraftKey] = useState(geminiKey);
  const [testState, setTestState] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testResult, setTestResult] = useState<ApiTestResult | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [tavilyDraft, setTavilyDraft] = useState(tavilyKey);
  const [tavilyState, setTavilyState] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [tavilyMessage, setTavilyMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraftKey(geminiKey);
  }, [geminiKey]);

  useEffect(() => {
    setTavilyDraft(tavilyKey);
  }, [tavilyKey]);

  const refreshHealth = useCallback((key = geminiKey) => {
    setLoading(true);
    getAiHealth({ data: { userKey: key.trim() || undefined } })
      .then((result) => setHealth(result))
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
  }, [geminiKey]);

  useEffect(() => {
    refreshHealth(geminiKey);
  }, [geminiKey, refreshHealth]);

  const applyAndTest = async () => {
    const userKey = draftKey.trim();
    setTestState("testing");
    setTestResult(null);
    setTestMessage(isUrdu ? "Key محفوظ کیے بغیر server پر connection test ہو رہا ہے…" : "Testing the connection on the server without exposing your key…");

    try {
      const result = await testProviderConnection({
        data: {
          provider: "gemini",
          userKey: userKey || undefined,
          models: ["gemini-2.5-flash"],
        },
      });
      setTestResult(result);

      if (!result.ok) {
        setTestState("error");
        setTestMessage(resultCopy(result, isUrdu));
        return;
      }

      setTestMessage(isUrdu ? "اصل Gemini Live handshake verify ہو رہا ہے…" : "Verifying the real Gemini Live handshake…");
      const live = await testGeminiLiveConnection({ data: { userKey: userKey || undefined } });
      if (!live.ok) {
        setTestState("error");
        setTestMessage(`${isUrdu ? "Live voice handshake ناکام رہا: " : "Live voice handshake failed: "}${live.error}`);
        return;
      }

      onApplyGeminiKey(userKey);
      setTestState("success");
      setTestMessage(isUrdu ? `کامیاب! key apply ہو گئی اور Live voice working ہے (${live.latencyMs}ms)۔` : `Success! The key is applied and Live voice is working (${live.latencyMs}ms).`);
      refreshHealth(userKey);
    } catch (error) {
      setTestState("error");
      setTestMessage(error instanceof Error ? error.message : (isUrdu ? "Test مکمل نہیں ہو سکا۔" : "The test could not be completed."));
    }
  };

  const testTavily = async () => {
    const userKey = tavilyDraft.trim();
    setTavilyState("testing");
    setTavilyMessage(isUrdu ? "Tavily Search connection test ہو رہا ہے…" : "Testing Tavily Search…");
    try {
      const result = await testProviderConnection({ data: { provider: "tavily", userKey: userKey || undefined } });
      if (!result.ok) {
        setTavilyState("error");
        setTavilyMessage(result.hint ?? (isUrdu ? "Tavily key درست نہیں۔" : "Tavily key was rejected."));
        return;
      }
      onApplyTavilyKey(userKey);
      setTavilyState("success");
      setTavilyMessage(isUrdu ? `Tavily primary search تیار ہے (${result.latencyMs}ms)۔` : `Tavily primary search is ready (${result.latencyMs}ms).`);
    } catch (error) {
      setTavilyState("error");
      setTavilyMessage(error instanceof Error ? error.message : (isUrdu ? "Tavily test مکمل نہیں ہو سکا۔" : "Tavily test failed."));
    }
  };

  const clearTavilyKey = () => {
    setTavilyDraft("");
    onApplyTavilyKey("");
    setTavilyState("idle");
    setTavilyMessage(isUrdu ? "Tavily key اس device سے صاف کر دی گئی۔" : "Tavily key cleared from this device.");
  };

  const clearLocalKey = () => {
    setDraftKey("");
    onApplyGeminiKey("");
    setTestState("idle");
    setTestResult(null);
    setTestMessage(isUrdu ? "اس device سے local key صاف کر دی گئی۔ Server key برقرار رہ سکتی ہے۔" : "The local key was cleared. A server-side key may still remain configured.");
  };

  return (
    <section>
      <SectionHeader>{isUrdu ? "AI APIs" : "AI APIs"}</SectionHeader>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound className="w-3.5 h-3.5 text-cyan-300/80 shrink-0" />
          <span className="text-xs text-white/85 font-medium">Provider setup & test</span>
          {loading ? (
            <Loader2 className="ms-auto w-3 h-3 animate-spin text-white/60" />
          ) : (
            <span className={`ms-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-widest ${health?.ok ? "text-emerald-300/90" : "text-amber-300/90"}`}>
              {health?.ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              {health?.ok ? (isUrdu ? "تیار" : "Ready") : (isUrdu ? "توجہ درکار" : "Action needed")}
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] text-white/55" aria-label="API setup steps">
          <span className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2 py-1.5 text-cyan-100">1. Paste key</span>
          <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5">2. Test</span>
          <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5">3. Ready</span>
        </div>

        <div className="rounded-lg border border-cyan-300/15 bg-cyan-300/[0.04] p-3 space-y-2.5">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 mt-0.5 text-cyan-200 shrink-0" />
            <div>
              <p className="text-xs font-medium text-white/90">{isUrdu ? "Gemini Live کو یہاں سے configure کریں" : "Configure Gemini Live here"}</p>
              <p className="text-[10px] leading-relaxed text-white/55 mt-1">Paste a key, press Apply &amp; Test, and Alpha will check both the models and a real voice session. If a server key is already configured, you can leave this field empty.</p>
            </div>
          </div>
          <input
            type="password"
            value={draftKey}
            onChange={(event) => { setDraftKey(event.target.value); setTestState("idle"); setTestMessage(null); }}
            placeholder={isUrdu ? "AIza… Gemini API key" : "AIza… Gemini API key"}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-white outline-none placeholder:text-white/30 focus:border-cyan-300/50"
            aria-label={isUrdu ? "Gemini API key" : "Gemini API key"}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={applyAndTest}
              disabled={testState === "testing"}
              className="min-h-11 flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-300/15 hover:bg-cyan-300/25 disabled:opacity-50 border border-cyan-200/25 px-3 py-2 text-xs text-cyan-100 touch-manipulation"
            >
              {testState === "testing" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {testState === "testing" ? (isUrdu ? "Test ہو رہا ہے…" : "Testing…") : (isUrdu ? "Apply & Test" : "Apply & Test")}
            </button>
            <button
              type="button"
              onClick={clearLocalKey}
              className="min-h-11 inline-flex items-center justify-center gap-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 text-xs text-white/70 touch-manipulation"
            >
              <XCircle className="w-3.5 h-3.5" />
              {isUrdu ? "Clear" : "Clear"}
            </button>
          </div>
          {testMessage && (
            <div className={`rounded-lg border p-2.5 text-[10px] leading-relaxed ${testState === "success" ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : testState === "error" ? "border-rose-300/25 bg-rose-300/10 text-rose-100" : "border-white/10 bg-black/15 text-white/70"}`} role="status" aria-live="polite">
              <div className="flex items-start gap-2">
                {testState === "success" ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : testState === "error" ? <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <Loader2 className="w-3.5 h-3.5 mt-0.5 shrink-0 animate-spin" />}
                <span>{testMessage}</span>
              </div>
              {testResult && (
                <div className="mt-2 text-[9px] text-white/55">
                  {testResult.checks.map((check) => `${check.ok ? "✓" : "×"} ${check.label} (${check.status || "network"})`).join(" · ")}
                  {` · ${testResult.latencyMs}ms`}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-amber-300/15 bg-amber-300/[0.04] p-3 space-y-2.5">
          <div className="flex items-start gap-2">
            <Search className="w-4 h-4 mt-0.5 text-amber-200 shrink-0" />
            <div>
              <p className="text-xs font-medium text-white/90">{isUrdu ? "Tavily — Primary Web Search" : "Tavily — Primary Web Search"}</p>
              <p className="text-[10px] leading-relaxed text-white/55 mt-1">Tavily retrieves live results; Gemini writes the final summary. This search provider is optional.</p>
            </div>
          </div>
          <input type="password" value={tavilyDraft} onChange={(event) => { setTavilyDraft(event.target.value); setTavilyState("idle"); setTavilyMessage(null); }} placeholder="tvly-… Tavily API key" autoComplete="off" spellCheck={false} className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-white outline-none placeholder:text-white/30 focus:border-amber-300/50" aria-label="Tavily API key" />
          <div className="flex gap-2">
            <button type="button" onClick={testTavily} disabled={tavilyState === "testing"} className="min-h-11 flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-300/15 hover:bg-amber-300/25 disabled:opacity-50 border border-amber-200/25 px-3 py-2 text-xs text-amber-100">
              {tavilyState === "testing" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {tavilyState === "testing" ? (isUrdu ? "Test ہو رہا ہے…" : "Testing…") : "Apply & Test"}
            </button>
            <button type="button" onClick={clearTavilyKey} className="min-h-11 inline-flex items-center justify-center gap-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 text-xs text-white/70"><XCircle className="w-3.5 h-3.5" />{isUrdu ? "Clear" : "Clear"}</button>
          </div>
          {tavilyMessage && <div className={`rounded-lg border p-2.5 text-[10px] leading-relaxed ${tavilyState === "success" ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : "border-rose-300/25 bg-rose-300/10 text-rose-100"}`} role="status" aria-live="polite">{tavilyMessage}</div>}
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
          <span>{isUrdu ? "تفصیلی API documentation" : "Detailed API documentation"}</span>
          <ExternalLink className="w-3 h-3" aria-hidden />
        </Link>
        <p className="text-[10px] leading-relaxed text-white/50">
          {isUrdu
            ? "یہ key صرف موجودہ session میں استعمال ہوتی ہے، localStorage میں محفوظ نہیں کی جاتی، اور صرف server function کو بھیجی جاتی ہے۔ Production team key Vercel secret کے طور پر رکھیں۔"
            : "This key is used only for the current session, is not saved in localStorage, and is sent only to the server function. Keep the production team key in Vercel secrets."}
        </p>
      </div>
    </section>
  );
}
