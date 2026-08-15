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

const { app, BrowserWindow, Tray, Menu, globalShortcut, shell, ipcMain, Notification, nativeImage, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");

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
