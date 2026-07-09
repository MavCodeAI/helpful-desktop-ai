# JARVIS Refactor + Perf Baseline

## Step 1 — Baseline (pre-refactor)

- `src/routes/jarvis.tsx` = **2,879 lines**, 279 hooks/functions
- jarvis route client chunk: **339 KB** raw
- main client chunk: **369 KB** raw
- SSR jarvis chunk: **143 KB**
- Total initial JS on `/jarvis`: ~726 KB raw

## Step 2-7 — After extraction & perf pass

| Metric | Before | After |
|---|---|---|
| `src/routes/jarvis.tsx` lines | 2,879 | **2,462** (−417) |
| Top-level presentational fns in the route | 6 | 0 (moved to `src/features/jarvis-ui/`) |
| Hook helpers in the route | `useReducedMotion`, `haptic` | 0 (moved to `src/hooks`, `src/lib`) |
| Phase constants + reducer | inline `useState` in route | pure `voiceReducer` in `src/features/voice/` |
| Phase-machine tests | 0 | 8 passing (vitest) |
| `useMicLevel` React updates | ~60 fps | throttled to **~20 fps** (RAF math unchanged) |
| Server error mapping | duplicated per route | shared `src/lib/server/errors.ts` + `gateway-client.ts` |

## New module layout

```text
src/hooks/useReducedMotion.ts
src/lib/haptic.ts
src/lib/friendly-error.ts          # friendlyError + sttErrorDetail + SttAttempt
src/lib/server/{errors,gateway-client,validation}.ts
src/features/voice/
  ├── phase-machine.ts             # pure reducer, PHASE_HUE, PHASE_CAPTION, THINKING_STAGES
  ├── phase-machine.test.ts        # 8 tests, all green
  └── README.md
src/features/jarvis-ui/
  ├── OrbWaveBars.tsx
  ├── OrbSideButton.tsx
  ├── TypingDots.tsx
  ├── LiveWaveform.tsx
  ├── VolumeMeter.tsx
  └── RecTimer.tsx
```

## Deferred to next pass

- **Wire `voiceReducer` into `JarvisPage`** — module + tests shipped; the
  ~2.4k-line component still uses scattered `useState` for `phase`. Swap
  is mechanical but touches every phase-transition site; do it once per
  transition family to keep diffs reviewable.
- **Lazy-load `RealtimeClient`** — realtime WebRTC is imported eagerly at
  the top of `jarvis.tsx`. Move to a dynamic `import()` inside the "enter
  realtime" handler to drop ~10-15 KB from the initial chunk for
  non-realtime users.
- **Adopt `src/lib/server/*` in `/api/{chat,stt,tts,realtime-token}`** —
  scaffold is in; each route needs a 5-10 line swap to `gatewayFetch` +
  `gatewayError`.
