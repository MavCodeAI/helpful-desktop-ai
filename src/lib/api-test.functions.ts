import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Provider-agnostic key/connectivity probe. Only Gemini is implemented today.

export const PROVIDERS = [
  { id: "gemini", label: "Google Gemini", implemented: true },
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

export type ModelInfo = {
  id: string;
  displayName?: string;
  methods: string[];
};

export type ListModelsResult = {
  ok: boolean;
  provider: ProviderId;
  keySource: "user" | "server" | "none";
  models: ModelInfo[];
  status: number;
  error?: string;
  hint?: string;
};

async function probeGeminiModel(model: string, key: string) {
  const t0 = performance.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/${model}?key=${encodeURIComponent(key)}`;
  try {
    const res = await fetch(url, { method: "GET" });
    const ms = Math.round(performance.now() - t0);
    if (res.ok) return { ok: true, status: res.status, ms };
    const body = (await res.text()).slice(0, 220);
    return { ok: false, status: res.status, ms, error: body };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      ms: Math.round(performance.now() - t0),
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function resolveGeminiKey(userKey?: string) {
  const u = userKey?.trim() || "";
  const s = process.env.GEMINI_API_KEY?.trim() || "";
  const key = u || s;
  const source: ApiTestResult["keySource"] = u ? "user" : s ? "server" : "none";
  return { key, source };
}

export const listProviderModels = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        provider: z.enum(["gemini", "openai", "anthropic"]).default("gemini"),
        userKey: z.string().trim().max(200).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<ListModelsResult> => {
    const { provider } = data;
    if (provider !== "gemini") {
      return {
        ok: false, provider, keySource: "none", models: [], status: 0,
        hint: `${provider} support is coming soon.`,
      };
    }
    const { key, source } = resolveGeminiKey(data.userKey);
    if (!key) {
      return {
        ok: false, provider, keySource: "none", models: [], status: 0,
        hint: "Enter a key or configure GEMINI_API_KEY on the server.",
      };
    }
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=200`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = (await res.text()).slice(0, 240);
        return {
          ok: false, provider, keySource: source, models: [], status: res.status,
          error: body,
          hint: res.status === 401 || res.status === 403
            ? "Key rejected — revoked, wrong project, or billing disabled."
            : undefined,
        };
      }
      const json = (await res.json()) as {
        models?: Array<{ name: string; displayName?: string; supportedGenerationMethods?: string[] }>;
      };
      const models: ModelInfo[] = (json.models ?? [])
        .map((m) => ({
          id: m.name.replace(/^models\//, ""),
          displayName: m.displayName,
          methods: m.supportedGenerationMethods ?? [],
        }))
        .filter((m) => m.id.startsWith("gemini"))
        .sort((a, b) => a.id.localeCompare(b.id));
      return {
        ok: true, provider, keySource: source, models, status: 200,
        hint: `${models.length} Gemini models available on this key.`,
      };
    } catch (e) {
      return {
        ok: false, provider, keySource: source, models: [], status: 0,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });

export const testProviderConnection = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        provider: z.enum(["gemini", "openai", "anthropic"]).default("gemini"),
        userKey: z.string().trim().max(200).optional(),
        models: z.array(z.string().trim().min(1).max(120)).max(6).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<ApiTestResult> => {
    const provider = data.provider;
    if (provider !== "gemini") {
      return {
        ok: false, provider, keySource: "none", keyPrefix: "",
        checks: [{ label: "Provider support", ok: false, status: 0, error: "Not implemented yet" }],
        latencyMs: 0,
        hint: `${provider} support is coming soon. Only Gemini can be tested today.`,
      };
    }
    const { key, source: keySource } = resolveGeminiKey(data.userKey);
    if (!key) {
      return {
        ok: false, provider, keySource: "none", keyPrefix: "",
        checks: [
          { label: "gemini-2.5-flash", ok: false, status: 0, error: "No key configured" },
        ],
        latencyMs: 0,
        hint: "Enter a key or configure GEMINI_API_KEY on the server.",
      };
    }
    const targets =
      data.models && data.models.length > 0
        ? data.models
        : ["gemini-2.5-flash", "gemini-2.5-flash-native-audio-latest"];
    const t0 = performance.now();
    const results = await Promise.all(targets.map((id) => probeGeminiModel(`models/${id}`, key)));
    const latencyMs = Math.round(performance.now() - t0);
    const checks = targets.map((id, i) => ({
      label: id, ok: results[i].ok, status: results[i].status, error: results[i].error,
    }));
    const anyFail = results.find((r) => !r.ok);
    const allOk = results.every((r) => r.ok);
    let hint: string | undefined;
    if (anyFail && anyFail.status === 400) hint = "Model ID looks invalid.";
    else if (anyFail && (anyFail.status === 401 || anyFail.status === 403))
      hint = "Key rejected — revoked, wrong project, or billing disabled.";
    else if (anyFail && anyFail.status === 429) hint = "Rate limit — try again in a minute.";
    else if (anyFail && anyFail.status === 404) hint = "One or more models are not accessible on this key.";
    else if (allOk) hint = "All selected models are reachable.";
    return { ok: allOk, provider, keySource, keyPrefix: key.slice(0, 6), checks, latencyMs, hint };
  });
