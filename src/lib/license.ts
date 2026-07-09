/**
 * License management for JARVIS (mock implementation).
 *
 * This module gates access to the assistant with a simple license key check.
 * The current implementation is intentionally client-side and mock: real SaaS
 * wiring (server validation, expiry, seat limits) will replace it later. It
 * accepts either a known demo key or any key matching the JARVIS-XXXX-XXXX
 * pattern so testers can try the flow without server support.
 */

/**
 * Hard-coded demo keys that always validate. Useful for QA and screenshots.
 * Remove or replace with a server call once real licensing exists.
 */
const VALID_KEYS = new Set(["JARVIS-DEMO-0001", "JARVIS-DEMO-0002", "STARK-INDUSTRIES-001"]);

/**
 * Structural pattern for user-generated keys. Case-insensitive; the third
 * quad is optional so both 2-quad and 3-quad formats work.
 * Example matches: "JARVIS-A1B2-C3D4", "jarvis-abcd-1234-efgh".
 */
const KEY_PATTERN = /^JARVIS-[A-Z0-9]{4}-[A-Z0-9]{4}(-[A-Z0-9]{4})?$/i;

/** localStorage key under which the active license is persisted. */
const STORAGE_KEY = "jarvis.license";

/**
 * Validate a license key.
 *
 * @param key - Raw user input from the license field. Whitespace and case
 *              are normalized here so callers don't need to pre-process.
 * @returns `true` if the key is a known demo key or matches the accepted
 *          structural pattern, otherwise `false`.
 */
export function validateLicenseKey(key: string): boolean {
  const k = key.trim().toUpperCase();
  if (!k) return false;
  return VALID_KEYS.has(k) || KEY_PATTERN.test(k);
}

/**
 * Persist the active license key in the browser so the user does not have
 * to re-enter it on every visit. Safe to call during SSR (no-op).
 *
 * Returns `true` on success, `false` if storage is unavailable (private
 * browsing, quota exceeded, disabled cookies). Callers can decide whether
 * to warn or continue in-memory only.
 *
 * @param key - The validated license key to store. Normalized to uppercase.
 */
export function saveLicense(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(STORAGE_KEY, key.trim().toUpperCase());
    return true;
  } catch (e) {
    console.warn("[license] persist failed", e);
    return false;
  }
}

/**
 * Read the currently stored license, if any.
 *
 * @returns The saved license string, or `null` when none is stored or when
 *          called during server-side rendering.
 */
export function getLicense(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

/**
 * Remove the stored license. Called on sign-out so the license gate
 * shows again on the next visit.
 */
export function clearLicense() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
