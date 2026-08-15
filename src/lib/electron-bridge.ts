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
  readFile: () => Promise<{ name: string; content: string } | null>;
  writeFile: (name: string, content: string) => Promise<boolean>;
  getHotkey: () => Promise<string>;
  getActiveWindow: () => Promise<string | null>;
  captureScreenshot: () => Promise<{ name: string } | null>;
  openFolder: (key: string) => Promise<{ key: string; label: string } | null>;
  launchPinnedApp: (key: string) => Promise<{ key: string; label: string } | null>;
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

// ── File operations ─────────────────────────────────────────────────
// Electron: uses native dialog + fs. Browser: File System Access API
// (Chromium only). Safari falls back to <input type=file>/download link.

export async function readTextFile(): Promise<{ name: string; content: string } | null> {
  if (isElectron()) {
    try { return await window.alpha!.readFile(); } catch { return null; }
  }
  // File System Access API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (typeof w.showOpenFilePicker === "function") {
    try {
      const [handle] = await w.showOpenFilePicker({
        types: [{ description: "Text", accept: { "text/*": [".txt", ".md", ".json", ".csv", ".log"] } }],
      });
      const file = await handle.getFile();
      return { name: file.name, content: await file.text() };
    } catch { return null; }
  }
  // Legacy <input type=file>
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.md,.json,.csv,.log,text/*";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      resolve({ name: f.name, content: await f.text() });
    };
    input.click();
  });
}

export async function writeTextFile(suggestedName: string, content: string): Promise<boolean> {
  if (isElectron()) {
    try { return await window.alpha!.writeFile(suggestedName, content); } catch { return false; }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (typeof w.showSaveFilePicker === "function") {
    try {
      const handle = await w.showSaveFilePicker({ suggestedName });
      const stream = await handle.createWritable();
      await stream.write(content);
      await stream.close();
      return true;
    } catch { return false; }
  }
  // Fallback: download link
  const blob = new Blob([content], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}

export async function getRegisteredHotkey(): Promise<string> {
  if (!isElectron()) return "Control+Shift+A";
  try { return await window.alpha!.getHotkey(); } catch { return "Control+Shift+A"; }
}

export async function getActiveWindowTitle(): Promise<string | null> {
  if (!isElectron()) return null;
  try { return await window.alpha!.getActiveWindow(); } catch { return null; }
}

export async function captureNativeScreenshot(): Promise<{ name: string } | null> {
  if (!isElectron()) return null;
  try { return await window.alpha!.captureScreenshot(); } catch { return null; }
}

export async function openNativeFolder(key: string): Promise<{ key: string; label: string } | null> {
  if (!isElectron()) return null;
  try { return await window.alpha!.openFolder(key); } catch { return null; }
}

export async function launchPinnedNativeApp(key: string): Promise<{ key: string; label: string } | null> {
  if (!isElectron()) return null;
  try { return await window.alpha!.launchPinnedApp(key); } catch { return null; }
}
