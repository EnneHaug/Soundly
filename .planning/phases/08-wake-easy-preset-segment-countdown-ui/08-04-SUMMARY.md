---
phase: 08-wake-easy-preset-segment-countdown-ui
plan: 04
subsystem: hooks
tags: [react, hook, dispatcher, discriminated-union, tdd, vitest, testing-library]

# Dependency graph
requires:
  - phase: 08-wake-easy-preset-segment-countdown-ui
    provides: useSegmentAlarm hook + UseSegmentAlarmReturn type (Plan 08-02); vitest jsdom env + @testing-library/react renderHook (Plan 08-01)
  - phase: 03-react-ui
    provides: useAlarm hook + UseAlarmReturn type (SEG-05 protected, read-only consumed)
  - phase: 02-engine-core
    provides: AlarmConfig type (SEG-05 protected)
  - phase: 07-segment-engine-triangle-sound
    provides: SegmentConfig type
provides:
  - useActiveAlarm hook — mode-dispatching composer over useAlarm + useSegmentAlarm
  - PresetSelection type — discriminated input for start() ({ kind: 'continuous' | 'segments' })
  - ActiveAlarmState type — locked CONTEXT D-07 discriminated-union output ({ mode: 'idle' | 'continuous' | 'segments' })
  - Always-both-mounted React composition pattern (D-08) verified end-to-end with mocked inner hooks
  - pendingMode race-window pattern (RESEARCH §"Pattern 2") covering microtask gap between tap and isRunning flip
affects:
  - 08-06 App.tsx wiring — DIRECT consumer; will narrow on `mode` to render <Countdown> or <SegmentCountdown>

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mode-dispatcher hook pattern: compose two underlying hooks unconditionally at the top level (rules-of-hooks compliant) and return a TypeScript discriminated union keyed on a string literal — consumer narrows with `if (state.mode === 'segments')` and the type system grants access to the right shape without casts"
    - "pendingMode race-window guard: `useState<'continuous' | 'segments' | null>(null)` set BEFORE the await and cleared in a `finally` block. Covers the microtask gap between calling start() and the underlying hook reporting isRunning=true; the finally block guarantees reset on both happy-path and rejection (T-08-04-02 mitigation)"
    - "Mock-the-inner-hooks test idiom: `vi.mock('../useAlarm', () => ({ useAlarm: () => continuousMock }))` with a per-test mutable `continuousMock` object lets each test drive isRunning + start spies without instantiating the real React hooks. Mirrors the `vi.mock('../../engine/SegmentEngine', ...)` pattern from useSegmentAlarm.test.ts but one layer up the dependency chain"
    - "Discriminated-union narrowing inside test bodies: `if (result.current.mode !== 'idle') throw new Error('expected idle')` (or `if (result.current.mode === 'idle') { ... }`) lets TypeScript narrow the union before accessing branch-specific fields like `start` — no `as any` casts in the test file"

key-files:
  created:
    - src/hooks/useActiveAlarm.ts (76 lines)
    - src/hooks/__tests__/useActiveAlarm.test.ts (186 lines)
  modified: []

key-decisions:
  - "Defensive ordering: `continuous.isRunning ? 'continuous' : segments.isRunning ? 'segments' : (pendingMode ?? 'idle')` — continuous wins if both are somehow running. D-10 UI takeover should make this state impossible (the Dashboard unmounts after any start), but the explicit ordering means the dispatch is deterministic if the invariant ever breaks"
  - "pendingMode is `useState`, not `useRef`: re-renders during the in-flight window are required for the UI to see `mode === 'segments'` immediately after the tap; a ref would not trigger a re-render and the flicker the guard exists to prevent would still occur"
  - "setPendingMode(null) lives in `finally`, not after the success branch: guarantees reset even if the underlying engine.start() rejects (failure → back to idle so the user can retry); maps directly to T-08-04-02 mitigation"
  - "Idle-branch return does NOT include `continuous` or `segments` objects: exposing them would let consumers call `.start()`, `.pause()`, `.stop()` directly, defeating T-03-01 (controlled methods only via the dispatcher's discriminated union). Only the dispatcher's own `start(preset)` is exposed when idle"
  - "Tests assert dispatch via reference identity (`expect(result.current.alarm).toBe(continuousMock)`) rather than per-field comparison: stronger contract — proves the same object reference is forwarded, not a structurally-equivalent shallow copy"

patterns-established:
  - "Hook-composition dispatcher: top-of-file unconditional calls to N underlying hooks → derived discriminator from their public state → branch return object literal whose discriminator field is a string literal type. Future Phase-9+ work that needs to dispatch among more than two engines (e.g. compositions vs presets) can extend this verbatim by adding a third `kind`/`mode` value"
  - "Idle-branch start() closure: returns `{ mode: 'idle', start: async (preset) => { ... } }` where the start function captures `continuous` and `segments` from the enclosing render. Each render produces a fresh closure with fresh references — no useCallback needed because the dispatcher itself returns a fresh state object on every render anyway"
  - "Test-file narrowing pattern: `if (result.current.mode !== 'idle') throw new Error('expected idle')` early-throws lets the rest of the test body access `start` without an `as any`. Better than `as any` because a future shape change would surface as a TS error"

requirements-completed: [SEG-06]

# Metrics
duration: 5m
completed: 2026-05-10
---

# Phase 08 Plan 04: useActiveAlarm Dispatcher Hook Summary

**One-liner:** Mode-dispatching React hook composing useAlarm + useSegmentAlarm, returning a TypeScript discriminated union (`mode: 'idle' | 'continuous' | 'segments'`) so App.tsx can narrow on the active alarm shape without runtime casts.

## What Was Built

`src/hooks/useActiveAlarm.ts` (76 lines) wires together the two engine-backed hooks introduced earlier in this phase and Phase 3 respectively:

- **`useAlarm()`** (Phase 3, SEG-05 protected) — drives Quick Nap and Focus presets via `AlarmEngine`.
- **`useSegmentAlarm()`** (Phase 8 Plan 02) — drives the new Wake Easy preset via `SegmentEngine`.

Both are mounted unconditionally at the top of `useActiveAlarm`. React's rules-of-hooks demands this, and CONTEXT D-08 mandates "always-both-mounted" — engines do nothing on construction (verified `SegmentEngine.ts:48-73`), so there's no audio, Wake Lock, or notification cost. The hook then derives a single `mode` from the two `isRunning` flags plus a `pendingMode` state variable, and returns one of three branches:

```typescript
export type ActiveAlarmState =
  | { mode: 'idle';       start: (preset: PresetSelection) => Promise<void> }
  | { mode: 'continuous'; alarm: UseAlarmReturn }
  | { mode: 'segments';   alarm: UseSegmentAlarmReturn };
```

The accompanying test file (`src/hooks/__tests__/useActiveAlarm.test.ts`, 9 tests across 5 describe blocks) covers initial state, both-mounted enforcement, mode dispatch (continuous/segments + tie-breaking), start() routing for both kinds, the pendingMode race-window guard, and mode reset after stop. Each test mocks the inner `useAlarm` and `useSegmentAlarm` factories so the dispatcher's own logic is exercised without instantiating real engines, AudioContexts, or Wake Locks.

## TDD Gate Compliance

| Gate     | Commit    | Result                                                                                  |
| -------- | --------- | --------------------------------------------------------------------------------------- |
| RED      | `089bf1d` | `test(08-04): add failing useActiveAlarm test suite` — vitest fails at module-resolution; no test bodies run |
| GREEN    | `77cba30` | `feat(08-04): implement useActiveAlarm dispatcher hook` — 9/9 tests passing            |
| REFACTOR | —         | Not needed; implementation matches the locked CONTEXT D-07 + RESEARCH Pattern 2 contract verbatim |

Both gates verified in `git log --oneline` between the previous Plan 03 final commit and the current HEAD.

## SEG-05 Byte-Identical Floor

Per the v1 zero-diff guarantee (active across all Phase 6–11 plans), the following protected paths MUST carry zero diff after this plan:

```
git diff src/hooks/useAlarm.ts \
         src/hooks/useSegmentAlarm.ts \
         src/components/Countdown.tsx \
         src/components/ProgressRing.tsx \
         src/engine/SegmentEngine.ts \
         src/engine/SegmentState.ts \
         src/engine/AlarmState.ts | wc -l
```

**Result: 0 lines.** All v1 + Phase 7 + Plan 02 surfaces preserved verbatim. The dispatcher is purely additive — no edits to any existing module, hook, or component.

## Verification Snapshot

| Check                                                        | Result                       |
| ------------------------------------------------------------ | ---------------------------- |
| `npx vitest run src/hooks/__tests__/useActiveAlarm.test.ts`  | 9/9 passing                  |
| `npx vitest run` (full suite)                                | 355/355 passing (30 files)   |
| `npx tsc --noEmit`                                           | exits 0 (no diagnostics)     |
| SEG-05 byte-identical guardrail                              | 0 lines diff (✓)             |

The full-suite count of 355 tests includes the duplicate scan from the stale `.claude/worktrees/agent-a1b94266/` worktree (out of scope per environment notes); the canonical `src/` count is the new line `src/hooks/__tests__/useActiveAlarm.test.ts (9 tests)` adding to the prior 346-test floor from Plan 03.

## Deviations from Plan

None — plan executed exactly as written. The CONTEXT D-07 surface, RESEARCH Pattern 2 hook body, and the test list from PATTERNS L1067-1089 were all transcribed verbatim. Two minor TypeScript narrowing tweaks were made inside the test file (adding redundant `if (result.current.mode === 'idle')` guards inside `act()` callbacks) so the test code passes `tsc --noEmit` strict-mode checks without `as any`, but these do not affect the assertions and align with the test-file narrowing pattern noted under patterns-established.

## Auth Gates

None encountered.

## Known Stubs

None. The hook is fully wired against the two real underlying hooks (`useAlarm` and `useSegmentAlarm`); no placeholder data flows. The mocks in the test file are isolated to the test scope.

## What This Unlocks

- **Plan 08-05 (SegmentCountdown component):** independent of this dispatcher, but consumes the same `UseSegmentAlarmReturn` shape that the `mode: 'segments'` branch surfaces.
- **Plan 08-06 (App.tsx wiring):** the direct consumer. App.tsx will call `useActiveAlarm()` once at the top of the component tree, then narrow on `state.mode` — `'idle'` shows the Dashboard with preset cards, `'continuous'` mounts `<Countdown alarm={state.alarm}/>`, `'segments'` mounts `<SegmentCountdown alarm={state.alarm}/>`. No runtime casts; TypeScript narrows automatically.

## Self-Check: PASSED

- ✓ FOUND: `src/hooks/useActiveAlarm.ts` (76 lines)
- ✓ FOUND: `src/hooks/__tests__/useActiveAlarm.test.ts` (186 lines)
- ✓ FOUND commit `089bf1d` (RED — `test(08-04): add failing useActiveAlarm test suite`)
- ✓ FOUND commit `77cba30` (GREEN — `feat(08-04): implement useActiveAlarm dispatcher hook`)
- ✓ Both files contain all required literal strings per the plan's acceptance criteria (verified by grep prior to commit)
- ✓ Full vitest suite passes (355/355)
- ✓ `tsc --noEmit` exits 0
- ✓ SEG-05 protected paths byte-identical (0-line diff)
