# Phase 8: Wake Easy Preset + Segment Countdown UI — Pattern Map

**Mapped:** 2026-05-10
**Files analyzed:** 8 created + 2 modified + 1 deleted = 11
**Analogs found:** 8 with strong analog (exact / role-match) | 2 modified files act as their own analog | 1 deletion-only
**Test analogs:** Hook tests have engine-test analog (`SegmentEngine.test.ts`); component tests have **no DOM-test analog** (Phase 8 introduces the first `.tsx` test files in this repo).

> **Critical constraint for Phase 8:** Most analogs are also **SEG-05 v1 byte-identical-protected** files. They are **read-only references** the planner copies *patterns and verbatim strings* from — never `Edit`-target files. The "Read-only?" column on every entry below makes this explicit so plans never produce tasks that diff against a protected analog.

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality | Analog Read-only? |
|---------------------|------|-----------|----------------|---------------|-------------------|
| `src/components/SegmentCountdown.tsx` | component | presentation + ticker | `src/components/Countdown.tsx` | exact (same screen role, paired hook surface) | YES — SEG-05 byte-identical |
| `src/components/SegmentProgressRing.tsx` | component | presentation (SVG geometry) | `src/components/ProgressRing.tsx` | role-match (generalisation: 3 fixed arcs → N duration-proportional arcs) | YES — SEG-05 byte-identical |
| `src/hooks/useSegmentAlarm.ts` | hook | engine consumption + dispatch | `src/hooks/useAlarm.ts` | exact (same shape, line-for-line mirror per CONTEXT D-09) | YES — SEG-05 byte-identical |
| `src/hooks/useActiveAlarm.ts` | hook (composite) | dispatch / mode selection | `src/hooks/useAlarm.ts` (idioms only — no direct analog) | partial (no existing 2-hook composer in repo) | YES (idiom source only) |
| `src/components/__tests__/SegmentCountdown.test.tsx` | test (component) | DOM assertions | **none** (no `.tsx` test files exist) | no analog | n/a |
| `src/components/__tests__/SegmentProgressRing.test.tsx` | test (component) | DOM/SVG assertions | **none** | no analog | n/a |
| `src/hooks/__tests__/useSegmentAlarm.test.ts` | test (hook) | mock-engine + `renderHook` | `src/engine/__tests__/SegmentEngine.test.ts` (mocking idioms) | role-match (engine-test mocking pattern transfers; `renderHook` is new) | n/a |
| `src/hooks/__tests__/useActiveAlarm.test.ts` | test (hook) | mock-both-hooks + narrowing | `src/engine/__tests__/SegmentEngine.test.ts` + new `useSegmentAlarm.test.ts` | partial | n/a |
| `src/components/Dashboard.tsx` (MODIFIED) | component | presentation + dispatch | `src/components/Dashboard.tsx` (self) | self-analog | NO — modify in place |
| `src/App.tsx` (MODIFIED) | component | mode routing | `src/App.tsx` (self) | self-analog | NO — modify in place |
| `src/dev/SegmentHarness.tsx` (DELETED) | dev-only component | n/a | n/a | deletion-only (per Phase 7 D-14) | n/a |

### SEG-05 protected paths the planner must NOT modify

The byte-identical guardrail (Phase 7 plan 07-05 template) tracks 20 paths. Phase 8 adds zero new protected paths and modifies zero existing ones. The full list (verbatim from `08-RESEARCH.md` Example 5):

```
src/engine/AlarmEngine.ts
src/engine/AlarmState.ts
src/engine/AlarmSession.ts
src/engine/AudioContext.ts
src/engine/timer.ts
src/engine/SegmentEngine.ts
src/engine/SegmentState.ts
src/hooks/useAlarm.ts
src/components/Countdown.tsx
src/components/ProgressRing.tsx
src/engine/sounds/singingBowl.ts
src/engine/sounds/phase3Tone.ts
src/engine/sounds/keepalive.ts
src/engine/sounds/testSound.ts
src/engine/sounds/tickPulse.ts
src/engine/sounds/triangle.ts
src/engine/sounds/segmentSound.ts
src/platform/wakeLock.ts
src/platform/vibration.ts
src/platform/notifications.ts
```

---

## Pattern Assignments

### `src/hooks/useSegmentAlarm.ts` (hook, engine consumption + dispatch)

**Analog:** `src/hooks/useAlarm.ts` — **READ-ONLY** (SEG-05). Mirror the shape line-by-line per CONTEXT D-09.

**Imports pattern** (`useAlarm.ts:1-15`):

```typescript
import { useRef, useState } from 'react';
import { AlarmEngine } from '../engine/AlarmEngine';
import { AlarmPhase, AlarmConfig } from '../engine/AlarmState';
import { requestNotificationPermission } from '../platform/notifications';
```

→ **Delta:** swap `AlarmEngine` for `SegmentEngine`, `AlarmPhase / AlarmConfig` for `SegmentEngineState / SegmentConfig / Segment / SegmentChangeEvent`. Keep `useRef, useState` and `requestNotificationPermission` import unchanged.

**T-03-01 controlled-methods doc comment** (`useAlarm.ts:8-10`):

```typescript
 * Security (T-03-01): The engine ref is not exposed outside the hook —
 * only controlled methods (start/stop/pause/resume) are returned.
```

→ **Copy verbatim** into the new hook's docblock (replacing "alarm" with "segment alarm" where needed).

**Return-shape interface** (`useAlarm.ts:17-28`):

```typescript
export interface UseAlarmReturn {
  phase: AlarmPhase;
  isPaused: boolean;
  isRunning: boolean;
  /** Epoch ms when current phase ends (for countdown display). 0 when not running. */
  phaseEndsAt: number;
  activeConfig: AlarmConfig | null;
  start: (config: AlarmConfig) => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
}
```

→ **Replace with** the locked CONTEXT D-09 / specifics-block shape:

```typescript
export interface UseSegmentAlarmReturn {
  state: SegmentEngineState;
  isPaused: boolean;
  isRunning: boolean;
  currentSegment: { index: number; total: number; segment: Segment } | null;
  /** Epoch ms when current segment ends (for segment-remaining countdown). 0 when idle/dismissed. */
  segmentEndsAt: number;
  /** Epoch ms when whole composition ends (for total-remaining caption). 0 when idle/dismissed/firing-alarm. */
  totalEndsAt: number;
  /** Epoch ms when alarm-firing started (for count-up display). 0 when not firing. */
  alarmStartedAt: number;
  activeConfig: SegmentConfig | null;
  start: (config: SegmentConfig) => Promise<void>;
  stop: () => void;
  pause: () => void;  // silent no-op when canPause() is false
  resume: () => void;
}
```

**Internal state shape** (`useAlarm.ts:30-44`):

```typescript
interface AlarmState {
  phase: AlarmPhase;
  isPaused: boolean;
  isRunning: boolean;
  phaseEndsAt: number;
  activeConfig: AlarmConfig | null;
}

const INITIAL_STATE: AlarmState = {
  phase: 'idle',
  isPaused: false,
  isRunning: false,
  phaseEndsAt: 0,
  activeConfig: null,
};
```

→ **Delta:** add `currentSegment`, `totalEndsAt`, `alarmStartedAt` fields; rename `phase` → `state` (initial `'idle'`); rename `phaseEndsAt` → `segmentEndsAt`. Initial values: `currentSegment: null, segmentEndsAt: 0, totalEndsAt: 0, alarmStartedAt: 0`.

**Lazy-init engine pattern** (`useAlarm.ts:65-74`):

```typescript
export function useAlarm(): UseAlarmReturn {
  const engineRef = useRef<AlarmEngine | null>(null);
  const [state, setState] = useState<AlarmState>(INITIAL_STATE);

  // Lazy-initialize the engine singleton
  if (engineRef.current === null) {
    engineRef.current = new AlarmEngine();
  }

  const engine = engineRef.current;
```

→ **Copy verbatim** with `AlarmEngine` → `SegmentEngine`. The `useRef`-then-conditional-assignment idiom is the load-bearing pattern.

**Callback registration in body, not `useEffect`** (`useAlarm.ts:76-86`) — this is the most subtle pattern:

```typescript
// Register onPhaseChange callback directly in the hook body (not in useEffect).
// Last-registration-wins per the engine API contract — React re-renders replace
// the callback with a fresh closure that has access to current state via setState.
// This avoids stale closures and matches Pattern 1 from 03-RESEARCH.md.
engine.onPhaseChange((newPhase: AlarmPhase) => {
  setState((prev) => ({
    ...prev,
    phase: newPhase,
    phaseEndsAt: computePhaseEndsAt(newPhase, prev.activeConfig),
  }));
});
```

→ **Delta (RESEARCH Pattern 1 + Pitfall 2):** swap `onPhaseChange` for `onSegmentChange`. The callback receives a `SegmentChangeEvent` (not a phase string). Inside the callback, the hook MUST poll `engine.getState()` to capture state transitions that happen inside `handleSegmentFire` (verified `SegmentEngine.ts:212`):

```typescript
engine.onSegmentChange((event: SegmentChangeEvent) => {
  setState((prev) => {
    const newState = engine.getState();  // poll AFTER the engine's state transition
    let segmentEndsAt = prev.segmentEndsAt;
    let totalEndsAt = prev.totalEndsAt;
    let alarmStartedAt = prev.alarmStartedAt;
    let currentSegment = prev.currentSegment;

    if (event.kind === 'start') {
      segmentEndsAt = Date.now() + event.segment.durationMs;
      currentSegment = { index: event.segmentIndex, total: event.totalSegments, segment: event.segment };
    } else if (event.kind === 'end' && event.segment.endSound === 'alarm') {
      // Engine has transitioned to 'firing-alarm' (verified SegmentEngine.ts:212).
      alarmStartedAt = Date.now();
      segmentEndsAt = 0;
      totalEndsAt = 0;
      currentSegment = { index: event.segmentIndex, total: event.totalSegments, segment: event.segment };
    }
    return { ...prev, state: newState, segmentEndsAt, totalEndsAt, alarmStartedAt, currentSegment };
  });
});
```

**`start` method pattern** (`useAlarm.ts:88-99`):

```typescript
const start = async (config: AlarmConfig): Promise<void> => {
  // Request notification permission from user gesture context (Pitfall 2)
  await requestNotificationPermission();
  await engine.start(config);
  setState({
    phase: 'idle', // still idle during countdown
    isPaused: false,
    isRunning: true,
    phaseEndsAt: Date.now() + config.phase1DurationMs,
    activeConfig: config,
  });
};
```

→ **Delta:** keep the `requestNotificationPermission()` call (D-18). After `engine.start(config)`, set:

- `state: 'running'` (engine's new enum)
- `isRunning: true`
- `currentSegment: { index: 0, total: config.segments.length, segment: config.segments[0] }`
- `segmentEndsAt: Date.now() + config.segments[0].durationMs`
- `totalEndsAt: Date.now() + sumOfAllDurations`
- `alarmStartedAt: 0`
- `activeConfig: config`

**`pause` snapshot pattern** (`useAlarm.ts:106-114`) — load-bearing for RESEARCH Pitfall 3:

```typescript
const pause = (): void => {
  engine.pause();
  setState((prev) => ({
    ...prev,
    isPaused: true,
    // Snapshot remaining time so resume can restore it
    phaseEndsAt: Math.max(0, prev.phaseEndsAt - Date.now()),
  }));
};
```

→ **Delta:** snapshot **both** `segmentEndsAt` AND `totalEndsAt` as remaining ms (Pitfall 3). The engine itself silently no-ops `pause()` when `canPause()` is false (`SegmentEngine.ts:261-262`); the hook's `setState` will still attempt to flip `isPaused`, so guard via `if (!engine.canPause()) return;` at the top of the hook's `pause()`.

**`resume` epoch-restore pattern** (`useAlarm.ts:116-124`):

```typescript
const resume = (): void => {
  engine.resume();
  setState((prev) => ({
    ...prev,
    isPaused: false,
    // phaseEndsAt was storing remaining ms while paused — convert back to epoch
    phaseEndsAt: Date.now() + prev.phaseEndsAt,
  }));
};
```

→ **Delta:** convert **both** `segmentEndsAt` AND `totalEndsAt` from remaining ms back to epoch.

**`stop` reset pattern** (`useAlarm.ts:101-104`):

```typescript
const stop = (): void => {
  engine.stop();
  setState(INITIAL_STATE);
};
```

→ **Copy verbatim** with the segment hook's INITIAL_STATE. Note: per CONTEXT D-09, the hook does NOT expose `dismiss` — Stop maps to `engine.stop()` which transitions to `'dismissed'` per SegmentEngine semantics.

---

### `src/hooks/useActiveAlarm.ts` (hook, dispatch / mode selection)

**Analog:** **No direct analog** — this is a new composition pattern. The closest reference is `useAlarm.ts` for hook idioms (lazy-ref, controlled return, last-wins callback registration in body). The shape is locked by CONTEXT D-07.

**Imports** (no analog — derive from RESEARCH Pattern 2):

```typescript
import { useState } from 'react';
import type { AlarmConfig } from '../engine/AlarmState';
import type { SegmentConfig } from '../engine/SegmentState';
import { useAlarm, type UseAlarmReturn } from './useAlarm';
import { useSegmentAlarm, type UseSegmentAlarmReturn } from './useSegmentAlarm';
```

**Discriminated-union return shape** (LOCKED — D-07; verbatim from CONTEXT specifics block + RESEARCH Pattern 5):

```typescript
export type PresetSelection =
  | { kind: 'continuous'; config: AlarmConfig }
  | { kind: 'segments';   config: SegmentConfig };

export type ActiveAlarmState =
  | { mode: 'idle';       start: (preset: PresetSelection) => Promise<void> }
  | { mode: 'continuous'; alarm: UseAlarmReturn }
  | { mode: 'segments';   alarm: UseSegmentAlarmReturn };
```

**Dispatch logic** (RESEARCH Pattern 2 — *recommended* form with `pendingMode` race-window guard):

```typescript
export function useActiveAlarm(): ActiveAlarmState {
  const continuous = useAlarm();        // always mounted (D-08)
  const segments   = useSegmentAlarm(); // always mounted (D-08)
  const [pendingMode, setPendingMode] = useState<'continuous' | 'segments' | null>(null);

  const mode = continuous.isRunning ? 'continuous'
             : segments.isRunning   ? 'segments'
             : pendingMode          ?? 'idle';

  if (mode === 'continuous') return { mode: 'continuous', alarm: continuous };
  if (mode === 'segments')   return { mode: 'segments',   alarm: segments };

  return {
    mode: 'idle',
    start: async (preset) => {
      setPendingMode(preset.kind);
      try {
        if (preset.kind === 'continuous') await continuous.start(preset.config);
        else                              await segments.start(preset.config);
      } finally {
        setPendingMode(null);
      }
    },
  };
}
```

**Key constraints:**

- Both hooks unconditionally mounted (D-08). RESEARCH Pitfall 6 verifies this is safe — `SegmentEngine` constructor (`SegmentEngine.ts:48-73`) does no async work; AC + Wake Lock + notification flows only fire inside `start()` (`SegmentEngine.ts:159`).
- `pendingMode` exists only to cover the microtask gap between `start()` invocation and `isRunning` flipping true (RESEARCH §"Pattern 2" + Assumption A4).
- TS strict-mode narrows on `mode` in App.tsx without casts (RESEARCH §"Pattern 5").

---

### `src/components/SegmentCountdown.tsx` (component, presentation + ticker)

**Analog:** `src/components/Countdown.tsx` — **READ-ONLY** (SEG-05). Mirror layout + class strings byte-for-byte; replace phase logic with segment logic per CONTEXT D-03 / D-05 / D-19.

**Imports pattern** (`Countdown.tsx:14-18`):

```typescript
import { useState, useEffect, useRef } from 'react';
import type { UseAlarmReturn } from '../hooks/useAlarm';
import type { AlarmPhase } from '../engine';
import ProgressRing from './ProgressRing';
import { formatMmSs } from '../utils/formatTime';
```

→ **Delta:**

```typescript
import { useState, useEffect } from 'react';
import type { UseSegmentAlarmReturn } from '../hooks/useSegmentAlarm';
import SegmentProgressRing from './SegmentProgressRing';
import { formatMmSs } from '../utils/formatTime';
```

The `useRef` import drops out — `alarmStartedAt` lives in the hook now (D-03), no component-local ref needed (RESEARCH §"Pattern 3" — the v1 `phase3StartRef` is replaced by hook state).

**Props interface** (`Countdown.tsx:20-22`):

```typescript
interface CountdownProps {
  alarm: UseAlarmReturn;
}
```

→ **Replace with:**

```typescript
interface SegmentCountdownProps {
  alarm: UseSegmentAlarmReturn;
}
```

**Phase-label record** (`Countdown.tsx:24-31`):

```typescript
/** D-08: Human-readable phase labels */
const PHASE_LABELS: Record<string, string> = {
  idle: 'Gentle Sound',
  phase1: 'Nudge',
  phase2: 'Nudge',
  phase3: 'Wake',
  dismissed: '',
};
```

→ **Replace with** the UI-SPEC sound-label vocabulary (verbatim — UI-SPEC L174-180):

```typescript
const SOUND_LABELS: Record<'gentle' | 'triangle' | 'alarm', string> = {
  gentle:   'Gentle chime',
  triangle: 'Triangle ping',
  alarm:    'Wake',
};
```

**Initial state hook** (`Countdown.tsx:55-58`):

```typescript
const [displayRemainingMs, setDisplayRemainingMs] = useState(
  Math.max(0, alarm.phaseEndsAt - Date.now())
);
```

→ **Delta:** track both segment-remaining and total-remaining + count-up:

```typescript
const [segmentRemainingMs, setSegmentRemainingMs] = useState(
  Math.max(0, alarm.segmentEndsAt - Date.now())
);
const [totalRemainingMs, setTotalRemainingMs] = useState(
  Math.max(0, alarm.totalEndsAt - Date.now())
);
const [elapsedSinceAlarmMs, setElapsedSinceAlarmMs] = useState(0);
```

**Phase3 count-up tracking** (`Countdown.tsx:60-72`) — tracked via component-local ref + effect in v1:

```typescript
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

→ **REPLACE entirely:** `alarm.alarmStartedAt` is already in hook state (D-03). The component just reads it during the ticker effect — no component-level ref or effect needed.

**Ticker pattern** (`Countdown.tsx:74-93`) — load-bearing for Phase 3 D-07 (250ms cadence + freeze on pause + cleanup):

```typescript
// Tick every 250ms when running. Freezes on pause (Pitfall 4).
// Interval cleared on unmount and when paused (T-03-08: no interval leak).
useEffect(() => {
  if (alarm.isPaused || !alarm.isRunning) return;

  // Set immediately so there's no initial lag
  setDisplayRemainingMs(Math.max(0, alarm.phaseEndsAt - Date.now()));
  if (alarm.phase === 'phase3' && phase3StartRef.current > 0) {
    setElapsedMs(Date.now() - phase3StartRef.current);
  }

  const id = setInterval(() => {
    setDisplayRemainingMs(Math.max(0, alarm.phaseEndsAt - Date.now()));
    if (alarm.phase === 'phase3' && phase3StartRef.current > 0) {
      setElapsedMs(Date.now() - phase3StartRef.current);
    }
  }, 250);

  return () => clearInterval(id);
}, [alarm.isPaused, alarm.isRunning, alarm.phaseEndsAt, alarm.phase]);
```

→ **Delta:** keep 250ms cadence and the early-return-on-paused guard. Inside the interval, update three values:

- `setSegmentRemainingMs(Math.max(0, alarm.segmentEndsAt - Date.now()))`
- `setTotalRemainingMs(Math.max(0, alarm.totalEndsAt - Date.now()))`
- `if (alarm.state === 'firing-alarm' && alarm.alarmStartedAt > 0) setElapsedSinceAlarmMs(Date.now() - alarm.alarmStartedAt)`

Dependency array: `[alarm.isPaused, alarm.isRunning, alarm.segmentEndsAt, alarm.totalEndsAt, alarm.state, alarm.alarmStartedAt]`.

**Progress computation** (`Countdown.tsx:95-103`):

```typescript
const config = alarm.activeConfig;
let phaseProgress = 0;
if (config) {
  const phaseTotalMs = getPhaseDuration(alarm.phase, config);
  phaseProgress = phaseTotalMs > 0
    ? Math.min(1, Math.max(0, 1 - displayRemainingMs / phaseTotalMs))
    : 0;
}
```

→ **Replace with** (RESEARCH §"Pattern 4" — Computing `progress` from hook state):

```typescript
const config = alarm.activeConfig;
const currentSegment = alarm.currentSegment;
const progress = currentSegment
  ? Math.min(1, Math.max(0, 1 - segmentRemainingMs / currentSegment.segment.durationMs))
  : 0;
```

The v1 `getPhaseDuration` helper (`Countdown.tsx:33-53`) drops out entirely — segment durations come from `currentSegment.segment.durationMs`.

**Outer wrapper class string** (`Countdown.tsx:111`) — **VERBATIM** copy required (matches Phase 3 D-04 + UX-04, identical to Dashboard wrapper):

```tsx
<div className="flex flex-col items-center w-full max-w-md mx-auto px-6 py-12">
```

**Ring + center content** (`Countdown.tsx:112-133`) — replace `<ProgressRing>` with `<SegmentProgressRing>` and split center children by state:

```tsx
{config && (
  <ProgressRing
    config={config}
    currentPhase={currentPhase}
    phaseProgress={phaseProgress}
  >
    {/* D-07: Large mm:ss timer with tabular-nums for stable width */}
    <span
      className="text-text-primary font-light tracking-tight"
      style={{
        fontSize: 'var(--font-size-countdown)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {formatMmSs(displayTime)}
    </span>
    {/* D-08: Phase label with subtle crossfade on transition (D-10) */}
    <span className="text-text-secondary text-sm mt-1 transition-opacity duration-500">
      {PHASE_LABELS[alarm.phase] || ''}
    </span>
  </ProgressRing>
)}
```

→ **Delta:**

- Replace `<ProgressRing config={config} currentPhase={currentPhase} phaseProgress={phaseProgress}>` with `<SegmentProgressRing config={config} currentIndex={currentSegment.index} progress={progress} pulseActive={alarm.state === 'firing-alarm'} pausedDimming={alarm.isPaused}>`. (D-03, D-19.)
- Big mm:ss `<span>`: **copy class names + inline style verbatim** from `Countdown.tsx:118-127`. Body text: `formatMmSs(alarm.state === 'firing-alarm' ? elapsedSinceAlarmMs : segmentRemainingMs)`.
- Insert NEW small total-time caption between timer and phase label (UI-SPEC L259-265 — verbatim) — **only when `alarm.state !== 'firing-alarm'`**:
  ```tsx
  <span
    className="text-text-secondary text-xs mt-1"
    style={{ fontVariantNumeric: 'tabular-nums' }}
  >
    {formatMmSs(totalRemainingMs)} total
  </span>
  ```
- Phase-label span: **copy class names verbatim** from `Countdown.tsx:129` (`text-text-secondary text-sm mt-2 transition-opacity duration-500` per UI-SPEC L271-275; note UI-SPEC adjusts `mt-1` → `mt-2` to compensate for the new caption above). Body text branches:
  - During `state !== 'firing-alarm'`: `Segment {currentSegment.index + 1} of {currentSegment.total} — {SOUND_LABELS[currentSegment.segment.endSound]}` (CONTEXT specifics block; RESEARCH Pitfall 8 — index is 0-based, +1 for display).
  - During `state === 'firing-alarm'`: `Wake` (UI-SPEC L165-166).

**Control row** (`Countdown.tsx:135-151`) — **VERBATIM** copy required (Phase 3 D-09; UI-SPEC L280-296), with **one delta** (D-03 + UI-SPEC L298-300):

```tsx
{/* D-09: Controls below ring */}
<div className="flex gap-4 mt-10">
  {/* Pause/Resume toggle */}
  <button
    onClick={alarm.isPaused ? alarm.resume : alarm.pause}
    className="px-8 py-3 rounded-xl border border-border text-text-primary bg-white/60 text-base transition-colors hover:bg-white/80 active:scale-[0.98]"
  >
    {alarm.isPaused ? 'Resume' : 'Pause'}
  </button>
  {/* Stop — returns to Dashboard immediately (D-02) */}
  <button
    onClick={alarm.stop}
    className="px-8 py-3 rounded-xl bg-accent text-white text-base transition-colors hover:bg-accent/90 active:scale-[0.98]"
  >
    Stop
  </button>
</div>
```

→ **Delta on Pause button only** (the ONE Tailwind addition Phase 8 makes to v1's button vocabulary — UI-SPEC L298-300):

- Add attribute: `disabled={alarm.state === 'firing-alarm'}`
- Append to `className`: `disabled:opacity-40 disabled:cursor-not-allowed`

Stop button is byte-for-byte identical to v1.

---

### `src/components/SegmentProgressRing.tsx` (component, presentation — SVG geometry)

**Analog:** `src/components/ProgressRing.tsx` — **READ-ONLY** (SEG-05). Clone helpers + constants verbatim; generalise the rendering loop from 3 fixed arcs to N duration-proportional arcs.

**Geometry constants** (`ProgressRing.tsx:27-31`) — **COPY VERBATIM**:

```typescript
const CENTER = 100;       // SVG viewBox 200x200
const RADIUS = 80;
const STROKE_WIDTH = 14;
const GAP_RADIANS = 0.05; // small visual gap between segments
const TWO_PI = 2 * Math.PI;
```

**Helper functions** (`ProgressRing.tsx:42-58`) — **COPY VERBATIM** (RESEARCH Anti-Pattern: don't refactor, clone):

```typescript
/**
 * Convert a clockwise angle (radians, 0 = top) to SVG x,y coordinates.
 */
function polarToCartesian(angleCw: number): { x: number; y: number } {
  const theta = angleCw - Math.PI / 2; // start from top
  return {
    x: CENTER + RADIUS * Math.cos(theta),
    y: CENTER + RADIUS * Math.sin(theta),
  };
}

/**
 * Build an SVG arc path from startAngle to endAngle (clockwise radians from top).
 */
function arcPath(startAngle: number, endAngle: number): string {
  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}
```

**Color map** (`ProgressRing.tsx:33-37`) — **REPLACE KEYS** (D-02; UI-SPEC L107-115):

```typescript
const PHASE_COLORS = [
  'var(--color-sage)',   // Phase 1
  'var(--color-sand)',   // Phase 2
  'var(--color-accent)', // Phase 3
];
```

→ **Replace with** keyed-by-endSound record:

```typescript
const SOUND_COLORS: Record<'gentle' | 'triangle' | 'alarm', string> = {
  gentle:   'var(--color-sage)',
  triangle: 'var(--color-sand)',
  alarm:    'var(--color-accent)',
};
```

**Props interface** (`ProgressRing.tsx:20-25`):

```typescript
interface ProgressRingProps {
  config: AlarmConfig;
  currentPhase: AlarmPhase;
  phaseProgress: number; // 0-1: how far through the CURRENT phase (0 = just started, 1 = complete)
  children?: React.ReactNode; // Renders inside the ring (countdown time + label)
}
```

→ **Replace with** (RESEARCH Pattern 4):

```typescript
interface SegmentProgressRingProps {
  config: SegmentConfig;
  currentIndex: number;       // 0..N-1 of the segment currently elapsing; N when dismissed
  progress: number;           // 0..1: how far through the CURRENT segment
  pulseActive?: boolean;      // true when state === 'firing-alarm' (D-03)
  pausedDimming?: boolean;    // true when paused — drops active arc opacity to 0.5 (D-19)
  children?: React.ReactNode;
}
```

**Arc-length / start-angle computation** (`ProgressRing.tsx:87-101`) — fixed 3-arc + dot in v1; **GENERALISE** to N duration-proportional arcs:

```typescript
// v1 fixed-3-arc layout (read-only reference):
const total = config.phase1DurationMs + config.phase2DurationMs;
const DOT_ARC = 0.08; // small fixed arc for the phase 3 dot
const availableArc = TWO_PI - 2 * GAP_RADIANS - DOT_ARC;
const arcLengths = [
  (config.phase1DurationMs / total) * availableArc,
  (config.phase2DurationMs / total) * availableArc,
];
const startAngles = [0, arcLengths[0] + GAP_RADIANS];
const dotStart = startAngles[1] + arcLengths[1] + GAP_RADIANS;
```

→ **Replace with** N-arc cumulative-angle loop (RESEARCH Pattern 4; new logic — no v1 analog):

```typescript
const segments = config.segments;
const N = segments.length;
const totalDuration = segments.reduce((sum, s) => sum + s.durationMs, 0);
const totalGap = N * GAP_RADIANS;            // N gaps for symmetry (RESEARCH §"Three subtleties")
const availableArc = TWO_PI - totalGap;

let cursor = 0;
const arcs = segments.map((seg, i) => {
  const arcLen = (seg.durationMs / totalDuration) * availableArc;
  const start = cursor;
  const end = cursor + arcLen;
  cursor = end + GAP_RADIANS;
  return { i, segment: seg, start, end, arcLen };
});
```

**Per-arc track + active-fill rendering** (`ProgressRing.tsx:106-167`) — three branches (past / current / future) carry over; clone strokes + opacities verbatim:

| State | v1 line | Stroke | Opacity | Verbatim attribute strings |
|-------|---------|--------|---------|----------------------------|
| Track (always) | `ProgressRing.tsx:114-124` | `var(--color-faded)` | `0.4` | `fill="none" strokeWidth={STROKE_WIDTH} strokeLinecap="round"` |
| Past | `ProgressRing.tsx:128-139` | `var(--color-faded)` | `0.6` | same as track but at full arc length |
| Current — running | `ProgressRing.tsx:140-154` | `SOUND_COLORS[seg.endSound]` | `1` | width clipped via `arcPath(start, start + remainingArc)` where `remainingArc = (1 - progress) * arcLen` |
| Current — paused (D-19, NEW) | n/a | `SOUND_COLORS[seg.endSound]` | `0.5` | controlled via `pausedDimming` prop |
| Current — firing-alarm (D-03, NEW) | n/a | `SOUND_COLORS['alarm']` | `1` (pulses 1 ↔ 0.7 via `.pulse-active` class) | controlled via `pulseActive` prop |
| Future | `ProgressRing.tsx:155-166` | `SOUND_COLORS[seg.endSound]` | `1` | full arc length |

**Verbatim track-arc snippet to clone** (`ProgressRing.tsx:114-124`):

```tsx
<path
  key={`track-${i}`}
  d={arcPath(start, end)}
  fill="none"
  stroke="var(--color-faded)"
  strokeWidth={STROKE_WIDTH}
  strokeLinecap="round"
  opacity={0.4}
/>
```

**Current-arc snippet with new props** (RESEARCH Pattern 4 + UI-SPEC L367-374):

```tsx
<path
  key={`fill-${i}`}
  className={pulseActive ? 'pulse-active' : undefined}
  d={arcPath(start, start + remainingArc)}
  fill="none"
  stroke={color}
  strokeWidth={STROKE_WIDTH}
  strokeLinecap="round"
  opacity={pausedDimming ? 0.5 : 1}
/>
```

UI-SPEC also calls for `transition-opacity duration-200` on the active path for the pause-state fade (UI-SPEC L367-374) — add `className={[pulseActive && 'pulse-active', 'transition-opacity duration-200'].filter(Boolean).join(' ')}` (or equivalent).

**Drop the v1 phase3-dot block** (`ProgressRing.tsx:172-186`) — N-arc layout has no dot; the alarm segment IS just an arc whose `endSound === 'alarm'`.

**Outer SVG wrapper** (`ProgressRing.tsx:188-203`) — **COPY VERBATIM** including `role="img" aria-label="Alarm progress"` (UI-SPEC L513 mandates copying these attributes):

```tsx
<div className="relative w-full max-w-[280px] mx-auto">
  <svg
    viewBox="0 0 200 200"
    className="w-full"
    role="img"
    aria-label="Alarm progress"
  >
    {segments.map((pair) => pair)}
    {phase3Dot}
  </svg>
  <div className="absolute inset-0 flex flex-col items-center justify-center">
    {children}
  </div>
</div>
```

→ **Delta:** drop `{phase3Dot}` from inside the `<svg>`. Replace `{segments.map((pair) => pair)}` with the N-arc map output. The wrapper div + class strings + `<svg>` attributes + children-positioning div all stay byte-identical.

---

### `src/components/Dashboard.tsx` (MODIFIED — component, presentation + dispatch)

**Analog:** itself (current shape becomes the analog of itself; the diff is the prop rename + 3rd PresetCard insertion).

**Current imports + interface + signature** (`Dashboard.tsx:13-23`):

```typescript
import { QUICK_NAP_CONFIG, FOCUS_CONFIG } from '../engine';
import { UseAlarmReturn } from '../hooks/useAlarm';
import PresetCard from './PresetCard';
import TestSoundButton from './TestSoundButton';
import IosInstallBanner from './IosInstallBanner';

interface DashboardProps {
  alarm: UseAlarmReturn;
}

export default function Dashboard({ alarm }: DashboardProps) {
```

**Diff to apply** (RESEARCH Example 2):

- Add import: `WAKE_EASY_CONFIG` to the existing `from '../engine'` import (engine barrel already exports it per `engine/index.ts:40` and CONTEXT D-22 — no barrel changes needed).
- Drop `import { UseAlarmReturn } from '../hooks/useAlarm';`.
- Add `import type { ActiveAlarmState } from '../hooks/useActiveAlarm';`.
- Replace interface body:
  ```typescript
  interface DashboardProps {
    activeAlarm: Extract<ActiveAlarmState, { mode: 'idle' }>;
  }
  ```
- Replace function signature: `function Dashboard({ activeAlarm }: DashboardProps)`.

**Existing two-card block** (`Dashboard.tsx:31-42`) — **PATTERN to mirror** when adding the third card:

```tsx
<div className="mt-10 w-full flex flex-col gap-4">
  <PresetCard
    name="Quick Nap"
    description="5 min gentle, 5 min nudge, wake"
    onStart={() => alarm.start(QUICK_NAP_CONFIG)}
  />
  <PresetCard
    name="Focus"
    description="21 min gentle, 2 min nudge, wake"
    onStart={() => alarm.start(FOCUS_CONFIG)}
  />
</div>
```

**Diff to apply** (D-11, D-12, D-14):

- Update both existing `onStart` handlers from `alarm.start(CONFIG)` to `activeAlarm.start({ kind: 'continuous', config: CONFIG })`.
- Add a third `<PresetCard>` after the Focus card (D-11 — bottom of list), inside the same `<div className="mt-10 w-full flex flex-col gap-4">` wrapper:
  ```tsx
  <PresetCard
    name="4 x 4"
    description="4 chimes over 16 min, then alarm"
    onStart={() => activeAlarm.start({ kind: 'segments', config: WAKE_EASY_CONFIG })}
  />
  ```
- Note (D-13): `WAKE_EASY_CONFIG` is the imported constant; the user-facing label `"4 x 4"` (with single ASCII spaces) and description `"4 chimes over 16 min, then alarm"` are LOCKED strings (D-12; UI-SPEC L155-159).

The wrapper class string `mt-10 w-full flex flex-col gap-4` (Dashboard.tsx:31), the header (Dashboard.tsx:27-28), the TestSoundButton block, and the IosInstallBanner block all stay byte-identical.

---

### `src/App.tsx` (MODIFIED — component, mode routing)

**Analog:** itself. The diff replaces `useAlarm` direct call + `showCountdown` ternary with `useActiveAlarm` + 3-way `mode` branch + harness wiring removal (D-15, D-16).

**Current full file** (`App.tsx:1-25`):

```tsx
import { useAlarm } from './hooks/useAlarm';
import Dashboard from './components/Dashboard';
import Countdown from './components/Countdown';
import SegmentHarness from './dev/SegmentHarness';

export default function App() {
  const alarm = useAlarm();
  const showCountdown = alarm.isRunning || alarm.phase !== 'idle';
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

**Target shape after diff** (RESEARCH Example 3 — verbatim):

```tsx
import { useActiveAlarm } from './hooks/useActiveAlarm';
import Dashboard from './components/Dashboard';
import Countdown from './components/Countdown';
import SegmentCountdown from './components/SegmentCountdown';

export default function App() {
  const activeAlarm = useActiveAlarm();

  return (
    <div className="min-h-dvh bg-bg text-text-primary flex flex-col items-center">
      {activeAlarm.mode === 'idle'       && <Dashboard activeAlarm={activeAlarm} />}
      {activeAlarm.mode === 'continuous' && <Countdown alarm={activeAlarm.alarm} />}
      {activeAlarm.mode === 'segments'   && <SegmentCountdown alarm={activeAlarm.alarm} />}
      <p className="fixed bottom-3 right-4 text-text-secondary text-xs opacity-40">Version: 1.2</p>
    </div>
  );
}
```

**Diff summary:**

- Imports: drop `useAlarm`, drop `SegmentHarness`; add `useActiveAlarm`, add `SegmentCountdown`. Keep `Dashboard` and `Countdown` imports unchanged.
- Drop the `showCountdown` const (line 8) and the `showSegmentHarness` const block (lines 9-11).
- Replace ternary with three `&&`-guarded branches narrowing on `activeAlarm.mode`.
- Outer wrapper `<div className="min-h-dvh bg-bg text-text-primary flex flex-col items-center">` — **byte-identical** (Phase 3 D-04).
- Version footer `<p className="fixed bottom-3 right-4 text-text-secondary text-xs opacity-40">` — **byte-identical** classes; bump literal `Version: 1.1` → `Version: 1.2` (RESEARCH Example 3 recommendation).

**Critical:** v1 `<Countdown alarm={...}>` is consumed unchanged — `Countdown.tsx` is byte-identical-protected. App.tsx must continue to pass a `UseAlarmReturn`-shaped prop, which the discriminated union narrowing guarantees on the `'continuous'` branch.

---

### `src/dev/SegmentHarness.tsx` (DELETED)

**Analog:** none — deletion-only per Phase 7 D-14 / Phase 8 D-16.

**Action:**

- `git rm src/dev/SegmentHarness.tsx` (or filesystem delete).
- After deletion, run the verification one-liner (RESEARCH Example 4 + Pitfall 5):
  ```bash
  grep -r "SegmentHarness" src/                          # MUST return 0 matches
  grep -r "showSegmentHarness\|dev=segments" src/        # MUST return 0 matches
  npm run build                                          # MUST exit 0
  grep -r "SegmentHarness" dist/                         # MUST return 0 matches
  ```
- The App.tsx diff (above) removes the import + URL-flag block; the SegmentHarness file deletion completes the removal.

**Read-only insight:** the file's pattern (lazy-init `useRef<SegmentEngine>`, `onSegmentChange` registered in `useEffect` with `engine.stop()` cleanup, `engineRef.current!.start(WAKE_EASY_CONFIG)` from button handler) is the prototype that `useSegmentAlarm` formalises. RESEARCH §"Don't Hand-Roll" notes: read `SegmentHarness.tsx:25-78` once as a working reference for engine-in-React integration before writing `useSegmentAlarm`.

---

### `src/components/__tests__/SegmentCountdown.test.tsx` (test, component)

**Analog:** **NONE** — Phase 8 introduces the first `.tsx` test files in this repo (verified: `Glob src/components/__tests__/*` returns no files; `Glob src/hooks/__tests__/*` returns no files).

**Wave-0 install required:**

```bash
npm install --save-dev @testing-library/react jsdom
# Optional: @testing-library/jest-dom for DOM matchers
```

**Wave-0 vite config delta** (RESEARCH Wave 0 Gaps): `vite.config.ts` may need `test: { environment: 'jsdom' }` block; verify Vitest defaults work first.

**Idiom source** (closest existing pattern — `SegmentEngine.test.ts:87-96`):

```typescript
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

→ **Copy verbatim** (drop `vi.stubGlobal('navigator', ...)` if no vibration calls in component).

**Test-list to cover** (CONTEXT D-20):

- Render snapshot (mm:ss + segment label + Pause/Stop)
- mm:ss tick (advance fake timers 250ms; assert text updates)
- Segment-boundary transition (mock `useSegmentAlarm` return shape with new `currentSegment`; assert label re-renders)
- Pause freeze (timer text doesn't change while `isPaused: true`)
- Firing-alarm pulse + count-up (assert `.pulse-active` class on active arc; assert center text is count-up `formatMmSs(elapsedSinceAlarmMs)`)
- Pause disabled in firing-alarm (assert button has `disabled` attribute)

**Mock strategy:** mock `useSegmentAlarm` directly (`vi.mock('../../hooks/useSegmentAlarm', ...)`) and pass synthesised return shapes to the component. Avoids transitive engine + AC mocking.

---

### `src/components/__tests__/SegmentProgressRing.test.tsx` (test, component)

**Analog:** **NONE** — same Wave-0 install as above.

**Test-list to cover** (CONTEXT D-20):

- N-arc rendering (count `<path>` track + fill children for an N-segment config)
- Duration-proportional widths (assert path `d` attribute lengths are proportional to `segment.durationMs` — assert the math by reconstructing `arcPath` outputs from the helpers)
- Color by `endSound` (assert `<path>` `stroke` attribute matches `SOUND_COLORS[endSound]` for each arc)
- Pulse class on active arc during firing (`pulseActive={true}` → assert `.pulse-active` class on the current arc only)
- Paused dimming (`pausedDimming={true}` → assert `opacity={0.5}` on current arc)

**Idiom source:** same `vi.useFakeTimers / clearAllMocks` setup as `SegmentEngine.test.ts:87-96`. No engine mocking needed — `SegmentProgressRing` is pure presentation.

---

### `src/hooks/__tests__/useSegmentAlarm.test.ts` (test, hook)

**Analog:** `src/engine/__tests__/SegmentEngine.test.ts` — engine-test mocking idioms transfer; the new piece is `renderHook` from `@testing-library/react`. Note: although CONTEXT calls out `useAlarm.test.ts` as an analog, **no `useAlarm.test.ts` file exists** (verified by `Grep useAlarm` in `src/hooks` returns only `useAlarm.ts` itself). Use the engine-test patterns instead.

**Mocks pattern** (`SegmentEngine.test.ts:7-78`) — verbatim mock-block for the engine's transitive dependencies:

```typescript
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

vi.mock('../sounds/singingBowl', () => ({ strikeBowl: vi.fn() }));
vi.mock('../sounds/triangle', () => ({ strikeTriangle: vi.fn() }));
vi.mock('../sounds/segmentSound', () => ({ fireSegmentEndSound: vi.fn() }));
// ...etc.
```

→ **For `useSegmentAlarm.test.ts`, simpler approach (RESEARCH Example 6):** mock the *engine class itself* so `new SegmentEngine()` returns a stub; this avoids the transitive AC / Wake Lock / sound module mocks entirely:

```typescript
vi.mock('../../engine/SegmentEngine', () => {
  let segmentChangeCb: ((e: any) => void) | null = null;
  let stateValue: string = 'idle';
  return {
    SegmentEngine: vi.fn().mockImplementation(() => ({
      onSegmentChange: vi.fn((cb) => { segmentChangeCb = cb; }),
      start: vi.fn().mockImplementation(async () => { stateValue = 'running'; }),
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn().mockImplementation(() => { stateValue = 'dismissed'; }),
      getState: vi.fn(() => stateValue),
      getCurrentSegment: vi.fn(() => null),
      isPaused: vi.fn(() => false),
      canPause: vi.fn(() => stateValue === 'running'),
      __fireEvent: (e: any) => segmentChangeCb?.(e),
      __setState: (s: string) => { stateValue = s; },
    })),
  };
});

vi.mock('../../platform/notifications', () => ({
  requestNotificationPermission: vi.fn().mockResolvedValue(true),
}));
```

**Microtask-flush helper** (`SegmentEngine.test.ts:80-85`) — **COPY VERBATIM**, load-bearing per RESEARCH Pitfall #1:

```typescript
async function startEngine(engine: SegmentEngine, config: SegmentConfig = WAKE_EASY_CONFIG): Promise<void> {
  const startPromise = engine.start(config);
  await Promise.resolve(); // load-bearing — flushes microtask queue
  await startPromise;
}
```

→ **Adapt for hook test:** wrap in `await act(async () => { ... })` from `@testing-library/react`:

```typescript
await act(async () => {
  await result.current.start(WAKE_EASY_CONFIG);
});
```

**Test-list to cover** (CONTEXT D-20; RESEARCH Example 6):

- `start()` requests notification permission and brings up engine
- `pause()` / `resume()` / `stop()` propagate to engine and update reactive state
- Segment-change callback wiring (fire `__fireEvent({ kind: 'start', ... })` → assert `currentSegment` updates)
- Snapshot semantics on pause/resume (Pitfall 3: both `segmentEndsAt` and `totalEndsAt` survive a pause/resume cycle without losing the pause duration)
- `alarmStartedAt` populated only during firing-alarm (fire `__fireEvent({ kind: 'end', segment: { endSound: 'alarm' } })` + `__setState('firing-alarm')` → assert `alarmStartedAt > 0`; before the event → 0)

---

### `src/hooks/__tests__/useActiveAlarm.test.ts` (test, hook)

**Analog:** `src/engine/__tests__/SegmentEngine.test.ts` (mocking idioms) + the new `useSegmentAlarm.test.ts` (renderHook idioms). No direct analog for the discriminated-union narrowing assertion.

**Mock both underlying hooks** (RESEARCH Example 7):

```typescript
vi.mock('../useAlarm', () => ({
  useAlarm: vi.fn(() => ({ isRunning: false, /* ... full UseAlarmReturn shape ... */ })),
}));
vi.mock('../useSegmentAlarm', () => ({
  useSegmentAlarm: vi.fn(() => ({ isRunning: false, /* ... full UseSegmentAlarmReturn shape ... */ })),
}));
```

**Test-list to cover** (CONTEXT D-20):

- `mode === 'idle'` when neither alarm is running (assert `result.current.mode` and `typeof result.current.start === 'function'`)
- Discriminated-union narrowing: when mocked `useAlarm` returns `isRunning: true` → `result.current.mode === 'continuous'` and `result.current.alarm` typechecks as `UseAlarmReturn`; same for `'segments'`
- Mode resets to `null`/`'idle'` after stop (mock `isRunning: false` after a stop call → assert `mode === 'idle'`)
- Both engines mounted but only one runs (assert `SegmentEngine` constructor mock called exactly once during the entire hook lifecycle, not on every `start` — Pitfall 6)
- `pendingMode` race-window guard: if `useAlarm.start` is a never-resolving promise, `mode` is still `'continuous'` between tap and resolution (asserts the `pendingMode ?? 'idle'` fallback)

---

## Shared Patterns (cross-cutting)

### 1. Engine-in-React lazy-init via `useRef`

**Source:** `src/hooks/useAlarm.ts:65-74` + `src/dev/SegmentHarness.tsx:26-29` (read-only references). **Apply to:** `useSegmentAlarm.ts`.

**Verbatim idiom:**

```typescript
const engineRef = useRef<SegmentEngine | null>(null);
if (engineRef.current === null) {
  engineRef.current = new SegmentEngine();
}
const engine = engineRef.current;
```

**Why load-bearing:** prevents engine re-creation on re-render; lifetime matches component lifetime (RESEARCH §"State of the Art"); engine constructor is verified safe-to-call-eagerly (`SegmentEngine.ts:48-73` does no async work — Pitfall 6).

### 2. Engine callback registered in hook body, not `useEffect`

**Source:** `src/hooks/useAlarm.ts:76-86` (read-only). **Apply to:** `useSegmentAlarm.ts`.

**Why:** Engine API is single-callback-last-wins. React re-renders replace the closure with a fresh `setState` reference each time. `useEffect` would create stale closures (RESEARCH Pitfall 1).

**Verbatim doc-comment to copy** (`useAlarm.ts:76-79`):

```typescript
// Register on*Change callback directly in the hook body (not in useEffect).
// Last-registration-wins per the engine API contract — React re-renders replace
// the callback with a fresh closure that has access to current state via setState.
// This avoids stale closures and matches Pattern 1 from 03-RESEARCH.md.
```

### 3. T-03-01 controlled-methods (no engine ref escape)

**Source:** `src/hooks/useAlarm.ts:8-10` doc + `useAlarm.ts:126-136` return statement. **Apply to:** `useSegmentAlarm.ts`, `useActiveAlarm.ts`.

The hook returns only `{ state fields, controlled methods }` — never `engineRef.current`. Mirrors `useAlarm.ts:126-136`.

### 4. Notification permission gated on user-gesture (`start()`)

**Source:** `src/hooks/useAlarm.ts:88-91` (read-only) + `src/platform/notifications.ts` (read-only — SEG-05). **Apply to:** `useSegmentAlarm.start`.

**Verbatim line** (`useAlarm.ts:90`):

```typescript
await requestNotificationPermission();
```

Called as the first `await` inside `start()`, before `engine.start(config)`. Per CONTEXT D-18 + RESEARCH Pitfall 2 + Security §V5 (single permission prompt, only on user gesture).

### 5. 250ms ticker with pause-freeze + cleanup

**Source:** `src/components/Countdown.tsx:74-93` (read-only). **Apply to:** `SegmentCountdown.tsx`.

**Pattern shape:**

- Early-return on `(alarm.isPaused || !alarm.isRunning)` so paused state freezes the displayed time.
- Set state immediately at effect entry (no initial 250ms lag).
- `setInterval(..., 250)` with `clearInterval` cleanup in the effect's return (T-03-08: no interval leak).
- Dependency array includes everything that should re-establish the interval on change.

### 6. Tailwind v4 warm-earth palette tokens (CSS variables)

**Source:** `src/index.css:5-18` (read-only — SEG-05 protected). **Apply to:** `SegmentProgressRing.tsx` (arc colors), `SegmentCountdown.tsx` (timer + label text colors), Dashboard inline strings.

**Verbatim mapping** (UI-SPEC L94-104):

| Token | Value | Used in |
|-------|-------|---------|
| `var(--color-bg)` | `#f4f1eb` | App.tsx wrapper (already in place) |
| `var(--color-text-primary)` | `#3d4a38` | Big mm:ss timer |
| `var(--color-text-secondary)` | `#8a7e6b` | Phase label, total caption |
| `var(--color-accent)` | `#c27c5a` | Stop button bg, alarm-arc stroke |
| `var(--color-sage)` | `#5c6b56` | Header text, gentle-arc stroke |
| `var(--color-sand)` | `#c8b89a` | Triangle-arc stroke |
| `var(--color-faded)` | `#d9d3ca` | Past-arc stroke, track stroke |
| `var(--color-border)` | `#d4cbbe` | Pause button border |
| `var(--font-size-countdown)` | `clamp(3rem, 12vw, 5rem)` | Big timer inline-style |

Phase 8 introduces zero new tokens.

### 7. `formatMmSs` reuse for stable-width numeric display

**Source:** `src/utils/formatTime.ts:8-13` (read-only). **Apply to:** `SegmentCountdown.tsx` (big timer + total caption + count-up).

```typescript
export function formatMmSs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
```

Always paired with `font-variant-numeric: tabular-nums` inline style for stable mm:ss width during ticking (Phase 3 D-07; UI-SPEC §"Numeric stability").

### 8. CSS keyframes appended to `index.css` for the 1Hz pulse

**Source:** **NEW** — no v1 keyframes precedent. **Apply to:** new keyframes block in `src/index.css` (this IS a modification — `index.css` is **NOT** in the SEG-05 protected list; verified against `08-RESEARCH.md` Example 1).

**Verbatim CSS to append** (UI-SPEC L390-401; RESEARCH Example 1):

```css
/* Phase 8: Segment-mode active-arc pulse during firing-alarm (D-03, D-04) */
@keyframes pulse-active-arc {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.7; }
}

@media (prefers-reduced-motion: no-preference) {
  .pulse-active {
    animation: pulse-active-arc 1s ease-in-out infinite;
  }
}
```

**Why `prefers-reduced-motion: no-preference`:** RESEARCH Pitfall 7 — pulse only fires when user has NOT expressed motion-reduction preference. The static state-5 position + count-up timer + "Wake" label still signal firing even without animation.

**Why opacity (not stroke color):** UI-SPEC L412-415 — opacity preserves single-token palette; pulses on the same color the eye is already tracking.

### 9. Tailwind v1 button vocabulary (control row)

**Source:** `src/components/Countdown.tsx:138-150` (read-only — SEG-05). **Apply to:** `SegmentCountdown.tsx` control row.

**Verbatim class strings** to copy (UI-SPEC L280-296):

- Pause/Resume button: `px-8 py-3 rounded-xl border border-border text-text-primary bg-white/60 text-base transition-colors hover:bg-white/80 active:scale-[0.98]` + Phase 8 addition `disabled:opacity-40 disabled:cursor-not-allowed` (the ONE button-vocabulary delta).
- Stop button: `px-8 py-3 rounded-xl bg-accent text-white text-base transition-colors hover:bg-accent/90 active:scale-[0.98]` (byte-identical to v1).
- Control-row wrapper: `flex gap-4 mt-10`.

### 10. SEG-05 byte-identical guardrail (regression check)

**Source:** `.planning/phases/07-segment-engine-triangle-sound/07-05-PLAN.md:537` (template). **Apply to:** Phase 8 verification gate (final wave; CONTEXT D-21).

**Verbatim one-liner** (RESEARCH Example 5 — list of 20 protected paths shown in §"SEG-05 protected paths"):

```bash
git diff --name-only main..HEAD -- \
  <20 protected paths> \
  | wc -l
# MUST equal 0
```

Run once at the end of the phase, not per plan.

---

## No Analog Found

Files / patterns with no close match in the codebase — planner should rely on RESEARCH.md and UI-SPEC.md for these:

| File / pattern | Why no analog | Where to derive from |
|----------------|---------------|----------------------|
| `useActiveAlarm.ts` (composing two hooks) | No multi-hook composer exists in the repo | RESEARCH Pattern 2 + Pattern 5 (locked discriminated-union shape) |
| `SegmentProgressRing.tsx` (N-arc, duration-proportional) | v1 ring is fixed 3-arc + dot | RESEARCH Pattern 4 (full pseudocode) + ProgressRing.tsx helpers verbatim |
| `.pulse-active` keyframes in `index.css` | v1 has no animation keyframes | UI-SPEC §"Animations" + RESEARCH Example 1 |
| `*.test.tsx` (DOM component tests) | No `.tsx` test file exists; no `@testing-library/react` installed | RESEARCH §"Test infrastructure" + Wave-0 install task; closest pattern is `SegmentEngine.test.ts` mocking idioms |
| `useSegmentAlarm.test.ts` (`renderHook` for hooks) | No hook-level test exists; v1 hooks were never tested directly | RESEARCH Example 6 + `SegmentEngine.test.ts:80-96` mocking idioms |

---

## Metadata

**Analog search scope:**
- `src/hooks/` (1 file: useAlarm.ts)
- `src/components/` (5 files: Countdown.tsx, ProgressRing.tsx, Dashboard.tsx, PresetCard.tsx, App.tsx)
- `src/dev/` (1 file: SegmentHarness.tsx)
- `src/engine/` and `src/platform/` (consumed unchanged; SEG-05 protected)
- `src/{components,hooks}/__tests__/` (no files — confirmed via Glob)
- `src/engine/__tests__/SegmentEngine.test.ts` (mocking-idiom analog for hook tests)

**Files scanned:** 11 source files + 3 phase docs (CONTEXT, RESEARCH, UI-SPEC).

**Pattern extraction date:** 2026-05-10.

**Phase 7 plan-file precedent referenced:** `.planning/phases/07-segment-engine-triangle-sound/07-05-PLAN.md:537` (byte-identical guardrail template; Phase 8 inherits the pattern verbatim).
