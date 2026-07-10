import { createServerFn } from "@tanstack/react-start";

export type GeminiKeyStatus = "ok" | "missing" | "invalid_format";

export const getGeminiKey = createServerFn({ method: "GET" }).handler(async () => {
  const raw = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!raw) {
    return { key: "", status: "missing" as GeminiKeyStatus, error: "GEMINI_API_KEY not set on server." };
  }
  if (!raw.startsWith("AIza") || raw.length < 30) {
    return {
      key: "",
      status: "invalid_format" as GeminiKeyStatus,
      error: "GEMINI_API_KEY is malformed. It must start with 'AIza' and be ~39 chars. Get one at https://aistudio.google.com/apikey",
    };
  }
  return { key: raw, status: "ok" as GeminiKeyStatus, error: null };
});
