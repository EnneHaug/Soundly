---
phase: 07-segment-engine-triangle-sound
plan: 01
subsystem: audio
tags: [audio, synthesis, triangle, web-audio-api, oscillator-factory, phase-7]

# Dependency graph
requires:
  - phase: 01-audio-engine-and-timer
    provides: OscillatorNode/GainNode factory pattern, exponentialRampToValueAtTime-to-0.001 spec workaround, single-strike envelope idiom (singingBowl.ts createPartial body)
  - phase: 06-alarmsession-refactor-v1-regression-guard
    provides: v1 zero-diff floor (SEG-05) — Phase 7 may only ADD triangle.ts; existing src/engine/sounds/* untouched
provides:
  - strikeTriangle(ac, masterGain?) — single-strike F7 (2793.83 Hz) factory at src/engine/sounds/triangle.ts
  - 9-test constructor-stub regression net mirroring singingBowl.test.ts
  - Locked envelope params from Phase 7 D-05 transcribed verbatim into code
affects:
  - 07-02 (SegmentEngine) will dispatch via segmentSound.ts to strikeTriangle
  - 07-03 (segmentSound dispatcher) imports strikeTriangle as the 'triangle' key target
  - 07-05 (barrel export) re-exports strikeTriangle from src/engine/index.ts

# Tech tracking
tech-stack:
  added: []  # No new dependencies — raw Web Audio API per CLAUDE.md mandate
  patterns:
    - "Single-osc strike: inline (osc + gain + envelope) within strikeTriangle — no inner createPartial helper since this is a single-partial sound"
    - "Constructor-stub test pattern reused: vi.stubGlobal('OscillatorNode'/'GainNode') captures every instance; assertions on shape + envelope param mocks"

key-files:
  created:
    - src/engine/sounds/triangle.ts
    - src/engine/sounds/__tests__/triangle.test.ts
  modified: []  # v1 zero-diff floor preserved — no edits to any v1 file

key-decisions:
  - "Verbatim transcription of CONTEXT D-05 — no parameter exploration. Triangle envelope was locked during Phase 7 planning (auditioned via triangle-demo.html)."
  - "Tests mirror singingBowl.test.ts:48-88 stubGlobal pattern verbatim, simplified for single-osc + single-gain assertions."
  - "Explicit not.toBe(0) guard on the exponentialRampToValueAtTime decay target enforces Web Audio spec compliance (cannot ramp to exactly 0)."

patterns-established:
  - "Single-strike sound contract: export function strike<Name>(ac: AudioContext, masterGain = 1.0): void — pure side-effect factory, returns void, no node refs stored, audio graph owns lifecycle, GC after osc.stop()."
  - "Constructor-stub mocking idiom for sound tests: stubGlobal OscillatorNode + GainNode, push every instance into a per-test array reset by buildMockAudioContext, assert on options.frequency/type and gain.linearRampToValueAtTime.mock.calls."

requirements-completed:
  - AUD-05

# Metrics
duration: 2m 22s
completed: 2026-05-09
---

# Phase 7 Plan 01: Triangle Sound Primer Summary

**Synthesized click-free F7 triangle strike (2793.83 Hz) with constructor-stub regression net — primes Phase 7 segment-end dispatch and locks AUD-05 (D-06 reframed) at code level.**

## Performance

- **Duration:** 2m 22s
- **Started:** 2026-05-09T20:01:54Z
- **Completed:** 2026-05-09T20:04:17Z
- **Tasks:** 2 / 2
- **Files modified:** 2 (both newly created)

## Accomplishments

- Created `src/engine/sounds/triangle.ts` exporting `strikeTriangle(ac, masterGain = 1.0)` with the verbatim D-05 envelope: 1 OscillatorNode (sine, 2793.83 Hz) + 1 GainNode, 8 ms linearRamp attack to peak `0.4 * masterGain`, 2.0 s exponentialRamp decay to 0.001, `osc.stop(t + 2.1)`.
- Created `src/engine/sounds/__tests__/triangle.test.ts` with 9 passing constructor-stub assertions covering frequency, type, attack peak/timing, decay target/timing, lifecycle (start/stop), masterGain scaling, and explicit Web Audio spec compliance (`not.toBe(0)` on exponential ramp target).
- Confirmed v1 zero-diff floor (SEG-05): only the two new files were modified; `git diff --name-only HEAD~2 HEAD` returns exactly the two expected paths.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create src/engine/sounds/triangle.ts with click-free F7 envelope** — `4157aa7` (feat)
2. **Task 2: Create constructor-stub unit tests verifying the locked D-05 envelope** — `9f0475d` (test)

## Triangle Envelope (final, verbatim D-05)

| Parameter | Value | Source |
|-----------|-------|--------|
| Frequency | 2793.83 Hz (F7, equal temperament A4=440) | D-05 LOCKED |
| Wave type | `sine` | D-05 LOCKED |
| Initial gain | 0 (set on construction + setValueAtTime(0, t)) | D-05 LOCKED |
| Attack peak | `0.4 * masterGain` (default `masterGain = 1.0`) | D-05 LOCKED |
| Attack time | 8 ms (`t + 0.008`, `linearRampToValueAtTime`) | D-05 LOCKED, AUD-05 click-free floor ≥5 ms |
| Decay target | 0.001 (NEVER 0 — Web Audio spec forbids exact-zero ramps) | D-05 LOCKED |
| Decay time | 2.0 s (`t + 2.0`, `exponentialRampToValueAtTime`) | D-05 LOCKED |
| Stop scheduled | `t + 2.1` (0.1 s safety past decay end) | D-05 LOCKED |
| Topology | `osc → gain → ac.destination` | Standard single-partial |

No deviation from PATTERNS guidance.

## Test Inventory (9 / 9 passing)

| # | Name | Asserts |
|---|------|---------|
| 1 | is exported as a function | `typeof strikeTriangle === 'function'` |
| 2 | creates exactly 1 OscillatorNode per strike | `mockOscillatorInstances.length === 1` |
| 3 | sets frequency to F7 (2793.83 Hz) | `osc.frequency === 2793.83` |
| 4 | uses sine wave type | `osc.type === 'sine'` |
| 5 | creates exactly 1 GainNode initialized at gain 0 | `mockGainInstances.length === 1 && _initialGain === 0` |
| 6 | applies 8 ms linear attack to peak 0.4 * masterGain (default 1.0) | `linearRampToValueAtTime` called once with `(0.4, 0.008)` |
| 7 | uses exponential decay to 0.001 (never to 0) over 2.0 s | `exponentialRampToValueAtTime` called once with `(0.001, 2.0)` + `not.toBe(0)` guard |
| 8 | starts at t and stops at t + 2.1 (cleanly past decay) | `osc.start(0)` + `osc.stop(2.1)` |
| 9 | scales peak gain linearly with masterGain | `strikeTriangle(ac, 0.5)` → `linearRampToValueAtTime(0.2, ...)` |

**masterGain scaling validation result:** PASSED. Calling `strikeTriangle(ac, 0.5)` produced `linearRampToValueAtTime(0.2, 0.008)` (= 0.4 × 0.5 linear scaling, asserted in Test 9).

## Files Created/Modified

- `src/engine/sounds/triangle.ts` (NEW, 30 lines) — `strikeTriangle(ac, masterGain?)` factory with locked D-05 envelope and JSDoc referencing AUD-05/D-06 and the `triangle-demo.html` audition artifact.
- `src/engine/sounds/__tests__/triangle.test.ts` (NEW, 145 lines) — 9 constructor-stub assertions covering envelope params, lifecycle, and masterGain scaling.

## Decisions Made

None new — plan was a verbatim transcription of locked Phase 7 decisions (D-05 envelope, D-06 AUD-05 reframing, D-22 test file location). PATTERNS.md guidance followed exactly.

## Deviations from Plan

None — plan executed exactly as written.

## Downstream Pointer (per plan output spec)

`import { strikeTriangle } from './triangle'` is the dispatch target for the `'triangle'` key in 07-03's `fireSegmentEndSound(ac, key)`. The function signature `(ac: AudioContext, masterGain = 1.0) => void` is final for Phase 7; Phase 9 may add a `previewTriangle()` preview helper later (RESEARCH Open Q #3) without disturbing this contract.

## v1 Zero-Diff (SEG-05) Verification

```
git diff --name-only HEAD~2 HEAD
src/engine/sounds/__tests__/triangle.test.ts
src/engine/sounds/triangle.ts
```

Only the two newly created files. No edits to any of:
- `src/engine/{AlarmEngine,AlarmState,AlarmSession,AudioContext,timer}.ts`
- `src/engine/sounds/{singingBowl,phase3Tone,keepalive,testSound,tickPulse}.ts`
- `src/hooks/useAlarm.ts`, `src/components/{Countdown,ProgressRing,Dashboard}.tsx`
- `src/platform/{wakeLock,vibration,notifications}.ts`

## Acceptance Verification

| Plan criterion | Result |
|----------------|--------|
| `test -f src/engine/sounds/triangle.ts` | PASS |
| `test -f src/engine/sounds/__tests__/triangle.test.ts` | PASS |
| `grep -c "frequency: 2793.83" src/engine/sounds/triangle.ts` = 1 | PASS |
| `grep -c "linearRampToValueAtTime(0.4 * masterGain, t + 0.008)"` = 1 | PASS |
| `grep -c "exponentialRampToValueAtTime(0.001, t + 2.0)"` = 1 | PASS |
| `grep -c "osc.stop(t + 2.1)"` = 1 | PASS |
| `grep -c "new OscillatorNode(ac"` = 1 | PASS |
| `grep -c "type: 'sine'"` = 1 | PASS |
| `grep -c "triangle-demo.html"` = 1 | PASS |
| `grep -c "^export function strikeTriangle"` = 1 | PASS |
| `npx tsc --noEmit` exits 0 | PASS |
| `grep -c "toBe(2793.83)"` ≥ 1 | PASS (1) |
| `grep -c "0.008"` ≥ 1 | PASS (1) |
| `grep -c "toBe(0.001)"` ≥ 1 | PASS (1) |
| `grep -c "not.toBe(0)"` ≥ 1 | PASS (1) |
| `grep -c "strikeTriangle(ac, 0.5)"` = 1 | PASS |
| `grep -c "stubGlobal"` ≥ 2 | PASS (3) |
| `npx vitest run src/engine/sounds/__tests__/triangle.test.ts` exits 0 | PASS (9/9 tests passed) |

## Self-Check: PASSED

- File `src/engine/sounds/triangle.ts`: FOUND
- File `src/engine/sounds/__tests__/triangle.test.ts`: FOUND
- Commit `4157aa7` (Task 1): FOUND
- Commit `9f0475d` (Task 2): FOUND
