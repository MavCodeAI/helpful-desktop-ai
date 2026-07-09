/**
 * Thin wrapper around the Lovable AI Gateway HTTP surface.
 *
 * Every server route (chat, stt, tts) reads LOVABLE_API_KEY through
 * `readGatewayKey()` and hits the gateway with `gatewayFetch()` so headers
 * + base URL live in one place. Wire format is unchanged (Bearer auth,
 * plain-text error bodies with upstream status) so the client parser in
 * `src/lib/friendly-error.ts` continues to work as-is.
 */

export const GATEWAY_BASE_URL = "https://ai.gateway.lovable.dev/v1";

/**
 * Read LOVABLE_API_KEY from the per-request env. Returns `null` when the
 * key is missing so callers can respond with their own 500 message
 * (existing routes use "Voice service is not configured" etc — we keep
 * those strings so client toasts don't regress).
 */
export function readGatewayKey(): string | null {
  return process.env.LOVABLE_API_KEY || null;
}

export function gatewayFetch(path: string, init: RequestInit): Promise<Response> {
  const key = readGatewayKey();
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${key}`);
  return fetch(`${GATEWAY_BASE_URL}${path}`, { ...init, headers });
}
