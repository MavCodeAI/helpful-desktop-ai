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
8. **`/api/{chat,stt,tts}` migrated to `gatewayFetch()`** — upstream URL,
   auth header, and `LOVABLE_API_KEY` read live in one place. Wire format
   unchanged.
9. **Playwright smoke** — `scripts/smoke-jarvis.py` seeds a valid license
   in localStorage, loads `/jarvis`, asserts the `TAP TO START` caption
   (from `PHASE_CAPTION.idle`) is visible, buttons render, no pageerror.
   Run: `python3 ./scripts/smoke-jarvis.py`.
10. **`voiceReducer` wired into `JarvisPage`** — `useState<Phase>` replaced
    with `useReducer(voiceReducer, INITIAL_VOICE_STATE)`. Existing 22
    `setPhase(x)` sites keep working (adapter dispatches `SET_PHASE`), so
    behavior is 1:1. Reducer now has 10 vitest cases (added SET_PHASE
    escape-hatch + referential-stability tests). New transition sites
    should prefer semantic events (`dispatch({ type: "START_LISTENING" })`)
    so invalid jumps become tested no-ops.

## Deferred (each safe on its own)

- **Convert `setPhase` → semantic events site-by-site.** Adapter is in
  place; each call site can migrate on its own PR, e.g.
  `setPhase("thinking")` after a recorder stop → `dispatch({ type: "STOP_LISTENING" })`.
  Guardrail is the smoke script + reducer tests.
- **Full voice-cycle smoke** — mock `/api/{stt,chat,tts}` via Playwright
  `route.fulfill()`, feed a fake audio blob through
  `--use-file-for-fake-audio-capture`, assert the phase machine returns
  to `idle` within N seconds.
- **`realtime-token` unification.** That route hits `api.openai.com`
  directly (not the Lovable gateway), so it correctly stays outside
  `gatewayFetch`. Migrate if we ever proxy realtime through Lovable.

Elon-style rule: don't touch what isn't demonstrably slow. Each deferred
item has a measurable payoff (bundle size, LOC, test coverage) — tackle
whichever the next symptom points at.
