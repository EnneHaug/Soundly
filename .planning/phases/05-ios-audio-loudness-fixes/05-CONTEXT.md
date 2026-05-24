# Phase 5: iOS Audio Loudness Fixes — Context

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Source:** Field-test findings (2026-04-22) + `.planning/research/ios-alarm-feasibility.md`

<domain>
## Phase Boundary

Software-only improvements to Phase 3 alarm audio so it is **perceptibly louder and harder to sleep through on an iPhone** — specifically with the phone's ringer (silent) switch engaged, which is how many users keep their phone at night. Out of scope: any native/Capacitor work, any locked-screen playback (structurally blocked by iOS per the feasibility research — tracked as separate Option B decision).

**Deliverable shape:** changes to the existing audio engine (`src/engine/AudioContext.ts`, `src/engine/sounds/phase3Tone.ts`) and their unit tests. Verifiable on-device with an iPhone (silent switch on AND off).

</domain>

<decisions>
## Implementation Decisions

### D-01. Set `navigator.audioSession.type = "playback"` (LOCKED)
On AudioContext creation (in `getAudioContext()` inside `src/engine/AudioContext.ts`), set `navigator.audioSession.type = "playback"` when the API is available. This is the WebKit-documented fix for iOS 17+ (WebKit bug 237322 resolution) that prevents the ringer/silent switch from muting WebAudio output.

- Feature-detect: `if ('audioSession' in navigator) navigator.audioSession.type = 'playback';`
- Side-effect acknowledged: iOS will show lock-screen media controls for the app — acceptable for an alarm app.
- No-op on iOS ≤ 16 and on non-iOS browsers (API absent). Falls back silently.

### D-02. Remove `GainNode.gain > 1`; use `DynamicsCompressorNode` (LOCKED)
The current `createPhase3Ramp` ramps gain to 3.0 then 5.0. Per Web Audio spec this hard-clips sample values > 1.0 at the output stage — distortion, not amplification. Replace with:
- Master gain ramp: `0 → 1.0` across the full Phase 3 duration (linear ramp, anchored with `setValueAtTime(0)` as today).
- Insert a `DynamicsCompressorNode` between the master gain and `ac.destination`. Starting settings: `threshold = -24 dB`, `knee = 12`, `ratio = 12`, `attack = 0.003`, `release = 0.25`. These may be tuned but must not produce audible pumping.
- Signal chain: `oscillators → oscGain → masterGain → compressor → destination`

### D-03. Shift Phase 3 frequency content to the 1–3 kHz band (LOCKED)
The current swell sweeps 80 → 220 Hz. Phone speakers roll off hard below ~300 Hz and the ear is least sensitive there. Shift the Phase 3 fundamental to the ear's sensitivity peak:
- Primary tone: fundamental sweeps `1000 → 1400 Hz` over the 3-second loop cycle (keeps the "rising" psychological effect).
- Add a harmonic layer at `2 kHz` (second harmonic) and a brighter chirp at `3 kHz` for attention-grabbing edge.
- Three detuned oscillators (1000 / 1003 / 1007 Hz band) stacked for perceived thickness — no extra peak loudness, but more subjectively substantial.
- Phase 1 (`singingBowl.ts`) is **unchanged** — the zen low-frequency register must stay.

### D-04. Add 4–8 Hz amplitude modulation ("warble") (LOCKED)
Sirens are attention-grabbing because they modulate. Add a low-frequency oscillator (LFO) at 6 Hz driving a GainNode that modulates the Phase 3 signal amplitude between approximately 0.3 and 1.0 (not 0 — avoid complete silence gaps that sound like dropouts). Implementation:
- `OscillatorNode` (type `'sine'`, freq 6 Hz) → scaled into a `GainNode.gain` parameter via a `ConstantSourceNode` offset and a scaling `GainNode`, per the standard Web Audio AM pattern.
- The AM runs for the entire Phase 3 duration. Must be stopped together with the main oscillators when Phase 3 ends.

### Out of scope — do NOT include in this phase

- Capacitor / native shell (Option B in the feasibility research — separate phase).
- Locked-screen alarm functionality (iOS policy wall — no pure-PWA fix exists).
- Swapping Phase 3 to a pre-encoded `<audio>` element WAV (feasibility research flagged this as MEDIUM-confidence; keep pure-WebAudio for this phase).
- Changes to Phase 1 singing-bowl sound (regression-protected).
- Changes to Phase 2 tick-pulse or vibration code.
- UI copy changes about iOS limitations (belongs in a Phase 3 UI follow-up, not here).

### Claude's Discretion

- Exact compressor parameters within the sane range above — can be tuned to taste as long as no audible pumping.
- Exact oscillator stack (2 vs 3 detuned voices) and detune amounts — if 3 voices sounds muddy on-device, drop to 2.
- Whether to expose any of the new synthesis parameters as module constants vs. inline literals — follow existing `phase3Tone.ts` conventions.
- Test strategy: use the existing OfflineAudioContext / mocked-AudioNode pattern from `src/engine/sounds/__tests__/phase3Tone.test.ts`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Feasibility research (source of truth for WHY each decision)
- `.planning/research/ios-alarm-feasibility.md` — "Phase 3 volume — findings and recommendation" section contains the prioritized fix list, the specific WebKit bugs, and the confidence-tagged evidence. All decisions D-01 through D-04 trace to that section.

### Existing audio engine (files being modified)
- `src/engine/AudioContext.ts` — `getAudioContext()` singleton; D-01 lands here.
- `src/engine/sounds/phase3Tone.ts` — `createPhase3Ramp`, `startPhase3Swell`, `fadeOutGain`; D-02, D-03, D-04 all modify functions here.
- `src/engine/sounds/__tests__/phase3Tone.test.ts` — existing unit tests (must be updated to match new signal chain).
- `src/engine/AlarmEngine.ts` — caller of `createPhase3Ramp` / `startPhase3Swell`; may need minor wiring updates if the function signatures change.

### Existing phase research (background)
- `.planning/phases/01-audio-engine-and-timer/01-RESEARCH.md` — original Phase 3 design rationale (Pattern 6 / Pattern 7). Useful context; D-03 is an explicit override of the 80–220 Hz choice made there.

### Project guidelines
- `CLAUDE.md` — stack (React 19 + Vite 6 + TS 5 + raw Web Audio API, no Tone.js). Confirms Vibration API unsupported on iOS (so AM is the tactile-cue substitute on iPhone).

</canonical_refs>

<specifics>
## Specific Ideas

- Feature-detection for `navigator.audioSession` should be a single conditional in `getAudioContext()`; do not spread iOS-specific branching through multiple files.
- The compressor node can be added inside `createPhase3Ramp` and returned implicitly via the existing `GainNode` return (the GainNode still is the connect-point for oscillators); the new internal chain is `masterGain → compressor → destination` rather than `masterGain → destination`.
- AM implementation should be a small helper, e.g. `createAmLfo(ac, hz, depth)` that returns an `{ lfoGain: GainNode }` which oscillators can be routed through. Keeps `startPhase3Swell` readable.
- Tests should assert: (a) `audioSession.type` is set to `'playback'` when the API is mocked as available; (b) `createPhase3Ramp` produces a compressor node in the graph (check via connect calls or graph walk); (c) `startPhase3Swell` creates oscillators whose frequency automations start at 1000 Hz; (d) the AM LFO is a 6 Hz oscillator with a scaling GainNode driving amplitude.
- Test runner is Vitest; existing test patterns mock the AudioContext constructor and spy on node methods. Follow those patterns.

</specifics>

<deferred>
## Deferred Ideas

- **Option B: Capacitor + `@capacitor/local-notifications`** — the real locked-screen fix. 1–3 days of work. Decide after Phase 5 validates on-device. Would become a new phase if chosen.
- **Option C: AlarmKit integration (iOS 26+)** — stacks on top of Option B. Not relevant until Option B exists.
- **Pre-encoded WAV via `<audio>` element** — feasibility research's "should-do" #6, MEDIUM confidence that it's louder than WebAudio. Revisit only if on-device test of D-01–D-04 still feels insufficiently loud.
- **UI copy: iPhone "keep app foregrounded" warning** — belongs in the Phase 3 React UI work, not here.
- **Critical Alerts entitlement** — only relevant inside Option B, and only if default notification sound is insufficient in practice.

</deferred>

---

*Phase: 05-ios-audio-loudness-fixes*
*Context gathered: 2026-04-22 (synthesized from `.planning/research/ios-alarm-feasibility.md` + user directive)*
