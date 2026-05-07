---
phase: 06-alarmsession-refactor-v1-regression-guard
plan: 02
subsystem: audio-lifecycle
tags:
  - refactor
  - audio
  - lifecycle
  - web-audio
  - regression
  - typescript
  - vitest

# Dependency graph
requires:
  - phase: 06-alarmsession-refactor-v1-regression-guard
    plan: 01
    provides: src/engine/AlarmSession.ts (startAlarmSession/endAlarmSession function pair, opaque SessionHandle, WeakMap-backed internals) + barrel exports of the same
  - phase: 01-audio-engine-and-timer
    provides: AlarmEngine class state machine (this plan rewires its start()/cleanup() only; phase scheduling, pause/resume snapshot, _running guard untouched)
  - phase: 02-background-reliability
    provides: wakeLock module (now consumed transitively through AlarmSession instead of directly by AlarmEngine)
provides:
  - AlarmEngine.start() that delegates the four lifecycle responsibilities to startAlarmSession() (D-06 ownership boundary)
  - AlarmEngine.cleanup() that tears down the session via a single endAlarmSession(this.session) call placed where the v1 keepalive teardown block lived (D-04 byte-identical timing)
  - 11 new regression assertions appended to AlarmEngine.test.ts proving QUICK_NAP_CONFIG + FOCUS_CONFIG + pause/resume from each entry phase still behave byte-identically to v1
affects:
  - 06-03-PLAN — the on-device regression checklist now references the integrated wiring as the v1-equivalent baseline
  - Phase 7 SegmentEngine — AlarmEngine is now the reference pattern for how a state-machine class consumes the AlarmSession function pair; SegmentEngine should mirror this consumption shape

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Class-as-AlarmSession-consumer: state-machine class holds a private SessionHandle | null field, assigns it from await startAlarmSession() in the public lifecycle method, and tears it down via a guarded endAlarmSession(this.x); this.x = null block in cleanup() — placed in the position of the OLD v1 teardown block to preserve byte-identical timing under SEG-05"
    - "Append-only test extension idiom for refactor regression nets: existing tests stay verbatim as the regression net (D-07 primary); new tests append after the last existing it() block; git diff shows +N insertions / -0 deletions, proving no existing assertion was touched"
    - "Per-test mock-shape correction: when a top-level vi.mock returns an incorrect shape that latent existing tests skirt but a new test exposes, override the mock per-test (mockReturnValue inside the it block) instead of editing the top-level mock — keeps all other tests' behavior identical and confines the fix to the test that needs it"

key-files:
  created:
    - .planning/phases/06-alarmsession-refactor-v1-regression-guard/06-02-SUMMARY.md
  modified:
    - src/engine/AlarmEngine.ts (+14 / -24)
    - src/engine/__tests__/AlarmEngine.test.ts (+212 / -0)

key-decisions:
  - "Position of the single endAlarmSession(this.session) call in cleanup(): placed between this.timers = [] and stopVibration() — the exact slot the OLD keepalive teardown block occupied. Honors D-04 (byte-identical teardown TIMING). The release-wake-lock + visibility-cleanup blocks that originally sat AFTER the tick-loop teardown are now folded into endAlarmSession and execute in the earlier (keepalive-position) slot. Verified safe because AlarmSession's reverse-of-start order (stopKeepalive -> releaseWakeLock -> releaseVisibility) executes synchronously in fire-and-forget style, matching the v1 invocation order from a side-effect-observation perspective even though the relative position to stopVibration() now differs by one block. The plan explicitly authorized this collapse (D-04 + D-06)."
  - "Removed keepaliveOsc and visibilityCleanup private fields entirely (D-08 trailing note authorized). No dead-code carriage. The new private session: SessionHandle | null = null field replaces both."
  - "Removed getAudioContext import too (no longer referenced after start() rewire — only mention left is in a JSDoc comment, which doesn't trigger an import). Cleaner than leaving an unused import."
  - "Per-test mock-shape fix for startPhase3Swell in the new pause/resume-during-phase3 test (Rule 1 deviation — see below) instead of editing the top-level vi.mock block, to avoid changing behavior for any of the 29 existing tests."

patterns-established:
  - "Class-as-AlarmSession-consumer pattern (see start() lines 104-105 and cleanup() lines 364-371 in AlarmEngine.ts) — Phase 7 SegmentEngine should follow this shape verbatim if it shares session lifecycle"
  - "Append-only test extension for refactor regression: new tests inside the existing top-level describe block, AFTER all existing tests, with a header comment block delimiting the new section and citing the plan/decision IDs that authorized them"

requirements-completed:
  - SEG-05

# Metrics
duration: 4m 55s
completed: 2026-05-07
---

# Phase 6 Plan 2: AlarmEngine Rewire + v1 Regression Net Summary

**AlarmEngine.start() and cleanup() now delegate the four session-lifecycle responsibilities to AlarmSession (Plan 1 module) via a single startAlarmSession()/endAlarmSession(handle) pair, with v1 byte-identical observable behavior verified by 11 new regression assertions appended to AlarmEngine.test.ts and the existing 29-test suite preserved verbatim per D-07 primary.**

## Performance

- **Duration:** 4m 55s
- **Started:** 2026-05-07T20:13:19Z
- **Completed:** 2026-05-07T20:18:14Z
- **Tasks:** 2
- **Files modified:** 2 (AlarmEngine.ts, AlarmEngine.test.ts)
- **Files created:** 1 (this SUMMARY)
- **Tests added:** 11 (full project suite went from 252 -> 263 passing)

## Diff Stats (the bottom line for SEG-05)

| File | Insertions | Deletions | Net |
|------|-----------:|----------:|----:|
| `src/engine/AlarmEngine.ts` | +14 | -24 | -10 (refactor reduces line count) |
| `src/engine/__tests__/AlarmEngine.test.ts` | +212 | 0 | +212 (append-only) |

`AlarmEngine.ts` net -10 lines is the canonical "refactor reduces duplication" outcome — three teardown blocks collapsed into one, two private fields removed, two imports removed and one added. `AlarmEngine.test.ts` is strictly additive: zero existing assertions modified, the entire 29-test regression net preserved verbatim per D-07 primary.

## Tests Added (11 total, by group)

### Group A — AlarmSession wiring (4 tests)
Proven through the existing top-level vi.mock blocks for `../sounds/keepalive` and `../../platform/wakeLock` — no new mock setup required.

1. `start() drives keepalive, wake lock, and visibility re-acquire via AlarmSession`
2. `stop() drives stopKeepalive, releaseWakeLock, and the visibility cleanup via AlarmSession`
3. `dismiss() also drives the full session teardown via AlarmSession`
4. `cleanup() called twice (stop then stop) is idempotent — primitives still called only once`

### Group B — QUICK_NAP_CONFIG + FOCUS_CONFIG end-to-end byte-identity regression (4 tests)
The pre-existing phase-order test only used DEFAULT_CONFIG; these prove the same behavior for both presets that the v2.0 v1-zero-diff floor explicitly protects.

5. `QUICK_NAP_CONFIG fires phase1 -> phase2 -> phase3 in order with correct durations`
6. `FOCUS_CONFIG fires phase1 -> phase2 -> phase3 in order with correct durations`
7. `QUICK_NAP_CONFIG: strikeBowl is invoked exactly once at phase1`
8. `FOCUS_CONFIG: strikeBowl is invoked exactly once at phase1`

### Group C — Pause/resume snapshot from each entry phase (3 tests)
The existing pause/resume tests covered idle entry only; these cover the three remaining branches inside `resume()`.

9. `pause/resume from phase1 entry: phase2 still fires after the remaining gap`
10. `pause/resume from phase2 entry: phase3 still fires after the remaining gap`
11. `pause/resume during phase3 does not throw and engine remains in phase3`

## Confirmation: existing AlarmEngine tests still pass byte-for-byte

- Pre-Plan-2 baseline: 29 tests pass in `src/engine/__tests__/AlarmEngine.test.ts` (verified before any source edit)
- Post-Plan-2 (after Task 1 source rewire only, before Task 2 test extension): 29 tests still pass — ZERO regression
- Post-Plan-2 (after Task 2 test append): 40 tests pass (29 existing + 11 new)
- Full project suite: 263 tests across 23 test files, all passing

## Confirmation: SEG-05 protected file list is byte-identical

```text
$ git diff --name-only HEAD~2 -- src/engine/AlarmState.ts src/hooks/useAlarm.ts src/components/Countdown.tsx src/components/ProgressRing.tsx src/engine/sounds/ src/platform/wakeLock.ts src/platform/vibration.ts src/platform/notifications.ts src/engine/AudioContext.ts
(empty output)
```

All nine SEG-05-protected paths are byte-identical to pre-Plan-2 state across the two commits this plan landed (`b32fb88` + `80aff2d`).

## Combined Plan 1 + Plan 2 src/ diff (5 files, exactly as predicted by 06-02-PLAN verification step 4)

```text
src/engine/AlarmEngine.ts            (Plan 2 — rewire)
src/engine/AlarmSession.ts           (Plan 1 — new module)
src/engine/__tests__/AlarmEngine.test.ts   (Plan 2 — append regression net)
src/engine/__tests__/AlarmSession.test.ts  (Plan 1 — new unit suite)
src/engine/index.ts                  (Plan 1 — barrel append)
```

No other src/ path touched across both plans combined. Phase 6 SEG-05 floor held end to end.

## Sanity grep — v1 lifecycle primitives gone from AlarmEngine.ts

```text
$ grep -nE "startKeepalive|acquireWakeLock|attachVisibilityReacquire" src/engine/AlarmEngine.ts
(no matches)
```

Confirms the four explicit lifecycle calls have been replaced by the single `startAlarmSession()` / `endAlarmSession()` pair. The primitives still exist behind AlarmSession; AlarmEngine no longer reaches around AlarmSession to call them directly.

## Task Commits

1. **Task 1: Rewire AlarmEngine.ts start() and cleanup() to delegate to AlarmSession** — `b32fb88` (refactor)
2. **Task 2: Extend AlarmEngine.test.ts with AlarmSession-wiring + QUICK_NAP/FOCUS regression assertions** — `80aff2d` (test)

## Decisions Made

- **`endAlarmSession(this.session)` call placed in the OLD keepalive teardown slot** (between `this.timers = []` and `stopVibration()`). Honors D-04 byte-identical teardown TIMING. The original v1 ordering had keepalive teardown first, then vibration/tick teardown, then wake lock + visibility teardown. After the collapse, all three (keepalive + wake lock + visibility) execute synchronously in the keepalive-position slot, with vibration/tick teardown still after. From the perspective of any observer that mocks the underlying primitives (which is what the AlarmEngine test suite does), each primitive still fires exactly once per cleanup, so call-count assertions remain identical. The plan explicitly authorized this collapse (D-04 + D-06) and the test suite verifies it remains observationally equivalent.
- **Removed `getAudioContext` import too.** With the start() rewire, AlarmEngine no longer references getAudioContext (only mention left is in a JSDoc paragraph, which doesn't require an import). Cleaner than leaving an unused import that would trigger a future tsc warning. Verified by grep: only the JSDoc reference remains.
- **Per-test mock override for `startPhase3Swell` in the pause/resume-during-phase3 test** rather than editing the top-level `vi.mock('../sounds/phase3Tone', ...)` block. Reasoning: the top-level mock returns a single object, but the real source contract returns `OscillatorNode[]` (per AlarmEngine.ts:202 comment "returns an array of 6 oscillators"). The 29 existing tests skirted this latent shape mismatch because none of them advance into phase3 AND THEN iterate the swell nodes — they all `stop()` before `phase3SwellNodes` is populated. Editing the top-level mock to return an array is the "more correct" fix from a contract-fidelity standpoint, but it would change the behavior of `cleanup()` paths in every existing phase3-touching test, opening a regression surface this plan must not introduce. Per-test override confines the fix to exactly the test that needs it. See Deviations from Plan below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test mock-shape bug] Per-test override of `startPhase3Swell` mock for pause/resume-during-phase3**

- **Found during:** Task 2 (running the new "pause/resume during phase3 does not throw" test for the first time)
- **Issue:** Test failed with `TypeError: this.phase3SwellNodes?.forEach is not a function`. Root cause: the top-level vi.mock block at AlarmEngine.test.ts:27-40 returns a single object from `startPhase3Swell`, but the real source contract (and the type the engine assigns to `this.phase3SwellNodes: OscillatorNode[] | null`) is an array. The 29 existing tests never exposed this because they either don't advance into phase3 at all, or they `stop()` before `phase3SwellNodes` is populated. My new pause/resume-during-phase3 test is the first to drive `pause()` while phase3 is active, which is the first path that calls `this.phase3SwellNodes?.forEach(...)` against a populated mock value.

  This is a pre-existing latent test-infrastructure bug, not a Plan 2 regression. Confirmed by reverting Task 1's source change and re-running the new test — same TypeError, same line.
- **Fix:** Override `startPhase3Swell` per-test using `mockReturnValue(arrayOfSwellNodes)` inside the it() body. The override returns an array of 2 properly-shaped OscillatorNode-like objects (each with `stop`, `connect`, `start`, and `frequency` mocks), which is enough to satisfy `cleanup()`'s `forEach((n) => n.stop())` loop. Documented inline with a comment explaining why the override is needed and pointing back to AlarmEngine.ts:202 for the contract.

  Why per-test and not a top-level mock fix: editing the top-level mock to return an array would change behavior for every existing test, opening a regression surface this plan must not introduce (D-07 primary requires the existing tests stay verbatim as the regression net). Per-test override confines the change.
- **Files modified:** `src/engine/__tests__/AlarmEngine.test.ts` (the it() body of the pause/resume-during-phase3 test only)
- **Verification:** All 11 new tests pass; full project suite (263 tests) passes; tsc --noEmit exits 0; SEG-05 zero-diff guard returns empty.
- **Committed in:** `80aff2d` (Task 2 commit; the deviation rationale is captured in the commit message body)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 — test mock-shape bug, pre-existing, exposed by new test)

**Impact on plan:** Zero scope creep. Zero SEG-05 violation. Zero source-code change beyond what Task 1's plan-defined edits prescribed. The deviation is confined to a single new test body and matches the same per-test override pattern already used elsewhere in the file (e.g., line 256 `vi.stubGlobal`, line 364 `mockReturnValueOnce`).

## Issues Encountered

- **Pre-existing stale worktree at `.claude/worktrees/agent-a1b94266/`** (carried over from Plan 1's SUMMARY) — Vitest is still picking up duplicate test files from this directory (visible as e.g. `.claude/worktrees/agent-a1b94266/src/engine/__tests__/AlarmEngine.test.ts (29 tests)` alongside the live `src/engine/__tests__/AlarmEngine.test.ts (40 tests)`). The 29-test count from the worktree copy is the pre-Plan-2 snapshot of the file; the 40-test count from the live path includes Plan 2's new tests. Both passing. Out of scope for Plan 06-02 — same as Plan 06-01, this is unrelated to the current refactor and was already noted in 06-01-SUMMARY. Future cleanup pass should either delete the stale worktree directory or add a vitest exclude rule.

## User Setup Required

None — pure code/test changes. No new dependencies, no environment variables, no manual steps.

## Next Phase Readiness

- **Plan 06-03 (on-device regression checklist) is unblocked.** The integrated AlarmEngine + AlarmSession wiring is now in place; the manual checklist's job is to verify the same byte-identity guarantee on real hardware that the automated regression net just verified in mocks.
- **Phase 7 (SegmentEngine) is unblocked from a code-shape perspective.** SegmentEngine can now consume AlarmSession exactly the way AlarmEngine does — `private session: SessionHandle | null` field, `await startAlarmSession()` in its public lifecycle entry, guarded `endAlarmSession(this.session); this.session = null` in cleanup. The AlarmEngine refactor establishes the canonical class-as-consumer pattern.
- **No new blockers introduced.** SEG-05 zero-diff floor verified end-to-end across both plans. The `_running` guard remains the single reentrancy gate (D-03) — when SegmentEngine adds its own state machine, it will need its own equivalent guard.

## TDD Gate Compliance

Both Task 1 and Task 2 had `tdd="true"` in the plan, but the plan structure is a refactor (Task 1) plus an additive test extension (Task 2), not a fresh feature. Verifying the canonical RED/GREEN/REFACTOR semantics in this context:

- **Task 1 (refactor):** The pre-existing 29-test AlarmEngine.test.ts suite IS the RED guard — it must continue to pass after the rewire. Verified before any source edit (29/29 passing, "RED baseline established"), then verified again immediately after Task 1's edits (29/29 still passing, "GREEN — no regression"). Committed as `refactor(...)` per conventional-commits semantics for behavior-preserving change. No separate test commit needed because no new behavior was being introduced.
- **Task 2 (test extension):** Pure test addition for a now-shipped behavior (the AlarmSession wiring landed in Task 1). Wrote tests, ran them — 10/11 passed immediately (true GREEN for those 10), 1 revealed the pre-existing latent mock-shape bug (treated as Rule 1 deviation; fixed per-test, then 11/11 passed). Committed as `test(...)`.
- **No REFACTOR commit needed** — both edits were minimal and required no cleanup pass after green.

For a refactor plan with append-only tests, the strict RED-then-GREEN commit ordering doesn't map cleanly: the RED gate is "existing tests don't break" and is verified between the source edit and the source commit, not via a separate commit. This matches conventional-commits semantics (`refactor` = behavior-preserving) and avoids a no-op test commit.

## Self-Check: PASSED

Verified all SUMMARY claims against ground truth:

- File `.planning/phases/06-alarmsession-refactor-v1-regression-guard/06-02-SUMMARY.md` exists (FOUND — this file)
- Commit `b32fb88` exists in git log (FOUND)
- Commit `80aff2d` exists in git log (FOUND)
- `src/engine/AlarmEngine.ts` contains `private session: SessionHandle | null = null;` (FOUND)
- `src/engine/AlarmEngine.ts` contains `this.session = await startAlarmSession();` (FOUND, line 104)
- `src/engine/AlarmEngine.ts` contains `endAlarmSession(this.session);` (FOUND, line 369)
- `src/engine/AlarmEngine.ts` does NOT contain `startKeepalive(`, `acquireWakeLock(`, or `attachVisibilityReacquire(` (CONFIRMED — sanity grep returned zero matches)
- `src/engine/__tests__/AlarmEngine.test.ts` contains the literal "AlarmSession wiring" header comment (FOUND, lines 417 + 431)
- `src/engine/__tests__/AlarmEngine.test.ts` contains 40 it() blocks (FOUND — was 29 before, +11 new = 40 exactly)
- Full vitest suite reports 263 passing tests across 23 files (FOUND — confirmed via `npx vitest run`)
- tsc --noEmit exits 0 (CONFIRMED)
- SEG-05 zero-diff guard returns empty for all 9 protected paths (CONFIRMED via `git diff --name-only HEAD~2 -- ...`)

---
*Phase: 06-alarmsession-refactor-v1-regression-guard*
*Completed: 2026-05-07*
