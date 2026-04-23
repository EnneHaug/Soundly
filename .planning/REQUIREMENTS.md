# Requirements: Soundly Gentle Alarm

**Defined:** 2026-04-14
**Core Value:** The alarm must actually wake the user — gently first, reliably always.

## v1 Requirements

### Audio

- [ ] **AUD-01**: Phase 1 plays a synthesized singing bowl sound via Web Audio API
- [ ] **AUD-02**: Phase 3 ramps volume from 0% to 100% over configurable duration (default 1 min) using `linearRampToValueAtTime`
- [x] **AUD-03**: Test Sound button plays Phase 3 sound at mid-range volume to verify audio works
- [ ] **AUD-04**: Silent audio keepalive loop runs during active timer to prevent OS from killing the app

### Alarm

- [ ] **ALM-01**: Three-phase escalation: soft sound → vibration → volume ramp
- [ ] **ALM-02**: Quick Nap preset: 5 min → Phase 1 → 5 min → Phase 2 → 10s → Phase 3
- [ ] **ALM-03**: Focus preset: 21 min → Phase 1 → 2 min → Phase 2 → 10s → Phase 3
- [ ] **ALM-04**: Wall-clock timer with drift correction (no setInterval tick counting)
- [ ] **ALM-05**: Phase 2 uses Vibration API with audio fallback on iOS (no vibration support)

### Platform

- [ ] **PLT-01**: PWA installable on home screens with offline support via vite-plugin-pwa
- [ ] **PLT-02**: Wake Lock API keeps screen on during active timer (re-acquires on visibility change)
- [ ] **PLT-03**: System notification fires when alarm triggers while backgrounded
- [x] **PLT-04**: iOS standalone detection with "Add to Home Screen" prompt for non-installed users

### UX

- [ ] **UX-01**: Dashboard with preset cards as large, tappable surfaces
- [ ] **UX-02**: Countdown screen with large Stop/Dismiss button and phase indicator
- [ ] **UX-03**: Pause and resume functionality during active timer
- [ ] **UX-04**: Gentle, zen aesthetic — smooth transitions, generous spacing, minimalist design

## v2 Requirements

### Customization

- **CUST-01**: Custom timing — user adjusts delays between phases and ramp-up duration
- **CUST-02**: Dark/light mode following OS `prefers-color-scheme`

### Audio

- **AUD-05**: Additional synthesized sound options (chimes, sine swells)
- **AUD-06**: Snooze functionality (intentionally omitted from v1 as design decision)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Clock-based scheduling (e.g., "wake at 7am") | PWAs can't reliably deliver scheduled alarms; countdown timers only |
| Persistent preset storage | Settings are ephemeral per session by design |
| User accounts / cloud sync | No backend; pure client-side app |
| Native app (iOS/Android) | PWA only |
| Multiple simultaneous alarms | Complexity with no clear v1 value |
| Real-time chat / social | Not relevant to alarm use case |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUD-01 | Phase 1 | Pending |
| AUD-02 | Phase 1 | Pending |
| AUD-03 | Phase 1 | Complete |
| AUD-04 | Phase 1 | Pending |
| ALM-01 | Phase 1 | Pending |
| ALM-04 | Phase 1 | Pending |
| ALM-02 | Phase 2 | Pending |
| ALM-03 | Phase 2 | Pending |
| ALM-05 | Phase 2 | Pending |
| PLT-02 | Phase 2 | Pending |
| PLT-03 | Phase 2 | Pending |
| PLT-04 | Phase 2 | Complete |
| UX-01 | Phase 3 | Pending |
| UX-02 | Phase 3 | Pending |
| UX-03 | Phase 3 | Pending |
| UX-04 | Phase 3 | Pending |
| PLT-01 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-14*
*Last updated: 2026-04-14 after roadmap creation*
