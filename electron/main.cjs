// Alpha — Electron main process.
// Wraps the deployed web app (or a local build) in a native window with:
//   • Global hotkey (Ctrl/Cmd+Shift+A) → wake mic
//   • System tray with Show/Hide/Listen/Quit
//   • Native notifications
//   • Auto-launch on login (per-OS)
//   • shell.openExternal for links (bypasses popup blocker)
//
// Build via: `npm run electron:package`
// Run via:   `npm run electron:dev` (points at Vite dev server)

const { app, BrowserWindow, Tray, Menu, globalShortcut, shell, ipcMain, Notification, nativeImage, dialog, desktopCapturer } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { execFile } = require("node:child_process");

const DEV_URL = process.env.ALPHA_DEV_URL || "http://localhost:8080";
const PROD_URL = process.env.ALPHA_PROD_URL || "https://alpha9in-1lhpaoimz-abdulbasitdarwesh-gmailcoms-projects.vercel.app";
const IS_DEV = !app.isPackaged;

let mainWindow = null;
let tray = null;

function iconPath() {
  const icon = process.platform === "win32" ? "alpha-icon.ico" : "alpha-icon.png";
  return path.join(__dirname, "..", "public", icon);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 720,
    minHeight: 520,
    backgroundColor: "#0a1929",
    icon: iconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(IS_DEV ? DEV_URL : PROD_URL);

  mainWindow.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // Every navigation to an external origin opens in the OS default browser
  // instead of taking over the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function createTray() {
  try {
    const img = nativeImage.createFromPath(iconPath()).resize({ width: 18, height: 18 });
    tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
  } catch {
    tray = new Tray(nativeImage.createEmpty());
  }
  tray.setToolTip("Alpha — Voice AI");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Show Alpha", click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { label: "Start Listening", click: () => mainWindow?.webContents.send("tray-action", "start") },
    { label: "Stop Listening",  click: () => mainWindow?.webContents.send("tray-action", "stop")  },
    { type: "separator" },
    { label: "Quit", click: () => { app.isQuitting = true; app.quit(); } },
  ]));
  tray.on("click", () => { mainWindow?.show(); mainWindow?.focus(); });
}

function registerHotkey() {
  const combo = process.platform === "darwin" ? "Command+Shift+A" : "Control+Shift+A";
  const ok = globalShortcut.register(combo, () => {
    mainWindow?.show();
    mainWindow?.focus();
    mainWindow?.webContents.send("global-hotkey");
  });
  if (!ok) console.warn("Alpha: failed to register global hotkey", combo);
}

// IPC surface exposed to the renderer via preload.cjs
ipcMain.handle("alpha:openExternal", async (_e, url) => {
  if (typeof url !== "string" || !/^https?:|^mailto:|^sms:|^tel:/i.test(url)) return false;
  try { await shell.openExternal(url); return true; } catch { return false; }
});

ipcMain.on("alpha:notify", (_e, title, body) => {
  try {
    new Notification({ title: String(title || "Alpha"), body: body ? String(body) : undefined, icon: iconPath() }).show();
  } catch { /* notifications disabled */ }
});

ipcMain.handle("alpha:setAutoLaunch", (_e, enabled) => {
  try {
    app.setLoginItemSettings({ openAtLogin: !!enabled, openAsHidden: true });
    return !!app.getLoginItemSettings().openAtLogin;
  } catch { return false; }
});

ipcMain.handle("alpha:getAutoLaunch", () => {
  try { return !!app.getLoginItemSettings().openAtLogin; } catch { return false; }
});

ipcMain.on("alpha:quit", () => { app.isQuitting = true; app.quit(); });

ipcMain.handle("alpha:readFile", async () => {
  try {
    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [{ name: "Text", extensions: ["txt", "md", "json", "csv", "log"] }, { name: "All", extensions: ["*"] }],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    const filePath = res.filePaths[0];
    const content = await fs.readFile(filePath, "utf8");
    return { name: path.basename(filePath), content };
  } catch { return null; }
});

ipcMain.handle("alpha:writeFile", async (_e, suggested, content) => {
  try {
    const res = await dialog.showSaveDialog(mainWindow, {
      defaultPath: String(suggested || "alpha.txt"),
      filters: [{ name: "Text", extensions: ["txt", "md", "json", "csv", "log"] }],
    });
    if (res.canceled || !res.filePath) return false;
    await fs.writeFile(res.filePath, String(content ?? ""), "utf8");
    return true;
  } catch { return false; }
});

// ── Constrained Windows Action Library ─────────────────────────────────
// These handlers intentionally expose only fixed, user-visible operations.
// No arbitrary command, script, executable, or path is accepted from the renderer.
ipcMain.handle("alpha:getHotkey", () => (
  process.platform === "darwin" ? "Command+Shift+A" : "Control+Shift+A"
));

ipcMain.handle("alpha:getActiveWindow", async () => {
  if (process.platform !== "win32") return null;
  const script = `
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class AlphaWindow {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
}
"@
$handle = [AlphaWindow]::GetForegroundWindow()
if ($handle -eq [IntPtr]::Zero) { exit 0 }
$builder = New-Object System.Text.StringBuilder 512
[void][AlphaWindow]::GetWindowText($handle, $builder, $builder.Capacity)
$builder.ToString()
`;
  return await new Promise((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], {
      windowsHide: true,
      timeout: 3000,
      maxBuffer: 16 * 1024,
    }, (error, stdout) => {
      if (error) return resolve(null);
      const title = String(stdout || "").trim();
      resolve(title || null);
    });
  });
});

ipcMain.handle("alpha:captureScreenshot", async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 2560, height: 1440 },
      fetchWindowIcons: false,
    });
    const source = sources.find((item) => item.id.startsWith("screen:")) || sources[0];
    if (!source || source.thumbnail.isEmpty()) return null;
    const res = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `alpha-screenshot-${Date.now()}.png`,
      filters: [{ name: "PNG image", extensions: ["png"] }],
    });
    if (res.canceled || !res.filePath) return null;
    await fs.writeFile(res.filePath, source.thumbnail.toPNG());
    return { name: path.basename(res.filePath) };
  } catch {
    return null;
  }
});

// Fixed folder aliases. The renderer can request an alias only; it never
// supplies an arbitrary filesystem path.
const FOLDER_ALIASES = {
  home: { label: "Home", resolve: () => app.getPath("home") },
  desktop: { label: "Desktop", resolve: () => app.getPath("desktop") },
  documents: { label: "Documents", resolve: () => app.getPath("documents") },
  downloads: { label: "Downloads", resolve: () => app.getPath("downloads") },
  pictures: { label: "Pictures", resolve: () => app.getPath("pictures") },
  music: { label: "Music", resolve: () => app.getPath("music") },
  videos: { label: "Videos", resolve: () => app.getPath("videos") },
  temp: { label: "Temporary files", resolve: () => app.getPath("temp") },
};

ipcMain.handle("alpha:openFolder", async (_e, requestedKey) => {
  const key = String(requestedKey || "").trim().toLowerCase();
  const folder = FOLDER_ALIASES[key];
  if (!folder) return null;
  try {
    const error = await shell.openPath(folder.resolve());
    return error ? null : { key, label: folder.label };
  } catch {
    return null;
  }
});

// Pinned apps deliberately use fixed executable names or fixed Windows URI
// schemes. No executable path, arguments, or shell command comes from voice.
const PINNED_APPS = {
  calculator: { label: "Calculator", executable: "calc.exe" },
  notepad: { label: "Notepad", executable: "notepad.exe" },
  paint: { label: "Paint", executable: "mspaint.exe" },
  explorer: { label: "File Explorer", executable: "explorer.exe" },
  taskmanager: { label: "Task Manager", executable: "taskmgr.exe" },
  settings: { label: "Windows Settings", uri: "ms-settings:" },
};

ipcMain.handle("alpha:launchPinnedApp", async (_e, requestedKey) => {
  const key = String(requestedKey || "").trim().toLowerCase();
  const target = PINNED_APPS[key];
  if (!target) return null;
  try {
    if (target.uri) {
      await shell.openExternal(target.uri);
    } else if (process.platform === "win32") {
      execFile(target.executable, [], { windowsHide: true, timeout: 3000 });
    } else {
      return null;
    }
    return { key, label: target.label };
  } catch {
    return null;
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerHotkey();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });
});

app.on("window-all-closed", (e) => {
  // Keep app alive in tray on all platforms (Jarvis-style).
  e.preventDefault();
});

app.on("will-quit", () => { globalShortcut.unregisterAll(); });
