# Phase 2: Background Reliability - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the alarm fire reliably when the screen is off or the app is backgrounded. Includes: preset definitions (Quick Nap and Focus), Phase 2 vibration with iOS audio fallback, system notifications for backgrounded alarms, Wake Lock for screen-on during timers, and iOS standalone detection with "Add to Home Screen" prompt.

</domain>

<decisions>
## Implementation Decisions

### Vibration Pattern (Android)
- **D-01:** Phase 2 uses a pulsing rhythm vibration pattern: 300ms vibrate, 200ms pause, repeating continuously until Phase 3 triggers or user dismisses.
- **D-02:** Pattern is gentle and persistent — matches the app's escalation philosophy of nudging before forcing.

### iOS Audio Fallback
- **D-03:** On iOS (where `navigator.vibrate()` is not supported), Phase 2 plays a subtle ticking pulse instead of vibrating. Synthesized as a filtered noise burst (~50ms) through a bandpass filter, repeating on the same 300ms-on/200ms-pause rhythm.
- **D-04:** The ticking pulse gradually increases in volume over the Phase 2 duration — starts very soft, ramps up to improve wakeability before Phase 3 kicks in.
- **D-05:** The tick sound must be clearly distinct from both the singing bowl (Phase 1) and the rising sine swell (Phase 3).

### Presets
- **D-06:** Quick Nap and Focus presets are defined exactly per requirements ALM-02 and ALM-03. These are just `AlarmConfig` objects with the specified durations — no ambiguity, implementation is mechanical.

### Claude's Discretion
- **Notification content and behavior:** What the system notification says when the alarm fires while backgrounded, whether tapping it dismisses the alarm or brings the app forward, and whether to show one notification or per-phase notifications. Recommendation: single notification on Phase 1 trigger with "Alarm ringing" message; tapping foregrounds the app (dismiss via in-app button only for safety).
- **iOS "Add to Home Screen" prompt:** When and how to show the prompt for non-installed iOS Safari users (PLT-04). Recommendation: non-blocking inline banner on the dashboard screen that appears once per session, dismissible, explaining that installing improves alarm reliability. Do not block alarm start.
- **Wake Lock loss handling:** What happens when Wake Lock is released (tab switch, low battery, OS override). Recommendation: silently re-acquire on `visibilitychange` when document becomes visible again. No user-facing warning — the keepalive oscillator and notification strategy cover the backgrounded case. Log Wake Lock state changes for debugging.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — ALM-02, ALM-03, ALM-05, PLT-02, PLT-03, PLT-04 define the acceptance criteria for this phase

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, background reliability strategy, iOS limitations
- `CLAUDE.md` — Tech stack details, Wake Lock API notes, Vibration API iOS non-support, Notification API guidance, background keepalive strategy

### Phase 1 Context
- `.planning/phases/01-audio-engine-and-timer/01-CONTEXT.md` — Prior decisions on sound design, escalation transitions, and engine API shape

### Existing Engine Code
- `src/engine/AlarmEngine.ts` — State machine with Phase 2 transition stub (vibration hooks in here)
- `src/engine/AlarmState.ts` — `AlarmConfig` interface and `DEFAULT_CONFIG` (presets extend this)
- `src/engine/sounds/keepalive.ts` — Silent keepalive oscillator (Phase 2 extends with visibilitychange re-acquisition)
- `src/engine/AudioContext.ts` — Shared AudioContext singleton (Wake Lock logic sits alongside)
- `src/engine/index.ts` — Barrel export (new Phase 2 exports added here)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AlarmEngine.onPhaseChange()` callback — Phase 2 vibration/tick hooks into this listener
- `AlarmConfig` interface — Preset definitions (ALM-02, ALM-03) are just config objects with the right durations
- `startKeepalive()`/`stopKeepalive()` — Silent oscillator already running; extend with visibilitychange re-acquisition
- `getAudioContext()` — Singleton AudioContext; Wake Lock acquisition can pair with this

### Established Patterns
- Factory pattern for OscillatorNode (cannot restart after `.stop()`) — tick pulse oscillator must follow same pattern
- Sound modules export pure functions taking AudioContext as first arg (see `singingBowl.ts`, `phase3Tone.ts`)
- Timer uses `scheduleAt()` with wall-clock fire times, not interval counting

### Integration Points
- `AlarmEngine.start()` Phase 2 callback currently does nothing — vibration/tick logic plugs in here
- Presets are new `AlarmConfig` objects exported alongside `DEFAULT_CONFIG`
- Wake Lock acquired in `start()`, released in `cleanup()`
- Notification permission requested from UI (Phase 3), but notification firing logic lives in Phase 2
- iOS standalone detection is a platform utility, separate from the engine

</code_context>

<specifics>
## Specific Ideas

- Tick pulse: filtered noise burst through bandpass filter, ~50ms duration, repeating on 300ms/200ms rhythm
- Tick volume ramp: starts near-silent, increases linearly over Phase 2 duration
- Vibration pattern uses `navigator.vibrate([300, 200])` in a loop (or single long pattern array)
- Feature detection: `'vibrate' in navigator` to choose vibration vs. tick fallback

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-background-reliability*
*Context gathered: 2026-04-14*
