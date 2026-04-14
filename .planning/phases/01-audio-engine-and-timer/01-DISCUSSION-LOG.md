# Phase 1: Audio Engine and Timer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 01-audio-engine-and-timer
**Areas discussed:** Singing bowl sound design, Escalation transitions, Test Sound behavior

---

## Singing Bowl Sound Design

| Option | Description | Selected |
|--------|-------------|----------|
| Warm and deep (Recommended) | Low fundamental (~220Hz), rich overtones, long slow decay. Meditative and grounding. | ✓ |
| Bright and clear | Higher fundamental (~440Hz), crisp harmonics, moderate decay. Crystal bowl character. | |
| Layered blend | Multiple detuned oscillators across octaves. Richer and more complex. | |

**User's choice:** Warm and deep
**Notes:** User listened to all three options via bowl-demo.html interactive preview. Selected option A for v1. Wants all three options available as v2 customization.

---

## Escalation Transitions

### Phase 1→2 Transition

| Option | Description | Selected |
|--------|-------------|----------|
| Crossfade (Recommended) | Bowl fades out while vibration fades in. Smooth and zen. | |
| Overlap then fade | Bowl keeps playing into Phase 2, then fades out. Vibration starts immediately. | ✓ |
| Clean handoff | Bowl stops, brief silence, then next phase. Clear boundaries. | |

**User's choice:** Overlap then fade
**Notes:** User noted that normally the singing bowl's natural decay will finish before vibration starts, so this overlap is a rare graceful fallback rather than the common case.

### Phase 3 Sound

| Option | Description | Selected |
|--------|-------------|----------|
| Singing bowl, louder (Recommended) | Same bowl sound repeating with volume ramp. Consistent and recognizable. | |
| Different tone for urgency | Switch to brighter/sharper tone for contrast. Signals final wake-up stage. | ✓ |
| You decide | Claude picks the approach. | |

**User's choice:** Different tone for urgency
**Notes:** User wants Phase 3 tone choice to be customizable in v2.

---

## Test Sound Behavior

### What to Play

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 3 tone at mid volume (Recommended) | Plays escalation tone at ~50% for a few seconds. Proves audio works. | |
| Quick sampler of all phases | Compressed preview of all three phases. | |
| Singing bowl only | Plays Phase 1 bowl at comfortable volume. Gentlest preview. | ✓ |

**User's choice:** Singing bowl only
**Notes:** In v2, all three phases should have individual test buttons under a "Test" heading in customization.

### Duration

| Option | Description | Selected |
|--------|-------------|----------|
| 3 seconds (Recommended) | Bowl strike and initial decay. Short enough if tapped accidentally. | ✓ |
| Full decay (~6 seconds) | Let bowl ring out naturally. More immersive. | |
| You decide | Claude picks reasonable duration. | |

**User's choice:** 3 seconds

---

## Claude's Discretion

- Phase 3 urgent tone selection (must contrast with singing bowl, stay zen)
- AlarmEngine API shape
- Timer drift correction implementation details

## Deferred Ideas

- v2: Sound character selection (warm/bright/layered)
- v2: Phase 3 tone customization
- v2: Per-phase test buttons under "Test" heading in customization
