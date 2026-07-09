/**
 * Thin wrapper around the Lovable AI Gateway HTTP surface.
 *
 * Every server route (chat, stt, tts, realtime-token) should read
 * LOVABLE_API_KEY through `readGatewayKey()` and hit the gateway with
 * `gatewayFetch()` so headers + base URL live in one place. This keeps the
 * SDK boundary honest and lets the whole app pivot providers by editing
 * one file.
 */

export const GATEWAY_BASE_URL = "https://ai.gateway.lovable.dev/v1";

export function readGatewayKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  return key;
}

export function gatewayFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const key = readGatewayKey();
  const headers = new Headers(init.headers);
  headers.set("Lovable-API-Key", key);
  if (!headers.has("X-Lovable-AIG-SDK")) headers.set("X-Lovable-AIG-SDK", "raw-fetch");
  return fetch(`${GATEWAY_BASE_URL}${path}`, { ...init, headers });
}
