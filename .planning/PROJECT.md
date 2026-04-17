# Soundly Gentle Alarm

## What This Is

A Progressive Web App that wakes or alerts users gently through a multi-phase approach — starting with soft sounds, escalating through vibration, and only reaching full volume as a last resort. Designed for people who hate jarring alarms and want to wake calmly without disturbing others nearby.

## Core Value

The alarm must actually wake the user — gently first, reliably always. If the gentle phases fail, escalation guarantees the user doesn't oversleep.

## Requirements

### Validated

- [x] Synthesized audio via Web Audio API (singing bowl harmonics, sine wave swells) — Validated in Phase 1: Audio Engine and Timer
- [x] Multi-phase alarm with three escalation stages (soft sound → vibration → volume ramp) — State machine validated in Phase 1
- [x] Phase 3 volume ramp from 0% to 100% over configurable duration — Validated in Phase 1
- [x] Test Sound button to verify audio works at comfortable mid-range volume — Validated in Phase 1 (plays singing bowl per D-07)
- [x] Two built-in presets: Quick Nap (5 min) and Focus (21 min) — Validated in Phase 2: QUICK_NAP_CONFIG and FOCUS_CONFIG with exact timing
- [x] Wake Lock API to prevent screen sleep during active timer — Validated in Phase 2: acquireWakeLock/releaseWakeLock with visibility re-acquisition
- [x] Vibration API for Phase 2 tactile alert — Validated in Phase 2: Android [300,200] pattern loop with iOS tick pulse fallback
- [x] System notifications when alarm triggers (backgrounded or screen off) — Validated in Phase 2: ServiceWorkerRegistration.showNotification with tag dedup
- [x] PWA installable on home screens with offline support (vite-plugin-pwa) — Validated in Phase 2: injectManifest config, custom SW, placeholder icons

### Active

- [ ] Customizable alarm: user can adjust delays between phases and ramp-up duration per session
- [ ] Background reliability: silent audio loop + notification-triggered audio for screen-off scenarios
- [x] Calm countdown screen with large Stop/Dismiss and Pause buttons — Validated in Phase 3: Countdown component with ProgressRing, mm:ss timer, Pause/Resume/Stop controls
- [x] Dashboard with presets as large, tappable cards — Validated in Phase 3: PresetCard buttons with Quick Nap and Focus, immediate alarm start on tap
- [ ] System-following dark/light mode
- [x] Gentle overall UX: smooth transitions, soft animations, generous spacing, zen aesthetic — Validated in Phase 3: Tailwind v4 warm earth theme, generous spacing, calm typography

### Out of Scope

- Persistent storage of custom presets — settings are ephemeral, configured per session
- User accounts or cloud sync
- Multiple simultaneous alarms
- Social/sharing features
- Native app (iOS/Android) — PWA only

## Context

- **Stack:** React + Vite + Tailwind CSS
- **Audio approach:** Web Audio API for synthesized tones. Sounds will be iterated on collaboratively — starting with programmatic singing bowl, chime, and sine swell synthesis, with the option to swap in royalty-free recordings later
- **Background reliability:** Combination of Wake Lock API, silent audio loop keepalive, and notification-triggered audio playback to approximate native alarm behavior in browsers
- **Target devices:** Primarily mobile (phones/tablets), but should work on desktop browsers too
- **Aesthetic:** "Zen" — minimalist, calm, unhurried. The app itself should feel like a deep breath. Soft color palette, smooth transitions, generous whitespace

## Constraints

- **Tech stack**: React + Vite + Tailwind CSS — specified by user
- **PWA**: Must use vite-plugin-pwa for service worker and manifest
- **Audio**: No copyrighted audio files — synthesized or royalty-free only
- **Browser APIs**: Wake Lock, Vibration, Notification APIs are not universally supported — must degrade gracefully
- **No persistence**: Settings are not stored between sessions

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web Audio API for sound synthesis | Avoids copyright issues, no file downloads, works offline natively | Validated Phase 1 |
| No persistent storage | User sets up alarm each session; keeps app simple and stateless | — Pending |
| System dark/light toggle | Follows OS preference for seamless device integration | — Pending |
| Full background reliability | Silent audio loop + notification audio to survive screen-off | Validated Phase 2 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-17 after Phase 3 completion*
