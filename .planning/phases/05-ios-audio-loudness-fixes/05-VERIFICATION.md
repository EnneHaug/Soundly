---
phase: 05-ios-audio-loudness-fixes
verified: 2026-04-23T00:00:00Z
status: human_needed
score: 5/7 must-haves verified (2 deferred to on-device UAT)
overrides_applied: 0
gaps: []
human_verification:
  - test: "iPhone iOS 17+ — silent/ringer switch ON, PWA installed over HTTPS"
    expected: "Phase 3 plays audibly (pre-D-01 was silent). navigator.audioSession.type='playback' is in effect."
    why_human: "navigator.audioSession is only exposed in WebKit secure contexts on real iOS hardware. No simulator / desktop browser can validate the silent-switch path. Structural grep + TS compile confirm the assignment is reachable; only a physical device confirms it works."
  - test: "iPhone iOS 17+ — silent switch OFF, run a preset, listen for Phase 3 after Phase 2"
    expected: "Phase 3 is subjectively louder than Phase 2, audibly in the 1-3 kHz band, with a perceptible ~6 Hz warble, no clipping / pumping / dropouts."
    why_human: "Subjective loudness comparison against Phase 2 cannot be measured by grep or unit test. Compressor pumping, AM dropout audibility, and phone-speaker response all require ear-based audition."
  - test: "iPhone — run a full preset cycle, then dismiss. Inspect Safari Web Inspector for orphan OscillatorNodes."
    expected: "After dismiss, no OscillatorNode is left in 'running' state. AudioContext.state === 'closed' or 'suspended'."
    why_human: "Orphan-node leak would only manifest over a long-running session on real hardware. Unit tests verify the forEach teardown iterates, but iOS-specific node lifecycle requires device confirmation."
---

# Phase 5: iOS Audio Loudness Fixes — Verification Report

**Phase Goal (from ROADMAP):** Phase 3 escalation feels meaningfully louder and more attention-grabbing than Phase 2 on iPhone, and is not silenced by the ringer switch — software-only (no native wrapper).

**Verified:** 2026-04-23
**Status:** human_needed (all automated gates green; on-device UAT required for the two subjective / device-gated truths)
**Re-verification:** No — initial verification
**Pre-execution HEAD:** `1a0c327`
**Post-execution HEAD:** `efafab0`

---

## Goal Achievement

### Observable Truths (from `must_haves.truths` in 05-01-PLAN frontmatter + ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Phase 3 plays audibly on iPhone with ringer/silent switch ON | DEFERRED to on-device UAT | `AudioContext.ts:28-30` sets `navigator.audioSession.type = 'playback'` under the `'audioSession' in navigator` guard, immediately after `new AudioContext()` and before `_ctx.resume()`. Structurally correct per WebKit bug 237322 guidance in `05-RESEARCH.md`. Cannot be validated without iOS hardware. |
| 2 | Phase 3 is audibly louder + more attention-grabbing than Phase 2 on iPhone (ringer OFF) | DEFERRED to on-device UAT | Code path supports the claim: `phase3Tone.ts:51-57` inserts a `DynamicsCompressorNode` (threshold -24, knee 12, ratio 12, attack 0.003, release 0.25) so perceived loudness is boosted without the old clipping; fundamentals moved from 80-220 Hz to 1000/1003/1007 Hz (phone-speaker / ear sweet spot); 2 kHz harmonic + 3 kHz triangle chirp add edge; 6 Hz AM LFO adds warble. Subjective comparison requires audition. |
| 3 | No audio clipping or distortion at peak Phase 3 volume | VERIFIED | `grep -nE "linearRampToValueAtTime\\(\\s*[2-9]" src/engine/sounds/phase3Tone.ts` returns 0 matches. Master ramp is single `linearRampToValueAtTime(1.0, …)` at line 49 — no 3.0/5.0 overdrive. Compressor is the replacement loudness mechanism. |
| 4 | Phase 3 waveform exhibits perceptible warble/modulation rather than steady tone | VERIFIED (structurally) | `phase3Tone.ts:86-89` — single 6 Hz sine `OscillatorNode` connected through `GainNode(gain: 0.35)` into `amGain.gain` (base 0.65). Net AM range 0.30-1.00, never silent (pitfall #3 respected). Exactly one `frequency: 6` literal in the file. Audibility is subjective / device-gated. |
| 5 | Phase 1 singing-bowl sound unchanged (regression) | VERIFIED | `git diff 1a0c327..efafab0 -- src/engine/sounds/singingBowl.ts` is empty. No edits to Phase 1 synthesis. |
| 6 | Unit tests for phase3Tone continue to pass under the new signal chain | VERIFIED | `npm test` exits 0 with 245/245 (16 in phase3Tone.test.ts). Mock infra extended with `DynamicsCompressorNode` stub + `_initOpts` metadata. `fadeOutGain` describe block preserved as regression guard. |
| 7 | TypeScript compiles with no errors | VERIFIED | `npx tsc --noEmit` exits 0. |

**Score:** 5/7 truths automatically verified. Truths #1 and #2 are the phase's raison d'être but structurally depend on iOS-hardware-only behavior — they MUST be validated by on-device UAT before the phase can be marked "Complete" in ROADMAP/STATE.

### Deferred Items

None of the gaps are deferred to later milestone phases. Phase 5 is the last integer phase; Options B (Capacitor locked-screen) and C (AlarmKit) are deferred out of the current roadmap entirely and do not cover Phase 5's truths.

---

## Required Artifacts (from `must_haves.artifacts` in plan frontmatter)

| Artifact | Expected | Exists | Substantive | Wired | Data Flows (L4) | Status | Details |
|----------|----------|--------|-------------|-------|-----------------|--------|---------|
| `src/engine/AudioContext.ts` | `audioSession.type` feature-detected | yes | yes (36 lines, meaningful JSDoc, feature-guard + assignment) | yes (imported by `AlarmEngine.ts:29`) | n/a (config, not data renderer) | VERIFIED | Lines 28-30 hold the three-line `if ('audioSession' in navigator)` block. Cast is scoped to the assignment line, no global Navigator redeclaration. |
| `src/engine/sounds/phase3Tone.ts` | compressor ramp 0→1.0 + 1 kHz stack + 2 kHz harmonic + 3 kHz chirp + 6 Hz AM LFO | yes | yes (141 lines, fully rewritten, JSDoc updated) | yes (all three exports imported by `AlarmEngine.ts:31-35`) | yes — oscillators feed amGain → masterGain → compressor → destination; masterGain ramp drives volume envelope | VERIFIED | `new DynamicsCompressorNode` at :51; `linearRampToValueAtTime(1.0, …)` at :49; `frequency: 1000` at :95; `frequency: 2000` at :116; `frequency: 3000` at :121; `frequency: 6` at :86. Zero matches for 80/220 or ramps ≥ 2.0. |
| `src/engine/sounds/__tests__/phase3Tone.test.ts` | compressor mock + 1 kHz / 6 Hz assertions + `fadeOutGain` regression | yes | yes (310 lines, 16 tests) | yes (runs under vitest as part of `npm test`) | yes — 245/245 passing | VERIFIED | `DynamicsCompressorNode` mock at :91-106; compressor-param assertion at :169-180; 1000 Hz test at :217-227; 6 Hz LFO test at :229-236; 2 kHz / 3 kHz test at :238-249; ×1.4 sweep test at :251-263; `fadeOutGain` describe preserved at :285-309. Zero matches for `_initFreq === 80`. |
| `src/engine/AlarmEngine.ts` | field typed `OscillatorNode[] \| null`, forEach teardown in all 3 sites | yes | yes (419 lines, diff +29/-24) | yes (state consumed by React via `useAlarmEngine`) | yes — swell nodes populated by `startPhase3Swell` call at :209 and loop replacement at :220 | VERIFIED | Field decl at :49 `private phase3SwellNodes: OscillatorNode[] \| null = null`. forEach teardown sites: `:213-219` (enterPhase3 loop body), `:263-269` (pause), `:403-409` (cleanup). Zero lingering `phase3SwellOsc` references. |

---

## Key Link Verification (from `must_haves.key_links`)

| From | To | Via | Pattern | Status | Detail |
|------|-----|-----|---------|--------|--------|
| `AudioContext.ts` | `navigator.audioSession` | feature-detected assignment inside `getAudioContext()` | `audioSession.type\s*=\s*['"]playback['"]` | WIRED | Line 29: assignment present, inside the context-creation branch, before the resume() check (line 32). Cast is local-scoped. |
| `phase3Tone.ts createPhase3Ramp` | `DynamicsCompressorNode` | `masterGain → compressor → ac.destination` | `new\s+DynamicsCompressorNode` | WIRED | Line 51 constructs compressor; line 58 is `masterGain.connect(compressor).connect(ac.destination)`. Chain is single-path, no parallel routes. |
| `phase3Tone.ts startPhase3Swell` | 6 Hz LFO → scaling GainNode → `amGain.gain` | LFO → `GainNode(gain: 0.35)` → `amGain.gain` | `frequency:\s*6\b` | WIRED | Line 86: `OscillatorNode({ type: 'sine', frequency: 6 })`. Line 87: `new GainNode(ac, { gain: 0.35 })`. Line 88: `lfo.connect(lfoScale).connect(amGain.gain)` — LFO drives the AudioParam, not a pass-through gain node. |
| `AlarmEngine.ts` | `startPhase3Swell` `OscillatorNode[]` return | stores array, iterates `.stop()` on each node (incl. LFO) | `phase3SwellNodes\|phase3SwellOscs` | WIRED | Field at :49. Three forEach sites (:213, :263, :403) iterate the array with try/catch around `.stop()`, so the LFO cannot be orphaned at any teardown path (loop-cycle replacement, pause, cleanup). |

All four key links are WIRED. No partial / not-wired / orphaned links.

---

## Data-Flow Trace (Level 4)

- **`AudioContext.ts::getAudioContext()`** — returns the singleton AudioContext; consumed at `AlarmEngine.ts:104` in `start()`. Data flows into every phase's audio nodes. Source produces a real AudioContext instance (not static). FLOWING.
- **`phase3Tone.ts::createPhase3Ramp()`** — returns a GainNode with a real, non-zero linear ramp bound to `ac.currentTime`; consumed at `AlarmEngine.ts:205`. Downstream `startPhase3Swell` writes into it. FLOWING.
- **`phase3Tone.ts::startPhase3Swell()`** — returns a populated `OscillatorNode[]` of length 6, all `.start()`ed; nodes are stored in `phase3SwellNodes` at `AlarmEngine.ts:209` and :220. Array is not hollow (length > 0 asserted in tests). FLOWING.
- **`phase3SwellNodes` field** — populated by `startPhase3Swell` return, read by three `forEach` teardown sites. Field is never hardcoded `[]`. FLOWING.

No hollow-prop, disconnected, or static-return patterns found.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TS compile clean | `npx tsc --noEmit` | Exit 0 | PASS (per user prompt) |
| Unit test suite | `npm test` | 245/245 pass | PASS (per user prompt) |
| Compressor present in Phase 3 chain | `grep -n "new DynamicsCompressorNode" phase3Tone.ts` | 1 match @ line 51 | PASS |
| 1–3 kHz band present | `grep -nE "frequency:\s*(1000\|2000\|3000)\b" phase3Tone.ts \| wc -l` | 4 matches (unrolled stack + 2k + 3k) | PASS |
| Exactly one 6 Hz LFO | `grep -nE "frequency:\s*6\b" phase3Tone.ts \| wc -l` | 1 match @ line 86 | PASS |
| audioSession fix landed | `grep -n "audioSession.type" AudioContext.ts` | 1 match @ line 29 referencing `'playback'` | PASS |
| No ramp target ≥ 2.0 | `grep -nE "linearRampToValueAtTime\(\s*[2-9]" phase3Tone.ts` | 0 matches | PASS |
| OscillatorNode[] teardown in all 3 sites | `grep -nE "phase3SwellNodes\?\.forEach" AlarmEngine.ts` | 3 matches (:213, :263, :403) | PASS |
| Silent-switch behavior on iPhone | iOS device test | n/a — cannot run in sandbox | SKIP → human |
| Subjective loudness vs Phase 2 on iPhone | iOS device audition | n/a — requires ear + hardware | SKIP → human |

Automated checks: 8/8 PASS. Two items routed to human verification.

---

## Requirements Coverage

| Requirement | Source Plan | REQUIREMENTS.md Text | Status | Evidence |
|-------------|-------------|----------------------|--------|----------|
| **AUD-03** | 05-01 frontmatter | "Test Sound button plays Phase 3 sound at mid-range volume to verify audio works" | SATISFIED (indirectly) | Plan 5 modifies the Phase 3 synthesis that the Test Sound button exercises. No regression: `npm test` green, Test Sound button code path unchanged (no `src/ui/**` diff). The new synthesis still drives Phase 3 through the same public entry points (`createPhase3Ramp`, `startPhase3Swell`). Note: AUD-03 was already marked Complete in Phase 1; Phase 5 is a loudness update, not a new-feature satisfaction. Claim stands. |
| **PLT-04** | 05-01 frontmatter | "iOS standalone detection with 'Add to Home Screen' prompt for non-installed users" | NOT DIRECTLY IMPLEMENTED by this phase | This requirement was delivered in Phase 4 (marked Complete in REQUIREMENTS.md traceability table, mapped to "Phase 2" in the status grid — pre-existing). Plan 5 lists it as tagged-for-iOS-context but ships no code for the standalone-detection path. This is a frontmatter-tagging inconsistency, NOT a broken feature — PLT-04 is already satisfied upstream. Flag only. |

### Orphaned Requirements Check

ROADMAP Phase 5 maps `AUD-03, PLT-04`. The plan frontmatter lists `AUD-03, PLT-04`. Match — no orphaned requirements.

**Note:** The plan's `requirements` frontmatter is arguably over-claimed: the phase's *actual* work (D-01..D-04) is loudness tuning, which doesn't map cleanly to any existing requirement ID. A tighter mapping would have been "no requirement — technical-debt / UX-refinement phase". This is a minor traceability nit, not a verification gap.

---

## Anti-Patterns Found

Scanned files modified in this phase (`src/engine/AudioContext.ts`, `src/engine/sounds/phase3Tone.ts`, `src/engine/sounds/__tests__/phase3Tone.test.ts`, `src/engine/AlarmEngine.ts`) for TODO/FIXME/placeholder/stub patterns.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | — |

No anti-patterns detected in phase-modified files. No `TODO`, `FIXME`, `XXX`, `HACK`, `PLACEHOLDER`, no hardcoded-empty `[]`/`{}` props that reach the render path, no `return null` / `return {}` stubs. The compressor parameters are numeric literals (expected for a self-contained synthesis module); they are not "hardcoded-stub" values because they are the designed configuration, not placeholder data.

---

## Scope Regression Check

Confirmed no out-of-scope files were touched between `1a0c327..efafab0`:

| File | Expected | `git diff` Result |
|------|----------|-------------------|
| `src/engine/sounds/singingBowl.ts` | unchanged (Phase 1 regression guard) | EMPTY |
| `src/engine/sounds/tickPulse.ts` | unchanged (Phase 2) | EMPTY |
| `src/engine/sounds/keepalive.ts` | unchanged (Phase 2 / AUD-04) | EMPTY |
| `src/platform/**` (wakeLock, vibration) | unchanged (Phase 2) | EMPTY |
| `src/ui/**` | unchanged (Phase 3) | EMPTY |
| `capacitor.config.ts` | unchanged (out of scope) | EMPTY (file does not exist — correct; Option B deferred) |

`AlarmEngine.ts` diff (+29 / -24): changes are limited to the `phase3SwellNodes` field rename/retype and the three forEach teardown sites. Phase 1 `strikeBowl` call path unchanged; Phase 2 `enterPhase2` function unchanged; `start()` / `pause()` / `resume()` / `cleanup()` orchestration logic unchanged modulo the new forEach. Inspection confirms no collateral change to the state machine contract. No regression.

---

## Honest Caveats (Explicitly Called Out)

1. **The audioSession silent-switch fix (D-01) is validated only structurally.** Grep confirms the assignment, TS confirms the cast compiles, but `navigator.audioSession` is undefined in Node / jsdom and in every desktop browser — so no automated test exercises the real code path. A physical iPhone running iOS 17+ with the PWA installed over HTTPS is the ONLY environment that can confirm D-01 actually works. If on-device testing reveals the silent switch still mutes WebAudio, a follow-up phase (or `<audio>`-element WAV fallback, or Capacitor) is needed.

2. **"Phase 3 louder than Phase 2" is a subjective claim.** The code changes are designed to produce that outcome (compressor + 1–3 kHz shift + AM warble), and the research in `.planning/research/ios-alarm-feasibility.md` supports the mechanism. But whether it is *in fact* perceptibly louder on a specific iPhone speaker + user's ears cannot be measured here. The user MUST listen.

3. **Compressor and AM-LFO parameters are shipped verbatim from the plan.** The summary notes "no on-device tuning performed (no iPhone in this execution environment)" — so threshold=-24, knee=12, ratio=12, attack=0.003, release=0.25 and AM depth ±0.35/base 0.65 are educated-guess defaults. If on-device audition reveals pumping, muddy detune, dropout-sounding AM, or insufficient loudness delta, a follow-up tuning phase is expected and acceptable. The plan's "Open question for the user after device testing" section already flags this.

4. **Phase 3 locked-screen behavior is still broken.** This is out-of-scope for Phase 5 (Option B / Capacitor is the structural fix) and the summary repeats this caveat — but users should know Phase 5 only helps the foregrounded case.

5. **`PLT-04` in the plan's requirements frontmatter is a labelling artifact, not new feature work.** That requirement was already satisfied by Phase 4. Not a verification gap; flagging for clean traceability.

---

## Gaps Summary

**No code-level gaps were found.** All 9 plan-level automated gates pass (confirmed by the user's pre-verification checks). All 4 key links are wired. All 7 artifacts exist, are substantive, wired, and have real data flowing through them. Scope regression is clean. No anti-patterns found in phase-modified files.

The phase's two headline truths — silent-switch fix works, and Phase 3 is subjectively louder than Phase 2 — are gated on iOS hardware and human audition, not on further code changes. Route those to on-device UAT.

---

## Verdict

**PASS WITH CAVEATS**

The phase's automated-verifiable contract (D-01..D-04 land in the right files, with the right parameters, wired correctly, with tests green and no scope creep) is fully met. The plan's frontmatter `must_haves` are structurally satisfied, the four key links are all WIRED, and Phase 1 / Phase 2 code is bit-for-bit regression-clean.

**The phase is structurally complete but NOT yet validated.** Mark the phase "Pending on-device UAT" in STATE.md rather than "Complete" until the user has:

1. Deployed the PWA over HTTPS and installed it on iPhone iOS 17+.
2. Confirmed silent-switch-ON produces audible Phase 3.
3. Confirmed silent-switch-OFF, Phase 3 is perceptibly louder than Phase 2 with warble and no clipping.
4. Confirmed no orphan OscillatorNodes after a full dismiss cycle.

If any of (2)–(4) fails, a tuning follow-up phase (compressor threshold, voice-count, AM depth) is the expected remediation path — not a rewrite.

**Top 3 findings:**

1. All 9 plan-level automated gates pass and all 4 must-have key links are wired; D-01..D-04 are landed correctly and Phase 1 / Phase 2 code is regression-clean (confirmed via empty `git diff`).
2. The `OscillatorNode[]` teardown is correctly iterated at all three sites (`enterPhase3` loop body @ :213, `pause()` @ :263, `cleanup()` @ :403), so the 6 Hz LFO cannot be orphaned on any teardown path.
3. The two user-facing success criteria — silent-switch audibility (D-01) and louder-than-Phase-2 feel (D-02..D-04) — are code-structurally correct but require physical-iPhone UAT to confirm. Do not mark the phase Complete on automated gates alone.

---

*Verified: 2026-04-23*
*Verifier: Claude (gsd-verifier)*
