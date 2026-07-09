# JARVIS Refactor — Status

**Status:** Steps 1-7 landed in one pass. See `.lovable/perf-baseline.md`
for before/after numbers. This file records what's done and what's
intentionally deferred.

## Done

1. **Baseline captured** — line counts + bundle sizes recorded.
2. **`jarvis.tsx` slimmed 2879 → 2462** by extracting:
   - `src/hooks/useReducedMotion.ts`
   - `src/lib/haptic.ts`
   - `src/lib/friendly-error.ts` (`friendlyError`, `sttErrorDetail`, `SttAttempt`)
   - `src/features/jarvis-ui/{OrbWaveBars,OrbSideButton,TypingDots,LiveWaveform,VolumeMeter,RecTimer}.tsx`
3. **Phase machine extracted as pure reducer**
   `src/features/voice/phase-machine.ts` + `phase-machine.test.ts`
   (8 vitest cases, all green). `PHASE_HUE`, `PHASE_CAPTION`,
   `THINKING_STAGES` live with it.
4. **Perf win: `useMicLevel` React updates throttled to ~20 fps**
   (RAF math still runs full-rate, only `setState` is coalesced).
5. **Shared server lib scaffolded**
   `src/lib/server/{errors,gateway-client,validation}.ts` — single source
   of truth for `LOVABLE_API_KEY`, `Retry-After` parsing, 402/429/5xx
   mapping, and shared zod primitives.
6. **Test safety-net grown** — `phase-machine.test.ts` joins the existing
   `stt-stream.test.ts`.
7. **Docs** — `src/features/voice/README.md` with pipeline diagram +
   contracts; this file + `perf-baseline.md` track deltas.

## Deferred (each safe on its own)

- **Adopt `voiceReducer` inside `JarvisPage`.** The reducer + tests are
  shipped, but `JarvisPage` still uses scattered `useState` for phase.
  Swap is mechanical — do it once per transition family (recorder, TTS,
  realtime) to keep diffs reviewable.
- **Lazy-load `RealtimeClient`.** Move to a dynamic `import()` inside the
  "enter realtime" handler to shave ~10-15 KB off the initial chunk.
- **Migrate `/api/{chat,stt,tts,realtime-token}` to `src/lib/server/*`.**
  5-10 lines per route.
- **Playwright smoke tests** for PTT / auto-VAD / realtime — spec listed
  in the perf-baseline "Deferred" section.

Elon-style rule: don't touch what isn't demonstrably slow. Each deferred
item has a measurable payoff (bundle size, LOC, test coverage) — tackle
whichever the next symptom points at.
