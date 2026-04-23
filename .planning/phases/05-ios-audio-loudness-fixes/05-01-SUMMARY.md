---
phase: 05-ios-audio-loudness-fixes
plan: 01
subsystem: audio
tags: [web-audio, ios, compressor, psychoacoustics, am-modulation, vitest]

# Dependency graph
requires:
  - phase: 01-audio-engine-and-timer
    provides: "AudioContext singleton, phase3Tone synthesis, AlarmEngine state machine"
  - phase: 02-background-reliability
    provides: "silent-keepalive + wake-lock so Phase 3 can actually run when screen dims"
provides:
  - "iOS 17+ silent-switch fix via navigator.audioSession.type = 'playback' (D-01)"
  - "Phase 3 signal chain rebuilt around DynamicsCompressorNode (D-02) — no more hard-clipping overdrive"
  - "Phase 3 frequency content moved to the 1–3 kHz ear-sensitivity / phone-speaker sweet spot (D-03)"
  - "6 Hz amplitude-modulation LFO for siren-like warble (D-04)"
  - "AlarmEngine teardown now iterates OscillatorNode[] with try/catch .stop() at every cleanup path"
affects:
  - "Future on-device iOS loudness tuning work (compressor knobs, per-voice gain)"
  - "Optional Phase 6/7 (Capacitor / AlarmKit) for locked-screen — not superseded by this phase"

# Tech tracking
tech-stack:
  added:
    - "DynamicsCompressorNode (Web Audio, native — no new npm dep)"
    - "navigator.audioSession (W3C Audio Session API, feature-detected)"
  patterns:
    - "Feature-detect iOS-17-only Web APIs via `in`-check; silent no-op on absence"
    - "AM modulation via LFO OscillatorNode → scaling GainNode → target AudioParam (no setInterval scheduling)"
    - "Multi-oscillator voice stacks returned as OscillatorNode[] — caller iterates with try/catch .stop()"

key-files:
  created: []
  modified:
    - "src/engine/AudioContext.ts (D-01)"
    - "src/engine/sounds/phase3Tone.ts (D-02/D-03/D-04 full rewrite)"
    - "src/engine/sounds/__tests__/phase3Tone.test.ts (new compressor mock + rewritten assertions)"
    - "src/engine/AlarmEngine.ts (OscillatorNode[] teardown wiring)"

key-decisions:
  - "D-01 landed inside getAudioContext() on context creation (before resume()), guarded by `'audioSession' in navigator` — WebKit bug 237322 guidance."
  - "D-02 shipped compressor with threshold=-24, knee=12, ratio=12, attack=0.003, release=0.25 — plan-locked, unchanged."
  - "D-03 kept the 3-voice detune stack at 1000/1003/1007 Hz (+1.4× sweep over 3 s) — unrolled rather than mapped to keep the `frequency: 1000|1003|1007` literals visible for the plan's grep-based acceptance verification."
  - "D-04 shipped with AM carrier mean 0.65, depth ±0.35 (AM range 0.30–1.00) — plan-locked, never modulates to silence (pitfall #3)."
  - "Renamed AlarmEngine field `phase3SwellOsc` → `phase3SwellNodes: OscillatorNode[] | null` — the plural matches the array shape and was encouraged by the plan."

patterns-established:
  - "Web Audio loudness maximization via DynamicsCompressorNode rather than hand-rolled gain staging"
  - "Siren-like AM via a single sine LFO scaled into a GainNode's gain AudioParam"
  - "Voice stacks managed as `OscillatorNode[]` with iterating try/catch teardown"

requirements-completed:
  - AUD-03
  - PLT-04

# Metrics
duration: 7m 24s
completed: 2026-04-23
---

# Phase 5 Plan 1: iOS Audio Loudness Fixes Summary

**Phase 3 rebuilt around DynamicsCompressorNode + 1–3 kHz voice stack + 6 Hz AM LFO, with `navigator.audioSession.type = 'playback'` feature-detected to stop the iOS silent switch muting WebAudio.**

## Performance

- **Duration:** 7 min 24 s
- **Started:** 2026-04-23T16:30:05Z
- **Completed:** 2026-04-23T16:37:29Z
- **Tasks:** 3 / 3
- **Files modified:** 4 (1 new test mock addition, 3 source rewrites/edits)
- **Tests:** 245 passing (16 in the rewritten `phase3Tone.test.ts`)

## Accomplishments

- **D-01 (iOS silent switch):** `navigator.audioSession.type = 'playback'` is set inside `getAudioContext()` on context creation, guarded by `'audioSession' in navigator` — no-op on iOS ≤16, Firefox, Chrome desktop. Runs BEFORE `resume()` per WebKit guidance.
- **D-02 (compressor replaces overdrive):** The old 0→3.0→5.0 `GainNode` overdrive (which hard-clipped at the output stage rather than amplifying) is gone. Master ramp is now a single linear 0→1.0 over the full Phase 3 duration, feeding a `DynamicsCompressorNode` with `{ threshold: -24, knee: 12, ratio: 12, attack: 0.003, release: 0.25 }` before `ac.destination`.
- **D-03 (1–3 kHz band):** Primary voice stack is three detuned sines at 1000 / 1003 / 1007 Hz, each sweeping ×1.4 over 3 s (→ 1400 / 1404.2 / 1409.8 Hz). Harmonic layer is a 2 kHz sine at per-voice gain 0.5; attention-grabbing chirp is a 3 kHz triangle at gain 0.3. Old 80–220 Hz band (phone-speaker roll-off, ear-insensitivity region) is removed.
- **D-04 (6 Hz AM warble):** A 6 Hz sine LFO is scaled through a GainNode (gain 0.35) into the `gain` AudioParam of an inline `amGain` GainNode (base gain 0.65). Net AM carrier range: 0.30–1.00 (mean 0.65, depth ±0.35). Intentionally does not modulate to zero (pitfall #3 — dropouts sound like bugs, not warble).
- **AlarmEngine wiring:** `phase3SwellOsc` renamed to `phase3SwellNodes: OscillatorNode[] | null`. Every teardown path (`setInterval` loop-cycle inside `enterPhase3`, `pause()`, `cleanup()`) now iterates with `forEach((n) => { try { n.stop(); } catch {} })` so the LFO is stopped alongside the audible voices — no orphan nodes.
- **Tests:** Added `DynamicsCompressorNode` mock + `_initType` / `_initGain` tracking on the existing `OscNodeMock` / `GainNodeMock`. Rewrote every Phase 3 assertion (structural — not waveform equality, per pitfall #2). `fadeOutGain` describe block is bit-for-bit unchanged as a regression guard.

## Task Commits

Each task was committed atomically:

1. **Task 1: AudioContext iOS `audioSession.type` feature-detect (D-01)** — `d233ab8` (feat)
2. **Task 2: phase3Tone rewrite — compressor + 1-3 kHz + 6 Hz AM LFO (D-02/03/04)** — `b6cddaa` (feat)
3. **Task 3: AlarmEngine `OscillatorNode[]` wiring + test rewrite** — `8bd7125` (feat)

## Files Created/Modified

- `src/engine/AudioContext.ts` — Added feature-detected `navigator.audioSession.type = 'playback'` on context creation; file-level JSDoc notes the iOS-17+ behavior. Function signature unchanged.
- `src/engine/sounds/phase3Tone.ts` — Full rewrite of `createPhase3Ramp` (now inserts a `DynamicsCompressorNode` between `masterGain` and `destination`, single 0→1.0 ramp) and `startPhase3Swell` (returns `OscillatorNode[]` — 3 detuned + 1 harmonic + 1 chirp + 1 LFO = 6 nodes). `fadeOutGain` body untouched. Module JSDoc rewritten around the new rationale.
- `src/engine/sounds/__tests__/phase3Tone.test.ts` — Added `DynamicsCompressorNode` mock + mock metadata (`_initType`, `_initGain`, `_initOpts`). Rewrote all `createPhase3Ramp` / `startPhase3Swell` assertions against the new signal chain. `fadeOutGain` describe block preserved verbatim.
- `src/engine/AlarmEngine.ts` — Renamed field `phase3SwellOsc: OscillatorNode | null` → `phase3SwellNodes: OscillatorNode[] | null`. Replaced three single-`.stop()` sites with `?.forEach((n) => { try { n.stop(); } catch {} })` in `enterPhase3` loop body, `pause()`, and `cleanup()`. 3200 ms loop period and pause/resume semantics unchanged.

## Decisions Made

- **D-01 site:** Inside `getAudioContext()`, in the context-creation branch only (not on every call), BEFORE `resume()`. Guard: `if ('audioSession' in navigator)`. Assignment cast scoped to the single line — no global `Navigator` redeclaration.
- **D-02 compressor params shipped:** threshold -24 dB, knee 12, ratio 12, attack 3 ms, release 250 ms. These are the plan-locked defaults; no on-device tuning performed (no iPhone in this execution environment).
- **D-03 voice count shipped:** 3 detuned voices (1000 / 1003 / 1007 Hz). Plan allowed dropping to 2 if muddy on-device, but without an audition option the default of 3 was kept. Per-voice gains are the plan-locked values: harmonic 0.5, chirp 0.3, detune voices at unity through `amGain`.
- **D-04 AM depth shipped:** ±0.35 around mean 0.65 (net range 0.30–1.00). LFO is a sine at 6 Hz, scaled through `GainNode(gain: 0.35)` into `amGain.gain`.
- **Field naming:** Chose the rename `phase3SwellOsc` → `phase3SwellNodes` for clarity, per plan discretion.
- **Test structure:** Followed pitfall #2 — structural assertions (is there a `DynamicsCompressorNode` in the chain? is there exactly one 6 Hz LFO? does the 1000 Hz voice ramp to 1400 at t=3s?) rather than waveform equality.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Correctness / grep-acceptance compatibility] Unrolled detune-voice `.map(f => ...)` into three explicit constructor calls**
- **Found during:** Task 2 (phase3Tone rewrite)
- **Issue:** The 05-RESEARCH.md code template uses `[1000, 1003, 1007].map(f => new OscillatorNode(ac, { ..., frequency: f }))`. Semantically correct, but the plan's acceptance criteria and plan-level verification require `grep -nE "frequency:\s*1000\b"` to match at least once. With a mapped pattern, the literal `frequency: 1000` never appears in source, so the grep returns zero — which would break the plan-level verification gate (`frequency:\s*(1000|2000|3000)\b` count ≥ 3 — with the map it's only 2).
- **Fix:** Unrolled to three explicit constructor calls (`const d1 = new OscillatorNode(ac, { type: 'sine', frequency: 1000 }); d1.frequency.setValueAtTime(1000, ac.currentTime); d1.frequency.linearRampToValueAtTime(1000 * 1.4, ac.currentTime + 3.0); …` and likewise for 1003, 1007). Behaviour is identical — still 3 sine voices, identical sweeps, identical routing through `amGain`. Added an in-file comment explaining the unroll.
- **Files modified:** `src/engine/sounds/phase3Tone.ts`
- **Verification:** `grep -nE "frequency:\s*1000\b" src/engine/sounds/phase3Tone.ts` returns 2 matches (comment + code); `grep -nE "frequency:\s*(1000|2000|3000)\b" …` returns 4 matches (≥ 3 required).
- **Committed in:** `b6cddaa`

---

**Total deviations:** 1 auto-fixed (1 correctness / grep-verifiability alignment)
**Impact on plan:** Zero functional change — same oscillator count, same frequencies, same sweep, same routing. Only the source structure shape changed so the plan's grep-based gates can find the numeric literals. Not scope creep.

## Issues Encountered

- **Worktree snapshot noise:** The repository contains a stale copy of `src/` under `.claude/worktrees/agent-a1b94266/` (an agent infrastructure artifact, outside git tracking). vitest picks it up and runs its tests too — 13 "phase3Tone" tests there still pass because that directory has its own pre-rewrite `phase3Tone.ts`. This is pre-existing and out of scope per execute-plan.md's scope-boundary rule; it does not affect the real `src/` tests (16 rewritten tests, all green). Logged for phase cleanup work.

## User Setup Required

None for dev/build. **On-device manual verification is required** to confirm D-01 through D-04 land on real iOS hardware:

1. **Deploy the PWA over HTTPS.** `navigator.audioSession` is only exposed in secure contexts; a local HTTP dev server will silently no-op the D-01 fix (the feature-detect hides it — this is by design but means only HTTPS is a valid iOS test).
2. **Install the PWA to the home screen on an iPhone running iOS 17+.**
3. **Test — silent switch ON (ringer off):**
   - Start a Quick Nap preset.
   - Wait for Phase 3 to trigger.
   - **Expected:** Phase 3 plays audibly. (Pre-D-01 behaviour: silent.)
4. **Test — silent switch OFF (ringer on):**
   - Repeat.
   - **Expected:** Phase 3 is audibly louder than Phase 2, with a perceptible ~6 Hz warble, no clipping / distortion / pumping.
5. **Regression check — Phase 1:**
   - Repeat.
   - **Expected:** The singing-bowl strike is unchanged (same low-frequency zen sound). The `git diff` on `src/engine/sounds/singingBowl.ts` is empty — this is the code-level regression guarantee.

**Locked-screen caveat (unchanged, deferred):** If the iPhone screen is off / the PWA is backgrounded / the phone is locked, iOS will eventually suspend the AudioContext and Phase 3 will not fire. This is an iOS policy wall that no pure-PWA fix can cross. The deferred "Option B" path (Capacitor + `@capacitor/local-notifications`, possibly later Option C for AlarmKit on iOS 26+) is the structural fix and is out of scope for this phase. Users should be told to keep the app foregrounded (a future UI-copy plan, not this one).

## Next Phase Readiness

- **Ready for on-device validation.** All plan-level gates are green: `npx tsc --noEmit` exits 0; `npm test` exits 0 (245/245); no ramp target ≥ 2.0 in the Phase 3 graph; compressor is in the chain; 6 Hz LFO present exactly once; Phase 1 / Phase 2 / platform layers have no diff.
- **Open question for the user after device testing:** should the detune stack drop to 2 voices if 3 sounds muddy, and should compressor `threshold` shift lower than -24 dB if the Phase 3 → Phase 2 perceived-loudness delta is still too small? Both are knob-turns, not new work. Leave them at the plan-locked defaults until on-device data arrives.
- **Still deferred (pre-existing, unchanged):** Option B (Capacitor locked-screen), Option C (AlarmKit iOS 26+), `<audio>`-element WAV fallback, Critical Alerts entitlement, and the "keep app foregrounded" UI copy.

## Self-Check: PASSED

- `src/engine/AudioContext.ts`: FOUND — contains `'audioSession' in navigator` + `audioSession.type = 'playback'` before `resume()`.
- `src/engine/sounds/phase3Tone.ts`: FOUND — contains `new DynamicsCompressorNode`, `threshold: -24`, `ratio: 12`, `linearRampToValueAtTime(1.0, …)`, `frequency: 6`, `frequency: 1000`, `frequency: 2000`, `frequency: 3000`; zero matches for `80`/`220` band or `linearRamp(3.0|5.0)`.
- `src/engine/sounds/__tests__/phase3Tone.test.ts`: FOUND — 16 tests, all passing; contains `DynamicsCompressorNode` mock (3 refs) and 1000/6 Hz assertions; zero refs to 80 Hz.
- `src/engine/AlarmEngine.ts`: FOUND — `phase3SwellNodes: OscillatorNode[] | null`; 3 × `forEach` teardown sites; `startPhase3Swell` called from 2 code sites (plus 1 import).
- Commit `d233ab8`: FOUND on branch main.
- Commit `b6cddaa`: FOUND on branch main.
- Commit `8bd7125`: FOUND on branch main.
- `git diff src/engine/sounds/singingBowl.ts`: empty (regression confirmed).
- `git diff src/engine/sounds/tickPulse.ts`: empty.
- `git diff src/engine/sounds/keepalive.ts`: empty.
- `git diff -- 'src/platform/**' 'src/ui/**' capacitor.config.ts`: empty.

---
*Phase: 05-ios-audio-loudness-fixes*
*Completed: 2026-04-23*
