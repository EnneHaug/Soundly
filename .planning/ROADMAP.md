# Roadmap: Soundly Gentle Alarm

## Overview

Soundly is built in four phases that follow the natural dependency chain of an alarm PWA. The audio engine and timer must work correctly before background reliability can be wired in, the UI is useless without both, and PWA packaging is the final wrapper around a fully working app. Each phase delivers a coherent, independently verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Audio Engine and Timer** - Synthesized alarm sounds, wall-clock timer, and the AlarmEngine state machine
- [ ] **Phase 2: Background Reliability** - Silent keepalive loop, Wake Lock, notifications, vibration, and iOS handling
- [ ] **Phase 3: React UI** - Dashboard, countdown screen, stop/pause controls, and zen aesthetic
- [ ] **Phase 4: PWA Shell** - Installable PWA with offline support and service worker

## Phase Details

### Phase 1: Audio Engine and Timer
**Goal**: The alarm engine can progress through all three escalation phases — with correct audio synthesis and drift-free timing — independent of any UI
**Depends on**: Nothing (first phase)
**Requirements**: AUD-01, AUD-02, AUD-03, AUD-04, ALM-01, ALM-04
**Success Criteria** (what must be TRUE):
  1. A synthesized singing bowl sound plays at Phase 1 trigger with perceptible harmonic quality
  2. Phase 3 volume ramps from silence to full volume over the configured duration without abrupt jumps
  3. The Test Sound button plays Phase 3 audio at comfortable mid-range volume on demand
  4. The timer stays accurate over long durations without drift — a 21-minute timer completes within 2 seconds of wall time
  5. The three-phase escalation sequence (soft sound → vibration cue → volume ramp) fires in correct order
**Plans:** 2 plans
Plans:
- [x] 01-01-PLAN.md — Audio synthesis layer (singing bowl, Phase 3 tone, keepalive, test sound)
- [x] 01-02-PLAN.md — AlarmEngine state machine and drift-free wall-clock timer

### Phase 2: Background Reliability
**Goal**: The alarm fires reliably when the screen is off or the app is backgrounded, and preset timings are correctly defined
**Depends on**: Phase 1
**Requirements**: ALM-02, ALM-03, ALM-05, PLT-02, PLT-03, PLT-04
**Success Criteria** (what must be TRUE):
  1. Quick Nap and Focus presets launch with correct phase timing sequences
  2. Phase 2 triggers tactile vibration on Android; iOS falls back to an audio cue
  3. A system notification appears when the alarm triggers while the browser is backgrounded
  4. The screen stays on during an active timer (Wake Lock); it re-acquires if the tab regains visibility
  5. Non-installed iOS users see an "Add to Home Screen" prompt before starting an alarm
**Plans**: TBD

### Phase 3: React UI
**Goal**: Users can set, monitor, and dismiss an alarm through a calm, legible interface
**Depends on**: Phase 2
**Requirements**: UX-01, UX-02, UX-03, UX-04
**Success Criteria** (what must be TRUE):
  1. The home screen presents Quick Nap and Focus as large, tappable cards that launch the alarm in two taps
  2. The countdown screen shows the current phase, remaining time in large type, and reachable Stop and Pause buttons
  3. Tapping Pause halts the timer; tapping Resume continues from the same point
  4. The overall aesthetic reads as calm and minimal — generous spacing, soft palette, smooth transitions throughout
**Plans**: TBD
**UI hint**: yes

### Phase 4: PWA Shell
**Goal**: The app is installable from a browser and works entirely offline
**Depends on**: Phase 3
**Requirements**: PLT-01
**Success Criteria** (what must be TRUE):
  1. The app can be installed to a phone home screen from Chrome and Safari
  2. The alarm runs fully after airplane mode is enabled — no network requests fail
  3. The service worker notification click handler routes the user back to the countdown screen
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Audio Engine and Timer | 0/2 | Planned | - |
| 2. Background Reliability | 0/? | Not started | - |
| 3. React UI | 0/? | Not started | - |
| 4. PWA Shell | 0/? | Not started | - |
