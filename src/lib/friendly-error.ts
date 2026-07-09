/**
 * User-facing error mapping for the voice pipeline.
 *
 * Two functions:
 *  - `friendlyError`  — one-liner for toasts / inline captions.
 *  - `sttErrorDetail` — structured { title, cause, next } for the diagnostics sheet.
 *
 * Both live here (not scattered in components) so gateway status codes
 * (401 / 402 / 413 / 429 / 5xx) map to a single vocabulary.
 */

export function friendlyError(e: unknown, fallback: string): string {
  const err = e as { message?: string; name?: string };
  const msg = (err?.message || "").toLowerCase();
  if (typeof navigator !== "undefined" && !navigator.onLine)
    return "You're offline — check your connection.";
  if (err?.name === "TypeError" || msg.includes("failed to fetch"))
    return "Network error — please retry.";
  if (msg.includes("429") || msg.includes("rate"))
    return "Rate limit reached — slow down and retry.";
  if (msg.includes("402") || msg.includes("credit"))
    return "AI credits exhausted — top up in your workspace.";
  if (msg.includes("401") || msg.includes("unauthorized"))
    return "Session expired — please sign in again.";
  return fallback;
}

/**
 * One STT attempt's diagnostic trace. Captured from the recorder pipeline
 * and rendered in the diagnostics sheet so failures are self-explaining.
 */
export type SttAttempt = {
  ts: number;
  origMime: string;
  origBytes: number;
  preTranscode: "ok" | "failed" | "skipped";
  sentMime: string;
  sentBytes: number;
  firstStatus: number | "network-error";
  retryReason: string | null;
  finalStatus: number | "ok" | "aborted" | "network-error";
  ms: number;
  errorBody?: string;
};

export function sttErrorDetail(
  status: number | null,
  raw: string,
  networkErr?: unknown,
): { title: string; cause: string; next: string } {
  const body = (raw || "").trim();
  const low = body.toLowerCase();

  if (typeof navigator !== "undefined" && !navigator.onLine) return {
    title: "You're offline",
    cause: "Browser reports no network connection.",
    next: "Reconnect Wi-Fi / data, then tap the orb to retry.",
  };
  if (networkErr && (networkErr as { name?: string }).name === "TypeError") return {
    title: "Network error",
    cause: "Couldn't reach the transcription server.",
    next: "Check your connection and retry in a moment.",
  };

  if (status === 402 || low.includes("credit")) return {
    title: "AI credits exhausted",
    cause: "The Lovable AI workspace is out of credits.",
    next: "Top up credits in Settings → Plans & credits, then retry.",
  };
  if (status === 429 || low.includes("rate")) return {
    title: "Rate limited",
    cause: "Too many transcription requests in a short window.",
    next: "Wait a few seconds and try again.",
  };
  if (status === 401 || low.includes("unauthorized")) return {
    title: "Session expired",
    cause: "Your login token is no longer valid.",
    next: "Sign in again, then retry.",
  };
  if (status === 413 || low.includes("too long") || low.includes("25 mb")) return {
    title: "Recording too long",
    cause: "Audio exceeds the 25 MB upstream cap.",
    next: "Speak in shorter turns (under ~10 minutes).",
  };
  if (low.includes("too short")) return {
    title: "Recording too short",
    cause: body.match(/\d+/) ? `Only ${body.match(/\d+/)?.[0]} bytes captured.` : "Almost no audio was captured.",
    next: "Hold the orb (or Space) and speak for at least 1 second.",
  };
  if (low.includes("unsupported audio")) return {
    title: "Unsupported audio format",
    cause: body.replace(/^.*?:\s*/, "Browser sent: ") || "Browser codec is not accepted upstream.",
    next: "Reload the page — a different codec will be negotiated.",
  };
  if (low.includes("audio file required") || low.includes("invalid form")) return {
    title: "Recording didn't reach the server",
    cause: body || "The upload was empty or malformed.",
    next: "Retry once — if it repeats, reload the page.",
  };
  if (status === 500 && low.includes("not configured")) return {
    title: "Voice service not configured",
    cause: "LOVABLE_API_KEY is missing on the server.",
    next: "Ask the project owner to enable Lovable AI.",
  };
  if (status === 502) return {
    title: "Transcription service unreachable",
    cause: "Gateway timed out or refused the connection.",
    next: "Retry in a few seconds.",
  };
  if (status && status >= 500) return {
    title: "Transcription server error",
    cause: body || `Upstream returned ${status}.`,
    next: "Retry — if it keeps failing, check server logs.",
  };
  return {
    title: "Transcription failed",
    cause: body || (status ? `HTTP ${status}` : "Unknown error"),
    next: "Retry, or reload the page if it persists.",
  };
}
