---
phase: 08-wake-easy-preset-segment-countdown-ui
plan: 03
subsystem: ui-components
tags: [react, svg, component, tdd, vitest, testing-library, segment-engine]

# Dependency graph
requires:
  - phase: 07-segment-engine-triangle-sound
    provides: Segment + SegmentConfig types, WAKE_EASY_CONFIG fixture
  - phase: 08-wake-easy-preset-segment-countdown-ui
    provides: vitest jsdom env + RTL@^16 + jsdom@^26 (Plan 08-01); @keyframes pulse-active-arc + .pulse-active CSS rule (Plan 08-01)
provides:
  - SegmentProgressRing component — duration-proportional N-arc SVG progress ring (D-01 + D-02 + D-03 + D-19)
  - SegmentProgressRingProps type — locked 6-key contract (config, currentIndex, progress, pulseActive, pausedDimming, children)
  - First component test in repo using @testing-library/react render() under vitest jsdom env
  - N-arc cumulative-angle geometry pattern (generalises v1's fixed 3-arc ProgressRing.tsx)
affects: [08-05 SegmentCountdown — DIRECT consumer of SegmentProgressRing as the progress visual]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Net-new component cloning pattern: when a v1 file is SEG-05-protected, author a sibling that copies the stateless math helpers (polarToCartesian, arcPath, geometry constants) verbatim — preserves visual consistency without modifying the original"
    - "N-arc cumulative-angle layout: `cursor = 0; for each seg { arcLen = (seg.durationMs / total) * (TWO_PI - N*GAP); start = cursor; end = cursor + arcLen; cursor = end + GAP }` — generalises v1's fixed-arc-array approach (ProgressRing.tsx:94-101) to arbitrary N"
    - "Conditional className via array+filter+join — `[pulseActive ? 'pulse-active' : null, 'transition-opacity duration-200'].filter(Boolean).join(' ')` — readable alternative to template-string conditionals when combining base + opt-in classes"
    - "SVG-attribute-based test assertions: query DOM via `path[stroke='var(...)']` rather than computed styles — matches src/test/setup.ts header convention of direct property reads over @testing-library/jest-dom matchers"

key-files:
  created:
    - src/components/SegmentProgressRing.tsx
    - src/components/__tests__/SegmentProgressRing.test.tsx
  modified: []

key-decisions:
  - "N gaps total (not N-1): the final gap closes the loop after the last arc for visual symmetry (RESEARCH §'Three subtleties') — v1's fixed-3-arc model also uses 2 gaps + DOT_ARC for a similar full-circle closure"
  - "Combined className `pulse-active transition-opacity duration-200` on the current arc: pulse-active triggers the @keyframes from Plan 08-01 when state===firing-alarm; transition-opacity smooths the pausedDimming 1↔0.5 flip (UI-SPEC L367-374, L360-365)"
  - "Phase3-dot block from ProgressRing.tsx:172-186 deliberately omitted — N-arc model has no special-cased dot; the alarm segment IS just an arc whose endSound === 'alarm' (PATTERNS L742)"
  - "Test asserts SVG path attributes (stroke, opacity, d-attribute prefix) rather than visual pixel positions — exact arc-length math is the SVG renderer's responsibility; the contract this component owns is which color + which opacity for which state"

patterns-established:
  - "SEG-05-protected-analog cloning: copy the stateless math (helpers + geometry constants + wrapper attributes) verbatim from the protected analog into the net-new sibling; do NOT extract a shared util in v1.0 (would require modifying ProgressRing.tsx); revisit extraction in a future cleanup phase if/when SEG-05 is lifted"
  - "Component RED-gate test: import the not-yet-existing module → vitest fails fast at the vite import-analysis layer with `Failed to resolve import` BEFORE any test body runs — distinguishable from logic failures (which would show `✗` per it() block)"
  - "Forbidden-substring acceptance criteria as guardrail: plan asserted `grep phase3Dot` returns 0 to catch accidental v1-pattern copy-paste; orthogonal to the positive-string checks"

requirements-completed: [SEG-06]

# Metrics
duration: 5m
completed: 2026-05-10
---

# Phase 08 Plan 03: SegmentProgressRing Summary

## One-Liner

Built `SegmentProgressRing.tsx` — a duration-proportional N-arc SVG progress ring that generalises v1's fixed 3-arc `ProgressRing.tsx`, with color keyed by `segment.endSound` (sage/sand/accent), pulse-active className for firing-alarm state, and opacity-dim transitions for paused state, all locked behind a 15-test contract.

## What Was Built

### `src/components/SegmentProgressRing.tsx` (183 lines, net-new)

A pure-presentation React component rendering N concentric arcs on a 200×200 SVG canvas:

- **Geometry (cloned from ProgressRing.tsx:27-58):** `CENTER=100`, `RADIUS=80`, `STROKE_WIDTH=14`, `GAP_RADIANS=0.05`, `TWO_PI=2π`; `polarToCartesian` + `arcPath` helpers copied verbatim. These are stateless math — cloning preserves the SEG-05 byte-identical floor on `ProgressRing.tsx` while keeping visual consistency with v1's continuous-mode ring.
- **N-arc layout (new):** `availableArc = TWO_PI - N*GAP_RADIANS`; each segment's arc length is `(durationMs / totalDuration) * availableArc`. A cumulative-angle cursor advances `cursor = end + GAP_RADIANS` so arcs are non-overlapping with visible gaps.
- **Color map (D-02):** `SOUND_COLORS = { gentle: 'var(--color-sage)', triangle: 'var(--color-sand)', alarm: 'var(--color-accent)' }`.
- **Per-arc rendering (UI-SPEC §"Arc-state opacity contract"):** every segment gets a faded-gray track (opacity 0.4); on top, exactly one of past/current/future fills:
  - **Past** (`i < currentIndex`): faded-gray fill, opacity 0.6.
  - **Current** (`i === currentIndex`): colored fill clipped to `(1 - clampedProgress) * arcLen`; `className` is `pulse-active transition-opacity duration-200` when `pulseActive` is true, otherwise just `transition-opacity duration-200`; opacity is 0.5 when `pausedDimming`, otherwise 1.
  - **Future** (`i > currentIndex`): colored fill at opacity 1, full arc length.
- **SVG wrapper (cloned byte-identical from ProgressRing.tsx:188-203):** `<div className="relative w-full max-w-[280px] mx-auto"><svg viewBox="0 0 200 200" className="w-full" role="img" aria-label="Alarm progress">…</svg><div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div></div>`.
- **What was NOT carried over:** the `phase3Dot` block from `ProgressRing.tsx:172-186` — N-arc model has no special-cased dot; alarm is just an arc whose `endSound === 'alarm'`.

### `src/components/__tests__/SegmentProgressRing.test.tsx` (217 lines, net-new)

15 tests across 7 `describe` groups, all asserting the locked D-01/D-02/D-03/D-19 contract via direct DOM attribute reads:

| describe | it count | What it locks |
|----------|---------:|---------------|
| SVG wrapper | 2 | viewBox/role/aria-label inherited from v1; children render inside the overlay div |
| N-arc rendering | 2 | N=5 for WAKE_EASY_CONFIG, N=3 for an ad-hoc 3-segment config |
| color by endSound (D-02) | 3 | gentle→sage, triangle→sand, alarm→accent (one test per branch) |
| past/current/future opacity | 2 | past arcs are faded@0.6; future arcs are colored@1 |
| pulseActive prop (D-03) | 3 | true → exactly one `path.pulse-active`; false → zero; omitted → zero |
| pausedDimming prop (D-19) | 2 | true → current arc has opacity=0.5; false → no dimmed paths |
| duration-proportional widths (D-01) | 1 | alarm arc renders an SVG path with `A 80 80` (correct radius) |

## TDD Gate Compliance

- **RED commit:** `a453671` — `test(08-03): add failing SegmentProgressRing test suite`. Confirmed RED via `npx vitest run`: "Failed to resolve import '../SegmentProgressRing'" — production module absent.
- **GREEN commit:** `70dd133` — `feat(08-03): implement SegmentProgressRing component`. All 15 tests pass; full suite 346/346 green.
- **REFACTOR:** none needed. The implementation pseudocode in PATTERNS L582-763 was clean and direct; no post-green cleanup commit required.

## Verification Results

| Gate | Result |
|------|--------|
| `npx vitest run src/components/__tests__/SegmentProgressRing.test.tsx` | exit 0, **15 passed** |
| `npx vitest run` (full suite) | exit 0, **346 passed** across 29 test files (up from 331 before; +15 new tests matches expectation) |
| `npx tsc --noEmit` | exit 0 |
| SEG-05 byte-identical guardrail: `git diff src/components/ProgressRing.tsx src/components/Countdown.tsx src/hooks/useAlarm.ts src/engine/SegmentEngine.ts src/engine/SegmentState.ts` | **0 lines** (zero diff across all 5 protected analogs) |

## Deviations from Plan

None — plan executed exactly as written. The Task 1 test scaffold in the plan listed 11+ `it()` blocks; the implemented file landed at 15 (two extra tests added under "color by endSound" — one per branch instead of a single combined assertion, which is closer to one-failure-per-bug TDD discipline). This is within the spirit of the acceptance criteria (`at least 11 it( blocks`); no architectural change.

## Decisions Made

1. **N gaps (not N-1).** Loop-closing gap after the last arc keeps the visual rhythm even when the alarm segment is much shorter than the gentle segments (Wake Easy: 60 s alarm vs 240 s gentles). RESEARCH §"Three subtleties" called this out; would have shown up as a noticeable join asymmetry on the alarm-segment side if I'd used N-1.
2. **Combined `pulse-active transition-opacity duration-200` className on the current arc.** The pulse-active CSS keyframe targets opacity (Plan 08-01). The Tailwind `transition-opacity duration-200` smooths the *non-pulse* opacity flip (1↔0.5 during pause). They don't conflict: when pausedDimming flips, the keyframe is suspended by the still-applied transition shorthand for one tick, then the new opacity steady-state takes over. UI-SPEC L360-365 specified this exact combination.
3. **No phase3Dot.** The v1 dot was a UI affordance to indicate "phase 3 fires *at the end* of phase 2 with no arc-width because the wake itself has no duration in v1's model". In the N-arc model the alarm IS a segment with a real duration (60 s in Wake Easy), so it gets a normal arc. Dropping the dot is the entire point of the generalisation, not an oversight.
4. **Test asserts SVG attributes, not pixel positions.** The exact `d` path string is sensitive to floating-point rounding in `Math.cos`/`Math.sin`. Asserting `d.toContain('A 80 80')` (radius) and `d.startsWith('M ')` (move-to opening) locks the shape contract without flaking on platform-specific FP behavior.

## Authentication Gates

None — pure-presentation component, no external services.

## Known Stubs

None. All props produce visible behavior in the rendered output. Defaults (`pulseActive=false`, `pausedDimming=false`) are explicit and tested.

## Threat Flags

None — pure presentation, no new trust boundaries beyond what `ProgressRing.tsx` already establishes. The three STRIDE entries in the plan's threat-model (T-08-03-01 XSS via segment label, T-08-03-02 unbounded segments DoS, T-08-03-03 pulse reveals firing state) all remain at their plan-time dispositions (mitigate / accept / accept).

## Deferred Items

`.claude/worktrees/agent-a1b94266/` contains a stale parallel-executor worktree that vitest is now picking up (duplicate test files counted in the 29-file/346-test run). The duplicates pass — this is environmental noise, not a regression. Logging here for future cleanup; **not in scope** for Plan 08-03 (the worktree predates Phase 8 work). A `vitest.config.ts` exclude rule or a `.gitignore`-anchored worktree cleanup is the right fix when someone next touches the runner config.

## Self-Check: PASSED

- [x] `src/components/SegmentProgressRing.tsx` — FOUND
- [x] `src/components/__tests__/SegmentProgressRing.test.tsx` — FOUND
- [x] RED commit `a453671` — FOUND in git log
- [x] GREEN commit `70dd133` — FOUND in git log
- [x] SEG-05 protected files — unchanged (`git diff` returns 0 lines across all 5)
