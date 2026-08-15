// Locale preferences shared by chat, realtime voice and news/search tools.

export type CountryCode =
  | "SA" | "AE" | "QA" | "KW" | "BH" | "OM" | "JO" | "EG"
  | "PK" | "IN" | "TR" | "GB" | "US" | "CA" | "AU" | "FR"
  | "ES" | "DE" | "MY" | "ID" | "NG" | "ZA";

export type TimezoneMode = "country" | "device";

export interface CountryOption {
  code: CountryCode;
  label: string;
  nativeLabel: string;
  timezone: string;
  newsQuery: string;
}

export const DEFAULT_COUNTRY: CountryCode = "SA";
export const DEFAULT_TIMEZONE_MODE: TimezoneMode = "country";

export const SUPPORTED_COUNTRIES: ReadonlyArray<CountryOption> = [
  { code: "SA", label: "Saudi Arabia", nativeLabel: "السعودية", timezone: "Asia/Riyadh", newsQuery: "Saudi Arabia" },
  { code: "AE", label: "United Arab Emirates", nativeLabel: "الإمارات", timezone: "Asia/Dubai", newsQuery: "United Arab Emirates" },
  { code: "QA", label: "Qatar", nativeLabel: "قطر", timezone: "Asia/Qatar", newsQuery: "Qatar" },
  { code: "KW", label: "Kuwait", nativeLabel: "الكويت", timezone: "Asia/Kuwait", newsQuery: "Kuwait" },
  { code: "BH", label: "Bahrain", nativeLabel: "البحرين", timezone: "Asia/Bahrain", newsQuery: "Bahrain" },
  { code: "OM", label: "Oman", nativeLabel: "عُمان", timezone: "Asia/Muscat", newsQuery: "Oman" },
  { code: "JO", label: "Jordan", nativeLabel: "الأردن", timezone: "Asia/Amman", newsQuery: "Jordan" },
  { code: "EG", label: "Egypt", nativeLabel: "مصر", timezone: "Africa/Cairo", newsQuery: "Egypt" },
  { code: "PK", label: "Pakistan", nativeLabel: "پاکستان", timezone: "Asia/Karachi", newsQuery: "Pakistan" },
  { code: "IN", label: "India", nativeLabel: "भारत", timezone: "Asia/Kolkata", newsQuery: "India" },
  { code: "TR", label: "Türkiye", nativeLabel: "Türkiye", timezone: "Europe/Istanbul", newsQuery: "Turkey" },
  { code: "GB", label: "United Kingdom", nativeLabel: "United Kingdom", timezone: "Europe/London", newsQuery: "United Kingdom" },
  { code: "US", label: "United States", nativeLabel: "United States", timezone: "America/New_York", newsQuery: "United States" },
  { code: "CA", label: "Canada", nativeLabel: "Canada", timezone: "America/Toronto", newsQuery: "Canada" },
  { code: "AU", label: "Australia", nativeLabel: "Australia", timezone: "Australia/Sydney", newsQuery: "Australia" },
  { code: "FR", label: "France", nativeLabel: "France", timezone: "Europe/Paris", newsQuery: "France" },
  { code: "ES", label: "Spain", nativeLabel: "España", timezone: "Europe/Madrid", newsQuery: "Spain" },
  { code: "DE", label: "Germany", nativeLabel: "Deutschland", timezone: "Europe/Berlin", newsQuery: "Germany" },
  { code: "MY", label: "Malaysia", nativeLabel: "Malaysia", timezone: "Asia/Kuala_Lumpur", newsQuery: "Malaysia" },
  { code: "ID", label: "Indonesia", nativeLabel: "Indonesia", timezone: "Asia/Jakarta", newsQuery: "Indonesia" },
  { code: "NG", label: "Nigeria", nativeLabel: "Nigeria", timezone: "Africa/Lagos", newsQuery: "Nigeria" },
  { code: "ZA", label: "South Africa", nativeLabel: "South Africa", timezone: "Africa/Johannesburg", newsQuery: "South Africa" },
];

const COUNTRY_CODES = new Set<CountryCode>(SUPPORTED_COUNTRIES.map((country) => country.code));
const COUNTRY_KEY = "alpha_country";
const TIMEZONE_MODE_KEY = "alpha_timezone_mode";

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* private mode/quota */ }
}

export function countryOption(code: CountryCode): CountryOption {
  return SUPPORTED_COUNTRIES.find((country) => country.code === code) ?? SUPPORTED_COUNTRIES[0];
}

export function loadCountry(): CountryCode {
  const stored = safeGet(COUNTRY_KEY);
  return stored && COUNTRY_CODES.has(stored as CountryCode) ? stored as CountryCode : DEFAULT_COUNTRY;
}

export function saveCountry(country: CountryCode): void {
  safeSet(COUNTRY_KEY, country);
}

export function loadTimezoneMode(): TimezoneMode {
  return safeGet(TIMEZONE_MODE_KEY) === "device" ? "device" : DEFAULT_TIMEZONE_MODE;
}

export function saveTimezoneMode(mode: TimezoneMode): void {
  safeSet(TIMEZONE_MODE_KEY, mode);
}

export function resolvedTimezone(country: CountryCode, mode: TimezoneMode): string {
  if (mode === "device") {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || countryOption(country).timezone;
    } catch {
      return countryOption(country).timezone;
    }
  }
  return countryOption(country).timezone;
}

export function localeContext(country: CountryCode, mode: TimezoneMode): string {
  const option = countryOption(country);
  return `The user's selected country/market is ${option.label} (${option.code}). Use ${resolvedTimezone(country, mode)} for dates and times unless the user explicitly specifies another timezone. Localize examples, currency and news relevance to ${option.label}, but never assume the user wants that country's law, prices or politics unless asked.`;
}
