/**
 * Microphone permission helpers — classify getUserMedia errors into
 * actionable categories, and probe the current permission state so we
 * can warn the user proactively (before they tap the orb).
 *
 * getUserMedia rejects with a DOMException whose `name` is the only
 * reliable signal across browsers. The messages are localized and vary
 * wildly, so we ignore them and switch on `name`.
 */

export type MicErrorKind =
  | "denied"       // User (or browser policy) blocked the prompt.
  | "not-found"    // No input device present on this machine.
  | "in-use"       // Device is exclusive-locked by another app / tab.
  | "insecure"     // getUserMedia needs HTTPS or localhost.
  | "unsupported"  // API not available at all (old browser, iframe policy).
  | "unknown";     // Anything else — kept generic on purpose.

export interface MicErrorInfo {
  kind: MicErrorKind;
  /** Short toast/banner title. Plain-language, no jargon. */
  title: string;
  /** One sentence explaining what happened and how to unblock. */
  description: string;
  /** Optional label for a "how to fix" action. When null, no action needed. */
  actionLabel: string | null;
}

export function classifyMicError(err: unknown): MicErrorInfo {
  const name =
    err && typeof err === "object" && "name" in err && typeof (err as { name: unknown }).name === "string"
      ? (err as { name: string }).name
      : "";

  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError": // legacy Chrome
      return {
        kind: "denied",
        title: "Microphone blocked",
        description:
          "JARVIS can't hear you until you allow the mic. Click the lock icon in the address bar → Site settings → set Microphone to Allow, then reload.",
        actionLabel: "How to fix",
      };
    case "NotFoundError":
    case "DevicesNotFoundError":
      return {
        kind: "not-found",
        title: "No microphone found",
        description:
          "Plug in or enable a microphone, then try again. On laptops, check that no privacy switch is toggled off.",
        actionLabel: null,
      };
    case "NotReadableError":
    case "TrackStartError":
      return {
        kind: "in-use",
        title: "Microphone is busy",
        description:
          "Another app or tab is using your mic (Zoom, Meet, Discord, another JARVIS tab…). Close it and try again.",
        actionLabel: null,
      };
    case "SecurityError":
      return {
        kind: "insecure",
        title: "Insecure connection",
        description:
          "Browsers only allow mic access over HTTPS. Open JARVIS via https:// (or localhost) and try again.",
        actionLabel: null,
      };
    case "TypeError":
      // getUserMedia itself missing — old browser or feature-policy blocked.
      return {
        kind: "unsupported",
        title: "Browser doesn't support the microphone API",
        description:
          "Try a recent Chrome, Edge, Firefox, or Safari. If you're in an embedded frame, open JARVIS in a full tab.",
        actionLabel: null,
      };
    default:
      return {
        kind: "unknown",
        title: "Couldn't start the microphone",
        description:
          "Something went wrong reaching your mic. Try again; if it repeats, reload the page.",
        actionLabel: null,
      };
  }
}

/**
 * Probe the browser's current mic permission state without prompting the
 * user. Returns `null` when the Permissions API can't answer for the mic
 * (Safari < 16, some Firefox versions) — callers should treat that as
 * "unknown, no banner" rather than assuming granted or denied.
 */
export async function queryMicPermission(): Promise<PermissionState | null> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return null;
  try {
    // The permission name isn't in the standard PermissionName union in all
    // TS libs, so cast narrowly rather than widening the whole call.
    const status = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    return status.state;
  } catch {
    // Some browsers throw on unknown permission names — treat as unknown.
    return null;
  }
}

/**
 * Subscribe to permission-state changes (user toggles allow/block in
 * settings while the tab is open). Returns an unsubscribe function.
 * No-ops when the Permissions API isn't available.
 */
export function watchMicPermission(
  onChange: (state: PermissionState) => void,
): () => void {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return () => {};
  let status: PermissionStatus | null = null;
  let cancelled = false;
  const handler = () => {
    if (status) onChange(status.state);
  };
  void navigator.permissions
    .query({ name: "microphone" as PermissionName })
    .then((s) => {
      if (cancelled) return;
      status = s;
      s.addEventListener("change", handler);
    })
    .catch(() => {
      /* ignore — unsupported */
    });
  return () => {
    cancelled = true;
    status?.removeEventListener("change", handler);
  };
}
