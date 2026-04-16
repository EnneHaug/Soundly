# Phase 3: React UI - Research

**Researched:** 2026-04-14
**Domain:** React 19 + Tailwind CSS v4 + SVG progress ring + AlarmEngine integration
**Confidence:** HIGH

## Summary

Phase 3 builds the entire React layer on top of the existing AlarmEngine and platform utilities.
No React code exists yet — `index.html`, `main.tsx`, `App.tsx`, all hooks, and all components must
be created from scratch. The tech stack (React 19, Vite 6, Tailwind v4, TypeScript 5) is already
installed and the Vite config is already wired.

The most significant technical finding is that `AlarmEngine` has **no pause/resume API**. The
engine's timers use absolute wall-clock epoch targets (via `scheduleAt`). To satisfy UX-03, a
`pause()`/`resume()` method pair must be added to `AlarmEngine` before the UI can wire up the Pause
button. This is the only engine change required by this phase — everything else is new UI code.

The second key finding is the SVG circular progress ring. Three-segment rings cannot use the simpler
`strokeDashoffset` technique (which works for single-segment rings only). They require polar-to-
Cartesian coordinate math and SVG `<path>` arc commands — doable in ~40 lines of TypeScript with
no library.

**Primary recommendation:** Implement `AlarmEngine.pause()`/`resume()` first (engine change), then
wire the `useAlarm` hook, then build Dashboard and Countdown screens, then apply the Tailwind v4
theme. CSS transitions are sufficient for D-10 (subtle phase transitions) — skip Framer Motion.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Screen Flow & Navigation**
- D-01: State-driven rendering — no React Router. App renders dashboard or countdown based on AlarmEngine phase state (`idle` = dashboard, anything else = countdown). Starting an alarm transitions to countdown; dismissing snaps back to dashboard immediately.
- D-02: No transition or "done" screen on dismiss. Dismiss = dashboard, instant.

**Visual Identity & Palette**
- D-03: Light and airy mood — this is a daytime app for morning naps and midday meditation, not a bedside-at-night app.
- D-04: Warm earth tone palette: sage greens, warm sand, terracotta accents on off-white backgrounds. Key colors from approved demo: background `#f4f1eb`, primary text `#3d4a38`, secondary text `#8a7e6b`, accent/CTA `#c27c5a` (terracotta), border `#d4cbbe`, heading accent `#5c6b56` (sage).
- D-05: Update PWA manifest `background_color` and `theme_color` from `#1a1a2e` (dark navy) to match the light earth palette.

**Countdown Screen**
- D-06: Circular progress ring with color-coded phase segments — sage for Phase 1 (gentle sound), warm sand for Phase 2 (nudge/vibration), terracotta for Phase 3 (wake/volume ramp). Depleted segments fade out or gray.
- D-07: Center of ring shows `mm:ss` remaining in the current phase (not total time). Large, legible type.
- D-08: Phase label displayed near the time (e.g., "Gentle Sound", "Nudge", "Wake").
- D-09: Stop and Pause buttons below the ring. Stop dismisses the alarm and returns to dashboard. Pause halts the timer; button changes to Resume.
- D-10: Phase transitions are subtle — ring segment changes, phase label updates, center time resets to new phase duration. No extra animation or pulse.

**Preset Cards**
- D-11: Each card shows preset name + phase breakdown text (e.g., "5 min gentle, 5 min nudge, wake"). No icons in v1.
- D-12: Tapping a card starts the alarm immediately — no confirmation dialog. If tapped by accident, Stop is always available.
- D-13: Test Sound button appears below the preset cards on the dashboard. Plays the singing bowl at mid-range volume (Phase 1 D-07) to verify audio works before starting a timer.

### Claude's Discretion
- Exact Tailwind utility classes and component decomposition
- Typography scale — large countdown digits must be legible at arm's length on mobile
- iOS "Add to Home Screen" inline banner placement and dismissal behavior (Phase 2 discretion: non-blocking, once per session)
- Notification permission request timing — must be from a user gesture (e.g., on Start tap), not on page load
- Animation library choice — start with CSS transitions, add Framer Motion only if insufficient
- App shell structure (providers, layout wrappers)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-01 | Dashboard with preset cards as large, tappable surfaces | PresetCard component, Tailwind v4 `@theme` palette, pointer-events tap target sizing |
| UX-02 | Countdown screen with large Stop/Dismiss button and phase indicator | SVG 3-segment arc ring, `useAlarm` hook, `formatMmSs` helper, phase label map |
| UX-03 | Pause and resume functionality during active timer | AlarmEngine.pause()/resume() addition (currently missing), UI state for `isPaused` |
| UX-04 | Gentle, zen aesthetic — smooth transitions, generous spacing, minimalist design | Tailwind v4 `@theme` with warm earth palette, CSS `transition` classes, `font-variant-numeric: tabular-nums` |
</phase_requirements>

---

## Standard Stack

### Core (already installed — verified in package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.0.0 | UI rendering | Specified by user; already installed [VERIFIED: package.json] |
| react-dom | ^19.0.0 | DOM rendering entry point | Companion to React [VERIFIED: package.json] |
| TypeScript | ~5.6.2 | Type safety | Already installed [VERIFIED: package.json] |
| Tailwind CSS | ^4.0.0 | Utility styling | Already installed via `@tailwindcss/vite` [VERIFIED: package.json] |
| vite-plugin-pwa | ^0.21.1 | PWA manifest + SW | Already installed [VERIFIED: package.json] |

### No Additional Libraries Needed
The phase is implementable with zero new npm installs:
- SVG ring: hand-written TypeScript math (~40 lines), no library [VERIFIED: research into `react-circular-progressbar` — unnecessary for 3-segment custom ring]
- Screen transitions: CSS `transition` classes sufficient for D-10 (subtle)
- State management: React built-ins (`useReducer`, `useRef`, `useEffect`, `useState`)
- Animation: CSS transitions only (Framer Motion deferred per CLAUDE.md)

**Installation:** No new packages required.

**Version verification:** [VERIFIED: package.json in repo root]

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── main.tsx                # React root mount
├── App.tsx                 # Root component: AlarmProvider + screen router
├── index.css               # @import "tailwindcss" + @theme palette
├── hooks/
│   └── useAlarm.ts         # Wraps AlarmEngine singleton, exposes reactive state
├── components/
│   ├── Dashboard.tsx        # Preset cards + Test Sound button
│   ├── PresetCard.tsx       # Single tappable card
│   ├── Countdown.tsx        # Ring + time + phase label + buttons
│   ├── ProgressRing.tsx     # SVG 3-segment arc ring
│   ├── IosInstallBanner.tsx # Non-blocking "Add to Home Screen" prompt
│   └── TestSoundButton.tsx  # Calls playTestSound() + requestNotificationPermission()
└── engine/                  # (existing — no changes except AlarmEngine.pause/resume)
    └── AlarmEngine.ts
```

### Pattern 1: useAlarm Hook — Class Instance Wrapped in React State

`AlarmEngine` is a class (not React-native). The `useAlarm` hook holds the engine in a `useRef`
(stable across renders), registers the `onPhaseChange` callback on mount, and surfaces a reactive
`phase` state value via `useState`.

```typescript
// Source: React docs — useRef for mutable class instances
// https://react.dev/learn/reusing-logic-with-custom-hooks

import { useRef, useState, useCallback } from 'react';
import { AlarmEngine, AlarmPhase, AlarmConfig } from '../engine';

export interface AlarmState {
  phase: AlarmPhase;
  isPaused: boolean;
  isRunning: boolean; // true while timers are active (even if phase === 'idle' during countdown)
}

export function useAlarm() {
  const engineRef = useRef<AlarmEngine | null>(null);

  if (!engineRef.current) {
    engineRef.current = new AlarmEngine();
  }

  const [alarmState, setAlarmState] = useState<AlarmState>({
    phase: 'idle',
    isPaused: false,
    isRunning: false,
  });

  // Register callback once — uses closure over setAlarmState
  // Must be registered after engine exists (inside hook body, not effect)
  engineRef.current.onPhaseChange((newPhase) => {
    setAlarmState((prev) => ({
      ...prev,
      phase: newPhase,
      isRunning: newPhase !== 'idle' && newPhase !== 'dismissed',
    }));
  });

  const start = useCallback(async (config: AlarmConfig) => {
    await engineRef.current!.start(config);
    setAlarmState({ phase: 'idle', isPaused: false, isRunning: true });
  }, []);

  const stop = useCallback(() => {
    engineRef.current!.stop();
    setAlarmState({ phase: 'idle', isPaused: false, isRunning: false });
  }, []);

  const pause = useCallback(() => {
    engineRef.current!.pause();
    setAlarmState((prev) => ({ ...prev, isPaused: true }));
  }, []);

  const resume = useCallback(() => {
    engineRef.current!.resume();
    setAlarmState((prev) => ({ ...prev, isPaused: false }));
  }, []);

  return { alarmState, start, stop, pause, resume };
}
```

**Key insight:** The engine singleton lives in `useRef`, not `useState`, so it never causes a re-
render by itself. Only `setAlarmState` drives re-renders. `onPhaseChange` is re-registered on
every render, but since it is the last-registration-wins API, this is safe and avoids stale
closure bugs.

### Pattern 2: State-Driven Screen Switch in App.tsx

```typescript
// Source: D-01 (locked decision) + React conditional rendering docs
// https://react.dev/learn/conditional-rendering

export default function App() {
  const alarm = useAlarm();
  const showCountdown = alarm.alarmState.isRunning || alarm.alarmState.phase !== 'idle';

  return (
    <div className="min-h-dvh bg-[#f4f1eb] flex flex-col">
      {showCountdown
        ? <Countdown alarm={alarm} />
        : <Dashboard alarm={alarm} />
      }
    </div>
  );
}
```

`dismissed` phase → `showCountdown = false` → renders Dashboard immediately (D-02: no done screen).

### Pattern 3: Tailwind v4 @theme Palette Definition

Tailwind CSS v4 uses CSS-in-CSS configuration via the `@theme` directive, not `tailwind.config.js`.
Custom colors defined in `@theme` auto-generate utility classes (`bg-*`, `text-*`, `border-*`).

```css
/* src/index.css */
/* Source: https://tailwindcss.com/docs/theme [VERIFIED: WebFetch of official docs] */

@import "tailwindcss";

@theme {
  /* Warm earth palette (D-04) */
  --color-bg:         #f4f1eb;
  --color-text-primary:   #3d4a38;
  --color-text-secondary: #8a7e6b;
  --color-accent:     #c27c5a;   /* terracotta — CTA / Stop button / Phase 3 ring */
  --color-border:     #d4cbbe;
  --color-sage:       #5c6b56;   /* Phase 1 ring segment */
  --color-sand:       #c8b89a;   /* Phase 2 ring segment */

  /* Typography */
  --font-size-countdown: 5rem;   /* ~80px — arm's-length legible on mobile */

  /* Numeric tabular spacing for countdown digits */
  --font-variant-numeric: tabular-nums;
}
```

Utility class usage: `bg-bg`, `text-text-primary`, `bg-sage`, `border-border`, etc.

For SVG strokes that must match phase colors, use CSS variables directly:
`stroke="var(--color-sage)"` — Tailwind cannot inject `stroke` attribute values.

### Pattern 4: SVG Three-Segment Progress Ring

The ring shows three arcs proportional to phase durations. Use SVG `<path>` arc commands, not
`<circle strokeDashoffset>` (which only supports a single continuous stroke).

Math: polar-to-Cartesian conversion, then SVG `A` arc command.

```typescript
// Source: https://www.hendrik-erz.de/post/guide-programmatically-draw-segmented-circles-or-ring-indicators-with-svg
// [VERIFIED: WebFetch confirmed math]

const TWO_PI = 2 * Math.PI;
const CENTER = 100; // SVG viewBox is 200x200
const RADIUS = 80;
const STROKE_WIDTH = 14;
const GAP_RADIANS = 0.05; // small gap between segments for visual separation

/** Convert angle (radians, clockwise from top) to SVG x,y coordinates */
function polarToCartesian(angleCw: number): { x: number; y: number } {
  // SVG y-axis is inverted; subtract PI/2 to start from top
  const theta = angleCw - Math.PI / 2;
  return {
    x: CENTER + RADIUS * Math.cos(theta),
    y: CENTER + RADIUS * Math.sin(theta),
  };
}

/** Build an SVG arc path between two angles (clockwise from top) */
function arcPath(startAngle: number, endAngle: number): string {
  const start = polarToCartesian(startAngle);
  const end   = polarToCartesian(endAngle);
  const sweep = endAngle - startAngle;
  const largeArc = sweep > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

interface Segment {
  startAngle: number;  // radians, clockwise from top
  endAngle: number;
  color: string;       // CSS var or hex
  progress: number;    // 0–1, how much of this segment is filled
}

/** Compute three segment angle boundaries from phase durations */
function buildSegments(config: AlarmConfig, currentPhase: AlarmPhase, phaseRemainingSec: number): Segment[] {
  const total = config.phase1DurationMs + config.phase2DurationMs + config.phase2to3GapMs;
  const s1 = (config.phase1DurationMs / total) * (TWO_PI - 3 * GAP_RADIANS);
  const s2 = (config.phase2DurationMs / total) * (TWO_PI - 3 * GAP_RADIANS);
  const s3 = (config.phase2to3GapMs / total) * (TWO_PI - 3 * GAP_RADIANS);

  // ... compute start/end angles, determine fill progress per active phase
  // Full implementation in ProgressRing.tsx
}
```

**Depleted segment rendering:** Render each segment twice — once as a background track (gray/faded),
once as the active fill arc clipped to `progress * segmentLength`. CSS `opacity` on the track
provides the "faded" look for past phases.

### Pattern 5: AlarmEngine Pause/Resume Addition (Engine Work Required)

`AlarmEngine` currently has no `pause()`/`resume()` API. [VERIFIED: grep of AlarmEngine.ts — no
`pause` method exists]. This must be added before the UI Pause button can be wired.

**Mechanism:** Wall-clock timers (`scheduleAt`) store absolute epoch timestamps. On pause, capture
remaining milliseconds per pending phase fire; cancel existing timers; stop audio loops. On resume,
re-register `scheduleAt` calls with `Date.now() + capturedRemainingMs`.

```typescript
// State to add to AlarmEngine class:
private _paused: boolean = false;
private pauseSnapshot: { phase1Remaining: number; phase2Remaining: number; phase3Remaining: number } | null = null;
private phase1FireAt: number = 0; // store absolute timestamps set in start()
private phase2FireAt: number = 0;
private phase3FireAt: number = 0;

pause(): void {
  if (!this._running || this._paused) return;
  this._paused = true;

  // Capture remaining time for each future phase
  const now = Date.now();
  this.pauseSnapshot = {
    phase1Remaining: Math.max(0, this.phase1FireAt - now),
    phase2Remaining: Math.max(0, this.phase2FireAt - now),
    phase3Remaining: Math.max(0, this.phase3FireAt - now),
  };

  // Cancel pending timers
  this.timers.forEach((t) => t.cancel());
  this.timers = [];

  // Pause audio loops (stop tick loop, stop phase3 swell loop)
  // Keepalive continues to run (keeps AudioContext alive while paused)
}

resume(): void {
  if (!this._running || !this._paused || !this.pauseSnapshot) return;
  this._paused = false;

  const now = Date.now();
  const snap = this.pauseSnapshot;
  this.pauseSnapshot = null;

  // Re-register timers from remaining time
  if (snap.phase1Remaining > 0) {
    this.phase1FireAt = now + snap.phase1Remaining;
    this.timers.push(scheduleAt(this.phase1FireAt, () => { /* phase1 callback */ }));
  }
  // ... same for phase2, phase3
  // Resume audio loops for the current active phase
}

isPaused(): boolean { return this._paused; }
```

**Important:** `start()` must be updated to store `this.phase1FireAt`, `this.phase2FireAt`,
`this.phase3FireAt` as instance fields so `pause()` can read them. Currently they are local
variables in `start()`.

### Anti-Patterns to Avoid

- **Storing AlarmEngine in useState:** Causes double-mount/re-initialization. Use `useRef`.
- **Calling `new AlarmEngine()` on every render:** The `if (!engineRef.current)` guard prevents this.
- **Calling `onPhaseChange` inside `useEffect`:** The callback is a closure — if registered in a
  `useEffect`, it captures a stale `setAlarmState` from the first render. Register it directly in
  the hook body (re-registers each render, last-wins is safe).
- **Using `strokeDashoffset` for multi-segment ring:** Only works for a single-segment ring.
  Three-segment ring requires SVG `<path>` with arc commands.
- **Setting `background_color`/`theme_color` in CSS only:** These are in `vite.config.ts`
  inside `VitePWA({manifest: {...}})` — must be updated there, not just in CSS (D-05).
- **Requesting notification permission on page load:** Must be triggered from a user gesture
  (Start card tap). Call `requestNotificationPermission()` inside the `start` handler.
- **`font-size` in `rem` without `min()` clamping:** Large countdown digits on desktop can
  overflow. Use `clamp()` or Tailwind responsive classes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Circular progress ring | Custom canvas-based ring | SVG `<path>` arc math | SVG is declarative, scalable, no canvas lifecycle; ~40 lines is all that's needed |
| Timer tick in React | `setInterval` in component body | `useRef` + `setInterval` in `useEffect` | Prevents interval duplication on re-renders |
| Singleton engine in React | Module-level `let engine = new AlarmEngine()` | `useRef` inside hook | Module-level singletons are hard to reset in tests; `useRef` scopes to component tree |
| Pause timer math | Re-implementing wall-clock logic | Extend `AlarmEngine.pause()`/`resume()` | Engine owns timer state; UI should not reach into engine internals |
| Theme colors in JS | `colors` object passed as props | Tailwind v4 `@theme` CSS variables | CSS variables are available everywhere including SVG `stroke` attributes and inline styles |

**Key insight:** The engine encapsulates all timer and audio complexity. The UI layer should only
call the engine's public API and react to its state — never replicate timer logic in React state.

---

## Common Pitfalls

### Pitfall 1: AlarmEngine Has No pause()/resume() — Must Be Added
**What goes wrong:** If the Pause button calls a method that doesn't exist, it throws at runtime.
**Why it happens:** Phase 2 implemented vibration + tick escalation but did not spec pause/resume.
**How to avoid:** Add `pause()` and `resume()` to `AlarmEngine` as Wave 0 work (before UI wiring).
**Warning signs:** `engine.pause is not a function` runtime error.

### Pitfall 2: AudioContext Requires User Gesture
**What goes wrong:** `AlarmEngine.start()` calls `getAudioContext()` internally. If called outside
a user gesture (e.g., from `useEffect` on mount), the AudioContext is suspended and no sound plays.
**Why it happens:** Browser autoplay policy blocks audio without user interaction.
**How to avoid:** Call `alarm.start(config)` only inside a click/tap handler — never from effects.
**Warning signs:** Audio context `state: 'suspended'` logged to console; no sound on start.

### Pitfall 3: `isRunning` vs `phase === 'idle'` During Countdown
**What goes wrong:** During the countdown period before Phase 1 fires, `getPhase()` returns `'idle'`.
If the screen switch is based only on `phase !== 'idle'`, the UI snaps back to Dashboard while
the alarm is counting down.
**Why it happens:** AlarmEngine keeps `phase = 'idle'` during countdown (see AlarmEngine.ts comments).
**How to avoid:** Track `isRunning` separately in `useAlarm` — set to `true` on `start()`, `false`
on `stop()`/`dismiss()`. The screen switch uses `isRunning || phase !== 'idle'`.
**Warning signs:** UI flashes back to Dashboard after tapping a preset card.

### Pitfall 4: Stale Countdown Display During Pause
**What goes wrong:** The countdown clock shows stale time when paused (still ticking in display
even though engine is paused).
**Why it happens:** The countdown display is driven by a `setInterval` in the component, not by
the engine — so it keeps running even when the engine is paused.
**How to avoid:** Stop the display countdown `setInterval` when `isPaused === true`. Resume it
from the `phaseRemaining` value when `isPaused === false`.
**Warning signs:** Timer digits continue counting down after Pause is tapped.

### Pitfall 5: SVG `stroke` Attribute vs Tailwind Classes
**What goes wrong:** `className="stroke-sage"` has no effect on `<path>` elements inside an SVG.
**Why it happens:** Tailwind's `stroke-*` utilities set `stroke` as a CSS property, but SVG
presentation attributes have higher specificity than CSS in some browsers.
**How to avoid:** Use `stroke="var(--color-sage)"` directly on `<path>` elements. Or use the Tailwind
`stroke-*` class plus `!important` — but the inline `var()` approach is simpler and more reliable.
**Warning signs:** Ring segments appear in default black regardless of className.

### Pitfall 6: PWA Manifest Colors Not Updated
**What goes wrong:** The app splash screen and address bar still show dark navy after Phase 3.
**Why it happens:** `background_color` and `theme_color` are in `vite.config.ts`, not in CSS.
**How to avoid:** Update `vite.config.ts` `VitePWA({ manifest: { background_color, theme_color } })`
to `#f4f1eb` and `#5c6b56` (off-white background, sage theme) per D-05.
**Warning signs:** Browser toolbar stays dark-colored when app is installed as PWA.

---

## Code Examples

### mm:ss Formatter (no library needed)
```typescript
// Source: [ASSUMED] — standard date math, no external dependency needed
export function formatMmSs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
```

### Countdown Display Tick (useEffect + setInterval)
```typescript
// Source: [ASSUMED] — standard React pattern for interval-based countdown
useEffect(() => {
  if (isPaused || !isRunning) return;

  const id = setInterval(() => {
    const now = Date.now();
    setDisplayRemainingMs(phaseEndsAt - now);
  }, 250); // 250ms matches timer.ts check interval

  return () => clearInterval(id);
}, [isPaused, isRunning, phaseEndsAt]);
```

The hook must expose `phaseEndsAt` (absolute epoch ms when current phase ends) so the display
can compute remaining time. `AlarmEngine` currently does not expose this — the `useAlarm` hook
must track it from when phase transitions fire (captured in the `onPhaseChange` callback).

### Tailwind v4 CSS Entry Point
```css
/* src/index.css */
/* Source: https://tailwindcss.com/docs/theme [VERIFIED] */

@import "tailwindcss";

@theme {
  --color-bg:               #f4f1eb;
  --color-text-primary:     #3d4a38;
  --color-text-secondary:   #8a7e6b;
  --color-accent:           #c27c5a;
  --color-border:           #d4cbbe;
  --color-sage:             #5c6b56;
  --color-sand:             #c8b89a;
}
```

### React Entry Point (main.tsx)
```typescript
// Source: React 19 docs — createRoot API
// https://react.dev/reference/react-dom/client/createRoot

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

### index.html (Vite entry)
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Soundly</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind config in `tailwind.config.js` | `@theme` directive in CSS | v4.0 (Jan 2025) | No JS config file; custom colors via CSS variables |
| Tailwind via PostCSS plugin | `@tailwindcss/vite` Vite plugin | v4.0 (Jan 2025) | Already installed; no PostCSS config needed |
| `ReactDOM.render()` | `createRoot().render()` | React 18 | Already standard; `createRoot` is the only API in React 19 |
| Single-segment `strokeDashoffset` ring | Multi-segment SVG `<path>` arc | N/A (problem-specific) | Required for 3-phase color-coded ring |

**Deprecated/outdated:**
- `tailwind.config.js`: Not needed in v4. Do not create one. [VERIFIED: official Tailwind v4 docs]
- `ReactDOM.render()`: Removed in React 19. Use `createRoot`. [ASSUMED — consistent with React 18+ pattern]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `dismissed` phase returned by `AlarmEngine` causes `showCountdown = false` → Dashboard displays | Architecture Pattern 2 | If engine never reaches `dismissed` before returning to `idle`, the guard condition needs adjusting |
| A2 | Re-registering `onPhaseChange` on every render is safe (last-registration-wins) | Pattern 1 | If AlarmEngine internally queues multiple callbacks, stale callbacks could pile up — verify engine holds only one callback |
| A3 | `formatMmSs` with 250ms tick is sufficient for UX-04 (smooth display) | Code Examples | At 250ms, display lags up to 0.25s — acceptable for a relaxation alarm; if jarring, drop to 100ms |
| A4 | `ReactDOM.render()` is removed in React 19 (using `createRoot` is correct) | Code Examples | Standard React 19 fact; very high confidence |
| A5 | CSS transitions (`transition-opacity`, `transition-colors`) are sufficient for D-10 | Architecture | If phase transitions look abrupt on device, Framer Motion will be needed (add in repair) |

---

## Open Questions

1. **Where does `phaseEndsAt` come from?**
   - What we know: `AlarmEngine` fires `onPhaseChange(newPhase)` but does not expose the absolute
     epoch when the phase ends.
   - What's unclear: The `useAlarm` hook needs this to drive the countdown display. The hook could
     compute it from `Date.now()` at the moment `onPhaseChange` fires — but that's imprecise
     because the callback fires after the phase transition, not at the exact scheduled moment.
   - Recommendation: In `useAlarm`, when `onPhaseChange` fires with `phase1`, capture
     `phaseEndsAt = Date.now() + config.phase2DurationMs` (from the config the hook already holds).
     Track which config was started so the hook can compute phase end times.

2. **Should `pause()` / `resume()` go in AlarmEngine or be pure UI state?**
   - What we know: The engine's timers are absolute epoch targets. Pausing audio loops requires
     engine knowledge. Re-registering timers after resume also requires engine internals.
   - What's unclear: Could pause be implemented purely in the UI by recording `Date.now()` at pause
     and starting a fresh engine on resume?
   - Recommendation: Add `pause()`/`resume()` to `AlarmEngine`. A fresh-engine approach would lose
     the current phase (Phase 2 vibration would restart as Phase 1), which is wrong behavior.

3. **What is the `isRunning` source of truth?**
   - What we know: `AlarmEngine._running` is private. `getPhase()` returns `'idle'` during countdown.
   - Recommendation: Track `isRunning` in the `useAlarm` hook — set to `true` on `start()` call,
     `false` on `stop()`/`dismiss()`. Do not expose `_running` from the engine.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 3 is pure code/config changes. All external dependencies (Node, npm,
Vite, TypeScript) were already verified functional in Phases 1-2. No new external tools required.

---

## Security Domain

Security enforcement is enabled (not explicitly disabled in config.json).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth in this app |
| V3 Session Management | No | No sessions; settings are ephemeral |
| V4 Access Control | No | Single-user app |
| V5 Input Validation | Minimal | No user text input in v1 UI (presets are fixed configs) |
| V6 Cryptography | No | No crypto operations |

### Known Threat Patterns for React PWA UI

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via `dangerouslySetInnerHTML` | Tampering | Never used — all content is static JSX |
| Notification API misuse (spam) | Elevation | `requestNotificationPermission()` only called from user gesture; single permission request |
| iOS UA spoofing affecting install banner | Spoofing | Only affects cosmetic banner visibility (T-02-07 already noted — no security impact) |

**Overall security posture:** Low attack surface. The UI renders only static preset text and
computed time values. No user-supplied strings are rendered as HTML. No auth, no network requests
from the UI layer.

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: package.json] — React 19.0, Tailwind 4.0, vite-plugin-pwa 0.21.1 installed
- [VERIFIED: AlarmEngine.ts grep] — No `pause`/`resume` method exists; must be added
- [VERIFIED: AlarmState.ts read] — `AlarmPhase` type, `QUICK_NAP_CONFIG`, `FOCUS_CONFIG` exact values
- [VERIFIED: vite.config.ts read] — VitePWA injectManifest mode, dark colors in manifest (to update)
- [VERIFIED: tailwindcss.com/docs/theme — WebFetch] — `@theme` directive syntax, CSS variable generation
- [CITED: https://www.hendrik-erz.de/post/guide-programmatically-draw-segmented-circles-or-ring-indicators-with-svg] — SVG arc path math for multi-segment rings

### Secondary (MEDIUM confidence)
- [CITED: https://blog.logrocket.com/build-svg-circular-progress-component-react-hooks/] — SVG ring patterns in React
- [CITED: https://react.dev/learn/reusing-logic-with-custom-hooks] — useRef for class instance wrapping
- WebSearch: React class-instance-in-hook pattern — consistent across multiple sources

### Tertiary (LOW confidence)
- WebSearch: CSS transitions sufficient for subtle phase changes (D-10) — not benchmarked on device

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json
- Architecture patterns: HIGH — derived from reading actual engine code
- Pause/resume gap: HIGH — confirmed by grep; no method exists
- SVG ring math: MEDIUM-HIGH — confirmed via official SVG spec + authoritative guide
- CSS transitions sufficiency: LOW — screen-device validation not done; discretion area

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable stack — React 19, Tailwind 4, vite-plugin-pwa 0.21)
