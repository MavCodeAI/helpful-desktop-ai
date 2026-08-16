import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { GEMINI_LIVE_MODEL } from "./gemini-live-config";
import { missingAiKeyMessage, resolveAiKey } from "./ai-key-policy.server";

// Provider connectivity probes for Gemini AI and Tavily web search.
export const PROVIDERS = [
  { id: "gemini", label: "Google Gemini", implemented: true },
  { id: "tavily", label: "Tavily Search", implemented: true },
  { id: "openai", label: "OpenAI", implemented: false },
  { id: "anthropic", label: "Anthropic Claude", implemented: false },
] as const;

export type ProviderId = (typeof PROVIDERS)[number]["id"];

export type ApiTestResult = {
  ok: boolean;
  provider: ProviderId;
  keySource: "user" | "server" | "none";
  keyPrefix: string;
  checks: Array<{ label: string; ok: boolean; status: number; error?: string }>;
  latencyMs: number;
  hint?: string;
};

export type ModelInfo = { id: string; displayName?: string; methods: string[] };
export type ListModelsResult = { ok: boolean; provider: ProviderId; keySource: "user" | "server" | "none"; models: ModelInfo[]; status: number; error?: string; hint?: string };

async function probeGeminiModel(model: string, key: string) {
  const t0 = performance.now();
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}?key=${encodeURIComponent(key)}`);
    const ms = Math.round(performance.now() - t0);
    if (res.ok) return { ok: true, status: res.status, ms };
    return { ok: false, status: res.status, ms, error: (await res.text()).slice(0, 220) };
  } catch (e) {
    return { ok: false, status: 0, ms: Math.round(performance.now() - t0), error: e instanceof Error ? e.message : String(e) };
  }
}

async function probeTavily(key: string) {
  const t0 = performance.now();
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: key, query: "Saudi Arabia", search_depth: "basic", max_results: 1 }),
    });
    const ms = Math.round(performance.now() - t0);
    if (res.ok) return { ok: true, status: res.status, ms };
    return { ok: false, status: res.status, ms, error: (await res.text()).slice(0, 220) };
  } catch (e) {
    return { ok: false, status: 0, ms: Math.round(performance.now() - t0), error: e instanceof Error ? e.message : String(e) };
  }
}

function resolveKey(userKey: string | undefined, envName: "GEMINI_API_KEY" | "TAVILY_API_KEY") {
  return resolveAiKey(userKey, envName);
}

function keyHint(provider: string) {
  return missingAiKeyMessage(provider);
}

const providerSchema = z.enum(["gemini", "tavily", "openai", "anthropic"]).default("gemini");

export const listProviderModels = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ provider: providerSchema, userKey: z.string().trim().max(200).optional() }).parse(input ?? {}))
  .handler(async ({ data }): Promise<ListModelsResult> => {
    if (data.provider === "tavily") {
      const { key, source } = resolveKey(data.userKey, "TAVILY_API_KEY");
      if (!key) return { ok: false, provider: data.provider, keySource: "none", models: [], status: 0, hint: keyHint("Tavily Search") };
      const probe = await probeTavily(key);
      return { ok: probe.ok, provider: data.provider, keySource: source, models: [{ id: "tavily-search", displayName: "Tavily Search", methods: ["search"] }], status: probe.status, error: probe.error, hint: probe.ok ? "Tavily Search is reachable." : "Tavily rejected the key or request." };
    }
    if (data.provider !== "gemini") return { ok: false, provider: data.provider, keySource: "none", models: [], status: 0, hint: `${data.provider} support is coming soon.` };
    const { key, source } = resolveKey(data.userKey, "GEMINI_API_KEY");
    if (!key) return { ok: false, provider: data.provider, keySource: "none", models: [], status: 0, hint: keyHint("Gemini AI") };
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=200`);
      if (!res.ok) return { ok: false, provider: data.provider, keySource: source, models: [], status: res.status, error: (await res.text()).slice(0, 240), hint: res.status === 401 || res.status === 403 ? "Key rejected — revoked, wrong project, or billing disabled." : undefined };
      const json = await res.json() as { models?: Array<{ name: string; displayName?: string; supportedGenerationMethods?: string[] }> };
      const models = (json.models ?? []).map((m) => ({ id: m.name.replace(/^models\//, ""), displayName: m.displayName, methods: m.supportedGenerationMethods ?? [] })).filter((m) => m.id.startsWith("gemini")).sort((a, b) => a.id.localeCompare(b.id));
      return { ok: true, provider: data.provider, keySource: source, models, status: 200, hint: `${models.length} Gemini models available on this key.` };
    } catch (e) { return { ok: false, provider: data.provider, keySource: source, models: [], status: 0, error: e instanceof Error ? e.message : String(e) }; }
  });

export const testProviderConnection = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ provider: providerSchema, userKey: z.string().trim().max(200).optional(), models: z.array(z.string().trim().min(1).max(120)).max(6).optional() }).parse(input ?? {}))
  .handler(async ({ data }): Promise<ApiTestResult> => {
    if (data.provider === "tavily") {
      const { key, source } = resolveKey(data.userKey, "TAVILY_API_KEY");
      if (!key) return { ok: false, provider: data.provider, keySource: "none", keyPrefix: "", checks: [{ label: "Tavily Search", ok: false, status: 0, error: "No key configured" }], latencyMs: 0, hint: keyHint("Tavily Search") };
      const probe = await probeTavily(key);
      return { ok: probe.ok, provider: data.provider, keySource: source, keyPrefix: "", checks: [{ label: "Tavily Search", ok: probe.ok, status: probe.status, error: probe.error }], latencyMs: probe.ms, hint: probe.ok ? "Tavily Search is reachable." : "Tavily rejected the key or request." };
    }
    if (data.provider !== "gemini") return { ok: false, provider: data.provider, keySource: "none", keyPrefix: "", checks: [{ label: "Provider support", ok: false, status: 0, error: "Not implemented yet" }], latencyMs: 0, hint: `${data.provider} support is coming soon. Only Gemini and Tavily can be tested today.` };
    const { key, source: keySource } = resolveKey(data.userKey, "GEMINI_API_KEY");
    if (!key) return { ok: false, provider: data.provider, keySource: "none", keyPrefix: "", checks: [{ label: "gemini-2.5-flash", ok: false, status: 0, error: "No key configured" }], latencyMs: 0, hint: keyHint("Gemini AI") };
    const targets = data.models?.length ? data.models : ["gemini-2.5-flash", GEMINI_LIVE_MODEL];
    const t0 = performance.now();
    const results = await Promise.all(targets.map((id) => probeGeminiModel(`models/${id}`, key)));
    const latencyMs = Math.round(performance.now() - t0);
    const checks = targets.map((id, i) => ({ label: id, ok: results[i].ok, status: results[i].status, error: results[i].error }));
    const anyFail = results.find((r) => !r.ok);
    const allOk = results.every((r) => r.ok);
    const hint = anyFail?.status === 429 ? "Rate limit — try again in a minute." : anyFail?.status === 404 ? "One or more models are not accessible on this key." : allOk ? "All selected models are reachable." : "Check the Gemini key and model permissions.";
    return { ok: allOk, provider: data.provider, keySource, keyPrefix: "", checks, latencyMs, hint };
  });
