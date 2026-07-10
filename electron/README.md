# Alpha Desktop (Electron)

Wraps the Alpha web app in a native desktop shell with a global hotkey, system tray, native notifications, and auto-launch.

## Run in dev (against local Vite server)

```bash
# terminal 1
npm run dev

# terminal 2
npm run electron:dev
```

## Package for your OS

```bash
npm install --save-dev electron @electron/packager
npm run electron:package
```

Output appears in `electron-release/`.

### Cross-platform

```bash
# From Linux/macOS, build for Windows:
npx @electron/packager . "Alpha" --platform=win32 --arch=x64 --out=electron-release --overwrite --ignore='node_modules'

# For macOS:
npx @electron/packager . "Alpha" --platform=darwin --arch=x64 --out=electron-release --overwrite --ignore='node_modules'
```

## Features exposed to the web app

The preload script publishes `window.alpha` with:

- `openExternal(url)` — bypasses popup blockers via `shell.openExternal`
- `notify(title, body)` — native OS notifications
- `setAutoLaunch(bool)` / `getAutoLaunch()` — start on login
- `onHotkey(cb)` — fires when `Ctrl/Cmd+Shift+A` is pressed globally
- `onTrayAction(cb)` — fires on Start/Stop from tray menu
- `platform`, `version`, `quit()`

The web app auto-detects `window.alpha` and uses native paths when present, falling back to browser equivalents otherwise. Same code, both worlds.

## Global hotkey

- Linux/Windows: `Ctrl + Shift + A`
- macOS: `Cmd + Shift + A`

## Points to configure before shipping

- `ALPHA_PROD_URL` in `main.cjs` — set to your published URL.
- App icon in `public/alpha-icon.png`.
