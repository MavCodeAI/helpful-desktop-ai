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
| `RealtimeClient` bundling | eager in jarvis chunk | **lazy chunk `realtime-client-*.js` (~3.6 KB)** — loaded on first realtime click |
| Server error mapping | duplicated per route | shared `src/lib/server/errors.ts` + `gateway-client.ts` |
| `/api/chat`, `/api/stt`, `/api/tts` | inline `fetch` + `Bearer` | migrated to `gatewayFetch()` (single upstream helper) |

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

- **Wire `voiceReducer` into `JarvisPage`.** The reducer + 8 passing tests
  ship; the ~2.4k-line component still uses `useState<Phase>` with 97
  `phase`/`setPhase` references. A mechanical rewrite in one turn is
  high-risk without Playwright coverage of PTT / Auto-VAD / Realtime.
  Recommended sequence: (1) add Playwright smokes for the three flows,
  (2) swap one transition family at a time (recorder → TTS → realtime),
  (3) delete `setPhase` and expose only `dispatch`.
- **Playwright smokes** for PTT / Auto-VAD / Realtime — spec sketch:
  reproduce a full voice cycle against the live preview and assert the
  orb reaches `idle` again within N seconds.

## Post-lazy-markdown (2026-07-09)

| Chunk                     | Before | After  | Δ      |
| ------------------------- | ------ | ------ | ------ |
| jarvis (initial)          | 339 KB | 189 KB | −150 KB (−44%) |
| react-markdown (on-demand)| —      | 110 KB | new lazy chunk |
| remark-gfm (on-demand)    | —      |  38 KB | new lazy chunk |

Users who never render assistant text (idle bounce, license gate, error
paths) never pay the markdown cost. First message triggers a single
prefetch (~55 KB gzipped) that then caches for the session.
