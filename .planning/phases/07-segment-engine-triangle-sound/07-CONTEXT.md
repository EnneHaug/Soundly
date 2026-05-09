# Phase 7: Segment Engine + Triangle Sound - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a `SegmentEngine` (sibling to `AlarmEngine`) that schedules N segments with absolute-fire-time accuracy, dispatches one of three end-of-segment sounds (gentle / triangle / alarm), validates ill-formed configs without throwing, and supports mid-segment pause/resume. Synthesize a click-free triangle sound at exact F7 (2793.83 Hz). No UI in this phase — runtime is verified via tests + a dev-only browser harness.

**In scope:**
- `src/engine/SegmentEngine.ts` — new class mirroring AlarmEngine's shape (private `session: SessionHandle | null` field; `await startAlarmSession()` in `start()`; `endAlarmSession(this.session)` in `cleanup()` placed at the v1-teardown slot — per Phase 6 P02 STATE.md hint)
- `src/engine/SegmentState.ts` — types (`Segment`, `SegmentConfig`, `SegmentEngineState`) + `validateSegmentConfig` + `WAKE_EASY_CONFIG` (paired with `AlarmState.ts` for v1)
- `src/engine/sounds/triangle.ts` — `strikeTriangle(ac, masterGain = 1.0)` (the only addition under `src/engine/sounds/*.ts` per SEG-05 zero-diff)
- `src/engine/sounds/segmentSound.ts` — dispatch helper for `'gentle'` / `'triangle'` keys (alarm handled by SegmentEngine directly)
- `src/dev/SegmentHarness.tsx` — Vite-dev-mode-gated harness, removed in Phase 8 when `SegmentCountdown` ships
- Tests covering scheduling drift, pause/resume snapshot, validation, alarm-segment pause-lock, auto-stop semantics, triangle envelope

**Explicitly out of scope (SEG-05 zero-diff floor):**
- Any change to `AlarmEngine.ts`, `AlarmState.ts`, `AlarmSession.ts`, `AudioContext.ts`, `timer.ts`
- Any change to `useAlarm.ts`, `Countdown.tsx`, `ProgressRing.tsx`, `App.tsx`, or any v1 UI
- Any change to existing files under `src/engine/sounds/*.ts` (singingBowl, phase3Tone, keepalive, testSound, tickPulse) — only addition is `triangle.ts`
- Composer modal UI, Wake Easy preset card, share-via-URL, segment countdown UI (Phase 8/9)
- Concurrency guard between AlarmEngine and SegmentEngine — Phase 8 `useActiveAlarm` selector responsibility

</domain>

<decisions>
## Implementation Decisions

### Alarm-sound semantics

- **D-01 (LOCKED):** When a segment's `endSound` is `'alarm'`, SegmentEngine starts the v1 Phase 3 stack at **segment-start** (not tail). The segment's `durationMs` becomes the ramp duration: `createPhase3Ramp(durationMs / 1000)` + a 3.2-second-cycle looping `startPhase3Swell`. This is byte-identical to `AlarmEngine.enterPhase3` semantics — same nodes, same compressor chain, same loop interval — just hosted by SegmentEngine instead of AlarmEngine. No new nodes, no parameter overrides.
- **D-02 (LOCKED):** Once the alarm segment begins, the swell loop continues **past segment-end** indefinitely until the user calls `dismiss()` or `stop()`. The engine does **not** auto-stop on segment-list completion when the last segment is alarm-tailed.
- **D-03 (LOCKED):** Pause is **disabled** for the entire duration the alarm segment is firing. SegmentEngine exposes `canPause(): boolean` returning `false` while in `'firing-alarm'` state. `pause()` is a silent no-op when `!canPause()` (matches AlarmEngine's T-03-02 silent-no-op idiom for invalid pause states).
- **D-04 (LOCKED):** When the **last segment is gentle/triangle** (no alarm-tail), the engine **auto-stops** after the final tail strike's ~2s decay. `cleanup()` runs, `endAlarmSession(this.session)` ends the shared lifecycle, state transitions to `'dismissed'`. Phase 9 composer is free to require an alarm-tail for sleep alarms, but Phase 7 just implements auto-stop.

### Triangle sound (AUD-05)

- **D-05 (LOCKED):** Triangle synthesis: a single `OscillatorNode { type: 'sine', frequency: 2793.83 }` (exact F7 in equal temperament, A4=440 reference) routed through a `GainNode` envelope:
  - Peak gain: `0.4 * masterGain` (default `masterGain = 1.0`)
  - Attack: 8 ms `linearRampToValueAtTime` (click-free per AUD-05's ≥5 ms requirement)
  - Decay: 2.0 s `exponentialRampToValueAtTime` to 0.001
  - `osc.stop(t + 2.1)` (cleanly past decay end)
- **D-06 (LOCKED):** `AUD-05` was reframed in `.planning/REQUIREMENTS.md`: floor moved from "≥1 octave above ALL bowl partials (3006 Hz)" to "≥1 octave above the bowl's **dominant** partials (peak gain ≥0.10 — 220/607/1038 Hz, effective floor ~2076 Hz)." The bowl's quiet 1503 Hz partial (peak gain 0.06, at noise floor) is no longer a constraint — rationale: it is not a perceptible component of the bowl's timbre. F7 was chosen for its major-3rd-flavored interval against the bowl's A root, giving a warm cheerful ping. Auditioned vs F#7 (minor flavor) and G7 (suspended) — see `triangle-demo.html` for the auditioning artifact.

### SegmentEngine API surface (Claude's Discretion)

- **D-07:** Class shape mirrors AlarmEngine per Phase 6 P02 STATE.md: private `session: SessionHandle | null`, `_running: boolean`, `_paused: boolean`, `timers: TimerHandle[]`, segment audio teardown handles, pause snapshot. Methods: `start(config)`, `pause()`, `resume()`, `stop()`, `dismiss()`, `getState()`, `getCurrentSegment()`, `isPaused()`, `canPause()`, `onSegmentChange(cb)`.
- **D-08:** State enum: `type SegmentEngineState = 'idle' | 'running' | 'firing-alarm' | 'dismissed'`. `'firing-alarm'` is the state where `canPause()` returns false — entered when an alarm segment starts (D-01), exited only on `dismiss()` / `stop()`.
- **D-09:** `onSegmentChange(cb)` fires on every segment-boundary event with `{ kind: 'start' | 'end'; segmentIndex: number; totalSegments: number; segment: Segment }`. Single callback registered at a time (last-wins, matches `AlarmEngine.onPhaseChange`). The `'end'` event fires immediately before the strike is scheduled, so consumers can update next-segment-index UI while the strike rings.
- **D-10:** `getCurrentSegment(): { index: number; total: number; segment: Segment } | null` — null when state is `'idle'` or `'dismissed'`. Used by Phase 8 `SegmentCountdown` UI (out of scope here, but locked-in API to avoid Phase 8 churn).

### Validation (SEG-04 — Claude's Discretion on shape)

- **D-11:** `validateSegmentConfig(input: unknown): { ok: true; config: SegmentConfig } | { ok: false; error: string }`. Discriminated union. Single user-readable error string on failure (first failure wins — composer surfaces it inline). Never throws into the runtime per SEG-04. Runtime gate: `if (!result.ok) { /* surface to caller, do not start */ }`.
- **D-12:** Validation rules:
  - `segments` is a non-empty array
  - Each segment has `id: string` (non-empty), `durationMs: number` (finite, > 0, ≤ 14_400_000 — 4-hour ceiling matches AlarmConfig for consistency), `endSound: 'gentle' | 'triangle' | 'alarm'`
  - Unknown sound keys produce: `"Unknown sound key '<key>' in segment <index> — expected 'gentle', 'triangle', or 'alarm'"`
  - Empty/NaN/zero/negative durations produce: `"Segment <index> has invalid duration <value>ms — must be > 0 and ≤ 14400000"`
  - Empty list produces: `"Segment list is empty — at least one segment is required"`

### Sound dispatch architecture (Claude's Discretion)

- **D-13:** Dispatch helper `src/engine/sounds/segmentSound.ts` exports `fireSegmentEndSound(ac: AudioContext, key: 'gentle' | 'triangle'): void`:
  - `'gentle'` → `strikeBowl(ac, 1.0)` (existing v1 sound, byte-identical reuse)
  - `'triangle'` → `strikeTriangle(ac, 1.0)` (new in `triangle.ts`)
  - `'alarm'` is **NOT** routed through this helper — SegmentEngine handles alarm directly via `createPhase3Ramp` + `startPhase3Swell` because the ramp lifecycle is structurally different (multi-second sustain + loop, not a one-shot strike).

### Dev-only harness (Claude's Discretion)

- **D-14:** Harness ships as a Vite-dev-mode-gated React component: `src/dev/SegmentHarness.tsx`. Mounts when `import.meta.env.DEV && new URLSearchParams(location.search).get('dev') === 'segments'`. Renders `WAKE_EASY_CONFIG` with Start / Pause / Resume / Stop buttons + a console-style event log capturing `onSegmentChange` events with `performance.now()` timestamps. Used to verify the SEG-02 <2s drift requirement on foreground desktop and Android in real browser conditions. **Removed in Phase 8** when the production `SegmentCountdown` UI replaces it (recorded as Phase 8 first-task cleanup).
- **D-15:** Mounting integration is minimal: `App.tsx` adds a single line guarded by the same `import.meta.env.DEV && URL flag` check that dynamically imports and renders `SegmentHarness`. The line is removed alongside the harness in Phase 8. Production builds tree-shake the import via Vite's `import.meta.env.DEV` static replacement.

### Scheduling + drift (SEG-02)

- **D-16:** At `start()`, capture `Date.now()` once as `epochBaseline`. For each segment, compute its absolute fire epoch as `epochBaseline + sum(durations[0..i])`. Each fire time is registered with the existing `scheduleAt(absoluteEpochMs, callback)` from `src/engine/timer.ts` — **not** chained `setTimeout`. From inside each fire callback, audio uses `ac.currentTime` directly (sample-accurate). This delivers <250 ms wall-clock accuracy per timer + sample-accurate audio at fire instant; drift over the 17-min Wake Easy run stays well under the SEG-02 <2 s budget.
- **D-17:** Alarm-segment behavior diverges from gentle/triangle: at the alarm segment's *start* fire (not tail), the engine creates the Phase 3 stack and transitions state to `'firing-alarm'`. Audio scheduling uses `ac.currentTime` baseline at that moment for the ramp duration.

### Segment ID (Claude's Discretion)

- **D-18:** Engine treats `Segment.id` as opaque — used only for React keys (Phase 9 composer) and (future) URL serialization (Phase 9 SHR). Engine does **not** generate IDs. Composer is responsible for ID allocation. For Phase 7's harness fixture data, hardcode `'wake-easy-1'`, `'wake-easy-2'`, etc. via the `WAKE_EASY_CONFIG` constant.

### Pause/resume snapshot (SEG-03)

- **D-19:** Pause snapshot shape:
  ```ts
  interface SegmentPauseSnapshot {
    currentSegmentIndex: number;
    currentSegmentRemainingMs: number;
    futureSegmentDurationsMs: number[];
  }
  ```
- **D-20:** On `pause()`: cancel all pending timers, capture snapshot from current `epochBaseline`, allow any in-flight gentle/triangle decay envelope to finish naturally (do not abort the strike's exponential decay). On `resume()`: re-baseline `epochBaseline` to `Date.now()`, re-register timers from snapshot, fire `onSegmentChange` if needed to repaint UI state.
- **D-21:** Pause during `'firing-alarm'` state is silently rejected per D-03. The snapshot is never captured for an in-flight alarm; the user must dismiss to leave that state.

### Test/regression strategy (Claude's Discretion)

- **D-22:** Tests live in:
  - `src/engine/__tests__/SegmentEngine.test.ts` — primary engine regression net (Vitest fake timers + AC mock pattern from `AlarmEngine.test.ts:5–65`)
  - `src/engine/sounds/__tests__/triangle.test.ts` — triangle envelope (frequency=2793.83, attack=8 ms, decay=2.0 s, peak=0.4*masterGain)
  - `src/engine/__tests__/segmentSound.test.ts` — dispatch helper routing
  - `src/engine/__tests__/validateSegmentConfig.test.ts` — validation rules end-to-end
- **D-23:** Coverage matrix:
  - Validation: empty list / NaN / zero / negative / unknown sound key → `{ ok: false, error: <readable> }`; valid config → `{ ok: true, config }`
  - Scheduling: 5-segment Wake Easy fixture → all 5 fire epochs match expected absolute values
  - Pause snapshot during gentle segment: capture + resume restores remaining + future correctly
  - Pause snapshot during alarm segment: silently rejected; engine stays in `'firing-alarm'`
  - Auto-stop: gentle-tailed composition self-terminates after final strike's decay
  - Alarm-tailed: continues looping past segment-end until manual `dismiss()`
  - SEG-05 zero-diff: assert no edits to v1 file paths (CI grep guard or explicit file-list assertion)

### Barrel exports

- **D-24:** `src/engine/index.ts` adds:
  ```ts
  export { SegmentEngine } from './SegmentEngine';
  export type { Segment, SegmentConfig, SegmentEngineState, SegmentChangeEvent } from './SegmentState';
  export { validateSegmentConfig, WAKE_EASY_CONFIG } from './SegmentState';
  export { strikeTriangle } from './sounds/triangle';
  ```
  Existing AlarmEngine + v1 exports stay byte-identical.

### Claude's Discretion (further)

- Exact internal field names, exact wording of validation error strings (subject to a final pass for tone consistency).
- Whether `triangle.ts` exposes additional helper fns or stays as the single `strikeTriangle`.
- Test file split granularity (per-area vs combined).
- Whether the harness logs to a DOM table or only to console.
- The exact App.tsx mount-point line wording for the dev harness; whether it uses dynamic `import()` or static import (recommend dynamic to keep production bundle clean even before tree-shake).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project / milestone
- `.planning/PROJECT.md` — milestone v2.0 scope; v1 zero-diff posture
- `.planning/REQUIREMENTS.md` — SEG-01..04, **AUD-05** (reframed by D-06 above), SEG-05 zero-diff requirement
- `.planning/ROADMAP.md` §"Phase 7: Segment Engine + Triangle Sound" — goal + 5 success criteria + locked architectural decisions; §"Phase 8" + §"Phase 9" for downstream API consumers
- `.planning/STATE.md` — accumulated decisions, esp. "v1 zero-diff guarantee (SEG-05) is a hard floor across Phases 6–11" and Phase 6 P02 "Class-as-AlarmSession-consumer pattern" hint
- `CLAUDE.md` — stack constraints, raw Web Audio API mandate, `OscillatorNode` factory pattern, Wake Lock + Vibration + Notifications API caveats

### Prior-phase context
- `.planning/phases/01-audio-engine-and-timer/01-CONTEXT.md` — AlarmEngine origin, factory pattern decision (`OscillatorNode` cannot restart), AC singleton design
- `.planning/phases/05-ios-audio-loudness-fixes/05-CONTEXT.md` — Phase 3 ramp parameters (compressor threshold -24 dB, 3 detuned voices at 1000/1003/1007 Hz, AM ±0.35 around 0.65) — these are reused unchanged by D-01's alarm-segment behavior
- `.planning/phases/06-alarmsession-refactor-v1-regression-guard/06-CONTEXT.md` — `AlarmSession` API (D-01..D-08); the Phase 6 P02 STATE.md note that "Phase 7 SegmentEngine should mirror AlarmEngine's shape: private `session` field, `await startAlarmSession()` in lifecycle entry, guarded `endAlarmSession(this.session); this.session = null` in cleanup placed in the OLD v1-teardown slot"

### Files consumed unchanged by Phase 7
- `src/engine/AlarmSession.ts:72` — `startAlarmSession()` / `endAlarmSession(handle)` pair (Phase 6 D-01)
- `src/engine/AudioContext.ts` — `getAudioContext()` (consumed transitively via AlarmSession)
- `src/engine/timer.ts:34` — `scheduleAt(absoluteEpochMs, callback)` — segment-boundary scheduling primitive (D-16)
- `src/engine/sounds/singingBowl.ts:68` — `strikeBowl(ac, masterGain)` — `'gentle'` end-of-segment dispatch target (D-13)
- `src/engine/sounds/phase3Tone.ts:46/83/137` — `createPhase3Ramp` + `startPhase3Swell` + `fadeOutGain` — `'alarm'` segment behavior reused identically (D-01)
- `src/engine/AlarmEngine.ts` — read-only reference for the class-shape pattern (D-07) and Phase 3 cleanup ordering (D-01); this file is **not** modified

### Files protected by SEG-05 (zero-diff floor)
- `src/engine/AlarmEngine.ts`, `src/engine/AlarmState.ts`, `src/engine/AlarmSession.ts`, `src/engine/AudioContext.ts`, `src/engine/timer.ts`
- `src/hooks/useAlarm.ts`, `src/components/Countdown.tsx`, `src/components/ProgressRing.tsx`
- All existing `src/engine/sounds/*.ts` (singingBowl, phase3Tone, keepalive, testSound, tickPulse) — only addition is `triangle.ts`
- `src/platform/wakeLock.ts`, `src/platform/vibration.ts`, `src/platform/notifications.ts` — consumed transitively, not modified

### Files created by this phase
- `src/engine/SegmentEngine.ts` — new class
- `src/engine/SegmentState.ts` — types + `validateSegmentConfig` + `WAKE_EASY_CONFIG`
- `src/engine/sounds/triangle.ts` — `strikeTriangle(ac, masterGain = 1.0)`
- `src/engine/sounds/segmentSound.ts` — `fireSegmentEndSound(ac, key)` dispatch helper
- `src/dev/SegmentHarness.tsx` — dev-only harness (removed in Phase 8)
- `src/engine/__tests__/SegmentEngine.test.ts`, `src/engine/sounds/__tests__/triangle.test.ts`, `src/engine/__tests__/segmentSound.test.ts`, `src/engine/__tests__/validateSegmentConfig.test.ts`

### Phase 7 audition artifact
- `.planning/phases/07-segment-engine-triangle-sound/triangle-demo.html` — interactive sound auditioning preserved as historical record of why F7 won (over F#7 minor + G7 suspended) and the AUD-05 floor reframing reasoning

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets (consumed unchanged)
- `startAlarmSession()` / `endAlarmSession(handle)` (`src/engine/AlarmSession.ts:72`) — full lifecycle for AC + keepalive + Wake Lock + visibility re-acquire (D-07)
- `scheduleAt(targetEpochMs, callback)` (`src/engine/timer.ts:34`) — drift-free wall-clock scheduling primitive (D-16)
- `strikeBowl(ac, masterGain = 1.0)` (`src/engine/sounds/singingBowl.ts:68`) — `'gentle'` end-of-segment dispatch target (D-13)
- `createPhase3Ramp(ac, durationSec)` + `startPhase3Swell(ac, masterGain)` + `fadeOutGain(gain, ac)` (`src/engine/sounds/phase3Tone.ts:46 / 83 / 137`) — `'alarm'` segment behavior reused identically (D-01); SegmentEngine teardown calls `fadeOutGain` on the ramp gain to avoid clicks per pitfall #4

### Established patterns
- Class with private fields, `_running` reentrancy guard, separate `_paused` flag, `TimerHandle[]` for pending fires — mirror `AlarmEngine` exactly (D-07)
- `OscillatorNode` factory pattern (single-use, cannot restart after `.stop()`) — applies to `triangle.ts` strike + the alarm-segment swell loop
- AudioContext mock pattern in tests (see `AlarmEngine.test.ts:5–65`) — reuse verbatim for SegmentEngine + sound tests
- Single-callback-last-wins idiom (`AlarmEngine.onPhaseChange`) — adopted as `onSegmentChange` (D-09)
- Silent no-op for invalid pause states (`AlarmEngine.pause` T-03-02 idiom) — adopted for `pause()` while `canPause()` is false (D-03)

### Integration points
- `src/engine/index.ts` — append exports per D-24
- `src/App.tsx` — add a single dev-only mount line for the harness (D-15); removed in Phase 8
- No changes to `src/hooks/useAlarm.ts`, `src/components/*`, or any v1 UI surface

### Pre-existing v1 quirks NOT addressed in Phase 7
- `acquireWakeLock` `_sentinel` overwrite (Phase 6 deferred) — still deferred; SegmentEngine inherits this via AlarmSession but doesn't trigger it (single SegmentEngine, single AlarmEngine, only one active per Phase 8 `useActiveAlarm`)
- iOS AudioContext resume on visibility change (Phase 6 deferred) — still deferred

</code_context>

<specifics>
## Specific Ideas

- **Suggested `triangle.ts` shape (final params per D-05):**
  ```ts
  export function strikeTriangle(ac: AudioContext, masterGain = 1.0): void {
    const t = ac.currentTime;
    const osc = new OscillatorNode(ac, { type: 'sine', frequency: 2793.83 });
    const g = new GainNode(ac, { gain: 0 });
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.4 * masterGain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
    osc.connect(g).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 2.1);
  }
  ```

- **Suggested validation result type:**
  ```ts
  export type SegmentValidationResult =
    | { ok: true; config: SegmentConfig }
    | { ok: false; error: string };
  ```

- **WAKE_EASY_CONFIG (used by Phase 7 harness + Phase 8 preset card):**
  ```ts
  export const WAKE_EASY_CONFIG: SegmentConfig = {
    segments: [
      { id: 'wake-easy-1', durationMs: 240_000, endSound: 'gentle' },
      { id: 'wake-easy-2', durationMs: 240_000, endSound: 'gentle' },
      { id: 'wake-easy-3', durationMs: 240_000, endSound: 'gentle' },
      { id: 'wake-easy-4', durationMs: 240_000, endSound: 'gentle' },
      { id: 'wake-easy-5', durationMs:  60_000, endSound: 'alarm'  },
    ],
  };
  ```

- **Wake Easy timing sanity-check:** 4×4 min + 1×1 min = 17 min total. Alarm segment fires from t=16:00 (segment 5 start) ramping to 100% at t=17:00, then loops indefinitely until manual dismiss.

- **Suggested SegmentEngine signature sketch:**
  ```ts
  export class SegmentEngine {
    private session: SessionHandle | null = null;
    private ac: AudioContext | null = null;
    private state: SegmentEngineState = 'idle';
    private _running = false;
    private _paused = false;
    private timers: TimerHandle[] = [];
    private currentIdx: number = -1;
    private epochBaseline: number = 0;
    private activeConfig: SegmentConfig | null = null;
    private pauseSnapshot: SegmentPauseSnapshot | null = null;
    private alarmRampGain: GainNode | null = null;
    private alarmSwellNodes: OscillatorNode[] | null = null;
    private alarmLoopTimer: ReturnType<typeof setInterval> | null = null;
    private segmentChangeCb: ((e: SegmentChangeEvent) => void) | null = null;

    async start(config: SegmentConfig): Promise<void> { /* ... */ }
    pause(): void { /* silent no-op when !canPause() */ }
    resume(): void { /* ... */ }
    stop(): void { /* ... */ }
    dismiss(): void { /* ... */ }
    getState(): SegmentEngineState { return this.state; }
    getCurrentSegment(): { index: number; total: number; segment: Segment } | null { /* ... */ }
    isPaused(): boolean { return this._paused; }
    canPause(): boolean { return this.state !== 'firing-alarm' && this._running && !this._paused; }
    onSegmentChange(cb: (e: SegmentChangeEvent) => void): void { this.segmentChangeCb = cb; }
    private cleanup(): void { /* mirrors AlarmEngine.cleanup ordering */ }
  }
  ```

- **Suggested `App.tsx` dev-mount line (D-15):**
  ```tsx
  {import.meta.env.DEV && new URLSearchParams(window.location.search).get('dev') === 'segments' && (
    <SegmentHarness />
  )}
  ```
  with `import SegmentHarness from './dev/SegmentHarness'` (or lazy via `React.lazy`).

</specifics>

<deferred>
## Deferred Ideas

- **Per-segment volume control** — REQUIREMENTS.md "Future v2.x"; no scope creep into Phase 7.
- **Drag-and-drop reorder** — locked out of v2.0 by ROADMAP.
- **Visual segment timeline preview** — Phase 9 composer concern.
- **Multi-active SegmentEngine + AlarmEngine concurrency guard** — Phase 8 (`useActiveAlarm` selector) responsibility per ROADMAP.
- **Color-coded segment cards** — Phase 9 UI concern.
- **iOS `AudioContext.resume()` on visibilitychange** — Phase 6 deferred; still deferred; would benefit segment runtime equally.
- **`acquireWakeLock` sentinel overwrite fix** — Phase 6 deferred; still deferred; single-active-engine assumption keeps it dormant.
- **Save-as-preset for custom compositions** — REQUIREMENTS.md "Future"; conflicts with v1 no-persistence decision.
- **Triangle sound parameter exploration beyond F7** — F#7 (minor flavor) and G7 (suspended) auditioned and explicitly rejected; if a future user-research pass calls for re-exploration, the historical demo artifact at `.planning/phases/07-segment-engine-triangle-sound/triangle-demo.html` is preserved.
- **Per-segment volume on the alarm segment specifically** — alarm currently locks to v1 Phase 3 master ramp 0→1.0 (D-01); a future variant could allow lower peaks for "soft alarm" use cases.

</deferred>

---

*Phase: 07-segment-engine-triangle-sound*
*Context gathered: 2026-05-09*
