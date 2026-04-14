# Project Research Summary

**Project:** Soundly — Gentle Alarm PWA
**Domain:** Progressive Web App, alarm/timer, audio synthesis
**Researched:** 2026-04-14
**Confidence:** MEDIUM-HIGH

---

## Executive Summary

Soundly is a gentle alarm PWA built around a three-phase escalation model: soft synthesized audio (singing bowl / chimes), tactile vibration, and a gradual volume ramp to full. The product is a countdown timer with a layered wake-up sequence — not a clock-based scheduler.

The recommended stack is React 19 + Vite 6 + TypeScript 5 + Tailwind CSS v4 (`@tailwindcss/vite` plugin) + `vite-plugin-pwa`. State management uses Zustand — a small store that the AlarmEngine singleton writes to and React components read from, keeping the render cycle fully decoupled from the timing loop. Audio synthesis uses raw Web Audio API; no Tone.js or Howler.js. The entire stack is offline-capable by design.

The dominant risk is background audio reliability — a fundamental browser constraint. iOS Safari suspends AudioContext on screen lock regardless of keepalive techniques. Chrome on Android is significantly more reliable with the combined keepalive strategy. The app must communicate this honestly to users.

---

## Recommended Stack

| Technology | Version | Rationale |
|-----------|---------|-----------|
| React | 19 | User-specified; hooks model maps onto alarm state machine |
| Vite | 6 | User-specified; fast dev server, native ESM |
| TypeScript | 5 | Type safety for complex audio/timer state |
| Tailwind CSS | v4 | `@tailwindcss/vite` plugin (not PostCSS); CSS-first config |
| vite-plugin-pwa | latest | `injectManifest` mode for custom SW logic |
| Zustand | latest | Bridges non-React AlarmEngine to React components |
| Web Audio API | native | Synthesis without libraries; Tone.js rejected (200KB+, wrong abstraction) |

---

## Table Stakes Features

- Set a timer duration — 1-2 taps from home screen
- Quick Nap and Focus presets — reduce decision fatigue
- Three-phase escalation: soft audio → vibration + audio → volume ramp to 100%
- Synthesized singing bowl / chime audio — offline, no copyright
- Wake Lock + silent audio loop + Service Worker notification — combined keepalive
- Stop button with large tap target — hittable while groggy
- Test Sound button — eliminates user doubt; trivial to build, high trust value
- Clear countdown display — large type, visible from arm's length
- Dark mode following `prefers-color-scheme`
- PWA install + offline support

---

## Critical Pitfalls

1. **AudioContext outside user gesture** — starts `suspended`; audio silently fails at alarm time
2. **iOS Safari suspends AudioContext on screen lock** — no full workaround in a PWA
3. **Chrome throttles background timers** — one tick/minute after 5 min hidden; use wall-clock arithmetic
4. **Wake Lock released on page hide** — must re-acquire on `visibilitychange`
5. **OscillatorNode can't restart after `.stop()`** — use factory pattern, create new nodes each time
6. **Notification permission denied if prompted too early** — request inline with Start Alarm
7. **Vibration API absent on iOS** — Phase 2 must fall back to audio escalation
8. **Volume ramp via setInterval stalls in background** — use `linearRampToValueAtTime()` on audio thread

---

## Architecture: Three-Layer Separation

1. **AlarmEngine** (singleton TypeScript module) — phase state machine, wall-clock scheduling, hardware coordination
2. **AudioEngine** (singleton TypeScript module) — AudioContext lifecycle, oscillator graph, silent keepalive, gain ramp
3. **Hardware Managers** — WakeLockManager, VibrationEngine, NotificationManager (thin API wrappers with feature detection)
4. **Zustand AlarmStore** — `status`, `phase`, `secondsRemaining`; engine writes, React reads
5. **React UI** — display and input only; passes `SessionConfig` to engine on submit
6. **Service Worker** — offline caching + notification click handler; no alarm logic

---

## Suggested Build Order (4 Phases)

### Phase 1: Audio Engine and Timer Foundation
Build and verify audio scheduling and wall-clock timer arithmetic in isolation. All alarm behavior depends on these. Includes singing bowl synthesis, silent keepalive loop, test sound, master gain ramp, and AlarmEngine state machine.

### Phase 2: Background Reliability Stack
Wire all three keepalive layers (silent loop, Wake Lock, SW notifications) and test on real devices. Includes VibrationEngine with iOS fallback, NotificationManager with contextual permission flow, and iOS standalone detection.

### Phase 3: React UI and Session Flow
Wire the verified engine to display components and controls. HomeScreen with PresetCards, CountdownScreen with large Stop/Pause buttons, dark/light theme, zen aesthetic.

### Phase 4: PWA Shell and Offline Support
Wrap the working app in PWA configuration. `vite-plugin-pwa` in `injectManifest` mode, web manifest, icons, Workbox caching, update banner.

---

## Watch Out For

- **iOS is structurally hostile** — no Vibration API, AudioContext suspension on screen lock, PWA notifications only in installed apps
- **Sound synthesis quality** — naive oscillators sound cheaper than a system beep; budget time for harmonic richness
- **Background reliability varies by device** — the combined keepalive strategy is best-effort, not guaranteed
- **Tailwind v4 migration** — uses `@tailwindcss/vite`, not PostCSS; any v3 tutorial is wrong

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Core stack | HIGH | Versions verified via official sources |
| Web Audio API | HIGH | MDN-verified; stable APIs |
| Background reliability | MEDIUM | Community techniques; effectiveness varies by OS |
| iOS behavior | MEDIUM | Known WebKit limitations; current Safari 18.4 needs device verification |
| Feature landscape | MEDIUM | Training data analysis; stable category |

---

## Open Questions

1. Does iOS Safari 18.4+ support Wake Lock reliably? Verify on real device.
2. Silent audio loop effectiveness on current Chrome Android — verify empirically.
3. Singing bowl synthesis quality — requires iterative tuning during Phase 1.
4. Should Phase 2 on iOS use a different audio cue instead of vibration?
5. Snooze intentionally omitted — document this as a design decision in UI.

---
*Research completed: 2026-04-14*
*Ready for roadmap: yes*
