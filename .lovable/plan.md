# JARVIS Refactor + Optimization Plan

**بنیادی مسئلہ:** `src/routes/jarvis.tsx` = **2879 lines** — ایک ہی فائل میں state, UI, voice pipeline, realtime, tooltip, diagnostics، سب کچھ۔ testing، debugging، اور نئے features مشکل۔ باقی codebase صاف ہے، اصل کام یہی فائل توڑنا اور perf tighten کرنا ہے۔

Elon-style first principles: **جو ضرورت نہیں، حذف کرو۔ جو باقی ہے، الگ کرو۔ پھر ناپو۔ پھر تیز کرو۔**

---

## Step 1 — Baseline ناپیں (بغیر کوڈ بدلے)

پہلے measure، پھر optimize۔ ورنہ اندازے پر refactor۔

- `bun run build` → bundle size record: main chunk، jarvis route chunk، total JS
- Lighthouse mobile run (390px): LCP, TBT, CLS, TTI
- Chrome DevTools Performance recording ایک complete voice cycle کا (idle → speak → thinking → tts)
- `jarvis.tsx` میں hooks/state count، re-render frequency (React DevTools Profiler)

**Deliverable:** `.lovable/perf-baseline.md` — ہر بعد کے step کا موازنہ اسی سے۔

---

## Step 2 — `jarvis.tsx` کو domain modules میں توڑیں

2879 lines کو ~200-400 line کے focused modules میں:

```text
src/routes/jarvis.tsx                  (~250 lines: layout + composition صرف)
src/features/voice/
  ├── useVoicePipeline.ts              (STT → LLM → TTS orchestration)
  ├── usePushToTalk.ts                 (Space hold + tap logic)
  ├── useAutoVAD.ts                    (silence detection loop)
  ├── useRealtimeSession.ts            (realtime-client wrapper hook)
  ├── phase-machine.ts                 (idle/listening/thinking/speaking state)
  └── types.ts
src/features/jarvis-ui/
  ├── Orb.tsx                          (core + rings + sizing)
  ├── OrbSideButton.tsx
  ├── PhaseCaption.tsx                 (tap-to-expand tooltip)
  ├── SlowThinkingHint.tsx
  ├── DiagnosticsSheet.tsx
  ├── CoachmarkToast.tsx
  ├── SamplePrompts.tsx
  └── Header.tsx
```

**اصول:** ہر hook ایک ذمہ داری۔ ہر component ≤ 150 lines۔ کوئی prop drilling نہیں — Context یا zustand کا ایک chھوٹا store voice state کے لیے۔

---

## Step 3 — State machine صاف کریں

ابھی phase transitions scattered `useState` + `useEffect` میں۔ اس کا نتیجہ: race conditions (mic still recording جب tts شروع)، stale closures۔

- ایک explicit reducer یا `@xstate/store` (چھوٹا، بغیر full xstate): `idle | listening | transcribing | thinking | speaking | error`
- Transitions ایک جگہ، guards ایک جگہ
- Realtime mode alag sub-machine (connecting | live | reconnecting | disconnected)

**فائدہ:** ہر phase testable، bugs reproducible، "orb stuck on thinking" جیسے مسائل ختم۔

---

## Step 4 — Performance tightening

Baseline کے مطابق ترجیح، لیکن یقینی wins:

- **Code splitting:** `Hologram`, `DiagnosticsSheet`, realtime client — `lazy()` + Suspense۔ Realtime code تب load ہو جب user وہ mode چنے۔
- **Memoization audit:** Orb اور اس کے rings ہر phase update پر re-render نہ ہوں — `React.memo` + stable props۔
- **`useMicLevel` throttle:** RMS 60fps پر نہیں، 20fps کافی — CPU/battery بچے گا۔
- **Audio blob lifecycle:** ہر cycle کے بعد `URL.revokeObjectURL` verify (memory leak audit)
- **Font/CSS:** unused Tailwind utilities purge، aurora animation `will-change` صرف active phase میں
- **Route-level prefetch:** `/jarvis` سے realtime endpoint tab hover پر warm

**Target:** mobile LCP < 2s، TBT < 200ms، jarvis chunk < 150KB gz۔

---

## Step 5 — Server routes ہم آہنگ کریں

`/api/stt`, `/api/chat`, `/api/tts`, `/api/realtime-token` سب میں الگ الگ error handling۔ ایک shared:

```text
src/lib/server/
  ├── gateway-client.ts    (Lovable AI Gateway fetch wrapper + retries + error map)
  ├── errors.ts            (structured error → HTTP status)
  └── validation.ts        (shared zod primitives)
```

فائدہ: 429/402/401 mapping ایک جگہ، logs consistent، future endpoints کم boilerplate۔

---

## Step 6 — Testing safety net

Refactor سے پہلے کم از کم smoke tests، ورنہ regressions پکڑنا مشکل:

- `stt-stream.test.ts` پہلے سے موجود — model
- Add: `phase-machine.test.ts` (تمام transitions)
- Add: `voice-pipeline.test.ts` (mocked fetch سے happy path + 429 + network drop)
- Playwright: 3 critical flows — PTT cycle، Auto-VAD trigger، Realtime connect

CI اگر نہیں تو `bun test` pre-commit hook۔

---

## Step 7 — DX + docs

- `src/features/voice/README.md` — pipeline diagram، ہر hook کا contract
- `AGENTS.md` update: refactor کے بعد فائل structure
- Storybook یا simple `/jarvis-preview` route کو ہر UI component کے liveنمونے دکھانے کے لیے استعمال

---

## Execution order (safe, incremental)

| مرحلہ | خطرہ | وقت | فائدہ |
|---|---|---|---|
| 1. Baseline | صفر | 15m | measurement |
| 2. Split UI components (pure presentational) | کم | 1-2h | readability |
| 3. Extract hooks (voice pipeline) | متوسط | 2-3h | testability |
| 4. State machine | متوسط | 1-2h | reliability |
| 5. Perf wins (lazy load + memo) | کم | 1h | speed |
| 6. Shared server lib | کم | 45m | consistency |
| 7. Tests + docs | صفر | 1h | future-proof |

ہر step کے بعد: build + manual smoke + baseline سے compare۔ کوئی step regression دکھائے تو صرف اسی کو revert۔

---

## سوال آپ سے

1. کیا سب 7 steps ایک ساتھ کروں، یا صرف Step 1-3 پہلے (سب سے زیادہ فائدہ، کم خطرہ)؟
2. State machine کے لیے: hand-rolled reducer کافی، یا `@xstate/store` (~3KB) add کروں؟
3. Baseline metrics آپ کو چاہییں یا میں internal رکھوں اور صرف before/after summary دوں؟
