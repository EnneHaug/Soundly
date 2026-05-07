# Phase 6: AlarmSession Refactor + v1 Regression Guard - Pattern Map

**Mapped:** 2026-05-06
**Files analyzed:** 6 (3 new, 3 modified)
**Analogs found:** 5 / 6 (the regression checklist is doc-only; no code analog needed)

## File Classification

| File | New / Modified | Role | Data Flow | Closest Analog | Match Quality |
|------|----------------|------|-----------|----------------|---------------|
| `src/engine/AlarmSession.ts` | new | engine module (lifecycle helpers) | request-response (start/end pair) | `src/engine/sounds/keepalive.ts` (function-pair shape) + `src/platform/wakeLock.ts` (visibility-listener lifecycle) | hybrid: cherry-pick from both |
| `src/engine/__tests__/AlarmSession.test.ts` | new | unit test | request-response | `src/engine/__tests__/AlarmEngine.test.ts` (vi.mock of keepalive/wakeLock/AudioContext + call-order assertions) | exact (same module deps) |
| `.planning/.../06-REGRESSION-CHECKLIST.md` | new | doc only | — | none (no analog file exists in the repo) | n/a — doc, planner uses RESEARCH/CONTEXT directly |
| `src/engine/AlarmEngine.ts` | modified | class state machine | event-driven (timer-fired phase transitions) | itself — diff site is `start()` lines 96–149 and `cleanup()` lines 360–417 | exact (own file) |
| `src/engine/index.ts` | modified | barrel export | — | itself — append-only diff at line 28 | exact (own file) |
| `src/engine/__tests__/AlarmEngine.test.ts` | modified | unit test | event-driven | itself — extend, do not rewrite | exact (own file) |

## Pattern Assignments

### `src/engine/AlarmSession.ts` (NEW — engine lifecycle module)

**Role:** Pure-function module exporting `startAlarmSession()` / `endAlarmSession(handle)` and the `SessionHandle` type. Owns AC bring-up, silent keepalive, Wake Lock acquire, and visibility re-acquire — in that order on start, reverse on end.

**Primary analog (function-pair shape):** `src/engine/sounds/keepalive.ts`

This is the cleanest existing analog for the export shape: a pure-function `start*` returning a "handle" (an `OscillatorNode` there, a `SessionHandle` here), paired with a `stop*` that accepts the handle. No class. No module-level singleton state. No reentrancy guard.

`src/engine/sounds/keepalive.ts:28-52`:
```typescript
export function startKeepalive(ac: AudioContext): OscillatorNode {
  const osc = new OscillatorNode(ac, { type: 'sine', frequency: 1 });
  const gain = new GainNode(ac, { gain: 0 }); // silent — gain is zero

  osc.connect(gain).connect(ac.destination);
  osc.start();

  return osc;
}

export function stopKeepalive(osc: OscillatorNode): void {
  try {
    osc.stop();
  } catch {
    // OscillatorNode may already be stopped — safe to ignore
  }
}
```

**Pattern to replicate:**
- The `start*` returns a "handle" object that the caller stores and later passes back to `end*`.
- `end*` is fire-and-forget; matches D-04 (synchronous `void` return).
- Wrap teardown calls in try/catch so a failed inner call (e.g., `osc.stop()` when already stopped) does not block subsequent teardown steps.

**Pattern to deviate from:**
- Keepalive's "handle" is the raw `OscillatorNode`. AlarmSession's `SessionHandle` is `{ readonly ac: AudioContext }` and the *internals* (`OscillatorNode`, visibility cleanup) are NOT exposed (D-02). Use a `WeakMap<SessionHandle, SessionInternals>` (preferred per Claude's Discretion) keyed by the returned handle to recover the internals during `endAlarmSession`.

**Secondary analog (lifecycle ordering + visibility-listener cleanup contract):** `src/platform/wakeLock.ts`

This file is the source of truth for two of the four steps AlarmSession owns. The relevant excerpts are:

`src/platform/wakeLock.ts:42-55` (acquire — note the swallow profile to preserve, D-05):
```typescript
export async function acquireWakeLock(): Promise<void> {
  if (!('wakeLock' in navigator)) return;
  _shouldHoldLock = true;
  try {
    _sentinel = await navigator.wakeLock.request('screen');
    _sentinel.addEventListener('release', () => {
      console.debug('[WakeLock] released by OS');
    });
  } catch (err) {
    // DOMException: NotAllowedError if document not visible at time of request.
    // Safe to ignore — visibilitychange listener will re-acquire when document becomes visible.
    console.debug('[WakeLock] acquisition failed:', err);
  }
}
```

`src/platform/wakeLock.ts:79-87` (the cleanup-fn return contract that AlarmSession must store and call):
```typescript
export function attachVisibilityReacquire(): () => void {
  const handler = async () => {
    if (_shouldHoldLock && document.visibilityState === 'visible') {
      await acquireWakeLock();
    }
  };
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}
```

**Pattern to replicate:**
- `attachVisibilityReacquire()` already returns its own cleanup function. Capture it in the SessionInternals as `releaseVisibility: () => void` and call it in `endAlarmSession`.
- `acquireWakeLock`'s try/catch swallow is *internal to wakeLock.ts*. AlarmSession just calls it — the swallow is preserved for free. Do NOT wrap a redundant try/catch in AlarmSession around `acquireWakeLock()`; that would change the failure profile (no double-log).

**Exact ordering required by D-05 (must mirror `AlarmEngine.start()` lines 104–111 — see next section):**
1. `await getAudioContext()`
2. `startKeepalive(ac)`
3. `await acquireWakeLock()`
4. `attachVisibilityReacquire()`

`endAlarmSession` reverses this (per D-06). Note that `releaseWakeLock()` and `attachVisibilityReacquire`'s cleanup happen *together* in the current `cleanup()` (no documented strict ordering), so reversing as `stopKeepalive → releaseWakeLock → releaseVisibility` is fine.

---

### `src/engine/__tests__/AlarmSession.test.ts` (NEW — unit test)

**Role:** Vitest unit tests for AlarmSession. Mocks the three deps so we can assert call order, the double-end no-op, and the swallow profile (acquireWakeLock rejection does not propagate).

**Analog:** `src/engine/__tests__/AlarmEngine.test.ts`

The existing AlarmEngine test already mocks every dependency AlarmSession will touch. Reuse the same mock shape verbatim — that guarantees the AlarmSession test and the (extended) AlarmEngine test agree on what "the dep returns" means.

`src/engine/__tests__/AlarmEngine.test.ts:1-65` (the mock setup block to copy):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AlarmEngine } from '../AlarmEngine';
import { DEFAULT_CONFIG, AlarmConfig, QUICK_NAP_CONFIG, FOCUS_CONFIG, validateConfig } from '../AlarmState';

// Mock all audio dependencies
vi.mock('../AudioContext', () => ({
  getAudioContext: vi.fn().mockResolvedValue({
    currentTime: 0,
    destination: {},
    state: 'running',
    createGain: vi.fn().mockReturnValue({
      gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
  } as unknown as AudioContext),
}));

vi.mock('../sounds/keepalive', () => ({
  startKeepalive: vi.fn().mockReturnValue({
    stop: vi.fn(),
    connect: vi.fn(),
    start: vi.fn(),
  }),
  stopKeepalive: vi.fn(),
}));

vi.mock('../../platform/wakeLock', () => ({
  acquireWakeLock: vi.fn().mockResolvedValue(undefined),
  releaseWakeLock: vi.fn(),
  attachVisibilityReacquire: vi.fn().mockReturnValue(vi.fn()), // returns cleanup fn
}));
```

**Pattern to replicate:**
- Same `vi.mock` calls — three modules: `../AudioContext`, `../sounds/keepalive`, `../../platform/wakeLock`. (AlarmSession does NOT need vibration, tickPulse, singingBowl, phase3Tone — those stay in AlarmEngine.)
- `attachVisibilityReacquire` returns `vi.fn()` so the test can assert that AlarmSession invoked the returned cleanup during `endAlarmSession`.
- `acquireWakeLock` defaults to `mockResolvedValue(undefined)`. For the failure-swallow test, override per-test with `vi.mocked(acquireWakeLock).mockRejectedValueOnce(new DOMException('NotAllowedError'))` and assert that `startAlarmSession()` resolves (does NOT reject). NOTE: the real wakeLock.ts already swallows internally, so to truly exercise the "swallow profile" guarantee in AlarmSession's test, the mock must be set to reject — which simulates a hypothetical future leak. This is a defensive test of the contract, per D-05.
- For `getAudioContext` rejection (the propagation case), per-test override with `mockRejectedValueOnce(new Error('AC failed'))` and assert `await expect(startAlarmSession()).rejects.toThrow('AC failed')`.

**Call-order assertion idiom** — extracted from `src/engine/__tests__/AlarmEngine.test.ts:110-117` and `:226-242` (re-imports the mocked module, asserts toHaveBeenCalledTimes/toHaveBeenCalledWith):
```typescript
it('start() starts keepalive oscillator', async () => {
  const { startKeepalive } = await import('../sounds/keepalive');
  const engine = new AlarmEngine();

  await startEngine(engine);

  expect(startKeepalive).toHaveBeenCalledTimes(1);
});

it('start() calls acquireWakeLock', async () => {
  const { acquireWakeLock } = await import('../../platform/wakeLock');
  const engine = new AlarmEngine();

  await startEngine(engine);

  expect(acquireWakeLock).toHaveBeenCalledTimes(1);
});
```

**Pattern to replicate:**
- Dynamic-import the mocked module inside each test (`const { fn } = await import(...)`) so TS gets the typed handle and the same instance Vitest registered the mock against.
- Use `toHaveBeenCalledTimes(1)` for "called exactly once" and `toHaveBeenCalledWith(...)` for argument shape.
- For *order* between two mocks (e.g., "keepalive starts before wake lock acquires"), use `mockX.mock.invocationCallOrder[0] < mockY.mock.invocationCallOrder[0]`. This idiom is NOT yet present in the codebase — introduce it cleanly in AlarmSession.test.ts only if the planner deems strict ordering critical (D-05 requires the order, so a dedicated assertion is warranted).

**Fake-timers / setup pattern** — `src/engine/__tests__/AlarmEngine.test.ts:78-87`:
```typescript
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal('navigator', { vibrate: vi.fn() }); // default: vibrate supported
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
```

**Pattern to replicate:**
- Even though AlarmSession itself does not use timers, keep `vi.useFakeTimers()` for consistency with AlarmEngine.test.ts (no harm; cheap insurance against future timer additions).
- `vi.clearAllMocks()` in `beforeEach` is essential — without it, the call-count assertions across tests are unreliable.
- `vi.stubGlobal('navigator', ...)` is needed because `wakeLock.ts` checks `'wakeLock' in navigator` at import-time-ish; the mock above sidesteps this, but if any test wants to test the real path, this is the lever.

**Pattern to deviate from:**
- The AlarmEngine test uses a `startEngine` helper (lines 70-75) to flush the `getAudioContext` promise. AlarmSession's tests can `await startAlarmSession()` directly — no helper needed since there's no `_running` guard / setup wrapping.

---

### `src/engine/AlarmEngine.ts` (MODIFIED — `start()` and `cleanup()` only)

**Role:** Same class as before, but `start()` and `cleanup()` delegate the four lifecycle responsibilities to AlarmSession. Phase scheduling, phase 2/3 audio, pause/resume, and the `_running` guard stay where they are.

**Analog:** the file itself — the "before" is the existing code at the diff sites.

**Private fields to remove (or leave; D-08 trailing note) — `src/engine/AlarmEngine.ts:42-54`:**
```typescript
export class AlarmEngine {
  private ac: AudioContext | null = null;
  private phase: AlarmPhase = 'idle';
  private _running: boolean = false; // true from start() until stop()/dismiss()
  private _paused: boolean = false;
  private timers: TimerHandle[] = [];
  private keepaliveOsc: OscillatorNode | null = null;          // ← becomes unused
  private phase3RampGain: GainNode | null = null;
  private phase3SwellNodes: OscillatorNode[] | null = null;
  private phase3LoopTimer: ReturnType<typeof setInterval> | null = null;
  private phaseCallback: PhaseChangeCallback | null = null;

  // Phase 2 state (Background Reliability)
  private visibilityCleanup: (() => void) | null = null;       // ← becomes unused
```

**Pattern to replicate:** add a new private field `private session: SessionHandle | null = null;` next to `ac`. Per D-02, `SessionHandle` is `{ readonly ac: AudioContext }`, so `this.ac = this.session.ac` is the pattern.

**Pattern to deviate from:** delete `keepaliveOsc` and `visibilityCleanup` field declarations — they are no longer referenced after the refactor (D-08 trailing note recommends removal). Removal is preferred over keeping dead fields.

---

**`start()` diff site — `src/engine/AlarmEngine.ts:96-112` (lines 104–111 are the four explicit calls to replace):**
```typescript
async start(config: AlarmConfig): Promise<void> {
  validateConfig(config); // throws on invalid durations (T-01-04)

  if (this._running) {
    throw new Error('AlarmEngine already running');
  }
  this._running = true;

  this.ac = await getAudioContext();

  // Start silent keepalive oscillator to keep AudioContext alive on mobile (AUD-04)
  this.keepaliveOsc = startKeepalive(this.ac);

  // Acquire Wake Lock to keep screen on during active timer (PLT-02)
  await acquireWakeLock();
  this.visibilityCleanup = attachVisibilityReacquire();
```

**Replacement pattern (per `<code_context>` line 146):**
```typescript
async start(config: AlarmConfig): Promise<void> {
  validateConfig(config);

  if (this._running) {
    throw new Error('AlarmEngine already running');
  }
  this._running = true;

  this.session = await startAlarmSession();
  this.ac = this.session.ac;
```

**Pattern to replicate:**
- The `_running` guard stays *before* `startAlarmSession()` (D-03: AlarmSession has no internal reentrancy guard; the existing engine guard is the only one).
- Re-throw behavior is unchanged: `await startAlarmSession()` will reject on `getAudioContext()` failure exactly as the old `await getAudioContext()` did (D-05).
- `validateConfig(config)` MUST run *before* the `_running = true` assignment — preserving today's order so a bad config does not leave the engine in a "running" state.

---

**`cleanup()` diff site — `src/engine/AlarmEngine.ts:360-394`:**
```typescript
private cleanup(): void {
  this._running = false;
  this._paused = false;
  this.pauseSnapshot = null;
  this.activeConfig = null;

  // Cancel all pending timers (phase1, phase2, phase3 transitions)
  this.timers.forEach((t) => t.cancel());
  this.timers = [];

  // Stop silent keepalive oscillator
  if (this.keepaliveOsc) {
    stopKeepalive(this.keepaliveOsc);
    this.keepaliveOsc = null;
  }

  // Stop Phase 2 vibration (safe no-op if not started or not supported — T-02-01)
  stopVibration();

  // Stop Phase 2 tick loop (T-02-02: prevents orphaned audio nodes)
  if (this.tickLoopTimer !== null) {
    clearInterval(this.tickLoopTimer);
    this.tickLoopTimer = null;
  }
  if (this.tickGain) {
    this.tickGain.disconnect();
    this.tickGain = null;
  }

  // Release Wake Lock (PLT-02)
  releaseWakeLock();
  if (this.visibilityCleanup) {
    this.visibilityCleanup();
    this.visibilityCleanup = null;
  }
```

**Replacement pattern:**
- Delete the three blocks that handle keepalive / wake lock / visibility (lines 370–374 and 389–394). Replace with one guarded call:
  ```typescript
  if (this.session) {
    endAlarmSession(this.session);
    this.session = null;
  }
  ```
- Keep this in roughly the same location — between the timer cancellation and the Phase 2 vibration teardown — to preserve the visible call order on stop/dismiss (D-04 byte-identical teardown timing). The exact line is Claude's Discretion; placing it where the keepalive teardown was (after `this.timers = []`) is the smallest diff.
- Phase 2 vibration / tick-loop / tickGain teardown (lines 376–387) and Phase 3 swell / fadeOut teardown (lines 396–416) STAY UNTOUCHED — those are not session-owned (D-06).

**Pattern to deviate from:** the old `if (this.keepaliveOsc) { ... this.keepaliveOsc = null; }` guard pattern. The new pattern uses `if (this.session)` — same shape, same null-out — because `cleanup()` is called by both `stop()` and `dismiss()` and may be invoked when `start()` never completed (e.g., AC creation failed). The `if (this.session)` guard handles that case.

---

**Imports to remove (`src/engine/AlarmEngine.ts:36-38`):**
```typescript
import { startKeepalive, stopKeepalive } from './sounds/keepalive';
// (line 37 stays — playTick is still used by enterPhase2)
import { acquireWakeLock, releaseWakeLock, attachVisibilityReacquire } from '../platform/wakeLock';
```

**Replacement:** `import { startAlarmSession, endAlarmSession, type SessionHandle } from './AlarmSession';`

Note: `playTick` (line 37) is still used inside `enterPhase2`; do NOT remove that import.

---

### `src/engine/index.ts` (MODIFIED — append-only)

**Role:** Public barrel. Adds three exports for AlarmSession; everything else stays for SEG-05 (D-08).

**Analog:** the file itself.

**Current full content — `src/engine/index.ts:1-29`:**
```typescript
/**
 * Public API barrel export for the alarm engine.
 *
 * This is the single import point for Phase 3 React integration.
 * Import from 'src/engine' (not from individual files) to maintain
 * a stable public API surface as implementation details evolve.
 *
 * @example
 * import { AlarmEngine, AlarmPhase, AlarmConfig, DEFAULT_CONFIG, QUICK_NAP_CONFIG, FOCUS_CONFIG } from '../engine';
 */

export { AlarmEngine } from './AlarmEngine';
export type {
  AlarmPhase,
  AlarmConfig,
  PhaseChangeCallback,
} from './AlarmState';
export {
  DEFAULT_CONFIG,
  QUICK_NAP_CONFIG,
  FOCUS_CONFIG,
  validateConfig,
} from './AlarmState';
export { getAudioContext } from './AudioContext';
export { playTestSound, TEST_SOUND_GAIN } from './sounds/testSound';
export { playTick } from './sounds/tickPulse';
export { startVibration, stopVibration } from '../platform/vibration';
export { acquireWakeLock, releaseWakeLock, attachVisibilityReacquire } from '../platform/wakeLock';
```

**Pattern to replicate:**
- Append two new lines after line 28, mirroring the existing two-line pattern (one for value exports, one for type-only):
  ```typescript
  export { startAlarmSession, endAlarmSession } from './AlarmSession';
  export type { SessionHandle } from './AlarmSession';
  ```
- Per D-08, the existing `acquireWakeLock` / `releaseWakeLock` / `attachVisibilityReacquire` re-exports on line 28 STAY. Do not remove them — that would diff a SEG-05-protected public surface.
- Keep `export type` separate from `export` — the codebase enforces this style elsewhere (line 13–17 already separates AlarmState's value vs type exports).

---

### `src/engine/__tests__/AlarmEngine.test.ts` (MODIFIED — extend, do not rewrite)

**Role:** Existing engine regression tests; new assertions for the AlarmSession wiring (the `_running` guard still works; QUICK_NAP_CONFIG and FOCUS_CONFIG end-to-end phase transitions; pause/resume snapshot semantics).

**Analog:** the file itself — see the full pattern review above in the "AlarmSession.test.ts" entry; the same mock setup, fake-timer setup, and `startEngine` helper apply here unchanged.

**Pattern to replicate:**
- KEEP every existing test (lines 89–414) verbatim. SEG-05 means the existing assertions are the regression net.
- ADD new tests in the same file for: (1) `start()` calls `startAlarmSession` exactly once via the wiring (you can assert this through the existing keepalive/wakeLock mocks — they should still be called once each, since AlarmSession calls them), (2) `cleanup()` calls `endAlarmSession` (again indirectly via `stopKeepalive` + `releaseWakeLock` mocks — both should still be called once), (3) FOCUS_CONFIG end-to-end phase transition order matches QUICK_NAP_CONFIG (the existing test on lines 164–182 uses DEFAULT_CONFIG; extend to also run with `FOCUS_CONFIG` and `QUICK_NAP_CONFIG`).
- The `startEngine` helper (lines 70–75) handles the `getAudioContext` microtask flush. Reuse it — do not duplicate.

**Pattern to deviate from:** none. This is a pure extension; the file's test scaffolding does not change.

**No new mocks needed** — the existing `vi.mock('../sounds/keepalive', ...)`, `vi.mock('../../platform/wakeLock', ...)`, and `vi.mock('../AudioContext', ...)` covers everything AlarmSession touches (since AlarmSession is exercised *through* AlarmEngine, and its dependencies are the same three mocked modules).

---

### `.planning/phases/06-.../06-REGRESSION-CHECKLIST.md` (NEW — doc only)

**Role:** On-device manual regression matrix (D-07 secondary). Markdown checklist; not a CI gate.

**Analog:** none. The repo has no prior on-device test checklist. Author from CONTEXT.md `<specifics>` lines 189–195. Use plain `## Section / - [ ] Item` markdown — no special pattern needed.

---

## Shared Patterns

### Failure profile preservation (SEG-05 cross-cutting)

**Source:** `src/platform/wakeLock.ts:42-55` (the `try/catch + console.debug` swallow that already exists).
**Apply to:** AlarmSession (do NOT re-wrap), AlarmSession.test.ts (assert no propagation).

The existing wake-lock acquire-failure swallow is internal to `wakeLock.ts`. AlarmSession must NOT add a redundant `try/catch` around `acquireWakeLock()` — that would either double-log or shadow a real future bug. Instead, AlarmSession's contract test asserts that even if the mocked `acquireWakeLock` rejects, `startAlarmSession()` still resolves (defensive contract test).

### vi.mock dependency stubbing (test pattern)

**Source:** `src/engine/__tests__/AlarmEngine.test.ts:6-65`.
**Apply to:** `src/engine/__tests__/AlarmSession.test.ts`.

Three `vi.mock` blocks at the top of the file (`../AudioContext`, `../sounds/keepalive`, `../../platform/wakeLock`), each returning `vi.fn()` mocks with the same signatures the real exports use. The `attachVisibilityReacquire` mock returns `vi.fn()` so the test can later assert it was invoked during teardown.

### Fake-timers + global stubbing (test pattern)

**Source:** `src/engine/__tests__/AlarmEngine.test.ts:78-87`.
**Apply to:** `src/engine/__tests__/AlarmSession.test.ts`.

`beforeEach: useFakeTimers + clearAllMocks + stubGlobal('navigator', ...)` and `afterEach: useRealTimers + unstubAllGlobals`. AlarmSession itself doesn't schedule timers, but the pattern is the project's convention for engine-adjacent tests; keep it for consistency.

### "Cleanup function returned by attach" pattern

**Source:** `src/platform/wakeLock.ts:79-87`.
**Apply to:** AlarmSession internals (the `releaseVisibility` field on `SessionInternals`).

`attachVisibilityReacquire()` returns its own cleanup. AlarmSession stores that returned function on the WeakMap-keyed internals and calls it during `endAlarmSession`. No reimplementation of removeEventListener.

### Try/catch around teardown of resources that may already be closed

**Source:** `src/engine/sounds/keepalive.ts:46-52` and `src/engine/AlarmEngine.ts:213-218`.
**Apply to:** AlarmSession's `endAlarmSession` (already covered by `stopKeepalive`'s internal try/catch — do not double-wrap).

The pattern is: callees own their own "already-stopped" safety. AlarmSession just calls them in order; it does not need its own try/catch unless we want to guarantee that one teardown step's failure does not block the next. Per D-04 (synchronous, fire-and-forget), do not add a try/catch — match `AlarmEngine.cleanup()`'s current style which also does not wrap.

## No Analog Found

| File | Role | Reason |
|------|------|--------|
| `.planning/.../06-REGRESSION-CHECKLIST.md` | doc | No prior on-device checklist exists in the repo. Author fresh from CONTEXT.md `<specifics>` and ROADMAP success criterion #4. |

## Metadata

**Analog search scope:** `src/engine/`, `src/engine/sounds/`, `src/engine/__tests__/`, `src/engine/sounds/__tests__/`, `src/platform/`.
**Files scanned:** 7 (AlarmEngine.ts, AlarmSession-target deps × 3, two existing test files, AlarmContext, index barrel).
**Pattern extraction date:** 2026-05-06.
