# Alpha — باقی Features مکمل کرنے کا پلان

مقصد: Jarvis-style مکمل تجربہ۔ Smart Home ابھی نہیں — صرف "Coming Soon" placeholder۔

## 1. Intent System اپگریڈ (Web)
- **Confirmation mode**: settings toggle — auto-open یا "Confirm before opening"
- **Popup-blocked feedback**: toast + retry button جب `window.open` null دے
- **SMS/Native scheme fallback**: desktop پر `sms:` کام نہیں کرتا → WhatsApp Web پر fallback + user کو بتانا
- **مزید intents**: timer/alarm (in-app), note (in-app quick note), weather (open weather.com query), translate (Google Translate deep link), calculator (open calc query)

## 2. In-App Utilities (Desktop features کا web-safe subset)
- **Quick Notes**: "note likho ..." → localStorage میں save، History drawer کے ساتھ Notes drawer
- **Timers/Alarms**: "5 minute ka timer" → in-app timer with beep + browser notification
- **Clipboard read/write**: "copy karo X" / "clipboard padho" via `navigator.clipboard`
- **Screenshot** (browser): `getDisplayMedia` سے one-frame capture → download

## 3. Coming Soon Section
- Settings drawer میں نیا section: **"Coming Soon"**
- Smart Home / IoT / Home Automation — disabled toggles with lock icon اور "Coming soon" chip

## 4. Electron Desktop Shell
- `electron/main.cjs` — BrowserWindow، `base: './'` in vite.config
- **Global hotkey** (OS-level): `Ctrl/Cmd+Shift+A` — `globalShortcut` سے مائیک start
- **System tray**: Alpha icon، menu: Show/Hide, Start Listening, Quit
- **Native notifications**: `new Notification()` جب intent execute ہو
- **Auto-launch on login**: `app.setLoginItemSettings` — settings سے toggle
- **Native shell**: `shell.openExternal` سے deep-links (popup-blocker bypass)
- **IPC bridge**: `window.alpha` (contextBridge) — web code detect کرے کہ Electron ہے یا browser، اور native paths use کرے

## 5. Packaging
- `@electron/packager` سے Linux/Windows/macOS builds
- Output: `.tar.gz` / `.zip` in `/mnt/documents/`
- Settings drawer میں **"Download Desktop App"** section with links + install instructions

## 6. Technical Section
```text
Files to create:
- electron/main.cjs             (BrowserWindow, tray, globalShortcut, IPC)
- electron/preload.cjs          (contextBridge → window.alpha)
- src/lib/electron-bridge.ts    (safe wrapper: isElectron(), openExternal, notify, hotkey)
- src/lib/utilities/timers.ts   (in-app timers hook)
- src/lib/utilities/notes.ts    (localStorage notes)
- src/components/realtime/NotesDrawer.tsx
- src/components/realtime/settings/ComingSoonSection.tsx
- src/components/realtime/settings/DesktopSection.tsx

Files to edit:
- src/lib/intents.ts             (+timer/note/weather/translate/clipboard/screenshot)
- src/hooks/use-intent-actions.ts (confirmation flow + popup-blocked toast + electron.openExternal)
- src/hooks/use-voice-settings.ts (confirmBeforeOpen, autoLaunch)
- src/components/realtime/SettingsDrawer.tsx (mount Desktop + ComingSoon sections)
- vite.config.ts                 (base: './')
- package.json                   (electron, @electron/packager devDeps + scripts)
```

Smart Home / IoT — **صرف Coming Soon**، کوئی implementation نہیں۔

## ترتیب
1. Intent upgrades + utilities (web works standalone)
2. Notes/Timers UI + Coming Soon section
3. Electron shell + IPC bridge (web code adapts if `window.alpha` موجود)
4. Package + download link
