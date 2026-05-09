# Phase 7: Segment Engine + Triangle Sound — Pattern Map

**Mapped:** 2026-05-09
**Files analyzed:** 11 (8 created + 2 modified + barrel)
**Analogs found:** 10 / 11 (one — `SegmentHarness.tsx` — has only a partial-shape analog; treat per RESEARCH.md)
**SEG-05 zero-diff floor:** all analog files are READ-ONLY references — NEVER edit them.

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `src/engine/SegmentEngine.ts` | engine / orchestrator | event-driven (timer fires → audio side effects) | `src/engine/AlarmEngine.ts` | exact (sibling shape) |
| `src/engine/SegmentState.ts` | model / types + pure validator + named config | transform (unknown → discriminated union) | `src/engine/AlarmState.ts` | role-match (validator contract intentionally diverges per SEG-04) |
| `src/engine/sounds/triangle.ts` | utility / synth factory | one-shot side effect (writes audio graph) | `src/engine/sounds/singingBowl.ts` | role-match (single-strike envelope idiom) |
| `src/engine/sounds/segmentSound.ts` | utility / dispatcher | request-response (key → fn call) | `src/engine/sounds/keepalive.ts` | partial (small two-export module shape only) |
| `src/dev/SegmentHarness.tsx` | dev-only React component | event-driven (button → engine; engine cb → log) | `src/components/Countdown.tsx` (React shape + Tailwind only); no functional analog | partial |
| `src/engine/__tests__/SegmentEngine.test.ts` | test | request-response (mock setup + fake-timer drive) | `src/engine/__tests__/AlarmEngine.test.ts` | exact (verbatim mock + helper pattern) |
| `src/engine/__tests__/segmentSound.test.ts` | test | request-response | `src/engine/sounds/__tests__/keepalive.test.ts` | role-match (small dispatch function test) |
| `src/engine/__tests__/validateSegmentConfig.test.ts` | test | transform input → assert output | (no isolated v1 file; closest is the inline `validateConfig` tests in `AlarmEngine.test.ts` lines 96–108) | weak — discriminated-union assertions are new to the codebase |
| `src/engine/sounds/__tests__/triangle.test.ts` | test | request-response | `src/engine/sounds/__tests__/singingBowl.test.ts` | exact (constructor-stub pattern is reusable verbatim) |
| `src/engine/index.ts` (MODIFIED) | barrel | n/a | self (current state at HEAD) | exact (append-only) |
| `src/App.tsx` (MODIFIED) | app entrypoint | n/a | self (current state at HEAD) | exact (single-line dev-gated mount) |

---

## Pattern Assignments

### `src/engine/SegmentEngine.ts` (engine / orchestrator)

**Analog:** `src/engine/AlarmEngine.ts`
**Data-flow shape:** `start(config)` validates → registers N `scheduleAt` timers against absolute epochs → each fire callback dispatches sound + emits `onSegmentChange` → `pause/resume/stop/dismiss` orchestrate cleanup.

**Imports pattern (lines 22–37 of AlarmEngine.ts) — copy this exact import shape, swap `AlarmState` → `SegmentState`:**
```typescript
// AlarmEngine.ts:22-37
import {
  AlarmPhase,
  AlarmConfig,
  PhaseChangeCallback,
  validateConfig,
} from './AlarmState';
import { scheduleAt, TimerHandle } from './timer';
import { strikeBowl } from './sounds/singingBowl';
import {
  createPhase3Ramp,
  startPhase3Swell,
  fadeOutGain,
} from './sounds/phase3Tone';
import { playTick } from './sounds/tickPulse';
import { startAlarmSession, endAlarmSession, type SessionHandle } from './AlarmSession';
import { startVibration, stopVibration } from '../platform/vibration';
```
SegmentEngine adapts: drops `playTick` + `startVibration/stopVibration` (no Phase 2), adds `import { strikeTriangle } from './sounds/triangle'` and `import { fireSegmentEndSound } from './sounds/segmentSound'` (or import only `fireSegmentEndSound` and let it own dispatch).

**Class field shape (lines 39–60 of AlarmEngine.ts) — mirror exactly with naming swaps:**
```typescript
// AlarmEngine.ts:39-60
export class AlarmEngine {
  private ac: AudioContext | null = null;
  private session: SessionHandle | null = null;
  private phase: AlarmPhase = 'idle';
  private _running: boolean = false; // true from start() until stop()/dismiss()
  private _paused: boolean = false;
  private timers: TimerHandle[] = [];
  private phase3RampGain: GainNode | null = null;
  private phase3SwellNodes: OscillatorNode[] | null = null;
  private phase3LoopTimer: ReturnType<typeof setInterval> | null = null;
  private phaseCallback: PhaseChangeCallback | null = null;

  // Pause/resume state (UX-03)
  private pauseSnapshot: { phase1Remaining: number; phase2Remaining: number; phase3Remaining: number } | null = null;
  private phase1FireAt: number = 0;
  private phase2FireAt: number = 0;
  private phase3FireAt: number = 0;
  private activeConfig: AlarmConfig | null = null;
```
**Delta — SegmentEngine fields:** rename `phase` → `state: SegmentEngineState`, drop tick/vibration fields, rename `phase3Ramp*` → `alarmRampGain` / `alarmSwellNodes` / `alarmLoopTimer`, replace per-phase fire-at fields with `epochBaseline: number` + `currentIdx: number = -1`, replace pause snapshot type with `SegmentPauseSnapshot` per CONTEXT D-19. New `private segmentChangeCb: ((e: SegmentChangeEvent) => void) | null = null`.

**Validator gate + reentrancy + session bring-up (lines 93–106 of AlarmEngine.ts):**
```typescript
// AlarmEngine.ts:93-106
async start(config: AlarmConfig): Promise<void> {
  validateConfig(config); // throws on invalid durations (T-01-04)

  if (this._running) {
    throw new Error('AlarmEngine already running');
  }
  this._running = true;

  // Bring up the shared session lifecycle:
  //   AudioContext bring-up + keepalive + Wake Lock + visibility re-acquire (D-06).
  // AlarmSession preserves the v1 ordering and failure profile (D-05).
  this.session = await startAlarmSession();
  this.ac = this.session.ac;
```
**Delta — SegmentEngine.start():** Replace `validateConfig(config); // throws` with the discriminated-union flavor:
```typescript
const result = validateSegmentConfig(config);
if (!result.ok) {
  throw new Error(result.error);   // RESEARCH Open Q #2: throw inside start() — defense-in-depth
}
// reentrancy guard, then await startAlarmSession() identical to AlarmEngine.
```
Then **diverge from AlarmEngine** to do segment-list scheduling instead of fixed phase1/phase2/phase3:
```typescript
this.epochBaseline = Date.now();
this.activeConfig = result.config;
this.state = 'running';
this.currentIdx = 0;
let cumulative = 0;
for (let i = 0; i < result.config.segments.length; i++) {
  cumulative += result.config.segments[i].durationMs;
  const fireAt = this.epochBaseline + cumulative;
  this.timers.push(
    scheduleAt(fireAt, () => this.handleSegmentFire(i))
  );
}
this.fireChange({ kind: 'start', segmentIndex: 0, totalSegments: result.config.segments.length, segment: result.config.segments[0] });
```

**Per-phase fire-callback pattern (AlarmEngine.ts:118–139) — copy the `scheduleAt + push to this.timers` idiom, but in a loop instead of three discrete blocks:**
```typescript
// AlarmEngine.ts:119-139
this.timers.push(
  scheduleAt(phase1FireAt, () => {
    this.setPhase('phase1');
    strikeBowl(this.ac!, 1.0); // full volume singing bowl
  })
);
this.timers.push(
  scheduleAt(phase2FireAt, () => {
    this.setPhase('phase2');
    this.enterPhase2(config.phase2DurationMs);
  })
);
this.timers.push(
  scheduleAt(phase3FireAt, () => {
    this.enterPhase3(config.phase3RampDurationMs);
  })
);
```
**Delta — SegmentEngine fire callback:** Inside `handleSegmentFire(i)` follow CONTEXT D-09 + RESEARCH Pitfall #6 ordering: emit `onSegmentChange({kind:'end', segmentIndex:i})` → increment `currentIdx` → if `endSound === 'alarm'` set state `'firing-alarm'` and run the alarm-segment block; else call `fireSegmentEndSound(this.ac!, segment.endSound)` and emit `'start'` for next segment (or schedule auto-stop if last).

**Phase 3 alarm setup (AlarmEngine.ts:184–216) — REUSE BYTE-IDENTICALLY for the `'firing-alarm'` block:**
```typescript
// AlarmEngine.ts:198-215  (the slice that segment-engine alarm reuses)
this.phase3RampGain = createPhase3Ramp(this.ac!, rampDurationMs / 1000);
this.phase3SwellNodes = startPhase3Swell(this.ac!, this.phase3RampGain);
this.phase3LoopTimer = setInterval(() => {
  this.phase3SwellNodes?.forEach((n) => {
    try {
      n.stop();
    } catch {
      // OscillatorNode may already be stopped — safe to ignore
    }
  });
  this.phase3SwellNodes = startPhase3Swell(this.ac!, this.phase3RampGain!);
}, 3200);
```
**Delta — SegmentEngine alarm block:** rename fields (`alarmRampGain`/`alarmSwellNodes`/`alarmLoopTimer`), pass `segment.durationMs / 1000` as `durationSec`, set `this.state = 'firing-alarm'` BEFORE creating the ramp (ordering matters for `canPause()`).

**`pause()` silent-no-op idiom (AlarmEngine.ts:230–267) — copy first-line guard + snapshot capture, drop Phase 2/Phase 3 fields:**
```typescript
// AlarmEngine.ts:230-243 (first lines + snapshot)
pause(): void {
  if (!this._running || this._paused) return;
  this._paused = true;

  const now = Date.now();
  this.pauseSnapshot = {
    phase1Remaining: Math.max(0, this.phase1FireAt - now),
    phase2Remaining: Math.max(0, this.phase2FireAt - now),
    phase3Remaining: Math.max(0, this.phase3FireAt - now),
  };

  // Cancel pending phase transition timers
  this.timers.forEach((t) => t.cancel());
  this.timers = [];
```
**Delta — SegmentEngine.pause():** First-line guard is `if (!this.canPause()) return;` (covers `_running && !_paused && state !== 'firing-alarm'` per CONTEXT D-03). Snapshot captures `SegmentPauseSnapshot` per CONTEXT D-19: `{ currentSegmentIndex, currentSegmentRemainingMs: nextFireEpoch - now, futureSegmentDurationsMs: durations.slice(currentIdx + 1) }`. Do NOT abort in-flight strike decay envelopes (CONTEXT D-20).

**`canPause()` definition (per CONTEXT D-08, no direct AlarmEngine analog):**
```typescript
canPause(): boolean {
  return this.state !== 'firing-alarm' && this._running && !this._paused;
}
```

**`onSegmentChange` last-wins idiom (AlarmEngine.ts:67–80):**
```typescript
// AlarmEngine.ts:72-80
onPhaseChange(cb: PhaseChangeCallback): void {
  this.phaseCallback = cb;
}

private setPhase(newPhase: AlarmPhase): void {
  this.phase = newPhase;
  this.phaseCallback?.(newPhase);
}
```
**Delta — SegmentEngine:** rename to `onSegmentChange(cb: (e: SegmentChangeEvent) => void)` and `private fireChange(e: SegmentChangeEvent)`. Callback signature is the rich event object, not a bare phase string.

**`stop()` / `dismiss()` thin wrappers (AlarmEngine.ts:336–348) — copy verbatim, swap final `setPhase`:**
```typescript
// AlarmEngine.ts:336-348
stop(): void {
  this.cleanup();
  this.setPhase('idle');
}

dismiss(): void {
  this.cleanup();
  this.setPhase('dismissed');
}
```
**Delta — SegmentEngine:** Both `stop()` and `dismiss()` should set state to `'dismissed'` per CONTEXT D-04 (or `'idle'` for `stop()` — discretion; recommend `'dismissed'` for both since segment runs do not return to idle).

**`cleanup()` ordering — VERBATIM 7-step sequence (AlarmEngine.ts:354–407, see RESEARCH §"Alarm-segment teardown ordering"):**
```typescript
// AlarmEngine.ts:354-407
private cleanup(): void {
  this._running = false;
  this._paused = false;
  this.pauseSnapshot = null;
  this.activeConfig = null;

  // Cancel all pending timers (phase1, phase2, phase3 transitions)
  this.timers.forEach((t) => t.cancel());
  this.timers = [];

  // Tear down the shared session lifecycle (keepalive + wake lock + visibility).
  // Single call replaces the three v1 teardown blocks; ordering inside is reverse-of-start.
  // Position preserved (between timer cancel and stopVibration) to keep v1 byte-identical
  // teardown TIMING per D-04 — this sits where the old keepalive teardown block lived.
  if (this.session) {
    endAlarmSession(this.session);
    this.session = null;
  }

  // (snip — Phase 2 vibration + tick teardown — DROP for SegmentEngine)

  // Stop Phase 3 swell loop (T-01-05: prevents OscillatorNode accumulation)
  if (this.phase3LoopTimer !== null) {
    clearInterval(this.phase3LoopTimer);
    this.phase3LoopTimer = null;
  }

  // Stop Phase 3 swell oscillator stack (every node including the LFO)
  this.phase3SwellNodes?.forEach((n) => {
    try {
      n.stop();
    } catch {
      // Already stopped — safe to ignore
    }
  });
  this.phase3SwellNodes = null;

  // Fade out Phase 3 ramp gain (smooth stop, no audible click per pitfall 4)
  if (this.phase3RampGain && this.ac) {
    fadeOutGain(this.phase3RampGain, this.ac);
    this.phase3RampGain = null;
  }
}
```
**Delta — SegmentEngine.cleanup():** Drop all Phase 2 (`stopVibration`, `tickLoopTimer`, `tickGain`) — SegmentEngine has none. Rename `phase3*` → `alarm*`. **Preserve the exact ordering** at AlarmEngine.ts:355–406 (rationale enumerated in RESEARCH §"Alarm-segment teardown ordering" steps 1–6). The `endAlarmSession(this.session); this.session = null` block must sit between `this.timers = []` and the audio teardown — this is the slot Phase 6 D-04 calls out.

**Auto-stop variant (CONTEXT D-04, no v1 analog):** When the LAST segment is gentle/triangle, after firing `fireSegmentEndSound`, schedule one extra `setTimeout(() => { this.cleanup(); this.setState('dismissed'); }, decayMs)` where `decayMs` per RESEARCH Open Q #1 is the per-key value: `2100` for triangle, `6100` for gentle. Wrap in a tiny helper `getSoundDecayMs(key)` per RESEARCH recommendation.

---

### `src/engine/SegmentState.ts` (model / types + validator)

**Analog:** `src/engine/AlarmState.ts`
**Data-flow shape:** type exports + named-config constants + pure `validateSegmentConfig(unknown)` returning a discriminated union.

**Type-export pattern (AlarmState.ts:20–45):**
```typescript
// AlarmState.ts:20-45
export type AlarmPhase = 'idle' | 'phase1' | 'phase2' | 'phase3' | 'dismissed';

export interface AlarmConfig {
  phase1DurationMs: number;
  phase2DurationMs: number;
  phase3RampDurationMs: number;
  phase2to3GapMs: number;
}

export type PhaseChangeCallback = (phase: AlarmPhase) => void;
```
**Delta — SegmentState.ts:** Same pattern; types come from CONTEXT D-08, D-09, D-19, RESEARCH Code Examples §"SegmentState.ts types + validator skeleton" — `Segment`, `SegmentConfig`, `SegmentEngineState`, `SegmentChangeEvent`, `SegmentPauseSnapshot`, `SegmentValidationResult`. Use the verbatim shapes from RESEARCH lines 721–748.

**Named-config constant pattern (AlarmState.ts:51–72) — `QUICK_NAP_CONFIG` / `FOCUS_CONFIG` are the direct precedent for `WAKE_EASY_CONFIG`:**
```typescript
// AlarmState.ts:58-72
/** Quick Nap: 5 min soft sound, 5 min vibration, 10s gap, 1 min ramp (ALM-02, D-06) */
export const QUICK_NAP_CONFIG: AlarmConfig = {
  phase1DurationMs: 300_000,
  phase2DurationMs: 300_000,
  phase2to3GapMs: 10_000,
  phase3RampDurationMs: 60_000,
};

/** Focus: 21 min soft sound, 2 min vibration, 10s gap, 1 min ramp (ALM-03, D-06) */
export const FOCUS_CONFIG: AlarmConfig = {
  phase1DurationMs: 1_260_000,
  phase2DurationMs: 120_000,
  phase2to3GapMs: 10_000,
  phase3RampDurationMs: 60_000,
};
```
**Delta — `WAKE_EASY_CONFIG`:** uses verbatim shape from CONTEXT specifics (5-segment array, ids `'wake-easy-1'`...`'wake-easy-5'`, durations 240_000×4 + 60_000, last `endSound: 'alarm'`). Use underscore-separated numeric literals to match the v1 codebase convention.

**Validator pattern (AlarmState.ts:84–105) — copy the FIELD-LOOP STRUCTURE, INVERT the contract from `throws` to `return`:**
```typescript
// AlarmState.ts:84-105
export function validateConfig(config: AlarmConfig): void {
  const MAX_MS = 14_400_000; // 4 hours

  const fields: (keyof AlarmConfig)[] = [
    'phase1DurationMs',
    'phase2DurationMs',
    'phase3RampDurationMs',
    'phase2to3GapMs',
  ];

  for (const field of fields) {
    const value = config[field];
    if (value <= 0) {
      throw new Error(`AlarmConfig.${field} must be > 0, got ${value}`);
    }
    if (value > MAX_MS) {
      throw new Error(
        `AlarmConfig.${field} must be <= ${MAX_MS}ms (4 hours), got ${value}`
      );
    }
  }
}
```
**Delta — `validateSegmentConfig`:** Critical contract divergence per SEG-04 + CONTEXT D-11: NEVER throw, return `SegmentValidationResult`. Reuse the `MAX_MS = 14_400_000` constant (CONTEXT D-12 calls out the 4-hour ceiling for consistency with AlarmConfig). Use the full validator body from RESEARCH Code Examples (lines 753–786), including the type guard for non-object input, the empty-array check, and the per-segment loop with first-failure-wins semantics. Error string wording per CONTEXT D-12.

---

### `src/engine/sounds/triangle.ts` (utility / synth factory)

**Analog:** `src/engine/sounds/singingBowl.ts`
**Data-flow shape:** pure factory — input `(ac, masterGain)`, output `void`, side effect: writes new `OscillatorNode` + `GainNode` to the audio graph with attack/decay envelope, schedules self-stop.

**Single-partial envelope idiom (singingBowl.ts:28–49) — `createPartial` is the inner loop pattern; `strikeTriangle` is essentially a **single** `createPartial` call inlined:**
```typescript
// singingBowl.ts:28-49
function createPartial(
  ac: AudioContext,
  freq: number,
  peakGain: number,
  attackTime: number,
  decayTime: number,
  startTime: number,
): void {
  const osc = new OscillatorNode(ac, { type: 'sine', frequency: freq });
  const gainNode = new GainNode(ac, { gain: 0 });

  // Envelope: attack phase
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(peakGain, startTime + attackTime);

  // Envelope: exponential decay — cannot ramp to exactly 0 (spec forbids it)
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + attackTime + decayTime);

  osc.connect(gainNode).connect(ac.destination);
  osc.start(startTime);
  osc.stop(startTime + attackTime + decayTime + 0.1);
}
```

**Public-strike pattern (singingBowl.ts:68–78) — exported function reads `ac.currentTime` once, accepts default-1.0 `masterGain`:**
```typescript
// singingBowl.ts:68-78
export function strikeBowl(ac: AudioContext, masterGain = 1.0): void {
  const now = ac.currentTime;
  const fund = 220;

  // 5 partials per D-01 and D-02 decisions
  createPartial(ac, fund, 0.35 * masterGain, 0.08, 6.0, now);           // fundamental
  createPartial(ac, fund * 2.76, 0.20 * masterGain, 0.05, 4.5, now);    // 1st inharmonic partial
  createPartial(ac, fund * 4.72, 0.12 * masterGain, 0.03, 3.5, now);    // 2nd inharmonic partial
  createPartial(ac, fund * 6.83, 0.06 * masterGain, 0.02, 2.5, now);    // 3rd inharmonic partial
  createPartial(ac, fund * 1.003, 0.15 * masterGain, 0.08, 5.5, now);   // detuned shimmer (D-02)
}
```
**Delta — `strikeTriangle`:** Single oscillator (no inner helper needed), exact body per CONTEXT D-05 / RESEARCH Code Examples §"triangle.ts (final per D-05)" lines 683–693:
```typescript
export function strikeTriangle(ac: AudioContext, masterGain = 1.0): void {
  const t = ac.currentTime;
  const osc = new OscillatorNode(ac, { type: 'sine', frequency: 2793.83 });
  const g = new GainNode(ac, { gain: 0 });
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.4 * masterGain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 2.1);
}
```
Critical: `exponentialRampToValueAtTime(0.001, ...)` — never to 0 (Web Audio spec forbids). Comment must reference AUD-05 + the demo HTML at `.planning/phases/07-segment-engine-triangle-sound/triangle-demo.html` per CONTEXT D-06.

---

### `src/engine/sounds/segmentSound.ts` (utility / dispatcher)

**Analog:** `src/engine/sounds/keepalive.ts` (only for the small two-export module shape; functional logic is pure dispatch).
**Data-flow shape:** input `(ac, key)`, side effect → call `strikeBowl` or `strikeTriangle`, output `void`.

**Module-shape reference (keepalive.ts:28–52) — small file, JSDoc-headed exports, no class:**
```typescript
// keepalive.ts:28-52  (shape only — semantics unrelated)
export function startKeepalive(ac: AudioContext): OscillatorNode {
  const osc = new OscillatorNode(ac, { type: 'sine', frequency: 1 });
  const gain = new GainNode(ac, { gain: 0 }); // silent — gain is zero

  osc.connect(gain).connect(ac.destination);
  osc.start();

  return osc;
}

export function stopKeepalive(osc: OscillatorNode): void {
  try {
    osc.stop();
  } catch {
    // OscillatorNode may already be stopped — safe to ignore
  }
}
```

**Body** — copy verbatim from RESEARCH Code Examples §"segmentSound.ts dispatcher (D-13)" lines 698–716:
```typescript
import { strikeBowl } from './singingBowl';
import { strikeTriangle } from './triangle';

export function fireSegmentEndSound(ac: AudioContext, key: 'gentle' | 'triangle'): void {
  if (key === 'gentle') {
    strikeBowl(ac, 1.0);
  } else {
    strikeTriangle(ac, 1.0);
  }
}
```
**Delta:** signature deliberately rejects `'alarm'` at type level per CONTEXT D-13 — alarm is handled by SegmentEngine directly via `createPhase3Ramp + startPhase3Swell` because of the structural ramp+loop difference. Keep the JSDoc note explicitly recording this carve-out.

---

### `src/dev/SegmentHarness.tsx` (dev-only React component)

**Analog:** `src/components/Countdown.tsx` (React/Tailwind shape only — no functional precedent for engine-driven dev tooling).
**Data-flow shape:** local React state + `useRef` for `SegmentEngine` instance + button onClick handlers wired to `engine.start/pause/resume/stop` + `engine.onSegmentChange` callback pushing to a logs array.

**React shape pattern (Countdown.tsx:14–18, 55–93) — useState + useEffect + useRef + Tailwind classes:**
```typescript
// Countdown.tsx:14-18
import { useState, useEffect, useRef } from 'react';
import type { UseAlarmReturn } from '../hooks/useAlarm';
import type { AlarmPhase } from '../engine';
import ProgressRing from './ProgressRing';
import { formatMmSs } from '../utils/formatTime';
```

```typescript
// Countdown.tsx:55-72  (state + ref pattern)
export default function Countdown({ alarm }: CountdownProps) {
  const [displayRemainingMs, setDisplayRemainingMs] = useState(
    Math.max(0, alarm.phaseEndsAt - Date.now())
  );

  // Track when phase3 started for count-up display
  const phase3StartRef = useRef<number>(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Record when phase3 begins
  useEffect(() => {
    if (alarm.phase === 'phase3' && phase3StartRef.current === 0) {
      phase3StartRef.current = Date.now();
    }
    if (alarm.phase !== 'phase3') {
      phase3StartRef.current = 0;
    }
  }, [alarm.phase]);
```

**Tailwind class conventions (Countdown.tsx:110–151) — buttons + flex layout:**
```typescript
// Countdown.tsx:136-151
<div className="flex gap-4 mt-10">
  <button
    onClick={alarm.isPaused ? alarm.resume : alarm.pause}
    className="px-8 py-3 rounded-xl border border-border text-text-primary bg-white/60 text-base transition-colors hover:bg-white/80 active:scale-[0.98]"
  >
    {alarm.isPaused ? 'Resume' : 'Pause'}
  </button>
  <button
    onClick={alarm.stop}
    className="px-8 py-3 rounded-xl bg-accent text-white text-base transition-colors hover:bg-accent/90 active:scale-[0.98]"
  >
    Stop
  </button>
</div>
```
**Delta — SegmentHarness.tsx:** Uses `engine = useRef<SegmentEngine>(new SegmentEngine())` directly (no `useAlarm` wrapper hook). `useEffect` registers `engine.current.onSegmentChange((e) => setLogs((l) => [...l, { t: performance.now(), event: e }]))` and returns a cleanup that calls `engine.current.stop()`. Buttons: Start (calls `engine.current.start(WAKE_EASY_CONFIG)`), Pause, Resume, Stop. RESEARCH Open Q #4 recommends DOM-table log over console-only (mobile DevTools usability). Use the existing Tailwind palette tokens (`bg-bg`, `text-text-primary`, `text-text-secondary`, `border-border`, `bg-accent`) — same conventions as Countdown.tsx. Keep the file under ~150 lines; this is a throwaway harness removed in Phase 8.

---

### `src/engine/__tests__/SegmentEngine.test.ts` (test)

**Analog:** `src/engine/__tests__/AlarmEngine.test.ts`
**Data-flow shape:** Vitest fake-timer driven; mocks AudioContext + sounds + wakeLock + AlarmSession-deps; per-test `vi.advanceTimersByTime` to fire scheduled callbacks; assert mock-call counts and ordering.

**Mock-block pattern (AlarmEngine.test.ts:5–65) — copy this VERBATIM, append `vi.mock('../sounds/triangle')` and `vi.mock('../sounds/segmentSound')`:**
```typescript
// AlarmEngine.test.ts:5-65
vi.mock('../AudioContext', () => ({
  getAudioContext: vi.fn().mockResolvedValue({
    currentTime: 0,
    destination: {},
    state: 'running',
    createGain: vi.fn().mockReturnValue({
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        setTargetAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
  } as unknown as AudioContext),
}));

vi.mock('../sounds/singingBowl', () => ({
  strikeBowl: vi.fn(),
}));

vi.mock('../sounds/phase3Tone', () => ({
  createPhase3Ramp: vi.fn().mockReturnValue({
    gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
  startPhase3Swell: vi.fn().mockReturnValue({
    stop: vi.fn(),
    connect: vi.fn(),
    frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    start: vi.fn(),
  }),
  fadeOutGain: vi.fn(),
}));

vi.mock('../sounds/keepalive', () => ({
  startKeepalive: vi.fn().mockReturnValue({
    stop: vi.fn(),
    connect: vi.fn(),
    start: vi.fn(),
  }),
  stopKeepalive: vi.fn(),
}));

vi.mock('../sounds/tickPulse', () => ({
  playTick: vi.fn(),
}));

vi.mock('../../platform/wakeLock', () => ({
  acquireWakeLock: vi.fn().mockResolvedValue(undefined),
  releaseWakeLock: vi.fn(),
  attachVisibilityReacquire: vi.fn().mockReturnValue(vi.fn()), // returns cleanup fn
}));

vi.mock('../../platform/vibration', () => ({
  startVibration: vi.fn(),
  stopVibration: vi.fn(),
}));
```
**Delta — SegmentEngine.test.ts:** Add `vi.mock('../sounds/triangle', () => ({ strikeTriangle: vi.fn() }))` and `vi.mock('../sounds/segmentSound', () => ({ fireSegmentEndSound: vi.fn() }))` (decide based on whether SegmentEngine calls the dispatcher or the underlying strike fns directly — recommend mocking both for flexibility). The vibration + tickPulse mocks can be omitted (SegmentEngine doesn't import them) but harmless to keep for parity. ALSO: add `vi.mock('../timer', () => ({ scheduleAt: vi.fn().mockReturnValue({ cancel: vi.fn() }) }))` per RESEARCH §"Drift measurement strategy" lines 419–433 so tests assert the absolute fire epochs directly.

**`startEngine` microtask-flush helper (AlarmEngine.test.ts:67–75) — REQUIRED, copy verbatim:**
```typescript
// AlarmEngine.test.ts:67-75
async function startEngine(engine: AlarmEngine, config = DEFAULT_CONFIG): Promise<void> {
  const startPromise = engine.start(config);
  // Flush the microtask queue so the getAudioContext promise resolves
  await Promise.resolve();
  await startPromise;
}
```
**Delta:** Rename type, default `config = WAKE_EASY_CONFIG`. The `await Promise.resolve()` line is load-bearing (RESEARCH Pitfall #1).

**`beforeEach`/`afterEach` boilerplate (AlarmEngine.test.ts:78–87) — copy verbatim:**
```typescript
// AlarmEngine.test.ts:78-87
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal('navigator', { vibrate: vi.fn() });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
```
**Delta:** SegmentEngine doesn't touch navigator.vibrate — the stub is harmless filler. Keep for parity.

**Phase-3-cleanup-test override pattern (AlarmEngine.test.ts:595–626) — REQUIRED for any SegmentEngine test that drives into `'firing-alarm'` then dismisses (so cleanup iterates the swell-node array):**
```typescript
// AlarmEngine.test.ts:604-609
const { startPhase3Swell } = await import('../sounds/phase3Tone');
const swellNodes = [
  { stop: vi.fn(), connect: vi.fn(), start: vi.fn(), frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } },
  { stop: vi.fn(), connect: vi.fn(), start: vi.fn(), frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } },
];
(startPhase3Swell as ReturnType<typeof vi.fn>).mockReturnValue(swellNodes);
```
**Delta:** None — copy verbatim. The mock returning a single object (top-level) breaks the `forEach(n => n.stop())` cleanup path; per-test override fixes it. Ref RESEARCH Landmine #1.

**Drift-test pattern (RESEARCH §"Drift measurement strategy" lines 419–433) — new pattern, no v1 analog:**
```typescript
import { scheduleAt } from '../timer';
vi.mock('../timer', () => ({ scheduleAt: vi.fn().mockReturnValue({ cancel: vi.fn() }) }));

it('schedules every segment-end fire time absolutely from epochBaseline', async () => {
  const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
  const engine = new SegmentEngine();
  await startEngine(engine, WAKE_EASY_CONFIG);

  expect(scheduleAt).toHaveBeenCalledTimes(5);
  expect((scheduleAt as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(1_000_000 + 240_000);
  expect((scheduleAt as ReturnType<typeof vi.fn>).mock.calls[1][0]).toBe(1_000_000 + 480_000);
  expect((scheduleAt as ReturnType<typeof vi.fn>).mock.calls[4][0]).toBe(1_000_000 + 1_020_000);

  dateNowSpy.mockRestore();
});
```

**Test-list shape:** RESEARCH §"Test Split" (lines 872–908) enumerates ~20 tests across state-machine, segment-fires, alarm-segment, auto-stop, pause/resume, cleanup. Use as the test inventory — do NOT reduce.

---

### `src/engine/__tests__/segmentSound.test.ts` (test)

**Analog:** `src/engine/sounds/__tests__/keepalive.test.ts` (small two-function dispatch test).
**Data-flow shape:** `vi.mock` the underlying strike fns, call dispatcher, assert which strike was called.

**Mock pattern adaptation:** Unlike `keepalive.test.ts` which uses `vi.stubGlobal` for OscillatorNode/GainNode, `segmentSound.ts` doesn't touch globals — just mock the imports:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireSegmentEndSound } from '../sounds/segmentSound';

vi.mock('../sounds/singingBowl', () => ({ strikeBowl: vi.fn() }));
vi.mock('../sounds/triangle', () => ({ strikeTriangle: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fireSegmentEndSound', () => {
  it('routes \'gentle\' to strikeBowl', async () => {
    const { strikeBowl } = await import('../sounds/singingBowl');
    const { strikeTriangle } = await import('../sounds/triangle');
    const ac = {} as AudioContext;
    fireSegmentEndSound(ac, 'gentle');
    expect(strikeBowl).toHaveBeenCalledWith(ac, 1.0);
    expect(strikeTriangle).not.toHaveBeenCalled();
  });

  it('routes \'triangle\' to strikeTriangle', async () => { /* mirror */ });
});
```
Test list per RESEARCH lines 866–870 (~3 tests).

---

### `src/engine/__tests__/validateSegmentConfig.test.ts` (test)

**Analog:** No isolated v1 file. Closest precedent: `AlarmEngine.test.ts:104–108` (single-test `start() throws on invalid config (negative duration)`). The discriminated-union assertion shape is new.
**Data-flow shape:** call `validateSegmentConfig(input)`, assert returned object's `ok` field + `error` content.

**Pattern (no direct analog — use this skeleton):**
```typescript
import { describe, it, expect } from 'vitest';
import { validateSegmentConfig, WAKE_EASY_CONFIG } from '../SegmentState';

describe('validateSegmentConfig', () => {
  it('returns { ok: true } for valid Wake Easy config', () => {
    const result = validateSegmentConfig(WAKE_EASY_CONFIG);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.config).toEqual(WAKE_EASY_CONFIG);
  });

  it('returns { ok: false } for empty segments array', () => {
    const result = validateSegmentConfig({ segments: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/empty/i);
  });

  it('does not throw on malformed input (defensive contract)', () => {
    expect(() => validateSegmentConfig(null)).not.toThrow();
    expect(() => validateSegmentConfig(undefined)).not.toThrow();
    expect(() => validateSegmentConfig('foo')).not.toThrow();
  });

  // ... per RESEARCH lines 838-851: ~10-12 tests covering all D-12 rules
});
```
Test list per RESEARCH lines 838–851 (~10 tests covering all CONTEXT D-12 rules: NaN / zero / negative / over-max / unknown sound key / empty id / missing segments / non-object input).

---

### `src/engine/sounds/__tests__/triangle.test.ts` (test)

**Analog:** `src/engine/sounds/__tests__/singingBowl.test.ts`
**Data-flow shape:** `vi.stubGlobal` constructor mocks for `OscillatorNode` + `GainNode` to capture creation args; call `strikeTriangle(ac, masterGain)`; assert frequency / gain ramp / start/stop calls.

**Constructor-stub pattern (singingBowl.test.ts:48–88) — copy this VERBATIM, simplified for single-osc+single-gain assertions:**
```typescript
// singingBowl.test.ts:48-88
function buildMockAudioContext() {
  mockOscillatorInstances.length = 0;
  mockGainInstances.length = 0;

  vi.stubGlobal(
    'OscillatorNode',
    vi.fn().mockImplementation((_ac: unknown, options: { type: string; frequency: number }) => {
      const instance = {
        type: options.type,
        frequency: options.frequency,
        connect: vi.fn().mockReturnThis(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      mockOscillatorInstances.push(instance);
      return instance;
    }),
  );

  vi.stubGlobal(
    'GainNode',
    vi.fn().mockImplementation((_ac: unknown, options: { gain: number }) => {
      const instance = {
        gain: makeGainParamMock(),    // setValueAtTime / linearRamp / exponentialRamp vi.fns
        connect: vi.fn().mockReturnThis(),
        _initialGain: options.gain,
      };
      mockGainInstances.push(instance);
      return instance;
    }),
  );

  return { currentTime: 0, destination } as unknown as AudioContext;
}
```

**Test-style example (singingBowl.test.ts:108–138, 161–174):**
```typescript
// singingBowl.test.ts:108-125
it('creates exactly 5 oscillator instances per strike', () => {
  const ac = buildMockAudioContext();
  strikeBowl(ac);
  expect(mockOscillatorInstances).toHaveLength(5);
});

it('sets fundamental frequency to 220 Hz', () => {
  const ac = buildMockAudioContext();
  strikeBowl(ac);
  expect(mockOscillatorInstances[0].frequency).toBe(220);
});

// singingBowl.test.ts:161-174
it('uses exponential ramp to 0.001 (not 0) to avoid spec violation', () => {
  const ac = buildMockAudioContext();
  strikeBowl(ac);
  for (const gainNode of mockGainInstances) {
    const expRampCalls = gainNode.gain.exponentialRampToValueAtTime.mock.calls;
    expect(expRampCalls.length).toBeGreaterThan(0);
    for (const call of expRampCalls) {
      expect(call[0]).toBe(0.001);
      expect(call[0]).not.toBe(0);
    }
  }
});
```
**Delta — triangle.test.ts:** Simpler — exactly **1** OscillatorNode and **1** GainNode per strike. Assert: frequency `2793.83`, type `'sine'`, attack via `linearRampToValueAtTime(0.4 * masterGain, t + 0.008)`, decay via `exponentialRampToValueAtTime(0.001, t + 2.0)`, `osc.start(t)`, `osc.stop(t + 2.1)`. masterGain scaling test: pass `0.5`, assert `linearRampToValueAtTime` called with `0.2`. Test list per RESEARCH lines 853–864 (~7-8 tests).

---

### `src/engine/index.ts` (MODIFIED — append-only)

**Analog:** self (current state at HEAD).
**Data-flow shape:** barrel re-exports.

**Current state — DO NOT REORDER OR REMOVE existing exports (RESEARCH Pitfall #7, SEG-05 zero-diff):**
```typescript
// src/engine/index.ts (HEAD)
export { AlarmEngine } from './AlarmEngine';
export type {
  AlarmPhase,
  AlarmConfig,
  PhaseChangeCallback,
} from './AlarmState';
export {
  DEFAULT_CONFIG,
  QUICK_NAP_CONFIG,
  FOCUS_CONFIG,
  validateConfig,
} from './AlarmState';
export { getAudioContext } from './AudioContext';
export { playTestSound, TEST_SOUND_GAIN } from './sounds/testSound';
export { playTick } from './sounds/tickPulse';
export { startVibration, stopVibration } from '../platform/vibration';
export { acquireWakeLock, releaseWakeLock, attachVisibilityReacquire } from '../platform/wakeLock';
export { startAlarmSession, endAlarmSession } from './AlarmSession';
export type { SessionHandle } from './AlarmSession';
```

**Append (CONTEXT D-24) — APPEND-ONLY at end of file:**
```typescript
export { SegmentEngine } from './SegmentEngine';
export type { Segment, SegmentConfig, SegmentEngineState, SegmentChangeEvent } from './SegmentState';
export { validateSegmentConfig, WAKE_EASY_CONFIG } from './SegmentState';
export { strikeTriangle } from './sounds/triangle';
```
Plan acceptance criteria should include a diff check: lines 1–31 unchanged, lines 32+ added.

---

### `src/App.tsx` (MODIFIED — single dev-mount line)

**Analog:** self (current state at HEAD).
**Data-flow shape:** React component with conditional dev-only branch.

**Current state (5 lines of imports, 14 lines of body):**
```typescript
// src/App.tsx (HEAD)
import { useAlarm } from './hooks/useAlarm';
import Dashboard from './components/Dashboard';
import Countdown from './components/Countdown';

export default function App() {
  const alarm = useAlarm();
  const showCountdown = alarm.isRunning || alarm.phase !== 'idle';

  return (
    <div className="min-h-dvh bg-bg text-text-primary flex flex-col items-center">
      {showCountdown ? (
        <Countdown alarm={alarm} />
      ) : (
        <Dashboard alarm={alarm} />
      )}
      <p className="fixed bottom-3 right-4 text-text-secondary text-xs opacity-40">Version: 1.1</p>
    </div>
  );
}
```

**Modified version — RESEARCH Code Examples §"App.tsx dev-mount addition" lines 802–828, RESEARCH Open Q #5 recommends static import:**
```typescript
import { useAlarm } from './hooks/useAlarm';
import Dashboard from './components/Dashboard';
import Countdown from './components/Countdown';
import SegmentHarness from './dev/SegmentHarness';   // ← NEW (Phase 8 removes)

export default function App() {
  const alarm = useAlarm();
  const showCountdown = alarm.isRunning || alarm.phase !== 'idle';
  // ↓ NEW (Phase 8 removes):
  const showSegmentHarness =
    import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('dev') === 'segments';

  return (
    <div className="min-h-dvh bg-bg text-text-primary flex flex-col items-center">
      {showSegmentHarness ? (
        <SegmentHarness />
      ) : showCountdown ? (
        <Countdown alarm={alarm} />
      ) : (
        <Dashboard alarm={alarm} />
      )}
      <p className="fixed bottom-3 right-4 text-text-secondary text-xs opacity-40">Version: 1.1</p>
    </div>
  );
}
```
**Delta:** Single import line + 3-line conditional. Plan acceptance step: `npm run build && grep -c SegmentHarness dist/assets/*.js` returns 0 in the production output (RESEARCH lines 830 — verifies tree-shaking).

---

## Shared Patterns

These cut across multiple new files; planner should call them out in the relevant plans rather than repeat them per-file.

### 1. OscillatorNode factory (CLAUDE.md mandate, RESEARCH Pitfall #3)
**Source:** Throughout `src/engine/sounds/*.ts` — every existing strike or swell-loop body.
**Apply to:** `triangle.ts`, the alarm-segment swell loop in `SegmentEngine.ts`.
**Rule:** `new OscillatorNode(ac, {...})` inside every fire and inside every interval-loop body. Never reuse a stopped oscillator. After `osc.stop()`, the node is dead — calling `.start()` again throws `InvalidStateError`.

### 2. AlarmSession lifecycle wrapper (Phase 6 D-01..D-08, byte-identical reuse)
**Source:** `src/engine/AlarmSession.ts:72` (`startAlarmSession`) + `src/engine/AlarmSession.ts:97` (`endAlarmSession`).
**Apply to:** `SegmentEngine.start()` and `SegmentEngine.cleanup()`.
**Rule:** `this.session = await startAlarmSession()` in `start()`; `if (this.session) { endAlarmSession(this.session); this.session = null; }` in `cleanup()` placed in the v1-teardown slot (after `timers = []`, before audio teardown).

### 3. `scheduleAt(absoluteEpoch, cb)` — drift-free wall-clock scheduling
**Source:** `src/engine/timer.ts:34` + AlarmEngine.ts:119/127/135 (call sites).
**Apply to:** `SegmentEngine.start()` segment-loop and `SegmentEngine.resume()` re-registration.
**Rule:** Compute absolute epoch as `epochBaseline + sum(durations[0..i])`, NEVER chained `setTimeout(cb, deltaMs)`. From inside the fire callback, audio uses `ac.currentTime` (sample-accurate). RESEARCH lines 416–436 enumerates the strike-timing-mismatch budget (≤250 ms × 5 = 1.25 s, well under SEG-02's <2 s).

### 4. Try/catch around `OscillatorNode.stop()` in cleanup
**Source:** AlarmEngine.ts:208–212 (loop body) and 393–399 (cleanup).
**Apply to:** `SegmentEngine.cleanup()` alarmSwellNodes loop AND any `pause()` path that stops nodes.
**Rule:**
```typescript
this.alarmSwellNodes?.forEach((n) => {
  try {
    n.stop();
  } catch {
    // OscillatorNode may already be stopped — safe to ignore
  }
});
this.alarmSwellNodes = null;
```

### 5. `fadeOutGain(g, ac)` last in cleanup (RESEARCH Pitfall #4)
**Source:** `src/engine/sounds/phase3Tone.ts:137-140` + AlarmEngine.ts:402–406.
**Apply to:** `SegmentEngine.cleanup()` LAST step.
**Rule:** Smooth taper via `setTargetAtTime(0.0001, ac.currentTime, 0.015)` rather than abrupt nullification — eliminates audible click on dismiss.

### 6. Vitest mock-block + microtask flush (RESEARCH Pitfall #1)
**Source:** AlarmEngine.test.ts:5–87.
**Apply to:** `SegmentEngine.test.ts`, `segmentSound.test.ts` (partial — no AlarmSession deps).
**Rule:** Top-of-file `vi.mock(...)` for AudioContext + every sound + wakeLock + (optionally) timer; per-suite `beforeEach { vi.useFakeTimers(); vi.clearAllMocks(); }` + `afterEach { vi.useRealTimers(); vi.unstubAllGlobals(); }`; `startEngine` helper with `await Promise.resolve()` between `engine.start(...)` and `await startPromise`.

### 7. Single-callback last-wins idiom (CONTEXT D-09)
**Source:** AlarmEngine.ts:67–80 (`onPhaseChange` + `setPhase`).
**Apply to:** `SegmentEngine.onSegmentChange` + `SegmentEngine.fireChange`.
**Rule:** One `private xxxCb: T | null = null` field. Public setter assigns; private fire method calls with `?.()`. No array of subscribers, no add/remove API.

### 8. SEG-05 zero-diff floor (HARD CONSTRAINT)
**Apply to:** ALL plans. Plan must include a verification step (CI grep or explicit file-list assertion) that none of these files were modified:
- `src/engine/AlarmEngine.ts`, `src/engine/AlarmState.ts`, `src/engine/AlarmSession.ts`, `src/engine/AudioContext.ts`, `src/engine/timer.ts`
- `src/hooks/useAlarm.ts`, `src/components/Countdown.tsx`, `src/components/ProgressRing.tsx`, `src/components/Dashboard.tsx`
- `src/platform/wakeLock.ts`, `src/platform/vibration.ts`, `src/platform/notifications.ts`
- `src/engine/sounds/{singingBowl,phase3Tone,keepalive,testSound,tickPulse}.ts`

`src/engine/index.ts` and `src/App.tsx` are intentionally allowed to receive append-only edits (D-24, D-15) — see plans for those files for the strict diff shape.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/dev/SegmentHarness.tsx` | dev-only React component | engine-driven button + log harness | No existing dev-only React surface in the codebase (`src/dev/` does not exist). React shape comes from `Countdown.tsx`; Tailwind palette from existing v1 components. The functional pattern (instantiate engine class directly in component, register callback, log events with `performance.now()`) is new — RESEARCH §"Code Examples" + Open Q #4 recommends DOM-table log layout. |
| `validateSegmentConfig.test.ts` | discriminated-union test assertions | transform-input | Only adjacent v1 test is a single 1-liner inside `AlarmEngine.test.ts` (line 104–108) covering throw-on-invalid. The full coverage matrix (10 tests for `{ ok: false }` shape, 1-2 for `{ ok: true }`) is new — see RESEARCH lines 838–851 for the inventory. |

For both, planner should reference RESEARCH.md "Code Examples" sections directly and use only the lightweight shape patterns from the listed analogs.

---

## Metadata

**Analog search scope:**
- `src/engine/*.ts` (Engine + State + Session + timer + AudioContext)
- `src/engine/sounds/*.ts` (sound factories)
- `src/engine/__tests__/` and `src/engine/sounds/__tests__/` (test pattern reference)
- `src/components/Countdown.tsx` (React/Tailwind shape)
- `src/App.tsx`, `src/engine/index.ts` (modification targets)

**Files scanned:** 11 source + 7 tests + 2 modification targets = 20 total.

**Pattern extraction date:** 2026-05-09.
