# JARVIS Hybrid Voice — 3 Modes

ایک segmented toggle header میں، user کبھی بھی mode switch کر سکے۔ ہر mode کے اپنے فوائد۔

## Modes

**1. Push-to-Talk (default — موجودہ)**
- Space hold / mic tap
- Sequential: STT → LLM → TTS
- Latency ~2-4s، مکمل reliable، Lovable AI Gateway پر
- کوئی اضافی cost نہیں

**2. Auto-VAD (نیا — Lovable AI پر)**
- Mic ہمیشہ سنتا ہے، silence detect کر کے خودکار send
- Same pipeline (/api/stt → /api/chat → /api/tts)
- Hands-free experience، latency وہی ~2-4s
- Implementation: `useMicLevel` سے RMS threshold + 800ms silence timer
- Interruption: نئی آواز آئے تو موجودہ TTS رک جائے

**3. Realtime (اختیاری — OpenAI direct)**
- True streaming voice-to-voice، ~500ms latency
- WebSocket → `wss://api.openai.com/v1/realtime`
- Barge-in support (بولیں تو AI فوراً رکے)
- User کا OpenAI API key چاہیے (Lovable Gateway ابھی realtime WebSocket نہیں کرتا)
- Ephemeral token pattern: server function key سے ephemeral token بنائے، browser صرف اسی سے WebSocket کھولے (raw key browser کو کبھی نہیں جاتی)

## UI

Header میں 3-way segmented toggle:
```
[ Push-to-Talk ] [ Auto-VAD ] [ Realtime ]
```
- Selected mode `localStorage` میں save
- Realtime tab پر پہلی بار click → اگر key نہیں تو `add_secret` prompt
- Active mode کے مطابق mic button کا behavior بدلے:
  - PTT: hold-to-talk (جیسے ابھی ہے)
  - VAD: tap to start/stop continuous listening، indicator "Listening..."
  - Realtime: tap to connect/disconnect، indicator "Live"

## Technical

**New files:**
- `src/lib/voice-mode.ts` — mode enum + localStorage helpers
- `src/lib/vad.ts` — silence detection hook (RMS + timer)
- `src/lib/realtime-client.ts` — OpenAI Realtime WebSocket wrapper
- `src/routes/api/realtime-token.ts` — server route جو ephemeral token بنائے
- `src/components/VoiceModeToggle.tsx` — 3-way segmented control

**Edited:**
- `src/routes/jarvis.tsx` — toggle wire، mode-based mic handler
- `add_secret OPENAI_API_KEY` — صرف جب user Realtime pick کرے

## Cost & Trade-offs

| Mode | Latency | Cost | Reliability |
|---|---|---|---|
| PTT | 2-4s | Lovable credits | ⭐⭐⭐⭐⭐ |
| Auto-VAD | 2-4s | Lovable credits | ⭐⭐⭐⭐ |
| Realtime | 0.5s | OpenAI direct (higher) | ⭐⭐⭐ (WebSocket drops possible) |

## Implementation order

1. Mode toggle + storage + UI shell (کوئی behavior تبدیل نہیں)
2. Auto-VAD (چھوٹا، existing pipeline استعمال کرتا)
3. Realtime (بڑا، نیا server route + WebSocket client + secret)

اگر Realtime skip کرنا چاہیں تو phase 3 چھوڑ سکتے ہیں — بغیر OpenAI key کے پہلے 2 modes مکمل کام کریں گے۔

## آپ سے سوال (implementation سے پہلے)

- Phase 3 (Realtime) میں آپ کا OpenAI API key `add_secret` کے ذریعے محفوظ ہو گا۔ کیا آگے بڑھوں؟
- یا صرف Phase 1+2 (Auto-VAD) پہلے کریں، Realtime بعد میں؟