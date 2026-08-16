export type AiProvider = "GEMINI_API_KEY" | "TAVILY_API_KEY";

function allowServerFallback() {
  return process.env.ALPHA_ALLOW_SERVER_AI_FALLBACK === "true";
}

export function resolveAiKey(userKey: string | undefined, envName: AiProvider) {
  const user = userKey?.trim() || "";
  if (user) return { key: user, source: "user" as const };

  const server = process.env[envName]?.trim() || "";
  if (server && allowServerFallback()) return { key: server, source: "server" as const };

  return { key: "", source: "none" as const };
}

export function missingAiKeyMessage(provider: string) {
  return `${provider} is not configured for this session. Add your key in Settings and use Apply & Test. Server-side fallback is disabled unless ALPHA_ALLOW_SERVER_AI_FALLBACK=true.`;
}
