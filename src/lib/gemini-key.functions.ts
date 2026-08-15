import { createServerFn } from "@tanstack/react-start";

export type GeminiKeyStatus = "ok" | "missing" | "invalid_format";

/** Never return the server secret to a browser. Return status only. */
export const getGeminiKey = createServerFn({ method: "GET" }).handler(async () => {
  const raw = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!raw) {
    return { configured: false, status: "missing" as GeminiKeyStatus, error: "GEMINI_API_KEY not set on server." };
  }
  if (raw.length < 20) {
    return { configured: false, status: "invalid_format" as GeminiKeyStatus, error: "GEMINI_API_KEY appears invalid." };
  }
  return { configured: true, status: "ok" as GeminiKeyStatus, error: null };
});
