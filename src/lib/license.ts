// Mock license validation. Real SaaS wiring comes later.
const VALID_KEYS = new Set([
  "JARVIS-DEMO-0001",
  "JARVIS-DEMO-0002",
  "STARK-INDUSTRIES-001",
]);

const KEY_PATTERN = /^JARVIS-[A-Z0-9]{4}-[A-Z0-9]{4}(-[A-Z0-9]{4})?$/i;

export function validateLicenseKey(key: string): boolean {
  const k = key.trim().toUpperCase();
  if (!k) return false;
  return VALID_KEYS.has(k) || KEY_PATTERN.test(k);
}

const STORAGE_KEY = "jarvis.license";

export function saveLicense(key: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, key.trim().toUpperCase());
}

export function getLicense(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function clearLicense() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
