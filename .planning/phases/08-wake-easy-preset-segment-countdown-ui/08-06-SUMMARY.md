---
phase: 08-wake-easy-preset-segment-countdown-ui
plan: 06
subsystem: app-shell
tags: [integration, app-routing, dashboard-card, harness-removal, phase-8, phase-finale]

# Dependency graph
requires:
  - phase: 08-wake-easy-preset-segment-countdown-ui
    provides: useActiveAlarm dispatcher + ActiveAlarmState discriminated union (Plan 08-04); SegmentCountdown active-alarm screen (Plan 08-05); useSegmentAlarm hook (Plan 08-02); SegmentProgressRing (Plan 08-03); vitest jsdom env + RTL (Plan 08-01)
  - phase: 07-segment-engine-triangle-sound
    provides: WAKE_EASY_CONFIG constant exported from src/engine barrel (D-24); SegmentHarness.tsx (the file this plan deletes — was the Phase 7 dev-only stand-in for SegmentCountdown)
  - phase: 03-react-ui
    provides: Dashboard.tsx + PresetCard.tsx (Dashboard modified in-place; PresetCard consumed unchanged)
provides:
  - 3-card Dashboard wiring with the "4 x 4" Wake Easy preset (ROADMAP success criterion #1)
  - 3-way mode-routed App shell (Dashboard / Countdown / SegmentCountdown branched on activeAlarm.mode)
  - SegmentHarness.tsx removal — the harness was a Phase 7 dev-only artifact, production segment UI now ships through SegmentCountdown
  - Dashboard.test.tsx automated coverage for ROADMAP success criterion #1 (rendering + dispatch payloads)
  - AGGREGATED SEG-05 byte-identical guardrail verification (the load-bearing regression check for the entire phase)
affects:
  - End of Phase 8 — no downstream plans; this is the integration finale

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mode-routed app shell via discriminated-union narrowing: App.tsx uses three &&-guarded branches on activeAlarm.mode (idle | continuous | segments). TypeScript narrowing ensures activeAlarm.alarm is typed as UseAlarmReturn on the continuous branch and UseSegmentAlarmReturn on the segments branch — no runtime cast needed. The discriminator is the LOCKED CONTEXT D-07 union; future v2.x composer-mode would extend this with a fourth branch"
    - "Dashboard prop signature uses Extract<ActiveAlarmState, { mode: 'idle' }>: this narrows the props to ONLY the idle variant of the union, preventing accidental passing of a running-alarm state to the Dashboard. The Dashboard receives only the dispatcher's start() method, not the raw continuous/segments objects — controlled-methods principle (T-03-01 from earlier phases)"
    - "User-facing label decoupled from internal symbol name: the card displays '4 x 4' (single ASCII spaces, not Unicode multiplication sign — D-12) while the internal constant remains WAKE_EASY_CONFIG (D-13). The only place 'Wake Easy' surfaces to users is the description text 'gentle morning wake' if it existed; in v2.0 the user-facing label is purely numeric. This decoupling lets internal naming evolve (e.g., future PRESET_4X4) without breaking the user-visible string contract"
    - "PreToolUse Write hook + multi-write file modification: when editing files already read in the session, the Write tool may emit a read-before-edit reminder hook even after a prior Read succeeded. The Write itself still succeeds; the verification pattern is Read-immediately-after to confirm contents match expectations"
    - "compareDocumentPosition + DOCUMENT_POSITION_FOLLOWING for document-order assertions in jsdom: more robust than getAllByRole array-index assumptions, which couple to internal markup. Future tests asserting card order should use this idiom"

key-files:
  created:
    - src/components/__tests__/Dashboard.test.tsx (90 lines, 5 it() blocks)
  modified:
    - src/components/Dashboard.tsx (prop signature change + third PresetCard add; 56 → 68 lines)
    - src/App.tsx (full body rewrite via Write; 25 → 17 lines, net -8; useAlarm/SegmentHarness imports dropped, useActiveAlarm/SegmentCountdown imports added, 3-way mode branch replaces ternary + URL-flag block, version bumped 1.1 → 1.2)
  deleted:
    - src/dev/SegmentHarness.tsx (164 lines, Phase 7 dev-only harness — superseded by SegmentCountdown; D-14, D-16)

key-decisions:
  - "Dashboard.test.tsx uses afterEach(cleanup) pattern from SegmentCountdown.test.tsx (vitest globals: false + RTL): without explicit cleanup, multiple render() calls in the same describe() block leak DOM and cause 'Found multiple elements' errors on getByText. Established phase-wide as the standard component-test idiom"
  - "Document-order assertion via compareDocumentPosition rather than getAllByRole array-index: PresetCard's internal markup (button wrapping two <p> tags) means getAllByRole('button') returns elements but getAllByText would be over-broad. The native DOM compareDocumentPosition API on jsdom is the cleanest way to assert 'A precedes B in document order' without coupling to PresetCard's render shape"
  - "Five test cases (not four as planner sketched): added a fifth assertion locking the description text '4 chimes over 16 min, then alarm' verbatim. Cheap to add, prevents silent copy drift in the most user-visible string this phase introduces. D-12 mandates the exact label and description"
  - "src/dev/ directory removed along with SegmentHarness.tsx: git rm of the only file in the directory leaves it empty, and the working tree drops empty directories. No follow-up needed — if a future phase reintroduces a dev-only harness, it'll create src/dev/ fresh"
  - "App.tsx full Write (not Edit): the file is 17 lines after the rewrite and the diff touches every line except the outer wrapper className and the version footer (which moves from 1.1 to 1.2). A full Write was cleaner than three sequential Edit calls"

patterns-established:
  - "Phase-finale integration plan pattern: (a) self-modify the dashboard with new card + new prop signature; (b) self-modify the app shell to wire the new dispatcher hook + delete the dev-only stand-in; (c) run the AGGREGATED SEG-05 guardrail across all v1-protected paths as the load-bearing acceptance criterion; (d) run post-build dist/ sanity grep to confirm tree-shaking removed the deleted component's residue. Transferable to Phase 9+ composer-mode integration finale and Phase 11 multi-page routing finale"
  - "User-label vs internal-symbol naming separation (D-12 + D-13): the planner can independently lock the user-facing string and the internal constant name. The constraint that propagates to executors is 'the user-facing string is locked in this file; the symbol can be referenced internally with any name'. Phase 9 composer presets will follow the same pattern"

requirements-completed: [SEG-06]

# Metrics
duration: 3m 48s
completed: 2026-05-10
---

# Phase 08 Plan 06: Wake Easy Card + App Routing + Harness Removal Summary

Integration finale of Phase 8: wired the "4 x 4" Wake Easy preset card into Dashboard, routed App.tsx through the useActiveAlarm dispatcher with 3-way mode narrowing (idle | continuous | segments), deleted the Phase 7 dev-only SegmentHarness, and confirmed the AGGREGATED SEG-05 byte-identical guardrail returns zero diff across all 20 v1-protected paths against the Phase 7 final baseline (commit abd667d). 378/378 tests pass (5 new Dashboard.test.tsx assertions added); tsc clean; production build clean; dist/ contains zero SegmentHarness residue.

## Tasks Executed

### Task 1: Modify Dashboard.tsx + create Dashboard.test.tsx
**Commit:** `6cbaf78` — `feat(08-06): add 4 x 4 preset card + Dashboard test coverage`

Dashboard.tsx prop signature changed from `{ alarm: UseAlarmReturn }` to `{ activeAlarm: Extract<ActiveAlarmState, { mode: 'idle' }> }`. The two existing PresetCards (Quick Nap, Focus) had their onStart handlers updated to dispatch the new discriminated-union shape `{ kind: 'continuous', config: <CONFIG> }`. A third PresetCard was added at the bottom of the cards container with the locked label `"4 x 4"` (single ASCII spaces, NOT Unicode multiplication sign per D-12), description `"4 chimes over 16 min, then alarm"`, and onStart dispatching `{ kind: 'segments', config: WAKE_EASY_CONFIG }`. All preserved-byte-identical regions held: header block, cards-wrapper class string `mt-10 w-full flex flex-col gap-4`, TestSoundButton block, IosInstallBanner block.

Dashboard.test.tsx (new file, 90 lines, 5 test cases):
1. Renders three preset cards in document order Quick Nap → Focus → 4 x 4 (via `compareDocumentPosition` + `Node.DOCUMENT_POSITION_FOLLOWING`)
2. Renders the "4 x 4" description verbatim per D-12
3. Clicking "4 x 4" dispatches `{ kind: 'segments', config: WAKE_EASY_CONFIG }`
4. Clicking "Quick Nap" dispatches `{ kind: 'continuous', config: QUICK_NAP_CONFIG }`
5. Clicking "Focus" dispatches `{ kind: 'continuous', config: FOCUS_CONFIG }`

Test idiom: vitest `vi.fn()` mocks on `activeAlarm.start` with `toHaveBeenCalledWith` deep-equality assertions. No `@testing-library/jest-dom` dependency (Plan 01 Task 1 explicitly omitted it). `afterEach(cleanup)` pattern from SegmentCountdown.test.tsx applied — vitest `globals: false` requires explicit cleanup to prevent DOM leak across tests.

### Task 2: Replace App.tsx body + delete SegmentHarness.tsx
**Commit:** `d05a2d6` — `refactor(08-06): route App.tsx via useActiveAlarm + delete SegmentHarness`

App.tsx rewritten end-to-end (17 lines, net -8 vs prior 25-line version):
- DROP imports: `useAlarm`, `SegmentHarness`
- ADD imports: `useActiveAlarm`, `SegmentCountdown`
- KEEP imports: `Dashboard`, `Countdown` (Countdown is SEG-05 byte-identical-protected and still consumed for continuous-mode)
- DROP locals: `showCountdown` const, `showSegmentHarness` 3-line URL-flag block, `dev=segments` URL parameter
- REPLACE ternary with three `&&`-guarded branches narrowing on `activeAlarm.mode` (idle / continuous / segments)
- KEEP outer wrapper `<div className="min-h-dvh bg-bg text-text-primary flex flex-col items-center">` byte-identical (Phase 3 D-04)
- BUMP version footer literal `Version: 1.1` → `Version: 1.2`

`src/dev/SegmentHarness.tsx` deleted via `git rm` per D-14 + D-16. The empty `src/dev/` directory was naturally removed (git does not track empty directories).

## Verification Results

### Automated Tests
```
$ npx vitest run
Test Files  32 passed (32)
     Tests  378 passed (378)
```
Was 373 before this plan (+5 new Dashboard.test.tsx assertions). Includes the 4 stale-worktree mirror test files at `.claude/worktrees/agent-a1b94266/` — out of scope (environment note from the orchestrator).

### TypeScript
```
$ npx tsc --noEmit
(no output — exit 0)
```

### Production Build
```
$ npm run build
dist/assets/index-Dv6WqTWI.css  18.25 kB │ gzip:  4.24 kB
dist/assets/index-C90IW2pO.js  223.32 kB │ gzip: 68.47 kB
✓ built in 1.81s
PWA v0.21.2 — Building src/sw.ts service worker
dist/sw.mjs  16.91 kB │ gzip: 5.69 kB
✓ built in 369ms
mode      injectManifest
precache  8 entries (236.91 KiB)
files generated
  dist/sw.js
```

### Post-deletion sanity grep (D-17)
```
$ grep -r "SegmentHarness" src/                          # 0 matches
$ grep -r "showSegmentHarness\|dev=segments" src/        # 0 matches
$ grep -r "SegmentHarness" dist/                         # 0 matches
```
All three return zero. (The dist/ grep was already returning zero in Phase 7 thanks to Vite tree-shaking; this plan's deletion eliminates any latent source-tree residue and confirms the regression does not reintroduce it.)

### AGGREGATED SEG-05 Byte-Identical Guardrail (THE Load-Bearing Phase-8 Check)
```
$ git diff abd667d -- \
    src/engine/AlarmEngine.ts src/engine/AlarmState.ts src/engine/AlarmSession.ts \
    src/engine/AudioContext.ts src/engine/timer.ts src/engine/SegmentEngine.ts \
    src/engine/SegmentState.ts src/hooks/useAlarm.ts src/components/Countdown.tsx \
    src/components/ProgressRing.tsx src/engine/sounds/singingBowl.ts \
    src/engine/sounds/phase3Tone.ts src/engine/sounds/keepalive.ts \
    src/engine/sounds/testSound.ts src/engine/sounds/tickPulse.ts \
    src/engine/sounds/triangle.ts src/engine/sounds/segmentSound.ts \
    src/platform/wakeLock.ts src/platform/vibration.ts src/platform/notifications.ts \
    | wc -l
0
```

**ZERO LINES DIFF ACROSS ALL 20 SEG-05 PROTECTED PATHS** vs Phase 7's final commit (`abd667d docs(07-05): complete SegmentHarness + barrel + App wiring plan`). Quick Nap and Focus continue running byte-identically through the unmodified v1 stack (`useAlarm.ts` + `Countdown.tsx` + `AlarmEngine.ts` + `AlarmSession.ts` + every sound file). This is the load-bearing acceptance criterion for the entire phase and the v1 zero-diff guarantee (SEG-05) is preserved.

## ROADMAP Success Criteria Status

1. **"4 x 4" card visible on Dashboard alongside Quick Nap and Focus** — AUTOMATED via Dashboard.test.tsx (rendering + document order + dispatch). Manual on-device visual gate remains as final confirmation.
2. **Tapping "4 x 4" starts segment-mode alarm in one tap** — AUTOMATED via Dashboard.test.tsx dispatch assertion (`activeAlarm.start({ kind: 'segments', config: WAKE_EASY_CONFIG })`).
3. **Phase label "Segment X of N — {SoundLabel}" during segment-mode** — Verified in SegmentCountdown.test.tsx (Plan 08-05).
4. **Chimes fire at 4:00 / 8:00 / 12:00 / 16:00 and final alarm at 17:00 (±2s); pause/resume extends total** — Manual on-device gate inherited from Phase 7 SegmentEngine timer-mock tests (SEG-02 timing accuracy verified at engine level in Phase 7; Phase 8 UI consumes the engine unchanged — see SEG-05 guardrail above).
5. **v1 byte-identical guarantee: Quick Nap and Focus run through unmodified Countdown/useAlarm/AlarmEngine paths** — VERIFIED automatically via the AGGREGATED SEG-05 guardrail (zero diff across all 20 protected paths vs Phase 7 baseline).

## Deviations from Plan

None — plan executed exactly as written, including the plan-checker-revised Dashboard.test.tsx requirement. Two procedural notes:

1. **PreToolUse Write hook fired twice with read-before-edit reminders** on Dashboard.tsx and App.tsx Write calls, even though both files had been Read earlier in the session. The Writes still succeeded; verified with immediate post-write Read. This is a hook-config quirk, not a deviation.
2. **Five test cases written, not four as the planner's sketch implied** — added a fifth test locking the description text `"4 chimes over 16 min, then alarm"` verbatim. Cheap insurance against silent copy drift on the most user-visible D-12 string. The acceptance criteria listed four required test assertions; the fifth is additive and matches D-12 intent.

## TDD Gate Compliance

Plan type is `execute`, not `tdd`. No RED→GREEN→REFACTOR gate enforcement required. Dashboard.test.tsx was written alongside the Dashboard.tsx modification in Task 1's single commit — both shipped together, which is the standard pattern for non-TDD plans.

## Known Stubs

None. The "4 x 4" card is fully wired end-to-end: tapping it invokes the real `useActiveAlarm.start({ kind: 'segments', config: WAKE_EASY_CONFIG })` → `useSegmentAlarm.start` → `SegmentEngine.start(WAKE_EASY_CONFIG)` → real Web Audio API segment scheduling.

## Commits

| Task | Hash | Type | Description |
|------|------|------|-------------|
| 1 | `6cbaf78` | feat | add 4 x 4 preset card + Dashboard test coverage |
| 2 | `d05a2d6` | refactor | route App.tsx via useActiveAlarm + delete SegmentHarness |

## Self-Check: PASSED

- [x] `src/components/Dashboard.tsx` exists and contains `name="4 x 4"`, `WAKE_EASY_CONFIG`, `Extract<ActiveAlarmState, { mode: 'idle' }>`
- [x] `src/components/__tests__/Dashboard.test.tsx` exists and contains `compareDocumentPosition` + `kind: 'segments', config: WAKE_EASY_CONFIG`
- [x] `src/App.tsx` exists and contains `useActiveAlarm`, `SegmentCountdown`, `Version: 1.2`; does NOT contain `useAlarm` (direct), `SegmentHarness`, `showCountdown`, `dev=segments`, `Version: 1.1`
- [x] `src/dev/SegmentHarness.tsx` does NOT exist
- [x] Commit `6cbaf78` exists in `git log --oneline --all`
- [x] Commit `d05a2d6` exists in `git log --oneline --all`
- [x] AGGREGATED SEG-05 guardrail returns 0 lines across all 20 protected paths
- [x] Full vitest suite: 378/378 passing
- [x] `npx tsc --noEmit` exits 0
- [x] `npm run build` exits 0
- [x] Post-build `grep "SegmentHarness" dist/` returns 0 matches
