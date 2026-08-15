// Alpha — Electron preload. Exposes a tiny, typed IPC surface as `window.alpha`.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("alpha", {
  version: "1.0.0",
  platform: process.platform,

  openExternal: (url) => ipcRenderer.invoke("alpha:openExternal", url),
  notify: (title, body) => ipcRenderer.send("alpha:notify", title, body),
  setAutoLaunch: (enabled) => ipcRenderer.invoke("alpha:setAutoLaunch", enabled),
  getAutoLaunch: () => ipcRenderer.invoke("alpha:getAutoLaunch"),
  readFile: () => ipcRenderer.invoke("alpha:readFile"),
  writeFile: (name, content) => ipcRenderer.invoke("alpha:writeFile", name, content),
  getHotkey: () => ipcRenderer.invoke("alpha:getHotkey"),
  getActiveWindow: () => ipcRenderer.invoke("alpha:getActiveWindow"),
  captureScreenshot: () => ipcRenderer.invoke("alpha:captureScreenshot"),
  quit: () => ipcRenderer.send("alpha:quit"),

  onHotkey: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("global-hotkey", handler);
    return () => ipcRenderer.removeListener("global-hotkey", handler);
  },
  onTrayAction: (cb) => {
    const handler = (_e, action) => cb(action);
    ipcRenderer.on("tray-action", handler);
    return () => ipcRenderer.removeListener("tray-action", handler);
  },
});
