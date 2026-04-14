---
phase: 02-background-reliability
reviewed: 2026-04-14T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/engine/AlarmEngine.ts
  - src/engine/AlarmState.ts
  - src/engine/index.ts
  - src/engine/sounds/tickPulse.ts
  - src/platform/vibration.ts
  - src/platform/wakeLock.ts
  - src/platform/notifications.ts
  - src/platform/standalone.ts
  - src/sw.ts
  - vite.config.ts
  - package.json
  - src/engine/__tests__/AlarmEngine.test.ts
  - src/engine/sounds/__tests__/tickPulse.test.ts
  - src/platform/__tests__/vibration.test.ts
  - src/platform/__tests__/wakeLock.test.ts
  - src/platform/__tests__/notifications.test.ts
  - src/platform/__tests__/standalone.test.ts
findings:
  critical: 0
  warning: 5
  info: 5
  total: 10
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-14
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

This phase delivers the background reliability layer: Wake Lock, Vibration API, notification
support, iOS tick-pulse fallback, PWA service worker, and integration of all these into
`AlarmEngine`. The architecture is sound — feature detection is consistent, each platform
module degrades gracefully, and test coverage is thorough. No critical (security/crash)
issues were found.

Five warnings address real correctness risks: a module-level mutable singleton in
`vibration.ts` that causes cross-test state leakage (confirmed by design, but also a prod
concern), a missing check that allows `enterPhase2` to access a null AudioContext, a timing
gap in the Phase 2 → Phase 3 boundary that means the tick loop fires one extra time, an
unguarded `phase3FireAt` calculation that makes Phase 3 always fire after phase2 ends even
when `phase2to3GapMs` is intended as a gap from Phase 2 start, and a missing apple-touch-icon
entry in the PWA manifest.

Five info items cover code quality: duplicate preset configs, a missing `workbox-window`
dev dependency, `console.debug` calls left in production paths, a `validateConfig` edge case
for zero-duration gaps, and an exported internal helper in `index.ts`.

---

## Warnings

### WR-01: Module-level `_handle` singleton in `vibration.ts` causes cross-call contamination

**File:** `src/platform/vibration.ts:23`
**Issue:** `_handle` is a module-level variable. If `startVibration()` is called while a
previous interval is still running (e.g., due to a bug in the caller), the old interval is
silently orphaned — there is no guard that clears an existing `_handle` before setting a
new one. In production, a race or double-call would leak a vibration interval that can
never be cleared because `_handle` is overwritten. The same pattern in `wakeLock.ts`
(`_sentinel`, `_shouldHoldLock`) has a similar cross-call risk.

**Fix:**
```ts
export function startVibration(): void {
  if (!('vibrate' in navigator)) return;
  // Clear any existing interval before starting a new one
  if (_handle !== null) {
    clearInterval(_handle);
    _handle = null;
  }
  navigator.vibrate(PATTERN);
  _handle = setInterval(() => navigator.vibrate(PATTERN), CYCLE_MS);
}
```

---

### WR-02: `enterPhase2` accesses `this.ac!` without checking AudioContext state

**File:** `src/engine/AlarmEngine.ts:152-165`
**Issue:** `enterPhase2` is called from a timer callback scheduled by `start()`. By the
time the timer fires, `this.ac` could theoretically be `null` if `stop()` or `dismiss()`
was called between timer registration and firing. The timer is cancelled in `cleanup()` via
`this.timers.forEach(t => t.cancel())`, so this should not happen in normal flow — but
only if `scheduleAt` cancellation is synchronous and reliable. If the timer implementation
has any edge case where a callback fires after `cancel()` (e.g., already-enqueued
microtask), the non-null assertion `this.ac!` in `enterPhase2` will throw at runtime with
a confusing error rather than silently no-oping.

**Fix:** Add a guard at the top of `enterPhase2`:
```ts
private enterPhase2(durationMs: number): void {
  if (!this.ac || !this._running) return; // guard against post-cleanup fire
  if ('vibrate' in navigator) {
    startVibration();
  } else {
    // ... tick pulse setup
  }
}
```
Apply the same guard to `enterPhase3`.

---

### WR-03: Tick interval fires one extra cycle after Phase 3 transition

**File:** `src/engine/AlarmEngine.ts:162-165`
**Issue:** The tick loop (`this.tickLoopTimer`) is started in `enterPhase2` but is only
cleared in `cleanup()`, which is called by `stop()` or `dismiss()` — not when Phase 3
naturally starts. When Phase 3 fires (via `enterPhase3`), the tick interval continues
running alongside Phase 3 audio until the user explicitly stops or dismisses. This means
the tick sound plays concurrently with the Phase 3 rising swell, which contradicts the
intended escalation design where each phase replaces the previous.

**Fix:** Stop the tick loop (and disconnect `tickGain`) at the start of `enterPhase3`:
```ts
private enterPhase3(rampDurationMs: number): void {
  // Stop Phase 2 tick loop if it was running (iOS path)
  if (this.tickLoopTimer !== null) {
    clearInterval(this.tickLoopTimer);
    this.tickLoopTimer = null;
  }
  if (this.tickGain) {
    this.tickGain.disconnect();
    this.tickGain = null;
  }

  this.setPhase('phase3');
  // ... rest of phase3 setup
}
```

---

### WR-04: `phase3FireAt` calculation ignores Phase 2 end — gap is measured from Phase 2 start

**File:** `src/engine/AlarmEngine.ts:108`
**Issue:** The comment says "configurable gap between Phase 2 end and Phase 3 start", and
the field is named `phase2to3GapMs`. However the calculation is:
```ts
const phase2FireAt = phase1FireAt + config.phase2DurationMs;
const phase3FireAt = phase2FireAt + config.phase2to3GapMs;
```
`phase2FireAt` is the moment Phase 2 *starts* (fires). So `phase3FireAt` is
`phase2StartTime + phase2to3GapMs`, not `phase2EndTime + phase2to3GapMs`. Phase 2 has no
tracked "end time" separate from "start time" — the phase runs for `phase2DurationMs` and
then Phase 3 should follow after an additional gap. As currently written, Phase 3 fires
`phase2to3GapMs` after Phase 2 *starts*, which is only a gap of `phase2to3GapMs -
phase2DurationMs` after Phase 2 would notionally end — and with `phase2to3GapMs=10_000`
and `phase2DurationMs=300_000`, Phase 3 fires 10 seconds after Phase 2 starts, not 10
seconds after Phase 2 ends. This effectively collapses Phase 2 from 5 minutes to 10
seconds.

Wait — re-reading: `phase2FireAt = phase1FireAt + phase2DurationMs`. `phase1FireAt` is
when Phase 1 fires. So Phase 2 fires at `phase1Start + phase2Duration`. That means Phase 2
fires after Phase 1 has been running for `phase2DurationMs`. Phase 3 then fires
`phase2to3GapMs` after Phase 2 fires. This is internally consistent with the naming in
`AlarmState.ts` where `phase2DurationMs` is described as "Duration of Phase 2 before Phase
3 escalation". The field name is confusing but the math is correct per the spec. The
naming and the comment on line 108 are misleading, however — `phase2to3GapMs` is used as
the time *between Phase 2 start and Phase 3 start*, which with defaults (10s gap) means
Phase 3 fires 10 seconds after Phase 2 starts. Phase 2 does not "run" for `phase2DurationMs`
before Phase 3 — `phase2DurationMs` is actually the countdown from Phase 1 fire to Phase 2
fire, not the duration of Phase 2 itself. **The field naming is actively misleading and
will cause misconfiguration.**

Rename `phase2DurationMs` → `phase1to2GapMs` (gap from Phase 1 fire to Phase 2 fire) and
update comments, or restructure the calculations to make the timeline explicit. At minimum,
update the comment on line 108:
```ts
// phase3FireAt = phase2 start + gap
// NOTE: phase2DurationMs is the delay from phase1 fire to phase2 fire,
// not the duration phase2 plays. phase2to3GapMs is additional time after phase2 starts.
const phase3FireAt = phase2FireAt + config.phase2to3GapMs;
```

---

### WR-05: `apple-touch-icon` missing from PWA manifest

**File:** `vite.config.ts:22-27`
**Issue:** The manifest `icons` array includes 192px, 512px, and maskable variants, but
omits an `apple-touch-icon` entry. iOS Safari requires a separate `<link rel="apple-touch-icon">` in the HTML `<head>` or a manifest icon with `purpose: "apple-touch-icon"` for correct home-screen icon display. Without it, iOS uses the 192px PNG without rounding/masking, producing a sub-optimal home-screen appearance and potentially failing iOS PWA installability heuristics.

**Fix:** Add an apple-touch-icon to the manifest and/or ensure `index.html` contains:
```html
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
```
And generate the apple-touch-icon asset with `@vite-pwa/assets-generator`. In `vite.config.ts`:
```ts
{ src: 'icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
```

---

## Info

### IN-01: `DEFAULT_CONFIG` and `QUICK_NAP_CONFIG` are identical

**File:** `src/engine/AlarmState.ts:51-64`
**Issue:** `DEFAULT_CONFIG` and `QUICK_NAP_CONFIG` have identical field values. One of them
is redundant. If both are intentional (one is the out-of-box default, one is a named
preset), this should be documented explicitly so future changes to `DEFAULT_CONFIG` don't
silently diverge from the preset without updating both.

**Fix:** Either derive one from the other, or add a comment explaining why they are
intentionally identical:
```ts
/** Quick Nap preset — identical to DEFAULT_CONFIG by design. */
export const QUICK_NAP_CONFIG: AlarmConfig = { ...DEFAULT_CONFIG };
```

---

### IN-02: `console.debug` calls remain in production paths in `wakeLock.ts`

**File:** `src/platform/wakeLock.ts:48, 53`
**Issue:** `console.debug('[WakeLock] released by OS')` and `console.debug('[WakeLock]
acquisition failed:', err)` will appear in production console output. While `console.debug`
is filtered out in most browser devtools by default, it still runs and pollutes the output
for users who have verbose logging enabled.

**Fix:** Either remove them or gate them behind a `__DEV__` / `import.meta.env.DEV` flag:
```ts
if (import.meta.env.DEV) {
  console.debug('[WakeLock] acquisition failed:', err);
}
```

---

### IN-03: `validateConfig` allows `phase2to3GapMs = 1` (effectively no gap)

**File:** `src/engine/AlarmState.ts:84-105`
**Issue:** The validation requires `> 0` for all fields including `phase2to3GapMs`. A value
of `1ms` passes validation but provides no meaningful gap. This is low risk given the
preset configs use 10_000ms, but it is a silent footgun for custom configs. A minimum of
1000ms (1 second) would be a more meaningful lower bound for timing values.

**Fix:**
```ts
const MIN_TIMING_MS = 1_000; // 1 second minimum for meaningful phase gaps
if (field === 'phase2to3GapMs' && value < MIN_TIMING_MS) {
  throw new Error(`AlarmConfig.${field} must be >= ${MIN_TIMING_MS}ms, got ${value}`);
}
```

---

### IN-04: `playTick` and platform functions exported from engine `index.ts` — implementation details leak

**File:** `src/engine/index.ts:24-26`
**Issue:** `playTick`, `startVibration`, `stopVibration`, `acquireWakeLock`,
`releaseWakeLock`, and `attachVisibilityReacquire` are exported from the engine barrel.
These are implementation details of `AlarmEngine`, not part of its public API surface.
Exporting them encourages callers to bypass the engine and call them directly, which
creates ordering/state dependencies outside of `AlarmEngine`'s lifecycle management.

**Fix:** Remove the platform and sound implementation exports from `src/engine/index.ts`.
Consumers should interact only with `AlarmEngine` and its config types:
```ts
// Remove these lines from index.ts:
export { playTick } from './sounds/tickPulse';
export { startVibration, stopVibration } from '../platform/vibration';
export { acquireWakeLock, releaseWakeLock, attachVisibilityReacquire } from '../platform/wakeLock';
```

---

### IN-05: `workbox-window` not listed in dependencies but `workbox-precaching` is in devDependencies

**File:** `package.json:1`
**Issue:** `workbox-precaching` is in `devDependencies`, but it is used at runtime in
`src/sw.ts` which is compiled into the service worker bundle. Service worker code is
bundled at build time, so placing Workbox in `devDependencies` is acceptable for Vite
builds (it is only needed for the build step). However, the placement should be documented
— moving it to `dependencies` or adding a comment in `package.json` would prevent future
contributors from accidentally pruning it. No functional defect, but worth noting.

**Fix:** Add a comment or move to `dependencies`:
```json
"dependencies": {
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "workbox-precaching": "^7.4.0"
}
```

---

_Reviewed: 2026-04-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
