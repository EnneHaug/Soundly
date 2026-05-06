# Phase 6: AlarmSession Refactor + v1 Regression Guard - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract the shared **alarm session lifecycle** — AudioContext bring-up, silent keepalive, Wake Lock acquisition + visibility re-acquire, and matching teardown — out of `AlarmEngine` into a new pure-function module `src/engine/AlarmSession.ts`. The new module exposes `startAlarmSession()` / `endAlarmSession()`. `AlarmEngine.start()` and `AlarmEngine.cleanup()` are rewired to call into it, while every v1 user-visible behavior of Quick Nap and Focus stays byte-identical.

This phase is purely a structural refactor + regression guard — no new user-facing capability. Its sole job is to give Phase 7's SegmentEngine a place to share session-lifecycle code instead of duplicating it.

**In scope:**
- New file `src/engine/AlarmSession.ts` (function pair + `SessionHandle` type)
- Modifications to `src/engine/AlarmEngine.ts` (`start()` + `cleanup()` only — call into AlarmSession)
- New / extended tests proving v1 byte-identical behavior for Quick Nap and Focus
- Barrel export adjustments in `src/engine/index.ts`

**Explicitly out of scope (SEG-05 zero-diff floor):**
- Any change to `src/engine/AlarmState.ts` (`AlarmConfig`, `validateConfig`, `QUICK_NAP_CONFIG`, `FOCUS_CONFIG`)
- Any change to `src/hooks/useAlarm.ts`
- Any change to `src/components/Countdown.tsx` or `src/components/ProgressRing.tsx`
- Any change to existing files under `src/engine/sounds/*.ts`
- Any change to `src/platform/wakeLock.ts`, `src/platform/vibration.ts`, `src/platform/notifications.ts`, or `src/engine/AudioContext.ts` (these are *consumed* by AlarmSession — not modified)
- Any new user-facing feature (segment engine, triangle sound, composer UI, share-via-URL — all belong to later phases)

</domain>

<decisions>
## Implementation Decisions

### AlarmSession API shape

- **D-01 (LOCKED):** AlarmSession exposes the function pair literally named in the goal: `startAlarmSession(): Promise<SessionHandle>` and `endAlarmSession(handle: SessionHandle): void`. **Handle pattern** — start returns a session handle; end accepts it. **No module-level state** in `AlarmSession.ts` (unlike `keepalive.ts`/`wakeLock.ts` which keep singletons). Each engine instance holds its own handle.

- **D-02 (LOCKED):** `SessionHandle` is publicly `{ readonly ac: AudioContext }` and **nothing else**. Internals required for teardown (keepalive `OscillatorNode`, the `releaseLock`/`releaseVisibility` callbacks) are held privately and looked up by `endAlarmSession(handle)`. Implementation choice between (a) closure capture in start + a module-internal `WeakMap<SessionHandle, Internals>`, or (b) a `Symbol`-keyed non-enumerable property on the handle, is Claude's Discretion — pick whichever is most idiomatic in TS strict mode. Callers MUST NOT be able to selectively tear down pieces.

- **D-03 (LOCKED):** **No internal reentrancy guard** inside AlarmSession. Calling `startAlarmSession()` twice without an intervening `endAlarmSession()` is a programming error; AlarmSession does not police it. Reentrancy guards stay where they already live (`AlarmEngine._running` today; future SegmentEngine will add its own).

- **D-04 (LOCKED):** `endAlarmSession(handle)` is **synchronous, returns `void`**. It does NOT await the Wake Lock release Promise — fire-and-forget, matching `AlarmEngine.cleanup()`'s current style. Required for SEG-05 byte-identical teardown timing on stop / dismiss / rapid-restart.

### Failure profile (must mirror v1 exactly — SEG-05)

- **D-05:** `startAlarmSession()` MUST preserve the v1 rejection/swallow profile **byte-for-byte**:
  - `getAudioContext()` rejection → propagates out of `startAlarmSession()` (today `AlarmEngine.start()` rejects the same way)
  - `acquireWakeLock()` failure (DOMException, unsupported browser) → swallowed silently with `console.debug` log (existing behavior in `src/platform/wakeLock.ts`)
  - `attachVisibilityReacquire()` and `startKeepalive()` → never throw under normal operation
  - The order of operations MUST be: AC bring-up → keepalive start → Wake Lock acquire → visibility listener attach. Matches `AlarmEngine.start()` lines 104–111.

### Ownership boundary (what moves vs what stays)

- **D-06:** AlarmSession owns **only** these four lifecycle responsibilities, in this exact order on start, reverse on end:
  1. AudioContext bring-up (call `getAudioContext()`)
  2. Silent keepalive oscillator (`startKeepalive` / `stopKeepalive`)
  3. Wake Lock sentinel (`acquireWakeLock` / `releaseWakeLock`)
  4. Visibility re-acquire listener (`attachVisibilityReacquire` and its returned cleanup)

  Everything else stays in `AlarmEngine`. Specifically: phase timer scheduling, `setPhase`, Phase 2 vibration/tick loop and its teardown, Phase 3 swell loop and its teardown, `fadeOutGain` on stop, pause/resume snapshot logic, the `_running` guard, and notification permission requests (which already live in `useAlarm.ts`, not the engine).

### Test / regression-guard strategy

- **D-07:** The "documented v1 regression check" (Phase 6 success criterion #4) is delivered as **automated tests** (primary) plus a **short on-device manual checklist** (secondary, written but not required to run as a CI gate).

  - Primary: extend the existing `src/engine/__tests__/AlarmEngine.test.ts` (and add `src/engine/__tests__/AlarmSession.test.ts` for the new module). Use Vitest fake timers (`vi.useFakeTimers()`) and the existing AudioContext mocking pattern. Cover both `QUICK_NAP_CONFIG` and `FOCUS_CONFIG` end-to-end:
    - Phase transition order: idle → phase1 → phase2 → phase3
    - Phase fire times match each preset's configured durations exactly
    - `strikeBowl` is called once at phase 1 fire time
    - Phase 2 dispatches to `startVibration` (when `'vibrate' in navigator`) OR creates a tick `GainNode` + tick loop interval (otherwise) — both code paths covered
    - Phase 3 creates the ramp gain + swell stack and starts the 3.2 s loop interval
    - `acquireWakeLock` is called once during start; `releaseWakeLock` is called once during cleanup
    - `startKeepalive` is called once during start; `stopKeepalive` is called once during cleanup
    - Pause/resume snapshot semantics for each entry phase (idle, phase1, phase2, phase3) match pre-refactor behavior

  - Secondary: a short markdown checklist at `.planning/phases/06-alarmsession-refactor-v1-regression-guard/06-REGRESSION-CHECKLIST.md` capturing the on-device matrix (Quick Nap launches → fires Phase 1 → 2 → 3 with correct durations and audio; Focus repeats at its longer cadence; screen stays awake during timer). The checklist exists as documentation; running it on real devices is recommended but not a CI gate.

### Barrel exports

- **D-08:** `src/engine/index.ts` adds: `startAlarmSession`, `endAlarmSession`, and `SessionHandle` (type-only). Existing exports stay unchanged for SEG-05 — including the current re-exports of `acquireWakeLock`, `releaseWakeLock`, `attachVisibilityReacquire`, which remain on the public surface for any v1 consumer that imports them. AlarmSession does not "hide" wake-lock primitives behind itself; it is a higher-level convenience that happens to call them.

### Claude's Discretion

- Internal-state implementation (WeakMap vs Symbol-keyed property vs other) — pick the cleanest TS strict-mode option. Prefer WeakMap over `Symbol`-keyed property if it reads more naturally.
- Exact name and shape of the internal type (`SessionInternals`, `Internals`, etc.) — non-exported, name doesn't matter.
- Whether `AlarmSession.test.ts` tests AlarmSession in isolation (mocking keepalive/wakeLock/AudioContext) or only end-to-end through `AlarmEngine.test.ts`. Recommendation: do both — small unit test for AlarmSession + the regression test extension on AlarmEngine.
- The exact wording, scope, and granularity of the on-device manual checklist (D-07 secondary).
- Whether to keep the `AlarmEngine` private fields `keepaliveOsc` and `visibilityCleanup` (no longer needed once delegated to AlarmSession) or remove them as part of this refactor. Removal is preferable (no dead code), but only if it doesn't widen the diff in a way that risks regression.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project / milestone
- `.planning/PROJECT.md` — milestone v2.0 scope; v1 zero-diff posture
- `.planning/REQUIREMENTS.md` — `SEG-05` definition (the zero-diff requirement)
- `.planning/ROADMAP.md` §"Phase 6: AlarmSession Refactor + v1 Regression Guard" — goal + 4 success criteria
- `.planning/STATE.md` — accumulated decisions, esp. "v1 zero-diff guarantee (SEG-05) is a hard floor across Phases 6–11"
- `CLAUDE.md` — stack (React 19 / Vite 6 / TS 5 strict / raw Web Audio API, no Tone.js), Wake Lock + Vibration + Notifications API caveats, background keepalive strategy

### Files modified by this phase
- `src/engine/AlarmEngine.ts` — `start()` (lines 96–149) and `cleanup()` (lines 360–417) are rewired to call AlarmSession; the rest of the class is untouched
- `src/engine/index.ts` — barrel export adds new AlarmSession surface (D-08)

### Files created by this phase
- `src/engine/AlarmSession.ts` — new module (function pair + `SessionHandle` type)
- `src/engine/__tests__/AlarmSession.test.ts` — new unit tests
- `.planning/phases/06-alarmsession-refactor-v1-regression-guard/06-REGRESSION-CHECKLIST.md` — on-device manual matrix

### Files consumed (NOT modified)
- `src/engine/AudioContext.ts` — `getAudioContext()`; AlarmSession calls it
- `src/engine/sounds/keepalive.ts` — `startKeepalive` / `stopKeepalive`; AlarmSession calls them
- `src/platform/wakeLock.ts` — `acquireWakeLock` / `releaseWakeLock` / `attachVisibilityReacquire`; AlarmSession calls them
- `src/engine/__tests__/AlarmEngine.test.ts` — the existing engine test (extended, not rewritten)

### Files protected by SEG-05 (zero diff)
- `src/engine/AlarmState.ts` — `AlarmConfig`, `validateConfig`, `QUICK_NAP_CONFIG`, `FOCUS_CONFIG`, `PhaseChangeCallback`
- `src/hooks/useAlarm.ts`
- `src/components/Countdown.tsx`
- `src/components/ProgressRing.tsx`
- All existing files under `src/engine/sounds/*.ts` (singingBowl, phase3Tone, keepalive, testSound, tickPulse, and their tests)

### Prior-phase context
- `.planning/phases/01-audio-engine-and-timer/01-CONTEXT.md` — AlarmEngine origin, factory-pattern decision (OscillatorNode cannot restart), AC singleton design
- `.planning/phases/02-background-reliability/02-CONTEXT.md` — Wake Lock + keepalive + visibility re-acquire integration history; current ownership (currently lives on AlarmEngine instance fields)
- `.planning/phases/05-ios-audio-loudness-fixes/05-CONTEXT.md` — D-01 iOS `audioSession.type = 'playback'` is set inside `getAudioContext()`, so AlarmSession inherits it for free; no extra branching needed

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets (consumed unchanged)
- `getAudioContext()` (`src/engine/AudioContext.ts:23`) — singleton AC factory; iOS audioSession set on creation
- `startKeepalive(ac)` / `stopKeepalive(osc)` (`src/engine/sounds/keepalive.ts`) — pure-function pair, no module state
- `acquireWakeLock()` / `releaseWakeLock()` / `attachVisibilityReacquire()` (`src/platform/wakeLock.ts`) — module-state-backed (single sentinel + `_shouldHoldLock` flag)

### Established patterns
- Pure-function modules with optional module-level singleton state (`keepalive.ts`: stateless; `wakeLock.ts`: holds `_sentinel` + `_shouldHoldLock`). AlarmSession deliberately breaks from the singleton-state pattern (D-01) — handle pattern only.
- `AlarmEngine` is a class with private instance fields; it is a state machine, AlarmSession is not.
- Tests use Vitest with the existing AudioContext mock pattern (see `src/engine/sounds/__tests__/phase3Tone.test.ts` and `src/engine/__tests__/AlarmEngine.test.ts`).
- `OscillatorNode` cannot restart after `.stop()` — factory pattern (`new OscillatorNode(...)` per use). AlarmSession's keepalive uses this through the existing `startKeepalive` helper, no new code needed.

### Integration points (where the diff lands)
- `AlarmEngine.start()` lines 104–111: replace the four explicit calls (`getAudioContext` / `startKeepalive` / `acquireWakeLock` / `attachVisibilityReacquire`) with `const session = await startAlarmSession(); this.session = session; this.ac = session.ac;`
- `AlarmEngine.cleanup()` lines 360–394: replace `stopKeepalive(this.keepaliveOsc)` + `releaseWakeLock()` + the `visibilityCleanup()` invocation with a single `endAlarmSession(this.session)` call. Phase 2/3 audio teardown stays.
- `AlarmEngine` private fields: `keepaliveOsc` and `visibilityCleanup` become unused — Claude's Discretion whether to delete or leave (D-08 trailing note).
- `src/engine/index.ts`: append `export { startAlarmSession, endAlarmSession } from './AlarmSession';` and `export type { SessionHandle } from './AlarmSession';`.

### Pre-existing v1 quirks (NOT fixed in Phase 6)
- `src/platform/wakeLock.ts:44–46`: `acquireWakeLock()` overwrites `_sentinel` without releasing the previous one if called twice. Real bug, but pre-existing v1 behavior — leave alone for SEG-05. Captured in Deferred Ideas.
- iOS Safari may suspend the AudioContext on screen lock even with the keepalive oscillator running (per CLAUDE.md keepalive notes). The visibility re-acquire listener handles Wake Lock but does NOT call `_ctx.resume()` on `visibilitychange`. Pre-existing; captured in Deferred Ideas.

</code_context>

<specifics>
## Specific Ideas

- Suggested skeleton (Claude's Discretion on exact form):
  ```ts
  export interface SessionHandle { readonly ac: AudioContext }
  interface SessionInternals { keepaliveOsc: OscillatorNode; releaseVisibility: () => void }
  const internals = new WeakMap<SessionHandle, SessionInternals>();

  export async function startAlarmSession(): Promise<SessionHandle> {
    const ac = await getAudioContext();
    const keepaliveOsc = startKeepalive(ac);
    await acquireWakeLock();
    const releaseVisibility = attachVisibilityReacquire();
    const handle: SessionHandle = { ac };
    internals.set(handle, { keepaliveOsc, releaseVisibility });
    return handle;
  }

  export function endAlarmSession(handle: SessionHandle): void {
    const i = internals.get(handle);
    if (!i) return; // double-end / unknown handle — no-op
    stopKeepalive(i.keepaliveOsc);
    releaseWakeLock();
    i.releaseVisibility();
    internals.delete(handle);
  }
  ```
  This is illustrative; final shape can vary as long as D-01 through D-06 are honored.

- Test stubbing approach: keep `vi.mock('./sounds/keepalive', ...)`, `vi.mock('../platform/wakeLock', ...)`, `vi.mock('./AudioContext', ...)` so AlarmSession unit tests can spy on call order without instantiating real AudioNodes. The end-to-end AlarmEngine test extension can keep the same mocks already in place.

- Regression checklist (06-REGRESSION-CHECKLIST.md) sections, suggested:
  1. Quick Nap on desktop Chrome — phases fire on time, audio audible, Wake Lock holds the screen on
  2. Quick Nap on Android Chrome — phase 2 vibrates, Wake Lock holds the screen on
  3. Focus on desktop Chrome — same as Quick Nap but at the longer cadence
  4. Pause / resume during phase 1, phase 2, phase 3 — audio resumes at the right point, total elapsed extends by the pause duration
  5. iOS Safari (best-effort, expected partial — the locked-screen limitation is acknowledged in v2.0 LAND-05 and is not Phase 6's concern)

- Failure profile assertions: tests SHOULD assert that `acquireWakeLock` returning a rejected Promise does NOT cause `startAlarmSession()` to reject (existing swallow behavior in wakeLock.ts is what we preserve).

</specifics>

<deferred>
## Deferred Ideas

- **`acquireWakeLock` `_sentinel` overwrite bug** — pre-existing v1 behavior in `src/platform/wakeLock.ts`. Reentrant `acquireWakeLock()` call leaks the previous sentinel. Deliberately NOT fixed in Phase 6 (would diff a SEG-05-protected file path). Candidate for v2.x backlog.
- **iOS AudioContext resume on `visibilitychange`** — current visibility re-acquire listener only re-acquires Wake Lock, not the AC itself. Could materially help iOS reliability but is a behavior change, not a refactor. Candidate for a future v2.x or v3.x phase, possibly bundled with the Capacitor / Option B exploration noted in Phase 5 deferred.
- **Pause-aware session lifecycle** — today, `AlarmEngine.pause()` does NOT tear down keepalive or release Wake Lock; the silent oscillator runs through pause to keep AC alive (intentional, see line 273). If Phase 7's SegmentEngine wants different pause semantics, that's a Phase 7 conversation, not a Phase 6 one.
- **Multi-active-session support** — AlarmSession's no-internal-state design (D-01) makes this technically possible, but `wakeLock.ts`'s singleton sentinel makes it actually broken today. Out of scope for v2.0.
- **Removing the `acquireWakeLock` / `releaseWakeLock` / `attachVisibilityReacquire` re-exports from `src/engine/index.ts`** — they could become AlarmSession-internal once no v1 caller imports them. Worth a future cleanup, but doing it in Phase 6 risks widening the diff into SEG-05-protected callers. Defer.

</deferred>

---

*Phase: 06-alarmsession-refactor-v1-regression-guard*
*Context gathered: 2026-05-06*
