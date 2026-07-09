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

11. **Full voice-cycle smoke** — `scripts/smoke-jarvis-cycle.py` mocks
    `/api/{stt,chat,tts}` via `context.route()`, drives one orb-click →
    listening → orb-click → thinking → speaking → idle cycle with a fake
    audio device, and asserts each phase caption via `PHASE_CAPTION`.
    Guardrail for future setPhase → semantic-event migration.

12. **All meaningful `setPhase` sites migrated to semantic events.**
    Reducer gained `START_THINKING` + `START_SPEAKING` (multi-entry:
    idle from text/chip/restart, thinking from voice pipeline). Every
    recorder/chat/TTS/realtime transition now dispatches a named event;
    errors dispatch `ERROR` with the toast message so `state.error` is
    the single source of truth. 13 reducer tests + cycle smoke green.
    Only 2 `setPhase` calls remain — both intentional cross-phase jumps
    inside the realtime state machine (thinking → listening on connect,
    on/off sync effect) which has its own contract.

13. **`state.error` surfaced in UI** — `role="alert" aria-live="assertive"`
    banner at bottom-center reads `voiceState.error`. Reducer already
    clears the field on every successful transition (any `START_*`,
    `CANCEL`, `SET_PHASE`), so the banner auto-dismisses on recovery.
    Complements toasts (fire-and-forget) with a persistent a11y surface.

## Deferred (each safe on its own)

- **Realtime state machine unification.** The 2 remaining `setPhase`
  calls (jarvis.tsx L1202, L1281) belong to `RealtimeClient` — fold them
  into `voiceReducer` only if we merge the two state machines.
- **`realtime-token` unification.** That route hits `api.openai.com`
  directly (not the Lovable gateway), so it correctly stays outside
  `gatewayFetch`. Migrate if we ever proxy realtime through Lovable.

Elon-style rule: don't touch what isn't demonstrably slow. Each deferred
item has a measurable payoff (bundle size, LOC, test coverage) — tackle
whichever the next symptom points at.
