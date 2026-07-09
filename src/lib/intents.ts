// Phase-1 Jarvis intents — pure client-side pattern matcher.
// Zero network cost, zero latency. Returns a deep-link URL the app opens
// in a new tab. If a message is included the target app (WhatsApp, mail,
// SMS) opens pre-filled; the user hits Send. That's a browser-security
// constraint, not a design choice.

export type Intent = {
  kind: string;         // e.g. "open" | "whatsapp" | "search"
  label: string;        // "Open WhatsApp" — for toast/log
  url: string;          // where we navigate
  prefilled?: string;   // when the target app is pre-filled with a message
};

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

/** Detect a Jarvis intent from a final user transcript. */
export function detectIntent(raw: string): Intent | null {
  const text = norm(raw);
  if (!text) return null;

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
  const search = /(?:search(?:\s+for)?|google|find|dhoondo|khoj)\s+(.+)/.exec(text);
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
    /^(?:open|launch|start|go to|visit)\s+(.+)$/.exec(text) ||
    /^(.+?)\s+(?:kholo|khol do|kholiye|open karo|open kar do)$/.exec(text);
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