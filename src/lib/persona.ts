// Persona presets, language config, and long-term memory storage.
// Injected into the realtime session's system_instruction.

export type LangCode = "auto" | "en" | "ur" | "ar" | "hi" | "tr" | "fr" | "es";
export type PersonaId = "alpha" | "jarvis" | "friday" | "custom";

export const PERSONAS: Record<Exclude<PersonaId, "custom">, { name: string; prompt: string }> = {
  alpha: {
    name: "Alpha (default)",
    prompt:
      "You are Alpha, a warm, brilliant personal assistant. Be concise, confident, first-principles. Prefer short answers. Never fake abilities you don't have.",
  },
  jarvis: {
    name: "J.A.R.V.I.S.",
    prompt:
      "You are J.A.R.V.I.S., a witty British AI butler in the style of Tony Stark's assistant. Address the user as 'sir'. Dry humour, elegant phrasing, always three steps ahead. Keep replies brief.",
  },
  friday: {
    name: "F.R.I.D.A.Y.",
    prompt:
      "You are F.R.I.D.A.Y., a sharp, cheerful, no-nonsense AI companion. American accent style, practical, quick. Short answers, action-oriented.",
  },
};

const LANG_HINT: Record<LangCode, string> = {
  auto: "Reply in the same language the user spoke. If the user mixes languages, follow the dominant language and preserve important names and technical terms.",
  en: "Always reply in clear, natural English.",
  ur: "ہمیشہ صاف اور قدرتی اردو میں جواب دیں۔ ضرورت کے مطابق Roman Urdu یا English technical terms رکھ سکتے ہیں۔",
  ar: "أجب دائمًا باللغة العربية الفصحى الواضحة، مع الحفاظ على أسماء المنتجات والمصطلحات التقنية كما هي عند الحاجة.",
  hi: "हमेशा स्वाभाविक और स्पष्ट हिंदी में उत्तर दें। तकनीकी नाम और उत्पाद नाम आवश्यकतानुसार वैसे ही रखें।",
  tr: "Always reply in clear, natural Turkish.",
  fr: "Always reply in clear, natural French.",
  es: "Always reply in clear, natural Spanish.",
};

export const LANG_STT_CODE: Record<LangCode, string | undefined> = {
  auto: undefined,
  en: "en-US",
  ur: "ur-PK",
  ar: "ar-SA",
  hi: "hi-IN",
  tr: "tr-TR",
  fr: "fr-FR",
  es: "es-ES",
};

export const SUPPORTED_LANGUAGES: ReadonlyArray<{ code: LangCode; label: string; nativeLabel: string }> = [
  { code: "auto", label: "Auto-detect", nativeLabel: "خودکار" },
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "ur", label: "Urdu", nativeLabel: "اردو" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "tr", label: "Turkish", nativeLabel: "Türkçe" },
  { code: "fr", label: "French", nativeLabel: "Français" },
  { code: "es", label: "Spanish", nativeLabel: "Español" },
];

const KEY_PERSONA = "alpha_persona";
const KEY_CUSTOM = "alpha_persona_custom";
const KEY_LANG = "alpha_lang";
const KEY_MEMS = "alpha_memories";
const MAX_MEMORIES = 25;
const LANG_CODES = new Set<LangCode>(SUPPORTED_LANGUAGES.map((item) => item.code));

const safe = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* quota */ } },
};

export function loadPersona(): PersonaId {
  const v = safe.get(KEY_PERSONA);
  return v === "jarvis" || v === "friday" || v === "custom" ? v : "alpha";
}
export function savePersona(p: PersonaId) { safe.set(KEY_PERSONA, p); }

export function loadCustomPrompt(): string { return safe.get(KEY_CUSTOM) || ""; }
export function saveCustomPrompt(v: string) { safe.set(KEY_CUSTOM, v); }

export function loadLang(): LangCode {
  const v = safe.get(KEY_LANG);
  return v && LANG_CODES.has(v as LangCode) ? (v as LangCode) : "auto";
}
export function saveLang(l: LangCode) { safe.set(KEY_LANG, l); }

export function loadMemories(): string[] {
  const raw = safe.get(KEY_MEMS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string").slice(0, MAX_MEMORIES) : [];
  } catch { return []; }
}
export function saveMemories(m: string[]) { safe.set(KEY_MEMS, JSON.stringify(m.slice(0, MAX_MEMORIES))); }
export function addMemory(text: string) {
  const t = text.trim();
  if (!t) return;
  const cur = loadMemories();
  if (cur.some((x) => x.toLowerCase() === t.toLowerCase())) return;
  saveMemories([t, ...cur]);
}
export function removeMemory(idx: number) {
  const cur = loadMemories();
  cur.splice(idx, 1);
  saveMemories(cur);
}
export function clearMemories() { saveMemories([]); }

export function personaBasePrompt(persona: PersonaId, custom: string): string {
  if (persona === "custom") return custom.trim() || PERSONAS.alpha.prompt;
  return PERSONAS[persona].prompt;
}

/** Full system prompt: persona + language + memories. */
export function buildPersonaSystemPrompt(opts: {
  persona: PersonaId;
  customPrompt: string;
  lang: LangCode;
  memories: string[];
}): string {
  const parts = [
    personaBasePrompt(opts.persona, opts.customPrompt),
    LANG_HINT[opts.lang],
    "You are a Saudi-Arabia-first productivity assistant. Use Asia/Riyadh for dates and times unless the user specifies another timezone. Never send, delete, purchase, publish, or change an external system without explicit user approval.",
  ];
  const mems = opts.memories.filter(Boolean).slice(0, MAX_MEMORIES);
  if (mems.length) {
    parts.push(
      "Long-term memory about the user (use naturally when relevant):\n" +
        mems.map((m, i) => `${i + 1}. ${m}`).join("\n"),
    );
  }
  return parts.join("\n\n");
}
