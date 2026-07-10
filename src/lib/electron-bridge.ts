// Thin, safe wrapper around the Electron preload bridge (`window.alpha`).
// Every function no-ops (or falls back to a browser equivalent) when the app
// is running in a normal browser — so call sites don't branch.

type Bridge = {
  version: string;
  platform: NodeJS.Platform;
  openExternal: (url: string) => Promise<boolean>;
  notify: (title: string, body?: string) => void;
  setAutoLaunch: (enabled: boolean) => Promise<boolean>;
  getAutoLaunch: () => Promise<boolean>;
  onHotkey: (cb: () => void) => () => void;
  onTrayAction: (cb: (action: "start" | "stop" | "show") => void) => () => void;
  quit: () => void;
};

declare global {
  interface Window {
    alpha?: Bridge;
  }
}

export function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.alpha;
}

/** Open a URL. Uses Electron shell when available (bypasses popup blocker),
 *  otherwise `window.open`. Returns true if the open likely succeeded. */
export async function openExternal(url: string): Promise<boolean> {
  if (isElectron()) {
    try { return await window.alpha!.openExternal(url); } catch { return false; }
  }
  const w = typeof window !== "undefined" ? window.open(url, "_blank", "noopener,noreferrer") : null;
  return !!w;
}

export function notify(title: string, body?: string): void {
  if (isElectron()) {
    try { window.alpha!.notify(title, body); return; } catch { /* fallthrough */ }
  }
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      try { new Notification(title, { body, icon: "/alpha-icon.png" }); } catch { /* noop */ }
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((p) => {
        if (p === "granted") { try { new Notification(title, { body, icon: "/alpha-icon.png" }); } catch { /* noop */ } }
      });
    }
  }
}

export async function setAutoLaunch(enabled: boolean): Promise<boolean> {
  if (!isElectron()) return false;
  try { return await window.alpha!.setAutoLaunch(enabled); } catch { return false; }
}

export async function getAutoLaunch(): Promise<boolean> {
  if (!isElectron()) return false;
  try { return await window.alpha!.getAutoLaunch(); } catch { return false; }
}

export function onGlobalHotkey(cb: () => void): () => void {
  if (!isElectron()) return () => {};
  return window.alpha!.onHotkey(cb);
}

export function onTrayAction(cb: (a: "start" | "stop" | "show") => void): () => void {
  if (!isElectron()) return () => {};
  return window.alpha!.onTrayAction(cb);
}

export function electronPlatform(): NodeJS.Platform | null {
  return isElectron() ? window.alpha!.platform : null;
}
