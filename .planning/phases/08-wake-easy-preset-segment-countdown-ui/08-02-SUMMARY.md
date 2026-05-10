---
phase: 08-wake-easy-preset-segment-countdown-ui
plan: 02
subsystem: ui-hooks
tags: [react, hooks, react-19, vitest, testing-library, segment-engine, tdd]

# Dependency graph
requires:
  - phase: 07-segment-engine-triangle-sound
    provides: SegmentEngine class, SegmentChangeEvent type, WAKE_EASY_CONFIG, requestNotificationPermission
  - phase: 08-wake-easy-preset-segment-countdown-ui
    provides: vitest jsdom environment + RTL@^16 + jsdom@^26 (Plan 08-01 Wave 1)
provides:
  - useSegmentAlarm hook (paired with useAlarm) — reactive React surface for SegmentEngine
  - UseSegmentAlarmReturn type — locked CONTEXT D-09 12-key contract for downstream consumers
  - First hook test in repo using @testing-library/react renderHook + act on a vitest jsdom env
  - Engine-class mock idiom for hook tests (deeper than transitive AC/sound mocks)
affects: [08-03 SegmentProgressRing parallel sibling, 08-04 useActiveAlarm — DIRECT consumer of UseSegmentAlarmReturn, 08-05 SegmentCountdown — DIRECT consumer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hook test pattern: vi.mock the engine class itself (not its transitive deps); renderHook + act + microtask flush via await act(async () => await result.current.start(...))"
    - "Hook implementation pattern (mirror map): line-for-line clone of useAlarm.ts with engine swap + state-shape extension + onSegmentChange-in-body callback"
    - "Pause-guard idiom: hook checks engine.canPause() before flipping local isPaused state (defense-in-depth against engine's own silent no-op during firing-alarm)"

key-files:
  created:
    - src/hooks/useSegmentAlarm.ts
    - src/hooks/__tests__/useSegmentAlarm.test.ts
  modified: []

key-decisions:
  - "useSegmentAlarm uses callback-in-body (not useEffect) for onSegmentChange — matches useAlarm.ts:80-86 pattern; last-wins per engine API contract; avoids stale closures across React re-renders"
  - "Hook polls engine.getState() inside the callback to capture the engine's pre-callback state transition (verified SegmentEngine.ts:212 — state flips to firing-alarm BEFORE the kind:end event fires for alarm segments)"
  - "Pause guard duplicated at hook level (`if (!engine.canPause()) return;`) so the local React state never desyncs from the engine's silent no-op"
  - "Test uses vi.mock at the SegmentEngine class level — bypasses AudioContext/Wake Lock/keepalive entirely; cleaner than the transitive-mock approach used in SegmentEngine.test.ts (which had to mock 6 sibling modules)"

patterns-established:
  - "Engine-class mock for hook tests: a single vi.mock returning a shared mockEngineInstance with vi.fn() per public method; shared module-level captured callbacks (mockSegmentChangeCb) let tests synthesize engine events without timer advancement"
  - "Hook RED-gate pattern: import the not-yet-existing implementation file; vitest fails at module resolution (Failed to resolve import) — distinguishable from logic failures"

requirements-completed: [SEG-06]

# Metrics
duration: 3m 44s
completed: 2026-05-10
---

# Phase 8 Plan 2: useSegmentAlarm Hook Summary

**Reactive React hook wrapping SegmentEngine — paired with useAlarm — exposes the locked CONTEXT D-09 12-key surface (state, currentSegment, segmentEndsAt, totalEndsAt, alarmStartedAt, activeConfig + start/stop/pause/resume) via a line-for-line mirror of useAlarm with three deltas: SegmentEngineState replaces AlarmPhase, three epoch fields replace single phaseEndsAt, onSegmentChange polls engine.getState() to capture pre-callback firing-alarm transition.**

## Performance

- **Duration:** 3m 44s
- **Started:** 2026-05-10T18:52:52Z
- **Completed:** 2026-05-10T18:56:36Z
- **Tasks:** 2 (RED + GREEN — TDD plan)
- **Files created:** 2
- **Files modified:** 0
- **Tests added:** 11 (5 describe groups; 28 test files / 331 tests total in suite)

## Accomplishments

- `src/hooks/useSegmentAlarm.ts` — reactive React hook wrapping SegmentEngine with the locked 12-key UseSegmentAlarmReturn contract per CONTEXT D-09
- `src/hooks/__tests__/useSegmentAlarm.test.ts` — 11 hook tests covering initial state / start() / onSegmentChange wiring (kind=start + alarm-end + non-alarm-end) / pause-resume snapshot semantics / pause-no-op-during-firing-alarm / stop reset
- TDD gate sequence honored: RED commit (test exists, implementation missing → module-resolution failure) followed by GREEN commit (implementation passes all 11 tests)
- SEG-05 byte-identical floor preserved across all 20 protected paths — zero diff
- Full test suite grew from 320 → 331 tests; all pass; tsc --noEmit clean

## Task Commits

Each task was committed atomically per TDD discipline:

1. **Task 1: Author useSegmentAlarm.test.ts (RED)** — `70ea5e9` (test) — failing-test gate
2. **Task 2: Implement useSegmentAlarm.ts (GREEN)** — `b9d5a7f` (feat) — implementation makes test pass

Both commits live on `main` per the sequential-executor configuration.

## Files Created/Modified

- `src/hooks/useSegmentAlarm.ts` (NEW, 188 lines) — useSegmentAlarm hook + UseSegmentAlarmReturn type, mirroring useAlarm.ts:1-137 line-for-line with the deltas locked by CONTEXT D-09 / D-03 / D-18 / D-19
- `src/hooks/__tests__/useSegmentAlarm.test.ts` (NEW, 263 lines) — 11 it() blocks with vi.mock SegmentEngine class + vi.mock requestNotificationPermission; uses @testing-library/react renderHook + act; vi.useFakeTimers + vi.setSystemTime for deterministic epoch math

## Decisions Made

- **Engine-class mock vs transitive deps mock:** chose to mock the SegmentEngine class directly (one vi.mock; shared mockEngineInstance) rather than mocking AudioContext + sounds + AlarmSession + timer like SegmentEngine.test.ts does. Reasoning: hook tests are about hook ↔ engine wiring, not engine internals; bypassing the engine's transitive surface keeps tests focused and short. PATTERNS L1011-1037 endorses this idiom for hook tests.
- **Module-level captured callback (mockSegmentChangeCb):** rather than re-instantiating the mock per test, the test captures the latest registered onSegmentChange callback into a let-binding inside the test module. This lets tests synthesize engine events (`mockSegmentChangeCb!({ kind: 'start', ... })`) without driving fake timers, which is faster and more deterministic than the timer-advancement approach used in the engine tests.
- **Strict pause guard at hook level:** even though SegmentEngine.pause() is itself a silent no-op when canPause() returns false, the hook also guards via `if (!engine.canPause()) return;` BEFORE calling engine.pause() and BEFORE touching local React state. This ensures the hook's local isPaused never flips true while the engine refuses to actually pause — a desync would corrupt resume() because the snapshot semantics depend on a real engine pause.
- **Doc-comment header replaces "alarm" with "segment alarm" verbatim:** the T-03-01 controlled-methods note from useAlarm.ts:8-10 carries through directly. Re-stating it locally (vs delegating to a shared docblock) makes per-hook security posture self-evident at file open.

## Deviations from Plan

None - plan executed exactly as written.

The PLAN.md provided complete code blocks for both the test file and the implementation file in the `<action>` sections; both were authored verbatim from those code blocks with no semantic deviations. Comment text was lightly polished (e.g., the implementation's docblock expands the rationale paragraph beyond the analog's text, and the RESEARCH reference was retargeted from `03-RESEARCH.md` to `08-RESEARCH.md` since the doc cited in useAlarm.ts:79 references its own phase). These are presentational, not behavioral.

## Issues Encountered

None. Both gates passed on first run:

- RED: vitest reported `Failed to resolve import "../useSegmentAlarm"` — the canonical "implementation missing" failure. Distinguishable from a logic failure (which would be `expected X, received Y`).
- GREEN: all 11 tests passed on first execution. No iteration needed.

## TDD Gate Compliance

The plan-level TDD gate sequence is satisfied:

1. **RED gate** (commit `70ea5e9`): `test(08-02): add failing useSegmentAlarm hook test suite` — test file exists, implementation does not, vitest fails at module resolution.
2. **GREEN gate** (commit `b9d5a7f`): `feat(08-02): implement useSegmentAlarm hook` — implementation file authored, all 11 tests pass.
3. **REFACTOR gate** (skipped intentionally): no refactor needed — the implementation is already a clean line-for-line mirror of useAlarm.ts with no duplication or dead code.

The fail-fast rule was honored — the RED test was confirmed to fail BEFORE the implementation file was written.

## SEG-05 Byte-Identical Guardrail

All 20 protected paths show zero modifications:

```bash
git diff src/hooks/useAlarm.ts                   # 0 lines
git diff src/engine/                              # 0 lines (covers 7 protected engine files)
git diff src/components/Countdown.tsx             # 0 lines
git diff src/components/ProgressRing.tsx          # 0 lines
git diff src/platform/                            # 0 lines (covers 3 protected platform files)
```

This plan added two NEW files (`src/hooks/useSegmentAlarm.ts`, `src/hooks/__tests__/useSegmentAlarm.test.ts`); neither is on the protected list.

## Verification

Per the plan's `<verification>` block:

- `npx vitest run src/hooks/__tests__/useSegmentAlarm.test.ts` → 11/11 passed
- `npx vitest run` (full suite) → 28 files / 331 tests / all passed (was 27/320 before this plan)
- `npx tsc --noEmit` → exit 0
- `git diff` against SEG-05 protected paths → 0 lines

Per the plan's `<success_criteria>`:

- [x] Hook exposes the locked CONTEXT D-09 surface verbatim (12 keys, asserted by `keys.sort() === [...]` test)
- [x] All test scenarios in CONTEXT D-20 pass (initial state, start, onSegmentChange wiring, pause-resume snapshot, alarmStartedAt firing-alarm detection, stop, T-03-01 keys-only)
- [x] v1 SEG-05 protected paths carry zero diff

## Self-Check: PASSED

**Created files exist:**

- FOUND: `src/hooks/useSegmentAlarm.ts` (188 lines)
- FOUND: `src/hooks/__tests__/useSegmentAlarm.test.ts` (263 lines)

**Commits exist:**

- FOUND: `70ea5e9` — `test(08-02): add failing useSegmentAlarm hook test suite`
- FOUND: `b9d5a7f` — `feat(08-02): implement useSegmentAlarm hook`

## Next Phase Readiness

Plan 08-02 ships the most-consumed contract surface in Phase 8 — every other React-side file consumes `UseSegmentAlarmReturn`:

- **Plan 08-03 (SegmentProgressRing):** parallel sibling — does not consume this hook (props-driven). No blocking dependency.
- **Plan 08-04 (useActiveAlarm):** **direct consumer** — its `'segments'` discriminated-union branch wraps `useSegmentAlarm()`. Now unblocked.
- **Plan 08-05 (SegmentCountdown):** **direct consumer** — receives `UseSegmentAlarmReturn` as the `alarm` prop. Now unblocked.
- **Plan 08-06 (Dashboard wiring + App.tsx):** indirect consumer through `useActiveAlarm`.

Wave 2 progress: 1 of 2 leaves complete (this plan); the SegmentProgressRing leaf can run in parallel as planned.

---
*Phase: 08-wake-easy-preset-segment-countdown-ui*
*Completed: 2026-05-10*
