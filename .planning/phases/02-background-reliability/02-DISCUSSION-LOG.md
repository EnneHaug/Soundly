# Phase 2: Background Reliability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 02-background-reliability
**Areas discussed:** Vibration & iOS fallback

---

## Vibration Pattern (Android)

| Option | Description | Selected |
|--------|-------------|----------|
| Pulsing rhythm | Repeating 300ms vibrate, 200ms pause. Noticeable without being jarring. | ✓ |
| Escalating pulses | Starts short/gentle, gradually increases intensity/duration over Phase 2. | |
| Continuous | Single long vibration for entire Phase 2 duration. | |

**User's choice:** Pulsing rhythm
**Notes:** Matches gentle escalation philosophy — persistent nudge.

---

## iOS Audio Fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Soft repeating chime | Gentle bell/chime tone repeating on vibration rhythm. Distinct from bowl and swell. | |
| Singing bowl re-strike | Re-strike singing bowl on repeating pattern. Simpler but less differentiated from Phase 1. | |
| Subtle ticking pulse | Filtered click/tick (~50ms noise burst through bandpass), repeating on vibration rhythm. Very subtle. | ✓ |

**User's choice:** Subtle ticking pulse
**Notes:** User preferred the most subtle option. Follow-up question asked about volume behavior.

---

## Tick Volume Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Gradually increase | Start very soft, ramp up over Phase 2 duration. Better wakeability before Phase 3. | ✓ |
| Constant volume | Fixed soft level throughout Phase 2. Simpler but relies on Phase 3 for wakeup. | |

**User's choice:** Gradually increase
**Notes:** Improves wakeability of the subtle tick sound before Phase 3 escalation.

---

## Claude's Discretion

- Notification behavior (content, tap action, per-phase vs single)
- iOS "Add to Home Screen" prompt (timing, prominence, blocking behavior)
- Wake Lock loss handling (re-acquisition strategy, user warnings)

## Deferred Ideas

None — discussion stayed within phase scope
