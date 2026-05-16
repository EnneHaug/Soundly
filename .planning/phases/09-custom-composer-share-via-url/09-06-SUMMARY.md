---
phase: 09-custom-composer-share-via-url
plan: 06
subsystem: ui
tags: [segment-row, composition, css-grid, responsive, aria-invalid, react]

requires:
  - phase: 09-custom-composer-share-via-url
    plan: 04
    provides: StepperInput component (adaptive step duration input, D-01/D-02 locked)
  - phase: 09-custom-composer-share-via-url
    plan: 05
    provides: SoundPicker component (3-pill ARIA radiogroup, roving tabindex, D-04/D-06/D-07 locked)
  - phase: 09-custom-composer-share-via-url
    plan: 02
    provides: composerReducer (owns add/duplicate/delete/update_duration/update_sound mutations)
provides:
  - SegmentRow.tsx — composite editable row arranging StepperInput + SoundPicker + Duplicate (⧉) + Delete (×) in CSS Grid
  - D-11 LOCKED invalid-row accent border + aria-invalid propagation to StepperInput
  - D-12 LOCKED last-segment Delete guard (UI layer; reducer enforces same at action layer)
  - Per-row aria-label "Segment N sound" (1-indexed) on SoundPicker via rowIndex prop
affects: [09-07-Composer, 09-08-CustomCard-wire, 09-09-share-integration]

tech-stack:
  added: []
  patterns:
    - "Pattern 10 (Composite Row): A higher-order component composes lower-order primitives (StepperInput + SoundPicker + icon buttons) into a single layout-owning element. Parent passes raw segment + callbacks; SegmentRow owns NO state — it's a pure projection of props onto JSX."
    - "Two-layer last-segment guard (D-12): UI disables the Delete button + composerReducer rejects 'delete' actions when segments.length <= 1. Belt-and-suspenders pattern from Phase 7 (validateSegmentConfig + engine.start gate) — never trust a single layer to enforce an invariant that touches data."
    - "max-[480px]:col-span-3 cross-component layout: parent declares the grid shape; the child (SoundPicker) receives the grid-area class through its className prop. Avoids tight coupling — SoundPicker doesn't know it's inside a grid, it just forwards className."

key-files:
  created:
    - src/components/SegmentRow.tsx
    - src/components/__tests__/SegmentRow.test.tsx
  modified: []

key-decisions:
  - "Followed plan as written — no deviations. The plan's verbatim grid layout, glyph choices (⧉/×), and tooltip strings are all reproduced byte-identically from UI-SPEC L354-391 + L278-281 + 09-CONTEXT.md D-11/D-12."
  - "Native disabled attribute is the only Delete guard at the SegmentRow layer — no defensive onClick check. React's synthetic event respects disabled before firing handlers, and a dedicated test ('Delete click is suppressed natively when disabled') pins this contract. Mirrors SegmentCountdown.tsx:135-141 (Phase 8 Pause-button idiom)."
  - "Used React.ComponentProps<typeof SegmentRow> in the test's makeProps fixture builder rather than re-typing SegmentRowProps locally. The interface is not exported from SegmentRow.tsx (single default export), so this is the canonical way to pull the props type from a closed interface without breaking encapsulation."

patterns-established:
  - "TDD gate sequence for composite-row plans: test() RED → feat() GREEN, with the RED commit verified via vite import resolution failure on the new component path. No REFACTOR phase needed when the implementation is a literal projection of the spec."
  - "ComponentProps<typeof X> instead of exporting Props interface for fixture builders — keeps the public API surface minimal."

requirements-completed: [COMP-03, COMP-05]

duration: 2m 51s
completed: 2026-05-16
---

# Phase 09 Plan 06: SegmentRow Summary

**Composite editable segment row — StepperInput + SoundPicker + Duplicate (⧉) + Delete (×) in CSS Grid with D-11 invalid border, D-12 last-segment delete guard, and per-row aria-label.**

## Performance

- **Duration:** 2 min 51 s (start 2026-05-16T13:27:54Z → end 2026-05-16T13:30:45Z)
- **Started:** 2026-05-16T13:27:54Z
- **Completed:** 2026-05-16T13:30:45Z
- **Tasks:** 2 (both TDD: test → feat)
- **Files modified:** 2 (both new)

## Accomplishments

- `SegmentRow.tsx` (105 lines) composes 4 children in the verbatim UI-SPEC L354-391 CSS Grid: `grid-cols-[auto_1fr_auto_auto]` desktop, `max-[480px]:grid-cols-[1fr_auto_auto] max-[480px]:grid-rows-[auto_auto]` mobile (SoundPicker wraps under stepper+icons via `max-[480px]:col-span-3`).
- D-11 LOCKED invalid-row contract implemented: `isInvalid` prop appends `border border-accent/50 rounded-lg` to the row class string AND propagates `aria-invalid={isInvalid}` to StepperInput per UI-SPEC L411.
- D-12 LOCKED last-segment guard: Delete button receives `disabled={isOnlyRow}` + `title={isOnlyRow ? 'At least one segment required' : undefined}`. Native disabled attribute suppresses the synthetic click event before the handler fires.
- Per-row aria-label (T-09-06-02 mitigation): `rowIndex={index}` flows through SoundPicker so each row's radiogroup announces as "Segment N sound" (1-indexed) for screen-reader disambiguation.
- 25-test TDD regression net at `src/components/__tests__/SegmentRow.test.tsx` across 8 describe blocks: rendering, invalid border (D-11), last-segment guard (D-12), callback wiring, sound picker per-row aria-label, visible glyphs, 44 px touch targets, and segment prop wiring through children.

## SegmentRow signature (8 props)

```typescript
interface SegmentRowProps {
  segment: Segment;                                  // { id, durationMs, endSound }
  index: number;                                      // 0-based; +1 for aria-label
  isOnlyRow: boolean;                                 // D-12: disables Delete when last
  isInvalid: boolean;                                 // D-11: accent border + aria-invalid
  onDurationChange: (ms: number) => void;             // StepperInput onChange passthrough
  onSoundChange: (s: Segment['endSound']) => void;    // SoundPicker onChange passthrough
  onDuplicate: () => void;                            // COMP-05; parent reducer handles splice
  onDelete: () => void;                               // parent reducer handles array removal
}
```

## Verbatim grid class strings

**Desktop + base (always applied):**
```
'grid gap-4 px-6 py-4 border-b border-border ' +
'grid-cols-[auto_1fr_auto_auto] ' +
'max-[480px]:grid-cols-[1fr_auto_auto] ' +
'max-[480px]:grid-rows-[auto_auto] ' +
'transition-colors duration-200'
```

**Invalid suffix (appended when `isInvalid={true}`):**
```
' border border-accent/50 rounded-lg'
```

**SoundPicker mobile-row wrap (passed via className prop):**
```
'max-[480px]:col-span-3'
```

## Task Commits

Each task was committed atomically (TDD gate sequence preserved):

1. **Task 2 RED (test file):** `c492887` (test) — 23 failing tests; vite resolve-import failure on '../SegmentRow' confirms no implementation present
2. **Task 1 GREEN (component):** `3fff074` (feat) — implementation; 25/25 passing (test count grew by 2 during write — added "title cleared when isOnlyRow={false}" and "aria-invalid not set when isInvalid={false}" as belt-and-suspenders defensive contracts)

*No REFACTOR commit needed — implementation is a literal projection of the UI-SPEC + interface contracts; no cleanup opportunity surfaced.*

**Plan metadata commit:** (added after this SUMMARY is created)

## Files Created/Modified

- `src/components/SegmentRow.tsx` (105 lines) — Composite row: StepperInput + SoundPicker + ⧉ + × in CSS Grid; D-11 invalid border; D-12 last-segment Delete guard.
- `src/components/__tests__/SegmentRow.test.tsx` (220 lines) — 25 tests across 8 describe blocks.

## Wave-2 deliverables — byte-identical guardrail

Both Plan 09-04 (StepperInput) and Plan 09-05 (SoundPicker) deliverables remained **byte-identical** through this plan's execution. Verified by `git diff --quiet src/components/StepperInput.tsx src/components/SoundPicker.tsx` exiting 0. No protected-path violations.

## Decisions Made

None beyond plan-text — the plan was specific enough (verbatim class strings + verbatim glyphs + verbatim aria-labels + verbatim tooltip) that no discretionary calls surfaced. The two test additions beyond the plan's example test suite (aria-invalid-not-set + title-cleared) are belt-and-suspenders contracts pinning the negative case, not novel decisions.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - both RED and GREEN gates passed on first run.

## TDD Gate Compliance

| Gate | Commit | Verification |
|------|--------|--------------|
| RED | c492887 (test) | Vite import-resolution failure on '../SegmentRow' (expected — file did not exist) |
| GREEN | 3fff074 (feat) | 25/25 tests pass; full suite 525/525; tsc --noEmit clean |
| REFACTOR | — | Not needed; implementation is minimal projection of spec |

## Threat Mitigations Applied

| Threat | Mitigation |
|--------|------------|
| T-09-06-01 (Tampering — Delete bypasses D-12) | UI disables button (this plan) + composerReducer rejects when length <= 1 (Plan 09-02) |
| T-09-06-02 (Spoofing — wrong row announced) | Per-row aria-label "Segment N sound" via rowIndex prop (this plan) |
| T-09-06-03 (Info Disclosure — invalid state in DOM) | Accepted — visible accent border IS the user-facing affordance |
| T-09-06-04 (DoS — Duplicate past MAX_SEGMENTS) | composerReducer enforces 32-segment cap (Plan 09-02 T-09-02-02); SegmentRow only invokes callback |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 09-07 (Composer modal):** SegmentRow is now mountable in a `.map()` over `composerState.segments` inside the Composer modal scaffolding. Each row gets `key={segment.id}` for React reconciliation across add/duplicate/delete actions; the row's callbacks dispatch the corresponding composerReducer actions.
- **Plan 09-08 (CustomCard wiring):** Independent — no dependency on SegmentRow.
- **No blockers.** Wave-2 dependencies (09-04, 09-05) consumed unmodified. Wave-3 deliverable (this plan) shipped on first attempt.

## Self-Check: PASSED

- FOUND: `src/components/SegmentRow.tsx`
- FOUND: `src/components/__tests__/SegmentRow.test.tsx`
- FOUND: commit c492887 (test RED)
- FOUND: commit 3fff074 (feat GREEN)
- FOUND: 525/525 tests passing across 40 test files
- FOUND: tsc --noEmit exits 0
- FOUND: git diff --quiet on StepperInput.tsx + SoundPicker.tsx (Wave-2 deliverables byte-identical)

---
*Phase: 09-custom-composer-share-via-url*
*Completed: 2026-05-16*
