---
phase: 07-segment-engine-triangle-sound
plan: 04
subsystem: engine
tags: [engine, state-machine, scheduling, audio, phase-7, orchestrator]

# Dependency graph
requires:
  - 07-01
    provides: strikeTriangle factory at src/engine/sounds/triangle.ts (consumed transitively via fireSegmentEndSound dispatcher)
  - 07-02
    provides: SegmentState types (Segment, SegmentConfig, SegmentEngineState, SegmentChangeEvent, SegmentPauseSnapshot) + validateSegmentConfig + WAKE_EASY_CONFIG
  - 07-03
    provides: fireSegmentEndSound(ac, key) — type-narrowed dispatcher for gentle/triangle one-shot strikes (D-13 carve-out)
  - phase: 06-alarmsession-refactor-v1-regression-guard
    provides: startAlarmSession() / endAlarmSession() — shared AudioContext + keepalive + WakeLock + visibility lifecycle
  - phase: 01-audio-engine-and-timer
    provides: scheduleAt(epochMs, cb) absolute-epoch drift-free timer at src/engine/timer.ts (read-only consumed)
  - phase: 05-ios-audio-loudness-fixes
    provides: createPhase3Ramp + startPhase3Swell + fadeOutGain (Phase 3 swell stack reused byte-identically for the alarm segment per D-01)
provides:
  - SegmentEngine class at src/engine/SegmentEngine.ts with 10 public methods (start/pause/resume/stop/dismiss/getState/getCurrentSegment/isPaused/canPause/onSegmentChange) per D-07..D-10
  - 23-test regression net at src/engine/__tests__/SegmentEngine.test.ts covering D-23 coverage matrix across 7 describe blocks
  - Per-key auto-stop window constants (gentle=6100, triangle=2100) implementing D-04
  - Pause snapshot shape with re-baselining on resume implementing SEG-03 / D-19..D-21
affects:
  - 07-05 (barrel + harness) imports SegmentEngine for re-export and instantiates `new SegmentEngine()` in SegmentHarness; calls .start(WAKE_EASY_CONFIG) / .onSegmentChange / .dismiss for the dev event log
  - Phase 8 (useSegmentAlarm hook) wraps SegmentEngine in a React ref-based hook mirroring useAlarm's pattern
  - Phase 9 (composer) feeds validated SegmentConfig into SegmentEngine.start (composer pre-validates; engine throws on !ok as defense-in-depth per RESEARCH Open Q #2)

# Tech tracking
tech-stack:
  added: []   # No new dependencies — pure orchestrator using existing engine + sounds primitives
  patterns:
    - "Class-as-AlarmSession-consumer pattern (established in Phase 6 P02): private session: SessionHandle | null field, await startAlarmSession() in lifecycle entry, guarded endAlarmSession(this.session); this.session = null in cleanup placed in the OLD v1-teardown slot. SegmentEngine mirrors this verbatim."
    - "Absolute-epoch scheduling vs chained setTimeout: scheduleAt(epochBaseline + cumulativeDuration, cb) per segment instead of chained setTimeout(durationMs). Eliminates accumulated drift through 17 minutes (Wake Easy total) via Date.now() comparison on each tick — same primitive as v1 phase fires."
    - "Per-key decay window for auto-stop (D-04): static readonly Record<'gentle'|'triangle', number> mapping each terminal-strike key to its envelope decay duration (gentle=6100 ms matching singingBowl's exponential tail; triangle=2100 ms matching strikeTriangle's osc.stop(t+2.1)). Avoids both audible truncation AND wasted Wake Lock time."
    - "State transition atomicity: state='firing-alarm' MUST happen BEFORE createPhase3Ramp call so canPause() flips to false atomically (D-03). UX cannot accidentally silence the fail-safe alarm by tapping a stale pause button between state read and ramp creation."
    - "Pitfall #6 fire ordering: emit 'end' event → increment currentIdx → emit 'start' event for next segment. Increment AFTER 'end' is observable so subscribers see the just-elapsed segment's index in the 'end' payload."
    - "Timer-mock pattern for absolute-epoch tests (RESEARCH §Drift measurement strategy): vi.mock('../timer') makes scheduleAt a vi.fn() that captures (epoch, callback) tuples. Tests synthesize fires by invoking the captured callback rather than advancing fake timers through scheduleAt's polling loop. Lets tests assert directly on the absolute epoch values."
    - "Dismiss-before-test-end discipline (Pitfall #2): every test that drives into 'firing-alarm' state MUST call engine.dismiss() before exiting to clear the 3200 ms swell-loop setInterval, otherwise the loop keeps firing and noise-pollutes subsequent tests."

key-files:
  created:
    - src/engine/SegmentEngine.ts
    - src/engine/__tests__/SegmentEngine.test.ts
  modified: []   # v1 zero-diff floor preserved — only new files added

key-decisions:
  - "Verbatim transcription of plan-prescribed action block. No deviation in shape, signature, ordering, or comment text. The action block was self-contained and fully specified; no design-space exploration needed."
  - "JSDoc reword for awk acceptance criterion: a comment in pause()'s JSDoc originally referenced state !== 'firing-alarm' with single quotes. The acceptance check `awk '/'firing-alarm'/{f=NR} /createPhase3Ramp/{c=NR} END{exit (f<c) ? 0 : 1}'` uses LAST-match semantics — having a quoted 'firing-alarm' AFTER the createPhase3Ramp line caused f>c and failed the check. Removed the single quotes from the comment text only (the actual code-level state transition at line 212 still uses 'firing-alarm' as a string literal, BEFORE createPhase3Ramp at line 213). This is a pure documentation tweak with zero behavioral effect."
  - "Object property explicit form (currentSegmentRemainingMs: currentSegmentRemainingMs): the plan's action block used the shorthand form `currentSegmentRemainingMs,` but the acceptance grep `grep -c \"currentSegmentRemainingMs:\"` requires the explicit colon form. Converted to explicit form to satisfy the grep without changing behavior."

requirements-completed:
  - SEG-02   # Absolute-epoch scheduling — verified by 5-call drift test at 1_000_000 + {240k, 480k, 720k, 960k, 1_020k}
  - SEG-03   # Pause/resume snapshot — verified by snapshot capture + resume re-registration tests

# Metrics
duration: 6m 41s
completed: 2026-05-09
---

# Phase 7 Plan 04: SegmentEngine Orchestrator Summary

**The SegmentEngine class — orchestrator that mirrors AlarmEngine's shape exactly with three Phase 7 deltas: absolute-epoch scheduling loop replacing three discrete phase fires, alarm-segment fire entering 'firing-alarm' state and reusing the v1 Phase 3 ramp+swell stack byte-identically, and per-key auto-stop window for the last gentle/triangle strike. cleanup() ordering verbatim from AlarmEngine.cleanup():354-407. Paired with a 23-test regression net spanning the full D-23 coverage matrix.**

## Performance

- **Duration:** 6m 41s
- **Started:** 2026-05-09T20:21:53Z
- **Completed:** 2026-05-09T20:28:34Z
- **Tasks:** 2 / 2
- **Files modified:** 2 (both newly created)
- **Lines:** SegmentEngine.ts = 412 lines; SegmentEngine.test.ts = 425 lines

## Accomplishments

- Created `src/engine/SegmentEngine.ts` (412 lines) — `SegmentEngine` class with all 10 public methods plus the private `handleSegmentFire` and `cleanup`. Mirrors `AlarmEngine` shape per D-07 with the three documented Phase 7 deltas concentrated in `start()`, `handleSegmentFire()`, and the `DECAY_WINDOW_MS` constant.
- Created `src/engine/__tests__/SegmentEngine.test.ts` (425 lines, 23 tests) — covers full D-23 coverage matrix across 7 describe blocks: state machine (3), validation gate (2), absolute scheduling (2), segment fires + ordering (3), alarm segment (5), auto-stop and continue-past-end (3), pause/resume (3), cleanup (2). Test 23 = `pause then resume re-emits 'start'` exceeds the planned ≥20 floor.
- v1 zero-diff floor (SEG-05) preserved at task end — `git diff --name-only main..HEAD` against the v1 file list returns 0 modifications.
- Full test suite green (excluding pre-existing `.claude/worktrees/agent-a1b94266/` duplicates which are out of scope): all in-tree test files pass; new SegmentEngine test file = 23/23 passing.
- TypeScript compiles clean (`npx tsc --noEmit` exits 0).

## Class Field Shape Table

Mirroring AlarmEngine with 4 documented Phase-7 deltas:

| AlarmEngine field | SegmentEngine field | Delta |
|-------------------|----------------------|-------|
| `phase: AlarmPhase = 'idle'` | `state: SegmentEngineState = 'idle'` | **DELTA 1: state enum** — 'idle' \| 'running' \| 'firing-alarm' \| 'dismissed' instead of AlarmPhase ('idle' \| 'phase1' \| 'phase2' \| 'phase3' \| 'dismissed') |
| `phase3RampGain` | `alarmRampGain` | **DELTA 2: alarm\* rename** — semantic change: alarm-segment is one-of-many segments, not a numbered phase |
| `phase3SwellNodes` | `alarmSwellNodes` | (rename) |
| `phase3LoopTimer` | `alarmLoopTimer` | (rename) |
| (n/a — phase progression is implicit in `phase`) | `currentIdx: number = -1` + `epochBaseline: number = 0` | **DELTA 3: segment-fire bookkeeping** — replaces three `phaseNFireAt` fields with a single epochBaseline + cumulative computation |
| `pauseSnapshot: { phase1Remaining, phase2Remaining, phase3Remaining }` | `pauseSnapshot: SegmentPauseSnapshot \| null` (3-field shape with futures array) | (snapshot shape variable per segment count) |
| (n/a) | `autoStopTimer: ReturnType<typeof setTimeout> \| null` | **DELTA 4: D-04 auto-stop handle** — only set when last segment is gentle/triangle (alarm-tail compositions never set it per D-02) |
| `phase2-only fields (tickGain, tickLoopTimer)` | (DROPPED) | SegmentEngine has no Phase 2 vibration/tick equivalent |
| `phaseCallback: PhaseChangeCallback \| null` | `segmentChangeCb: ((e: SegmentChangeEvent) => void) \| null` | (signature differs — segment events have kind: 'start' \| 'end' + segmentIndex + totalSegments + segment) |

## Public API (10 methods)

| Method | Signature | Purpose |
|--------|-----------|---------|
| `start` | `async (config: SegmentConfig) => Promise<void>` | Validates config, awaits startAlarmSession, registers N scheduleAt calls at absolute epochs, emits initial 'start' event |
| `pause` | `() => void` | Silent no-op when !canPause() (D-03); captures SegmentPauseSnapshot, cancels timers |
| `resume` | `() => void` | Re-baselines epoch, re-registers scheduleAt for current + future segments, re-emits 'start' for repaint |
| `stop` | `() => void` | cleanup() + state='dismissed' |
| `dismiss` | `() => void` | cleanup() + state='dismissed' |
| `getState` | `() => SegmentEngineState` | Returns current state ('idle' \| 'running' \| 'firing-alarm' \| 'dismissed') |
| `getCurrentSegment` | `() => { index, total, segment } \| null` | null when 'idle' or 'dismissed' (D-10), otherwise current snapshot |
| `isPaused` | `() => boolean` | Returns _paused flag |
| `canPause` | `() => boolean` | false during 'firing-alarm' (D-03), false when not running, false when already paused |
| `onSegmentChange` | `(cb) => void` | Last-wins callback registration (D-09) |

Plus private: `handleSegmentFire(firingIdx)`, `cleanup()`, `fireChange(e)`.

## Cleanup Ordering Verification (T-07-03 / T-07-03b)

Verbatim 6-step ordering from AlarmEngine.cleanup():354-407 with phase3* → alarm* rename and Phase 2 vibration/tick blocks dropped:

| Step | Line | Action |
|------|------|--------|
| 1 | 363-368 | Clear running/paused/state flags FIRST (prevents reentrancy mid-teardown) |
| 2 | 372-374 | `this.timers.forEach(t => t.cancel())` then `this.timers = []` |
| 2b | 377-380 | clearTimeout(autoStopTimer) if set |
| 3 | 384-387 | `endAlarmSession(this.session)` if session set, then null it |
| 4 | 390-393 | clearInterval(alarmLoopTimer) BEFORE stopping swell oscillators (Pitfall #2) |
| 5 | 397-403 | alarmSwellNodes.forEach(n.stop()) wrapped in try/catch (CLAUDE.md mandate) |
| 6 | 407-410 | `fadeOutGain(this.alarmRampGain, this.ac)` LAST (Pitfall #4 — no audible click) |

**Line-order acceptance check:**
```
$ awk '/this.timers = \[\];/{t=NR} /endAlarmSession/{e=NR} /alarmLoopTimer/{l=NR} END{print t,e,l}' src/engine/SegmentEngine.ts
374 385 393
```
374 < 385 < 393 — strict ordering preserved.

## Per-Key Decay Window Constants Confirmed (D-04)

```typescript
private static readonly DECAY_WINDOW_MS: Record<'gentle' | 'triangle', number> = {
  gentle: 6100,    // singingBowl longest partial decay ~6.0 s + safety margin
  triangle: 2100,  // triangle decay 2.0 s + safety margin (matches osc.stop(t + 2.1))
};
```

- gentle = 6100 ms: matches `singingBowl.ts` longest partial exponential decay (~6.0 s) + 100 ms safety margin
- triangle = 2100 ms: matches `triangle.ts` `osc.stop(t + 2.1)` exactly — no buffer needed because the oscillator is gone by then

These windows fire `cleanup() + state='dismissed'` after the last gentle/triangle strike (verified by 6100 ms and 2100 ms tests in the auto-stop describe block).

## Mid-phase SEG-05 Zero-Diff Result

```
$ git diff --name-only main..HEAD -- src/engine/AlarmEngine.ts src/engine/AlarmState.ts src/engine/AlarmSession.ts src/engine/AudioContext.ts src/engine/timer.ts src/hooks/useAlarm.ts src/components/Countdown.tsx src/components/ProgressRing.tsx src/engine/sounds/singingBowl.ts src/engine/sounds/phase3Tone.ts src/engine/sounds/keepalive.ts src/engine/sounds/testSound.ts src/engine/sounds/tickPulse.ts src/platform/wakeLock.ts src/platform/vibration.ts src/platform/notifications.ts | wc -l
0
```

Zero modifications to v1 files. SEG-05 floor preserved.

## Test Inventory (23 / 23 passing across 7 describe blocks)

### State machine (3 tests)
1. `starts in 'idle' state` — verifies initial state, isPaused()=false, canPause()=false
2. `start(WAKE_EASY_CONFIG) transitions to 'running'` — verifies state machine entry
3. `getCurrentSegment returns null when idle and a snapshot when running` — verifies index=0, total=5, segment.id='wake-easy-1'

### Validation gate (2 tests, SEG-04)
4. `throws Error with validator message on invalid config` — negative duration → /duration/i
5. `throws when already running` — second start() rejects with /already running/i

### Absolute scheduling (2 tests, SEG-02 + D-16)
6. `registers exactly N scheduleAt calls for an N-segment config` — 5 calls for WAKE_EASY
7. `schedules every fire at epochBaseline + cumulative duration (NOT chained delays)` — Date.now() spied to 1_000_000; asserts each fire epoch matches absolute + cumulative

### Segment fires + onSegmentChange ordering (3 tests)
8. `emits 'end' then 'start' around a gentle fire and dispatches via fireSegmentEndSound` — full event sequence
9. `after segment 0 fires, getCurrentSegment().index === 1` — Pitfall #6 verification
10. `dispatches 'triangle' key for triangle segments` — custom config to exercise triangle path (WAKE_EASY has none)

### Alarm segment (5 tests, D-01..D-03)
11. `transitions state to 'firing-alarm' on alarm-segment fire`
12. `calls createPhase3Ramp(ac, durationMs/1000) and startPhase3Swell on alarm fire` — asserts arity (60_000 ms / 1000 = 60 s)
13. `sets up 3200 ms swell loop interval (verify by advancing one cycle)` — advanceTimersByTime(3300) → second startPhase3Swell call
14. `canPause() returns false while in 'firing-alarm'` — D-03 verification
15. `pause() during 'firing-alarm' is silent no-op (state unchanged, _paused stays false)` — D-03 verification

### Auto-stop and continue-past-end (3 tests, D-04 + D-02)
16. `last-gentle-tail composition auto-stops after the gentle decay window (6100 ms)`
17. `last-triangle-tail composition auto-stops after the triangle decay window (2100 ms)`
18. `alarm-tail composition stays in firing-alarm past segment-end until manual dismiss`

### Pause/resume snapshot (3 tests, D-19, D-20)
19. `pause mid-segment captures snapshot with correct shape` — Date.now() spied through fire + pause
20. `resume re-registers scheduleAt for current + future segments` — asserts 4 new scheduleAt calls (current segment 1 + futures 2, 3, 4)
21. `pause then resume re-emits 'start' for the current segment (UI repaint)` — verifies last-emitted event = {kind: 'start', segmentIndex: 1}

### Cleanup (2 tests)
22. `dismiss() calls endAlarmSession exactly once and clears all timers`
23. `dismiss() then stop() does not double-call endAlarmSession (idempotent)`

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement SegmentEngine orchestrator class** — `6902957` (feat)
2. **Task 2: Add SegmentEngine regression net (23 tests, D-23 coverage matrix)** — `6332651` (test)

## Decisions Made

- **Verbatim transcription:** plan-prescribed action block was fully specified; no design-space exploration needed.
- **Two minor textual tweaks** to satisfy acceptance grep regexes:
  1. Removed single quotes around `'firing-alarm'` in pause()'s JSDoc text (line 256) so the LAST quoted match falls on line 212 (the actual code-level state transition) BEFORE createPhase3Ramp at line 213. The awk acceptance check `f<c` then passes. Pure documentation tweak with zero behavioral effect.
  2. Used explicit object-property colon form (`currentSegmentRemainingMs: currentSegmentRemainingMs`) instead of shorthand (`currentSegmentRemainingMs,`) so the `grep -c "currentSegmentRemainingMs:"` acceptance check returns 1.

## Deviations from Plan

None — plan executed exactly as written. The two textual tweaks above are documentation-only and don't affect behavior. No CLAUDE.md-driven adjustments. No auto-fixes (Rules 1-2). No architectural changes (Rule 4).

## Acceptance Verification Summary

| Plan criterion | Result |
|----------------|--------|
| Task 1: File exists | PASS |
| Task 1: `^export class SegmentEngine` count = 1 | PASS |
| Task 1: All 5 required imports present (SegmentState, timer, phase3Tone, segmentSound, AlarmSession) | PASS |
| Task 1: NOT importing strikeBowl/strikeTriangle directly | PASS (0 / 0) |
| Task 1: Validator gate present (validateSegmentConfig + throw new Error(result.error)) | PASS (1 / 1) |
| Task 1: Reentrancy guard present | PASS |
| Task 1: AlarmSession lifecycle (await startAlarmSession + endAlarmSession) | PASS |
| Task 1: Absolute-epoch scheduling (scheduleAt(fireAt, ...) + epochBaseline + cumulative + 0 chained setTimeouts) | PASS (1 / 2 / 0) |
| Task 1: state='firing-alarm' BEFORE createPhase3Ramp | PASS (line 212 < line 213) |
| Task 1: Phase 3 reuse (createPhase3Ramp, startPhase3Swell ≥ 2 occurrences, 3200) | PASS (1 / 2 / 1) |
| Task 1: canPause excludes firing-alarm | PASS |
| Task 1: pause silent no-op | PASS |
| Task 1: SegmentPauseSnapshot 3 fields all colon-form | PASS (1 / 1 / 1) |
| Task 1: try/catch around n.stop() | PASS |
| Task 1: cleanup ends with fadeOutGain | PASS |
| Task 1: cleanup ordering (timers=[] < endAlarmSession < alarmLoopTimer) | PASS (374 < 385 < 393) |
| Task 1: Per-key decay (6100 + 2100) | PASS |
| Task 1: Pitfall #6 increment ordering | PASS |
| Task 1: Auto-stop only for last gentle/triangle | PASS (isLast=2, DECAY_WINDOW_MS=2) |
| Task 1: All 10 public methods | PASS (10) |
| Task 1: TS compiles clean | PASS |
| Task 1: SEG-05 zero-diff (mid-task) | PASS (0 modified) |
| Task 2: File exists | PASS |
| Task 2: 23 / 23 tests pass | PASS |
| Task 2: Microtask flush in helper | PASS |
| Task 2: Timer mocked for direct epoch assertions | PASS |
| Task 2: Drift test at 1_000_000 + 240_000 + 1_020_000 | PASS |
| Task 2: Pitfall #6 boundary off-by-one | PASS |
| Task 2: 7+ 'firing-alarm' references | PASS (7) |
| Task 2: canPause()=false test | PASS (2 occurrences) |
| Task 2: pause silent no-op | PASS |
| Task 2: 6100 + 2100 + alarm-tail tests | PASS (2 / 2 / 1) |
| Task 2: 2× rejects.toThrow | PASS (2) |
| Task 2: 7× toHaveBeenCalledTimes(1) | PASS (7) |
| Task 2: ≥20 it() blocks | PASS (23) |
| Task 2: TS compiles clean | PASS |
| Task 2: SEG-05 zero-diff (post-task) | PASS (0 modified) |
| Overall: All 10 public methods regex | PASS (10) |
| Overall: cleanup ordering | PASS |
| Overall: Auto-stop divergence (alarm forever vs gentle/triangle decay) | PASS (3 dedicated tests) |
| Overall: Absolute scheduling 5-call epoch assertion | PASS |

**Net: All acceptance criteria PASS verbatim. Zero deviations.**

## Downstream Pointer (per plan output spec)

**For 07-05 (barrel + harness):**

```typescript
// src/engine/index.ts (barrel re-export):
import { SegmentEngine } from './SegmentEngine';
export { SegmentEngine };

// SegmentHarness component:
const engine = useRef<SegmentEngine>(new SegmentEngine());

useEffect(() => {
  engine.current.onSegmentChange((event) => {
    setEventLog((log) => [...log, event]);
  });
}, []);

// User gesture:
const onStart = async () => {
  await engine.current.start(WAKE_EASY_CONFIG);
};
```

The harness must call `engine.current.dismiss()` on unmount to release the AlarmSession (keepalive + Wake Lock + visibility cleanup all flow through the cleanup() teardown).

**Open follow-up flagged for 07-05:** confirm timer-mock pattern survives in harness — SegmentEngine in the dev harness uses the REAL `scheduleAt` (not the test-mocked one), so segment-end callbacks fire on the actual wall clock through scheduleAt's polling loop. Tests synthesized fires by invoking captured callbacks directly; harness exercises the full timer.ts → scheduleAt → callback chain. Verify the dev event log shows segment-change events at the expected wall-clock intervals (4 × 4 min = 16 min into the run, then alarm at 17 min for WAKE_EASY).

## Self-Check: PASSED

- File `src/engine/SegmentEngine.ts`: FOUND
- File `src/engine/__tests__/SegmentEngine.test.ts`: FOUND
- Commit `6902957` (Task 1): FOUND in git log
- Commit `6332651` (Task 2): FOUND in git log
