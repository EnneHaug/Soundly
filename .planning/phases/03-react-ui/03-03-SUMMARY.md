---
phase: 03-react-ui
plan: "03"
subsystem: ui-countdown
tags: [react, svg, countdown, progress-ring, alarm-ux]
dependency_graph:
  requires: [03-01, 03-02]
  provides: [countdown-screen, progress-ring, format-time]
  affects: [App.tsx, Countdown.tsx, ProgressRing.tsx]
tech_stack:
  added: []
  patterns:
    - SVG arc math with polarToCartesian and clockwise angle convention
    - Absolute-overlay pattern for SVG center content (avoids foreignObject)
    - setInterval at 250ms driven by phaseEndsAt epoch for countdown tick
    - Interval cleanup on unmount and on pause (no leak, T-03-08)
    - fontVariantNumeric tabular-nums for stable digit width
key_files:
  created:
    - src/utils/formatTime.ts
    - src/components/ProgressRing.tsx
    - src/components/Countdown.tsx
  modified:
    - src/App.tsx
decisions:
  - "Arc segments driven by proportional phase durations (not equal thirds)"
  - "Children centered via absolute overlay div rather than SVG foreignObject"
  - "Timer tick at 250ms (not 1000ms) for sub-second visual responsiveness"
  - "phaseProgress direction: 1 - remaining/total so ring depletes as time passes"
metrics:
  duration_minutes: 12
  completed_date: "2026-04-17"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 1
---

# Phase 3 Plan 03: Countdown Screen Summary

**One-liner:** SVG three-segment progress ring with proportional phase arcs, 250ms countdown tick driven by phaseEndsAt, and Pause/Resume/Stop controls wired to useAlarm.

## What Was Built

### Task 1 — formatMmSs utility and ProgressRing SVG component

**`src/utils/formatTime.ts`**
- `formatMmSs(ms: number): string` — converts milliseconds to zero-padded `mm:ss`
- Clamps to `00:00` for negative or zero inputs

**`src/components/ProgressRing.tsx`**
- Three-segment SVG arc ring (200x200 viewBox, radius 80, stroke 14)
- Segments proportional to `phase1DurationMs`, `phase2DurationMs`, `phase2to3GapMs`
- Small 0.05 radian gap between segments
- `polarToCartesian(angleCw)` helper: converts clockwise-from-top radians to SVG x,y
- `arcPath(startAngle, endAngle)` helper: builds SVG arc `d` attribute string
- Visual state per segment:
  - Past (depleted): faded gray at 0.6 opacity over faded track
  - Current: faded track + colored arc showing remaining portion
  - Future: full phase color at full opacity
- Phase colors: sage (phase 1), sand (phase 2), accent/terracotta (phase 3)
- Children rendered via absolute-overlay `div` centered on the ring

### Task 2 — Countdown screen and App.tsx wiring

**`src/components/Countdown.tsx`**
- `PHASE_LABELS` map: `idle → Starting...`, `phase1 → Gentle Sound`, `phase2 → Nudge`, `phase3 → Wake`
- `phaseToIndex()` maps `AlarmPhase` to 0-based segment index
- `getPhaseDuration()` returns the total ms for the current phase from config
- `displayRemainingMs` state ticked every 250ms via `setInterval` driven by `alarm.phaseEndsAt`
- Interval cleared in `useEffect` cleanup and guarded by `isPaused` check (no leak)
- `phaseProgress` computed as `1 - remaining / total`, clamped 0–1
- Large countdown in `var(--font-size-countdown)` with `fontVariantNumeric: tabular-nums`
- Phase label with `transition-opacity duration-500` for crossfade on phase change (D-10)
- Pause/Resume toggle + Stop button with `bg-accent` styling

**`src/App.tsx`**
- Replaced placeholder countdown div with `<Countdown alarm={alarm} />`
- Added `import Countdown from './components/Countdown'`
- `showCountdown` condition unchanged: `alarm.isRunning || alarm.phase !== 'idle'`

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Proportional arc segments | Segments reflect real phase durations — longer phases occupy more ring, giving honest visual feedback of remaining time |
| Absolute overlay for center content | `<foreignObject>` has cross-browser inconsistencies; absolute div over SVG is simpler and reliable |
| 250ms tick interval | Sub-second update frequency prevents visible "jumps" in the large countdown display |
| phaseProgress depletes from ring start | Start of arc = beginning of phase; as time passes, filled arc shrinks from right, matching natural expectation |
| No animation on phase transitions | Plan specified: phase transitions update ring/label/time without extra animation — simpler, avoids motion jarring |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|-----------|
| T-03-08 | `setInterval` guarded by `isPaused` check; cleared in `useEffect` cleanup function — no leak on unmount or pause |
| T-03-09 | SVG paths built from computed angles only; no user-supplied strings injected into SVG attributes |
| T-03-10 | Countdown displays only computed time and hardcoded labels — no sensitive data |

## Self-Check

Verified files exist:
- `src/utils/formatTime.ts` — created
- `src/components/ProgressRing.tsx` — created
- `src/components/Countdown.tsx` — created
- `src/App.tsx` — modified

Verified commits exist:
- `54f8f8e` — feat(03-03): add formatMmSs utility and ProgressRing SVG component
- `2f3436f` — feat(03-03): create Countdown screen and wire into App.tsx

Build: `npx vite build` exits 0 (verified twice during execution).

## Self-Check: PASSED
