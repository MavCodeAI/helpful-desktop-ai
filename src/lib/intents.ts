// Phase-1 Jarvis intents — pure client-side pattern matcher.
// Zero network cost, zero latency. Returns either a deep-link URL the app
// opens in a new tab, or an in-app action (timer/note/clipboard/screenshot).

export type Intent = {
  kind: string;         // "open" | "whatsapp" | "search" | "timer" | "note" | ...
  label: string;        // "Open WhatsApp" — for toast/log
  url: string;          // where we navigate (empty for in-app kinds)
  prefilled?: string;   // when the target app is pre-filled with a message
  action?:              // in-app action executed by use-intent-actions
    | { type: "timer"; seconds: number; label: string }
    | { type: "note"; text: string }
    | { type: "clipboard-copy"; text: string }
    | { type: "clipboard-read" }
    | { type: "screenshot" }
    | { type: "screen-vision" }
    | { type: "ai-answer"; question: string }
    | { type: "memory-add"; text: string }
    | { type: "file-open" }
    | { type: "file-save" }
    | { type: "coming-soon"; feature: string };
};

/** Detect a note command in text; return the note body or null.
 * Broader than the intent switch: covers "note", "note likho", "take a note",
 * "remember", "yaad rakho", "note kar do/karo/karna", "save as note", etc. */
export function matchNoteIntent(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const patterns: RegExp[] = [
    /^(?:note|notes?|take\s+a?\s*note|save\s+(?:as\s+)?note|jot(?:\s+down)?|remember|yaad\s+rakho|note\s+likho|note\s+kar\s*do|note\s+karo|note\s+karna|likh\s+lo|likho|ملاحظة|ملاحظه|دوّن|دون|تذكر|تذكّر|اكتب|سجّل|سجل|احفظ)\s*[:،\-–—]\s*(.+)$/i,
    /^(?:note|take\s+a?\s*note|remember|yaad\s+rakho|note\s+likho|note\s+kar\s*do|note\s+karo|note\s+karna|likh\s+lo|likho|ملاحظة|ملاحظه|دوّن|دون|تذكر|تذكّر|اكتب|سجّل|سجل|احفظ)\s+(.+)$/i,
    /^(.+?)\s+(?:ko\s+)?note\s+(?:likho|kar\s*do|karo|karna)$/i,
    /^(.+?)\s+(?:ko\s+)?(?:yaad\s+rakho|remember)$/i,
  ];
  for (const re of patterns) {
    const m = re.exec(t);
    if (m) {
      const body = m[1].trim().replace(/^["'`]|["'`]$/g, "");
      if (body.length > 1) return body;
    }
  }
  return null;
}

// ── App aliases → home URLs ───────────────────────────────────────────
// Only include apps that have a real web presence; native-only apps get
// dropped so we don't 404. Web URLs by default; the OS deep-links the
// installed app on mobile where available.
const APPS: Record<string, { url: string; name: string }> = {
  facebook:  { url: "https://facebook.com",         name: "Facebook"  },
  fb:        { url: "https://facebook.com",         name: "Facebook"  },
  instagram: { url: "https://instagram.com",        name: "Instagram" },
  insta:     { url: "https://instagram.com",        name: "Instagram" },
  ig:        { url: "https://instagram.com",        name: "Instagram" },
  twitter:   { url: "https://x.com",                name: "X"         },
  x:         { url: "https://x.com",                name: "X"         },
  youtube:   { url: "https://youtube.com",          name: "YouTube"   },
  yt:        { url: "https://youtube.com",          name: "YouTube"   },
  whatsapp:  { url: "https://web.whatsapp.com",     name: "WhatsApp"  },
  wa:        { url: "https://web.whatsapp.com",     name: "WhatsApp"  },
  gmail:     { url: "https://mail.google.com",      name: "Gmail"     },
  mail:      { url: "https://mail.google.com",      name: "Gmail"     },
  telegram:  { url: "https://web.telegram.org",     name: "Telegram"  },
  linkedin:  { url: "https://linkedin.com",         name: "LinkedIn"  },
  github:    { url: "https://github.com",           name: "GitHub"    },
  reddit:    { url: "https://reddit.com",           name: "Reddit"    },
  tiktok:    { url: "https://tiktok.com",           name: "TikTok"    },
  spotify:   { url: "https://open.spotify.com",     name: "Spotify"   },
  netflix:   { url: "https://netflix.com",          name: "Netflix"   },
  amazon:    { url: "https://amazon.com",           name: "Amazon"    },
  wikipedia: { url: "https://wikipedia.org",        name: "Wikipedia" },
  wiki:      { url: "https://wikipedia.org",        name: "Wikipedia" },
  google:    { url: "https://google.com",           name: "Google"    },
  "جوجل":    { url: "https://google.com",           name: "Google"    },
  "غوغل":    { url: "https://google.com",           name: "Google"    },
  maps:      { url: "https://maps.google.com",      name: "Google Maps" },
  drive:     { url: "https://drive.google.com",     name: "Google Drive" },
  calendar:  { url: "https://calendar.google.com",  name: "Google Calendar" },
  chatgpt:   { url: "https://chat.openai.com",      name: "ChatGPT"   },
  claude:    { url: "https://claude.ai",            name: "Claude"    },
  lovable:   { url: "https://lovable.dev",          name: "Lovable"   },
};

function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/[.,!?؟।]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Extract a bare phone number (E.164 or local digits). Returns without +.
function extractPhone(s: string): string | null {
  const m = s.match(/(\+?\d[\d\s\-()]{6,}\d)/);
  if (!m) return null;
  const digits = m[1].replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

function findApp(fragment: string): { key: string; app: { url: string; name: string } } | null {
  const f = ` ${fragment} `;
  // Prefer longer aliases first
  const keys = Object.keys(APPS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (f.includes(` ${k} `)) return { key: k, app: APPS[k] };
  }
  return null;
}

const DUR_UNITS: Record<string, number> = {
  s: 1, sec: 1, secs: 1, second: 1, seconds: 1, ث: 1, ثانية: 1, ثواني: 1,
  m: 60, min: 60, mins: 60, minute: 60, minutes: 60, د: 60, دقيقة: 60, دقائق: 60,
  h: 3600, hr: 3600, hrs: 3600, hour: 3600, hours: 3600, س: 3600, ساعة: 3600, ساعات: 3600,
};
function parseDurationLocal(text: string): number | null {
  const re = /(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|ثواني?|ث|دقائق?|د|ساعات?|س)/giu;
  let total = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) total += parseFloat(m[1]) * (DUR_UNITS[m[2].toLowerCase()] ?? 0);
  return total > 0 ? Math.round(total) : null;
}

/** Detect a Jarvis intent from a final user transcript. */
export function detectIntent(raw: string): Intent | null {
  const text = norm(raw);
  if (!text) return null;

  // ── 0a. Smart Home / IoT — Coming Soon ──────────────────────────────
  {
    const deviceMatch = text.match(/\b(light|lights|bulb|lamp|fan|ac|air ?conditioner|tv|thermostat|heater|geyser|plug|switch|curtain|door|lock|camera)\b/);
    const actionMatch = text.match(/\b(on|off|dim|kholo|band|chala|bujha|open|close|lock|unlock|start|stop)\b/);
    const isRoutine = /\b(smart home|home automation|iot|good morning|good night|away mode|routine|scene)\b/.test(text);
    if ((deviceMatch && actionMatch) || isRoutine || /\b(turn|switch)\s+(on|off)\b.*\b(light|lights|fan|tv|ac)\b/.test(text)) {
      const device = deviceMatch?.[1] ?? "Smart Home";
      const pretty = device.charAt(0).toUpperCase() + device.slice(1);
      return {
        kind: "coming-soon",
        label: `${pretty} — Coming Soon`,
        url: "",
        action: { type: "coming-soon", feature: isRoutine && !deviceMatch ? "Smart Home routines" : `${pretty} control` },
      };
    }
  }


  // ── 0b. Timer / Alarm ───────────────────────────────────────────────
  // "5 minute ka timer", "set a timer for 2 minutes 30 seconds", "10 second timer"
  if (/(?:\btimer\b|\balarm\b|\bremind\s+me\b|\byaad\s+dilana\b|مؤقت|منبه|ذكرني|ذكّرني)/u.test(text)) {
    const secs = parseDurationLocal(text);
    if (secs && secs > 0) {
      const mm = Math.floor(secs / 60), ss = secs % 60;
      const human = mm > 0 ? `${mm}m${ss ? ` ${ss}s` : ""}` : `${ss}s`;
      return {
        kind: "timer",
        label: `Timer · ${human}`,
        url: "",
        action: { type: "timer", seconds: secs, label: `Timer ${human}` },
      };
    }
  }

  // ── 0c. Note ────────────────────────────────────────────────────────
  const noteBody = matchNoteIntent(text);
  if (noteBody) {
    return {
      kind: "note",
      label: `Note · "${noteBody.slice(0, 40)}${noteBody.length > 40 ? "…" : ""}"`,
      url: "",
      action: { type: "note", text: noteBody },
    };
  }

  // ── 0d. Clipboard ───────────────────────────────────────────────────
  const copyMatch = /^(?:copy|clipboard\s+(?:me|par)\s+(?:daalo|rakho))\s+(.+)$/i.exec(text)
                 || /^(.+?)\s+(?:copy karo|clipboard me daalo)$/i.exec(text);
  if (copyMatch) {
    return {
      kind: "clipboard",
      label: "Copied to clipboard",
      url: "",
      action: { type: "clipboard-copy", text: copyMatch[1].trim() },
    };
  }
  if (/^(?:read clipboard|clipboard padho|paste karo)$/i.test(text)) {
    return { kind: "clipboard", label: "Read clipboard", url: "", action: { type: "clipboard-read" } };
  }

  // ── 0e. Screenshot ──────────────────────────────────────────────────
  if (/\b(screenshot|screen shot|screen capture|screen ki tasveer)\b/.test(text)) {
    return { kind: "screenshot", label: "Screenshot", url: "", action: { type: "screenshot" } };
  }

  // ── 0e2. Screen understanding (AI vision) ───────────────────────────
  if (/\b(screen dekho|what'?s on (my )?screen|describe (my )?screen|screen padho|screen samjho|analyze screen|شاشة)\b/.test(text)) {
    return { kind: "screen-vision", label: "Read my screen", url: "", action: { type: "screen-vision" } };
  }

  // ── 0e3. AI answer (real answer, not just Google open) ─────────────
  const aiAsk = /^(?:ai(?:\s+se)?\s+(?:pooch(?:o|iye)|puchho|batao|ask)|ask\s+ai|answer\s+this|jawab\s+do|اسأل)\s*[:،-]?\s*(.+)$/i.exec(text);
  if (aiAsk) {
    const q = aiAsk[1].trim();
    if (q.length > 2) {
      return {
        kind: "ai-answer",
        label: `AI · "${q.slice(0, 40)}${q.length > 40 ? "…" : ""}"`,
        url: "",
        action: { type: "ai-answer", question: q },
      };
    }
  }

  // ── 0e4. Memory add ("remember that ..." / "yaad rakho ...") ────────
  const remember = /^(?:remember\s+(?:that\s+)?|yaad\s+(?:rakho|rakhna)|تذكر\s+أن)\s*[:،-]?\s*(.+)$/i.exec(text);
  if (remember) {
    const t = remember[1].trim();
    if (t.length > 2) {
      return {
        kind: "memory",
        label: `Remembered · "${t.slice(0, 40)}${t.length > 40 ? "…" : ""}"`,
        url: "",
        action: { type: "memory-add", text: t },
      };
    }
  }

  // ── 0e5. File operations (Electron + File System Access API) ────────
  if (/^(?:open (?:a )?file|file kholo|فتح ملف)$/i.test(text)) {
    return { kind: "file", label: "Open file…", url: "", action: { type: "file-open" } };
  }
  if (/^(?:save (?:a )?file|file save karo|حفظ ملف)$/i.test(text)) {
    return { kind: "file", label: "Save file…", url: "", action: { type: "file-save" } };
  }


  // ── 0f. Weather ─────────────────────────────────────────────────────
  const weather = /(?:weather|mausam|temperature)(?:\s+(?:in|of|ka)\s+(.+))?/i.exec(text);
  if (weather) {
    const place = (weather[1] || "").trim();
    const q = place ? `weather ${place}` : "weather";
    return {
      kind: "weather",
      label: place ? `Weather → ${place}` : "Weather",
      url: `https://www.google.com/search?q=${encodeURIComponent(q)}`,
    };
  }

  // ── 0g. Translate ───────────────────────────────────────────────────
  const trans = /(?:translate|tarjuma|ترجم)\s+(.+?)(?:\s+(?:to|into|me|mein|إلى|الى)\s+([a-z\u0600-\u06ff]+))?$/iu.exec(text);
  if (trans) {
    const phrase = trans[1].trim();
    const tl = (trans[2] || "en").toLowerCase().slice(0, 5);
    if (phrase) {
      return {
        kind: "translate",
        label: `Translate → "${phrase}"`,
        url: `https://translate.google.com/?sl=auto&tl=${encodeURIComponent(tl)}&text=${encodeURIComponent(phrase)}&op=translate`,
      };
    }
  }

  // ── 0h. Calculator ──────────────────────────────────────────────────
  const calc = /^(?:calculate|calc|calculator|hisaab|jama|zarb)\s+(.+)$/i.exec(text)
            || /^([\d\s+\-*/().^%]{3,})$/.exec(text);
  if (calc) {
    const expr = calc[1].trim();
    return {
      kind: "calculator",
      label: `Calc → ${expr}`,
      url: `https://www.google.com/search?q=${encodeURIComponent(expr)}`,
    };
  }


  // ── 1. WhatsApp with a message ──────────────────────────────────────
  // "whatsapp +923001234567 tell him salaam"
  // "send whatsapp to 03001234567 saying I'm running late"
  // "whatsapp par <number> ko message karo <msg>"
  const waPhone = /whats?app|wa\b/.test(text) ? extractPhone(text) : null;
  if (waPhone) {
    const msg = text
      .replace(/\+?\d[\d\s\-()]{6,}\d/, " ")
      .replace(/\b(?:whats?app|wa|send|message|msg|to|par|ko|karo|kar\s*do|please|kar|saying|that|bhejo|do)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const encoded = encodeURIComponent(msg);
    return {
      kind: "whatsapp",
      label: msg ? `WhatsApp → ${waPhone} · "${msg}"` : `WhatsApp → ${waPhone}`,
      url: `https://wa.me/${waPhone}${msg ? `?text=${encoded}` : ""}`,
      prefilled: msg || undefined,
    };
  }

  // ── 2. Email ────────────────────────────────────────────────────────
  // "email foo@bar.com subject Hello body ..." / "gmail foo@bar.com ..."
  const emailMatch = text.match(/([\w.+-]+@[\w-]+\.[\w.-]+)/);
  if (emailMatch && /(email|mail|gmail)/.test(text)) {
    const to = emailMatch[1];
    const subj = /subject\s+(.+?)(?:\s+body\s+|$)/.exec(text)?.[1] ?? "";
    const body = /body\s+(.+)$/.exec(text)?.[1] ?? "";
    const q = new URLSearchParams();
    if (subj) q.set("subject", subj);
    if (body) q.set("body", body);
    const qs = q.toString();
    return {
      kind: "email",
      label: `Email → ${to}${subj ? ` · ${subj}` : ""}`,
      url: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}${qs ? `&${qs}` : ""}`,
      prefilled: body || subj || undefined,
    };
  }

  // ── 3. SMS ──────────────────────────────────────────────────────────
  if (/\b(sms|text message|message)\b/.test(text)) {
    const num = extractPhone(text);
    if (num) {
      const msg = text
        .replace(/\+?\d[\d\s\-()]{6,}\d/, " ")
        .replace(/\b(?:sms|text\s+message|message|to|saying|please|kar\s*do|bhejo)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      return {
        kind: "sms",
        label: msg ? `SMS → ${num} · "${msg}"` : `SMS → ${num}`,
        url: `sms:${num}${msg ? `?body=${encodeURIComponent(msg)}` : ""}`,
        prefilled: msg || undefined,
      };
    }
  }

  // ── 4. YouTube: "play X on youtube" / "youtube X" ───────────────────
  const yt = /(?:play\s+(.+?)\s+on\s+youtube|youtube\s+(?:pe\s+|par\s+|search\s+|dekho\s+)?(.+))/.exec(text);
  if (yt) {
    const q = (yt[1] || yt[2] || "").trim();
    if (q) {
      return {
        kind: "youtube",
        label: `YouTube → "${q}"`,
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
      };
    }
  }

  // ── 5. Maps: "maps X" / "directions to X" / "X ka rasta" ────────────
  const maps = /(?:google maps?|maps?)\s+(.+)|directions?\s+to\s+(.+)/.exec(text);
  if (maps) {
    const q = (maps[1] || maps[2] || "").trim();
    if (q) {
      return {
        kind: "maps",
        label: `Maps → "${q}"`,
        url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
      };
    }
  }

  // ── 6. Web search: "search X" / "google X" / "X search kar" ─────────
  const search = /(?:search(?:\s+for)?|google|find|dhoondo|khoj|ابحث(?:\s+عن)?|بحث\s+عن)\s+(.+)/u.exec(text);
  if (search) {
    const q = search[1].replace(/\s+on\s+google$/, "").trim();
    if (q) {
      return {
        kind: "search",
        label: `Google → "${q}"`,
        url: `https://www.google.com/search?q=${encodeURIComponent(q)}`,
      };
    }
  }

  // ── 7. Open <app> ───────────────────────────────────────────────────
  // English: "open X" / "launch X" / "go to X"
  // Urdu/Hindi transliteration: "X kholo" / "X khol do" / "X open karo"
  const openMatch =
    /^(?:open|launch|start|go to|visit|افتح|شغّل|شغل|اذهب\s+(?:إلى|الى))\s+(.+)$/iu.exec(text) ||
    /^(.+?)\s+(?:kholo|khol do|kholiye|open karo|open kar do|افتح|افتحه|شغّل|شغل)$/iu.exec(text);
  if (openMatch) {
    const rest = openMatch[1].trim();
    // Try alias first
    const app = findApp(rest);
    if (app) {
      return { kind: "open", label: `Open ${app.app.name}`, url: app.app.url };
    }
    // Bare domain? "open example.com"
    const domain = rest.match(/^([\w-]+\.[a-z]{2,})(\/\S*)?$/i);
    if (domain) {
      return { kind: "open", label: `Open ${domain[1]}`, url: `https://${rest}` };
    }
    // Fallback: search the phrase
    return {
      kind: "search",
      label: `Google → "${rest}"`,
      url: `https://www.google.com/search?q=${encodeURIComponent(rest)}`,
    };
  }

  // ── 8. Bare app name (last resort) ──────────────────────────────────
  const bare = findApp(text);
  if (bare && text.split(" ").length <= 3) {
    return { kind: "open", label: `Open ${bare.app.name}`, url: bare.app.url };
  }

  return null;
}