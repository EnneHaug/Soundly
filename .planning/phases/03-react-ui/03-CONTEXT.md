# Phase 3: React UI - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the complete React UI for Soundly: a dashboard screen with preset cards and test sound, a countdown screen with a circular phase-progress ring, and stop/pause/resume controls. The UI consumes the existing AlarmEngine and platform utilities from Phases 1-2. No routing library — state-driven screen swaps.

</domain>

<decisions>
## Implementation Decisions

### Screen Flow & Navigation
- **D-01:** State-driven rendering — no React Router. App renders dashboard or countdown based on AlarmEngine phase state (`idle` = dashboard, anything else = countdown). Starting an alarm transitions to countdown; dismissing snaps back to dashboard immediately.
- **D-02:** No transition or "done" screen on dismiss. Dismiss = dashboard, instant.

### Visual Identity & Palette
- **D-03:** Light and airy mood — this is a daytime app for morning naps and midday meditation, not a bedside-at-night app.
- **D-04:** Warm earth tone palette: sage greens, warm sand, terracotta accents on off-white backgrounds. Key colors from approved demo: background `#f4f1eb`, primary text `#3d4a38`, secondary text `#8a7e6b`, accent/CTA `#c27c5a` (terracotta), border `#d4cbbe`, heading accent `#5c6b56` (sage).
- **D-05:** Update PWA manifest `background_color` and `theme_color` from `#1a1a2e` (dark navy) to match the light earth palette.

### Countdown Screen
- **D-06:** Circular progress ring with color-coded phase segments — sage for Phase 1 (gentle sound), warm sand for Phase 2 (nudge/vibration), terracotta for Phase 3 (wake/volume ramp). Depleted segments fade out or gray.
- **D-07:** Center of ring shows `mm:ss` remaining in the current phase (not total time). Large, legible type.
- **D-08:** Phase label displayed near the time (e.g., "Gentle Sound", "Nudge", "Wake").
- **D-09:** Stop and Pause buttons below the ring. Stop dismisses the alarm and returns to dashboard. Pause halts the timer; button changes to Resume.
- **D-10:** Phase transitions are subtle — ring segment changes, phase label updates, center time resets to new phase duration. No extra animation or pulse.

### Preset Cards
- **D-11:** Each card shows preset name + phase breakdown text (e.g., "5 min gentle, 5 min nudge, wake"). No icons in v1.
- **D-12:** Tapping a card starts the alarm immediately — no confirmation dialog. If tapped by accident, Stop is always available.
- **D-13:** Test Sound button appears below the preset cards on the dashboard. Plays the singing bowl at mid-range volume (Phase 1 D-07) to verify audio works before starting a timer.

### Claude's Discretion
- Exact Tailwind utility classes and component decomposition
- Typography scale — large countdown digits must be legible at arm's length on mobile
- iOS "Add to Home Screen" inline banner placement and dismissal behavior (Phase 2 discretion: non-blocking, once per session)
- Notification permission request timing — must be from a user gesture (e.g., on Start tap), not on page load
- Animation library choice — start with CSS transitions, add Framer Motion only if insufficient
- App shell structure (providers, layout wrappers)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — UX-01 through UX-04 define the acceptance criteria for this phase

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, zen aesthetic description, tech stack
- `CLAUDE.md` — Tech stack details (React 19, Tailwind v4, Vite 6), animation guidance (CSS first, Framer Motion if needed)

### Prior Phase Context
- `.planning/phases/01-audio-engine-and-timer/01-CONTEXT.md` — Sound design decisions, test sound behavior (D-07), engine API shape
- `.planning/phases/02-background-reliability/02-CONTEXT.md` — Vibration/tick decisions, iOS standalone detection, notification behavior

### Existing Engine Code
- `src/engine/AlarmEngine.ts` — State machine: `start()`, `stop()`, `dismiss()`, `onPhaseChange()`, `getPhase()`
- `src/engine/AlarmState.ts` — `AlarmConfig`, `AlarmPhase`, `QUICK_NAP_CONFIG`, `FOCUS_CONFIG`, `DEFAULT_CONFIG`
- `src/engine/index.ts` — Barrel exports for all engine and platform utilities
- `src/engine/sounds/testSound.ts` — `playTestSound()` for the Test Sound button

### Platform Utilities
- `src/platform/notifications.ts` — `requestNotificationPermission()`, `showAlarmNotification()`, `clearAlarmNotification()`
- `src/platform/standalone.ts` — `isPwaInstalled()`, `isIosSafariNonInstalled()` for iOS install banner
- `src/platform/wakeLock.ts` — Wake Lock acquisition (called by AlarmEngine, not directly by UI)

### Palette Reference
- `.planning/phases/03-react-ui/palette-demo.html` — Approved warm earth tone palette (Option 1). Key hex values in D-04.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AlarmEngine` class with `onPhaseChange()` callback — React hook will wrap this
- `playTestSound()` — ready to wire to Test Sound button
- `requestNotificationPermission()` — call from Start button user gesture
- `isIosSafariNonInstalled()` — drives iOS install banner visibility
- `QUICK_NAP_CONFIG` / `FOCUS_CONFIG` — preset definitions with exact timing values

### Established Patterns
- Sound modules are pure functions taking AudioContext — UI doesn't manage audio directly
- AlarmEngine manages its own cleanup on `stop()`/`dismiss()` — UI just calls the method
- Platform utilities use feature detection internally — UI doesn't need to check API support

### Integration Points
- No React code exists yet — `index.html`, `main.tsx`, `App.tsx` all need to be created
- `src/index.css` with `@import "tailwindcss"` needs to be created for Tailwind v4
- AlarmEngine is a class instance — a custom hook (e.g., `useAlarm`) will manage the singleton and expose reactive state to components

</code_context>

<specifics>
## Specific Ideas

- Circular progress ring: SVG-based with three arc segments, each colored per phase (sage/sand/terracotta). Active segment animates depletion. Depleted segments fade to gray.
- Countdown digits: `font-variant-numeric: tabular-nums` for stable width during countdown
- Card phase breakdown format: "5 min gentle, 5 min nudge, wake" — human-readable, not technical
- The ring segments should proportionally represent the actual phase durations (Quick Nap phases are equal; Focus has a much longer Phase 1)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-react-ui*
*Context gathered: 2026-04-14*
