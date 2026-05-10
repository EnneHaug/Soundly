# Phase 8: Wake Easy Preset + Segment Countdown UI - Research

**Researched:** 2026-05-10
**Domain:** React 19 hook composition + SVG arc geometry + discriminated-union routing on top of an already-shipped engine
**Confidence:** HIGH (all deliverables consume code that physically exists in this repo; every claim below is line-anchored)

## TL;DR — Where the planner should spend leverage

1. **The five new files are pure consumers of already-shipped APIs.** SegmentEngine (`src/engine/SegmentEngine.ts:48-412`), `WAKE_EASY_CONFIG` (`SegmentState.ts:104-112`), and `formatMmSs` (`utils/formatTime.ts:8-13`) are all live and unchanged. No engine work; no audio work. The phase is hooks + SVG + a card.
2. **`useSegmentAlarm` mirrors `useAlarm` line-for-line** with three concrete deltas: `phase` → `state` (the engine's enum, not v1's), `phaseEndsAt` → `segmentEndsAt + totalEndsAt + alarmStartedAt`, and `onPhaseChange` → `onSegmentChange` registered in the body (last-wins). Map is in §"useSegmentAlarm mirror map".
3. **`SegmentProgressRing` is a generalisation of `ProgressRing.tsx` for variable-arc-count and duration-proportional widths** — same `viewBox 200x200`, same `RADIUS=80 / STROKE_WIDTH=14 / GAP_RADIANS=0.05`, same `polarToCartesian` + `arcPath` helpers. The dasharray approach the focus area mentions is **not** how `ProgressRing.tsx` builds arcs — it uses cumulative-angle `M ... A ...` paths, which is simpler and what the planner should mirror. Concrete pseudocode in §"Pattern 4".
4. **Always-both-mounted is safe.** Both hooks lazy-init via `useRef`; engines do nothing on construction (verified in `SegmentEngine.ts:48-73` — fields initialise to `null`/`'idle'`/`false`). No AudioContext, no Wake Lock, no notifications fire until `start()`.
5. **The discriminated union narrows correctly under TS strict mode.** `useActiveAlarm` returns `{ mode: 'idle'; start } | { mode: 'continuous'; alarm } | { mode: 'segments'; alarm }`. App.tsx narrows on `mode` and TS proves `alarm` is the right shape in each branch — no casts needed, no adapter layer.
6. **The byte-identical guardrail is a one-line git diff check.** Phase 7's plan 07-05 established the pattern at `07-05-PLAN.md:537`. Phase 8 inherits the same 17 protected paths and runs the same `git diff --name-only main..HEAD -- <paths> | wc -l` command — must equal 0. The list grows because `useAlarm.ts`, `Countdown.tsx`, and `ProgressRing.tsx` were already protected and continue to be.

**Primary recommendation:** Plan as five independent files (SegmentProgressRing → SegmentCountdown → useSegmentAlarm → useActiveAlarm → wiring) plus one delete (SegmentHarness) plus two minimal-diff edits (Dashboard, App). Tests follow files. The byte-identical regression check runs once at the end of the phase, not per plan.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Progress visual = duration-proportional N-arc ring; same shape as v1 `ProgressRing` but one arc per segment, arc width ∝ `segment.durationMs`. Wake Easy: 4 large gentle arcs (240,000 ms each, ~23.5% of ring) + 1 small alarm arc (60,000 ms, ~5.9%).
- **D-02:** Arc colors by `endSound`: `'gentle'` → `var(--color-sage)`, `'triangle'` → `var(--color-sand)`, `'alarm'` → `var(--color-accent)`. Past = faded; current = full; future = full.
- **D-03:** `'firing-alarm'` state shows segment-5-active visual + active arc pulses ~1 Hz. Center display switches to count-up elapsed-since-alarm-start. Pause button disabled (`canPause()` returns false).
- **D-04:** Pulse via CSS keyframes on opacity 0.7 ↔ 1.0 over 1000 ms ease-in-out. JS-driven animation NOT preferred.
- **D-05:** Big mm:ss = remaining in current segment. Small caption = total composition time remaining (e.g. "13:42 total"). Phase label = friendly description.
- **D-06:** `formatMmSs` from `src/utils/formatTime.ts` reused; `font-variant-numeric: tabular-nums`.
- **D-07:** `useActiveAlarm()` returns discriminated union (LOCKED shape — see §"Pattern 5").
- **D-08:** Both hooks mounted unconditionally; small `activeMode: 'continuous' | 'segments' | null` tracks live one.
- **D-09:** `useSegmentAlarm` mirrors `useAlarm.ts:65-137` shape exactly (locked surface — see §"useSegmentAlarm mirror map").
- **D-10:** UI takeover for concurrency — no dialogs, no disabled-card states.
- **D-11:** New PresetCard appears at the **bottom** of the dashboard. Order: Quick Nap → Focus → 4 x 4.
- **D-12:** Card label = `"4 x 4"` (with spaces). Description = `"4 chimes over 16 min, then alarm"`.
- **D-13:** Internal symbols keep `Wake Easy` naming. Only the displayed `name` prop diverges.
- **D-14:** Dashboard prop changes from `{ alarm }` to `{ activeAlarm }`; each `onStart` dispatches the right `PresetSelection`.
- **D-15:** App.tsx switches to `useActiveAlarm()`; renders branch on `activeAlarm.mode`. Removes SegmentHarness import + `showSegmentHarness` const + `?dev=segments` URL handling.
- **D-16:** Delete `src/dev/SegmentHarness.tsx` outright. Remove the 3 App.tsx wiring lines.
- **D-17:** Pre-build sanity: `grep -r "SegmentHarness" src/` returns 0; `npm run build` succeeds; `grep -r "SegmentHarness" dist/` returns 0.
- **D-18:** `useSegmentAlarm.start()` calls `requestNotificationPermission()` from user gesture, mirroring `useAlarm.ts:88-99`.
- **D-19:** Pause-state visual = active arc opacity 0.5 + frozen timer + button label "Resume".
- **D-20:** Tests added — 4 new test files (`SegmentCountdown.test.tsx`, `SegmentProgressRing.test.tsx`, `useSegmentAlarm.test.ts`, `useActiveAlarm.test.ts`).
- **D-21:** v1 byte-identical regression net: existing tests pass without modification; `git diff --name-only` guardrail against protected paths (template = Phase 7 plan 07-05).
- **D-22:** `src/engine/index.ts` does NOT need changes — Phase 7 already added all required exports.

### Claude's Discretion

- Whether `SegmentProgressRing` is a separate file or refactor (CONTEXT note resolves to: separate file, because `ProgressRing.tsx` MUST stay byte-identical).
- Exact CSS for the 1 Hz pulse (keyframes vs Tailwind utility vs inline `style`).
- Position of "X of N" segment-index display (above/below/beside phase label).
- Whether alarm-firing count-up uses elapsed-since-alarm-start or elapsed-since-segment-start (CONTEXT recommends alarm-start).
- `onStart` failure UX (CONTEXT recommends `try/catch` with transient toast/alert).

### Deferred Ideas (OUT OF SCOPE)

- Composer modal + Custom button (Phase 9)
- Share-via-URL hash decode (Phase 9)
- Drag-and-drop segment reorder (out of v2.0 scope per ROADMAP)
- Visual segment timeline preview (Phase 9 composer concern)
- Per-segment volume control (future v2.x)
- Marketing landing page + multi-page split (Phase 11)
- SEO meta + JSON-LD (Phase 10)
- iOS AudioContext.resume() on visibilitychange (still deferred from Phase 6/7)
- `acquireWakeLock` `_sentinel` overwrite fix (still deferred from Phase 6/7)
- Renaming `WAKE_EASY_CONFIG`/segment IDs to "4 x 4" (explicitly chosen NOT to do per D-13)
- Arc-flash on segment-end (subtle bloom on just-completed arc) — out of scope for Phase 8

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEG-06 | Wake Easy preset ships as the third dashboard preset card — 4 × (4 min ending in gentle chime) + 1 × (1 min ending in alarm) = 17 min total. Displayed total label matches actual segment sum exactly. | All findings below. The card uses `WAKE_EASY_CONFIG` (already exists, sums to exactly 1,020,000 ms = 17 min — verified `SegmentState.ts:104-112`). The `SegmentCountdown` UI consumes the running engine. The label/description text is hard-coded per D-12. |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Segment-mode countdown render (mm:ss + arcs + controls) | Browser/React component | — | Pure client-side rendering; consumes hook state |
| Engine→React state bridging | Browser/React hook | — | `useRef` + `useState` + `onSegmentChange` callback wiring |
| Mode dispatch (continuous vs segments) | Browser/React hook | — | `useActiveAlarm` is a thin selector over two underlying hooks |
| 1Hz pulse animation | Browser/CSS | — | Pure CSS keyframes per D-04 (no JS animation) |
| Notification permission request | Browser API (gated by user gesture) | — | Reuses `platform/notifications.ts`; called from `useSegmentAlarm.start()` |
| Audio scheduling, segment fires, alarm ramp | Engine (Phase 7 — unchanged) | — | All audio lives in `SegmentEngine` and its sound modules; UI never touches the audio graph |
| AudioContext / Wake Lock / keepalive lifecycle | Engine (Phase 6 `AlarmSession` — unchanged) | — | Each engine owns its own `AlarmSession`; concurrency guarded by UI takeover (D-10) |

---

## Standard Stack

This phase adds zero dependencies. Every deliverable consumes the existing stack.

### Core (already installed, verified `package.json`)
| Library | Version | Purpose |
|---------|---------|---------|
| react | ^19.0.0 | UI rendering, hooks (`useState`, `useRef`, `useEffect`) |
| react-dom | ^19.0.0 | DOM rendering |
| typescript | ~5.6.2 | Type safety; discriminated-union narrowing in `useActiveAlarm` |
| vite | ^6.0.5 | Build/dev |
| @tailwindcss/vite | ^4.0.0 | Styling (CSS variables for palette tokens) |
| vitest | ^3.1.2 | Unit tests with fake timers |

### Test infrastructure note
**LOW confidence** (would be HIGH after install): The codebase has Vitest 3.1.2 but **no React Testing Library installed yet** (verified by `package.json` and `Glob src/**/__tests__`). Tests so far are all engine/sound/platform unit tests — no `.tsx` test files exist. Phase 8 introduces the first React-component tests.

**Planner action:** Determine whether the SegmentCountdown / SegmentProgressRing tests will:
- (a) Use `@testing-library/react` (requires `npm install @testing-library/react @testing-library/dom @testing-library/jest-dom` + jsdom)
- (b) Use lighter-weight render assertions (e.g. `react-test-renderer` or pure prop-shape unit tests on the rendering function, no DOM)
- (c) Skip DOM tests for the components and only test the hooks (`useSegmentAlarm.test.ts`, `useActiveAlarm.test.ts`) — components verified visually via dev server

The CONTEXT D-20 test list names `SegmentCountdown.test.tsx` and `SegmentProgressRing.test.tsx`, which implies (a). The planner should pick this up as an early-wave install task. Tagged `[VERIFIED: package.json + filesystem grep]`.

### Verification
```bash
npm view react version             # confirm 19.x current
npm view @testing-library/react version  # if going with route (a)
```
**Tagged `[ASSUMED]`:** Versions weren't re-checked against npm registry in this session — they're declared in package.json. Pre-install verification is the planner's call.

---

## Architecture Patterns

### System Diagram (data flow)

```
Dashboard tap "4 x 4"
   │
   v
useActiveAlarm.start({ kind: 'segments', config: WAKE_EASY_CONFIG })
   │  ├─ sets activeMode = 'segments'
   │  └─ calls useSegmentAlarm.start(WAKE_EASY_CONFIG)
   v
useSegmentAlarm.start
   │  ├─ requestNotificationPermission() (user gesture context)
   │  ├─ engine.start(config)        ── SegmentEngine validates + schedules 5 absolute fires
   │  └─ setState({ isRunning, segmentEndsAt: now + 240000, totalEndsAt: now + 1020000, ... })
   v
SegmentEngine fires onSegmentChange callback
   │  └─ hook re-computes segmentEndsAt for next segment, sets alarmStartedAt on firing-alarm
   v
React re-render → App.tsx narrows on activeAlarm.mode === 'segments' → <SegmentCountdown alarm=...>
   v
SegmentCountdown
   ├─ ticker setInterval(250ms) → setDisplayRemainingMs(segmentEndsAt - Date.now())
   ├─ <SegmentProgressRing config={config} currentIndex={...} progress={...} pulse={state==='firing-alarm'}>
   │     ├─ N <path d="M ... A ..."> arcs, color by endSound, opacity by past/current/future
   │     └─ active arc gets className='pulse-active' when firing-alarm
   └─ Stop / Pause/Resume buttons → hook methods → engine methods
```

### Recommended file structure
```
src/
├── components/
│   ├── SegmentCountdown.tsx           # NEW — N-segment countdown screen
│   ├── SegmentProgressRing.tsx        # NEW — N-arc duration-proportional ring
│   ├── Countdown.tsx                  # UNCHANGED (byte-identical floor)
│   ├── ProgressRing.tsx               # UNCHANGED (byte-identical floor)
│   ├── PresetCard.tsx                 # UNCHANGED — used as-is for "4 x 4"
│   ├── Dashboard.tsx                  # MODIFIED — add 3rd card + prop signature change
│   └── __tests__/
│       ├── SegmentCountdown.test.tsx  # NEW
│       └── SegmentProgressRing.test.tsx # NEW
├── hooks/
│   ├── useSegmentAlarm.ts             # NEW — paired with useAlarm
│   ├── useActiveAlarm.ts              # NEW — mode dispatch
│   ├── useAlarm.ts                    # UNCHANGED (byte-identical floor)
│   └── __tests__/
│       ├── useSegmentAlarm.test.ts    # NEW
│       └── useActiveAlarm.test.ts     # NEW
├── App.tsx                            # MODIFIED — replace useAlarm with useActiveAlarm; remove harness wiring
└── dev/
    └── SegmentHarness.tsx             # DELETED
```

### Pattern 1: useSegmentAlarm — mirror map vs useAlarm

The planner should mirror `useAlarm.ts:65-137` line-by-line. Side-by-side:

| useAlarm.ts | Equivalent in useSegmentAlarm |
|-------------|--------------------------------|
| `engineRef = useRef<AlarmEngine \| null>(null)` (`L66`) | `engineRef = useRef<SegmentEngine \| null>(null)` |
| `if (engineRef.current === null) engineRef.current = new AlarmEngine()` (`L70-72`) | `if (engineRef.current === null) engineRef.current = new SegmentEngine()` |
| `engine.onPhaseChange((newPhase) => setState(...))` (`L80-86`) | `engine.onSegmentChange((event) => setState(...))` — registered in body, last-wins |
| `phase: AlarmPhase` state | `state: SegmentEngineState` ('idle'/'running'/'firing-alarm'/'dismissed') |
| `phaseEndsAt: number` (epoch when current phase ends) | `segmentEndsAt: number` (epoch when current segment fires) |
| (no equivalent) | `totalEndsAt: number` (epoch when whole composition ends; 0 during firing-alarm — D-05) |
| (no equivalent) | `alarmStartedAt: number` (set when state transitions to firing-alarm; 0 otherwise — D-03) |
| (no equivalent) | `currentSegment: { index, total, segment } \| null` (mirrors `engine.getCurrentSegment()`) |
| `start(config: AlarmConfig)` (`L88-99`) | `start(config: SegmentConfig)` — same shape, calls `requestNotificationPermission` + `engine.start` |
| `stop()` (`L101-104`) | `stop()` — calls `engine.stop()`, resets state |
| `pause()` (`L106-114`) — snapshots remaining ms | `pause()` — calls `engine.pause()`, snapshots `segmentEndsAt` and `totalEndsAt` as remaining ms (D-19) |
| `resume()` (`L116-124`) — converts remaining ms back to epoch | `resume()` — converts both back to epochs |

**Key callback wiring (HIGH confidence — verified by reading SegmentEngine.ts:179-185):**

When `engine.start()` runs, it emits an initial `{ kind: 'start', segmentIndex: 0, totalSegments: N, segment: segments[0] }` from the body of `start()` itself. Then each scheduled fire emits `{ kind: 'end', ... }` followed by `{ kind: 'start', ... }` for the next segment (or no `start` for the alarm segment — see `SegmentEngine.ts:228`). The hook's `setState` derives `segmentEndsAt` from `Date.now() + nextSegment.durationMs` on `kind: 'start'`.

**Critical: `alarmStartedAt` population.** When the alarm segment begins, the engine fires `{ kind: 'end', segmentIndex: 4, segment: { endSound: 'alarm', ... } }` and then sets state to `'firing-alarm'` internally without firing a `'start'` event (per `SegmentEngine.ts:228` — "No 'start' event for a synthesized 'next segment'"). The hook detects this in the `onSegmentChange` callback by checking `event.kind === 'end' && event.segment.endSound === 'alarm'` and sets `alarmStartedAt = Date.now()`. State (`SegmentEngineState`) should be polled via `engine.getState()` after the callback fires. Also verified at `SegmentEngine.ts:212` — state transition happens before ramp creation.

```typescript
// Sketch: useSegmentAlarm.ts callback registration (mirrors useAlarm.ts:80-86)
engine.onSegmentChange((event: SegmentChangeEvent) => {
  setState((prev) => {
    const newState = engine.getState();              // poll state after engine emits
    let segmentEndsAt = prev.segmentEndsAt;
    let totalEndsAt = prev.totalEndsAt;
    let alarmStartedAt = prev.alarmStartedAt;
    let currentSegment = prev.currentSegment;

    if (event.kind === 'start') {
      // Just entered a new segment — recompute segmentEndsAt from now + duration
      segmentEndsAt = Date.now() + event.segment.durationMs;
      currentSegment = { index: event.segmentIndex, total: event.totalSegments, segment: event.segment };
    } else if (event.kind === 'end' && event.segment.endSound === 'alarm') {
      // Alarm fire — engine has already transitioned to 'firing-alarm' (verified L212)
      alarmStartedAt = Date.now();
      segmentEndsAt = 0;
      totalEndsAt = 0;
      currentSegment = { index: event.segmentIndex, total: event.totalSegments, segment: event.segment };
    }

    return { ...prev, state: newState, segmentEndsAt, totalEndsAt, alarmStartedAt, currentSegment };
  });
});
```

**Confidence:** HIGH — every line of this sketch is grounded in `SegmentEngine.ts:179-249`. Tagged `[VERIFIED: src/engine/SegmentEngine.ts:179-249]`.

### Pattern 2: useActiveAlarm — discriminated union dispatch

```typescript
import type { AlarmConfig } from '../engine/AlarmState';
import type { SegmentConfig } from '../engine/SegmentState';
import { useAlarm, type UseAlarmReturn } from './useAlarm';
import { useSegmentAlarm, type UseSegmentAlarmReturn } from './useSegmentAlarm';
import { useState } from 'react';

export type PresetSelection =
  | { kind: 'continuous'; config: AlarmConfig }
  | { kind: 'segments';   config: SegmentConfig };

export type ActiveAlarmState =
  | { mode: 'idle';       start: (preset: PresetSelection) => Promise<void> }
  | { mode: 'continuous'; alarm: UseAlarmReturn }
  | { mode: 'segments';   alarm: UseSegmentAlarmReturn };

export function useActiveAlarm(): ActiveAlarmState {
  const continuous = useAlarm();        // always mounted (D-08)
  const segments = useSegmentAlarm();   // always mounted (D-08)
  const [activeMode, setActiveMode] = useState<'continuous' | 'segments' | null>(null);

  // If the underlying hook reports stopped, reset activeMode to null (D-08)
  if (activeMode === 'continuous' && !continuous.isRunning) {
    setActiveMode(null);
  }
  if (activeMode === 'segments' && !segments.isRunning) {
    setActiveMode(null);
  }

  if (activeMode === 'continuous') return { mode: 'continuous', alarm: continuous };
  if (activeMode === 'segments')   return { mode: 'segments',   alarm: segments };

  return {
    mode: 'idle',
    start: async (preset) => {
      if (preset.kind === 'continuous') {
        setActiveMode('continuous');
        await continuous.start(preset.config);
      } else {
        setActiveMode('segments');
        await segments.start(preset.config);
      }
    },
  };
}
```

**Notes:**
- The "set state during render" calls (`if (...) setActiveMode(null)`) need wrapping in `useEffect` or — cleaner — derive `mode` directly from the underlying `isRunning` flags without intermediate state. Recommended alternative below.

**Recommendation (HIGH confidence):** Skip the intermediate `activeMode` state entirely; derive mode from the underlying hooks. The hooks themselves track `isRunning`, so the dispatch is purely derived state:

```typescript
export function useActiveAlarm(): ActiveAlarmState {
  const continuous = useAlarm();
  const segments = useSegmentAlarm();
  const [pendingMode, setPendingMode] = useState<'continuous' | 'segments' | null>(null);

  // Derived mode: 'continuous' if useAlarm running, 'segments' if useSegmentAlarm running, else 'idle'
  // pendingMode covers the brief race between calling start() (which is async) and isRunning flipping true.
  const mode = continuous.isRunning ? 'continuous'
             : segments.isRunning   ? 'segments'
             : pendingMode          ?? 'idle';

  if (mode === 'continuous') return { mode: 'continuous', alarm: continuous };
  if (mode === 'segments')   return { mode: 'segments',   alarm: segments };

  return {
    mode: 'idle',
    start: async (preset) => {
      setPendingMode(preset.kind);  // immediate UI takeover before await resolves
      try {
        if (preset.kind === 'continuous') await continuous.start(preset.config);
        else                              await segments.start(preset.config);
      } finally {
        setPendingMode(null);  // either succeeded (isRunning takes over) or failed (back to idle)
      }
    },
  };
}
```

**Why pendingMode:** Without it, between the user tapping the card and `isRunning` flipping true (which happens after the async `engine.start()` resolves), `mode` would briefly remain `'idle'` and Dashboard would re-render. `pendingMode` covers that window.

**TS strict-mode narrowing:** All three branches of the union return statements are well-typed because `useAlarm` and `useSegmentAlarm` always return their full reactive surface (the `isRunning: false / state: 'idle'` shape just means it's quiescent). TypeScript narrows on `mode` in App.tsx without ceremony. Verified mentally against the existing `useAlarm.ts:126-136` return-shape — every field is always populated, never optional.

### Pattern 3: SegmentCountdown — component decomposition

Read `Countdown.tsx:55-153` once. SegmentCountdown is structurally identical with three deltas:

**Lines reused verbatim from Countdown.tsx:**
- `L111`: outer container `className="flex flex-col items-center w-full max-w-md mx-auto px-6 py-12"` — keep identical for layout consistency.
- `L118-127`: big mm:ss timer with inline style for `font-size: var(--font-size-countdown)` and `font-variant-numeric: tabular-nums` and Tailwind `text-text-primary font-light tracking-tight`.
- `L129-131`: phase label slot — `text-text-secondary text-sm mt-1 transition-opacity duration-500`.
- `L136`: control row `className="flex gap-4 mt-10"`.
- `L138-143`: Pause/Resume button — `className="px-8 py-3 rounded-xl border border-border text-text-primary bg-white/60 text-base transition-colors hover:bg-white/80 active:scale-[0.98]"`. Toggles label between "Pause" and "Resume".
- `L145-150`: Stop button — `className="px-8 py-3 rounded-xl bg-accent text-white text-base transition-colors hover:bg-accent/90 active:scale-[0.98]"`.

**Lines that diverge (new logic):**
- `L25-31` `PHASE_LABELS` Record → REPLACE with: derive friendly label from `currentSegment.segment.endSound`:
  ```typescript
  const SOUND_LABELS: Record<'gentle' | 'triangle' | 'alarm', string> = {
    gentle: 'Gentle chime',
    triangle: 'Triangle ping',
    alarm: 'Wake',
  };
  ```
- `L60-72` `phase3StartRef` + `phase3` elapsed ref → REPLACE with: use `alarm.alarmStartedAt` directly (it's already in hook state — D-03).
- `L76-93` ticker `useEffect` → MIRROR: tick every 250 ms; freeze on pause; cleanup on unmount. Update `displayRemainingMs` from `alarm.segmentEndsAt - Date.now()` and (during firing-alarm) `elapsedMs` from `Date.now() - alarm.alarmStartedAt`.
- `L96-108` `phaseProgress` + `currentPhase` + `displayTime` → REPLACE with: pass `currentIndex` and per-arc-progress to `SegmentProgressRing`. During firing-alarm, show count-up = `Date.now() - alarm.alarmStartedAt`.
- `L113-117` `<ProgressRing config currentPhase phaseProgress>` → `<SegmentProgressRing config={config} currentIndex={...} progress={...} pulseActive={state === 'firing-alarm'} pausedDimming={isPaused}>`.
- `L139` `alarm.isPaused ? alarm.resume : alarm.pause` → keep identical idiom; **but** disable the button entirely when `state === 'firing-alarm'` per D-03 (use `disabled={state === 'firing-alarm'}` + opacity classes). Verified `engine.canPause()` returns false → `pause()` becomes silent no-op (`SegmentEngine.ts:261-262`), so the button could stay enabled and just no-op, but disabling is the better UX signal.

**Center display logic sketch (CONTEXT-provided, lightly tightened):**

```tsx
// During normal running
{state !== 'firing-alarm' && (
  <>
    <span style={{ fontSize: 'var(--font-size-countdown)', fontVariantNumeric: 'tabular-nums' }}
          className="text-text-primary font-light tracking-tight">
      {formatMmSs(displayRemainingMs)}
    </span>
    <span className="text-text-secondary text-xs mt-1 tabular-nums">
      {formatMmSs(totalRemainingMs)} total
    </span>
    <span className="text-text-secondary text-sm mt-2 transition-opacity duration-500">
      Segment {currentSegment.index + 1} of {currentSegment.total} — {SOUND_LABELS[currentSegment.segment.endSound]}
    </span>
  </>
)}

// During firing-alarm (count-up since alarm-start per D-03)
{state === 'firing-alarm' && (
  <>
    <span style={{ fontSize: 'var(--font-size-countdown)', fontVariantNumeric: 'tabular-nums' }}
          className="text-text-primary font-light tracking-tight">
      {formatMmSs(elapsedSinceAlarmMs)}
    </span>
    <span className="text-text-secondary text-sm mt-2">Wake</span>
  </>
)}
```

**Note on `currentSegment.index + 1`:** Engine emits 0-based indices (`SegmentEngine.ts:182`). For user display, add 1 ("Segment 1 of 5", not "Segment 0 of 5"). Verified by reading `SegmentEngine.ts:120-127` (`getCurrentSegment` returns 0-based `index`).

### Pattern 4: SegmentProgressRing — N-arc geometry

**HIGH-confidence recommendation:** Mirror `ProgressRing.tsx:42-58` exactly — the helpers `polarToCartesian` and `arcPath` are reusable verbatim. Do NOT use SVG `stroke-dasharray` for arc lengths; use cumulative angle math + `M ... A ...` paths. The v1 ring already does this and it's clean.

**Why not dasharray:** The current `ProgressRing.tsx` doesn't use dasharray — it builds individual `<path d="M ... A ...">` elements per segment with explicit start/end angles. Each path's stroke fills its full length; there's no need to fake "arc length within a circle" via dashes. This generalises to N arcs trivially.

**Exact constants from `ProgressRing.tsx:27-31`:**
```typescript
const CENTER = 100;       // SVG viewBox 200x200
const RADIUS = 80;
const STROKE_WIDTH = 14;
const GAP_RADIANS = 0.05; // small visual gap between segments
const TWO_PI = 2 * Math.PI;
```

These all carry over to `SegmentProgressRing` unchanged. The viewBox is 200×200 with radius 80, leaving 20px padding for the linecap-rounded stroke caps. **Confidence: HIGH** — verified `ProgressRing.tsx:27-31`.

**Helpers to clone:**

```typescript
function polarToCartesian(angleCw: number): { x: number; y: number } {
  const theta = angleCw - Math.PI / 2; // start from top
  return { x: CENTER + RADIUS * Math.cos(theta), y: CENTER + RADIUS * Math.sin(theta) };
}

function arcPath(startAngle: number, endAngle: number): string {
  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}
```

**Duration-proportional arc construction (new logic for SegmentProgressRing):**

```typescript
interface SegmentProgressRingProps {
  config: SegmentConfig;
  currentIndex: number;       // 0..N-1 of the segment currently elapsing; N when dismissed
  progress: number;           // 0..1: how far through the CURRENT segment (0 = just started, 1 = complete)
  pulseActive?: boolean;      // true when state === 'firing-alarm' (D-03)
  pausedDimming?: boolean;    // true when paused — drops active arc opacity to 0.5 (D-19)
  children?: React.ReactNode;
}

const SOUND_COLORS: Record<'gentle' | 'triangle' | 'alarm', string> = {
  gentle:   'var(--color-sage)',   // D-02
  triangle: 'var(--color-sand)',   // D-02
  alarm:    'var(--color-accent)', // D-02
};

export default function SegmentProgressRing({
  config, currentIndex, progress, pulseActive, pausedDimming, children
}: SegmentProgressRingProps) {
  const segments = config.segments;
  const N = segments.length;
  const totalDuration = segments.reduce((sum, s) => sum + s.durationMs, 0);
  const totalGap = N * GAP_RADIANS;
  const availableArc = TWO_PI - totalGap;

  // Compute each arc's start/end angles (cumulative)
  let cursor = 0;
  const arcs = segments.map((seg, i) => {
    const arcLen = (seg.durationMs / totalDuration) * availableArc;
    const start = cursor;
    const end = cursor + arcLen;
    cursor = end + GAP_RADIANS;
    return { i, segment: seg, start, end, arcLen };
  });

  return (
    <div className="relative w-full max-w-[280px] mx-auto">
      <svg viewBox="0 0 200 200" className="w-full" role="img" aria-label="Alarm progress">
        {arcs.map(({ i, segment, start, end, arcLen }) => {
          const color = SOUND_COLORS[segment.endSound];
          const isPast = i < currentIndex;
          const isCurrent = i === currentIndex;
          const isFuture = i > currentIndex;

          // Track (faded background — same as ProgressRing.tsx:114-124)
          const track = (
            <path key={`track-${i}`}
                  d={arcPath(start, end)}
                  fill="none" stroke="var(--color-faded)"
                  strokeWidth={STROKE_WIDTH} strokeLinecap="round" opacity={0.4} />
          );

          // Active fill — past = faded gray, current = colored to remaining portion, future = full colored
          let activeFill: React.ReactNode = null;
          if (isPast) {
            activeFill = (
              <path key={`fill-${i}`} d={arcPath(start, end)}
                    fill="none" stroke="var(--color-faded)"
                    strokeWidth={STROKE_WIDTH} strokeLinecap="round" opacity={0.6} />
            );
          } else if (isCurrent) {
            const remainingArc = (1 - Math.min(1, Math.max(0, progress))) * arcLen;
            if (remainingArc > 0.001) {
              activeFill = (
                <path key={`fill-${i}`}
                      className={pulseActive ? 'pulse-active' : undefined}
                      d={arcPath(start, start + remainingArc)}
                      fill="none" stroke={color}
                      strokeWidth={STROKE_WIDTH} strokeLinecap="round"
                      opacity={pausedDimming ? 0.5 : 1} />
              );
            }
          } else if (isFuture) {
            activeFill = (
              <path key={`fill-${i}`} d={arcPath(start, end)}
                    fill="none" stroke={color}
                    strokeWidth={STROKE_WIDTH} strokeLinecap="round" opacity={1} />
            );
          }

          return [track, activeFill];
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
```

**Three subtleties:**
1. **Gaps between arcs.** `ProgressRing.tsx:30` uses `GAP_RADIANS = 0.05`. With 5 arcs (Wake Easy), 5 gaps × 0.05 = 0.25 rad = ~14°. That's a noticeable visual gap; the alarm arc (only ~0.37 rad wide for 60 sec out of 1,020 sec) is already small. The planner may want to reduce `GAP_RADIANS` to 0.03 or 0.02 for the segment ring to keep the alarm arc visually present. **MEDIUM confidence — would be HIGH after rendering both options.** Note: v1 `ProgressRing.tsx:92` reserves only **2 gaps** between its 3-element layout (2 arcs + dot), not 3 gaps. SegmentProgressRing has N gaps between N arcs (the last gap closes the ring back to the start). The planner can choose: N gaps (visually balanced) or N−1 gaps (tighter). Recommendation: N gaps for symmetry.
2. **Stroke linecap behaviour.** `strokeLinecap="round"` adds half-stroke-width rounded caps at each arc end. With `STROKE_WIDTH=14` and `RADIUS=80`, the cap arc length is ~7px which slightly extends the visible arc beyond its mathematical end. For variable-width arcs this means the small alarm arc looks slightly longer than its 60s/1020s ratio suggests. Acceptable visual tradeoff per v1 precedent.
3. **Per-arc start-offset is NOT needed.** Each `<path>` declares its own `M start A end` — no shared offset accumulator across paths.

**Computing `progress` from hook state:**

```typescript
// In SegmentCountdown
const progress = currentSegment
  ? 1 - displayRemainingMs / currentSegment.segment.durationMs
  : 0;
```

Same idiom as `Countdown.tsx:99-103`.

### Pattern 5: useActiveAlarm return shape (LOCKED — D-07)

```typescript
export type PresetSelection =
  | { kind: 'continuous'; config: AlarmConfig }
  | { kind: 'segments';   config: SegmentConfig };

export type ActiveAlarmState =
  | { mode: 'idle';       start: (preset: PresetSelection) => Promise<void> }
  | { mode: 'continuous'; alarm: UseAlarmReturn }
  | { mode: 'segments';   alarm: UseSegmentAlarmReturn };
```

App.tsx narrows on `mode`:

```tsx
{activeAlarm.mode === 'idle'       && <Dashboard activeAlarm={activeAlarm} />}
{activeAlarm.mode === 'continuous' && <Countdown alarm={activeAlarm.alarm} />}
{activeAlarm.mode === 'segments'   && <SegmentCountdown alarm={activeAlarm.alarm} />}
```

**TS strict narrowing works** — verified mentally against TS 5.6 discriminated unions. No `as` casts. Each branch knows its `alarm` shape.

### Anti-Patterns to Avoid

- **Don't refactor `ProgressRing.tsx` to share with `SegmentProgressRing`.** It's protected (SEG-05). Copy the helpers; don't extract them. Future Phase 9+ can refactor.
- **Don't expose `engineRef.current` from `useSegmentAlarm`.** Mirror `useAlarm.ts:8-10` T-03-01: only controlled methods escape the hook.
- **Don't register `onSegmentChange` in `useEffect`.** v1 `useAlarm.ts:79` registers in the body — last-registration-wins; lets React's render cycle replace the closure with fresh `setState`. Same pattern here.
- **Don't try to derive `state` directly without polling `engine.getState()`.** The engine fires `onSegmentChange` events but the state transition (`'running'` → `'firing-alarm'`) happens inside `handleSegmentFire` (`SegmentEngine.ts:212`). The hook polls `engine.getState()` after the callback fires.
- **Don't add a confirmation dialog.** D-10 explicitly says UI takeover, no dialogs.
- **Don't introduce Framer Motion for the pulse.** D-04 explicitly says CSS keyframes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Time formatting (mm:ss, zero-pad) | New formatter | `formatMmSs` from `src/utils/formatTime.ts:8-13` | Already shipped, used by Countdown; D-06 mandates reuse |
| Notification permission flow | New permission helper | `requestNotificationPermission()` from `src/platform/notifications.ts:15-21` | Same call signature as v1; D-18 mandates reuse |
| AC bring-up + Wake Lock + keepalive | Manual session | `SegmentEngine.start()` already calls `startAlarmSession()` (`SegmentEngine.ts:159`) | Phase 6 deliverable; engine handles it |
| Segment timing/scheduling | `setInterval` chain | `SegmentEngine` class (consume unchanged) | Phase 7 deliverable; absolute-epoch scheduling already done |
| Validation of segment configs | New validator | `validateSegmentConfig` from `SegmentState.ts:59-94` | Already shipped, never throws (SEG-04) |
| SVG arc geometry | New polar→cartesian + arc path math | Clone helpers from `ProgressRing.tsx:42-58` verbatim | Already battle-tested in v1; protected file forbids extraction |
| Mode-dispatch state machine | Custom Redux-like store | `useActiveAlarm` two-hook pattern | Engines already encapsulate state; UI just dispatches |

**Key insight:** Phase 7 already shipped a `SegmentHarness` that consumes the engine end-to-end. The Phase 8 `useSegmentAlarm` is essentially that harness, refactored from a single-component test rig into a reusable hook. Read `src/dev/SegmentHarness.tsx:25-78` as a working reference: it shows the `useRef<SegmentEngine | null>(null)` lazy-init, the `onSegmentChange` registration, and the `engine.stop()` cleanup-on-unmount pattern. Phase 8 generalises this into `useSegmentAlarm` and adds reactive surface fields.

---

## Common Pitfalls

### Pitfall 1: `onSegmentChange` registered in `useEffect` instead of body
**What goes wrong:** Stale closures — the callback references old `setState` instances and state lags by one render.
**Why it happens:** Idiomatic React would put callback registration in `useEffect`. But the engine's last-wins single-callback contract intentionally allows replacement on every render.
**How to avoid:** Mirror `useAlarm.ts:79-86` exactly. Register in the hook body. Each render replaces the callback with a fresh closure.
**Warning signs:** Tests that fire `onSegmentChange` show stale `currentSegment` values; pause-resume re-emits the event but UI doesn't update.

### Pitfall 2: Forgetting to poll `engine.getState()` in the callback
**What goes wrong:** `state` stays `'running'` even after the alarm segment fires; pulse never starts; pause button stays enabled during firing-alarm.
**Why it happens:** The `onSegmentChange` event payload (`{ kind, segmentIndex, totalSegments, segment }`) doesn't include the new engine state. State is set inside `handleSegmentFire` (`SegmentEngine.ts:212`) before any callback fires.
**How to avoid:** Always call `engine.getState()` inside the `onSegmentChange` callback to get the post-transition state. Pattern shown in §"Pattern 1".
**Warning signs:** `useSegmentAlarm.test.ts` reveals firing-alarm state never propagates to React state.

### Pitfall 3: Computing `totalEndsAt` from `Date.now() + sumOfRemainingDurations` after pause
**What goes wrong:** After resume, `totalEndsAt` skips the pause duration and the displayed total is wrong.
**Why it happens:** v1 `useAlarm.ts:108-114` snapshots remaining ms during pause and converts back to epoch on resume. Same pattern needed for both `segmentEndsAt` AND `totalEndsAt` in `useSegmentAlarm`.
**How to avoid:** On pause, snapshot `segmentEndsAt - now` and `totalEndsAt - now` as remaining ms; on resume, set `segmentEndsAt = now + storedRemaining` and `totalEndsAt = now + storedTotalRemaining`. The engine itself re-baselines `epochBaseline` on resume (`SegmentEngine.ts:313`), so the engine's timers fire correctly — but the hook's state needs the same correction independently.
**Warning signs:** Test "pause-resume integrity test extends total duration by pause length" (success criterion #4) fails.

### Pitfall 4: Pulse animation continues when paused
**What goes wrong:** During `firing-alarm` state with `isPaused = true`, the pulse animation keeps running visually.
**Why it happens:** `state === 'firing-alarm'` and `isPaused` are independent; the pulse-active className only checks state.
**How to avoid:** During pause, `engine.canPause()` returns false (per `SegmentEngine.ts:116-118`) so `pause()` is a silent no-op — the engine never actually pauses during firing-alarm. This means `isPaused` should always be `false` when `state === 'firing-alarm'`. Verified.
**Warning signs:** Any test that asserts `isPaused === true && state === 'firing-alarm'` simultaneously is testing impossible state.

### Pitfall 5: `SegmentHarness.tsx` removal misses the `import.meta.env.DEV` const
**What goes wrong:** `grep -r SegmentHarness src/` returns 0, but App.tsx still has the `showSegmentHarness` const and `?dev=segments` URL parsing.
**Why it happens:** Three lines need removing in App.tsx (`L4` import, `L9-11` const block, `L15-17` ternary branch), not just the import.
**How to avoid:** D-17 sanity check `grep -r "SegmentHarness" src/` returns 0 catches the import. But also `grep -r "showSegmentHarness\|dev=segments" src/` to catch the const + URL flag.
**Warning signs:** D-17 verification gate `npm run build` succeeds but `grep` finds residue.

### Pitfall 6: Always-both-mounted hook fires resources at mount
**What goes wrong:** `useSegmentAlarm()` mounted in `useActiveAlarm` accidentally requests notification permission, brings up the AudioContext, or acquires Wake Lock at app load.
**Why it happens:** If the hook does eager initialisation in `useEffect` instead of inside `start()`.
**How to avoid:** Verified safe by reading `SegmentEngine.ts:48-73` — the constructor just initialises private fields to default values. No async work. `startAlarmSession()` only fires inside `start()` (`L159`). The hook's `useRef` holds an idle engine; nothing runs until `start()` is called. `requestNotificationPermission` is gated inside `start()` per D-18.
**Warning signs:** Test `useActiveAlarm.test.ts: 'both engines mounted but only one runs'` — assert that `getAudioContext` is NOT called during render, only during `start()`.

### Pitfall 7: Pulse animation doesn't respect `prefers-reduced-motion`
**What goes wrong:** Users with motion sensitivity preferences see a pulsing arc anyway.
**Why it happens:** Default CSS keyframes ignore the media query unless explicitly wrapped.
**How to avoid:** Wrap the pulse rule in `@media (prefers-reduced-motion: no-preference)`. Best practice; not strictly required by D-04 but worth flagging.
**Warning signs:** Manual QA on macOS with "Reduce motion" enabled in System Settings → Accessibility.

### Pitfall 8: Index off-by-one in the `currentIndex` prop
**What goes wrong:** Past/current/future arc rendering is off by one segment; the alarm arc gets faded when it should be active during firing-alarm.
**Why it happens:** `engine.getCurrentSegment()` returns 0-based `index` (`SegmentEngine.ts:120-127`). After segment-end fires, `currentIdx` increments BEFORE the next segment's start event (`SegmentEngine.ts:206`). At firing-alarm time, segment 4 (alarm, 0-indexed) is "current".
**How to avoid:** When `state === 'firing-alarm'`, treat the current index as the alarm segment (whatever index has `endSound === 'alarm'`). The hook's `currentSegment` field already tracks this from the `'end'` event with `segment.endSound === 'alarm'`.
**Warning signs:** Visual ring during firing-alarm shows the alarm arc as faded ("past") instead of pinned-active ("current").

---

## Code Examples

### Example 1: Pulse keyframes (D-04, recommended approach)

**Bold recommendation: declare keyframes in `src/index.css` as a global `@keyframes` block + a single `.pulse-active` utility class.** Adds 6 lines to `index.css`; no Tailwind config; no inline `<style>` tags. Tagged `[VERIFIED: src/index.css contents read]`.

```css
/* src/index.css — append after @theme block */

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

**Why not Tailwind v4 arbitrary keyframes:** Tailwind v4 supports arbitrary values for `animate-[...]`, but defining custom keyframes still requires CSS. Inline `<style>` blocks in the SVG component work but couple style to component (worse for SSR-immune testing). Global CSS is the clearest signal.

**Why `prefers-reduced-motion: no-preference`:** Inverts the gate — pulse only animates when the user hasn't expressed a preference for reduced motion (Pitfall #7).

**Confidence: HIGH** — `src/index.css` has only 18 lines and uses Tailwind v4's `@theme` directive; appending `@keyframes` is straightforward.

### Example 2: Dashboard.tsx prop change (minimal diff)

Current (`Dashboard.tsx:19-23`):
```tsx
interface DashboardProps {
  alarm: UseAlarmReturn;
}

export default function Dashboard({ alarm }: DashboardProps) {
```

After:
```tsx
import type { ActiveAlarmState } from '../hooks/useActiveAlarm';
import { WAKE_EASY_CONFIG } from '../engine';

interface DashboardProps {
  activeAlarm: Extract<ActiveAlarmState, { mode: 'idle' }>;
}

export default function Dashboard({ activeAlarm }: DashboardProps) {
```

**Why `Extract<..., { mode: 'idle' }>`:** Dashboard is only rendered when `mode === 'idle'`, so the type narrows to the variant that has `start`. This is type-safe and self-documenting.

**Three card calls:**
```tsx
<PresetCard
  name="Quick Nap"
  description="5 min gentle, 5 min nudge, wake"
  onStart={() => activeAlarm.start({ kind: 'continuous', config: QUICK_NAP_CONFIG })}
/>
<PresetCard
  name="Focus"
  description="21 min gentle, 2 min nudge, wake"
  onStart={() => activeAlarm.start({ kind: 'continuous', config: FOCUS_CONFIG })}
/>
<PresetCard
  name="4 x 4"
  description="4 chimes over 16 min, then alarm"
  onStart={() => activeAlarm.start({ kind: 'segments', config: WAKE_EASY_CONFIG })}
/>
```

**Confidence: HIGH** — verified `PresetCard.tsx:10-14` accepts `name: string` (free-form) and `onStart: () => void`. The string `"4 x 4"` (with spaces) renders fine — no escaping needed because it's a JS string literal, not JSX text where `<` would be problematic.

### Example 3: App.tsx routing (target diff)

Current (`App.tsx:1-25`):
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

After:
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

**Diff:** -4 lines (`SegmentHarness` import, `showCountdown` const, `showSegmentHarness` const, the harness ternary branch); +2 lines (`SegmentCountdown` import, `useActiveAlarm` import); changed: `useAlarm()` → `useActiveAlarm()`, the JSX block. CONTEXT specifics show "Version: 1.1" → "Version: 1.2" (recommended bump for visible-change tracking).

**Confidence: HIGH** — verified line numbers against actual `App.tsx` contents.

### Example 4: SegmentHarness deletion verification one-liner

```bash
# Pre-build sanity (D-17)
grep -r "SegmentHarness" src/                          # MUST return 0 matches
grep -r "showSegmentHarness\|dev=segments" src/        # MUST return 0 matches
npm run build                                          # MUST exit 0
grep -r "SegmentHarness" dist/                         # MUST return 0 matches (regression check)
```

**Confidence: HIGH** — verified D-17 wording. Note: `?dev=segments` URL flag is NOT actually used in `dist/` even today (Phase 7 verification confirmed tree-shaking — see `07-VERIFICATION.md:95`), so this is a regression check, not a new constraint.

### Example 5: v1 byte-identical guardrail (template from 07-05-PLAN.md:537)

```bash
git diff --name-only main..HEAD -- \
  src/engine/AlarmEngine.ts \
  src/engine/AlarmState.ts \
  src/engine/AlarmSession.ts \
  src/engine/AudioContext.ts \
  src/engine/timer.ts \
  src/engine/SegmentEngine.ts \
  src/engine/SegmentState.ts \
  src/hooks/useAlarm.ts \
  src/components/Countdown.tsx \
  src/components/ProgressRing.tsx \
  src/engine/sounds/singingBowl.ts \
  src/engine/sounds/phase3Tone.ts \
  src/engine/sounds/keepalive.ts \
  src/engine/sounds/testSound.ts \
  src/engine/sounds/tickPulse.ts \
  src/engine/sounds/triangle.ts \
  src/engine/sounds/segmentSound.ts \
  src/platform/wakeLock.ts \
  src/platform/vibration.ts \
  src/platform/notifications.ts \
  | wc -l
# MUST equal 0
```

**Phase 8 protected paths (20 paths total):** Phase 7's 17 + the 3 Phase-7 deliverables (`SegmentEngine.ts`, `SegmentState.ts`, `triangle.ts`, `segmentSound.ts`) which Phase 8 consumes unchanged. Verified by reading `07-05-PLAN.md:537` and 08-CONTEXT `<canonical_refs>` "Files protected by SEG-05".

**Confidence: HIGH** — verbatim adaptation of the Phase 7 final-acceptance-criterion command.

### Example 6: Vitest test scaffolding for useSegmentAlarm

Phase 8 introduces the first **hook** tests (no `.tsx` test files exist yet — see Standard Stack note). The pattern below mirrors `SegmentEngine.test.ts:1-96` for engine mocking + adds React's `renderHook` from `@testing-library/react`.

```typescript
// src/hooks/__tests__/useSegmentAlarm.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';  // requires npm install
import { useSegmentAlarm } from '../useSegmentAlarm';
import { WAKE_EASY_CONFIG } from '../../engine/SegmentState';

// Mock the engine surface — same shape as SegmentHarness uses
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
      dismiss: vi.fn(),
      getState: vi.fn(() => stateValue),
      getCurrentSegment: vi.fn(() => null),
      isPaused: vi.fn(() => false),
      canPause: vi.fn(() => stateValue === 'running'),
      // expose for test fixtures
      __fireEvent: (e: any) => segmentChangeCb?.(e),
      __setState: (s: string) => { stateValue = s; },
    })),
  };
});

vi.mock('../../platform/notifications', () => ({
  requestNotificationPermission: vi.fn().mockResolvedValue(true),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSegmentAlarm', () => {
  it('returns idle state initially', () => {
    const { result } = renderHook(() => useSegmentAlarm());
    expect(result.current.state).toBe('idle');
    expect(result.current.isRunning).toBe(false);
    expect(result.current.currentSegment).toBeNull();
  });

  it('start() requests notification permission and brings up engine', async () => {
    const { requestNotificationPermission } = await import('../../platform/notifications');
    const { result } = renderHook(() => useSegmentAlarm());
    await act(async () => {
      await result.current.start(WAKE_EASY_CONFIG);
    });
    expect(requestNotificationPermission).toHaveBeenCalledTimes(1);
    expect(result.current.isRunning).toBe(true);
  });

  // ... pause/resume/stop assertions follow same pattern
});
```

**Critical idioms (HIGH confidence — copied from `SegmentEngine.test.ts:80-96`):**
- `vi.useFakeTimers()` in `beforeEach`, `vi.useRealTimers()` in `afterEach`
- `await Promise.resolve()` to flush microtask queue when start is async (`SegmentEngine.test.ts:84`)
- Mock the engine class entirely so the hook's `new SegmentEngine()` returns a stub; this avoids needing to mock `AudioContext`, `AlarmSession`, etc. transitively.

### Example 7: Vitest test scaffolding for useActiveAlarm

```typescript
// src/hooks/__tests__/useActiveAlarm.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActiveAlarm } from '../useActiveAlarm';

// Mock both underlying hooks
vi.mock('../useAlarm', () => ({
  useAlarm: vi.fn(() => ({ isRunning: false, /* ... full UseAlarmReturn shape ... */ })),
}));
vi.mock('../useSegmentAlarm', () => ({
  useSegmentAlarm: vi.fn(() => ({ isRunning: false, /* ... full UseSegmentAlarmReturn shape ... */ })),
}));

describe('useActiveAlarm', () => {
  it('returns mode=idle when neither alarm is running', () => {
    const { result } = renderHook(() => useActiveAlarm());
    expect(result.current.mode).toBe('idle');
    if (result.current.mode === 'idle') {
      expect(typeof result.current.start).toBe('function');
    }
  });

  it('discriminated-union narrowing — mode=continuous exposes alarm', () => {
    // mock useAlarm to return isRunning: true
    // assert result.current.mode === 'continuous' && result.current.alarm shape
  });

  // ... mode resets to null after stop
  // ... both engines mounted but only one runs (assert SegmentEngine constructor called once)
});
```

**Confidence: MEDIUM — would be HIGH after running.** The pattern is sound but `@testing-library/react` is not installed yet. Planner needs to confirm install before this test runs.

---

## State of the Art

| Area | Approach | Notes |
|------|----------|-------|
| React 19 hook patterns | `useRef` lazy-init for class-instance lifetime | Already used in `useAlarm.ts:66`, `SegmentHarness.tsx:26`. Idiomatic for v19. |
| Discriminated unions in React state | Narrow on tag field, no casts | TS 5.6+ narrows `if (x.mode === 'idle')` correctly. No experimental flags needed. |
| SVG arc rendering | Cumulative-angle paths | v1 `ProgressRing.tsx` already does this. `stroke-dasharray` is the alternative; v1 chose paths and it works. |
| CSS animations in React | Global `@keyframes` + class toggle | Tailwind v4 + plain CSS. No `framer-motion` for this app per CLAUDE.md decision. |
| React Testing Library + Vitest | `renderHook`, `act`, `vi.useFakeTimers()` | RTL 16+ supports React 19 (verified via WebSearch needed if planner wants HIGH confidence — tagged `[ASSUMED]`). |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@testing-library/react` 16+ supports React 19 with `renderHook`/`act` | Standard Stack, Code Examples | If wrong, planner must pick alternative test rig (`react-test-renderer` or hook-only tests). Easy to verify with `npm view @testing-library/react version` and changelog scan before install. |
| A2 | Tailwind v4 lets you put `@keyframes` directly in `src/index.css` after `@import "tailwindcss"` and `@theme` block | Code Example 1 | If wrong, keyframes might need declaration in a different scope or via Tailwind config — but CLAUDE.md confirms v4 uses native CSS variables and direct CSS, so this is very likely safe. |
| A3 | `GAP_RADIANS = 0.05` will look acceptable with 5 segments (= 0.25 rad total gap, ~14°) | Pattern 4 | If the alarm arc looks too small or the gap looks too big, the planner may need to reduce GAP to 0.02-0.03. Cosmetic, not architectural. |
| A4 | The `pendingMode` race window in `useActiveAlarm` (between user tap and `engine.start` resolving) needs covering | Pattern 2 | If wrong (i.e., the await is fast enough that no flicker), `pendingMode` is harmless extra state. If right, omitting it would cause a one-frame Dashboard flash on tap. |
| A5 | `npm view react@latest version` returns 19.x (matches package.json declaration) | Standard Stack | Low risk — package.json declares it; verifying against npm registry is a single command if planner wants it. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

---

## Open Questions (RESOLVED)

1. **Test framework: install `@testing-library/react` or test hooks via `react-test-renderer`?**
   - What we know: No DOM-test infra exists today. Vitest 3.1.2 is installed.
   - What's unclear: Whether the planner wants to budget the install (~2 deps) for this phase or defer.
   - Recommendation: Install `@testing-library/react` as part of an early Wave 0 task. The hooks tests (`useSegmentAlarm.test.ts`, `useActiveAlarm.test.ts`) are simpler with `renderHook`. Component tests (`SegmentCountdown.test.tsx`, `SegmentProgressRing.test.tsx`) need it anyway.
   - **RESOLVED:** Plan 01 Task 1 installs `@testing-library/react@^16.0.0` + `@testing-library/dom@^10.4.0` + `jsdom@^26.0.0` as dev dependencies and configures Vitest's jsdom environment in `vitest.config.ts`. Recommendation accepted in full.

2. **`@testing-library/jest-dom` matchers — needed?**
   - What we know: Vitest can do `expect(element).toBeInTheDocument()` with jest-dom matchers.
   - What's unclear: Whether the test list in D-20 needs DOM-assertion matchers or if pure structural assertions suffice.
   - Recommendation: Add jest-dom only if a test fails to express cleanly without it. Often pure `expect(container.querySelector('...')).toBeTruthy()` works.
   - **RESOLVED:** Plan 01 explicitly omits `@testing-library/jest-dom`. The existing Vitest `expect(...)` matchers (`toBeTruthy`, `toBe`, `toContain`, attribute reads via `.getAttribute()`, class-list reads via `.className.split(' ').includes(...)`) are sufficient for the assertion shapes Phase 8 needs (text content, attribute presence, class membership). Plan 01 Task 1 acceptance criteria require `@testing-library/jest-dom` to NOT appear in `package.json` devDependencies.

3. **Segment-index display position (Claude's Discretion in CONTEXT).**
   - What we know: D-05 says phase label = friendly description ("Gentle chime"). CONTEXT recommends combining: `"Segment {idx} of {total} — {soundLabel}"`.
   - What's unclear: User testing might prefer a separate badge or pill above the timer.
   - Recommendation: Ship the combined-label form per CONTEXT recommendation. Iterate if visual review during dev finds it cluttered.
   - **RESOLVED:** CONTEXT.md D-05 (LOCKED) + UI-SPEC.md "Center stack" section fix the format as `Segment {idx+1} of {total} — {soundLabel}` and place it in the slot that v1's `PHASE_LABELS` previously occupied (text-text-secondary text-sm mt-2, single-line, transition-opacity duration-500). No separate badge or pill — combined-label form ships as recommended. Plan 05 (SegmentCountdown) consumes this format verbatim from `SOUND_LABELS` mapping in §"Pattern 3".

4. **`pendingMode` race window in `useActiveAlarm`.**
   - What we know: `engine.start()` is async. There's a microtask gap between `setPendingMode('segments')` and `isRunning: true`.
   - What's unclear: Whether the gap is visually perceptible (likely sub-frame on desktop, possibly perceptible on slower mobile).
   - Recommendation: Include `pendingMode` in the implementation per Pattern 2 — cheap insurance against flicker; trivial to remove if metrics show no benefit.
   - **RESOLVED:** CONTEXT.md D-07 (LOCKED discriminated-union shape) + D-08 (both hooks mounted unconditionally) + Plan 04 implement Pattern 2's recommended form: `useActiveAlarm` mounts `useAlarm()` and `useSegmentAlarm()` unconditionally, holds an internal `pendingMode: 'continuous' | 'segments' | null` snapshot via `useState`, and derives `mode = continuous.isRunning ? 'continuous' : segments.isRunning ? 'segments' : pendingMode ?? 'idle'`. The discriminated union narrows correctly throughout the start window — Dashboard never re-renders during the async gap. Plan 04 Task 1 includes a dedicated `pendingMode` race-window unit test (`useActiveAlarm.test.ts` describe block "useActiveAlarm — pendingMode race-window (RESEARCH Pattern 2)").

5. **Pulse animation — keyframes in `index.css` vs scoped to component?**
   - What we know: Three options. Recommendation given (global CSS).
   - What's unclear: Style coupling preferences across the codebase. The repo currently has `src/index.css` doing only `@theme` setup; introducing animations there is a precedent.
   - Recommendation: Global `index.css` per Code Example 1. If the team wants strict component encapsulation later, refactor in Phase 9.
   - **RESOLVED:** Plan 01 Task 2 appends `@keyframes pulse-active-arc` (50% opacity 0.7, 0%/100% opacity 1.0) + `.pulse-active { animation: pulse-active-arc 1s ease-in-out infinite; }` rule to `src/index.css`, gated behind `@media (prefers-reduced-motion: no-preference)`. Single global source of truth — `src/index.css` is NOT in the SEG-05 protected list, so the append is safe. Plan 03 (SegmentProgressRing) and Plan 05 (SegmentCountdown) consume the `.pulse-active` class via `className` toggling on the active arc when `state === 'firing-alarm'`.

---

## Environment Availability

This phase is purely code/config — no new external tools needed. Skip-with-reason per template.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js + npm | All build/test | ✓ (Phase 7 verified) | 18+ implied | — |
| Vite 6 | Build/dev | ✓ | 6.0.5 (package.json) | — |
| Vitest 3 | Tests | ✓ | 3.1.2 (package.json) | — |
| React 19 | Components | ✓ | 19.0.0 (package.json) | — |
| Tailwind v4 | Styling | ✓ | 4.0.0 (package.json) | — |
| `@testing-library/react` | DOM tests + renderHook | ✗ | — | Hook-only tests via lighter rig (deferral viable) |

**Missing dependencies with no fallback:** None — phase can ship.

**Missing dependencies with fallback:** `@testing-library/react` — install for the cleanest test stories; alternative is to omit DOM tests and only test hooks via mock-engine setups (less coverage but viable).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.1.2 |
| Config file | None top-level (Vitest reads from `vite.config.ts` via `defineConfig`'s integration); `package.json` script `"test": "vitest"` |
| Quick run command | `npx vitest run <file>` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEG-06 | "4 x 4" card on Dashboard alongside Quick Nap and Focus | unit (component) | `npx vitest run src/components/__tests__/Dashboard.test.tsx` (assert PresetCard rendered with name="4 x 4") | ❌ Wave 0 (no Dashboard test exists; this phase adds the first) |
| SEG-06 | `useSegmentAlarm` exposes correct discriminated-union surface | unit (hook) | `npx vitest run src/hooks/__tests__/useSegmentAlarm.test.ts` | ❌ Wave 0 |
| SEG-06 | `useActiveAlarm` dispatches Quick Nap → useAlarm, Wake Easy → useSegmentAlarm | unit (hook) | `npx vitest run src/hooks/__tests__/useActiveAlarm.test.ts` | ❌ Wave 0 |
| SEG-06 | SegmentCountdown renders mm:ss + segment label + Pause/Stop, ticks, freezes on pause, count-up during firing-alarm | unit (component) | `npx vitest run src/components/__tests__/SegmentCountdown.test.tsx` | ❌ Wave 0 |
| SEG-06 | SegmentProgressRing renders N arcs, duration-proportional, color by endSound | unit (component) | `npx vitest run src/components/__tests__/SegmentProgressRing.test.tsx` | ❌ Wave 0 |
| SEG-06 | End-to-end: gentle chime at 4:00, 8:00, 12:00, 16:00 (±2s); alarm at 17:00 (±2s); pause-resume extends duration | manual (on-device) | `npm run dev` + manual stopwatch run with WAKE_EASY_CONFIG durations temporarily reduced for fast iteration | n/a (ROADMAP success criterion #4 is partially programmatic via SegmentEngine timer-mock tests, partially on-device) |
| SEG-05 | v1 byte-identical: Quick Nap + Focus continue working | regression | `npx vitest run src/engine/__tests__/AlarmEngine.test.ts` + git diff guardrail | ✅ exists |

### Sampling Rate
- **Per task commit:** `npx vitest run <new-test-file>`
- **Per wave merge:** `npx vitest run` (full suite — currently 320 tests; Phase 8 adds ~30-50 more)
- **Phase gate:** Full suite green + git diff guardrail returns 0 + `npm run build` succeeds

### Wave 0 Gaps
- [ ] `npm install --save-dev @testing-library/react jsdom` — required for `renderHook` and DOM tests; verify React 19 compatibility before install
- [ ] `vite.config.ts` may need `test: { environment: 'jsdom' }` block for component tests (currently no test config — verify Vitest defaults work without it)
- [ ] `src/components/__tests__/SegmentCountdown.test.tsx` — covers REQ SEG-06 (rendering + tick + pause/firing-alarm)
- [ ] `src/components/__tests__/SegmentProgressRing.test.tsx` — covers REQ SEG-06 (N-arc rendering + colors)
- [ ] `src/hooks/__tests__/useSegmentAlarm.test.ts` — covers REQ SEG-06 (hook surface)
- [ ] `src/hooks/__tests__/useActiveAlarm.test.ts` — covers REQ SEG-06 (mode dispatch)

---

## Security Domain

> Phase has minimal security surface — no new network, no new storage, no new permissions beyond reusing v1's `Notification.requestPermission()`. ASVS surface ≈ none.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (config validation) | `validateSegmentConfig` from Phase 7 — already shipped, never throws (SEG-04). `useSegmentAlarm.start` calls `engine.start()` which re-validates internally (`SegmentEngine.ts:148-151`). |
| V6 Cryptography | no | — |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stale closure in callback (incorrect setState) | Tampering (incorrect state) | Last-wins callback registered in body, not `useEffect` (Pattern 1) |
| Engine ref escape | Tampering (T-03-01 — direct engine manipulation by callers) | Hook returns only controlled methods, never `engineRef.current` (mirrors `useAlarm.ts:8-10`) |
| Resource leak on always-both-mounted | DoS (T-07-03 analog) | Both engines lazy-init only; `start()` is the gate for AC + Wake Lock + notifications. Verified safe by reading `SegmentEngine.ts:48-73`. |
| `?dev=segments` URL flag re-enabled | Information disclosure (T-07-04 — leak engine state via dev UI) | Phase 7 mitigated via `import.meta.env.DEV` static replacement. Phase 8 removes the flag entirely → no surface. |
| Notification permission request on page load | Anti-pattern + DoS (T-02-08 — repeated prompts) | `requestNotificationPermission()` only called from `useSegmentAlarm.start()` (D-18), which itself is only called from a user gesture (PresetCard tap). |

---

## Sources

### Primary (HIGH confidence)
- `src/engine/SegmentEngine.ts:48-412` — class API surface, state machine, callback contract
- `src/engine/SegmentState.ts:14-112` — types + validateSegmentConfig + WAKE_EASY_CONFIG
- `src/engine/index.ts:32-41` — Phase 7 barrel additions (D-22 verified — no Phase 8 changes needed)
- `src/hooks/useAlarm.ts:1-137` — analog hook to mirror line-by-line
- `src/components/Countdown.tsx:1-154` — analog component to mirror layout/classes
- `src/components/ProgressRing.tsx:1-204` — SVG geometry helpers + arc-rendering pattern
- `src/components/PresetCard.tsx:1-27` — card prop signature (free-form `name` confirmed)
- `src/components/Dashboard.tsx:1-56` — current 2-card layout + prop signature
- `src/App.tsx:1-25` — current routing + harness wiring
- `src/dev/SegmentHarness.tsx:1-164` — reference for engine-in-react integration
- `src/utils/formatTime.ts:8-13` — formatMmSs reuse confirmed
- `src/platform/notifications.ts:15-21` — requestNotificationPermission shape
- `src/index.css:1-18` — Tailwind v4 setup + warm earth palette tokens (all D-02 colors verified present)
- `src/engine/__tests__/SegmentEngine.test.ts:1-426` — Vitest mock patterns to mirror in new hook tests
- `package.json` — dependency versions
- `.planning/phases/07-segment-engine-triangle-sound/07-05-PLAN.md:537` — byte-identical guardrail one-liner template
- `.planning/phases/07-segment-engine-triangle-sound/07-VERIFICATION.md` — Phase 7 deliverables verified live
- `.planning/REQUIREMENTS.md` — SEG-05 protected paths list
- `.planning/phases/03-react-ui/03-CONTEXT.md` — UI design conventions (D-06 ring, D-07 timer, D-08 phase labels, D-09 controls)

### Secondary (MEDIUM confidence)
- CLAUDE.md technology stack table — declared versions; confirms decisions (no Tone.js, no Framer Motion, raw Web Audio)

### Tertiary (LOW confidence — flagged for validation)
- `@testing-library/react` v16 React 19 compatibility — assumed; planner should verify via `npm view @testing-library/react peerDependencies` before install. Tagged A1.

---

## Project Constraints (from CLAUDE.md)

- **Tech stack:** React + Vite + Tailwind CSS — non-negotiable
- **PWA:** vite-plugin-pwa for SW + manifest — Phase 8 doesn't touch this
- **Audio:** No copyrighted files; synthesised or royalty-free only — Phase 8 doesn't touch audio
- **Browser APIs degrade gracefully:** Wake Lock, Vibration, Notification — feature-detect; reuse Phase 6 platform helpers
- **No persistence:** Settings ephemeral per session — Phase 8 honors this (no localStorage)
- **Tailwind v4:** Use `@import "tailwindcss"` + `@tailwindcss/vite` (NOT the old PostCSS path). Verified via `vite.config.ts:3`.
- **TypeScript strict:** Strong typing for engine + state — discriminated union narrowing relies on this
- **Conventions:** Not yet established (CLAUDE.md placeholder); follow the patterns set by `useAlarm.ts` + `Countdown.tsx`
- **GSD workflow:** This is a planning research run — no Edit/Write outside the sanctioned RESEARCH.md output

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version declared in `package.json`, verified by direct read
- Architecture (hook patterns, ring geometry, discriminated unions): HIGH — every pattern grounded in line-anchored references to existing v1/v7 code
- Pitfalls: HIGH — most are direct extrapolations from `SegmentEngine.ts` source ordering and v1 hook idioms
- Test infrastructure: MEDIUM — hook-test patterns are clear, but `@testing-library/react` install is still a Wave 0 to-do
- Pulse CSS implementation: HIGH — `index.css` is small enough that the global keyframes path is unambiguous

**Research date:** 2026-05-10
**Valid until:** ~2026-06-10 (30 days; stable codebase, no fast-moving deps)

## RESEARCH COMPLETE
