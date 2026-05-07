---
phase: 06-alarmsession-refactor-v1-regression-guard
plan: 01
subsystem: audio-lifecycle
tags:
  - refactor
  - audio
  - lifecycle
  - web-audio
  - typescript
  - vitest
  - weakmap

# Dependency graph
requires:
  - phase: 01-audio-engine-and-timer
    provides: AudioContext singleton (getAudioContext), keepalive function-pair (startKeepalive/stopKeepalive), AlarmEngine instance fields the new module mirrors
  - phase: 02-background-reliability
    provides: wakeLock module (acquireWakeLock/releaseWakeLock/attachVisibilityReacquire) including the internal NotAllowedError swallow that AlarmSession deliberately does not double-wrap
  - phase: 05-ios-audio-loudness-fixes
    provides: navigator.audioSession.type='playback' is set inside getAudioContext, so AlarmSession inherits the iOS silent-switch fix transparently
provides:
  - src/engine/AlarmSession.ts module exporting startAlarmSession() / endAlarmSession(handle) function pair
  - SessionHandle public type (opaque — only readonly ac:AudioContext is visible)
  - Module-private WeakMap<SessionHandle, SessionInternals> recovering teardown state by handle identity
  - 7 standalone unit tests covering call order, double-end no-op, and v1 byte-identical failure profile
  - Two new appended exports on the engine barrel (D-08); zero existing exports modified
affects:
  - 06-02-PLAN — Plan 2 will rewire AlarmEngine.start()/cleanup() to call into this module
  - 06-03-PLAN — Plan 3 references this module's behavior in the on-device regression checklist
  - Phase 7 SegmentEngine — the function pair is the single source of session-lifecycle code SegmentEngine will share with AlarmEngine

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Function-pair module with reference-identity WeakMap state (start returns opaque handle; end accepts it; internals recovered by WeakMap.get(handle))"
    - "mock.invocationCallOrder cross-mock ordering assertion idiom in Vitest (introduced in AlarmSession.test.ts; first use in this codebase)"
    - "Defensive failure-profile contract test (forced-rejection mock proves the module under test does NOT add a transforming wrapper around its dependency)"

key-files:
  created:
    - src/engine/AlarmSession.ts
    - src/engine/__tests__/AlarmSession.test.ts
  modified:
    - src/engine/index.ts

key-decisions:
  - "Internal-state mechanism: WeakMap<SessionHandle, SessionInternals> chosen over Symbol-keyed property (Claude's Discretion per D-02). Reasoning: reference-identity keying is the single mechanism that simultaneously prevents forged-handle teardown (T-06-06), keeps internals truly private (no introspectable Symbol property), is GC-friendly (handle eligible for collection cleans up the map entry), and reads as straight TS without any non-enumerable property gymnastics."
  - "SessionInternals interface intentionally NOT exported (T-06-02 mitigation). Future modules that want to share their own session-internals should define their own private types; the AlarmSession internals shape is not part of the public contract."
  - "Test 7 (wake-lock failure swallow) reframed during execution: see Deviations from Plan below."

patterns-established:
  - "Function-pair lifecycle modules with handle-keyed private state — WeakMap variant. Future: SegmentEngine in Phase 7 may reuse this same shape if it needs its own per-instance teardown registry."
  - "Defensive contract test for module thinness: when the module-under-test is meant to be a thin orchestrator (no error transformation, no swallow), force-reject the dep mock and assert the rejection passes through with identity-equal error (`.rejects.toBe(err)`). This is stronger than `.rejects.toThrow(message)` because it also catches accidental rewrapping."

requirements-completed:
  - SEG-05

# Metrics
duration: 5m 37s
completed: 2026-05-07
---

# Phase 6 Plan 1: AlarmSession Refactor + v1 Regression Guard Summary

**New `src/engine/AlarmSession.ts` function-pair module owns the four lifecycle responsibilities (AudioContext bring-up, silent keepalive, Wake Lock, visibility re-acquire) with private WeakMap-backed teardown state and zero diff to any v1 path — AlarmEngine wiring is intentionally untouched (Plan 2's job).**

## Performance

- **Duration:** 5m 37s
- **Started:** 2026-05-07T20:03:09Z
- **Completed:** 2026-05-07T20:08:46Z
- **Tasks:** 3
- **Files created:** 2
- **Files modified:** 1
- **Tests added:** 7 (full project suite went from 245 → 252 passing)

## Accomplishments

- New pure-function lifecycle module exposes `startAlarmSession() / endAlarmSession(handle)` and the opaque `SessionHandle` type (D-01, D-02). Lock order on start is `getAudioContext → startKeepalive → acquireWakeLock → attachVisibilityReacquire`, byte-identical to `AlarmEngine.start()` lines 104-111 today (D-05/D-06).
- Internal teardown state lives in a module-private `WeakMap<SessionHandle, SessionInternals>`. `SessionInternals` is not exported — callers cannot construct a synthetic handle that maps to teardown callbacks they shouldn't be able to invoke selectively (T-06-01, T-06-02, T-06-06 mitigations).
- `endAlarmSession` is synchronous void with idempotent double-end via WeakMap.get falsy guard (D-04 + T-06-03). Forged-handle teardown silently fails because WeakMap keying is reference-identity, not structural.
- Failure profile preserved byte-for-byte: `getAudioContext` rejection propagates; `acquireWakeLock` rejection propagates *unchanged* (the real `wakeLock.ts` already swallows internally — AlarmSession adds no redundant try/catch that would either shadow a real bug or double-log via console.debug).
- 7 unit tests using Vitest cover all behaviors. Order assertion via `mock.invocationCallOrder` is a new idiom in this codebase, introduced cleanly without a helper.
- Engine barrel append-only: two new lines (`startAlarmSession`/`endAlarmSession` value export + `SessionHandle` type export). All existing v1 exports preserved per D-08.
- SEG-05 zero-diff floor verified across all 11 protected paths (`AlarmState.ts`, `useAlarm.ts`, `Countdown.tsx`, `ProgressRing.tsx`, every existing `sounds/*.ts`, `wakeLock.ts`, `vibration.ts`, `notifications.ts`, `AudioContext.ts`, `AlarmEngine.ts`, `AlarmEngine.test.ts`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AlarmSession.ts (function pair + SessionHandle + WeakMap internals)** — `4bd85d3` (feat)
2. **Task 2: Create AlarmSession.test.ts (unit tests for call order, double-end, failure profile)** — `1bd21ac` (test)
3. **Task 3: Append AlarmSession exports to src/engine/index.ts (barrel)** — `00b6830` (feat)

_Note: Task 1 and Task 2 were both `tdd="true"` in the plan, but the plan structure split source and test into separate commits (rather than a strict RED→GREEN cycle within a single task). I followed the plan structure literally: source first, then tests. The Task 2 test run is what the plan's verify gate exercises and what would have failed had the implementation diverged from spec — functionally equivalent to a RED→GREEN gate, just split across two commits._

## Files Created/Modified

- `src/engine/AlarmSession.ts` (CREATED, 104 lines) — Pure-function lifecycle module. Imports `getAudioContext` from `./AudioContext`, `startKeepalive`/`stopKeepalive` from `./sounds/keepalive`, and `acquireWakeLock`/`releaseWakeLock`/`attachVisibilityReacquire` from `../platform/wakeLock`. Exports `SessionHandle` (interface, `{ readonly ac: AudioContext }`), `startAlarmSession` (async function), and `endAlarmSession` (sync void function). Module-private `internals: WeakMap<SessionHandle, SessionInternals>` recovers teardown state by handle identity.
- `src/engine/__tests__/AlarmSession.test.ts` (CREATED, 164 lines) — Vitest unit suite. Mocks the three dependency modules (`../AudioContext`, `../sounds/keepalive`, `../../platform/wakeLock`) using the same shape as `AlarmEngine.test.ts` lines 6-65, but limited to AlarmSession's actual deps (no singingBowl, phase3Tone, tickPulse, or vibration mocks). 7 `it(...)` blocks cover handle shape, call counts, call order via `mock.invocationCallOrder`, double-end no-op, and the AC-rejection-propagates / wake-lock-rejection-passes-through failure profile.
- `src/engine/index.ts` (MODIFIED, +2 lines, -0 lines) — Append-only diff. Two new lines after the existing `acquireWakeLock`/`releaseWakeLock`/`attachVisibilityReacquire` re-export (line 28): one value export for `startAlarmSession`/`endAlarmSession`, one type-only export for `SessionHandle`. No existing line modified, reordered, or removed.

## Decisions Made

- **Internal-state mechanism — WeakMap chosen over Symbol-keyed property.** D-02 listed both as Claude's Discretion. WeakMap won on four counts: (1) reference-identity keying naturally rejects forged-handle teardown without extra checks; (2) GC-friendly — handle eligible for collection cleans up the map entry automatically; (3) reads as straight TS strict mode without any non-enumerable property gymnastics; (4) symmetric with the function-pair pattern from `keepalive.ts` while keeping internals genuinely private (keepalive returns the OscillatorNode directly; AlarmSession deliberately does not).
- **SessionInternals NOT exported.** T-06-02 mitigation. The internal type's name and shape are implementation details; future variants of session-lifecycle modules should define their own private internals types.
- **No try/catch around `acquireWakeLock` even for "safety".** D-05 was explicit on this. The defensive contract test (Test 7) was reframed during execution to assert the contrapositive — see Deviations from Plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test/Spec Inconsistency] Reframed Test 7 wake-lock-failure assertion**

- **Found during:** Task 2 (AlarmSession.test.ts unit suite — first vitest run after writing the file)
- **Issue:** The plan's literal Test 7 specification asserts:
  > "Wake-lock acquisition failure (acquireWakeLock rejects) is swallowed: `startAlarmSession()` still resolves and the subsequent attachVisibilityReacquire still gets called."

  This contradicts D-05, locked in CONTEXT.md, which states:
  > "AlarmSession adds no redundant try/catch [around acquireWakeLock] (no double-log, no shadowed bug)"

  And Task 1's own acceptance criterion:
  > "File does NOT contain a try/catch wrapping `acquireWakeLock` (grep `try\s*{[^}]*acquireWakeLock` returns zero matches)."

  When the mocked `acquireWakeLock` rejects AND the source code has no try/catch (per D-05), `await acquireWakeLock()` propagates the rejection out of `startAlarmSession`. The test as literally written fails — confirmed empirically: with the spec-compliant implementation, 6/7 passed and Test 7 failed with the exact `NotAllowedError` the mock injected.

  This is a genuine spec inconsistency. The Patterns doc itself acknowledged the awkwardness ("the real wakeLock.ts already swallows internally, so to truly exercise the 'swallow profile' guarantee... the mock must be set to reject — which simulates a hypothetical future leak. This is a defensive test of the contract, per D-05.") but did not resolve the contradiction.
- **Fix:** Reframed Test 7 to assert the contrapositive of equal observational power. The test now forces the dep to reject and asserts that `startAlarmSession` *also* rejects with the *same identity-equal error* (`.rejects.toBe(err)`, not `.rejects.toThrow(message)`). This proves no transforming or swallowing wrapper exists in AlarmSession — exactly the defensive intent the plan described, just expressed in a way that's logically consistent with D-05's no-try-catch mandate.

  The "real-world resolve path" coverage the plan also wanted (visibility still attaches when the dep behaves per its production contract) is fully provided by Tests 1-5, which all rely on the default `mockResolvedValue(undefined)` and assert `attachVisibilityReacquire` is called downstream of `acquireWakeLock`.

  Test docblock and inline comments document why this framing was chosen so future readers can trace the decision back to D-05.
- **Files modified:** `src/engine/__tests__/AlarmSession.test.ts` (Test 7 body and accompanying docblock)
- **Verification:** All 7 tests pass; full project suite (252 tests across 23 files) passes; `npx tsc --noEmit` exits 0; SEG-05 zero-diff guard returns no output.
- **Committed in:** `1bd21ac` (Task 2 commit; the deviation note is captured in the commit message body for git-log traceability)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 — test/spec inconsistency)
**Impact on plan:** No scope creep, no SEG-05 violation, no behavior change. The implementation matches D-05 verbatim; the test was the side that needed the consistency fix. The defensive contract intent the plan specified is preserved with strictly stronger guarantees (`.rejects.toBe` is identity-equal, not just message-equal).

## Issues Encountered

- **Pre-existing stale worktree at `.claude/worktrees/agent-a1b94266/`** — Vitest is picking up duplicate test files from this directory (visible in the full-suite output as e.g. `.claude/worktrees/agent-a1b94266/src/engine/__tests__/AlarmEngine.test.ts`). Out of scope for Plan 06-01 (the worktree predates this plan and is unrelated to the AlarmSession refactor). Logged here for visibility — a future cleanup pass could either delete the stale worktree directory or add a `vitest.config` exclude rule. Does NOT affect this plan's correctness — both copies of the tests pass, and SEG-05 guard is anchored to `src/...` paths only.

## User Setup Required

None — no external service configuration required. Pure code/test changes.

## Next Phase Readiness

- **Plan 06-02 (AlarmEngine rewire) is unblocked.** AlarmSession is standalone-tested green. The integration points called out in `06-PATTERNS.md` (lines 256-273 and 316-327) — `start()` lines 104-111 replacement and `cleanup()` lines 360-394 replacement — can be applied directly. The function-pair contract Plan 2 will consume is exactly what's exported from `src/engine/AlarmSession.ts`.
- **Plan 06-03 (regression checklist) is also unblocked** — purely doc work, no code dependency.
- **No blockers introduced.** Zero v1 paths modified. The `_running` reentrancy guard remains exactly where it lived in v1 (D-03), so Plan 2's rewire does not need to relocate it.

## TDD Gate Compliance

Tasks 1 and 2 had `tdd="true"` in the plan. The plan structure split source (Task 1) and tests (Task 2) into two separate commits rather than a strict per-task RED→GREEN cycle. Verifying the canonical RED/GREEN sequence in git log:

- `4bd85d3` (feat) — source module created
- `1bd21ac` (test) — tests added; first run revealed the spec-implementation mismatch on Test 7 (true RED signal that something was inconsistent); resolved by fixing the test (Rule 1 deviation), then all 7 passed (GREEN)

The conventional commit prefixes are `feat` then `test` rather than the orthodox `test` then `feat`. This matches the plan's literal task ordering (which has the source artifact first). No REFACTOR commit was needed — the source module was minimal and required no cleanup pass after green.

## Self-Check: PASSED

Verified all SUMMARY claims against ground truth:
- File `src/engine/AlarmSession.ts` exists (FOUND)
- File `src/engine/__tests__/AlarmSession.test.ts` exists (FOUND)
- File `src/engine/index.ts` exists with two new appended lines (FOUND)
- Commit `4bd85d3` exists in git log (FOUND)
- Commit `1bd21ac` exists in git log (FOUND)
- Commit `00b6830` exists in git log (FOUND)

---
*Phase: 06-alarmsession-refactor-v1-regression-guard*
*Completed: 2026-05-07*
