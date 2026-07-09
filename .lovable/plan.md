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

7. **`RealtimeClient` lazy-loaded** — split into its own `realtime-client-*.js`
   chunk (~3.6 KB), fetched on first realtime click via `await import()`.
   Non-realtime users (PTT / Auto-VAD) no longer pay the WebRTC code cost
   at initial load.
8. **`/api/chat`, `/api/stt`, `/api/tts` migrated to `gatewayFetch()`** —
   upstream URL, auth header, and `LOVABLE_API_KEY` read now live in one
   place (`src/lib/server/gateway-client.ts`). Wire format unchanged
   (Bearer auth, plain-text error bodies) so client parsing is untouched.

## Deferred (each safe on its own)

- **Adopt `voiceReducer` inside `JarvisPage`.** Reducer + 8 tests shipped;
  the ~2.4k-line component still uses `useState<Phase>` (97 `phase`/
  `setPhase` refs). Recommended sequence:
  1. Add Playwright smokes for PTT / Auto-VAD / Realtime.
  2. Swap one transition family at a time (recorder → TTS → realtime).
  3. Delete `setPhase`, expose only `dispatch`.
- **Playwright smoke tests** for the three voice flows — asserts each
  flow returns to `idle` and shows no error toast.
- **`realtime-token` unification.** That route hits `api.openai.com`
  directly (not the Lovable gateway), so it correctly stays outside
  `gatewayFetch`. If we ever proxy realtime through Lovable, migrate it
  then.

Elon-style rule: don't touch what isn't demonstrably slow. Each deferred
item has a measurable payoff (bundle size, LOC, test coverage) — tackle
whichever the next symptom points at.
