import { missingAiKeyMessage, resolveAiKey } from "./ai-key-policy.server";

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export type GeminiContent = {
  role?: "user" | "model";
  parts: GeminiPart[];
};

export type GeminiGroundingSource = { title: string; url: string };

type GeminiGenerateOptions = {
  systemInstruction?: string;
  contents: GeminiContent[];
  model?: string;
  temperature?: number;
  responseMimeType?: "text/plain" | "application/json";
  timeoutMs?: number;
  apiKey?: string;
  googleSearch?: boolean;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: unknown }> };
    finishReason?: string;
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
    };
  }>;
};

const DEFAULT_MODEL = "gemini-2.5-flash";

function configured(value: string | undefined) {
  return Boolean(value?.trim());
}

function extractText(payload: GeminiResponse) {
  return (payload.candidates?.[0]?.content?.parts ?? [])
    .map((part) => typeof part.text === "string" ? part.text : "")
    .join("")
    .trim();
}

export function getGeminiTextApiKey(userKey?: string) {
  const { key } = resolveAiKey(userKey, "GEMINI_API_KEY");
  if (!key) throw new Error(missingAiKeyMessage("Gemini AI"));
  return key;
}

async function requestGemini(options: GeminiGenerateOptions): Promise<{ text: string; sources: GeminiGroundingSource[] }> {
  const apiKey = getGeminiTextApiKey(options.apiKey);
  const model = options.model?.trim() || process.env.GEMINI_TEXT_MODEL?.trim() || DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const generationConfig: Record<string, unknown> = { temperature: options.temperature ?? 0.3 };
  if (options.responseMimeType) generationConfig.responseMimeType = options.responseMimeType;
  const payload = {
    ...(options.systemInstruction ? { systemInstruction: { parts: [{ text: options.systemInstruction }] } } : {}),
    contents: options.contents,
    generationConfig,
    ...(options.googleSearch ? { tools: [{ google_search: {} }] } : {}),
  };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") throw new Error("Gemini reply timed out. Please try again.");
    throw new Error("Gemini service is temporarily unreachable. Please try again.");
  }
  if (!response.ok) {
    if (response.status === 429) throw new Error("Gemini rate limit reached. Please try again shortly.");
    if (response.status === 401 || response.status === 403) throw new Error("Gemini authorization failed. Check the key in Settings, run Apply & Test again, or verify the production Gemini configuration.");
    throw new Error(`Gemini request failed with status ${response.status}.`);
  }

  const json = await response.json() as GeminiResponse;
  const text = extractText(json);
  if (!text) throw new Error("Gemini returned an empty response. Please try again.");
  const sources = (json.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [])
    .map((chunk) => ({ title: chunk.web?.title?.trim() ?? "Web source", url: chunk.web?.uri?.trim() ?? "" }))
    .filter((source) => source.url);
  return { text, sources };
}

export async function generateGeminiText(options: GeminiGenerateOptions): Promise<string> {
  return (await requestGemini(options)).text;
}

export async function generateGeminiGroundedText(options: GeminiGenerateOptions): Promise<{ text: string; sources: GeminiGroundingSource[] }> {
  return requestGemini({ ...options, googleSearch: true });
}

export function geminiUserText(text: string): GeminiContent {
  return { role: "user", parts: [{ text }] };
}

export function geminiModelText(text: string): GeminiContent {
  return { role: "model", parts: [{ text }] };
}
