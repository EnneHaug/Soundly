# Phase 1: Audio Engine and Timer - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Headless alarm engine: synthesized audio via Web Audio API, a drift-free wall-clock timer, and the three-phase escalation state machine (soft sound → vibration cue → volume ramp). No UI in this phase — the engine exposes an API that Phase 3 (React UI) will consume.

</domain>

<decisions>
## Implementation Decisions

### Singing Bowl Sound Design
- **D-01:** Use warm and deep character — low fundamental (~220Hz), rich inharmonic overtones (partials at ~2.76x, 4.72x, 6.83x), slow exponential decay. Classic tibetan singing bowl feel.
- **D-02:** Slight detuning between oscillators for natural beating/shimmer effect.
- **D-03:** Sound character customization (bright, layered options) is deferred to v2 customization.

### Escalation Transitions
- **D-04:** Phase 1→2 transition uses overlap-then-fade: singing bowl continues playing into Phase 2 and fades out, vibration starts immediately. In practice, the bowl's natural decay (~6s) will usually finish before the next phase triggers, so this is a graceful fallback.
- **D-05:** Phase 3 introduces a **different, more urgent tone** (not the singing bowl) to clearly signal final escalation. Exact tone (sine swell, chime, etc.) is Claude's discretion — must contrast with the bowl while staying within the zen aesthetic.
- **D-06:** Phase 3 sound choice customization is deferred to v2.

### Test Sound
- **D-07:** Test Sound plays the **singing bowl only** at comfortable mid-range volume. Duration: ~3 seconds (strike + initial decay, then fade out).
- **D-08:** Per-phase test buttons (test each escalation stage individually) deferred to v2 under a "Test" heading in customization.

### Claude's Discretion
- Phase 3 urgent tone selection — must contrast with singing bowl, stay zen, be synthesizable via Web Audio API
- AlarmEngine API shape (callback-based, event emitter, or other pattern) — whatever integrates cleanly with React in Phase 3
- Timer drift correction implementation details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — AUD-01 through AUD-04, ALM-01, ALM-04 define the acceptance criteria for this phase

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, background reliability strategy, aesthetic principles
- `CLAUDE.md` — Tech stack details, Web Audio API guidance, OscillatorNode factory pattern note, background keepalive strategy

### Sound Reference
- `.planning/phases/01-audio-engine-and-timer/bowl-demo.html` — Interactive audio demo used during discussion; shows the three bowl character options. Option A (warm and deep) was selected.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — this phase establishes the foundational patterns

### Integration Points
- AlarmEngine will be consumed by Phase 3 (React UI) — API must be React-friendly
- Silent audio keepalive loop (AUD-04) will be extended in Phase 2 (Background Reliability)
- Phase 2 vibration handling depends on the state machine built here

</code_context>

<specifics>
## Specific Ideas

- Singing bowl partials based on real tibetan bowl harmonic ratios (~2.76x, 4.72x, 6.83x of fundamental)
- Slight detuning between oscillators for natural beating — demonstrated in bowl-demo.html option A
- OscillatorNode cannot restart after `.stop()` — factory pattern required (noted in STATE.md)

</specifics>

<deferred>
## Deferred Ideas

- **v2 Customization: Sound character selection** — Let users choose between warm/deep, bright/clear, and layered singing bowl options (D-03)
- **v2 Customization: Phase 3 tone selection** — Let users choose the escalation tone (D-06)
- **v2 Customization: Per-phase test buttons** — Individual test buttons for each escalation stage under a "Test" heading (D-08)

</deferred>

---

*Phase: 01-audio-engine-and-timer*
*Context gathered: 2026-04-14*
