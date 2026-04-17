---
phase: 03-react-ui
reviewed: 2026-04-17T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - index.html
  - src/App.tsx
  - src/components/Countdown.tsx
  - src/components/ProgressRing.tsx
  - src/engine/__tests__/AlarmEngine.test.ts
  - src/engine/AlarmEngine.ts
  - src/hooks/useAlarm.ts
  - src/index.css
  - src/main.tsx
  - src/utils/formatTime.ts
  - vite.config.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

The React UI layer is generally well-structured. The `AlarmEngine` state machine is correct, timer cleanup is thorough, and the ProgressRing SVG arc math is sound. However, there are several logic bugs in the pause/resume path that cause the displayed countdown to be wrong after resuming, particularly when paused during the idle countdown phase or mid-phase1/phase2. There is also a phase3 resume issue where the volume ramp restarts from zero rather than continuing from the paused point. A duplicate utility function across two components and a missing iOS apple-touch-icon link round out the findings.

---

## Warnings

### WR-01: Resume during `idle` phase shows 00:00 countdown

**File:** `src/hooks/useAlarm.ts:114-118`

**Issue:** `resume()` calls `computePhaseEndsAt(prev.phase, prev.activeConfig)`. When the engine is paused during the idle countdown (before phase1 fires), `prev.phase` is `'idle'`. `computePhaseEndsAt` has no `case 'idle'` branch and falls through to `default: return 0`. This sets `phaseEndsAt` to `0`, causing the Countdown component to display `00:00` for the remainder of the idle countdown, even though the engine's timer has correctly re-registered based on the paused snapshot.

**Fix:** Add an `idle` case to `computePhaseEndsAt` that returns the engine's recalculated `phase1FireAt`. The cleanest approach is to expose `getPhaseFireAt()` from the engine, or to pass the snapshot's remaining time back through the `resume()` call:

```typescript
// Option A: expose phase end times from the engine
case 'idle':
  return now + snap.phase1Remaining; // requires snap to be accessible

// Option B (simpler): have AlarmEngine.resume() return the recalculated fire times
// and update setState with those values instead of re-deriving from config
```

The root fix is that `computePhaseEndsAt` should compute from the _remaining_ duration at pause time, not from the original config duration. The engine already has the correct values in its internal `phase1FireAt`/`phase2FireAt`/`phase3FireAt` fields after `resume()` runs — expose them or return them so the hook can sync.

---

### WR-02: Resume mid-phase1 or mid-phase2 shows wrong countdown duration

**File:** `src/hooks/useAlarm.ts:114-118`

**Issue:** When the alarm is paused during `phase1` or `phase2`, the engine correctly re-registers timers using the _remaining_ durations from the snapshot (e.g. `phase2FireAt = now + snap.phase2Remaining`). However, `resume()` in the hook recomputes `phaseEndsAt` using `computePhaseEndsAt(prev.phase, prev.activeConfig)`, which always uses the _full original config duration_ (`config.phase2DurationMs` for phase1, `config.phase2to3GapMs` for phase2). If the user paused 3 minutes into a 5-minute phase1, the countdown after resume shows 5 minutes remaining instead of 2 minutes.

This is a systematic drift: each pause+resume cycle resets the displayed countdown to the full config duration rather than the actual remaining time.

**Fix:** The hook needs access to remaining times from the engine's post-resume state. Either:
1. Have `AlarmEngine.resume()` return `{ phaseEndsAt: number }` so the hook can use the authoritative value directly.
2. Add a `getPhaseEndsAt(): number` method to `AlarmEngine` that reads the stored `phase1FireAt` / `phase2FireAt` / `phase3FireAt` for the current phase.

```typescript
// AlarmEngine: add a method
getPhaseEndsAt(): number {
  switch (this.phase) {
    case 'idle':    return this.phase1FireAt;
    case 'phase1':  return this.phase2FireAt;
    case 'phase2':  return this.phase3FireAt;
    case 'phase3':  return this.phase3FireAt;
    default:        return 0;
  }
}

// useAlarm.ts: use it in resume()
const resume = (): void => {
  engine.resume();
  setState((prev) => ({
    ...prev,
    isPaused: false,
    phaseEndsAt: engine.getPhaseEndsAt(),
  }));
};
```

---

### WR-03: Phase 3 resume restarts volume ramp from zero

**File:** `src/engine/AlarmEngine.ts:316-318`

**Issue:** When the alarm is paused and resumed during `phase3`, `resume()` calls `this.enterPhase3(this.activeConfig!.phase3RampDurationMs)` with the **full original ramp duration**. `enterPhase3` creates a new `createPhase3Ramp` gain node starting at 0 and ramping to 1 over the full duration. This means a user who paused 50 seconds into a 60-second ramp will wake up to the volume restarting from near-silence and taking another full minute, defeating the escalation guarantee.

```typescript
// Current (incorrect):
} else if (currentPhase === 'phase3') {
  this.enterPhase3(this.activeConfig!.phase3RampDurationMs);
}
```

**Fix:** Snapshot the remaining ramp time in `pauseSnapshot` (or calculate it from `phase3FireAt - now` at pause time) and pass that to `enterPhase3` on resume:

```typescript
// In pause(), add:
phase3RampRemaining: Math.max(0, this.phase3FireAt - now),

// In resume() phase3 branch:
} else if (currentPhase === 'phase3') {
  this.enterPhase3(snap.phase3RampRemaining);
}
```

---

### WR-04: `tickGain` node left connected during pause

**File:** `src/engine/AlarmEngine.ts:238-241`

**Issue:** In `pause()`, the tick loop interval is cleared and set to null, but `this.tickGain` is not disconnected from the audio graph. On iOS/desktop (the code path that uses `tickGain`), the gain node persists as a connected but idle node for the entire pause duration. While this won't produce audible output (no ticks are playing), it leaks a connected audio graph node that holds a reference to `this.ac!.destination`. `cleanup()` does disconnect it, but `pause()` does not, so a pause/resume cycle that stays in phase2 accumulates — `enterPhase2` in `resume()` creates a new `tickGain` without disconnecting the old one, meaning two gain nodes are connected during the resumed phase2.

**Fix:** Disconnect and null the existing `tickGain` in `pause()` before the interval cleanup, and null it after, mirroring what `cleanup()` already does:

```typescript
// In pause(), after clearing tickLoopTimer:
if (this.tickGain) {
  this.tickGain.disconnect();
  this.tickGain = null;
}
```

---

## Info

### IN-01: Duplicate `phaseToIndex` function

**File:** `src/components/Countdown.tsx:37-52` and `src/components/ProgressRing.tsx:64-79`

**Issue:** `phaseToIndex(phase: AlarmPhase): number` is defined identically in both `Countdown.tsx` and `ProgressRing.tsx`. If the `AlarmPhase` type gains a new variant (e.g. a future `snoozing` state), both functions need to be updated independently.

**Fix:** Extract to a shared utility (e.g. `src/utils/phaseToIndex.ts`) and import it in both components.

---

### IN-02: Missing `apple-touch-icon` link in `index.html`

**File:** `index.html:3-7`

**Issue:** CLAUDE.md specifies that `apple-touch-icon` is required for iOS home screen installation. The `vite.config.ts` manifest includes 192px and 512px PNG icons, but does not include an `apple-touch-icon` entry, and `index.html` has no `<link rel="apple-touch-icon" href="...">` tag. iOS Safari uses this link tag (not the manifest icons) for the home screen icon.

**Fix:** Add to `index.html`:
```html
<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180x180.png" />
```
And generate the 180x180 icon via `@vite-pwa/assets-generator`.

---

### IN-03: `AlarmConfig.phase2DurationMs` naming is misleading in the engine's timer math

**File:** `src/engine/AlarmEngine.ts:114-116` and `src/engine/AlarmState.ts:29`

**Issue:** The `AlarmConfig` JSDoc says `phase2DurationMs` is "Duration of Phase 2 before Phase 3 escalation." However, the engine uses it as the time _between phase1 firing and phase2 firing_ — i.e., the duration of phase 1 after the bowl strike, not the duration of phase 2. The field is named `phase2DurationMs` but controls when phase2 starts (the gap after phase1). This naming confusion contributed directly to the `computePhaseEndsAt` bugs in WR-01 and WR-02.

**Fix:** Consider renaming to `phase1to2GapMs` to match the `phase2to3GapMs` naming convention already in use, or update the JSDoc to precisely describe it as "time between phase1 start and phase2 start." This is a breaking rename but would eliminate an ongoing source of bugs.

---

_Reviewed: 2026-04-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
