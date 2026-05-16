---
phase: 09-custom-composer-share-via-url
plan: 05
subsystem: components/forms
tags: [sound-picker, radiogroup, aria, roving-tabindex, segmented-control, tdd]
requirements: [COMP-03]
dependency-graph:
  requires:
    - src/engine/SegmentState.ts (READ-ONLY — Segment['endSound'] type union)
  provides:
    - "SoundPicker: 3-pill ARIA radiogroup with roving tabindex + ArrowLeft/Right wrap for SegmentRow consumption"
  affects:
    - "Wave-3 SegmentRow will mount SoundPicker for per-row endSound editing"
tech-stack:
  added: []
  patterns:
    - "First ARIA radiogroup in the codebase — role='radiogroup' + 3 × role='radio' buttons"
    - "First roving tabindex implementation — exactly one button has tabIndex=0 (the selected one); arrow keys move focus via refs.current[i]?.focus()"
    - "First color-mix(in srgb, var(--pill-tint) N%, transparent) usage — per-pill --pill-tint CSS variable injected via inline style drives hover/focus preview"
key-files:
  created:
    - src/components/SoundPicker.tsx
    - src/components/__tests__/SoundPicker.test.tsx
  modified: []
decisions:
  - "[Phase 09 P05]: D-06 label divergence preserved — picker uses 'Alarm' (calmer for composer form context) while SegmentCountdown.SOUND_LABELS keeps 'Wake' for the running-alarm screen. NOT consolidated by design. Verified via explicit test 'does NOT render Wake' and SegmentCountdown.tsx byte-identical hash check."
  - "[Phase 09 P05]: Selected sand pill uses text-text-primary (NOT text-white) — sand is a light warm tone and white text would fail contrast per UI-SPEC L165-170. Dedicated contrast test pins this."
  - "[Phase 09 P05]: TDD gate sequence honored — test() RED commit 3a28936 (vite import resolution failure) → feat() GREEN commit 0cf6c84 (23/23 passing). Full suite 500/500 across 39 files."
metrics:
  duration: "2m 54s"
  completed: 2026-05-16
---

# Phase 9 Plan 05: SoundPicker Summary

**One-liner:** First ARIA radiogroup in the codebase — 3-pill segmented control ('Gentle | Triangle | Alarm') with MDN-canonical roving tabindex, ArrowLeft/Right wrap-around (D-07 LOCKED), per-pill selected color contract (sage / sand / accent), and the D-06 LOCKED 'Alarm'-not-'Wake' label divergence from SegmentCountdown preserved as designed.

---

## Verbatim PILL_OPTIONS Array

```typescript
const PILL_OPTIONS: ReadonlyArray<{ value: SoundKey; label: string; tint: string }> = [
  { value: 'gentle',   label: 'Gentle',   tint: 'var(--color-sage)'   },
  { value: 'triangle', label: 'Triangle', tint: 'var(--color-sand)'   },
  { value: 'alarm',    label: 'Alarm',    tint: 'var(--color-accent)' },
];
```

Fixed order — gentle → triangle → alarm. `tint` is injected per-pill as a CSS variable `--pill-tint` via inline style so the unselected hover/focus class string `bg-[color-mix(in_srgb,var(--pill-tint)_10%,transparent)]` resolves to the correct color for each pill at runtime.

## Selected-Class Color Contract (D-04 LOCKED)

```typescript
function selectedClass(sound: SoundKey): string {
  if (sound === 'gentle')   return 'bg-sage text-white font-semibold';
  if (sound === 'triangle') return 'bg-sand text-text-primary font-semibold'; // light sand needs dark text
  return 'bg-accent text-white font-semibold';
}
```

| endSound | Background  | Text              | Rationale                                            |
| -------- | ----------- | ----------------- | ---------------------------------------------------- |
| gentle   | `bg-sage`   | `text-white`      | Sage is mid-tone — white reads well                  |
| triangle | `bg-sand`   | `text-text-primary` | Sand is light warm tone — white would fail contrast (UI-SPEC L165-170) |
| alarm    | `bg-accent` | `text-white`      | Terracotta is saturated — white reads well           |

## Roving Tabindex Implementation

```tsx
tabIndex={i === currentIdx ? 0 : -1}
```

Exactly one pill is tab-focusable at any moment (the selected one). Arrow keys move both focus and selection:

```tsx
function handlePickerKeyDown(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    const next = (idx + 1) % PILL_OPTIONS.length;
    onChange(PILL_OPTIONS[next].value);
    refs.current[next]?.focus();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    const prev = (idx - 1 + PILL_OPTIONS.length) % PILL_OPTIONS.length;
    onChange(PILL_OPTIONS[prev].value);
    refs.current[prev]?.focus();
  }
}
```

The modulo-3 math wraps `ArrowRight` from alarm → gentle (index 2 → 0) and `ArrowLeft` from gentle → alarm (index 0 → 2). `Enter` / `Space` is implicit on `<button>` — no separate keyboard branch needed.

## Test Count

**23 tests** across 7 describe blocks, all passing:

| Block                       | Tests | Coverage                                                                                 |
| --------------------------- | ----- | ---------------------------------------------------------------------------------------- |
| rendering                   | 5     | 3 pill labels, `Wake` NOT rendered, radiogroup + aria-label, 3 radio buttons, rowIndex aria-label |
| selection state             | 4     | aria-checked=true on selected, aria-checked=false on others, color contract for all 3, sand text contrast |
| roving tabindex             | 2     | tabIndex=0 on selected + tabIndex=-1 on others, exactly-one-tabbable invariant across all 3 values |
| click selection             | 3     | unselected → onChange, idempotent click on selected, alarm pill click                    |
| keyboard map                | 7     | ArrowRight from gentle, ArrowRight wraps alarm→gentle, ArrowLeft wraps gentle→alarm, ArrowLeft from triangle, ArrowDown mirrors Right, ArrowUp mirrors Left, e.preventDefault |
| touch target                | 1     | min-h-[44px] on all 3 pills                                                              |
| className passthrough       | 1     | className prop applies to radiogroup container                                           |

Full suite: **500/500 passing across 39 test files** (up from 477 — net +23). `npx tsc --noEmit` clean.

## D-06 Divergence — 'Wake' Does NOT Appear in SoundPicker

Verified directly by test at `src/components/__tests__/SoundPicker.test.tsx:29-32`:

```tsx
it('does NOT render "Wake" (D-06 — Wake is reserved for SegmentCountdown phase label)', () => {
  render(<SoundPicker value="alarm" onChange={vi.fn()} />);
  expect(screen.queryByText('Wake')).toBeNull();
});
```

Additionally, `grep -c "Wake" src/components/SoundPicker.tsx` returns **0** — the label literal does not appear anywhere in the component source or its PILL_OPTIONS array.

## SegmentCountdown.tsx Byte-Identical

Verified via `git hash-object`:

| Path                                    | Baseline (commit dcbd9f2)                | Post-plan-05 (commit 0cf6c84)             | Status              |
| --------------------------------------- | ---------------------------------------- | ----------------------------------------- | ------------------- |
| `src/components/SegmentCountdown.tsx`   | b07fc294efa01a1bcc71b347dd2f79ddda4f5e32 | b07fc294efa01a1bcc71b347dd2f79ddda4f5e32  | byte-identical      |
| `src/engine/SegmentState.ts`            | 997cf61f0d87bb0de94987a4648d1fc0ccf54490 | 997cf61f0d87bb0de94987a4648d1fc0ccf54490  | byte-identical      |

Additionally, `git diff --quiet src/components/SegmentCountdown.tsx` exits **0**. SegmentCountdown's `SOUND_LABELS` map at lines 30-35 (which uses 'Wake' for the running-alarm screen) remains untouched per D-06 LOCKED. The two label maps (picker 'Alarm' vs. countdown 'Wake') stay independent by design.

## SEG-05 Zero-Diff Floor

No v1-protected path nor Phase 7/8 deliverable was modified. Working-tree diff was strictly:

- `src/components/SoundPicker.tsx` (NEW, 110 lines)
- `src/components/__tests__/SoundPicker.test.tsx` (NEW, 211 lines)

Zero modifications across all 26 protected paths.

## Deviations from Plan

None — plan executed exactly as written. The verbatim implementation from PLAN line 116-225 was applied with two minor tightenings:

1. Imported `KeyboardEvent` as a type-only import (`import type { KeyboardEvent } from 'react'`) for tsc strictness — matches the pattern established by StepperInput.tsx:37.
2. Added a 7th describe block (`className passthrough`) with 1 test covering the `className` prop forwarding to the radiogroup container — needed for Wave-3 SegmentRow to apply `max-[480px]:col-span-3` per UI-SPEC.

Both adjustments were within the spirit of the plan and required no plan changes.

## Commits

| Commit  | Type | Message                                                                          |
| ------- | ---- | -------------------------------------------------------------------------------- |
| 3a28936 | test | test(09-05): add failing tests for SoundPicker radiogroup + roving tabindex      |
| 0cf6c84 | feat | feat(09-05): implement SoundPicker 3-pill ARIA radiogroup with roving tabindex   |

## TDD Gate Compliance

- **RED gate:** commit 3a28936 — `vitest run` reports `Failed to resolve import "../SoundPicker"` (module does not exist). RED confirmed before any implementation.
- **GREEN gate:** commit 0cf6c84 — 23/23 tests pass; full suite 500/500; tsc --noEmit clean.
- **REFACTOR gate:** not invoked (initial implementation already met all assertions on first GREEN run; no cleanup pass needed).

## Self-Check: PASSED

- FOUND: src/components/SoundPicker.tsx
- FOUND: src/components/__tests__/SoundPicker.test.tsx
- FOUND commit: 3a28936
- FOUND commit: 0cf6c84
- FOUND: SegmentCountdown.tsx byte-identical (hash b07fc29... unchanged)
- FOUND: SegmentState.ts byte-identical (hash 997cf61... unchanged)
- FOUND: 23/23 SoundPicker tests pass; full suite 500/500; tsc clean
