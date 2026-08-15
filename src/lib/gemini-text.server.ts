export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export type GeminiContent = {
  role?: "user" | "model";
  parts: GeminiPart[];
};

type GeminiGenerateOptions = {
  systemInstruction?: string;
  contents: GeminiContent[];
  model?: string;
  temperature?: number;
  responseMimeType?: "text/plain" | "application/json";
  timeoutMs?: number;
  apiKey?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: unknown }> };
    finishReason?: string;
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
  const key = userKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!key?.trim()) {
    throw new Error("Gemini AI is not configured. Add a Gemini key in Settings and use Apply & Test, or configure GEMINI_API_KEY on the production server.");
  }
  return key;
}

export async function generateGeminiText(options: GeminiGenerateOptions): Promise<string> {
  const apiKey = getGeminiTextApiKey(options.apiKey);
  const model = options.model?.trim() || process.env.GEMINI_TEXT_MODEL?.trim() || DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const generationConfig: Record<string, unknown> = {
    temperature: options.temperature ?? 0.3,
  };
  if (options.responseMimeType) generationConfig.responseMimeType = options.responseMimeType;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(options.systemInstruction
          ? { systemInstruction: { parts: [{ text: options.systemInstruction }] } }
          : {}),
        contents: options.contents,
        generationConfig,
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error("Gemini reply timed out. Please try again.");
    }
    throw new Error("Gemini service is temporarily unreachable. Please try again.");
  }

  if (!response.ok) {
    if (response.status === 429) throw new Error("Gemini rate limit reached. Please try again shortly.");
    if (response.status === 401 || response.status === 403) {
      throw new Error("Gemini authorization failed. Check the key in Settings, run Apply & Test again, or verify the production Gemini configuration.");
    }
    throw new Error(`Gemini request failed with status ${response.status}.`);
  }

  const text = extractText(await response.json() as GeminiResponse);
  if (!text) throw new Error("Gemini returned an empty response. Please try again.");
  return text;
}

export function geminiUserText(text: string): GeminiContent {
  return { role: "user", parts: [{ text }] };
}

export function geminiModelText(text: string): GeminiContent {
  return { role: "model", parts: [{ text }] };
}
