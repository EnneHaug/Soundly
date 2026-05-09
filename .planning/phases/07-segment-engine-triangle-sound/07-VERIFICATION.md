---
phase: 07-segment-engine-triangle-sound
verified: 2026-05-09T22:55:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "SEG-02 #2 — 17-minute, 5-segment foreground drift run on desktop browser"
    expected: "From t=0 (Start press) to t=17:00 wall-clock, the SegmentHarness event log shows segment 0..3 'end' events at performance.now() = 240_000, 480_000, 720_000, 960_000 ms (±2 s) and segment 4 'start' (alarm fire) at 1_020_000 ms (±2 s). End-to-end drift across the 17-minute run < 2 s."
    why_human: "The 17-minute drift budget cannot be exercised under Vitest fake timers — fake timers eliminate real-clock drift by definition. The drift comes from real-world wall-clock advance, browser tab visibility throttling, and OS power management, none of which are simulable. Test #2 in SegmentEngine.test.ts proves the *absolute scheduling registration* (calls[0..4][0] === epochBaseline + cumulative) but cannot prove real-time fire accuracy."
  - test: "SEG-02 #2 — same foreground drift run on Android Chrome (background-tab nuance)"
    expected: "Same accuracy as desktop run. Optional sub-test: with the tab BACKGROUNDED for several minutes, scheduled fires still arrive within budget thanks to AlarmSession's keepalive + Wake Lock acquisition."
    why_human: "Android Chrome has different visibility-throttling behavior than desktop. Manual on-device verification is the only way to confirm SEG-02 holds in the foreground-mobile scenario."
  - test: "AUD-05 #4 (sub-criterion in SC #4) — on headphones at 50% volume the triangle attack is inaudible as a separate event from the tone"
    expected: "Click-free perception — tester hears one cohesive bright ping, not a click followed by a tone."
    why_human: "Subjective audio quality cannot be asserted programmatically. The 8 ms attack envelope is verified in code (>= 5 ms AUD-05 floor) and unit test, but human ear is the final judge of 'click-free' under real headphone conditions."
re_verification: null
---

# Phase 7: Segment Engine + Triangle Sound — Verification Report

**Phase Goal:** A SegmentEngine running alongside AlarmEngine can schedule N segments with absolute-fire-time accuracy, fire one of three end-of-segment sounds (gentle / triangle / alarm), validate ill-formed segment configs before they reach the runtime, and pause/resume mid-segment. The triangle sound is synthesized click-free and is sonically distinct from the singing bowl. No UI is added; the runtime is verified via tests and a temporary dev-only harness.

**Verified:** 2026-05-09T22:55:00Z
**Status:** human_needed (5/5 automated criteria PASS; 3 sub-items require manual on-device or perceptual verification — these are documented post-phase activities, not blockers)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (mapped to Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Types `Segment`/`SegmentConfig` exported from engine; `validateSegmentConfig` rejects empty/NaN/zero/negative durations and unknown sound keys with user-readable errors; NEVER throws into runtime (SEG-01, SEG-04) | ✓ VERIFIED | `src/engine/SegmentState.ts:14-94` defines all three types and a discriminated-union validator; `grep "throw " SegmentState.ts` returns 0 matches; barrel exports at `src/engine/index.ts:34-40` re-export `Segment`, `SegmentConfig`, `SegmentEngineState`, `SegmentChangeEvent`, `validateSegmentConfig`, `WAKE_EASY_CONFIG`; 22 validator tests pass covering empty list, NaN, zero, negative, exceeds-ceiling, Infinity, unknown sound key, empty id, non-string id, null/undefined/primitive/circular reference inputs, plus first-failure-wins ordering. |
| 2 | SegmentEngine schedules every segment-end fire absolutely at `start()` (no chained `setTimeout`); audio strikes scheduled against `AudioContext.currentTime`; <2s drift over 17-min Wake Easy run on foreground desktop + Android (SEG-02) | ✓ VERIFIED (automated) / ? HUMAN VERIFICATION (drift on real clock) | `src/engine/SegmentEngine.ts:170-177` registers all N timers in a single loop using `scheduleAt(epochBaseline + cumulative, …)`; no chained setTimeout. Strike timing inside fire callbacks uses `ac.currentTime` via `strikeBowl`/`strikeTriangle`/`createPhase3Ramp`. Test "schedules every fire at epochBaseline + cumulative duration" asserts calls[0..4][0] === 1_000_000 + 240_000, 480_000, 720_000, 960_000, 1_020_000. **The <2s real-time drift criterion requires manual on-device verification** — see human_verification[0..1]. |
| 3 | Pause snapshots remaining-ms in current segment + future-segment durations; resume restores from snapshot, total elapsed extends by pause duration; pause disabled during alarm-tail (SEG-03) | ✓ VERIFIED | `SegmentEngine.ts:261-295` implements pause: `canPause()` gate (line 262), snapshot capture with `currentSegmentIndex` + `currentSegmentRemainingMs` + `futureSegmentDurationsMs[]` (line 277-283); `resume()` lines 304-337 re-baselines `epochBaseline` to absorb pause duration and re-registers timers for current + future segments. `canPause()` returns false when `state === 'firing-alarm'` (line 117). Tests "pause mid-segment captures snapshot", "resume re-registers scheduleAt for current + future segments" (asserts +4 new calls = 1 current + 3 future), "pause then resume re-emits 'start'", and "pause() during 'firing-alarm' is silent no-op" all pass. |
| 4 | `triangle.ts` plays single bright strike, click-free attack ≥5 ms, exp decay ~1-2 s, fundamental ≥1 octave above bowl's dominant partials (AUD-05) | ✓ VERIFIED (automated) / ? HUMAN VERIFICATION (click-free perception) | `src/engine/sounds/triangle.ts:20-30` — frequency 2793.83 (F7, well above bowl's 1038 Hz dominant partial × 2 = 2076 Hz floor per D-06), 8 ms `linearRampToValueAtTime(0.4 * masterGain, t + 0.008)` (>5 ms AUD-05 floor), 2.0 s `exponentialRampToValueAtTime(0.001, t + 2.0)`, `osc.stop(t + 2.1)`. 9 envelope tests pass. **Subjective click-free perception under headphones requires human ear** — see human_verification[2]. |
| 5 | v1 paths zero-diff: AlarmEngine, AlarmConfig, useAlarm, Countdown, ProgressRing, all existing sound files unchanged (SEG-05) | ✓ VERIFIED | `git diff --name-only 672d5bd..HEAD -- <17 protected paths>` returns empty. `git diff --stat 672d5bd..HEAD -- src/` shows zero modifications to AlarmEngine.ts, AlarmState.ts, AlarmSession.ts, AudioContext.ts, timer.ts, useAlarm.ts, Countdown.tsx, ProgressRing.tsx, Dashboard.tsx, all `src/engine/sounds/{singingBowl,phase3Tone,keepalive,testSound,tickPulse}.ts`, all `src/platform/*.ts`. Only modifications since Phase 6 closeout (`672d5bd`) are: src/App.tsx (allowed by D-15: 1 import + 1 const + 1 ternary branch — strictly additive dev-only mount), src/engine/index.ts (allowed by D-24: append-only after line 30, deletion count = 0). All other changes are NEW files. |

**Score:** 5/5 truths verified at the automated level; 3 sub-items (SEG-02 desktop drift, SEG-02 Android drift, AUD-05 click-free perception) flagged for manual on-device/headphones verification.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/engine/SegmentEngine.ts` | Class mirroring AlarmEngine shape; absolute-epoch scheduling; alarm-segment ramp+swell at segment-start; `firing-alarm` state with `canPause()=false`; cleanup ordering matches AlarmEngine | ✓ VERIFIED | 412 lines. Class fields mirror AlarmEngine (private `session`, `_running`, `_paused`, `timers[]`, alarm-stack handles, pause snapshot, callback). `start()` validates → reentrancy gate → `await startAlarmSession()` → segment-loop registers absolute fire epochs (lines 170-177). `handleSegmentFire` follows Pitfall #6 ordering (end → increment → start). Alarm path enters `firing-alarm` state BEFORE creating ramp (line 212). `cleanup()` 6-step ordering verbatim from AlarmEngine.cleanup() (lines 363-411). Auto-stop window via `DECAY_WINDOW_MS = { gentle: 6100, triangle: 2100 }` (lines 83-86) per D-04. |
| `src/engine/SegmentState.ts` | Types `Segment`/`SegmentConfig`/`SegmentEngineState`/`SegmentChangeEvent`/`SegmentPauseSnapshot`/`SegmentValidationResult`; `validateSegmentConfig(unknown)` returning discriminated union, never throws; `WAKE_EASY_CONFIG` summing to 17 min exact | ✓ VERIFIED | 113 lines. All 6 types exported (lines 14-41). Validator at lines 59-94 — 6 ordered checks (object → segments array non-empty → per-segment {object, id, duration, sound key}). `grep "throw " src/engine/SegmentState.ts` returns 0 matches. `WAKE_EASY_CONFIG` at lines 104-112: `4 × 240_000 + 1 × 60_000 = 1_020_000 ms = 17 min` (verified via `node -e`). |
| `src/engine/sounds/triangle.ts` | `strikeTriangle(ac, masterGain=1.0)`; F7 = 2793.83 Hz; 8 ms linear attack; 2.0 s exp decay to 0.001; `osc.stop(t + 2.1)`; sine type | ✓ VERIFIED | 31 lines. Single function exactly as D-05 specifies — frequency 2793.83 (line 22), `g.gain.linearRampToValueAtTime(0.4 * masterGain, t + 0.008)` (line 25), `g.gain.exponentialRampToValueAtTime(0.001, t + 2.0)` (line 26), `osc.stop(t + 2.1)` (line 29), type 'sine'. 9 envelope tests assert all params. |
| `src/engine/sounds/segmentSound.ts` | `fireSegmentEndSound(ac, key)` with `key: 'gentle' \| 'triangle'` (NOT 'alarm'); routes to `strikeBowl` for gentle, `strikeTriangle` for triangle | ✓ VERIFIED | 23 lines. Type signature deliberately excludes 'alarm' (carve-out per D-13 — alarm runs as multi-second sustain, not one-shot strike). Routing correct: line 17-20 dispatches `strikeBowl(ac, 1.0)` or `strikeTriangle(ac, 1.0)`. 3 routing tests pass. |
| `src/dev/SegmentHarness.tsx` | Renders WAKE_EASY_CONFIG with Start/Pause/Resume/Stop buttons; logs `onSegmentChange` events with `performance.now()` timestamps | ✓ VERIFIED | 165 lines. Instantiates `new SegmentEngine()` via lazy useRef pattern (lines 26-29). Registers `onSegmentChange` callback that pushes events with `performance.now()` timestamps to a DOM-table log (lines 36-47). Buttons: Start (line 92, calls `engine.start(WAKE_EASY_CONFIG)` — line 58), Pause (line 99), Resume (line 105), Stop (line 111), Clear log (line 117). Cleanup on unmount calls `engine.stop()` (line 51). |
| `src/App.tsx` | Single dev-mount line gated by `import.meta.env.DEV && URL ?dev=segments` | ✓ VERIFIED | Line 4: `import SegmentHarness from './dev/SegmentHarness'`. Lines 9-11: const `showSegmentHarness = import.meta.env.DEV && new URLSearchParams(window.location.search).get('dev') === 'segments'`. Lines 15-21: ternary branch wraps existing showCountdown/Dashboard logic with new SegmentHarness branch. Diff is 7 additions, 1 deletion (line 13: ternary opening rewrites). |
| `src/engine/index.ts` (barrel append) | D-24 exports added: SegmentEngine, Segment, SegmentConfig, SegmentEngineState, SegmentChangeEvent, validateSegmentConfig, WAKE_EASY_CONFIG, strikeTriangle | ✓ VERIFIED | Lines 32-41 contain all 8 D-24 additions. Pre-existing v1 exports (lines 1-30) byte-identical to baseline. Diff: 11 additions, 0 deletions. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `SegmentEngine.start()` | `validateSegmentConfig` | discriminated-union gate (D-11) | ✓ WIRED | Line 148 imports validator from SegmentState; line 148-151 calls and gates on `result.ok`; throws Error(result.error) per RESEARCH Open Q #2 (defense-in-depth). |
| `SegmentEngine.start()` | `startAlarmSession()` (Phase 6) | shared session lifecycle (D-07) | ✓ WIRED | Line 46 imports from `./AlarmSession`; line 159 awaits and assigns `this.session`. |
| `SegmentEngine.start()` | `scheduleAt()` (timer.ts) | absolute-epoch scheduling (D-16) | ✓ WIRED | Line 39 imports `scheduleAt`, `TimerHandle`; lines 170-177 register N absolute timers; `Date.now()` baseline captured at line 166. |
| `SegmentEngine.handleSegmentFire()` | `fireSegmentEndSound()` (gentle/triangle) | dispatcher (D-13) | ✓ WIRED | Line 45 imports; line 233 calls for non-alarm segments. |
| `SegmentEngine.handleSegmentFire()` | `createPhase3Ramp` + `startPhase3Swell` (alarm-segment) | v1 stack reuse (D-01) | ✓ WIRED | Lines 41-43 import; line 213 creates ramp with `segment.durationMs / 1000`; line 214 starts initial swell stack; line 215-227 sets up 3200 ms swell loop interval. |
| `SegmentEngine.cleanup()` | `endAlarmSession()` + `fadeOutGain()` | reverse-of-start ordering (Pitfall #4) | ✓ WIRED | Line 384-387 ends session; lines 391-394 clears alarmLoopTimer; lines 397-403 stops swell oscillators; line 408 fadeOutGain LAST step. |
| `App.tsx` | `SegmentHarness` (dev-only) | static import + DEV gate (D-15) | ✓ WIRED | Line 4 static import; lines 9-11 const; lines 15-16 ternary mount. Tree-shaken from production: `grep -r SegmentHarness dist/` returns no matches. |
| `SegmentHarness` | `SegmentEngine` | useRef-instantiated engine | ✓ WIRED | Line 2 imports class; lines 26-29 lazy useRef init; lines 58, 66, 71, 76 call start/pause/resume/stop. |
| `engine/index.ts` (barrel) | Phase 7 surface | append-only re-exports (D-24) | ✓ WIRED | Lines 32-41 re-export all 8 D-24-mandated symbols. Verified by `grep` and by successful test imports from `'../SegmentState'` and `'../SegmentEngine'`. |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `SegmentHarness.tsx` | `logs` (LogRow[]) | `engine.onSegmentChange` callback writing performance.now() + event payload | Yes — engine emits `start`/`end` events with real segment indexes from `WAKE_EASY_CONFIG.segments` | ✓ FLOWING |
| `SegmentHarness.tsx` | `stateLabel` (string) | `engine.getState()` after every callback fire | Yes — state machine transitions: idle → running → firing-alarm → dismissed | ✓ FLOWING |
| `SegmentEngine` | `this.timers[]` (TimerHandle[]) | `scheduleAt(epochBaseline + cumulative, callback)` calls in start() loop | Yes — N real TimerHandle entries; tests verify each fires its captured callback | ✓ FLOWING |
| `SegmentEngine` | `this.activeConfig` (SegmentConfig) | `result.config` from validateSegmentConfig | Yes — verified valid config flows from input through validator to runtime state | ✓ FLOWING |
| `SegmentEngine` (alarm path) | `this.alarmRampGain` (GainNode) | `createPhase3Ramp(this.ac, segment.durationMs / 1000)` | Yes — real Phase 3 gain node from existing v1 implementation; passed unchanged through teardown's `fadeOutGain` | ✓ FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes (320 tests across 27 files) | `npx vitest run` | 27/27 test files PASS, 320/320 tests PASS in 6.86s | ✓ PASS |
| TypeScript clean (no errors) | `npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| Production build succeeds | `npm run build` | tsc -b OK; vite build OK; injectManifest SW OK; 8 precache entries (223.92 KiB); built in 1.93s | ✓ PASS |
| SegmentHarness tree-shaken from production | `grep -r SegmentHarness dist/` | No matches | ✓ PASS (D-15 verified) |
| Wake Easy total = 17 min exact | `node -e "console.log(240000*4 + 60000)"` | 1_020_000 ms = 17 min exact | ✓ PASS |
| validateSegmentConfig never throws | `grep -c "throw " src/engine/SegmentState.ts` | 0 | ✓ PASS (SEG-04 strict contract) |
| SegmentEngine.test.ts coverage | (Vitest output) | 23 tests pass across 7 describe blocks: state machine, validation gate, absolute scheduling, segment fires + ordering, alarm segment, auto-stop, pause/resume snapshot, cleanup | ✓ PASS |
| triangle.test.ts coverage | (Vitest output) | 9 tests assert: function export, 1 osc + 1 gain per strike, frequency=2793.83, type=sine, attack=8ms to 0.4*masterGain, decay exp to 0.001 over 2.0s, start(t)/stop(t+2.1), masterGain scaling | ✓ PASS |
| validateSegmentConfig.test.ts coverage | (Vitest output) | 22 tests covering valid Wake Easy, minimal 1-segment, ceiling, all malformed inputs (null/undefined/primitive/missing/empty), all invalid durations (NaN/zero/negative/over-max/Infinity), invalid sound keys, invalid ids, never-throws contract on circular/null entries, first-failure-wins ordering | ✓ PASS |
| segmentSound.test.ts coverage | (Vitest output) | 3 routing tests: gentle → strikeBowl(ac, 1.0) only, triangle → strikeTriangle(ac, 1.0) only, AC passed by identity | ✓ PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SEG-01 | 07-02 | Segment data model with `id`/`durationMs`/`endSound: gentle\|triangle\|alarm` | ✓ SATISFIED | `SegmentState.ts:14-22` types `Segment` + `SegmentConfig`; barrel re-exports both. |
| SEG-02 | 07-04 | Absolute-epoch scheduling, AC.currentTime audio strikes, <2s drift over 17 min | ✓ SATISFIED (automated) / ? NEEDS MANUAL DRIFT TEST | `SegmentEngine.ts:170-177` absolute-epoch loop; strike audio via `ac.currentTime` in `strikeBowl`/`strikeTriangle`/`createPhase3Ramp`. Drift assertion at automated level via `scheduleAt` mock + `Date.now` spy. Real-time drift requires manual on-device run (see human_verification). |
| SEG-03 | 07-04 | Pause/resume snapshot semantics + alarm-tail pause-lock | ✓ SATISFIED | `SegmentEngine.ts:261-337` pause + resume; canPause() returns false in firing-alarm; 4 dedicated tests. |
| SEG-04 | 07-02 | Validator rejects malformed configs with user-readable error, never throws into runtime | ✓ SATISFIED | `SegmentState.ts:59-94` discriminated-union validator; 22 tests; 0 `throw` statements in file. SegmentEngine.start re-validates and throws Error(result.error) for direct callers (tests, harness) — this is the runtime gate, not the validator. |
| AUD-05 | 07-01 | Triangle synthesis, click-free attack ≥5ms, exp decay ~1-2s, fundamental ≥1 octave above dominant bowl partials | ✓ SATISFIED (automated) / ? NEEDS HEADPHONE LISTEN | `triangle.ts` per D-05 with frequency 2793.83 (above bowl floor 2076 Hz per reframed AUD-05 / D-06), 8 ms attack (>=5 ms), 2.0 s exp decay. Subjective click-free verification under headphones is post-phase manual check (see human_verification). |
| SEG-05 | 06 (continued) | v1 byte-identical (zero diff to AlarmEngine + 17 protected paths) | ✓ SATISFIED | `git diff` on all 17 protected paths since baseline `672d5bd` returns empty. Only diffs are App.tsx (1 import, 1 const, 1 ternary wrap — D-15 allowed) and engine/index.ts (11 lines appended after line 30 — D-24 append-only allowed). |

**Phase 7 traceability table in REQUIREMENTS.md (lines 154-158) marks SEG-01..04 + AUD-05 as Complete; this verification confirms.**

---

## Anti-Patterns Found

None. Spot-scanned all Phase 7 source files for:

| Pattern | Files Scanned | Result |
|---------|--------------|--------|
| TODO / FIXME / placeholder comments | SegmentEngine.ts, SegmentState.ts, triangle.ts, segmentSound.ts, SegmentHarness.tsx, all 4 test files | None |
| Empty implementations (return null/return {}/=> {}) | Same | None — every public method has a substantive body |
| Hardcoded empty data flowing to render | SegmentHarness.tsx | `logs` initial value `[]` is overwritten by useEffect-registered onSegmentChange callback (real data path verified in Data-Flow Trace) |
| console.log-only implementations | All Phase 7 files | None |
| Stub returns | All Phase 7 files | None |
| `throw` in validator (forbidden by SEG-04) | SegmentState.ts | 0 occurrences |
| Chained setTimeout (forbidden by SEG-02 / D-16) | SegmentEngine.ts | 0 — only `scheduleAt(absoluteEpochMs, cb)` and one `setTimeout` for D-04 auto-stop after final strike (single-shot, not chained) |

---

## Human Verification Required

Three items intentionally cannot be verified programmatically and are flagged as documented post-phase manual checks (mirroring the precedent set by Phase 6's `06-REGRESSION-CHECKLIST.md`).

### 1. SEG-02 #2 — 17-minute foreground desktop drift

**Test:**
1. Run dev server: `npm run dev`
2. Navigate to `http://localhost:<port>?dev=segments`
3. Click Start
4. Keep tab visible for full 17 minutes
5. Observe SegmentHarness DOM-table log

**Expected:** Segment-end events at `t ≈ 240_000`, `480_000`, `720_000`, `960_000` ms; segment-4 alarm `start` event at `t ≈ 1_020_000` ms. End-to-end deviation < 2 s.

**Why human:** Vitest fake timers eliminate real-clock drift by definition. The drift comes from real-world wall-clock advance and OS power management, both of which are not simulable.

### 2. SEG-02 #2 — 17-minute foreground Android Chrome drift

**Test:** Repeat the same procedure on an Android phone running Chrome with the tab in the foreground.

**Expected:** Same accuracy as desktop run.

**Optional sub-test:** Background the tab for several minutes mid-run; AlarmSession's keepalive + Wake Lock should keep scheduled fires within budget.

**Why human:** Android Chrome has different visibility-throttling behavior than desktop. Manual on-device verification is the only way to confirm SEG-02 holds in the foreground-mobile scenario.

### 3. AUD-05 (sub-criterion in Roadmap SC #4) — click-free perception under headphones

**Test:**
1. Run dev server, open the harness, click Start
2. With headphones at 50% system volume, listen to the first gentle-segment-end strike at `t ≈ 240_000` ms (boring — wait 4 minutes), OR temporarily reduce all WAKE_EASY_CONFIG segment durations to 5000 ms locally for quick auditioning

**Expected:** A single bright cohesive ping. NO audible click followed by a tone — the 8 ms attack envelope must mask the start transient.

**Why human:** Subjective audio quality cannot be asserted programmatically. Code-level click-freeness (≥5 ms attack, exp ramp) is verified; real-world perception is the final judge.

---

## Gaps Summary

**No gaps. All 5 Roadmap success criteria pass at the automated verification level.** Three sub-items (SEG-02 desktop drift, SEG-02 Android drift, AUD-05 click-free perception) are flagged for documented manual verification — these are activities that cannot be exercised in CI under fake timers / headless audio, and they follow the precedent of Phase 6's regression checklist (an on-device manual matrix appended to a phase that otherwise passes automated checks).

The SEG-05 zero-diff guarantee — v1 byte-identical AlarmEngine + AlarmConfig + AlarmSession + useAlarm + Countdown + ProgressRing + all existing sound files — passes the strictest test: `git diff --name-only 672d5bd..HEAD -- <17 paths>` returns empty.

The Phase 7 implementation is structurally sound:
- **Class shape:** SegmentEngine mirrors AlarmEngine field-for-field (private session, `_running`, `_paused`, timers[], audio teardown handles, pause snapshot, single-callback) per D-07.
- **Scheduling:** Absolute-epoch via `scheduleAt(epochBaseline + cumulative, …)` per D-16; never chained setTimeout.
- **State machine:** `'idle' → 'running' → ('firing-alarm' | 'dismissed')` with `canPause()` returning false during alarm-tail per D-03.
- **Cleanup ordering:** Verbatim 6-step sequence from AlarmEngine.cleanup() with phase3* → alarm* rename and Phase 2 vibration/tick blocks dropped, per Pitfall #4 ordering.
- **Alarm-segment reuse:** v1 Phase 3 stack (createPhase3Ramp + startPhase3Swell + 3200 ms swell loop + fadeOutGain) reused byte-identically per D-01.
- **Auto-stop:** Per-key decay window (gentle=6100 ms, triangle=2100 ms) per D-04.
- **Validator contract:** Discriminated union, never throws (SEG-04); engine.start re-validates as defense-in-depth.

---

## VERIFICATION PASSED — all 5 success criteria met (with the noted manual-verification annotations for SEG-02 #2 drift and AUD-05 perception, which are inherent to those criteria and cannot be exercised programmatically).

---

_Verified: 2026-05-09T22:55:00Z_
_Verifier: Claude (gsd-verifier)_
