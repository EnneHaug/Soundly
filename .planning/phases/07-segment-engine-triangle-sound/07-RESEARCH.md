# Phase 7: Segment Engine + Triangle Sound — Research

**Researched:** 2026-05-09
**Domain:** Web Audio synthesis + segment scheduling state machine + Vitest fake-timer instrumentation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from 07-CONTEXT.md)

### Locked Decisions

The following are LOCKED by the user (D-01 through D-06, plus D-22 partial). Research does NOT explore alternatives:

- **D-01 (LOCKED):** When a segment's `endSound` is `'alarm'`, SegmentEngine starts the v1 Phase 3 stack at **segment-start** (not tail). The segment's `durationMs` becomes the ramp duration: `createPhase3Ramp(durationMs / 1000)` + a 3.2-second-cycle looping `startPhase3Swell`. Byte-identical to `AlarmEngine.enterPhase3` semantics — same nodes, same compressor chain, same loop interval.
- **D-02 (LOCKED):** Once the alarm segment begins, the swell loop continues **past segment-end** indefinitely until the user calls `dismiss()` or `stop()`. No auto-stop on segment-list completion when last segment is alarm-tailed.
- **D-03 (LOCKED):** Pause is **disabled** while the alarm segment is firing. `canPause(): boolean` returns `false` while in `'firing-alarm'` state. `pause()` is a silent no-op when `!canPause()` (matches AlarmEngine T-03-02 idiom).
- **D-04 (LOCKED):** When the **last segment is gentle/triangle** (no alarm-tail), the engine **auto-stops** after the final tail strike's ~2 s decay. `cleanup()` runs, `endAlarmSession(this.session)` ends the shared lifecycle, state transitions to `'dismissed'`.
- **D-05 (LOCKED):** Triangle synthesis: `OscillatorNode { type: 'sine', frequency: 2793.83 }` (exact F7 in equal temperament, A4=440 reference) → `GainNode` envelope. Peak `0.4 * masterGain` (default `1.0`). Attack 8 ms `linearRampToValueAtTime`. Decay 2.0 s `exponentialRampToValueAtTime(0.001, t + 2.0)`. `osc.stop(t + 2.1)`.
- **D-06 (LOCKED):** AUD-05 floor reframed to "≥1 octave above bowl's **dominant** partials (peak gain ≥0.10 — 220/607/1038 Hz, effective floor ~2076 Hz)." 1503 Hz quiet partial (peak gain 0.06) no longer constrains.

### Claude's Discretion (research recommends)

- D-07..D-24: SegmentEngine class shape, state enum, validation result type, dispatch architecture, dev harness, scheduling primitive choice, segment ID semantics, pause snapshot shape, test split, barrel exports — these are decisions where research recommends but user has set the boundaries.
- Internal field names, exact validation error string wording, whether `triangle.ts` exposes helpers beyond `strikeTriangle`, harness logging style (DOM vs console), App.tsx mount-line static-vs-dynamic-import.

### Deferred Ideas (OUT OF SCOPE)

- Per-segment volume control
- Drag-and-drop reorder
- Visual segment timeline preview
- Multi-active SegmentEngine + AlarmEngine concurrency guard (Phase 8 `useActiveAlarm` responsibility)
- Color-coded segment cards
- iOS `AudioContext.resume()` on visibilitychange (Phase 6 deferred)
- `acquireWakeLock` sentinel overwrite fix (Phase 6 deferred)
- Save-as-preset
- Triangle parameter exploration beyond F7
- Per-segment volume on alarm segments

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **SEG-01** | `Segment = { id, durationMs, endSound: 'gentle' \| 'triangle' \| 'alarm' }`; `validateSegmentConfig` rejects malformed configs without throwing | §"SegmentState type design" + §"Validation result discriminated union" — `{ ok: true, config } \| { ok: false, error }`; engine calls validator pre-`start()` and refuses to start on `ok: false` |
| **SEG-02** | Absolute scheduling (no chained setTimeout); audio strikes scheduled vs `AudioContext.currentTime`; <2 s drift over 17-min Wake Easy | §"Scheduling architecture" + §"Drift verification strategy" — reuse `scheduleAt(absEpoch, cb)` from `src/engine/timer.ts:34` for boundaries; audio uses `ac.currentTime` from inside callback (sample-accurate) |
| **SEG-03** | Pause/resume snapshot mid-segment; pause disabled during alarm segment | §"Pause snapshot semantics" — `{ currentSegmentIndex, currentSegmentRemainingMs, futureSegmentDurationsMs[] }`; `canPause()` gates state-machine transitions |
| **SEG-04** | Validation surfaces user-readable errors; never throws into runtime | §"Validation result discriminated union" — discriminated union return; runtime gate `if (!result.ok) refuse to start` |
| **AUD-05** | Triangle: ≥5 ms click-free attack, ~1–2 s decay, ≥1 octave above bowl's dominant partials | §"Triangle synthesis (D-05 implementation notes)" — F7=2793.83 Hz, 8 ms attack, 2.0 s exp decay, peak `0.4 * masterGain`. Floor reframed by D-06; 2793.83 > 2076 Hz floor. |

</phase_requirements>

## Summary

Phase 7 is an additive engine + new sound + dev harness. CONTEXT.md is unusually complete — D-01 through D-24 lock virtually every architectural choice. Research effort focuses on **de-risking the implementation mechanics** the planner needs to write tasks against:

1. **Test-mock incantations** — the existing `AlarmEngine.test.ts:5–65` pattern is verbatim-copyable. The `await Promise.resolve(); await startPromise;` microtask flush is required before `vi.advanceTimersByTime()`. The mock returns `currentTime: 0` and never advances it; tests assert call ordering, not sample-accurate scheduling.
2. **Drift in tests is a fiction** — drift is a real-world property owned by `timer.ts` (already tested for `<250 ms` per ALM-04). SegmentEngine tests should assert that `scheduleAt()` is called with the correct absolute epochs, NOT advance fake timers for 17 minutes. Real-world `<2 s` drift verification belongs to the dev harness (D-14).
3. **Alarm-segment teardown ordering** — the exact 7-step sequence from `AlarmEngine.cleanup()` (lines 354–407) must be replicated **verbatim** in `SegmentEngine.cleanup()`. The order matters: timer.cancel → endAlarmSession → stopVibration (no-op) → tickLoop clear (no-op) → swell loop clear → swell osc stop → fadeOutGain.
4. **`import.meta.env.DEV` tree-shaking is verified** — Vite v6 statically replaces and dead-code-eliminates the production branch. Static import is sufficient; dynamic `import()` is a belt-and-braces extra not strictly needed.
5. **Strike timing mismatch is bounded by ~250 ms** — `scheduleAt()` fires within 250 ms of target wall-clock; from inside the callback, `strikeBowl(ac, 1.0)` reads `ac.currentTime` directly (sample-accurate). Worst-case mismatch is the 250 ms timer jitter. This is well within SEG-02's <2 s budget.
6. **Pause-during-alarm-segment is structurally simple** — entering `'firing-alarm'` state flips `canPause() → false`. `pause()` checks first thing and returns silently. No snapshot is captured. State stays `'firing-alarm'` until `dismiss()`/`stop()`.

**Primary recommendation:** Mirror `AlarmEngine` shape, mock pattern, and cleanup ordering byte-for-byte. The novelty is in (a) validation discriminated union, (b) segment-boundary callback fan-out, (c) the harness — all of which are well-tracked.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Segment scheduling (absolute epochs) | Engine module (`SegmentEngine`) | Timer primitive (`timer.ts:34`, unchanged) | Engine owns state machine; `scheduleAt` owns drift-free wall-clock fire |
| Audio synthesis (triangle, gentle, alarm) | Sound modules (`triangle.ts` new, `singingBowl.ts`/`phase3Tone.ts` reused) | Engine | Sound modules are pure factories; engine orchestrates |
| Dispatch routing (key → sound fn) | Sound dispatch helper (`segmentSound.ts` new) | Engine | Engine calls dispatcher for gentle/triangle; alarm bypasses dispatcher (D-13) because it needs ramp+loop, not one-shot |
| Validation | State module (`SegmentState.ts` new) | Engine (gates on result) | Pure function; never throws (SEG-04) |
| Lifecycle (AC + keepalive + Wake Lock + visibility) | `AlarmSession` (Phase 6, unchanged) | Engine consumes via handle | Phase 6 P02 STATE.md hint locked this pattern |
| Pause/resume snapshot | Engine | — | State-machine concern |
| Dev verification harness | React dev component (`SegmentHarness.tsx` new) | App.tsx mount-line | Vite-DEV-gated; tree-shaken in prod |

---

## Standard Stack

### Core (already locked by CLAUDE.md)

| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| React | 19.x [VERIFIED: package.json `^19.0.0`] | Dev harness only | No new components in production bundle |
| Vite | 6.x [VERIFIED: package.json `^6.0.5`] | Build, `import.meta.env.DEV` tree-shaking | Statically replaced + DCE'd in prod [CITED: vite.dev/guide/env-and-mode] |
| TypeScript | ~5.6.2 [VERIFIED: package.json] | Strict-mode types incl. discriminated unions | `strict: true` standard |
| Vitest | ^3.1.2 [VERIFIED: package.json] | Test runner with fake timers | `vi.useFakeTimers()` + `vi.advanceTimersByTime` |
| Web Audio API (raw) | native | Triangle synth (`OscillatorNode`/`GainNode`); reuse v1 helpers for alarm segment | Per CLAUDE.md: no Tone.js |

### No new dependencies

Phase 7 adds **zero npm dependencies**. Everything is consumed from the existing tree (`AlarmSession`, `timer`, `singingBowl`, `phase3Tone`, AudioContext singleton).

---

## Architecture Patterns

### System Architecture Diagram

```
                ┌────────────────────────────────┐
   user gesture │ SegmentEngine.start(config)    │
   (click)  ──> │  ↓ validateSegmentConfig       │  D-11
                │  ↓ if !ok return early         │  D-11
                │  ↓ await startAlarmSession()   │──> AlarmSession (Phase 6, unchanged)
                │     ← session: {ac}            │     ↑ owns: AC bring-up, keepalive,
                │  ↓ epochBaseline = Date.now()  │       Wake Lock, visibility re-acquire
                │  ↓ for each segment:           │
                │      scheduleAt(absEpoch, fire)│──> timer.ts:34 scheduleAt
                └────────────────────────────────┘
                              │
              segment fire ───┤
                              ▼
              ┌─────────────────────────────────────┐
              │  fire callback (per segment)        │
              │  if endSound ∈ {gentle, triangle}:  │  D-13
              │     onSegmentChange({end, idx})     │
              │     fireSegmentEndSound(ac, key)    │──> strikeBowl OR strikeTriangle
              │     onSegmentChange({start, idx+1}) │       (uses ac.currentTime)
              │     if last segment: schedule       │
              │       auto-stop(decay+ε)            │  D-04
              │  if endSound == 'alarm':            │  D-01
              │     state ← 'firing-alarm'          │
              │     ramp = createPhase3Ramp(dur/1k) │
              │     swell = startPhase3Swell(...)   │
              │     setInterval(loop, 3200)         │
              │     (runs until dismiss/stop)       │  D-02
              └─────────────────────────────────────┘
                              │
            user dismiss/stop ┤
                              ▼
              ┌─────────────────────────────────────┐
              │  cleanup() — ORDER MATTERS          │  see §"Alarm-segment teardown
              │  1. _running=false; _paused=false   │     ordering (verbatim from
              │  2. timers.forEach(cancel)          │     AlarmEngine.cleanup)"
              │  3. endAlarmSession(this.session)   │
              │  4. swell loop clearInterval        │
              │  5. swell osc.stop() each (try{})   │
              │  6. fadeOutGain(rampGain, ac)       │
              │  7. setPhase('dismissed')           │
              └─────────────────────────────────────┘

  Dev-only side branch:
              ┌─────────────────────────────────────┐
              │ SegmentHarness.tsx (Vite DEV only)  │  D-14, D-15
              │  - Mount when                       │
              │    import.meta.env.DEV &&           │
              │    URL ?dev=segments                │
              │  - Buttons: Start / Pause / Resume  │
              │    / Stop                           │
              │  - Logs onSegmentChange events with │
              │    performance.now()                │
              │  - REMOVED in Phase 8               │
              └─────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── engine/
│   ├── SegmentEngine.ts            (NEW)  class SegmentEngine
│   ├── SegmentState.ts             (NEW)  Segment, SegmentConfig, SegmentEngineState,
│   │                                      SegmentChangeEvent, SegmentValidationResult,
│   │                                      validateSegmentConfig, WAKE_EASY_CONFIG
│   ├── sounds/
│   │   ├── triangle.ts             (NEW)  strikeTriangle(ac, masterGain=1.0)
│   │   ├── segmentSound.ts         (NEW)  fireSegmentEndSound(ac, 'gentle'|'triangle')
│   │   └── ... (singingBowl, phase3Tone, keepalive, testSound, tickPulse — UNCHANGED)
│   ├── __tests__/
│   │   ├── SegmentEngine.test.ts        (NEW)
│   │   ├── segmentSound.test.ts         (NEW)
│   │   └── validateSegmentConfig.test.ts(NEW)
│   ├── sounds/__tests__/
│   │   └── triangle.test.ts             (NEW)
│   ├── index.ts                    (MODIFIED — barrel additions per D-24)
│   └── ... (AlarmEngine.ts, AlarmState.ts, AlarmSession.ts, timer.ts, AudioContext.ts — UNCHANGED)
├── dev/
│   └── SegmentHarness.tsx          (NEW)  Vite-DEV-gated, removed in Phase 8
└── App.tsx                         (MODIFIED — single dev-mount line, removed in Phase 8)
```

### Pattern 1: Class-as-AlarmSession-consumer (D-07 / Phase 6 P02)

**What:** SegmentEngine mirrors AlarmEngine's class shape exactly — private `session: SessionHandle | null`, `await startAlarmSession()` in `start()`, `endAlarmSession(this.session); this.session = null` in `cleanup()` placed at the v1-teardown slot (after timer-cancel, before audio teardown).

**When to use:** Every segment-mode entry into the alarm runtime.

**Example:**
```typescript
// Source: src/engine/AlarmEngine.ts:104, src/engine/AlarmEngine.ts:368
async start(config: SegmentConfig): Promise<void> {
  const result = validateSegmentConfig(config);
  if (!result.ok) {
    throw new Error(result.error); // OR return early — see Open Questions below
  }

  if (this._running) {
    throw new Error('SegmentEngine already running');
  }
  this._running = true;

  this.session = await startAlarmSession();
  this.ac = this.session.ac;
  // ... epoch baseline, scheduleAt loop ...
}

private cleanup(): void {
  this._running = false;
  this._paused = false;
  this.pauseSnapshot = null;
  this.activeConfig = null;

  this.timers.forEach((t) => t.cancel());
  this.timers = [];

  if (this.session) {
    endAlarmSession(this.session);
    this.session = null;
  }

  // ... segment-specific audio teardown (alarm ramp + swell loop) ...
}
```

### Pattern 2: Discriminated-union validation result (D-11)

**What:** `validateSegmentConfig` never throws. Returns either `{ ok: true; config }` or `{ ok: false; error: string }`. The runtime guards on `result.ok` before calling `start()` (or composer surfaces the error inline).

**Example:**
```typescript
// In SegmentState.ts:
export type SegmentValidationResult =
  | { ok: true; config: SegmentConfig }
  | { ok: false; error: string };

export function validateSegmentConfig(input: unknown): SegmentValidationResult {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Config must be an object' };
  const cfg = input as Partial<SegmentConfig>;
  if (!Array.isArray(cfg.segments) || cfg.segments.length === 0) {
    return { ok: false, error: 'Segment list is empty — at least one segment is required' };
  }
  for (let i = 0; i < cfg.segments.length; i++) {
    const seg = cfg.segments[i];
    // ... per-segment checks → return first failure
  }
  return { ok: true, config: cfg as SegmentConfig };
}
```

### Pattern 3: OscillatorNode factory (CLAUDE.md mandate)

**What:** `OscillatorNode` cannot restart after `.stop()`. Every strike or swell-loop cycle creates fresh nodes via `new OscillatorNode(ac, {...})`.

**When to use:** Every audio fire — `strikeTriangle`, the alarm-segment swell loop body.

**Example (triangle, exactly per D-05):**
```typescript
// src/engine/sounds/triangle.ts (new)
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

### Pattern 4: Single-callback last-wins (D-09, mirrors AlarmEngine.onPhaseChange)

```typescript
private segmentChangeCb: ((e: SegmentChangeEvent) => void) | null = null;

onSegmentChange(cb: (e: SegmentChangeEvent) => void): void {
  this.segmentChangeCb = cb;
}

private fireChange(e: SegmentChangeEvent): void {
  this.segmentChangeCb?.(e);
}
```

### Pattern 5: Silent no-op on invalid pause state (D-03, mirrors AlarmEngine.pause T-03-02)

```typescript
canPause(): boolean {
  return this.state !== 'firing-alarm' && this._running && !this._paused;
}

pause(): void {
  if (!this.canPause()) return;  // silent no-op
  // ... snapshot + cancel timers
}
```

### Anti-Patterns to Avoid

- **Chained `setTimeout`** for segment boundaries — accumulates drift. Use `scheduleAt(absoluteEpoch, cb)` per SEG-02.
- **Reading `Date.now()` for audio scheduling** — use `ac.currentTime` instead (sample-accurate). Boundary fires use `Date.now()` against `epochBaseline`; audio uses `ac.currentTime`.
- **Throwing from validator** — SEG-04 explicitly forbids; never `throw new Error()` in `validateSegmentConfig`.
- **Multiple registered callbacks for `onSegmentChange`** — last-wins idiom matches AlarmEngine; do NOT introduce array-of-callbacks fanout.
- **`_sentinel = ...` reassignment in wakeLock** — pre-existing v1 bug (Phase 6 deferred). Do NOT fix in Phase 7. Single-active-engine assumption keeps it dormant.
- **Modifying any file under SEG-05 zero-diff** — see §"Project Constraints (from CLAUDE.md)".

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AC bring-up + keepalive + Wake Lock + visibility | New session boilerplate | `startAlarmSession()` / `endAlarmSession()` from Phase 6 | Already proven in v1 + Phase 6 byte-identity; SEG-05 protects v1 path |
| Drift-free wall-clock timer | New `setTimeout` chain | `scheduleAt(absEpoch, cb)` from `src/engine/timer.ts:34` | Already `<250 ms` accurate per ALM-04, tested |
| Singing bowl synthesis | Reimplement bowl in segmentSound | `strikeBowl(ac, 1.0)` from `src/engine/sounds/singingBowl.ts:68` | Byte-identical reuse per D-13 |
| Phase 3 alarm tone | New synthesis | `createPhase3Ramp` + `startPhase3Swell` + `fadeOutGain` from `phase3Tone.ts` | D-01 explicit reuse; iOS loudness work already done in Phase 5 |
| AudioContext singleton | New `new AudioContext()` | `getAudioContext()` (consumed transitively via AlarmSession) | iOS audioSession.type='playback' fix lives there (Phase 5 D-01) |
| Date library | date-fns / Day.js | `Date.now() + sum(durations[0..i])` | Per CLAUDE.md "NOT needed" |

**Key insight:** Phase 7's job is composition, not invention. Every primitive needed already exists, tested, and lives in a SEG-05-protected file. The new files are pure additions: SegmentEngine.ts (orchestrator), SegmentState.ts (types + validator), triangle.ts (one new sound), segmentSound.ts (3-line dispatcher).

---

## Implementation Patterns + Landmines

### Vitest fake-timer + AudioContext mock interaction

The existing pattern from `AlarmEngine.test.ts:5–65` is **directly reusable** for SegmentEngine. Copy verbatim. Specifics:

**The microtask-flush idiom (REQUIRED):**
```typescript
// Source: src/engine/__tests__/AlarmEngine.test.ts:67-75
async function startEngine(engine: SegmentEngine, config = WAKE_EASY_CONFIG): Promise<void> {
  const startPromise = engine.start(config);
  await Promise.resolve();   // flush microtask queue so getAudioContext promise resolves
  await startPromise;
}
```

This works because `vi.useFakeTimers()` replaces `setTimeout` but does NOT touch the microtask queue. `Promise.resolve()` lets `await getAudioContext()` settle before the test calls `vi.advanceTimersByTime()`. This idiom is the **only** difference between SegmentEngine tests and AlarmEngine tests — the rest is mock-shape changes.

**Mock shape (copy from AlarmEngine.test.ts:5–65):**
```typescript
vi.mock('../AudioContext', () => ({
  getAudioContext: vi.fn().mockResolvedValue({
    currentTime: 0,
    destination: {},
    state: 'running',
    createGain: vi.fn().mockReturnValue({
      gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
      connect: vi.fn(), disconnect: vi.fn(),
    }),
  } as unknown as AudioContext),
}));
vi.mock('../sounds/singingBowl', () => ({ strikeBowl: vi.fn() }));
vi.mock('../sounds/triangle', () => ({ strikeTriangle: vi.fn() }));
vi.mock('../sounds/phase3Tone', () => ({
  createPhase3Ramp: vi.fn().mockReturnValue({ /* gain mock */ }),
  startPhase3Swell: vi.fn().mockReturnValue([
    /* IMPORTANT: real source returns OscillatorNode[] — see AlarmEngine.test.ts:600-609
       for the array-shape override pattern when a test reaches phase3 cleanup */
  ]),
  fadeOutGain: vi.fn(),
}));
vi.mock('../sounds/keepalive', () => ({
  startKeepalive: vi.fn().mockReturnValue({ stop: vi.fn(), connect: vi.fn(), start: vi.fn() }),
  stopKeepalive: vi.fn(),
}));
vi.mock('../../platform/wakeLock', () => ({
  acquireWakeLock: vi.fn().mockResolvedValue(undefined),
  releaseWakeLock: vi.fn(),
  attachVisibilityReacquire: vi.fn().mockReturnValue(vi.fn()),
}));
```

**Landmine #1: `startPhase3Swell` mock returns single object, real source returns array.** This is documented in `AlarmEngine.test.ts:597-609` — when a SegmentEngine test reaches the alarm-segment cleanup path (which iterates `swellNodes.forEach(n => n.stop())`), the per-test override pattern is required:

```typescript
const swellNodes = [
  { stop: vi.fn(), connect: vi.fn(), start: vi.fn(), frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } },
  { stop: vi.fn(), connect: vi.fn(), start: vi.fn(), frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } },
];
(startPhase3Swell as ReturnType<typeof vi.fn>).mockReturnValue(swellNodes);
```

**Landmine #2: `setInterval` under fake timers spins forever if you over-advance.** The alarm-segment swell loop uses `setInterval(loop, 3200)`. `vi.advanceTimersByTime(60000)` will fire the interval ~18 times, each calling `startPhase3Swell` → producing 18 calls. Tests should advance only as far as needed to validate the assertion (e.g., advance 3300 ms to fire one cycle), or use `vi.clearAllTimers()` after dismissing. Pattern from AlarmEngine: drive into phase3, then `engine.dismiss()` BEFORE advancing further.

### AC.currentTime in mocks

The existing mock returns `currentTime: 0` and **never advances it**. Tests do not assert sample-accurate scheduling — they assert that `strikeBowl`/`strikeTriangle` was called at all (count + ordering). For sample-accurate assertions, mock can take a closure:

```typescript
let mockCurrentTime = 0;
vi.mock('../AudioContext', () => ({
  getAudioContext: vi.fn().mockResolvedValue({
    get currentTime() { return mockCurrentTime; },
    // ...
  }),
}));
// Then tests can do `mockCurrentTime = 240;` before triggering a fire
```

**Recommendation:** Stick with the static `currentTime: 0` pattern from AlarmEngine.test.ts. Drift verification is not the unit test's job — see next section.

### Drift measurement strategy in tests

**Do NOT** advance fake timers for 17 minutes and try to measure drift in unit tests. Instead, assert that `scheduleAt()` is called with the **expected absolute epochs**:

```typescript
import { scheduleAt } from '../timer';
vi.mock('../timer', () => ({ scheduleAt: vi.fn().mockReturnValue({ cancel: vi.fn() }) }));

it('schedules every segment-end fire time absolutely from epochBaseline', async () => {
  const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
  const engine = new SegmentEngine();
  await startEngine(engine, WAKE_EASY_CONFIG);

  expect(scheduleAt).toHaveBeenCalledTimes(5);
  expect((scheduleAt as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(1_000_000 + 240_000);
  expect((scheduleAt as ReturnType<typeof vi.fn>).mock.calls[1][0]).toBe(1_000_000 + 480_000);
  expect((scheduleAt as ReturnType<typeof vi.fn>).mock.calls[4][0]).toBe(1_000_000 + 1_020_000);

  dateNowSpy.mockRestore();
});
```

This approach asserts the architectural property that's actually relevant: **absolute epochs, not chained delays.** Drift is owned by `timer.ts` and tested in `timer.test.ts:33-50` (target-in-the-past edge case + advance-past-target idempotency). Real-world `<2 s` drift is verified via the dev harness on real devices (D-14, success criterion #2).

### `scheduleAt()` with target epoch in the past

[VERIFIED: `src/engine/timer.ts:34-66` + `src/engine/__tests__/timer.test.ts:33-41`]

When `targetEpochMs <= Date.now()`:
1. `setTimeout(tick, Math.min(targetEpochMs - Date.now(), 250))` — the `min` clamps with a negative number, which is treated as `0` by browser/Node setTimeout (fires next tick).
2. `tick()` reads `remaining = targetEpochMs - Date.now()`, finds it `<= 10`, and **fires the callback immediately**.

**There is no throw, no error.** Confirmed by `timer.test.ts:33-41`: "fires callback immediately when target is in the past."

**Implication for resume():** If pause/resume re-baselines and a target somehow lands in the past, the segment fires immediately. This is benign — the alarm catches up. SegmentEngine does not need special handling.

### Strike timing mismatch (timer fire vs `ac.currentTime`)

**Worst-case mismatch: ~250 ms** (the `scheduleAt` check interval).

When the timer callback fires:
1. Wall-clock: within 250 ms of target epoch (could be up to 250 ms early or late depending on tick alignment)
2. Inside the callback, `strikeBowl(ac, 1.0)` reads `ac.currentTime` directly — this is the audio-clock reading at that exact moment.
3. The audio is scheduled via `ac.currentTime + offset`, which is sample-accurate from that moment forward.

**Net effect:** The strike's "wall-clock fire time" can be off by ≤250 ms, but the audio attack/decay envelope is sample-accurate relative to itself. There is no mismatch where `ac.currentTime` and `strikeBowl`'s expectations disagree — they share the same `ac.currentTime` reading inside the same callback turn.

**SEG-02 budget check:** 250 ms per segment × 5 segments = 1.25 s worst-case wall-clock drift over Wake Easy. Well under <2 s. [VERIFIED: arithmetic + timer.ts contract]

### Alarm-segment teardown ordering (verbatim from `AlarmEngine.cleanup()` lines 354–407)

This is the EXACT ordering the planner must replicate in `SegmentEngine.cleanup()`. Adjustments noted inline:

```typescript
private cleanup(): void {
  // Step 1: clear running/paused flags + clear pause/config state
  this._running = false;
  this._paused = false;
  this.pauseSnapshot = null;
  this.activeConfig = null;

  // Step 2: cancel pending TimerHandles (segment-boundary fires)
  this.timers.forEach((t) => t.cancel());
  this.timers = [];

  // Step 3: end the AlarmSession (keepalive + Wake Lock + visibility)
  // PLACEMENT: between timer cancel and audio teardown — preserves v1 byte-identical
  // teardown timing (Phase 6 D-04).
  if (this.session) {
    endAlarmSession(this.session);
    this.session = null;
  }

  // Step 4: clear alarm-segment swell loop interval
  // (NO Phase 2 vibration/tick teardown — SegmentEngine has neither)
  if (this.alarmLoopTimer !== null) {
    clearInterval(this.alarmLoopTimer);
    this.alarmLoopTimer = null;
  }

  // Step 5: stop alarm-segment swell oscillator stack (every node, including LFO)
  this.alarmSwellNodes?.forEach((n) => {
    try {
      n.stop();
    } catch {
      // OscillatorNode may already be stopped — safe to ignore
    }
  });
  this.alarmSwellNodes = null;

  // Step 6: fade out alarm-segment ramp gain (no audible click)
  if (this.alarmRampGain && this.ac) {
    fadeOutGain(this.alarmRampGain, this.ac);
    this.alarmRampGain = null;
  }
}
```

**Critical: order matters.** The ordering rationale (from `AlarmEngine.cleanup` comments + Phase 6 D-04):
1. `_running = false` first — prevents reentrancy from any callback that might fire mid-teardown.
2. `timers.forEach(cancel)` next — stops new fires from being scheduled.
3. `endAlarmSession` next — releases system resources. Synchronous void per Phase 6 D-04.
4. Loop interval cleared **before** osc.stop() — prevents the loop from creating a new swell stack while we're stopping the old one.
5. `osc.stop()` wrapped in `try {} catch {}` per the OscillatorNode-already-stopped guard.
6. `fadeOutGain` last — smoothly tapers the ramp gain to 0.0001 instead of an abrupt cut.

**Auto-stop variant (D-04):** When the LAST segment is gentle/triangle and its strike has been scheduled, schedule one more `setTimeout(this.cleanup() + setPhase('dismissed'), ~2100ms)` to let the strike's exp-decay finish naturally. Use 2.1 s for triangle (matches `osc.stop(t + 2.1)`) or 6.1 s for gentle (matches `singingBowl.ts` longest partial decay). Take the max of the two: **6100 ms** is the safe ceiling. Alternative: take the per-strike-key value. Recommend **6100 ms** for safety + simplicity.

### Pause-snapshot edge cases at segment boundaries

**Question (additional context #9):** What does `getCurrentSegment()` return at the instant segment N's strike fires?

**Recommendation:** Treat the segment-end strike as the **trailing edge of segment N**. The semantics are:
- Just before segment 1 fires (at `epochBaseline + duration[0]`): `currentIdx = 0` (segment 1 active).
- The instant segment 1's fire callback runs: emit `onSegmentChange({ kind: 'end', segmentIndex: 0 })`, fire the strike, then increment `currentIdx = 1` and emit `onSegmentChange({ kind: 'start', segmentIndex: 1 })`. (D-09 specifies this dual-event ordering.)
- After increment, segment 2 is now "active" — pause captured here would record `currentSegmentIndex = 1`, `currentSegmentRemainingMs = duration[1]` (full duration; we just entered).

**Pause during the inter-segment gap (sub-millisecond):** Effectively impossible in JS single-threaded execution, but if it occurred between the `'end'` fire and the `'start'` fire within the same callback, the snapshot captures whichever index is current at that exact statement. **Recommendation:** Update `currentIdx` AFTER firing the `'end'` event but BEFORE firing the strike + `'start'` event. Then in the same turn, fire strike → fire `'start'`. This makes the boundary atomic from the caller's perspective.

**Pause during in-flight strike decay:** The exp-decay envelope is owned by the audio graph; it continues naturally. Per D-20: "allow any in-flight gentle/triangle decay envelope to finish naturally (do not abort the strike's exponential decay)." This is automatic — nothing in `cleanup()` aborts the partial's `exponentialRampToValueAtTime`.

### Vite `import.meta.env.DEV` semantics + dev harness

**Verified [CITED: vite.dev/guide/env-and-mode 2026-05]:**

> "Vite exposes certain constants under the special `import.meta.env` object. These constants are defined as global variables during dev and **statically replaced at build time to make tree-shaking effective**."
>
> ```js
> if (import.meta.env.DEV) {
>   // code inside here will be tree-shaken in production builds
>   console.log('Dev mode')
> }
> ```

**Implication:** Static import of `SegmentHarness` is **safe** — the entire `if (import.meta.env.DEV) { ... <SegmentHarness /> }` branch is dead-code-eliminated in production. The `import` statement itself is hoisted, but Rollup's tree-shaker removes any module with no live references. Quick verification via `vite build && grep -c SegmentHarness dist/assets/*.js` is recommended in the plan (zero matches expected).

**Dynamic `import()` is NOT required** but is a belt-and-braces option:
```tsx
// Static (recommended — simpler, verified tree-shakeable):
import SegmentHarness from './dev/SegmentHarness';
// ...
{import.meta.env.DEV
  && new URLSearchParams(window.location.search).get('dev') === 'segments'
  && <SegmentHarness />}

// Dynamic (extra paranoia — explicit chunk separation):
const [Harness, setHarness] = useState<React.ComponentType | null>(null);
useEffect(() => {
  if (import.meta.env.DEV
      && new URLSearchParams(window.location.search).get('dev') === 'segments') {
    import('./dev/SegmentHarness').then((m) => setHarness(() => m.default));
  }
}, []);
```

**Recommendation:** Static import. Simpler, verifiably tree-shaken, removed cleanly in Phase 8.

**Phase 11 bundle-size implication:** Static import keeps `SegmentHarness.tsx` in the dev module graph but excludes it from production. Phase 11's multi-page split + landing page does NOT inherit harness weight. Verified by Vite docs.

---

## Common Pitfalls

### Pitfall 1: Forgetting the microtask flush in `startEngine` test helper

**What goes wrong:** `vi.advanceTimersByTime()` runs synchronously after `engine.start(...)` returns; if `await getAudioContext()` hasn't resolved yet, the engine's `this.ac` is null when the first timer fires, and the test crashes with a null-deref inside the fire callback.

**Why it happens:** `vi.useFakeTimers()` replaces `setTimeout` but not the microtask queue. The promise from `getAudioContext()` settles in microtask phase; without `await Promise.resolve()`, fake timers fire ahead of microtasks.

**How to avoid:** Copy the `startEngine` helper from `AlarmEngine.test.ts:67-75` exactly. The `await Promise.resolve();` line is load-bearing.

**Warning signs:** "Cannot read properties of null (reading 'currentTime')" or undefined-method errors inside fire callback.

### Pitfall 2: `setInterval` under fake timers spins infinitely

**What goes wrong:** `vi.advanceTimersByTime(60000)` advances through 18 cycles of a 3200ms-period setInterval, each one calling `startPhase3Swell` → expensive mock dispatch + assertion noise.

**Why it happens:** Vitest fake-timer `setInterval` fires every period within the advance window; there is no throttle.

**How to avoid:** Advance only as far as needed to validate the assertion (e.g., 3300 ms to check one loop cycle). Then call `engine.dismiss()` (which `clearInterval`s the loop) before any further advance. AlarmEngine tests follow this pattern (e.g., `AlarmEngine.test.ts:611-626`).

**Warning signs:** Tests with "very slow" reports >100ms, or `startPhase3Swell.mock.calls.length` greatly exceeding expectation.

### Pitfall 3: `OscillatorNode` cannot restart after `.stop()`

**What goes wrong:** Reusing a stopped osc throws `InvalidStateError` on `.start()`.

**Why it happens:** Web Audio spec — `OscillatorNode` is single-use.

**How to avoid:** Factory pattern (CLAUDE.md mandate): `new OscillatorNode(...)` inside every fire and inside every swell-loop cycle. The `triangle.ts` strike, the alarm-segment swell loop, and segmentSound dispatch all follow this. Pre-existing codebase pattern — already established.

**Warning signs:** "Failed to execute 'start' on 'AudioScheduledSourceNode': cannot call start more than once."

### Pitfall 4: Audible click on `cleanup()` if you skip `fadeOutGain`

**What goes wrong:** Abrupt `gain.value = 0` or skipping the fade leaves the alarm-segment ramp at full volume — pop on stop.

**Why it happens:** Web Audio doesn't smooth ramp endpoints; any non-asymptotic stop causes a discontinuity.

**How to avoid:** Last step of cleanup() is `fadeOutGain(this.alarmRampGain, this.ac)` — same `setTargetAtTime(0.0001, ac.currentTime, 0.015)` idiom as AlarmEngine.cleanup line 404.

**Warning signs:** Audible "pop" or "click" on dismiss during alarm segment.

### Pitfall 5: Validation throws instead of returning `{ ok: false, error }`

**What goes wrong:** Composer UI (Phase 9) catches the throw and surfaces it ungracefully, OR the runtime itself blows up.

**Why it happens:** It's tempting to write `if (bad) throw new Error(...)` because that's how `validateConfig` (v1) works. SEG-04 explicitly forbids this.

**How to avoid:** `validateSegmentConfig` returns the discriminated union always. Engine `start()` accepts the union and refuses to proceed if `!result.ok`. Consider whether `start()` should:
- (a) Throw the error message (consistent with v1 `validateConfig`) — composer catches.
- (b) Return early with no observable effect — composer must call validator first.
**Recommendation:** Have `start()` validate AND throw on `!ok`. Composer calls `validateSegmentConfig` first to surface the error inline. Defense-in-depth — both layers validate.

**Warning signs:** Console error stacks during composer interaction; failed Phase 9 acceptance criteria.

### Pitfall 6: Pause snapshot off-by-one at segment boundaries

**What goes wrong:** Pausing immediately after a strike fires (boundary moment) records `currentSegmentIndex = N` (the segment that just ended) when it should be `N+1`.

**Why it happens:** Ordering of `currentIdx++` vs strike-fire vs pauseSnapshot capture.

**How to avoid:** Inside the segment-fire callback, sequence:
1. Emit `onSegmentChange({ kind: 'end', segmentIndex: this.currentIdx })`
2. Increment `this.currentIdx++`
3. Fire the strike (or transition to `'firing-alarm'` for alarm)
4. Emit `onSegmentChange({ kind: 'start', segmentIndex: this.currentIdx })`

Snapshot capture (which can only happen between turns of the JS event loop, since pause() is sync) will always see consistent `currentIdx`.

**Warning signs:** Test expecting "after segment 3 fires, `getCurrentSegment().index` is 4" failing with "got 3."

### Pitfall 7: SEG-05 zero-diff violation via barrel-export reordering

**What goes wrong:** Touching `src/engine/index.ts` accidentally removes or reorders an existing export, breaking a v1 caller.

**Why it happens:** "Cleanup" instinct during refactor.

**How to avoid:** Append-only edits to `src/engine/index.ts` per D-24. Existing exports unchanged. Append:
```typescript
export { SegmentEngine } from './SegmentEngine';
export type { Segment, SegmentConfig, SegmentEngineState, SegmentChangeEvent } from './SegmentState';
export { validateSegmentConfig, WAKE_EASY_CONFIG } from './SegmentState';
export { strikeTriangle } from './sounds/triangle';
```

**Warning signs:** Phase 6 regression tests failing (they import from the barrel); v1 build broken.

---

## Code Examples

### `triangle.ts` (final per D-05)

```typescript
// Source: 07-CONTEXT.md "Suggested triangle.ts shape (final params per D-05)"
/**
 * Triangle sound — synthesized bright single-strike at F7 (2793.83 Hz).
 *
 * - Frequency: F7 (equal temperament, A4=440 reference) — chosen for warm
 *   major-third-flavored interval against the bowl's A root (D-06 reframe).
 * - Attack: 8 ms linearRampToValueAtTime — click-free per AUD-05 (≥5 ms).
 * - Decay: 2.0 s exponentialRampToValueAtTime to 0.001 — never to 0 per spec.
 * - Peak: 0.4 * masterGain.
 * - osc.stop(t + 2.1) — cleanly past decay end.
 *
 * @see .planning/phases/07-segment-engine-triangle-sound/triangle-demo.html
 *      (preserved as historical record of why F7 won over F#7/G7).
 */
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

### `segmentSound.ts` dispatcher (D-13)

```typescript
import { strikeBowl } from './singingBowl';
import { strikeTriangle } from './triangle';

/**
 * Dispatches a one-shot end-of-segment strike for gentle/triangle keys.
 *
 * 'alarm' is NOT routed through here — SegmentEngine handles it directly
 * via createPhase3Ramp + startPhase3Swell because the ramp lifecycle is
 * structurally different (multi-second sustain + loop, not one-shot).
 */
export function fireSegmentEndSound(ac: AudioContext, key: 'gentle' | 'triangle'): void {
  if (key === 'gentle') {
    strikeBowl(ac, 1.0);
  } else {
    strikeTriangle(ac, 1.0);
  }
}
```

### `SegmentState.ts` types + validator skeleton

```typescript
export interface Segment {
  id: string;
  durationMs: number;
  endSound: 'gentle' | 'triangle' | 'alarm';
}

export interface SegmentConfig {
  segments: Segment[];
}

export type SegmentEngineState = 'idle' | 'running' | 'firing-alarm' | 'dismissed';

export interface SegmentChangeEvent {
  kind: 'start' | 'end';
  segmentIndex: number;
  totalSegments: number;
  segment: Segment;
}

export interface SegmentPauseSnapshot {
  currentSegmentIndex: number;
  currentSegmentRemainingMs: number;
  futureSegmentDurationsMs: number[];
}

export type SegmentValidationResult =
  | { ok: true; config: SegmentConfig }
  | { ok: false; error: string };

const MAX_DURATION_MS = 14_400_000; // 4 hours, matches AlarmConfig
const VALID_SOUND_KEYS = new Set(['gentle', 'triangle', 'alarm']);

export function validateSegmentConfig(input: unknown): SegmentValidationResult {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Config must be an object' };
  }
  const cfg = input as Partial<SegmentConfig>;
  if (!Array.isArray(cfg.segments) || cfg.segments.length === 0) {
    return { ok: false, error: 'Segment list is empty — at least one segment is required' };
  }
  for (let i = 0; i < cfg.segments.length; i++) {
    const seg = cfg.segments[i] as Partial<Segment> | undefined;
    if (!seg || typeof seg !== 'object') {
      return { ok: false, error: `Segment ${i} is not an object` };
    }
    if (typeof seg.id !== 'string' || seg.id.length === 0) {
      return { ok: false, error: `Segment ${i} has invalid id` };
    }
    if (typeof seg.durationMs !== 'number'
        || !Number.isFinite(seg.durationMs)
        || seg.durationMs <= 0
        || seg.durationMs > MAX_DURATION_MS) {
      return {
        ok: false,
        error: `Segment ${i} has invalid duration ${seg.durationMs}ms — must be > 0 and ≤ ${MAX_DURATION_MS}`,
      };
    }
    if (typeof seg.endSound !== 'string' || !VALID_SOUND_KEYS.has(seg.endSound)) {
      return {
        ok: false,
        error: `Unknown sound key '${seg.endSound}' in segment ${i} — expected 'gentle', 'triangle', or 'alarm'`,
      };
    }
  }
  return { ok: true, config: cfg as SegmentConfig };
}

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

### `App.tsx` dev-mount addition (D-15) — minimal diff

```tsx
import { useAlarm } from './hooks/useAlarm';
import Dashboard from './components/Dashboard';
import Countdown from './components/Countdown';
import SegmentHarness from './dev/SegmentHarness';   // ← NEW (Phase 8 removes)

export default function App() {
  const alarm = useAlarm();
  const showCountdown = alarm.isRunning || alarm.phase !== 'idle';
  // ↓ NEW (Phase 8 removes):
  const showSegmentHarness =
    import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('dev') === 'segments';

  return (
    <div className="min-h-dvh bg-bg text-text-primary flex flex-col items-center">
      {showSegmentHarness ? (
        <SegmentHarness />
      ) : showCountdown ? (
        <Countdown alarm={alarm} />
      ) : (
        <Dashboard alarm={alarm} />
      )}
      <p className="fixed bottom-3 right-4 text-text-secondary text-xs opacity-40">Version: 1.1</p>
    </div>
  );
}
```

**Verification:** After Phase 7, `npm run build && grep -c SegmentHarness dist/assets/*.js` should report **0 matches** in any production chunk. (Static import is tree-shaken because the `if (import.meta.env.DEV)` short-circuit eliminates the only reference.) [CITED: vite.dev/guide/env-and-mode]

---

## Test Split + Approximate Test Count Per File

Per D-22, four test files. Approximate test counts (planner uses to size tasks):

### `src/engine/__tests__/validateSegmentConfig.test.ts` — ~10 tests

1. Valid Wake Easy config returns `{ ok: true }`
2. Valid minimal 1-segment config returns `{ ok: true }`
3. Empty segments array returns user-readable error
4. Missing `segments` field returns error
5. Non-object input returns error
6. NaN duration returns error
7. Zero duration returns error
8. Negative duration returns error
9. Duration > 14_400_000 returns error
10. Unknown sound key (`'beep'`) returns error with key name in message
11. Empty id returns error
12. Returns `{ ok: false }` shape (not `throw`) — defensive contract

### `src/engine/sounds/__tests__/triangle.test.ts` — ~7 tests

1. `strikeTriangle` is exported as a function
2. Creates exactly 1 OscillatorNode at `frequency: 2793.83`, `type: 'sine'`
3. Creates exactly 1 GainNode initialized at `gain: 0`
4. Calls `setValueAtTime(0, t)` then `linearRampToValueAtTime(0.4 * masterGain, t + 0.008)` (attack)
5. Calls `exponentialRampToValueAtTime(0.001, t + 2.0)` (decay — never to 0)
6. Calls `osc.start(t)` and `osc.stop(t + 2.1)`
7. Applies `masterGain` scaling correctly (peak at `0.4 * masterGain`)
8. Connects osc → gain → destination

Mock pattern: copy from `src/engine/sounds/__tests__/singingBowl.test.ts`.

### `src/engine/__tests__/segmentSound.test.ts` — ~3 tests

1. `'gentle'` key calls `strikeBowl(ac, 1.0)` exactly once and `strikeTriangle` zero times
2. `'triangle'` key calls `strikeTriangle(ac, 1.0)` exactly once and `strikeBowl` zero times
3. (Optional) Type-level check that `'alarm'` is not a valid argument (TS-only — caught at compile time)

### `src/engine/__tests__/SegmentEngine.test.ts` — ~20 tests

State machine + scheduling:
1. `getState()` returns `'idle'` initially
2. `start(WAKE_EASY_CONFIG)` transitions to `'running'`
3. `start()` rejects when already running (mirrors `AlarmEngine`)
4. `start()` rejects/refuses on invalid config (validator returns `!ok`)
5. Schedules 5 absolute fire epochs from `epochBaseline`
6. `getCurrentSegment()` returns `null` when idle
7. `getCurrentSegment()` returns `{ index: 0, total: 5, segment: ... }` after start

Segment fires:
8. Gentle segment fires `strikeBowl(ac, 1.0)` once at boundary
9. Triangle segment fires `strikeTriangle(ac, 1.0)` once at boundary
10. `onSegmentChange` fires `'end'` then `'start'` for each boundary

Alarm segment (D-01..D-03):
11. Alarm-segment start: state → `'firing-alarm'`
12. Alarm-segment start: calls `createPhase3Ramp(durationMs/1000)` + `startPhase3Swell`
13. Alarm-segment start: `setInterval(loop, 3200)` registered (verify after one cycle advance)
14. `canPause()` returns `false` while in `'firing-alarm'`
15. `pause()` while in `'firing-alarm'` is silent no-op (state unchanged)
16. Alarm segment continues past segment-end until `dismiss()` (D-02)

Auto-stop (D-04):
17. Last-gentle config auto-stops after final strike's decay; state → `'dismissed'`

Pause/resume (D-19, D-20):
18. Pause mid-gentle: snapshot captures `currentSegmentRemainingMs` correctly
19. Resume: re-baselines and re-registers `scheduleAt` calls
20. Pause-then-resume preserves total runtime (extends by pause duration)

Cleanup:
21. `dismiss()` calls `endAlarmSession(this.session)` exactly once
22. `dismiss()` clears all timers + alarm-loop interval + osc.stop on every swell node
23. Idempotent cleanup: `dismiss()` then `stop()` does not double-call deps

This split gives a planner ~40 tests total to allocate across plans/waves. Suggested allocation (Claude's Discretion):
- Plan 1: triangle.ts + triangle.test.ts (small, fast — primes the test infra)
- Plan 2: SegmentState.ts + validateSegmentConfig.test.ts + segmentSound.ts + segmentSound.test.ts (validator + dispatcher)
- Plan 3: SegmentEngine.ts + SegmentEngine.test.ts + barrel exports (the heavy lift)
- Plan 4: SegmentHarness.tsx + App.tsx mount-line (dev verification path)

---

## Library/API References

### Web Audio API

**[CITED: developer.mozilla.org/en-US/docs/Web/API/OscillatorNode]**
- `new OscillatorNode(ac, { type, frequency })` — factory pattern (single-use, cannot restart after `.stop()`)
- `osc.start(when)` / `osc.stop(when)` — relative to `ac.currentTime`
- `osc.frequency` is an `AudioParam` — supports `setValueAtTime`, `linearRampToValueAtTime`, `exponentialRampToValueAtTime`

**[CITED: developer.mozilla.org/en-US/docs/Web/API/GainNode]**
- `new GainNode(ac, { gain })` — factory pattern
- `gain` is an `AudioParam` — same ramp methods as frequency
- `exponentialRampToValueAtTime` cannot ramp to 0 (spec forbids); use 0.001 instead

**[VERIFIED: src/engine/sounds/singingBowl.ts:44]** "exponentialRampToValueAtTime — cannot ramp to exactly 0 (spec forbids it)" — pattern already established in codebase.

### Vitest fake timers

**[CITED: vitest.dev/api/vi.html]** — `vi.useFakeTimers()`, `vi.advanceTimersByTime(ms)`, `vi.runAllTimersAsync()`, `vi.useRealTimers()`, `vi.clearAllMocks()`.

**[VERIFIED: src/engine/__tests__/AlarmEngine.test.ts:78-87]** Fake-timer setup pattern in this codebase:
```typescript
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal('navigator', { vibrate: vi.fn() });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
```

### Vite `import.meta.env`

**[CITED: vite.dev/guide/env-and-mode]:**
- `import.meta.env.DEV` is a boolean: `true` in dev, `false` in production
- Statically replaced at build time
- Dead code under `if (import.meta.env.DEV)` is tree-shaken in production builds
- Verified for Vite 6.x

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AlarmEngine duplicated session lifecycle | `AlarmSession` extracted (Phase 6) | 2026-05-04..07 | SegmentEngine reuses verbatim — no new code |
| `GainNode.gain > 1.0` for loudness | `DynamicsCompressorNode` chain (Phase 5 D-02) | 2026-04-22 | Alarm segment inherits the compressor automatically via `createPhase3Ramp` |
| 80–220 Hz Phase 3 fundamental | 1–3 kHz band (Phase 5 D-03) | 2026-04-22 | Alarm segment inherits new band; triangle (F7=2793.83 Hz) sits cleanly above the bowl's dominant partials but below the chirp |

**Deprecated/outdated:**
- v1 `validateConfig` throws on invalid input — the segment-config validator deliberately does NOT (SEG-04 reframes the contract).
- Reading `Date.now()` for audio scheduling — replaced by `ac.currentTime` once inside the fire callback (sample-accurate).

---

## Project Constraints (from CLAUDE.md)

These are MANDATORY directives the planner must respect:

- **Tech stack:** React 19 + Vite 6 + Tailwind CSS 4 + TypeScript 5 strict mode. **No new deps in Phase 7** — verified by §"Standard Stack."
- **Audio:** Raw Web Audio API only — no Tone.js, no Howler.js. `OscillatorNode` factory pattern (single-use). Triangle synthesis must use `OscillatorNode` + `GainNode`.
- **No persistence:** Settings ephemeral per session. WAKE_EASY_CONFIG is a hardcoded constant, not stored.
- **iOS Safari structurally hostile:** No Vibration API; AudioContext suspends on screen lock. SegmentEngine inherits this from AlarmSession (Phase 6 D-01 sets `audioSession.type = 'playback'` for iOS 17+ silent-switch fix). Pre-existing limitations are NOT addressed in Phase 7.
- **GSD workflow enforcement:** All file changes go through `/gsd-execute-phase` for planned work. No direct edits.
- **Testing:** Vitest (already installed). Fake timers + AC mock pattern established in `AlarmEngine.test.ts`.

### SEG-05 zero-diff floor (HARD CONSTRAINT)

The planner MUST NOT modify any of:
- `src/engine/AlarmEngine.ts`
- `src/engine/AlarmState.ts`
- `src/engine/AlarmSession.ts`
- `src/engine/AudioContext.ts`
- `src/engine/timer.ts`
- `src/hooks/useAlarm.ts`
- `src/components/Countdown.tsx`
- `src/components/ProgressRing.tsx`
- `src/platform/wakeLock.ts`, `src/platform/vibration.ts`, `src/platform/notifications.ts`
- Any existing file under `src/engine/sounds/*.ts` (singingBowl, phase3Tone, keepalive, testSound, tickPulse) — only **addition** allowed is `triangle.ts`.

The plan MUST include a verification step (CI grep guard or explicit file-list assertion) per D-23.

---

## Runtime State Inventory

**Skipped — Phase 7 is purely additive (new files only); no rename/refactor/migration concern.**

Verified categories:
- **Stored data:** None. v1 has no persistence; SegmentEngine adds none.
- **Live service config:** None. No external service interactions.
- **OS-registered state:** None. No background tasks, no notifications registered (existing system Notifications API is consumed via `useAlarm.ts`, unchanged in Phase 7).
- **Secrets/env vars:** None.
- **Build artifacts:** None — only new source files. Production bundle gains nothing (harness tree-shaken). Phase 8 will remove `dev/SegmentHarness.tsx` and the App.tsx mount-line.

---

## Environment Availability

**Skipped — Phase 7 has no new external tool/service/runtime dependencies.**

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vitest | Tests | ✓ | ^3.1.2 [VERIFIED: package.json] | — |
| Vite | Build, DEV mode flag | ✓ | ^6.0.5 | — |
| TypeScript | Type checking | ✓ | ~5.6.2 | — |

All other primitives (Web Audio API, AlarmSession, scheduleAt, strikeBowl, phase3Tone) are intra-project and verified by file presence.

---

## Validation Architecture

**Note:** `workflow.nyquist_validation` is `false` in `.planning/config.json`, so this section is informational only.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^3.1.2 |
| Config file | None — uses defaults; tests discovered via `src/**/__tests__/**/*.test.ts` |
| Quick run command | `npm test -- --run` |
| Per-file run | `npm test -- src/engine/__tests__/SegmentEngine.test.ts --run` |
| Watch mode | `npm test` (default — Vitest watch) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File |
|--------|----------|-----------|-------------------|------|
| SEG-01 | Segment + Config types + validator | unit | `npm test -- validateSegmentConfig --run` | NEW |
| SEG-02 | Absolute scheduling, no chained setTimeout | unit | `npm test -- SegmentEngine --run` | NEW |
| SEG-02 | <2 s drift over 17 min | manual | dev harness real-device run | harness only |
| SEG-03 | Pause snapshot mid-segment | unit | `npm test -- SegmentEngine --run` | NEW |
| SEG-03 | Pause locked during alarm segment | unit | `npm test -- SegmentEngine --run` | NEW |
| SEG-04 | Validator returns `{ok: false}` not throws | unit | `npm test -- validateSegmentConfig --run` | NEW |
| AUD-05 | Triangle envelope: 8 ms attack, 2 s decay, 2793.83 Hz, peak 0.4 | unit | `npm test -- triangle --run` | NEW |
| SEG-05 | v1 zero-diff | CI assertion | grep guard or file-list assertion in plan | — |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The auto-stop ceiling (D-04) should be ~6.1s (max of triangle 2.1s and bowl ~6.1s decay) | "Alarm-segment teardown ordering" | If too short, last gentle/triangle decay is cut off audibly. Recommend taking max-decay of all sound types — but a per-segment-key value is also reasonable. The planner should pick during planning. |
| A2 | `start()` should validate AND throw on `!ok`, with composer also calling validator first | Pitfall #5 | If the engine is silent on bad config, composer may not surface the error correctly. The dual-layer approach is defense-in-depth — but the user could prefer single-layer. |
| A3 | Static import of SegmentHarness is sufficient (no dynamic import needed) | "Vite import.meta.env.DEV" | Vite docs confirm tree-shaking; verified in production by build inspection. Low risk. |
| A4 | The 250 ms scheduleAt jitter × 5 segments = 1.25 s worst case fits SEG-02's <2 s budget | "Strike timing mismatch" | This is arithmetic from `timer.ts`'s contract. Real-world drift may also include `setTimeout` underlying drift on backgrounded tabs — but Wake Lock + keepalive should keep the page foregrounded. Verified on dev harness. |
| A5 | Pause snapshot at segment boundary: increment `currentIdx` AFTER 'end' event but BEFORE strike + 'start' event | Pitfall #6 | Alternative ordering possible; doesn't affect correctness as long as it's consistent. The recommendation is for clarity. |

---

## Open Questions (RESOLVED)

> All five questions were materially resolved during planning (gsd-planner pass on 2026-05-09). Resolutions are recorded inline below; the planning artifacts cited are the authoritative implementations.

1. **Auto-stop decay window for D-04 — per-segment-key vs uniform 6100 ms?**
   - What we know: Triangle decays in 2.1s; bowl in ~6.1s. D-04 says "after the final tail strike's ~2s decay" — but ~2s is only correct for triangle.
   - What's unclear: Whether to use per-key value (cleaner, slightly more code) or uniform 6100 ms (simpler, may delay state→'dismissed' for triangle-tailed compositions by 4s).
   - Recommendation: **Per-key value** — cleaner UX, trivial implementation. Wrap in a tiny helper `getSoundDecayMs('gentle' | 'triangle')`.
   - **RESOLVED:** per-key decay window — `07-04-PLAN.md` defines `DECAY_WINDOW_MS = { gentle: 6100, triangle: 2100 }` and uses it for the auto-stop scheduling on `endSound: 'gentle' | 'triangle'` tails.

2. **Validator: does `start()` throw on `!ok` OR return early silently?**
   - What we know: SEG-04 says validator never throws into the runtime; D-11 says runtime gates on `result.ok`.
   - What's unclear: Whether the engine itself should also throw (composer catches) or just no-op (composer must validate first).
   - Recommendation: **Throw inside `start()`** — defense-in-depth. Composer's contract is to call validator first; engine is the second gate. This matches v1 `validateConfig` behavior, which is what existing test patterns expect.
   - **RESOLVED:** throw inside `start()` — `07-04-PLAN.md` Task 1 calls `validateSegmentConfig(config)` and `throw new Error(result.error)` when `!result.ok`, mirroring AlarmEngine's v1 contract.

3. **Should `triangle.ts` expose any helpers beyond `strikeTriangle`?**
   - What we know: The single-strike API is sufficient for Phase 7.
   - What's unclear: Whether Phase 9 composer needs a `previewTriangle()` (separate name) for its sound-picker preview.
   - Recommendation: **Single export for Phase 7.** Phase 9 can add `previewTriangle` (lower volume, e.g. masterGain=0.3) without changing the existing API.
   - **RESOLVED:** single `strikeTriangle` export for Phase 7 — `07-01-PLAN.md` writes `triangle.ts` with the single function only; Phase 9 may add `previewTriangle` later without breaking changes.

4. **Harness logging style — DOM table vs console only?**
   - What we know: D-14 says "console-style event log capturing onSegmentChange events with `performance.now()` timestamps"; D-19 explicitly Claude's-Discretion.
   - What's unclear: DOM-rendered log helps on-device verification (mobile dev tools awkward); console-only is simpler.
   - Recommendation: **DOM table.** Mobile DevTools usability matters for the on-device drift verification. Lightweight — `<table>` of timestamps in monospace.
   - **RESOLVED:** DOM table — `07-05-PLAN.md` Task 1 renders a `<table>` of timestamped `onSegmentChange` events in `SegmentHarness.tsx`.

5. **Static vs dynamic import for SegmentHarness in App.tsx?**
   - What we know: Static is verified tree-shaken; dynamic provides explicit chunk separation.
   - What's unclear: Whether the team prefers paranoid extra-isolation.
   - Recommendation: **Static.** Simpler, verifiably DCE'd, easier to remove in Phase 8 (one line vs five).
   - **RESOLVED:** static import — `07-05-PLAN.md` Task 3 adds `import SegmentHarness from './dev/SegmentHarness'` to `App.tsx` behind the `import.meta.env.DEV` guard; tree-shake verified by post-build grep returning 0.

---

## Sources

### Primary (HIGH confidence)
- **Codebase:** `src/engine/AlarmEngine.ts`, `src/engine/AlarmSession.ts`, `src/engine/AlarmState.ts`, `src/engine/timer.ts`, `src/engine/sounds/singingBowl.ts`, `src/engine/sounds/phase3Tone.ts`, `src/engine/__tests__/AlarmEngine.test.ts`, `src/engine/__tests__/AlarmSession.test.ts`, `src/engine/__tests__/timer.test.ts`, `src/engine/sounds/__tests__/singingBowl.test.ts`, `src/engine/sounds/__tests__/phase3Tone.test.ts`, `src/App.tsx`, `package.json`, `.planning/config.json` — VERIFIED via Read tool 2026-05-09
- **CONTEXT.md:** `.planning/phases/07-segment-engine-triangle-sound/07-CONTEXT.md` — D-01 through D-24 LOCKED decisions
- **Phase 6 prior context:** `.planning/phases/06-alarmsession-refactor-v1-regression-guard/06-CONTEXT.md` — D-01 through D-08
- **Vite v6 docs:** https://vite.dev/guide/env-and-mode — `import.meta.env.DEV` static replacement + tree-shaking [CITED]
- **MDN Web Audio:** https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode and https://developer.mozilla.org/en-US/docs/Web/API/GainNode [CITED]

### Secondary (MEDIUM confidence)
- **Vitest fake-timer behavior:** Inferred from `AlarmEngine.test.ts` working pattern (line 67-75 microtask flush, line 78-87 setup). Cross-referenced with vitest.dev API docs (general pattern, not a specific quote).

### Tertiary (LOW confidence — flagged)
- None. All claims either verified in codebase or cited from official docs.

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — package.json verified; CLAUDE.md mandates raw Web Audio API
- Architecture Patterns: HIGH — direct mirror of AlarmEngine; pattern proven in Phase 6
- Test patterns: HIGH — verbatim copy from AlarmEngine.test.ts; idioms identified in source
- Triangle synthesis: HIGH — D-05 fully specifies; verified bowl partial frequencies in singingBowl.ts:73-77
- Drift budget arithmetic: HIGH — derived from timer.ts:34 contract (`<250 ms` fire jitter)
- Vite tree-shaking: HIGH — official Vite v6 doc cited
- Cleanup ordering: HIGH — verbatim from AlarmEngine.cleanup():354-407
- Pitfalls: HIGH — derived from existing test failure patterns in codebase
- Open question recommendations: MEDIUM — judgment calls; user discretion appropriate

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (30 days; stable codebase, no upcoming dep upgrades for v2.0 phases)
