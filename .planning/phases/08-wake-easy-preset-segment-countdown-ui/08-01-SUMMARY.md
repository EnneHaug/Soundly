---
phase: 08-wake-easy-preset-segment-countdown-ui
plan: 01
subsystem: testing
tags: [vitest, jsdom, testing-library, react-19, tailwind-v4, css-keyframes]

# Dependency graph
requires:
  - phase: 07-segment-engine-triangle-sound
    provides: SegmentEngine + SegmentState + WAKE_EASY_CONFIG (consumed unchanged by Phase 8 UI plans)
provides:
  - Vitest jsdom environment configured so .tsx component tests can render
  - @testing-library/react + @testing-library/dom + jsdom installed as devDependencies
  - src/test/setup.ts stub setup file wired via vitest.config.ts test.setupFiles
  - @keyframes pulse-active-arc + .pulse-active CSS rule appended to src/index.css
  - prefers-reduced-motion: no-preference gate around the pulse animation
affects: [phase-08-02, phase-08-03, phase-08-04, phase-08-05, phase-08-06]

# Tech tracking
tech-stack:
  added:
    - "@testing-library/react@^16.0.0"
    - "@testing-library/dom@^10.4.0"
    - "jsdom@^26.0.0"
  patterns:
    - "Vitest + jsdom + setupFiles for .tsx component tests"
    - "Keyframe animation gated behind prefers-reduced-motion: no-preference"

key-files:
  created:
    - src/test/setup.ts
  modified:
    - package.json
    - package-lock.json
    - vitest.config.ts
    - src/index.css

key-decisions:
  - "Use globals: false in vitest.config.ts (matches existing pattern: all 16 test files explicitly import describe/it/expect/vi from 'vitest')"
  - "Re-declare plugins: [react()] in vitest.config.ts so .tsx files compile during tests (vitest reads its own config, separate from vite.config.ts)"
  - "Omit @testing-library/jest-dom from install — codebase asserts via direct DOM property reads, not custom matchers"
  - "Append CSS keyframes verbatim from UI-SPEC L390-401; gate animation behind prefers-reduced-motion: no-preference per RESEARCH Pitfall 7"

patterns-established:
  - "Vitest jsdom environment with explicit setupFiles wiring for downstream component-test plans"
  - "CSS keyframe + media-query reduce-motion gate idiom for any future animation in this codebase"

requirements-completed: [SEG-06]

# Metrics
duration: 3min
completed: 2026-05-10
---

# Phase 8 Plan 01: Wave 1 Foundation Summary

**Wave 1 foundation shipped: RTL + jsdom installed, Vitest jsdom environment wired with src/test/setup.ts, and the 1Hz pulse-active-arc keyframe (with reduce-motion gate) appended to src/index.css — every Phase 8 downstream plan now has the test infra and CSS primitives it depends on.**

## Performance

- **Duration:** 3 min (178 seconds)
- **Started:** 2026-05-10T18:46:22Z
- **Completed:** 2026-05-10T18:49:20Z
- **Tasks:** 2
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- Installed @testing-library/react@^16.0.0, @testing-library/dom@^10.4.0, jsdom@^26.0.0 as devDependencies (50 transitive packages added)
- Switched vitest.config.ts from `environment: 'node'` + `globals: true` to `environment: 'jsdom'` + `globals: false` + react() plugin + setupFiles wiring
- Created src/test/setup.ts as a documented stub (`export {}`) that downstream plans 03/05 can extend with global mocks if needed
- Appended @keyframes pulse-active-arc (opacity 1.0 → 0.7 → 1.0 over 1s ease-in-out) and the .pulse-active rule to src/index.css, gated behind a `prefers-reduced-motion: no-preference` media query
- Existing 320-test regression net unchanged — 27 test files / 320 tests still pass under the new jsdom environment
- All 20 SEG-05 protected paths show 0-line diff (zero-diff floor preserved)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install test deps + configure Vitest jsdom environment** — `a927e0f` (feat)
2. **Task 2: Append @keyframes pulse-active-arc + .pulse-active rule to src/index.css** — `4cd6fe4` (feat)

## Files Created/Modified

- `package.json` — Added 3 devDependencies (@testing-library/react, @testing-library/dom, jsdom)
- `package-lock.json` — Lockfile updated with 50 new transitive entries
- `vitest.config.ts` — Switched to jsdom environment + react() plugin + setupFiles + globals:false
- `src/test/setup.ts` — Stub setup module (export {}) wired via vitest.config.ts
- `src/index.css` — Appended Phase 8 keyframe block + .pulse-active rule with reduce-motion gate (18 → 30 lines)

## Decisions Made

- **globals: false** in vitest.config.ts — matches existing pattern (all 16 test files explicitly import from 'vitest', verified by grep). Switching from the prior `globals: true` setting is safe because no existing test relies on global injection.
- **react() plugin in vitest.config.ts** — re-declared because vitest reads its own config when vitest.config.ts is present at the repo root; without it, .tsx files would fail to compile under the test pipeline.
- **No @testing-library/jest-dom** — RESEARCH explicitly marked this optional; the codebase asserts via direct DOM property reads, not custom matchers. Keeps dep surface minimal.
- **Reduce-motion gate around .pulse-active** — users with `prefers-reduced-motion: reduce` see static opacity 1.0; the firing-alarm state remains indicated by the static segment-5 position, count-up timer, and "Wake" label (RESEARCH Pitfall 7).

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed on the first verification pass; no auto-fixes triggered, no checkpoints reached, no architectural questions surfaced.

## Issues Encountered

None. The full 320-test regression net continues to pass under the new jsdom environment with no test code changes required, confirming the planner's prediction that switching `globals: true → false` would be a clean swap.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plans 02–06 unblocked: every downstream plan can now author `.tsx` test files using `@testing-library/react` without further config or install steps.
- Plans 03 (SegmentProgressRing) and 05 (SegmentCountdown) can apply `className="pulse-active"` to the SVG `<path>` representing the firing-alarm active arc; the 1Hz opacity pulse will render in any browser where `prefers-reduced-motion: no-preference` evaluates true.
- SEG-05 byte-identical floor intact — Plan 01 modified only `package.json`, `package-lock.json`, `vitest.config.ts`, `src/test/setup.ts`, and `src/index.css`, none of which appear on the 20-path SEG-05 protected list.

## Self-Check: PASSED

- FOUND: package.json (contains "@testing-library/react", "@testing-library/dom", "jsdom")
- FOUND: vitest.config.ts (contains `environment: 'jsdom'`, `setupFiles: ['./src/test/setup.ts']`, `react()`)
- FOUND: src/test/setup.ts (contains `export {}`)
- FOUND: src/index.css (contains `@keyframes pulse-active-arc`, `.pulse-active`, `prefers-reduced-motion: no-preference`, `animation: pulse-active-arc 1s ease-in-out infinite`)
- FOUND: existing palette tokens unchanged (`--color-bg: #f4f1eb`, `--font-size-countdown: clamp(3rem, 12vw, 5rem)`)
- FOUND: commit a927e0f (Task 1)
- FOUND: commit 4cd6fe4 (Task 2)
- FOUND: `npx vitest run` exits 0 with 27 files / 320 tests passing
- FOUND: `npx tsc --noEmit` exits 0
- FOUND: `npm run build` succeeds (Tailwind v4 compiles the appended CSS into dist/assets/index-*.css)
- FOUND: zero-line diff on all 20 SEG-05 protected paths

---
*Phase: 08-wake-easy-preset-segment-countdown-ui*
*Completed: 2026-05-10*
