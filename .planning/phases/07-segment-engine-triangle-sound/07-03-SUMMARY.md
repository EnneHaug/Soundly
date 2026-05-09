---
phase: 07-segment-engine-triangle-sound
plan: 03
subsystem: audio
tags: [audio, dispatch, routing, type-narrowing, phase-7]

# Dependency graph
requires:
  - 07-01
    provides: strikeTriangle factory at src/engine/sounds/triangle.ts (the 'triangle' key dispatch target)
  - 07-02
    provides: Segment type with endSound: 'gentle' | 'triangle' | 'alarm' (the type union the dispatcher narrows from)
  - phase: 01-audio-engine-and-timer
    provides: strikeBowl factory at src/engine/sounds/singingBowl.ts (the 'gentle' key dispatch target — read-only consumed)
  - phase: 06-alarmsession-refactor-v1-regression-guard
    provides: v1 zero-diff floor (SEG-05) — Phase 7 may only ADD segmentSound.ts; existing src/engine/sounds/* untouched
provides:
  - fireSegmentEndSound(ac, key) — type-narrowed dispatcher at src/engine/sounds/segmentSound.ts
  - 3-test routing regression net (gentle routing, triangle routing, AC identity passthrough)
  - Compile-time guarantee that 'alarm' cannot be passed through the dispatcher (D-13 carve-out)
affects:
  - 07-04 (SegmentEngine.handleSegmentFire) imports fireSegmentEndSound; branches on segment.endSound === 'alarm' first, then dispatches via fireSegmentEndSound for the gentle/triangle case (TS narrows the union automatically)
  - 07-05 (barrel export) does NOT re-export segmentSound — it is internal to the engine module per D-24

# Tech tracking
tech-stack:
  added: []   # No new dependencies — pure dispatcher with two existing imports
  patterns:
    - "Type-narrowed key union as design intent: 'gentle' | 'triangle' deliberately rejects 'alarm' at compile time. SegmentEngine call sites are forced to branch on alarm before invoking the dispatcher. This is a load-bearing design choice — the carve-out IS the contract."
    - "TS narrowing without exhaustiveness check: `if (key === 'gentle')` narrows the else branch to `'triangle'` automatically — no switch+default+never assertion needed for a 2-key union."
    - "vi.mock + await import inside test body: hoisted top-of-file mock declarations + per-test `await import('../sounds/...')` retrieves the mocked references without re-mocking. Established pattern from PATTERNS.md (line 665) and reused for downstream dispatcher tests."

key-files:
  created:
    - src/engine/sounds/segmentSound.ts
    - src/engine/__tests__/segmentSound.test.ts
  modified: []   # v1 zero-diff floor preserved — only new files added

key-decisions:
  - "Verbatim transcription of plan-prescribed dispatcher body (PATTERNS.md lines 437-449). No deviation in shape, signature, or comment text."
  - "JSDoc carve-out reword preserved: alarm key is referenced without single quotes in the source file so `grep -c \"'alarm'\"` returns 0 — exclusion-by-type is the design, but the literal token does not appear anywhere in the file."
  - "Tests located at `src/engine/__tests__/segmentSound.test.ts` (NOT under `sounds/__tests__/`) per CONTEXT D-22 — aligned with SegmentEngine.test.ts and validateSegmentConfig.test.ts test-file co-location."

patterns-established:
  - "Type-narrowed dispatcher pattern: when a multi-key union has a structurally distinct branch (alarm = ramp+loop, others = one-shot strike), narrow the dispatcher's input union and force callers to branch BEFORE invoking. This makes the carve-out explicit at every call site and prevents accidental routing — TS error catches it at compile time."
  - "Identity passthrough assertion (toBe vs toEqual): when a dispatcher MUST forward a reference unchanged, assert with strict-reference toBe rather than deep-equal toEqual. Detects refactors that wrap or clone the parameter."

requirements-completed: []   # SEG-01 was completed in 07-02; this plan supports the SEG-01 surface but does not introduce new completed requirements

# Metrics
duration: 1m 41s
completed: 2026-05-09
---

# Phase 7 Plan 03: fireSegmentEndSound Dispatcher Summary

**Created the type-narrowed gentle/triangle dispatcher (D-13 carve-out) — a 22-line module that routes one-shot end-of-segment strikes while excluding 'alarm' at compile time, plus 3 routing/identity tests.**

## Performance

- **Duration:** 1m 41s
- **Started:** 2026-05-09T20:16:04Z
- **Completed:** 2026-05-09T20:17:44Z
- **Tasks:** 2 / 2
- **Files modified:** 2 (both newly created)

## Accomplishments

- Created `src/engine/sounds/segmentSound.ts` (22 lines) — single export `fireSegmentEndSound(ac, key)` with the verbatim D-13 body. Type signature is `(ac: AudioContext, key: 'gentle' | 'triangle') => void` — `'alarm'` is excluded at compile time.
- Created `src/engine/__tests__/segmentSound.test.ts` (49 lines) — 3 passing tests covering gentle routing, triangle routing, and AC identity passthrough. Cross-contamination guards (`strikeTriangle).not.toHaveBeenCalled` / `strikeBowl).not.toHaveBeenCalled`) prevent silent breakage if dispatcher is ever rewritten to call both.
- Confirmed v1 zero-diff floor (SEG-05) — `git diff --name-only HEAD~2 HEAD` returns exactly the two newly created paths.
- Full test suite green: 297 / 297 tests pass; TypeScript compiles clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create src/engine/sounds/segmentSound.ts dispatcher with type-narrowed key** — `a22c62d` (feat)
2. **Task 2: Create routing tests proving each key dispatches to exactly one strike** — `2f9667f` (test)

## D-13 Carve-Out Confirmation

The `'alarm'` key is intentionally NOT routed through this dispatcher. SegmentEngine (07-04) handles alarm directly via `createPhase3Ramp + startPhase3Swell` because the ramp lifecycle is structurally different (multi-second sustain + 3.2 s loop, not a one-shot strike).

**Compile-time exclusion verified:**

```
$ grep -c "'alarm'" src/engine/sounds/segmentSound.ts
0
```

The literal token `'alarm'` appears nowhere in the source file — not in the type union, not in JSDoc. The carve-out reference uses the case-insensitive form ("alarm key") so `grep -ci "alarm"` returns 3 occurrences (one in the JSDoc paragraph + two in the cross-reference comment).

**Type signature locked:**

```typescript
export function fireSegmentEndSound(ac: AudioContext, key: 'gentle' | 'triangle'): void
```

A SegmentEngine call site like `fireSegmentEndSound(ac, segment.endSound)` where `segment.endSound: 'gentle' | 'triangle' | 'alarm'` will fail to type-check — TS will demand the call site narrow the union first. This IS the design.

## Test Inventory (3 / 3 passing)

| # | Test | Asserts |
|---|------|---------|
| 1 | routes 'gentle' to strikeBowl(ac, 1.0) exactly once and does not call strikeTriangle | `strikeBowl.toHaveBeenCalledTimes(1)` + `strikeBowl.toHaveBeenCalledWith(ac, 1.0)` + `strikeTriangle.not.toHaveBeenCalled()` |
| 2 | routes 'triangle' to strikeTriangle(ac, 1.0) exactly once and does not call strikeBowl | `strikeTriangle.toHaveBeenCalledTimes(1)` + `strikeTriangle.toHaveBeenCalledWith(ac, 1.0)` + `strikeBowl.not.toHaveBeenCalled()` |
| 3 | passes the AudioContext through by identity (no wrapping) | `(strikeBowl as ReturnType<typeof vi.fn>).mock.calls[0][0]` `.toBe(ac)` (strict reference equality, not deep-equal) |

## Files Created

- `src/engine/sounds/segmentSound.ts` (NEW, 22 lines) — `fireSegmentEndSound(ac, key)` with verbatim D-13 body. JSDoc explicitly records the carve-out rationale and references CONTEXT D-13.
- `src/engine/__tests__/segmentSound.test.ts` (NEW, 49 lines) — 3 tests using vi.mock + await-import pattern. Tests live at `src/engine/__tests__/` per CONTEXT D-22.

## Decisions Made

None new — plan was a verbatim transcription of locked Phase 7 D-13 dispatcher body and PATTERNS.md test scaffold. No parameter exploration. No carve-out re-evaluation.

## Deviations from Plan

None — plan executed exactly as written. The recent revision to the JSDoc carve-out (which removed the literal `'alarm'` quoted token from the source file) was implemented verbatim. All grep-based acceptance criteria — including the post-revision `grep -c "'alarm'"` returns 0 — pass cleanly.

No CLAUDE.md-driven adjustments. No auto-fixes (Rules 1-2). No architectural changes (Rule 4).

## v1 Zero-Diff (SEG-05) Verification

```
$ git diff --name-only HEAD~2 HEAD
src/engine/__tests__/segmentSound.test.ts
src/engine/sounds/segmentSound.ts
```

Only the two newly created files. No edits to any of:
- `src/engine/{AlarmEngine,AlarmState,AlarmSession,AudioContext,timer,SegmentState}.ts`
- `src/engine/sounds/{singingBowl,phase3Tone,keepalive,testSound,tickPulse,triangle}.ts`
- `src/hooks/useAlarm.ts`, `src/components/{Countdown,ProgressRing,Dashboard}.tsx`
- `src/platform/{wakeLock,vibration,notifications}.ts`
- `src/engine/index.ts`, `src/App.tsx`

## Acceptance Verification

| Plan criterion | Result |
|----------------|--------|
| Task 1: `test -f src/engine/sounds/segmentSound.ts` | PASS |
| Task 1: `grep -c "^export function fireSegmentEndSound"` = 1 | PASS (1) |
| Task 1: `grep -c "'gentle' \| 'triangle'"` >= 1 | PASS (1) |
| Task 1: `grep -c "'alarm'"` = 0 | PASS (0) |
| Task 1: `grep -c "import { strikeBowl } from './singingBowl'"` = 1 | PASS (1) |
| Task 1: `grep -c "import { strikeTriangle } from './triangle'"` = 1 | PASS (1) |
| Task 1: `grep -c "strikeBowl(ac, 1.0)"` = 1 | PASS (1) |
| Task 1: `grep -c "strikeTriangle(ac, 1.0)"` = 1 | PASS (1) |
| Task 1: `grep -ci "alarm"` >= 2 | PASS (3) |
| Task 1: `npx tsc --noEmit` exits 0 | PASS |
| Task 2: `test -f src/engine/__tests__/segmentSound.test.ts` | PASS |
| Task 2: 3 tests pass | PASS (3 / 3) |
| Task 2: `grep -c "fireSegmentEndSound(ac, 'gentle')"` >= 1 | PASS (2) |
| Task 2: `grep -c "fireSegmentEndSound(ac, 'triangle')"` >= 1 | PASS (1) |
| Task 2: `grep -c "strikeTriangle).not.toHaveBeenCalled"` >= 1 | PASS (1) |
| Task 2: `grep -c "strikeBowl).not.toHaveBeenCalled"` >= 1 | PASS (1) |
| Task 2: `grep -c "1.0"` >= 2 | PASS (4) |
| Task 2: `grep -c "toBe(ac)"` >= 1 | PASS (1) |
| Task 2: `grep -c "vi.mock('../sounds/singingBowl'"` = 1 | PASS (1) |
| Task 2: `grep -c "vi.mock('../sounds/triangle'"` = 1 | PASS (1) |
| Task 2: `npx tsc --noEmit` exits 0 | PASS |
| Full suite regression check: `npx vitest run` | PASS (297 / 297 tests across 26 test files) |
| SEG-05 zero-diff floor preserved | PASS (only the two new files) |

**Net:** 23 / 23 acceptance criteria PASS verbatim. Zero deviations.

## Downstream Pointer (per plan output spec)

**For 07-04 (SegmentEngine.handleSegmentFire):**

The dispatcher is consumed via:

```typescript
import { fireSegmentEndSound } from './sounds/segmentSound';

// inside handleSegmentFire(i):
const segment = this.activeConfig!.segments[i];
if (segment.endSound === 'alarm') {
  // alarm handled directly via createPhase3Ramp + startPhase3Swell (D-01)
  this.state = 'firing-alarm';
  // ... ramp + loop setup
} else {
  // TS narrows segment.endSound from 'gentle' | 'triangle' | 'alarm' to 'gentle' | 'triangle'
  fireSegmentEndSound(this.ac!, segment.endSound);
}
```

The TS narrowing in the else branch is automatic — once `segment.endSound === 'alarm'` is excluded, the residual type is `'gentle' | 'triangle'`, which exactly matches the dispatcher's `key` parameter. No `as` cast required.

**For 07-05 (barrel + harness):**

`segmentSound.ts` is intentionally NOT added to `src/engine/index.ts` per CONTEXT D-24. It is internal to the engine module — only SegmentEngine imports it directly.

## Self-Check: PASSED

- File `src/engine/sounds/segmentSound.ts`: FOUND
- File `src/engine/__tests__/segmentSound.test.ts`: FOUND
- Commit `a22c62d` (Task 1): FOUND in git log
- Commit `2f9667f` (Task 2): FOUND in git log
