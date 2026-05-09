# Phase 7: Segment Engine + Triangle Sound — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `07-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 07-segment-engine-triangle-sound
**Areas discussed:** Alarm-sound semantics, Triangle synth params

---

## Areas selected for discussion

| Area | Selected? |
|------|-----------|
| Alarm-sound semantics | ✓ |
| Triangle synth params | ✓ |
| SegmentEngine API | Claude's discretion |
| Dev-only harness | Claude's discretion |
| Validation return shape | Claude's discretion |
| Segment ID strategy | Claude's discretion |

---

## Alarm-sound semantics

### Q1 — When `endSound: 'alarm'` fires at a segment tail, what audio plays?

| Option | Description | Selected |
|--------|-------------|----------|
| Sustained ramp (v1 reuse) | Reuse v1 `createPhase3Ramp` + looping `startPhase3Swell`. Segment `durationMs` becomes ramp duration. Loop runs until dismiss. Pause locked. | ✓ |
| One-shot bright strike | Symmetric with gentle/triangle: silence + tail strike (~1–3 s). Cleaner data model but loses v1 ramp guarantee. |  |
| Hybrid: strike + sustain | Strike at tail, then immediately drop into v1 swell loop (no ramp). |  |

**User's choice:** Sustained ramp (v1 reuse)
**Notes:** Followed up Q2 to clarify exactly when ramp starts.

### Q2 — When inside an alarm segment does the v1 ramp actually start?

| Option | Description | Selected |
|--------|-------------|----------|
| Spans the full segment | Ramp begins at segment START (not tail). `durationMs` becomes the ramp duration. | ✓ (with extension) |
| Strike at tail like others | Silent until tail, then ramp starts at segment-end with default ramp time. |  |
| Configurable per-segment | Optional `rampDurationMs` field on alarm segments. |  |

**User's freeform answer:** "alternative 1. but if alarm is not manually turned of, it shall continue. continue until it is shut off manually"
**Locked:** Ramp spans full segment from start; swell continues looping past segment-end indefinitely until manual dismiss. Pause locked from segment-start onwards.

### Q3 — When the last segment is gentle/triangle (no alarm tail), what does the engine do after the final strike?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-stop | Engine self-terminates after final tail strike's ~2 s decay. `cleanup()` runs, transitions to `'dismissed'`. | ✓ |
| Stay alive forever | Engine never auto-terminates; user must dismiss. |  |
| Configurable / discretion | Engine self-stops by default; composer enforces alarm-tail in Phase 9 UI. |  |

**User's choice:** Auto-stop
**Notes:** Final non-alarm-tail compositions self-clean-up. Phase 9 composer is free to advise/require an alarm tail for sleep alarms; Phase 7 just implements auto-stop.

---

## Triangle synth params

### Q1 — Which synthesis recipe? (auditioned via `triangle-demo.html`)

| Option | Initial freq | Final freq | Description | Selected |
|--------|-------------:|-----------:|-------------|----------|
| A) Inharmonic sine stack | 3520 Hz | 3136 Hz | 4 sine partials (fund + ×2.43 + ×4.17 + ×6.27) |  |
| B) Pure sine + steep envelope | 4000 Hz | **2793.83 Hz (F7)** | Single sine, 8 ms attack, 2.0 s exp decay | ✓ |
| B.1) Pure sine — F#7 | — | 2960 Hz | Same envelope as B at F#7 — minor flavor |  |
| B.2) Pure sine — G7 | — | 3136 Hz | Same envelope as B at G7 — suspended |  |
| C) Triangle waveform osc | 3500 Hz | 2800 Hz | Single triangle-waveform osc — odd-harmonic edge |  |
| ~~D) FM (carrier + modulator)~~ | 3500 Hz | removed | User: "D is not interesting" | — |

**User's choice:** B (pure sine, exact F7 = 2793.83 Hz, peak 0.4, 8 ms linear attack, 2.0 s exp decay to 0.001)

**Discussion arc:**
- Initial frequencies (3500–4000 Hz range) felt too high → user requested lower
- Frequencies dropped to ~3006 Hz floor (1 octave above bowl's top partial 1503 Hz)
- User: "B sounds major (dur), while C sounds minor (moll) compared to the singing bowl. why?"
  - Explained: bowl's perceived root is A (220 Hz fundamental, peak gain 0.35 — dominant). Modulo octaves, B@2800 Hz ≈ F (forms F-major chord with A → major 3rd interval), C@3006 Hz ≈ F# (forms F#-minor with A → minor 3rd interval).
  - Frequency table provided: F7=2793.83, F#7=2959.96, G7=3135.96, G#7=3322.44, A7=3520.00.
- B variants added at user request (B=F, B.1=F#, B.2=G) for direct mood comparison
- F-major flavor (B) won for the warm, cheerful end-of-segment ping
- User then decided: "change B to 2793.83, and go for that. change the requirement so that this is not a violation of any requirement"
- AUD-05 reframed in `.planning/REQUIREMENTS.md`: floor moved from "≥1 octave above ALL bowl partials (3006 Hz)" to "≥1 octave above the bowl's **dominant** partials (peak gain ≥0.10 — 220/607/1038 Hz, effective floor ~2076 Hz)." Rationale: the 1503 Hz partial has peak gain 0.06 (at noise floor) and is not a perceptible component of the bowl's timbre.

**Notes:** The auditioning artifact `triangle-demo.html` is preserved as historical record.

---

## Claude's Discretion

Decided by Claude with rationale documented in `07-CONTEXT.md`:

- **SegmentEngine API surface** — class shape mirroring AlarmEngine per Phase 6 P02 STATE.md hint; state enum `'idle' | 'running' | 'firing-alarm' | 'dismissed'`; `canPause(): boolean` query + silent no-op `pause()` when locked; single `onSegmentChange` callback firing on segment boundaries with `{ kind, segmentIndex, totalSegments, segment }`
- **Validation return shape** — discriminated union `{ ok: true, config } | { ok: false, error: string }`, single readable error, first failure wins, never throws
- **Sound dispatch architecture** — `segmentSound.ts` helper for `'gentle'` / `'triangle'`; alarm handled directly by SegmentEngine because the Phase 3 ramp+swell lifecycle is structurally different from a one-shot strike
- **Dev-only harness** — Vite-dev-mode-gated React component at `src/dev/SegmentHarness.tsx`, mounted in `App.tsx` behind `import.meta.env.DEV && URL flag`, removed in Phase 8 when `SegmentCountdown` ships
- **Segment ID strategy** — opaque to engine; composer (Phase 9) responsibility; Phase 7 fixture data hardcodes `'wake-easy-1'`..`'wake-easy-5'`
- **Pause/resume snapshot shape** — `{ currentSegmentIndex, currentSegmentRemainingMs, futureSegmentDurationsMs[] }`
- **Scheduling+drift approach** — capture `epochBaseline` once at `start()`, register absolute fire times via existing `scheduleAt`, audio strikes use `ac.currentTime` from inside the timer callback
- **Test organization** — split per concern (`SegmentEngine.test.ts`, `triangle.test.ts`, `segmentSound.test.ts`, `validateSegmentConfig.test.ts`)

## Deferred Ideas

See `07-CONTEXT.md` `<deferred>` for the full list.
