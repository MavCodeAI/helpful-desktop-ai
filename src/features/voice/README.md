# Voice pipeline

State + orchestration for the JARVIS voice loop.

```text
idle ─(START_LISTENING)→ listening ─(STOP_LISTENING)→ thinking ─(THINKING_DONE)→ speaking ─(PLAYBACK_DONE)→ idle
                             │                                                        │
                             └─ PAUSE/RESUME_RECORDING (recPaused flag)               └─ PAUSE/RESUME_PLAYBACK (playPaused flag)
```

## Files

- `phase-machine.ts` — pure reducer (`voiceReducer`), phase constants
  (`PHASE_HUE`, `PHASE_CAPTION`, `THINKING_STAGES`). No React, no I/O.
- `phase-machine.test.ts` — covers happy path, pause/resume, invalid
  transitions, CANCEL, ERROR.

## Contracts

- **Pause is a flag, not a phase.** A recorder paused mid-utterance stays
  in `listening` with `recPaused=true`. Same for `speaking` +
  `playPaused`. Mirrors `MediaRecorder.pause()` / `HTMLAudioElement.pause()`.
- **Unknown transitions are no-ops** (reducer returns the same reference).
  Callers can dispatch speculatively without guarding every call site.
- **`CANCEL` and `ERROR` always reach `idle`** — anything else risks
  stranding the UI on `thinking` or `speaking` forever.

## Roadmap

Realtime WebRTC mode (`src/lib/realtime-client.ts`) is a separate
sub-machine — keep it out of `phase-machine.ts` so a WebRTC drop can't
poison the local recorder loop. Wiring guide: see `.lovable/plan.md`
Step 3.
