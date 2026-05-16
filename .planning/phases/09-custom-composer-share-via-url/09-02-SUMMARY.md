---
phase: 09-custom-composer-share-via-url
plan: 02
subsystem: lib-composer-state
tags: [reducer, composer-state, pure-lib, validation, tdd, zero-react-deps, first-useReducer]

# Dependency graph
requires:
  - phase: 07-segment-engine-triangle-sound
    provides: Segment + SegmentConfig types (READ ONLY — SEG-05 frozen), WAKE_EASY_CONFIG (load-action test fixture)
provides:
  - composerReducer(state, action): SegmentConfig — pure function, zero React imports, 6-action union
  - ComposerAction type — discriminated union `load | add | duplicate | delete | update_duration | update_sound`
  - rowIsValid(seg): boolean — per-row validator mirroring engine rules but row-local for D-11 inline UI feedback
  - rowValidityArray(config): boolean[] — aligned per-segment validity vector for disabled-Start state
  - MAX_SEGMENTS=32 cap (mirrors shareUrl.ts D-17) — enforced at reducer level on add + duplicate
affects:
  - 09-04 Composer.tsx — calls useReducer(composerReducer, initialConfig, lazyInit) for the modal's state machine; calls rowValidityArray() for per-row red borders + Start-disabled gate
  - 09-07 useHashComposition — produces SegmentConfig that flows into composerReducer via {type:'load', config}

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "First useReducer in the codebase (NEW pattern per 09-PATTERNS.md:23-29) — pure-function reducer with zero React imports, unit-testable in isolation without RTL or jsdom mounting"
    - "Reference-equality immutability proof — tests assert `result.segments[i].toBe(state.segments[i])` for untouched rows and `result.toBe(state)` for no-op actions; spread/map/filter discipline keeps un-edited rows ref-equal for React.memo downstream"
    - "Belt-and-suspenders D-12 guard — reducer-level `if (length <= 1) return state` mirrors the UI's disabled Delete button; survives any future UI regression that re-enables Delete on a single-row state"
    - "MAX_SEGMENTS cap mirror — 32 cap matches shareUrl.ts D-17 so any decoded share URL that fits the cap also fits the composer (composer can never reject a valid share URL on size)"
    - "Inline duplicated-constant pattern for 14_400_000 ms ceiling — SegmentState.ts is SEG-05 frozen, so composerValidation duplicates the constant with a docstring contract that both must change together (09-PATTERNS.md:431)"

key-files:
  created:
    - src/lib/composerReducer.ts (89 lines)
    - src/lib/composerValidation.ts (32 lines)
    - src/lib/__tests__/composerReducer.test.ts (179 lines, 16 tests)
    - src/lib/__tests__/composerValidation.test.ts (118 lines, 16 tests)
  modified: []

key-decisions:
  - "TDD gate sequence: test() RED commit 86638e6 (vite resolve-import failure on both impl files) followed by feat() GREEN commit 10fff2f (32/32 passing) — consistent with 09-01's pattern (d5b713c → 77676b6); the canonical Phase 9 pure-lib rhythm"
  - "Reducer collapses Task 1 (impl) + Task 2 (tests) into a single atomic TDD pair — wrote tests first to drive RED, then impl files to drive GREEN, satisfying plan-level acceptance criteria for both tasks in one cycle"
  - "ID generation strategy: `composer-${Date.now()}-${++nextId}` (timestamp + monotonic counter) avoids both Date.now() collisions within the same millisecond AND a UUID dependency — uniqueness within a composer session is sufficient since IDs are opaque to the engine (Phase 7 D-18)"
  - "load action regenerates ALL ids on every dispatch — guarantees React keys are stable even if the same shared URL is re-decoded (e.g., share-then-paste-into-same-tab); the input config's ids are treated as throwaway labels"
  - "No-op actions return the original state reference (`return state`, not `return { ...state }`) — pinned by tests so React's reducer-bail-out optimisation actually triggers and avoids needless re-render"

patterns-established:
  - "useReducer + pure reducer at src/lib/<feature>Reducer.ts — first instance in the codebase; future state-machine features (Phase 10+) should follow this layout"
  - "Per-row validity helpers at src/lib/<feature>Validation.ts — paired with reducer for inline UI feedback; mirrors but does not replace the engine validator (single source of truth at engine layer + per-row helper at lib layer)"
  - "Reference-equality test idiom: `expect(result).toBe(state)` for no-op assertions, `expect(result.segments[i]).toBe(state.segments[i])` for untouched-row assertions — proves immutability without diffing JSON"

requirements-completed: [COMP-04, COMP-05]

# Metrics
duration: 3m 37s
completed: 2026-05-16
---

# Phase 9 Plan 2: composerReducer + composerValidation Summary

**Pure-TS composer state layer ships at `src/lib/composerReducer.ts` (first useReducer in the codebase) + `src/lib/composerValidation.ts` (per-row validity helpers). 6-action discriminated union (load | add | duplicate | delete | update_duration | update_sound) with D-12 last-segment guard + MAX_SEGMENTS=32 cap mirroring shareUrl.ts D-17. Reference-equality tests prove immutability: 32/32 new tests passing, full suite 444/444 across 35 files, tsc clean, SEG-05 zero-diff floor preserved.**

## Performance

- **Duration:** 3m 37s
- **Files Created:** 4 (2 source + 2 test)
- **Files Modified:** 0
- **Lines Added:** ~418 (89 reducer + 32 validation + 179 reducer.test + 118 validation.test)

## Decisions Made

| Decision | Reasoning |
|----------|-----------|
| Wrote tests FIRST (Task 2 before Task 1 order) | Standard TDD discipline — RED commit must show genuine failure (vite resolve-import error on missing source files); plan-level gate sequence enforcement requires `test()` before `feat()` |
| `composer-${Date.now()}-${counter}` id format | Composes timestamp + monotonic counter; avoids Date.now() ms-collision (multiple ids in same tick would otherwise collide) and avoids UUID lib; engine treats ids as opaque per Phase 7 D-18 |
| No-op actions return `state` reference (not `{...state}`) | Triggers React's useReducer bail-out optimisation; pinned by `expect(result).toBe(state)` reference-equality tests for MAX_SEGMENTS cap + D-12 single-segment guard + out-of-range duplicate |
| 14_400_000 ceiling duplicated inline in composerValidation.ts | SegmentState.ts is SEG-05 frozen (Phase 7 deliverable freeze); duplicated constant with explicit docstring contract that both must change together (09-PATTERNS.md:431) |
| `VALID_SOUND_KEYS` as `ReadonlyArray<Segment['endSound']>` | Type-derived array (not a `Set<string>`) keeps the validator's allow-list synchronised with the Segment type union — adding a fourth endSound key in Segment forces a compile-time update here |
| load action regenerates ALL ids | Guarantees React keys are stable across re-decodes of the same shared URL (e.g., share-link clicked twice) — input ids treated as throwaway labels |
| ComposerAction union ordered `load|add|duplicate|delete|update_duration|update_sound` | Lifecycle-then-edit grouping (load first as the entry point, then growth ops, then shrink op, then row mutations) — reads as a state-machine narrative |

## Deviations from Plan

None — plan executed exactly as written, with the canonical TDD swap (tests-first to drive the RED commit, impl second for GREEN). All acceptance criteria for both Task 1 and Task 2 satisfied in the same RED/GREEN cycle. No Rule 1/2/3 auto-fixes triggered; no Rule 4 architectural questions arose.

## ComposerAction API Surface

```ts
export type ComposerAction =
  | { type: 'load'; config: SegmentConfig }
  | { type: 'add' }
  | { type: 'duplicate'; index: number }
  | { type: 'delete'; index: number }
  | { type: 'update_duration'; index: number; durationMs: number }
  | { type: 'update_sound'; index: number; endSound: Segment['endSound'] };

export function composerReducer(state: SegmentConfig, action: ComposerAction): SegmentConfig;
```

| Action | Behaviour | Reference equality | Cap / Guard |
|--------|-----------|--------------------|-------------|
| `load` | Replace state from config; regenerate all ids | New top-level + all-new segment refs | None |
| `add` | Append `{durationMs: 60_000, endSound: 'gentle'}` at end | New top-level; existing rows ref-equal | `length >= 32` → no-op (ref-equal state) |
| `duplicate` | Clone segment[index] at index+1 with fresh id | New top-level; existing rows ref-equal | `length >= 32` OR out-of-range → no-op (ref-equal state) |
| `delete` | Remove segment at index | New top-level; surviving rows ref-equal | `length <= 1` → no-op (ref-equal state) — D-12 last-segment guard |
| `update_duration` | Replace only segment[index].durationMs | New top-level; other rows ref-equal | None |
| `update_sound` | Replace only segment[index].endSound | New top-level; other rows ref-equal | None |

## Validation API Surface

```ts
export function rowIsValid(seg: Segment): boolean;
export function rowValidityArray(config: SegmentConfig): boolean[];
```

Rules (mirrors `validateSegmentConfig` per-segment checks at `src/engine/SegmentState.ts:67-91`, row-local):
- `durationMs` MUST be a finite number
- `0 < durationMs <= 14_400_000`
- `endSound ∈ {'gentle', 'triangle', 'alarm'}`

`rowValidityArray` returns a boolean[] aligned 1:1 with `config.segments` — used by Composer.tsx to drive per-row red borders (D-11) and gate the Start button on `every(Boolean)`.

## Test Coverage

| File | Tests | Coverage focus |
|------|-------|----------------|
| `composerReducer.test.ts` | 16 | Each of 6 actions covered; MAX_SEGMENTS=32 cap on add + duplicate; D-12 last-segment delete guard; out-of-range duplicate guard; reference-equality on no-ops AND on untouched rows; id-regeneration on load; never-throws contract across 7 action variants; new-top-level-ref on mutating actions |
| `composerValidation.test.ts` | 16 | 3 happy-path endSound keys; 0/-1/NaN/+Infinity/-Infinity/non-number durations rejected; 14_400_000 boundary accepted, 14_400_001 rejected; unknown + empty-string endSound rejected; rowValidityArray alignment with 3-row mixed config + empty config + all-valid config |
| **Total** | **32** | **All 6 actions + 11 invalid-input variants + MAX_SEGMENTS + D-12 + ref-equality** |

## Reference-Equality (Immutability) Verification

The reducer is provably non-mutating because the test suite pins both directions of reference equality:

1. **No-op actions return `state` itself** (proven by `expect(result).toBe(state)`):
   - `add` at MAX_SEGMENTS cap
   - `duplicate` at MAX_SEGMENTS cap
   - `duplicate` with out-of-range index
   - `delete` with length===1 (D-12 guard)

2. **Mutating actions return a NEW top-level reference but keep untouched rows ref-equal** (proven by `expect(result.segments[i]).toBe(state.segments[i])`):
   - `update_duration` index=1 → segments[0] + segments[2] ref-equal, segments[1] is new
   - `update_sound` index=0 → segments[1] ref-equal, segments[0] is new
   - `delete` index=1 → segments[0] + segments[2] surface intact at new positions [0]+[1] both ref-equal
   - `add` → all original segments ref-equal at original indices
   - `duplicate` index=0 → original segments[0] ref-equal at [0], original segments[1] ref-equal at [2]

This dual pinning rules out the two failure modes of useReducer mutation:
- Forgetting to copy on write (would break #1 — equal state from a mutating action would defeat React's bail-out)
- Deep-cloning when you don't need to (would break #2 — needless `{...row}` would defeat React.memo on row components)

## SEG-05 Floor Compliance

| Protected path | Status |
|----------------|--------|
| `src/engine/SegmentState.ts` | UNTOUCHED (`git diff --quiet` exits 0) |
| All other engine, hook, and component files | UNTOUCHED |

This plan creates 4 NEW files only — no modifications to any existing source file. SEG-05 byte-identical floor preserved across the full 26-path protected set.

## TDD Gate Compliance

- **RED commit** `86638e6` (`test(09-02)`): both test files fail with `Failed to resolve import "../composerReducer"` / `Failed to resolve import "../composerValidation"` — genuine missing-module failure, not a stub-passing test
- **GREEN commit** `10fff2f` (`feat(09-02)`): impl files created; 32/32 new tests pass; full suite 444/444 across 35 files; tsc --noEmit clean
- **No REFACTOR commit** — impl shipped clean on first GREEN; no cleanup required

## Self-Check: PASSED

- `src/lib/composerReducer.ts`: FOUND
- `src/lib/composerValidation.ts`: FOUND
- `src/lib/__tests__/composerReducer.test.ts`: FOUND
- `src/lib/__tests__/composerValidation.test.ts`: FOUND
- Commit `86638e6` (RED): FOUND
- Commit `10fff2f` (GREEN): FOUND
- `src/engine/SegmentState.ts` UNTOUCHED: VERIFIED (`git diff --quiet` exits 0)
- Full test suite: 444/444 passing across 35 files
- `npx tsc --noEmit`: exits 0
