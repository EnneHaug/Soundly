---
phase: 07-segment-engine-triangle-sound
plan: 02
subsystem: engine
tags: [types, validation, state-machine, discriminated-union, phase-7]

# Dependency graph
requires:
  - phase: 01-audio-engine-and-timer
    provides: AlarmState.ts paired-pattern reference (validateConfig + named-config constants + type exports) — analog read-only
  - phase: 06-alarmsession-refactor-v1-regression-guard
    provides: v1 zero-diff floor (SEG-05) — Phase 7 may only ADD SegmentState.ts; AlarmState.ts/AlarmConfig untouched
  - 07-01
    provides: triangle.ts strikeTriangle factory — the 'triangle' Segment.endSound key downstream consumer
provides:
  - SegmentState.ts type vocabulary (Segment, SegmentConfig, SegmentEngineState, SegmentChangeEvent, SegmentPauseSnapshot, SegmentValidationResult)
  - validateSegmentConfig(input: unknown) — pure discriminated-union validator, never throws (SEG-04 contract)
  - WAKE_EASY_CONFIG named constant (5 segments, 17 min total — Phase 8 dashboard fixture + Phase 7 harness fixture)
  - 22-test regression net asserting D-12 rules + SEG-04 never-throws + first-failure-wins ordering
affects:
  - 07-03 (segmentSound dispatcher) consumes the 'gentle' | 'triangle' subset of Segment.endSound
  - 07-04 (SegmentEngine) imports Segment, SegmentConfig, SegmentEngineState, SegmentChangeEvent, SegmentPauseSnapshot, validateSegmentConfig, throws Error(result.error) inside start() per defense-in-depth
  - 07-05 (barrel) re-exports validateSegmentConfig + WAKE_EASY_CONFIG + the 4 type names from src/engine/index.ts
  - Phase 9 composer surfaces validation error string inline; passes decoded share-URL payloads through the validator gate before launch (T-07-01 mitigation)

# Tech tracking
tech-stack:
  added: []   # No new dependencies — pure TypeScript, no runtime imports beyond v1 types
  patterns:
    - "Discriminated-union return type as the SEG-04 contract: `{ ok: true; config: SegmentConfig } | { ok: false; error: string }`. New to the codebase — invertes the v1 validateConfig throws-on-invalid contract."
    - "First-failure-wins iteration order with index-tagged error strings for deterministic composer error reporting."
    - "Discriminated-union narrowing via `if (result.ok)` / `if (!result.ok)` for type-safe field access — exercised in 22 tests."

key-files:
  created:
    - src/engine/SegmentState.ts
    - src/engine/__tests__/validateSegmentConfig.test.ts
  modified: []   # v1 zero-diff floor preserved — only new files added

key-decisions:
  - "validateSegmentConfig contract divergence vs v1 validateConfig is intentional and load-bearing per SEG-04 / D-11 — discriminated-union return, NEVER throw. Composer surfaces error string; engine layer (07-04) gates start() on result.ok for defense-in-depth."
  - "Validator iterates first-failure-wins to give composer deterministic error reporting (Test 'first-failure-wins reports the first invalid segment by index' confirms)."
  - "MAX_DURATION_MS = 14_400_000 matches AlarmConfig 4-hour ceiling per D-12; literal preserved in JSDoc + constant declaration for grep-able evidence."
  - "Segment.id is opaque per D-18 — engine treats as React-key/share-URL-only; composer (Phase 9) is responsible for ID allocation. WAKE_EASY_CONFIG hardcodes 'wake-easy-1'..'wake-easy-5' for Phase 7 harness."

patterns-established:
  - "Pure-validator + discriminated-union pattern for any future input-validation surface (T-07-01: caller MUST narrow on .ok before access — TypeScript enforces at compile time)."
  - "Defensive-contract test idiom: explicit `expect(() => fn(badInput)).not.toThrow()` suite for any function with documented never-throws guarantee (parallels Phase 06 P01's force-reject-mock idiom for thin orchestrators)."

requirements-completed:
  - SEG-01
  - SEG-04

# Metrics
duration: 3m 22s
completed: 2026-05-09
---

# Phase 7 Plan 02: SegmentState + validateSegmentConfig Summary

**Created the segment-engine type vocabulary, the SEG-04 never-throws validator (discriminated union), and the WAKE_EASY_CONFIG named constant — paired pattern with AlarmState.ts but with an inverted validator contract.**

## Performance

- **Duration:** 3m 22s
- **Started:** 2026-05-09T20:08:44Z
- **Completed:** 2026-05-09T20:12:06Z
- **Tasks:** 2 / 2
- **Files modified:** 2 (both newly created)

## Accomplishments

- Created `src/engine/SegmentState.ts` (113 lines) — 6 type exports + `validateSegmentConfig(input: unknown)` pure validator + `WAKE_EASY_CONFIG` named constant.
- Validator implements D-12 rules with first-failure-wins iteration and exact user-readable error wording per CONTEXT D-12.
- Created `src/engine/__tests__/validateSegmentConfig.test.ts` (170 lines) — 22 tests across 6 describe blocks covering valid inputs, malformed shape, invalid durations, invalid sound keys, invalid ids, and the SEG-04 defensive (never-throws + first-failure-wins) contract.
- Confirmed v1 zero-diff floor (SEG-05) preserved — only the two new files were modified by this plan; `git diff --name-only HEAD~2 HEAD` returns exactly the two expected paths.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create src/engine/SegmentState.ts with types + validator + WAKE_EASY_CONFIG** — `4cde439` (feat)
2. **Task 2: Create validateSegmentConfig test suite covering all D-12 rules + defensive contract** — `ccde484` (test)

## All 6 Type Exports Confirmed

| Export | Kind | Source |
|--------|------|--------|
| `Segment` | interface | D-08 / RESEARCH §types skeleton |
| `SegmentConfig` | interface | D-08 |
| `SegmentEngineState` | type alias | D-08 — `'idle' \| 'running' \| 'firing-alarm' \| 'dismissed'` |
| `SegmentChangeEvent` | interface | D-09 — `kind: 'start' \| 'end'` |
| `SegmentPauseSnapshot` | interface | D-19 |
| `SegmentValidationResult` | discriminated union | D-11 — `{ ok: true; config } \| { ok: false; error }` |

## Validator Implementation: Zero throws

`grep -c "throw " src/engine/SegmentState.ts` returns **0**. Every failure path is `return { ok: false, error }`. The SEG-04 never-throws contract holds at code level AND test level (5 explicit `.not.toThrow()` assertions in the defensive-contract suite).

```
$ grep -c "throw " src/engine/SegmentState.ts
0
$ grep -cE "return \{ ok: (true|false)" src/engine/SegmentState.ts
5
```

The 5 returns: 4 false-paths (non-object input, empty list / non-array, malformed segment / invalid id / invalid duration / invalid sound key — early-exit grouped) + 1 true-success.

## D-12 Rule-by-Rule Coverage Matrix

| D-12 rule | Validator behavior | Test (describe block / it title) |
|-----------|--------------------|----------------------------------|
| Empty segments array | `{ ok: false, error: 'Segment list is empty — at least one segment is required' }` | `rejects malformed input shape` > `returns { ok: false } for empty segments array with user-readable message` |
| Missing segments field | Treated as `Array.isArray(undefined) === false`, same path as empty | `rejects malformed input shape` > `returns { ok: false } for missing segments field` |
| Non-array segments | `Array.isArray` guard | covered transitively by `for object {}` test |
| NaN duration | `!Number.isFinite()` | `rejects invalid duration values` > `rejects NaN duration` |
| Zero duration | `seg.durationMs <= 0` | `rejects invalid duration values` > `rejects zero duration` |
| Negative duration | `seg.durationMs <= 0` | `rejects invalid duration values` > `rejects negative duration` |
| Over-max duration (> 14_400_000) | `seg.durationMs > MAX_DURATION_MS` | `rejects invalid duration values` > `rejects duration exceeding the 4-hour ceiling` (with `14_400_001` literal) |
| Infinity duration | `!Number.isFinite()` | `rejects invalid duration values` > `rejects Infinity duration` |
| Unknown sound key | `!VALID_SOUND_KEYS.has(seg.endSound)` with key name in error | `rejects invalid sound keys` > `rejects unknown sound key with key name in error message` (asserts `/beep/` AND `/gentle.*triangle.*alarm\|expected/i`) |
| Empty-string id | `seg.id.length === 0` | `rejects invalid ids` > `rejects empty-string id` |
| Non-string id | `typeof seg.id !== 'string'` | `rejects invalid ids` > `rejects non-string id` |
| Non-object input (null/string/number) | initial type guard | `rejects malformed input shape` > 3 tests |
| Boundary: duration === 14_400_000 (allowed) | `seg.durationMs > MAX_DURATION_MS` (strict greater) | `valid inputs` > `accepts duration at the 4-hour ceiling (14_400_000)` |

**SEG-04 defensive contract (never-throws):**

| Bad input | Test |
|-----------|------|
| `null` | `does not throw on null` |
| `undefined` | `does not throw on undefined` |
| primitive (`42`, `'foo'`, `true`) | `does not throw on primitive` |
| circular reference | `does not throw on circular reference` |
| `segments: [null]` | `does not throw on segments containing null entries` |

**First-failure-wins:**

`first-failure-wins — reports the first invalid segment by index` — input has bad segment at index 1 AND index 2; assertion `result.error.toContain('Segment 1')` AND `result.error.not.toContain('Segment 2')` verifies the iteration short-circuits on first failure.

## WAKE_EASY_CONFIG = 17 min Sanity Check

```
4 × 240_000 ms (gentle) + 1 × 60_000 ms (alarm) = 1_020_000 ms = 17 min exact
```

| Segment | id | duration | endSound |
|---------|-----|----------|----------|
| 1 | `wake-easy-1` | 240_000 ms (4 min) | gentle |
| 2 | `wake-easy-2` | 240_000 ms (4 min) | gentle |
| 3 | `wake-easy-3` | 240_000 ms (4 min) | gentle |
| 4 | `wake-easy-4` | 240_000 ms (4 min) | gentle |
| 5 | `wake-easy-5` | 60_000 ms (1 min) | alarm |

Verified at runtime by `validateSegmentConfig(WAKE_EASY_CONFIG)` returning `{ ok: true, config }` with `config` `.toEqual(WAKE_EASY_CONFIG)` (Test #1).

## Test Inventory (22 / 22 passing)

| # | Describe block | Test |
|---|----------------|------|
| 1 | valid inputs | returns `{ ok: true, config }` for the Wake Easy preset |
| 2 | valid inputs | returns `{ ok: true }` for a minimal 1-segment config |
| 3 | valid inputs | accepts duration at the 4-hour ceiling (14_400_000) |
| 4 | rejects malformed input shape | returns `{ ok: false }` for null |
| 5 | rejects malformed input shape | returns `{ ok: false }` for undefined |
| 6 | rejects malformed input shape | returns `{ ok: false }` for string input |
| 7 | rejects malformed input shape | returns `{ ok: false }` for missing segments field |
| 8 | rejects malformed input shape | returns `{ ok: false }` for empty segments array with user-readable message |
| 9 | rejects invalid duration values | rejects NaN duration |
| 10 | rejects invalid duration values | rejects zero duration |
| 11 | rejects invalid duration values | rejects negative duration |
| 12 | rejects invalid duration values | rejects duration exceeding the 4-hour ceiling |
| 13 | rejects invalid duration values | rejects Infinity duration |
| 14 | rejects invalid sound keys | rejects unknown sound key with key name in error message |
| 15 | rejects invalid ids | rejects empty-string id |
| 16 | rejects invalid ids | rejects non-string id |
| 17 | defensive contract — never throws (SEG-04) | does not throw on null |
| 18 | defensive contract — never throws (SEG-04) | does not throw on undefined |
| 19 | defensive contract — never throws (SEG-04) | does not throw on primitive |
| 20 | defensive contract — never throws (SEG-04) | does not throw on circular reference |
| 21 | defensive contract — never throws (SEG-04) | does not throw on segments containing null entries |
| 22 | defensive contract — never throws (SEG-04) | first-failure-wins — reports the first invalid segment by index |

## Files Created

- `src/engine/SegmentState.ts` (NEW, 113 lines) — 6 type exports + `validateSegmentConfig(input: unknown): SegmentValidationResult` + `WAKE_EASY_CONFIG` named constant. JSDoc head references CONTEXT D-08, D-09, D-11, D-12, D-19; per-function JSDoc enumerates first-failure-wins check ordering.
- `src/engine/__tests__/validateSegmentConfig.test.ts` (NEW, 170 lines) — 22 tests across 6 describe blocks. Discriminated-union narrowing pattern (`if (result.ok)` / `if (!result.ok)`) exercised throughout for type-safe field access.

## Decisions Made

None new — plan was a verbatim transcription of CONTEXT D-08 through D-12 + D-19 plus the locked validator contract per SEG-04. PATTERNS guidance followed exactly. The discriminated-union narrowing pattern is new to the codebase but was pre-locked by the plan and CONTEXT.

## Deviations from Plan

### Documentation note

**1. [Rule 3 — Acceptance criterion mis-specified vs plan-supplied action body] Task 1 criterion #5 (`grep -cE "return \{ ok: (true|false)" >= 7`) is internally inconsistent with the plan's prescribed `<action>` body**

- **Found during:** Task 1 verification
- **Issue:** The plan's acceptance criterion for "validator never throws — only returns" expects `>= 7` return statements (one per failure path + the success return), but the plan's `<action>` block prescribes a body with **5 returns total** (4 false-paths + 1 true-success). The 4 false-paths use early-exit grouping inside the per-segment loop — there is no implementation that satisfies both the verbatim plan body AND the `>= 7` criterion.
- **Resolution:** Implemented the plan-supplied `<action>` body verbatim. The never-throws contract is preserved by:
  - Criterion #4: `grep -c "throw " src/engine/SegmentState.ts` returns **0** (PASS)
  - Test suite: 5 explicit `.not.toThrow()` assertions in `defensive contract — never throws (SEG-04)` describe block (PASS — all 22 tests pass)
  - TypeScript: discriminated-union return type at compile time
- **Files modified:** None (no code change required — implementation matches plan body verbatim).
- **Commits:** `4cde439` (Task 1) — implements plan-prescribed body. The mis-specified criterion is a documentation issue in the plan, not a code issue in the implementation.

No code-level deviations. No CLAUDE.md-driven adjustments. No auto-fixes (Rules 1-2). No architectural changes (Rule 4).

## v1 Zero-Diff (SEG-05) Verification

```
$ git diff --name-only HEAD~2 HEAD
src/engine/SegmentState.ts
src/engine/__tests__/validateSegmentConfig.test.ts
```

Only the two newly created files. No edits to any of:
- `src/engine/{AlarmEngine,AlarmState,AlarmSession,AudioContext,timer}.ts`
- `src/engine/sounds/{singingBowl,phase3Tone,keepalive,testSound,tickPulse,triangle}.ts`
- `src/hooks/useAlarm.ts`, `src/components/{Countdown,ProgressRing,Dashboard}.tsx`
- `src/platform/{wakeLock,vibration,notifications}.ts`
- `src/engine/index.ts`, `src/App.tsx`

## Acceptance Verification

| Plan criterion | Result |
|----------------|--------|
| `test -f src/engine/SegmentState.ts` | PASS |
| `grep -c "ok: true; config: SegmentConfig"` = 1 | PASS (1) |
| `grep -c "ok: false; error: string"` = 1 | PASS (1) |
| `grep -c "throw "` = 0 | PASS (0) |
| `grep -cE "return \{ ok: (true\|false)"` >= 7 | **DEVIATION** — actual 5 (matches plan-supplied action body verbatim; see deviation #1 above. Never-throws contract holds via #4 and tests.) |
| `grep -c "14_400_000"` >= 2 | PASS (2 — constant decl + JSDoc reference) |
| `grep -c "240_000"` >= 4 | PASS (5) |
| `grep -c "60_000"` >= 1 | PASS (2) |
| state enum exact match (=1) | PASS (1) |
| `grep -c "'start' \| 'end'"` = 1 | PASS (1) |
| `grep -c "currentSegmentIndex"` >= 1 | PASS (1) |
| `grep -c "currentSegmentRemainingMs"` >= 1 | PASS (1) |
| `grep -c "futureSegmentDurationsMs"` >= 1 | PASS (1) |
| `grep -c "Unknown sound key"` = 1 | PASS (1) |
| `grep -c "Segment list is empty"` = 1 | PASS (1) |
| `grep -c "has invalid duration"` = 1 | PASS (1) |
| `grep -c "wake-easy-"` = 5 | PASS (5) |
| `grep -c "endSound: 'alarm'"` = 1 | PASS (1) |
| `npx tsc --noEmit` exits 0 | PASS |
| `test -f src/engine/__tests__/validateSegmentConfig.test.ts` | PASS |
| `npx vitest run src/engine/__tests__/validateSegmentConfig.test.ts` exits 0 | PASS (22/22 tests passed) |
| `grep -c "never throws"` >= 1 | PASS (1) |
| `grep -c "first-failure-wins"` >= 1 | PASS (1) |
| `grep -c "if (result.ok)"` >= 1 | PASS (1) |
| `grep -c "if (!result.ok)"` >= 3 | PASS (6) |
| `grep -c "NaN"` >= 1 | PASS (2) |
| `grep -c "14_400_001"` = 1 | PASS (1) |
| `grep -c "'beep'"` >= 1 | PASS (1) |
| `grep -c "id: ''"` >= 1 | PASS (1) |
| `grep -c "circular"` >= 1 | PASS (4) |

**Net:** 28 / 29 verbatim PASS. 1 documentation deviation (plan-criterion #5 inconsistent with plan-supplied action body — never-throws contract preserved by 3 other independent verifications).

## Downstream Pointers (per plan output spec)

- **07-03 (segmentSound dispatcher):** imports the `'gentle' | 'triangle'` typing implied by `Segment.endSound`. Note: `'alarm'` is intentionally NOT routed through the dispatcher per CONTEXT D-13 — SegmentEngine handles alarm directly via `createPhase3Ramp + startPhase3Swell`.
- **07-04 (SegmentEngine):** imports `Segment`, `SegmentConfig`, `SegmentEngineState`, `SegmentChangeEvent`, `SegmentPauseSnapshot`, `validateSegmentConfig`. The validator gate idiom inside `start()` is `const result = validateSegmentConfig(config); if (!result.ok) throw new Error(result.error);` — defense-in-depth wrapper that shifts the never-throws guarantee from validator (always honored) to engine (caller's responsibility to either catch or hoist for composer).
- **07-05 (barrel + harness):** re-exports `Segment`, `SegmentConfig`, `SegmentEngineState`, `SegmentChangeEvent`, `validateSegmentConfig`, `WAKE_EASY_CONFIG` from `src/engine/index.ts`.

## Self-Check: PASSED

- File `src/engine/SegmentState.ts`: FOUND
- File `src/engine/__tests__/validateSegmentConfig.test.ts`: FOUND
- Commit `4cde439` (Task 1): FOUND in git log
- Commit `ccde484` (Task 2): FOUND in git log
