---
phase: 09-custom-composer-share-via-url
plan: 04
subsystem: components/forms
tags: [stepper, form-control, keyboard, aria-spinbutton, adaptive-step, tdd]
requirements: [COMP-03]
dependency-graph:
  requires:
    - src/utils/formatTime.ts (READ-ONLY — formatMmSs reuse)
  provides:
    - "StepperInput: number stepper with adaptive step + keyboard + clamps for SegmentRow consumption"
  affects:
    - "Wave-3 SegmentRow will mount StepperInput for per-row duration editing"
tech-stack:
  added: []
  patterns:
    - "First number stepper in the codebase — adaptive step granularity locked by D-01"
    - "First role='spinbutton' usage — applied as discretionary fallback (PLAN line 234) because <input type='number'> refuses mm:ss-formatted values"
    - "inputMode='none' + readOnly on text input suppresses mobile soft keyboard while +/− buttons and arrow keys drive mutation"
key-files:
  created:
    - src/components/StepperInput.tsx
    - src/components/__tests__/StepperInput.test.tsx
  modified: []
decisions:
  - "[Phase 09 P04]: <input type='text' role='spinbutton'> fallback applied (PLAN-documented discretionary path) — type='number' refuses to render mm:ss-formatted values, breaking the SR readout. aria-valuemin/max/now (raw ms) + aria-valuetext (mm:ss) preserve the spinbutton SR contract."
  - "[Phase 09 P04]: D-01 boundary case implemented as `decreaseStep(currentMs)` — explicit `currentMs === SMALL_STEP_THRESHOLD_MS → LARGE_STEP_MS` branch ensures '−' at exactly 5:00 drops by 1 min to 4:00, asymmetric with '+' which goes 5:00→6:00 by 1 min. Pitfall 7 test guards this."
  - "[Phase 09 P04]: TDD gate sequence honored — test() RED commit 16707f8 (import fails to resolve) → feat() GREEN commit b7052bf (23/23 passing)."
metrics:
  duration: "4m 16s"
  completed: 2026-05-16
---

# Phase 9 Plan 04: StepperInput Summary

**One-liner:** First number stepper in the codebase — adaptive step granularity (30s below 5:00, 1min at/above with boundary-case asymmetry on `−`), full keyboard map (Arrow / Shift+Arrow / PageUp/Down), 5s/60min clamps, and an `<input role="spinbutton">` fallback that preserves the SR contract that `<input type="number">` would have provided.

---

## Verbatim Implementation — Adaptive Step Constants + Boundary Case

```typescript
// D-01 LOCKED adaptive step constants
const SMALL_STEP_THRESHOLD_MS = 300_000; // 5:00 boundary
const SMALL_STEP_MS = 30_000; // 30 s — below threshold
const LARGE_STEP_MS = 60_000; // 1 min — at or above threshold

// D-02 LOCKED keyboard + clamp constants
const SHIFT_STEP_MS = 300_000; // 5 min — Shift+Arrow + PageUp/Down
const DEFAULT_MIN = 5_000; // 5 s floor (D-02 + SEG-04 validator)
const DEFAULT_MAX = 3_600_000; // 60 min ceiling

function stepFor(currentMs: number): number {
  return currentMs >= SMALL_STEP_THRESHOLD_MS ? LARGE_STEP_MS : SMALL_STEP_MS;
}

// D-01 boundary case: at exactly 5:00, "−" steps down by LARGE (1 min → 4:00),
// NOT SMALL (30s → 4:30). Asymmetric with stepFor() by design.
function decreaseStep(currentMs: number): number {
  if (currentMs > SMALL_STEP_THRESHOLD_MS) return LARGE_STEP_MS;
  if (currentMs === SMALL_STEP_THRESHOLD_MS) return LARGE_STEP_MS;
  return SMALL_STEP_MS;
}
```

**Asymmetry verified by tests:**
| Action | At valueMs | Result | Step taken |
|--------|------------|--------|------------|
| `+`   | 300_000 (5:00) | 360_000 (6:00) | LARGE (1 min) |
| `−`   | 300_000 (5:00) | 240_000 (4:00) | LARGE (1 min) — **boundary case, NOT 30s** |
| `−`   | 240_000 (4:00) | 210_000 (3:30) | SMALL (30s) |
| `+`   | 60_000 (1:00)  | 90_000 (1:30)  | SMALL (30s) |
| `−`   | 360_000 (6:00) | 300_000 (5:00) | LARGE (1 min) |

---

## Keyboard Map Coverage

All 6 D-02 LOCKED keys exercised; `e.preventDefault()` on Arrow keys to suppress page scroll:

| Key combo            | Step       | Test |
|----------------------|------------|------|
| `ArrowUp`            | adaptive (stepFor) | `ArrowUp at 1 min advances by 30s` |
| `ArrowDown`          | adaptive (decreaseStep) | `ArrowDown at 4 min drops by 30s` + `at exactly 5:00 drops by 1 min` |
| `Shift+ArrowUp`      | 5 min (SHIFT_STEP_MS) | `Shift+ArrowUp at 1 min advances by 5 min` |
| `Shift+ArrowDown`    | 5 min (SHIFT_STEP_MS) | `Shift+ArrowDown at 10 min drops by 5 min` |
| `PageUp`             | 5 min (SHIFT_STEP_MS) | `PageUp at 1 min advances by 5 min` |
| `PageDown`           | 5 min (SHIFT_STEP_MS) | `PageDown at 10 min drops by 5 min` |
| (any Arrow / PageUp/Down) | — | `Arrow keys are e.preventDefault'd to suppress page scroll` (via direct dispatchEvent + `defaultPrevented` check) |

---

## ARIA Attributes Exposed

| Element | Attribute | Value | Source |
|---------|-----------|-------|--------|
| `−` button | `aria-label` | `"Decrease duration"` | UI-SPEC L272 |
| `+` button | `aria-label` | `"Increase duration"` | UI-SPEC L273 |
| input | `aria-label` | `"Segment duration"` | UI-SPEC L275 |
| input | `role` | `"spinbutton"` | Fallback (see below) |
| input | `aria-valuemin` | `{minMs}` (5_000 default) | Fallback (raw ms — semantic; aria-valuetext provides human readout) |
| input | `aria-valuemax` | `{maxMs}` (3_600_000 default) | Fallback |
| input | `aria-valuenow` | `{valueMs}` | Fallback |
| input | `aria-valuetext` | `formatMmSs(valueMs)` (e.g. `"04:00"`) | UI-SPEC L411 + T-09-04-03 mitigation |
| input | `aria-invalid` | `{ariaInvalid}` (propagated from parent) | UI-SPEC L411 |

---

## Input Element Choice — type="text" + role="spinbutton" fallback

**Plan asked:** Whether the input remained `type="number"` or fell back to `type="text"` + `role="spinbutton"` (and why).

**Outcome:** **Fell back to `type="text"` + `role="spinbutton"`.**

**Why:**
- `<input type="number">` rejects non-numeric values at render time — the displayed value `"04:00"` (mm:ss) is non-numeric, so React/jsdom render `.value === ""` (empty string).
- This was caught by an ARIA-contract test (`input value displays formatted mm:ss`) which expected `"04:00"` but got `""`.
- The PLAN explicitly documented this discretionary path on line 234: *"if React warns about non-numeric value on type='number' + readOnly, switch to type='text' + role='spinbutton' with aria-valuemin/max/now populated from the ms values."*
- The fallback preserves the spinbutton SR semantics that `type="number"` would have provided. `aria-valuemin/max/now` carry the raw millisecond values for assistive-tech math; `aria-valuetext` carries the human-readable `"04:00"` readout (which SRs prefer over the raw ms when both are present, per WAI-ARIA spec).
- The `+/−` button/arrow-key mutation model is unchanged — the input is `readOnly` regardless of `type`, so user-facing behavior is identical.
- `inputMode="none"` continues to suppress the mobile soft keyboard (T-09-04-04 mitigation preserved).

---

## Test Count + TDD Gate Sequence

| File | Tests | Status |
|------|-------|--------|
| `src/components/__tests__/StepperInput.test.tsx` | 23 | All passing |

**Breakdown:**
- Adaptive step (D-01) — 6 tests including the 5:00 boundary case
- Min/max clamps (D-02) — 4 tests (disabled-button + keyboard-clamp)
- Keyboard (D-02) — 8 tests (Arrow, Shift+Arrow, PageUp/Down, preventDefault)
- ARIA — 5 tests (aria-valuetext, aria-label, aria-invalid propagation, displayed value)

**TDD gate sequence (verified in git log):**
1. RED commit `16707f8`: `test(09-04): add failing test for StepperInput adaptive step + keyboard map` — test fails on `import` resolution (file does not exist)
2. GREEN commit `b7052bf`: `feat(09-04): implement StepperInput with adaptive step + keyboard map` — 23/23 passing
3. No REFACTOR commit needed — component arrived clean from the PLAN-locked spec; no internal restructuring required after GREEN.

**Full suite impact:** 477/477 passing across 38 test files (previous baseline: 454/454 across 37). `npx tsc --noEmit` clean. SEG-05 26-protected-path zero-diff floor preserved — only `src/components/StepperInput.tsx` and its test were created; no existing file modified.

---

## Deviations from Plan

None — plan executed as written. The `type="text"` + `role="spinbutton"` fallback was applied per the PLAN-documented discretionary path on line 234, not as an out-of-plan deviation. Code comment in `StepperInput.tsx` lines 22-30 documents the choice inline.

---

## Auto-fixed Issues

None — no Rule 1/2/3 fixes triggered during execution.

---

## Authentication Gates

None — TDD pure-component plan, no external auth surface.

---

## Self-Check: PASSED

**Files verified to exist:**
- `src/components/StepperInput.tsx` — FOUND
- `src/components/__tests__/StepperInput.test.tsx` — FOUND

**Commits verified to exist in git log:**
- `16707f8` (RED) — FOUND
- `b7052bf` (GREEN) — FOUND

**Acceptance criteria (Task 1):** all 10 grep checks satisfied; tsc clean; protected `formatTime.ts` untouched.
**Acceptance criteria (Task 2):** all 8 grep + execution checks satisfied; full suite green; tsc clean.

**Success criteria (plan-level):**
- D-01 adaptive step + 5:00 boundary case — implemented and tested ✓
- D-02 keyboard map (Arrow / Shift+Arrow / PageUp/Down with 5 min coarse jump) — implemented and tested ✓
- D-03 44 px touch target on +/− buttons (`w-11 h-11`) — verified ✓
- 5s / 60min clamps via disabled buttons — verified ✓
- `inputMode="none"` + `readOnly` suppresses mobile keypad — verified ✓
- `aria-valuetext` gives SR a mm:ss readout — verified ✓
- tsc + vitest clean — verified ✓
