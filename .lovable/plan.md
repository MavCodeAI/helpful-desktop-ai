# Alpha Phase 1 MVP — Full Jarvis Loop

Reality-check: **Barge-in** پہلے سے work کرتا ہے (Gemini Live native + HF streaming)۔ **Voice conversation + Orb + App launching + Screenshot** پہلے سے موجود ہیں۔ باقی 6 features کو practical desktop+web split میں build کریں گے۔

## 1. Custom Persona + Language + Long-term Memory
- `src/lib/persona.ts`: presets (Alpha / Jarvis / Friday / Custom)، language (auto/en/ur/ar)، memories list (localStorage)
- Settings drawer میں **Persona** section — preset picker، free-form system prompt، language dropdown، memories manager
- `voice-providers.ts` `buildInstructions()` کو extend — persona prompt + memories block + language hint
- `use-realtime-session.ts` سے persona/memories/language pass ہوں
- **Auto-memory**: "remember that X" / "yaad rakho X" / "تذكر أن X" utterance intent → memories میں add + persona میں inject
- Short-term memory: last N turns (thread messages) پہلے سے موجود ہیں

## 2. Screen Understanding (AI Vision)
- Enable **Lovable Cloud** (LOVABLE_API_KEY auto-provision)
- `src/lib/ai-gateway.server.ts` + `src/lib/ai-vision.functions.ts` — `describeScreen(imageBase64)` server fn → Gemini 2.5 Flash vision
- Intent: "screen dekho" / "what's on screen" / "شاشة" → `getDisplayMedia` → capture → server fn → response کو chat میں assistant message کے طور پر inject + optional TTS via active Gemini Live session

## 3. AI Web-Answer (real "search" not just Google open)
- Same server fn module: `askAI(question, language)` → Gemini flash with Google-Search grounding tool
- Intent: "AI se pucho X" / "answer this X" / "اسأل X" → server fn → assistant message
- Fallback: existing Google-open intent for direct search UX

## 4. File Operations
- **Electron path** (native): IPC `alpha:readFile`, `alpha:writeFile`, `alpha:listDir` in `main.cjs` + `preload.cjs` (with `dialog.showOpenDialog`/`showSaveDialog` for safety)
- **Browser path**: File System Access API (`showOpenFilePicker`/`showSaveFilePicker`) — Chromium only، Safari میں graceful message
- Intents: "file kholo" / "note.txt save karo X me" / "documents dikhao"
- Content added to Notes یا separate File Explorer? → پہلے فیز میں: open → read → text-file preview toast + inject as chat context; save → prompt for filename → write

## 5. Arabic Support
- Wake word: "مرحبا ألفا" (Marhaba Alpha) + existing "hey alpha"
- SpeechRecognition `lang` from language setting (`ur-PK`, `ar-SA`, `en-US`, or unset for auto)
- Persona automatically picks reply language when set

## 6. Technical Section
```text
New files:
- src/lib/persona.ts                        (presets, memories store, buildPersonaSystemPrompt)
- src/lib/ai-gateway.server.ts              (Lovable AI provider helper)
- src/lib/ai-vision.functions.ts            (describeScreen, askAI server fns)
- src/components/realtime/settings/PersonaSection.tsx

Edits:
- src/lib/voice-providers.ts                (buildInstructions uses persona)
- src/lib/intents.ts                        (remember, screen-vision, ai-answer, file-open, file-save intents)
- src/hooks/use-intent-actions.ts           (new action handlers → server fns)
- src/hooks/use-realtime-session.ts         (pass persona/memories/language)
- src/hooks/use-voice-settings.ts           (persona state)
- src/lib/realtime/{constants,storage}.ts   (persona keys)
- src/hooks/use-wake-triggers.ts            (Arabic wake, language-aware)
- src/hooks/use-voice-app.ts                (wire persona into session + intents)
- src/components/realtime/SettingsDrawer.tsx + OverlayHost.tsx  (mount PersonaSection)
- electron/main.cjs + preload.cjs           (file IPC handlers)
- src/lib/electron-bridge.ts                (readFile/writeFile wrappers)
```

Barge-in الگ code نہیں چاہیے — Gemini Live BidiGenerateContent + HF streaming دونوں انٹرپشن پہ audio player بند کر دیتے ہیں۔ صرف status pill میں "You can interrupt any time" hint دکھائیں گے۔
