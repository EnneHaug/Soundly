---
phase: 08-wake-easy-preset-segment-countdown-ui
reviewed: 2026-05-10T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src/hooks/useSegmentAlarm.ts
  - src/hooks/useActiveAlarm.ts
  - src/components/SegmentProgressRing.tsx
  - src/components/SegmentCountdown.tsx
  - src/components/Dashboard.tsx
  - src/App.tsx
  - src/index.css
  - src/hooks/__tests__/useSegmentAlarm.test.ts
  - src/hooks/__tests__/useActiveAlarm.test.ts
  - src/components/__tests__/SegmentProgressRing.test.tsx
  - src/components/__tests__/SegmentCountdown.test.tsx
  - src/components/__tests__/Dashboard.test.tsx
  - src/test/setup.ts
  - vitest.config.ts
  - package.json
findings:
  critical: 0
  warning: 1
  info: 12
  total: 13
severity_counts:
  HIGH: 1
  MEDIUM: 5
  LOW: 4
  INFO: 3
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-05-10
**Depth:** standard (retrospective phase review, advisory)
**Files Reviewed:** 15 (7 source + 5 tests + 3 config; SegmentHarness deletion verified)
**Status:** issues_found

## Summary

Phase 8 lands a clean, well-scoped UI layer on top of the already-shipped
SegmentEngine. The five new files (useSegmentAlarm, useActiveAlarm,
SegmentProgressRing, SegmentCountdown, plus integration in Dashboard / App)
mirror the v1 patterns faithfully. The SEG-05 byte-identical floor is
respected — no protected file was touched (verified by inspection;
`src/dev/SegmentHarness.tsx` no longer exists, and `grep -r SegmentHarness src/`
returns zero matches). TDD discipline is visible in the git history for plans
02 through 05 (test → feat → docs commits in order).

One HIGH-severity correctness bug was found: `useSegmentAlarm.resume()` does
not survive contact with the real engine, which fires `onSegmentChange`
synchronously inside `resume()`. The hook's callback overwrites the
remaining-ms snapshot with a full segment-duration before the hook's own
`setState` runs, so the user's pause-point is silently discarded. The test
suite shields this bug because the mocked `engine.resume` is a bare
`vi.fn()` that does not re-emit the engine's `'start'` callback.

Five MEDIUM items cover test gaps around H-01, an error-path omission for
notification permission rejection, the `finally`-block timing of
`pendingMode`, a flatMap nit in SegmentProgressRing, and the ticker effect's
dependency churn. None block ship.

No security findings. No XSS or credential surface. No engine code changed.

---

## High

### H-01: `useSegmentAlarm.resume()` race — engine's synchronous re-emit overwrites the pause snapshot

**File:** `src/hooks/useSegmentAlarm.ts:163-171`
**Also relevant:** `src/engine/SegmentEngine.ts:304-337` (engine fires `'start'` synchronously inside `resume()`)

**Issue:**
`SegmentEngine.resume()` calls `this.fireChange({ kind: 'start', ... })`
synchronously at line 331. The hook's registered callback (lines 91-120)
unconditionally recomputes `segmentEndsAt = Date.now() + event.segment.durationMs`
on every `'start'` event — including the resume re-emit, where the correct
value is `Date.now() + previouslyStoredRemainingMs`, **not** a full segment
duration.

Trace:

1. User paused at t=2:00 into segment 1 (2:00 remaining).
2. `pause()` stores `segmentEndsAt = 2:00 = 120_000` (remaining ms snapshot).
3. User resumes 60s later. Hook calls `engine.resume()`.
4. Engine fires `'start'` synchronously. Hook callback recomputes
   `segmentEndsAt = Date.now() + segment.durationMs` (full 4:00 = 240_000).
5. Hook's own `setState` then runs: `segmentEndsAt = Date.now() + prev.segmentEndsAt`
   — but `prev.segmentEndsAt` is now the post-callback value (240_000),
   not the pre-resume snapshot (120_000).
6. Net result: timer shows "04:00 remaining" instead of "02:00 remaining".
   The user's pause-point is silently discarded.

**Why the test suite does not catch this:** `useSegmentAlarm.test.ts:189-228`
mocks `engine.resume` as a bare `vi.fn()` with no synchronous callback
re-emit. The mock does not simulate the engine's reality at SegmentEngine.ts:331-336.

**Fix:**
```ts
const resume = (): void => {
  // Capture the remaining-ms snapshot BEFORE engine.resume fires its
  // synchronous 'start' callback (which would otherwise overwrite
  // segmentEndsAt with a full-duration value).
  const segRemaining = state.segmentEndsAt;
  const totalRemaining = state.totalEndsAt;
  engine.resume();
  setState((prev) => ({
    ...prev,
    isPaused: false,
    segmentEndsAt: Date.now() + segRemaining,
    totalEndsAt: Date.now() + totalRemaining,
  }));
};
```
Or alternatively: gate the callback's `segmentEndsAt` recomputation behind a
"not currently resuming" flag managed by the hook, so the engine's re-emit
is ignored for the one tick during resume.

**Severity rationale:** HIGH because this directly breaks the documented
pause/resume contract (D-19) under real engine behaviour. The audio engine
is unaffected — pause/resume audio scheduling works correctly (SegmentEngine
handles its own snapshot). The bug is confined to the UI timer display, but
the timer is the primary glance target of the entire countdown screen.

---

## Medium

### M-01: Test gap shields H-01 — mocked engine.resume does not re-emit the synchronous `'start'` callback

**File:** `src/hooks/__tests__/useSegmentAlarm.test.ts:189-228` (also lines 16-37)

**Issue:** The mock setup at lines 16-33 declares `resume: vi.fn()` with no
implementation. The "resume() restores both fields to fresh epochs" test at
lines 208-228 passes because the mocked resume does not fire the
`onSegmentChange` callback. Real `SegmentEngine.resume` at
SegmentEngine.ts:331-336 fires it synchronously.

**Fix:** Add a regression test that wires `mockEngineInstance.resume` to
synchronously invoke `mockSegmentChangeCb({ kind: 'start', ... })` before
returning, then asserts that the post-resume `segmentEndsAt` reflects the
pause-snapshot remaining ms (not a full segment duration).

```ts
mockEngineInstance.resume = vi.fn(() => {
  // Simulate engine's synchronous re-emit (SegmentEngine.ts:331-336)
  mockSegmentChangeCb?.({
    kind: 'start',
    segmentIndex: 0,
    totalSegments: 5,
    segment: WAKE_EASY_CONFIG.segments[0],
  });
});
```

### M-02: `useActiveAlarm.start` clears `pendingMode` in `finally`, which is correct only because of React batching

**File:** `src/hooks/useActiveAlarm.ts:63-74`

**Issue:** When `start()` resolves successfully, two state updates happen in
sequence: the underlying hook's `setState({...isRunning: true...})` and the
dispatcher's `setPendingMode(null)`. React 18+ batches these inside the same
event loop turn, so the derived `mode` correctly shows `'segments'` (or
`'continuous'`) on the next commit. But the contract is fragile: any future
refactor that splits the awaited `start` across multiple ticks would cause
mode to briefly flip back to `'idle'`. The test at
useActiveAlarm.test.ts:139-173 uses a never-resolving promise, so the
`finally` never fires — the test passes for the wrong reason.

**Fix:** Only clear `pendingMode` on failure:
```ts
start: async (preset: PresetSelection) => {
  setPendingMode(preset.kind);
  try {
    if (preset.kind === 'continuous') {
      await continuous.start(preset.config);
    } else {
      await segments.start(preset.config);
    }
    // Success: pendingMode stays set; the derived `mode = isRunning ? ...`
    // ladder picks up the new running state on the next render.
  } catch (err) {
    setPendingMode(null); // failure — let user retry
    throw err;
  }
},
```

Pair with a test that lets `start()` resolve and asserts `mode === 'segments'`
remains during the resolve→render commit window.

### M-03: Notification permission rejection is silently swallowed in `useSegmentAlarm.start`

**File:** `src/hooks/useSegmentAlarm.ts:122-142`

**Issue:** `await requestNotificationPermission()` can throw under Safari's
callback-style API or if the user previously denied permission with a
revocation flag. If it throws, `engine.start(config)` never runs,
`isRunning` never flips true, and the user is stuck on the Dashboard with no
feedback. UI-SPEC L192 carves this out as "App.tsx wraps the start dispatch
in try/catch with window.alert" — but App.tsx (line 1-17) does not currently
wrap any call site. The only call sites are inside `<Dashboard>` via
`onStart` props (Dashboard.tsx:42, 47, 52), none of which try/catch.

**Fix options (pick one):**

(a) Wrap the dispatch in Dashboard.tsx:
```tsx
onStart={() => {
  activeAlarm.start({ kind: 'segments', config: WAKE_EASY_CONFIG })
    .catch((err) => window.alert(`Could not start alarm: ${err.message}`));
}}
```

(b) Make `useActiveAlarm.start` catch and surface via returned state.

(c) Accept silent-no-op as v1.0 behaviour (matches existing useAlarm.ts:88-99
which has the same omission). Document the limitation in a follow-up issue.

**Severity:** MEDIUM because the failure mode is silent-no-op (no crash, no
data loss), and the realistic failure path for the fixed Wake Easy preset is
narrow (`validateSegmentConfig` is no-throw, the only remaining throw site
is `AudioContext.resume()` rejection on iOS Safari with a stale context).

### M-04: `SegmentProgressRing` returns nested arrays from `.map()`, then identity-maps the result

**File:** `src/components/SegmentProgressRing.tsx:165-176`

**Issue:**
```tsx
return [track, activeFill];           // line 165 — pair per segment
// ...
{renderedArcs.map((pair) => pair)}    // line 176 — identity map is a no-op
```
React unwraps nested arrays at render time, so this works. But the identity
`.map((pair) => pair)` is dead code. Replace with `flatMap`:

```tsx
const renderedArcs = arcs.flatMap(({ i, segment, start, end, arcLen }) => {
  // ... existing branches ...
  return [track, activeFill].filter(Boolean);
});
// ...
{renderedArcs}
```

Existing keys (`track-${i}` and `fill-${i}`) are already distinct, so
flattening loses nothing. This is purely a tidiness fix; no functional
defect.

### M-05: `SegmentCountdown` `formatMmSs(0)` during firing-alarm when `elapsedSinceAlarmMs === 0` shows "00:00" for ~250ms

**File:** `src/components/SegmentCountdown.tsx:44, 54-63, 109`

**Issue:** When the engine transitions to `firing-alarm`, the `useEffect` at
line 48 re-runs and sets `setElapsedSinceAlarmMs(Date.now() - alarm.alarmStartedAt)`
immediately (line 55). However the initial useState at line 44 sets it to
`0` regardless of how long the alarm has been firing. There is a one-render
window where the big timer shows `00:00` even if the alarm started 5s ago
(e.g. on a re-mount mid-firing). The seed values at lines 38-44 should
account for the firing-alarm state:

```tsx
const [elapsedSinceAlarmMs, setElapsedSinceAlarmMs] = useState(() =>
  alarm.state === 'firing-alarm' && alarm.alarmStartedAt > 0
    ? Math.max(0, Date.now() - alarm.alarmStartedAt)
    : 0,
);
```

**Severity:** MEDIUM — the test at SegmentCountdown.test.tsx:152-166 passes
because it re-renders into the firing-alarm state from a non-firing initial
state, and the effect's immediate `setElapsedSinceAlarmMs` line runs before
the assertion. But a real iOS Safari re-mount (after backgrounding for >30s)
during firing-alarm would briefly flash `00:00` on the user. Same pattern
applies to the seeded `segmentRemainingMs` and `totalRemainingMs` — they
already handle `Math.max(0, ...)` correctly because their epochs are
non-zero during running.

---

## Low

### L-01: `arcPath` `largeArc` flag is correct for Wake Easy but dormant for future single-large-segment configs

**File:** `src/components/SegmentProgressRing.tsx:66`

**Issue:** `const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;` is
correct. Wake Easy's max single-segment arc is ~1.47 rad (well under π).
Phase 9's composer may produce single segments > 180° (e.g. one 50-min
segment in a 60-min composition). The largeArc gate already handles this —
flagging only as forward-compatibility note.

### L-02: Floating-point cumulative drift in arc layout

**File:** `src/components/SegmentProgressRing.tsx:86-93`

**Issue:** The cumulative `cursor` may drift by a few microradians over N
segments due to FP arithmetic. Visually invisible (SVG sub-pixel) but worth
noting for any future test that asserts exact path geometry.

### L-03: `pause()` snapshot stores 0 if called <250ms before a segment-boundary fire

**File:** `src/hooks/useSegmentAlarm.ts:158-159`

**Issue:** If `prev.segmentEndsAt - Date.now() < 0`, `Math.max(0, ...)`
clamps to 0. On resume, `Date.now() + 0 === Date.now()`, so the next 250ms
ticker tick fires the boundary effectively immediately. Engine handles this
correctly (`SegmentEngine.resume` re-registers the timer at the new epoch).
Net effect: minor visual jitter, ~250ms. Not a real bug.

### L-04: Ticker effect re-creates `setInterval` on every segment boundary

**File:** `src/components/SegmentCountdown.tsx:67-74`

**Issue:** The dep array includes `alarm.segmentEndsAt`, `alarm.totalEndsAt`,
`alarm.state`, `alarm.alarmStartedAt`, all of which change during normal
running (5 segment boundaries over a 17-min Wake Easy session, plus a state
change to firing-alarm). Each change tears down and re-creates the 250ms
interval. This is actually necessary for freshness — the interval body
captures the prop values at effect-creation time, so re-creation ensures the
latest `segmentEndsAt` is used. Documenting as LOW so a future maintainer
doesn't try to "optimize" by trimming the dep list and silently break
freshness.

---

## Info

### I-01: useActiveAlarm pendingMode race-window test passes for the wrong reason

**File:** `src/hooks/__tests__/useActiveAlarm.test.ts:139-173`

The test uses a never-resolving promise, so the `finally` block at
useActiveAlarm.ts:71-73 never runs. As a result, the test cannot detect the
M-02 quasi-regression. Add a paired test using a *resolving* promise that
asserts `mode === 'segments'` is stable across the resolve commit boundary.

### I-02: SegmentProgressRing accessibility — competing announcements

**File:** `src/components/SegmentProgressRing.tsx:170-180`

The `<svg role="img" aria-label="Alarm progress">` and the absolutely-positioned
overlay (`<div className="absolute inset-0 ...">` containing the big timer,
total caption, segment label) both contribute to the screen-reader
announcement. UI-SPEC L505-516 explicitly carves this out as inherited v1
behaviour. No action needed for Phase 8.

### I-03: Effect deps omit setState identity (cosmetic)

**File:** `src/components/SegmentCountdown.tsx:67-74`

React's `setState` setters are guaranteed identity-stable, so omitting them
is correct. Some strict ESLint configs (`react-hooks/exhaustive-deps`) flag
this. If the project's `eslint .` (`package.json:5`) catches it, prefer the
ESLint-comment escape over adding the setters to the dep array.

---

## Verification Notes

- SegmentHarness deletion: confirmed. No `src/dev/` directory; `grep -r
  "SegmentHarness" src/` returns zero matches; App.tsx (lines 1-17) has no
  SegmentHarness import or `?dev=segments` URL handling.
- SEG-05 byte-identical floor: respected. None of the protected files
  (`AlarmEngine.ts`, `useAlarm.ts`, `Countdown.tsx`, `ProgressRing.tsx`,
  etc.) appear in the Phase 8 diff. The only modification to an existing
  presentation file is the keyframes append to `src/index.css` (lines 20-30)
  — additive, not modifying any existing rule.
- TDD discipline: git log shows test → feat → docs commit order for plans
  02 through 05 (commits 70ea5e9 → b9d5a7f → 125cf6c, etc.).
- TS strict-mode discriminated-union narrowing: `App.tsx:11-13` narrows on
  `activeAlarm.mode` without casts; `Dashboard.tsx:27`'s `Extract<...,
  { mode: 'idle' }>` correctly constrains the prop type. No `as any` or
  unsafe assertions found in the Phase 8 source.
- CSS pulse keyframes: gated by `@media (prefers-reduced-motion:
  no-preference)` (src/index.css:26-30). Correct semantic — animation fires
  ONLY when user has not expressed a motion preference.
- Notification permission timing (D-18): `requestNotificationPermission` is
  called inside `useSegmentAlarm.start` (line 124), invoked from
  `useActiveAlarm.start` (line 67/69), which is invoked from the
  `PresetCard.onStart` user-gesture callback. User-gesture chain preserved.

---

_Reviewed: 2026-05-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
