import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft, CheckCircle2, XCircle, Loader2, Zap, Eye, EyeOff, Search, Play,
} from "lucide-react";
import { toast } from "sonner";
import {
  testProviderConnection, listProviderModels, PROVIDERS,
  type ApiTestResult, type ProviderId, type ModelInfo,
} from "@/lib/api-test.functions";
import { useUILang } from "@/hooks/use-ui-lang";

const GEMINI_KEY_LS = "gemini_api_key";
const PROVIDER_LS = "api_settings_provider";
const SELECTED_MODELS_LS = "api_settings_selected_models";

export const Route = createFileRoute("/api-settings")({
  component: ApiSettingsPage,
  head: () => ({
    meta: [
      { title: "API settings · Alpha" },
      { name: "description", content: "Test your Gemini API key and pick models." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ApiSettingsPage() {
  const { isUrdu } = useUILang();
  const [provider, setProvider] = useState<ProviderId>("gemini");
  const [key, setKey] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [result, setResult] = useState<ApiTestResult | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setKey(window.localStorage.getItem(GEMINI_KEY_LS) ?? "");
      const sp = window.localStorage.getItem(PROVIDER_LS);
      if (sp && PROVIDERS.some((p) => p.id === sp)) setProvider(sp as ProviderId);
      const raw = window.localStorage.getItem(SELECTED_MODELS_LS);
      if (raw) {
        const map = JSON.parse(raw) as Record<string, string[]>;
        const init = map[sp ?? "gemini"];
        if (Array.isArray(init)) setSelectedModels(init.slice(0, 6));
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(PROVIDER_LS, provider); } catch { /* ignore */ }
  }, [provider, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const raw = window.localStorage.getItem(SELECTED_MODELS_LS);
      const map = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
      map[provider] = selectedModels;
      window.localStorage.setItem(SELECTED_MODELS_LS, JSON.stringify(map));
    } catch { /* ignore */ }
  }, [selectedModels, provider, hydrated]);

  const saveKey = () => {
    try {
      const v = key.trim();
      if (v) window.localStorage.setItem(GEMINI_KEY_LS, v);
      else window.localStorage.removeItem(GEMINI_KEY_LS);
      toast.success(isUrdu ? "کی محفوظ ہو گئی۔" : "Key saved locally.");
    } catch {
      toast.error(isUrdu ? "محفوظ نہیں ہو سکا" : "Couldn't save");
    }
  };

  const detectModels = async () => {
    setDetecting(true); setModels(null); setResult(null);
    try {
      const r = await listProviderModels({ data: { provider, userKey: key.trim() || undefined } });
      if (!r.ok) { toast.error(r.hint ?? r.error ?? "Failed"); setModels([]); return; }
      setModels(r.models);
      setSelectedModels((prev) => {
        const kept = prev.filter((id) => r.models.some((m) => m.id === id));
        if (kept.length) return kept;
        const defaults = ["gemini-2.5-flash"].filter((id) => r.models.some((m) => m.id === id));
        return defaults.length ? defaults : r.models.slice(0, 1).map((m) => m.id);
      });
      toast.success(`${r.models.length} models detected`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Detect failed");
    } finally { setDetecting(false); }
  };

  const runTest = async (only?: string) => {
    setBusy(true); setResult(null);
    try {
      const r = await testProviderConnection({
        data: {
          provider,
          userKey: key.trim() || undefined,
          models: only ? [only] : selectedModels.length ? selectedModels : undefined,
        },
      });
      setResult(r);
      if (r.ok) toast.success(only ? `${only} — OK` : "Connection OK");
      else toast.error(r.hint ?? "Connection failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally { setBusy(false); }
  };

  const anyBusy = busy || detecting;
  const q = filter.trim().toLowerCase();
  const filteredModels =
    models?.filter((m) =>
      !q ? true :
        m.id.toLowerCase().includes(q) ||
        m.displayName?.toLowerCase().includes(q) ||
        m.methods.some((x) => x.toLowerCase().includes(q))
    ) ?? null;

  return (
    <div className="min-h-dvh bg-background text-foreground" dir={isUrdu ? "rtl" : "ltr"}>
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/50 bg-background/70 px-4 py-3 backdrop-blur">
        <Link
          to="/"
          className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground min-h-11 min-w-11 inline-flex items-center justify-center"
          aria-label={isUrdu ? "واپس" : "Back"}
        >
          <ArrowLeft className="h-5 w-5 rtl:scale-x-[-1]" />
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">
          {isUrdu ? "API ترتیبات" : "API settings"}
        </h1>
      </header>

      <main className="mx-auto max-w-xl space-y-6 px-4 py-6">
        <section className="rounded-2xl border border-border/50 bg-card/40 p-5">
          <label htmlFor="provider" className="mb-2 block text-sm font-medium">
            {isUrdu ? "پرووائیڈر" : "Provider"}
          </label>
          <select
            id="provider"
            value={provider}
            disabled={anyBusy}
            onChange={(e) => {
              setProvider(e.target.value as ProviderId);
              setResult(null); setModels(null); setFilter("");
              try {
                const raw = window.localStorage.getItem(SELECTED_MODELS_LS);
                const map = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
                const next = map[e.target.value as ProviderId];
                setSelectedModels(Array.isArray(next) ? next.slice(0, 6) : []);
              } catch { setSelectedModels([]); }
            }}
            className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:opacity-50"
          >
            {PROVIDERS.filter((p) => p.implemented).map((p) => (
              <option key={p.id} value={p.id} className="bg-background">
                {p.label}{p.implemented ? "" : " (coming soon)"}
              </option>
            ))}
          </select>
        </section>

        <section className="rounded-2xl border border-border/50 bg-card/40 p-5">
          <label htmlFor="gemini-key" className="mb-2 block text-sm font-medium">
            {PROVIDERS.find((p) => p.id === provider)?.label} {isUrdu ? "API کی" : "API Key"}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                id="gemini-key"
                type={reveal ? "text" : "password"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="AIza…"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 pe-10 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
              />
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                aria-label={reveal ? (isUrdu ? "کی چھپائیں" : "Hide key") : (isUrdu ? "کی دکھائیں" : "Show key")}
                className="absolute end-2 top-1/2 -translate-y-1/2 min-h-10 min-w-10 rounded p-2 text-muted-foreground hover:text-foreground inline-flex items-center justify-center touch-manipulation"
              >
                {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button
              onClick={saveKey}
              className="rounded-lg border border-border bg-accent px-3 py-2 text-sm font-medium hover:bg-accent/80 min-h-11"
            >
              {isUrdu ? "محفوظ کریں" : "Save"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {isUrdu
              ? "کی صرف اس براؤزر کے localStorage میں رہتی ہے۔"
              : "Key stays in this browser's localStorage."}
          </p>
        </section>

        <section className="rounded-2xl border border-border/50 bg-card/40 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">{isUrdu ? "دستیاب ماڈلز" : "Available models"}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {isUrdu ? "کی سے ماڈلز کی list لائیں پھر ٹیسٹ کریں۔" : "List models this key can access, then probe them."}
              </p>
            </div>
            <button
              onClick={detectModels}
              disabled={anyBusy}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-accent px-3 py-2 text-sm font-medium hover:bg-accent/80 disabled:opacity-50 min-h-11"
            >
              {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {detecting ? (isUrdu ? "تلاش…" : "Detecting…") : (isUrdu ? "تلاش" : "Detect")}
            </button>
          </div>

          {!detecting && models && models.length > 0 && (
            <div className="mt-4 space-y-2">
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={isUrdu ? "ماڈلز فلٹر کریں…" : "Filter models…"}
                className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
              />
              <div className="text-[11px] text-muted-foreground">
                {selectedModels.length}/6 selected · {filteredModels?.length ?? 0}/{models.length} shown
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-border/50 bg-background/40">
                {filteredModels?.map((m) => {
                  const checked = selectedModels.includes(m.id);
                  return (
                    <div key={m.id} className="flex items-start gap-3 border-b border-border/40 px-3 py-2 last:border-b-0 hover:bg-accent/40">
                      <label className="flex flex-1 min-w-0 cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setSelectedModels((prev) =>
                              e.target.checked ? [...prev, m.id].slice(0, 6) : prev.filter((x) => x !== m.id)
                            )
                          }
                          className="mt-1 accent-cyan-400"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-mono text-xs">{m.id}</div>
                          {m.displayName && (
                            <div className="truncate text-[11px] text-muted-foreground">{m.displayName}</div>
                          )}
                        </div>
                      </label>
                      <button
                        type="button"
                        onClick={() => runTest(m.id)}
                        disabled={anyBusy}
                        aria-label={isUrdu ? `${m.id} ٹیسٹ کریں` : `Test ${m.id}`}
                        className="mt-0.5 inline-flex min-h-10 shrink-0 items-center gap-1 rounded-md border border-border bg-accent/60 px-3 py-2 text-[11px] hover:bg-accent disabled:opacity-40 touch-manipulation"
                      >
                        <Play className="h-3 w-3" /> {isUrdu ? "ٹیسٹ" : "Test"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border/50 bg-card/40 p-5">
          <button
            onClick={() => runTest()}
            disabled={anyBusy}
            className="inline-flex items-center gap-2 rounded-full bg-cyan-500/90 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50 min-h-11"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {isUrdu ? "کنکشن ٹیسٹ کریں" : "Run connection test"}
          </button>

          {result && (
            <div className="mt-4 space-y-2 rounded-lg border border-border/50 bg-background/40 p-3">
              <div className="flex items-center gap-2 text-sm">
                {result.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400" />
                )}
                <span className="font-medium">
                  {result.ok ? (isUrdu ? "کامیاب" : "OK") : (isUrdu ? "ناکام" : "Failed")}
                </span>
                <span className="ms-auto text-[11px] text-muted-foreground">{result.latencyMs}ms</span>
              </div>
              {result.hint && <p className="text-xs text-muted-foreground">{result.hint}</p>}
              <ul className="space-y-1 text-[11px]">
                {result.checks.map((c, i) => (
                  <li key={i} className="flex items-center gap-2">
                    {c.ok ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-400" />
                    )}
                    <span className="font-mono">{c.label}</span>
                    <span className="text-muted-foreground">{c.status || "—"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
