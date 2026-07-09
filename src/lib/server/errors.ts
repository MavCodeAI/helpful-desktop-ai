/**
 * Shared server-side error mapping.
 *
 * A Lovable AI Gateway call can fail with:
 *   402  credits exhausted
 *   429  rate-limited (retryable with Retry-After)
 *   401  bad key
 *   4xx  input problem (bad model, oversized input)
 *   5xx  transient upstream
 *
 * `gatewayError()` turns any fetch failure into a JSON response the client
 * can inspect. The client mirror lives in src/lib/friendly-error.ts.
 */

export type GatewayErrorShape = {
  error: string;
  status: number;
  retryAfterSec?: number;
};

export function parseRetryAfter(res: Response): number | undefined {
  const h = res.headers.get("retry-after");
  if (!h) return undefined;
  const n = parseInt(h, 10);
  if (Number.isFinite(n) && n > 0) return n;
  const d = Date.parse(h);
  if (Number.isFinite(d)) return Math.max(1, Math.round((d - Date.now()) / 1000));
  return undefined;
}

export function gatewayError(status: number, message: string, retryAfterSec?: number): Response {
  const body: GatewayErrorShape = { error: message, status, ...(retryAfterSec ? { retryAfterSec } : {}) };
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (retryAfterSec) headers["Retry-After"] = String(retryAfterSec);
  return new Response(JSON.stringify(body), { status, headers });
}

export async function toGatewayError(res: Response): Promise<Response> {
  const txt = await res.text().catch(() => "");
  return gatewayError(res.status, txt || `Upstream ${res.status}`, parseRetryAfter(res));
}
