---
phase: 01-audio-engine-and-timer
reviewed: 2026-04-14T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/engine/AlarmEngine.ts
  - src/engine/AlarmState.ts
  - src/engine/AudioContext.ts
  - src/engine/index.ts
  - src/engine/sounds/keepalive.ts
  - src/engine/sounds/phase3Tone.ts
  - src/engine/sounds/singingBowl.ts
  - src/engine/sounds/testSound.ts
  - src/engine/timer.ts
findings:
  critical: 2
  warning: 4
  info: 4
  total: 10
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-14
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

The audio engine implementation is well-structured. The state machine, factory
patterns for AudioNodes, and drift-free timer design are sound. The code is
clearly commented and decisions are well-referenced against the research docs.

Two critical issues were found: a GainNode resource leak across multiple
start/stop cycles, and a dismiss-before-completion race where Phase 3 audio
clicks audibly because the oscillator is stopped before the gain fade runs. Four
warnings cover: past-timestamp silent no-op in the timer, no way to stop a
still-ringing bowl on dismiss, a `isolatedModules` build-break risk in the
barrel export, and missing minimum validation on the Phase 3 ramp duration. Four
info items cover magic numbers, direct-to-destination routing, a misleading
config comment, and a semicolon style inconsistency.

## Critical Issues

### CR-01: Keepalive GainNode leaks on every start/stop cycle

**File:** `src/engine/sounds/keepalive.ts:30` / `src/engine/AlarmEngine.ts:184-186`

**Issue:** `startKeepalive` creates a `GainNode` internally and connects it to
`ac.destination`, but returns only the `OscillatorNode`. The `GainNode` reference
is dropped immediately and cannot be retrieved. `stopKeepalive` stops the
oscillator but never calls `gain.disconnect()`. Each `start()` → `stop()` cycle
permanently attaches one orphaned `GainNode` to the audio destination with no way
to remove it. In a single session this is harmless; across multiple alarm cycles
(user sets, cancels, sets again) the nodes accumulate.

**Fix:**

```typescript
// keepalive.ts — expose both nodes via a handle
export interface KeepaliveHandle {
  osc: OscillatorNode;
  gain: GainNode;
}

export function startKeepalive(ac: AudioContext): KeepaliveHandle {
  const osc = new OscillatorNode(ac, { type: 'sine', frequency: 1 });
  const gain = new GainNode(ac, { gain: 0 });
  osc.connect(gain).connect(ac.destination);
  osc.start();
  return { osc, gain };
}

export function stopKeepalive(handle: KeepaliveHandle): void {
  try { handle.osc.stop(); } catch { /* already stopped */ }
  handle.gain.disconnect();
}

// AlarmEngine.ts — update field type and cleanup call
private keepaliveHandle: KeepaliveHandle | null = null;

// in start():
this.keepaliveHandle = startKeepalive(this.ac);

// in cleanup():
if (this.keepaliveHandle) {
  stopKeepalive(this.keepaliveHandle);
  this.keepaliveHandle = null;
}
```

---

### CR-02: Phase 3 oscillator stopped before gain fade — audible click on dismiss

**File:** `src/engine/AlarmEngine.ts:195-205`

**Issue:** `cleanup()` stops the Phase 3 swell oscillator at line 195-200, then
calls `fadeOutGain()` at line 203. The oscillator stop is what causes the audible
click artifact (abrupt signal termination). By the time `fadeOutGain` schedules its
`setTargetAtTime`, the oscillator feeding the gain node is already silent — the
fade smooths silence, not the actual signal. The click-prevention mechanism is
inverted.

```typescript
// Current order (wrong — click occurs at oscillator stop, not after)
try {
  this.phase3SwellOsc?.stop();        // ← click happens here
} catch { }
this.phase3SwellOsc = null;

if (this.phase3RampGain && this.ac) {
  fadeOutGain(this.phase3RampGain, this.ac);  // ← fades silence, too late
  this.phase3RampGain = null;
}
```

**Fix:** Fade the gain first, then schedule the oscillator stop after the fade
window elapses. The `fadeOutGain` time constant is 15ms, so 100ms is a
comfortable window:

```typescript
// Corrected order — fade gain first, stop oscillator after
if (this.phase3RampGain && this.ac) {
  fadeOutGain(this.phase3RampGain, this.ac);
  const osc = this.phase3SwellOsc;
  this.phase3SwellOsc = null;
  this.phase3RampGain = null;
  // Stop oscillator after fade completes to avoid audible click
  setTimeout(() => {
    try { osc?.stop(); } catch { /* already stopped */ }
  }, 100);
} else {
  try { this.phase3SwellOsc?.stop(); } catch { /* already stopped */ }
  this.phase3SwellOsc = null;
}
```

---

## Warnings

### WR-01: Negative delay passed to `setTimeout` when target is already past

**File:** `src/engine/timer.ts:58`

**Issue:** The initial `setTimeout` call uses `Math.min(targetEpochMs -
Date.now(), checkIntervalMs)` without clamping to zero. If the target timestamp
is already in the past, the computed delay is negative. Browsers treat negative
`setTimeout` delays as `0`, so the callback fires immediately on the next tick —
correct behavior, but silently so. If `AlarmEngine` ever passes a stale
`phase1FireAt` (e.g., due to clock skew or a slow `getAudioContext()` await),
all three phases fire in rapid succession with no warning.

**Fix:**

```typescript
// Clamp and warn if target is already past
const initialRemaining = targetEpochMs - Date.now();
if (initialRemaining < 0) {
  console.warn(
    `scheduleAt: target ${targetEpochMs} is ${-initialRemaining}ms in the past — firing immediately`
  );
}
timeoutId = setTimeout(tick, Math.max(0, Math.min(initialRemaining, checkIntervalMs)));
```

---

### WR-02: Singing bowl oscillators cannot be stopped on early dismiss

**File:** `src/engine/sounds/singingBowl.ts:68-78` / `src/engine/AlarmEngine.ts:101`

**Issue:** `strikeBowl()` creates 5 oscillators with self-scheduled stops at up to
`now + 6.18s` (fundamental: `0.08 + 6.0 + 0.1`). No references are returned or
stored. If the user dismisses the alarm within 6 seconds of Phase 1 firing,
`cleanup()` has no handles to stop them — the bowl continues audibly after dismiss.

**Fix:** Return and track the created oscillators:

```typescript
// singingBowl.ts — return OscillatorNode[]
function createPartial(/* ... */): OscillatorNode {
  const osc = new OscillatorNode(ac, { type: 'sine', frequency: freq });
  const gainNode = new GainNode(ac, { gain: 0 });
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(peakGain, startTime + attackTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + attackTime + decayTime);
  osc.connect(gainNode).connect(ac.destination);
  osc.start(startTime);
  osc.stop(startTime + attackTime + decayTime + 0.1);
  return osc;
}

export function strikeBowl(ac: AudioContext, masterGain = 1.0): OscillatorNode[] {
  const now = ac.currentTime;
  const fund = 220;
  return [
    createPartial(ac, fund,          0.35 * masterGain, 0.08, 6.0, now),
    createPartial(ac, fund * 2.76,   0.20 * masterGain, 0.05, 4.5, now),
    createPartial(ac, fund * 4.72,   0.12 * masterGain, 0.03, 3.5, now),
    createPartial(ac, fund * 6.83,   0.06 * masterGain, 0.02, 2.5, now),
    createPartial(ac, fund * 1.003,  0.15 * masterGain, 0.08, 5.5, now),
  ];
}

// AlarmEngine.ts — store and stop bowl oscillators
private bowlOscs: OscillatorNode[] = [];

// In phase1 callback:
this.bowlOscs = strikeBowl(this.ac!, 1.0);

// In cleanup():
this.bowlOscs.forEach((osc) => {
  try { osc.stop(); } catch { /* already stopped */ }
});
this.bowlOscs = [];
```

---

### WR-03: Type-only exports in barrel use value export syntax — `isolatedModules` build break

**File:** `src/engine/index.ts:13-19`

**Issue:** `AlarmPhase`, `AlarmConfig`, and `PhaseChangeCallback` are TypeScript
types/interfaces, but the barrel exports them with value syntax (`export { ... }`).
Vite uses esbuild which requires `isolatedModules`-compatible exports. If
`isolatedModules: true` is set in `tsconfig.json` (the Vite default), this
produces a build error: "Re-exporting a type when '--isolatedModules' flag is
provided requires using 'export type'".

**Fix:**

```typescript
// index.ts — separate type exports from value exports
export type { AlarmPhase, AlarmConfig, PhaseChangeCallback } from './AlarmState';
export { DEFAULT_CONFIG, validateConfig } from './AlarmState';
export { AlarmEngine } from './AlarmEngine';
export { getAudioContext } from './AudioContext';
export { playTestSound, TEST_SOUND_GAIN } from './sounds/testSound';
```

---

### WR-04: `phase3RampDurationMs` accepts any positive value — 1ms passes validation but breaks synthesis

**File:** `src/engine/AlarmState.ts:68-88`

**Issue:** `validateConfig` accepts any value `> 0` for `phase3RampDurationMs`.
A value of `1` (1 millisecond) is valid per the current check, but
`createPhase3Ramp` would schedule a `linearRampToValueAtTime` to complete in
0.000001 seconds — effectively an instant jump to full volume, which is jarring
and defeats Phase 3's design intent (gradual escalation). There is no floor that
reflects the practical synthesis minimum.

**Fix:** Add a minimum bound reflecting a meaningful ramp duration:

```typescript
// In validateConfig(), after the shared field loop:
const PHASE3_RAMP_MIN_MS = 5_000; // 5 seconds minimum — must be long enough to ramp
if (config.phase3RampDurationMs < PHASE3_RAMP_MIN_MS) {
  throw new Error(
    `AlarmConfig.phase3RampDurationMs must be >= ${PHASE3_RAMP_MIN_MS}ms (5s), got ${config.phase3RampDurationMs}`
  );
}
```

---

## Info

### IN-01: Magic numbers in `fadeOutGain` — target value and time constant undocumented

**File:** `src/engine/sounds/phase3Tone.ts:84`

**Issue:** `0.0001` and `0.015` appear without explanation. The choice of
`0.0001` over `0` and the 15ms time constant are not self-evident.

**Fix:** Extract as named constants with comments:

```typescript
// Near-zero target rather than 0 — perceptually silent at ~-80dB
const FADE_OUT_TARGET = 0.0001;
// 15ms time constant — tail is inaudible, fade completes within ~75ms (5 time constants)
const FADE_TIME_CONSTANT_SEC = 0.015;
gain.gain.setTargetAtTime(FADE_OUT_TARGET, ac.currentTime, FADE_TIME_CONSTANT_SEC);
```

---

### IN-02: Bowl partials connect directly to `ac.destination` — bypasses any future master volume

**File:** `src/engine/sounds/singingBowl.ts:46`

**Issue:** All 5 bowl partials route directly to `ac.destination`. The Phase 3
swell routes through a `masterGain` node. If a user-configurable master volume
control is added, the bowl would require a separate routing change whereas the
Phase 3 tone would not. Not a current bug, but worth noting for forward
compatibility.

**Suggestion:** Consider routing partials through an optional `masterGain`
parameter (defaulting to a node connected to destination), matching the Phase 3
routing pattern.

---

### IN-03: `phase2to3GapMs` JSDoc describes semantics incorrectly

**File:** `src/engine/AlarmState.ts:36-39`

**Issue:** The comment says "Gap between Phase 2 end and Phase 3 start." But in
`AlarmEngine.ts:94-95`, Phase 3 fires at `phase2FireAt + phase2to3GapMs`, where
`phase2FireAt` is when Phase 2 *starts* (not ends). The actual semantics are:
Phase 3 fires `phase2DurationMs + phase2to3GapMs` after Phase 1, not
`phase2to3GapMs` after Phase 2 ends. The comment will mislead future callers
about how to tune Phase 2 timing.

**Fix:** Update the JSDoc to reflect the actual computation:

```typescript
/**
 * Additional delay added after phase2FireAt before Phase 3 starts (default 10_000 = 10s).
 * Phase 3 fires at: phase1FireAt + phase2DurationMs + phase2to3GapMs.
 * This extends the total Phase 2 window — it is NOT a gap measured from Phase 2 completion.
 */
phase2to3GapMs: number;
```

---

### IN-04: Missing semicolons in `testSound.ts` — inconsistent with all other engine files

**File:** `src/engine/sounds/testSound.ts:17-18, 28, 42-43`

**Issue:** `testSound.ts` omits semicolons on import statements and the constant
declaration. Every other file in the engine uses semicolons. A linter (ESLint
with `semi` rule) would flag these.

**Fix:** Add semicolons to match project style:

```typescript
import { getAudioContext } from '../AudioContext';
import { strikeBowl } from './singingBowl';

export const TEST_SOUND_GAIN = 0.4;
```

---

_Reviewed: 2026-04-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
