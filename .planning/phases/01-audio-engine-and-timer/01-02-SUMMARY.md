---
phase: 01-audio-engine-and-timer
plan: "02"
subsystem: engine
tags: [alarm-engine, state-machine, timer, typescript]
dependency_graph:
  requires: [01-01]
  provides: [AlarmEngine, AlarmPhase, AlarmConfig, scheduleAt, TimerHandle, barrel-export]
  affects: [phase-02-react-ui, phase-03-pwa]
tech_stack:
  added: []
  patterns:
    - Drift-free wall-clock timer using Date.now() + recursive setTimeout
    - _running flag to guard start() during idle countdown period
    - Factory pattern for Phase 3 swell oscillator loops
    - Private cleanup() shared between stop() and dismiss()
key_files:
  created:
    - src/engine/AlarmState.ts
    - src/engine/timer.ts
    - src/engine/AlarmEngine.ts
    - src/engine/index.ts
    - src/engine/__tests__/timer.test.ts
    - src/engine/__tests__/AlarmEngine.test.ts
  modified: []
decisions:
  - "_running flag separate from AlarmPhase: phase stays 'idle' during countdown; _running tracks whether start() was called"
  - "phase2to3GapMs exposed in AlarmConfig so Phase 2 presets (ALM-02, ALM-03) can configure gap without touching engine code"
  - "validateConfig() enforces >0 and <=14_400_000ms (4h) on all durations (T-01-04)"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-14"
  tasks_completed: 2
  files_created: 6
---

# Phase 1 Plan 02: AlarmEngine State Machine and Timer Summary

**One-liner:** Drift-free wall-clock timer (Date.now() delta) and AlarmEngine state machine (idle→phase1→phase2→phase3→dismissed) with full cleanup, configurable phase2to3GapMs, and barrel export.

## What Was Built

### Task 1: AlarmState types and drift-free wall-clock timer
Commit: `0279f84`

- `src/engine/AlarmState.ts` — type vocabulary for the alarm state machine:
  - `AlarmPhase = 'idle' | 'phase1' | 'phase2' | 'phase3' | 'dismissed'`
  - `AlarmConfig` with `phase1DurationMs`, `phase2DurationMs`, `phase3RampDurationMs`, `phase2to3GapMs`
  - `DEFAULT_CONFIG` (5m/5m/1m/10s)
  - `validateConfig()` — rejects durations <= 0 or > 14,400,000ms (T-01-04)
  - `PhaseChangeCallback` type alias

- `src/engine/timer.ts` — drift-free scheduler:
  - `scheduleAt(targetEpochMs, callback, checkIntervalMs=250)` using `Date.now()` comparison per tick
  - `TimerHandle` interface with `cancel()` method
  - No `setInterval` — each tick schedules the next via `setTimeout`

- 4 timer tests pass: fire-on-target, cancel-prevention, past-target, single-call

### Task 2: AlarmEngine state machine and barrel export
Commit: `2785851`

- `src/engine/AlarmEngine.ts` — main orchestrator:
  - `start(config)` — validates config, acquires AudioContext, starts keepalive oscillator, schedules three phase timers using `scheduleAt()`
  - `_running` boolean guards against duplicate `start()` calls (T-01-06); separate from `phase` because phase stays 'idle' during countdown
  - `enterPhase3(rampDurationMs)` — creates volume ramp GainNode, starts looping swell oscillator (3.2s cycle via `setInterval`, cleared on stop/dismiss)
  - `stop()` — full cleanup + returns to 'idle'
  - `dismiss()` — full cleanup + transitions to 'dismissed'
  - `cleanup()` — cancels timers, stops keepalive, clears Phase 3 interval, fades out ramp gain (no click artifacts)
  - `onPhaseChange(cb)` — single callback slot for React integration
  - `getPhase()` — read-only phase accessor

- `src/engine/index.ts` — barrel export: `AlarmEngine`, `AlarmPhase`, `AlarmConfig`, `PhaseChangeCallback`, `DEFAULT_CONFIG`, `validateConfig`, `getAudioContext`, `playTestSound`, `TEST_SOUND_GAIN`

- 11 AlarmEngine tests pass covering all state transitions, guard conditions, and cleanup

## Verification Results

```
Test Files  6 passed (6)
Tests       54 passed (54)
  - timer.test.ts: 4 passed
  - AlarmEngine.test.ts: 11 passed
  - singingBowl.test.ts: 10 passed
  - keepalive.test.ts: 9 passed
  - phase3Tone.test.ts: 13 passed
  - testSound.test.ts: 7 passed
TypeScript: npx tsc --noEmit -> clean (0 errors)
setInterval in timer.ts: none (comments only -- correct)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added `_running` flag to guard start() during idle countdown**
- **Found during:** Task 2 test execution
- **Issue:** Plan stated "phase stays 'idle' during countdown period" AND "start() throws if phase !== 'idle'". These two requirements are contradictory — if phase is idle during countdown, a second start() wouldn't throw.
- **Fix:** Added private `_running: boolean` field set to `true` on `start()` and reset to `false` in `cleanup()`. The `start()` guard now checks `this._running` instead of `this.phase !== 'idle'`.
- **Files modified:** `src/engine/AlarmEngine.ts`
- **Commit:** `2785851` (included in Task 2 commit)

## Known Stubs

None — all data flows are wired. Phase 3 React integration will consume the barrel export from `src/engine/index.ts`.

## Threat Flags

None — all T-01-04, T-01-05, T-01-06 mitigations from the plan's threat model are implemented:
- T-01-04: `validateConfig()` enforces duration bounds
- T-01-05: Phase 3 `setInterval` cleared in both `stop()` and `dismiss()`
- T-01-06: `_running` flag prevents duplicate `start()` calls

## Self-Check: PASSED

Files exist:
- FOUND: src/engine/AlarmState.ts
- FOUND: src/engine/timer.ts
- FOUND: src/engine/AlarmEngine.ts
- FOUND: src/engine/index.ts
- FOUND: src/engine/__tests__/timer.test.ts
- FOUND: src/engine/__tests__/AlarmEngine.test.ts

Commits exist:
- FOUND: 0279f84 (Task 1)
- FOUND: 2785851 (Task 2)
