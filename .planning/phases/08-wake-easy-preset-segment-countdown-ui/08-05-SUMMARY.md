---
phase: 08-wake-easy-preset-segment-countdown-ui
plan: 05
subsystem: components
tags: [react, component, countdown, ui, tdd, vitest, testing-library]

# Dependency graph
requires:
  - phase: 08-wake-easy-preset-segment-countdown-ui
    provides: useSegmentAlarm hook + UseSegmentAlarmReturn type (Plan 08-02); SegmentProgressRing component (Plan 08-03); vitest jsdom env + @testing-library/react render (Plan 08-01); .pulse-active keyframe rule in src/index.css (Plan 08-01)
  - phase: 03-react-ui
    provides: Countdown.tsx — the SEG-05 byte-identical-protected analog whose layout + class strings are mirrored (read-only)
  - phase: 02-engine-core
    provides: formatMmSs utility from src/utils/formatTime.ts
provides:
  - SegmentCountdown component — active alarm screen for segment-mode (replaces dev-only SegmentHarness in Plan 08-06)
  - SOUND_LABELS export-level vocabulary ('Gentle chime' / 'Triangle ping' / 'Wake') used for the segment-index phase label
  - 18-test coverage net for D-03/D-05/D-19/D-20 visual + interaction contract
  - cleanup() + afterEach pattern for component tests with vitest globals: false (precedent for Phase 9+ component tests with shared text content)
affects:
  - 08-06 App.tsx wiring — DIRECT consumer; renders <SegmentCountdown alarm={state.alarm}> when useActiveAlarm() returns mode === 'segments'

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mirror-and-delta component pattern: clone v1 Countdown.tsx layout class strings byte-for-byte, then apply the locked Phase 8 deltas (total caption, segment-index label, count-up during firing-alarm, disabled Pause). The mirror keeps visual continuity with continuous-mode; the deltas are the only places the component diverges from v1"
    - "Three-state display ticker: extends Countdown.tsx:74-93 from one state (displayRemainingMs) to three (segmentRemainingMs / totalRemainingMs / elapsedSinceAlarmMs). Effect dependency array includes all six read fields (alarm.isPaused, alarm.isRunning, alarm.segmentEndsAt, alarm.totalEndsAt, alarm.state, alarm.alarmStartedAt) — missing any causes a stale-closure bug per T-08-05-01 mitigation"
    - "Progress = 0 force-pin during firing-alarm: SegmentProgressRing's current-arc render gates on `remainingArc > 0.001`. With segmentEndsAt = 0 from the hook and progress derived from segmentRemainingMs, the natural progress would be 1 → arc disappears. Forcing progress = 0 when state === 'firing-alarm' keeps the full alarm arc visible for the .pulse-active keyframe to drive (D-03)"
    - "RTL cleanup() in afterEach with vitest globals: false: the existing test setup uses globals: false (matches the explicit-import convention of every test file), which means @testing-library/react's auto-cleanup hook is not wired. Component tests that render shared text (multiple tests rendering a button labeled 'Pause') need explicit cleanup() in afterEach to prevent DOM leak between tests. Future component tests Phase 9+ should adopt this pattern"

key-files:
  created:
    - src/components/SegmentCountdown.tsx (135 lines)
    - src/components/__tests__/SegmentCountdown.test.tsx (252 lines, 18 it() blocks)
  modified: []

key-decisions:
  - "SOUND_LABELS export-level constant (not function-scoped): keeps the 'Gentle chime' / 'Triangle ping' / 'Wake' vocabulary discoverable via grep and importable for tests if Phase 9 needs it. Matches PHASE_LABELS placement in Countdown.tsx:25-31"
  - "isFiringAlarm hoisted into a local const above the JSX rather than inlined into each prop: avoids three repeated `alarm.state === 'firing-alarm'` reads that the linter would warn about and lets the compiler's narrowing flow recognize the same value across the timer, caption, and label conditionals"
  - "Progress = 0 force-pin during firing-alarm (Rule 1 fix during GREEN): the SegmentProgressRing render gate `remainingArc > 0.001` would otherwise drop the alarm arc when segmentEndsAt = 0 yields progress = 1. Forcing progress = 0 makes the full alarm-color arc visible for the pulse-active keyframe (D-03 contract: 'pulses at 1 Hz when state === firing-alarm'). Discovered when the wiring test asserted exactly one `.pulse-active` element and got zero"
  - "cleanup() in afterEach (Rule 3 fix during GREEN): vitest globals: false breaks RTL's auto-cleanup. Six tests failed with 'Found multiple elements with the text: Pause' until cleanup() was added — the prior tests' DOM had not been torn down. Imported from @testing-library/react and called before vi.useRealTimers() to keep ordering stable"
  - "Test fixture uses fake timers + setSystemTime for deterministic Date.now() math: segmentEndsAt = Date.now() + 240_000 must produce '04:00' on first render. Without setSystemTime, real-clock drift between fixture construction and the component's useState initializer would produce '03:59' or '04:00' nondeterministically. setSystemTime to a fixed ISO timestamp pins both"
  - "Component-level pause guard NOT duplicated: the hook's pause() already guards on engine.canPause(); the button just calls alarm.pause directly. The disabled={isFiringAlarm} prop is the visible affordance. Defense-in-depth (T-08-05-02) is hook-level, not view-level"

patterns-established:
  - "Mirror-and-delta layout for paired v2 components: the locked Tailwind class strings live verbatim in both files (Countdown.tsx and SegmentCountdown.tsx). Future Phase-9 ComposerCountdown (or any third active-alarm screen) should follow the same pattern — copy from Countdown.tsx as the canonical source, apply documented deltas, never modify Countdown.tsx itself (SEG-05 floor)"
  - "Test-fixture builder for hook-return shapes: makeAlarm(overrides: Partial<UseSegmentAlarmReturn> = {}) centralizes the default fixture and lets each test mutate only the field under exam. Reduces duplication and makes the test diff readable. Pattern transferable to any future component that consumes a hook return"
  - "Exact phase-label format string in test assertions: `expect(container.textContent).toContain('Segment 1 of 5 — Gentle chime')` locks the user-visible string verbatim. Future copy changes must update both the component and the test in lockstep — prevents silent UI string drift"

requirements-completed: [SEG-06]

# Metrics
duration: 4m 42s
completed: 2026-05-10
---

# Phase 08 Plan 05: SegmentCountdown Active-Alarm Screen Summary

SegmentCountdown — the production active-alarm screen for segment-mode — shipped with byte-for-byte layout fidelity to v1's Countdown.tsx (SEG-05 protected) plus the four locked Phase 8 deltas (D-03, D-05, D-19): total-time caption, segment-index phase label with SOUND_LABELS vocabulary, count-up timer during firing-alarm, disabled Pause during firing-alarm. 18 it() blocks span the D-20 coverage matrix; vitest 373/373 passes; SEG-05 zero-diff floor preserved across all 8 protected paths.

## What Shipped

### `src/components/SegmentCountdown.tsx` (135 lines)

- Default-export React function component with one prop: `alarm: UseSegmentAlarmReturn`.
- Imports: `useState`, `useEffect`, `UseSegmentAlarmReturn` (type-only), `SegmentProgressRing`, `formatMmSs`. Drops `useRef` and `AlarmPhase` from v1 imports — no component-local refs needed (alarmStartedAt lives in hook state per D-03).
- `SOUND_LABELS` export-level constant — `Record<'gentle' | 'triangle' | 'alarm', string>` mapping segment endSounds to UI labels: `'Gentle chime'`, `'Triangle ping'`, `'Wake'`. Locked by UI-SPEC L174-180.
- Three-state ticker (`useState` triple: `segmentRemainingMs`, `totalRemainingMs`, `elapsedSinceAlarmMs`). Effect dep array lists all six read fields per T-08-05-01 mitigation.
- 250ms cadence interval, freezes when `alarm.isPaused || !alarm.isRunning`, cleared on unmount and on dep change. Mirrors Countdown.tsx:74-93 pattern verbatim.
- Layout JSX:
  - Outer wrapper `<div className="flex flex-col items-center w-full max-w-md mx-auto px-6 py-12">` — verbatim from Countdown.tsx:111.
  - `<SegmentProgressRing>` rendered with `pulseActive={isFiringAlarm}` and `pausedDimming={alarm.isPaused}`. Receives `progress = isFiringAlarm ? 0 : computed` — the force-pin makes the alarm arc visible for the pulse keyframe.
  - Big timer `<span>` — verbatim class + style from Countdown.tsx:118-127. Renders `formatMmSs(isFiringAlarm ? elapsedSinceAlarmMs : segmentRemainingMs)`.
  - Total caption `<span className="text-text-secondary text-xs mt-1">` — NEW per UI-SPEC L259-265. Hidden when `isFiringAlarm` (D-05).
  - Phase label `<span className="text-text-secondary text-sm mt-2 transition-opacity duration-500">` — uses `mt-2` (vs v1's `mt-1`) per UI-SPEC L271-275 to compensate for the new caption above it. Renders `'Wake'` when firing-alarm; otherwise `` `Segment ${index+1} of ${total} — ${SOUND_LABELS[endSound]}` ``.
  - Control row `<div className="flex gap-4 mt-10">` — verbatim from Countdown.tsx:136. Stop button verbatim from 145-150.
  - Pause button — verbatim Countdown.tsx:139 PLUS `disabled={isFiringAlarm}` and `disabled:opacity-40 disabled:cursor-not-allowed` Tailwind utilities (the one Phase 8 className delta).

### `src/components/__tests__/SegmentCountdown.test.tsx` (252 lines, 18 it() blocks)

Six describe groups covering the D-20 coverage matrix:

1. **Initial render (segment 1, running)** — 4 tests: big mm:ss = '04:00', total caption = '17:00 total', segment label = 'Segment 1 of 5 — Gentle chime', both buttons enabled.
2. **Phase label varies by endSound** — 2 tests: 'Triangle ping' for triangle, 'Gentle chime' for gentle.
3. **Pause state (D-19)** — 4 tests: 'Resume' label flip when paused, click handlers wired (pause/resume/stop call counts).
4. **Firing-alarm state (D-03)** — 4 tests: Pause disabled with disabled:opacity-40 + cursor-not-allowed classes; big timer count-up = '00:05'; 'Wake' label (no 'Segment 5 of 5'); total caption hidden.
5. **Ticker (250ms cadence + freeze on pause)** — 2 tests: timer text changes from '04:00' to '03:59' after vi.advanceTimersByTime(1000); timer text unchanged after 5000ms when paused.
6. **SegmentProgressRing wiring** — 2 tests: exactly one `.pulse-active` element when state === 'firing-alarm'; current arc opacity 0.5 when paused.

`makeAlarm(overrides: Partial<UseSegmentAlarmReturn> = {})` helper centralizes the default fixture. `beforeEach` wires `vi.useFakeTimers()` + `vi.setSystemTime(new Date('2026-05-10T10:00:00.000Z'))`; `afterEach` calls `cleanup()` then `vi.useRealTimers()`.

## Acceptance Verification

| Criterion | Result |
|-----------|--------|
| File `src/components/SegmentCountdown.tsx` exists | yes (135 lines) |
| File `src/components/__tests__/SegmentCountdown.test.tsx` exists | yes (252 lines, 18 it() blocks ≥ required 13) |
| `npx vitest run src/components/__tests__/SegmentCountdown.test.tsx` exits 0 | 18/18 passing |
| `npx vitest run` (full suite) exits 0 | 373/373 across 31 files |
| `npx tsc --noEmit` exits 0 | clean (no output) |
| All RED-then-GREEN literal-string acceptance tokens present | confirmed: `WAKE_EASY_CONFIG`, `Segment 1 of 5 — Gentle chime`, `17:00 total`, `'firing-alarm'`, `disabled:opacity-40`, `disabled:cursor-not-allowed`, `pulse-active`, `'Wake'`, `setInterval`, `clearInterval`, `}, 250)`, `var(--font-size-countdown)`, the wrapper class string, and the phase-label class string |
| File does NOT contain `phase3StartRef` | confirmed — uses hook-state `alarmStartedAt` per D-03 |
| File does NOT contain `from '../hooks/useAlarm'` | confirmed — pairs with useSegmentAlarm |
| SEG-05 byte-identical guardrail | git diff returns 0 lines across Countdown.tsx, ProgressRing.tsx, SegmentProgressRing.tsx, useAlarm.ts, useSegmentAlarm.ts, useActiveAlarm.ts, SegmentEngine.ts, SegmentState.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] RTL DOM leak between tests with vitest globals: false**
- **Found during:** Task 2 GREEN — six tests failed with `TestingLibraryElementError: Found multiple elements with the text: Pause` after the production module landed. The first test's render() left buttons in document.body that subsequent renders appended to.
- **Root cause:** vitest.config.ts has `globals: false` (matches the existing convention of explicit vitest imports). RTL's auto-cleanup-after-each-test hook only registers when vitest globals are exposed.
- **Fix:** Added `import { ..., cleanup } from '@testing-library/react'` and called `cleanup()` in `afterEach` before `vi.useRealTimers()`. Six failing tests went green immediately; no other tests in the suite were affected (existing SegmentProgressRing tests don't share text content between renders, so the leak was latent).
- **Files modified:** `src/components/__tests__/SegmentCountdown.test.tsx` (3 lines added: import, afterEach call, no other surface).
- **Commit:** `db1acb4` (folded into the GREEN commit since the test file is part of the same TDD pair).

**2. [Rule 1 - Bug] Progress = 1 during firing-alarm dropped the alarm arc**
- **Found during:** Task 2 GREEN — the SegmentProgressRing wiring test asserted exactly one `.pulse-active` element when `state === 'firing-alarm'` and got zero.
- **Root cause:** `useSegmentAlarm` sets `segmentEndsAt = 0` when the engine transitions to firing-alarm (per D-03). The component then computed `progress = 1 - 0 / durationMs = 1`. SegmentProgressRing.tsx:130-150 gates the current-arc render on `remainingArc = (1 - clampedProgress) * arcLen > 0.001` — at progress = 1, remainingArc = 0 → arc dropped → no `.pulse-active` element.
- **Fix:** Added a force-pin: `const progress = isFiringAlarm ? 0 : <computed>`. With progress = 0, remainingArc = arcLen → full alarm arc visible → `.pulse-active` className applied → keyframe drives the pulse.
- **Why this is correct per spec:** D-03 says the alarm arc 'pulses at 1 Hz when state === firing-alarm'. The pulse cannot exist without an arc to apply the keyframe to. The arc is 'full' during firing-alarm because there's nothing more to count down to — the alarm is already firing.
- **Files modified:** `src/components/SegmentCountdown.tsx` (the progress declaration restructured into a ternary; added a 3-line comment explaining the pin).
- **Commit:** `db1acb4` (folded into GREEN — the fix is intrinsic to the production module).

### Authentication Gates

None.

## TDD Gate Compliance

- RED commit: `5c0488d` — `test(08-05): add failing tests for SegmentCountdown active-alarm screen` (vitest reports `Failed to resolve import "../SegmentCountdown"` — production module did not exist).
- GREEN commit: `db1acb4` — `feat(08-05): implement SegmentCountdown active-alarm screen` (18/18 tests pass; tsc clean; full suite 373/373).
- REFACTOR commit: not required — the production module landed in its target shape on the first GREEN pass; the two auto-fixes (cleanup() and progress force-pin) were corrections, not refactorings.

Gate sequence honored.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: `src/components/SegmentCountdown.tsx`
- FOUND: `src/components/__tests__/SegmentCountdown.test.tsx`
- FOUND commit: `5c0488d` (RED)
- FOUND commit: `db1acb4` (GREEN)
- FOUND: `.pulse-active` keyframe wiring verified (1 element when state === 'firing-alarm', 0 otherwise)
- FOUND: SEG-05 zero-diff floor (`git diff` across 8 protected paths returns 0 lines)
