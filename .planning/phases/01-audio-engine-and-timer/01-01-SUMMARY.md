---
phase: 01-audio-engine-and-timer
plan: "01"
subsystem: audio-engine
tags: [web-audio-api, synthesis, oscillator, singing-bowl, typescript]
dependency_graph:
  requires: []
  provides:
    - getAudioContext (AudioContext singleton with autoplay guard)
    - strikeBowl (singing bowl synthesis factory)
    - createPhase3Ramp (Phase 3 volume ramp GainNode factory)
    - startPhase3Swell (Phase 3 rising sine swell oscillator factory)
    - fadeOutGain (click-free gain fade helper)
    - startKeepalive / stopKeepalive (silent keepalive oscillator)
    - playTestSound / TEST_SOUND_GAIN (test sound at 40% volume)
  affects: []
tech_stack:
  added:
    - React 19 + Vite 6 + TypeScript 5 (project scaffold)
    - Tailwind CSS v4 + @tailwindcss/vite (styling layer)
    - vite-plugin-pwa (PWA layer)
    - vitest (test runner)
  patterns:
    - OscillatorNode factory pattern (fresh nodes per sound event — single-use constraint)
    - AudioContext singleton with autoplay guard (must call from user gesture)
    - Exponential decay envelope with 0.001 floor (spec forbids ramp to exactly 0)
    - linearRampToValueAtTime always preceded by setValueAtTime anchor (pitfall 6)
    - setTargetAtTime(0.0001, t, 0.015) for click-free fade (pitfall 4)
    - Silent keepalive oscillator at gain=0 (AUD-04, best-effort iOS caveat)
key_files:
  created:
    - src/engine/AudioContext.ts
    - src/engine/sounds/singingBowl.ts
    - src/engine/sounds/phase3Tone.ts
    - src/engine/sounds/keepalive.ts
    - src/engine/sounds/testSound.ts
    - src/engine/sounds/__tests__/singingBowl.test.ts
    - src/engine/sounds/__tests__/phase3Tone.test.ts
    - src/engine/sounds/__tests__/keepalive.test.ts
    - src/engine/sounds/__tests__/testSound.test.ts
    - package.json
    - tsconfig.json / tsconfig.app.json / tsconfig.node.json
    - vite.config.ts
    - vitest.config.ts
    - .gitignore
  modified: []
decisions:
  - "D-01 + D-02 implemented: 220Hz fundamental with 5 partials (2.76x, 4.72x, 6.83x inharmonic + 1.003x shimmer)"
  - "D-05 implemented: Phase 3 tone is rising sine swell 80Hz→220Hz over 3s (zen urgency, contrast with bowl)"
  - "D-07 implemented: TEST_SOUND_GAIN=0.4 exposed as named constant for easy tuning"
  - "Project scaffold created inline (Vite create-vite CLI was non-interactive in this environment)"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-14T11:44:41Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 14
  files_modified: 0
  tests_added: 39
  tests_passing: 39
---

# Phase 01 Plan 01: Audio Synthesis Layer Summary

**One-liner:** 5-partial singing bowl synthesis at 220Hz with inharmonic ratios, Phase 3 rising sine swell (80–220Hz), silent keepalive oscillator, and test sound — all via raw Web Audio API OscillatorNode factory pattern.

## What Was Built

Five TypeScript modules providing the complete audio synthesis layer for the Soundly alarm engine:

1. **`src/engine/AudioContext.ts`** — Shared `AudioContext` singleton. `getAudioContext()` creates or resumes the context, guarded behind the requirement that it be called from a user gesture handler. Prevents multiple context instances and handles the `suspended` state from autoplay policy.

2. **`src/engine/sounds/singingBowl.ts`** — Tibetan singing bowl synthesis. `strikeBowl(ac, masterGain?)` creates 5 sine oscillators with inharmonic partial ratios (1x, 2.76x, 4.72x, 6.83x, 1.003x detuned shimmer) and exponential decay envelopes. Each call creates fresh nodes (factory pattern — OscillatorNode is single-use).

3. **`src/engine/sounds/phase3Tone.ts`** — Phase 3 urgent tone system:
   - `createPhase3Ramp(ac, durationSec)` — GainNode with 0→1.0 linear ramp, anchored with `setValueAtTime(0)` before ramp (prevents pitfall 6).
   - `startPhase3Swell(ac, masterGain)` — Sine oscillator sweeping 80Hz→220Hz over 3s with 0.5s soft attack. Routes through the ramp GainNode.
   - `fadeOutGain(gain, ac)` — Click-free fade using `setTargetAtTime(0.0001, t, 0.015)`.

4. **`src/engine/sounds/keepalive.ts`** — `startKeepalive(ac)` runs a 1Hz sine oscillator at gain=0. Keeps AudioContext active between sound events on mobile. `stopKeepalive(osc)` stops it with try/catch safety.

5. **`src/engine/sounds/testSound.ts`** — `playTestSound()` calls `getAudioContext()` then `strikeBowl(ac, 0.4)`. `TEST_SOUND_GAIN = 0.4` is exported as a named constant for tuning.

### Project Scaffold

The project was greenfield (no `src/` existed). Created the full project scaffold:
- `package.json` with React 19, Vite 6, TypeScript 5, Tailwind v4, vite-plugin-pwa, vitest
- `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json`
- `vite.config.ts` with `@vitejs/plugin-react` and `@tailwindcss/vite`
- `vitest.config.ts` with node environment
- `.gitignore`

## Tests

39 tests across 4 test files — all passing:

| File | Tests | Coverage |
|------|-------|----------|
| singingBowl.test.ts | 10 | Export signature, 5 oscillators, 220Hz fundamental, partial ratios, masterGain scaling, 0.001 decay floor, start/stop |
| phase3Tone.test.ts | 13 | createPhase3Ramp: anchor ordering, ramp to 1.0, duration math; startPhase3Swell: 80Hz init, 220Hz sweep, soft attack; fadeOutGain: setTargetAtTime args |
| keepalive.test.ts | 9 | startKeepalive: freq=1, gain=0, start called, returns osc; stopKeepalive: stop called, safe double-stop |
| testSound.test.ts | 7 | TEST_SOUND_GAIN=0.4, playTestSound calls getAudioContext + strikeBowl(ac, 0.4), await ordering |

All Web Audio API browser globals are mocked via `vi.stubGlobal` — tests run in Node environment with no browser required.

## Commits

| Hash | Message |
|------|---------|
| `c20f0fc` | feat(01-01): AudioContext singleton and singing bowl synthesis |
| `ffd6fdf` | feat(01-01): Phase 3 tone, keepalive oscillator, and test sound |

## Deviations from Plan

### Auto-fixed Issues

None — all implementations matched plan specifications exactly.

### Unplanned Work (Rule 3 — Blocking Issue)

**Project scaffold creation**

- **Found during:** Task 1 start
- **Issue:** No `src/` directory or project scaffold existed. The plan assumed a pre-existing Vite project. `npm create vite@latest` is interactive and cancelled in this non-TTY environment.
- **Fix:** Created `package.json`, tsconfig files, `vite.config.ts`, `vitest.config.ts`, and `.gitignore` manually to match the CLAUDE.md recommended stack exactly. Dependencies installed via `npm install`.
- **Files modified:** `package.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`, `.gitignore`
- **Commit:** `c20f0fc` (included with Task 1)

## Known Stubs

None. All exports are fully implemented with real synthesis logic. No placeholder data or hardcoded empty values.

## Threat Flags

No new security-relevant surface introduced. This plan contains only in-browser audio synthesis code with no network requests, no user input processing, no data persistence, and no external API calls.

The threat model item T-01-02 (OscillatorNode creation DoS) is mitigated by design: each factory function creates nodes only when called. Rate limiting will be enforced by the AlarmEngine state machine in Plan 02 (only one active phase at a time).

## Self-Check: PASSED
