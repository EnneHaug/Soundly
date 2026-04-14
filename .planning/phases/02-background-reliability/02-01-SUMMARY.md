---
phase: 02-background-reliability
plan: "01"
subsystem: alarm-engine-phase2
tags: [vibration, wake-lock, tick-pulse, presets, platform-apis, tdd]
dependency_graph:
  requires:
    - 01-02 (AlarmEngine state machine, timer, keepalive)
  provides:
    - QUICK_NAP_CONFIG and FOCUS_CONFIG preset exports
    - Android vibration loop (startVibration/stopVibration)
    - iOS tick pulse synthesis (playTick)
    - Screen Wake Lock with visibility re-acquisition
    - Phase 2 wired into AlarmEngine
  affects:
    - src/engine/AlarmEngine.ts (Phase 2 callback wired)
    - src/engine/AlarmState.ts (preset configs added)
    - src/engine/index.ts (barrel exports expanded)
tech_stack:
  added:
    - src/platform/ directory (new module boundary for browser platform APIs)
  patterns:
    - Factory pattern for AudioBufferSourceNode (same as singingBowl, keepalive)
    - setInterval + vibrate(0) stop pattern (anti-pattern avoided: large pattern array)
    - WakeLockSentinel + visibilitychange re-acquire (MDN verified pattern)
    - Feature detection ('vibrate' in navigator, 'wakeLock' in navigator)
key_files:
  created:
    - src/platform/vibration.ts
    - src/platform/wakeLock.ts
    - src/engine/sounds/tickPulse.ts
    - src/platform/__tests__/vibration.test.ts
    - src/platform/__tests__/wakeLock.test.ts
    - src/engine/sounds/__tests__/tickPulse.test.ts
  modified:
    - src/engine/AlarmState.ts (added QUICK_NAP_CONFIG, FOCUS_CONFIG)
    - src/engine/AlarmEngine.ts (wired Phase 2, Wake Lock)
    - src/engine/__tests__/AlarmEngine.test.ts (added 11 new tests)
    - src/engine/index.ts (expanded barrel exports)
decisions:
  - Placed platform APIs in src/platform/ to separate browser API concerns from pure engine logic
  - Tick loop uses 500ms interval matching the 300ms+200ms vibration rhythm (D-01/D-03 alignment)
  - stopVibration() is always called in cleanup() regardless of platform (safe no-op on iOS)
  - wakeLock test environment: node mode requires stubbing document global (no jsdom)
metrics:
  duration_seconds: 416
  completed_date: "2026-04-14"
  tasks_completed: 2
  files_created: 6
  files_modified: 4
  tests_added: 43
  total_tests: 97
---

# Phase 2 Plan 01: Preset Configs, Phase 2 Escalation, and Wake Lock Summary

**One-liner:** QUICK_NAP/FOCUS presets, Android vibration loop, iOS bandpass-noise tick pulse with volume ramp, and Screen Wake Lock with visibilitychange re-acquisition — all wired into AlarmEngine with 97 passing tests.

## What Was Built

### Task 1: Preset configs, vibration module, tick pulse, Wake Lock module

**src/engine/AlarmState.ts** — added two preset exports:
- `QUICK_NAP_CONFIG`: phase1=5min, phase2=5min, gap=10s, ramp=1min (ALM-02)
- `FOCUS_CONFIG`: phase1=21min, phase2=2min, gap=10s, ramp=1min (ALM-03)

**src/platform/vibration.ts** — Android vibration loop:
- `startVibration()`: calls `navigator.vibrate([300, 200])` immediately, then `setInterval` every 500ms
- `stopVibration()`: clears interval, calls `navigator.vibrate(0)` to cancel hardware vibration
- No-op on iOS/desktop via `'vibrate' in navigator` feature detection

**src/engine/sounds/tickPulse.ts** — iOS Phase 2 audio fallback:
- `playTick(ac, masterGain, bandHz?)`: creates 50ms `AudioBuffer` filled with white noise, routes through `BiquadFilterNode` (bandpass, 2000Hz, Q=2) to caller-provided `masterGain`
- Factory pattern — new `AudioBufferSourceNode` per tick (same constraint as OscillatorNode)
- Caller controls volume envelope (D-04 ramp handled in AlarmEngine)

**src/platform/wakeLock.ts** — Screen Wake Lock lifecycle:
- `acquireWakeLock()`: requests `navigator.wakeLock.request('screen')`, catches `NotAllowedError`
- `releaseWakeLock()`: releases sentinel, clears re-acquire flag
- `attachVisibilityReacquire()`: returns cleanup fn; listener re-acquires on `visibilitychange` when visible and `_shouldHoldLock` is true

### Task 2: Wire Phase 2 into AlarmEngine + barrel exports

**src/engine/AlarmEngine.ts** — Phase 2 wiring:
- `start()` now calls `acquireWakeLock()` and `attachVisibilityReacquire()` after AudioContext
- New private `enterPhase2(durationMs)`: Android path calls `startVibration()`; iOS/desktop path creates a `GainNode` with linear ramp (0.01→0.7 over phase2DurationMs) and starts 500ms tick interval
- `cleanup()` calls `stopVibration()`, clears tick interval, disconnects tick GainNode, calls `releaseWakeLock()`, invokes visibilityCleanup

**src/engine/index.ts** — expanded barrel exports include all new preset configs and platform utilities

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `05e82ab` | feat(02-01): preset configs, vibration module, tick pulse, and Wake Lock |
| 2 | `7767093` | feat(02-01): wire Phase 2 vibration/tick into AlarmEngine and update barrel exports |

## Test Results

- **Total tests:** 97 passing, 0 failing
- **New tests:** 43 (10 vibration, 13 wakeLock, 9 tickPulse, 11 new AlarmEngine)
- **TypeScript:** `npx tsc --noEmit` exits 0

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mock chain for tickPulse connection order**
- **Found during:** Task 1 GREEN phase
- **Issue:** `AudioBufferSourceNode.connect` mock using `mockReturnThis()` returned the source, not the filter, causing the `filter.connect(masterGain)` assertion to fail (0 calls)
- **Fix:** Changed source mock's `connect` to return the latest filter instance (late-binding via `filterInstances[filterInstances.length - 1]`), and filter mock to `mockReturnValue(undefined)`
- **Files modified:** `src/engine/sounds/__tests__/tickPulse.test.ts`
- **Commit:** included in `05e82ab`

**2. [Rule 1 - Bug] vibration test mockClear erased vibrate(0) call before assertion**
- **Found during:** Task 1 GREEN phase
- **Issue:** Test called `mockVibrate.mockClear()` after `stopVibration()` (which already called `vibrate(0)`), then expected `vibrate(0)` to have been called — impossible after clear
- **Fix:** Removed `mockClear`; instead capture call count after stop and assert it doesn't increase during timer advance
- **Files modified:** `src/platform/__tests__/vibration.test.ts`
- **Commit:** included in `05e82ab`

**3. [Rule 1 - Bug] wakeLock tests failed with "document is not defined" in node environment**
- **Found during:** Task 1 GREEN phase
- **Issue:** `vitest.config.ts` uses `environment: 'node'`, so `document` global is not available. Tests calling `attachVisibilityReacquire()` failed at runtime.
- **Fix:** Created a `createMockDocument()` helper in the test file that returns a minimal EventTarget-compatible object; stub it via `vi.stubGlobal('document', mockDoc)` before tests that need it
- **Files modified:** `src/platform/__tests__/wakeLock.test.ts`
- **Commit:** included in `05e82ab`

## Known Stubs

None — all modules are fully wired. The Phase 2 tick loop and vibration are connected to `AlarmEngine.enterPhase2()`. Wake Lock is acquired in `start()` and released in `cleanup()`.

## Threat Flags

No new network endpoints, auth paths, or file access patterns introduced. All threat register items from the plan's `<threat_model>` are mitigated:

| Threat | Mitigation |
|--------|-----------|
| T-02-01 (vibration DoS) | `stopVibration()` called in `cleanup()` + `vibrate(0)` cancels hardware |
| T-02-02 (tick loop DoS) | `clearInterval(tickLoopTimer)` + `tickGain.disconnect()` in `cleanup()` |
| T-02-03 (wake lock loss) | Accepted — OS reclaims on tab crash; `releaseWakeLock()` handles intentional release |
| T-02-04 (wake lock logging) | `console.debug` only — no sensitive data |

## Self-Check: PASSED

All files exist, all commits verified, 97 tests pass, TypeScript compiles clean.
