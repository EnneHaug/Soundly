# Phase 6: AlarmSession Refactor + v1 Regression Guard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 06-alarmsession-refactor-v1-regression-guard
**Areas discussed:** AlarmSession API shape

---

## Gray Area Selection

| Gray Area | Selected |
|-----------|----------|
| AlarmSession API shape | ✓ |
| Ownership boundary (what's in vs out) | |
| v1 regression-guard mechanism | |
| Public API / barrel exports | |

**User selected only "AlarmSession API shape".** The other three gray areas were left to Claude's Discretion in CONTEXT.md (D-06 ownership boundary, D-07 regression mechanism, D-08 barrel exports — all chose the recommended-default position).

---

## AlarmSession API shape

### Q1 — State passing between start/end

| Option | Description | Selected |
|--------|-------------|----------|
| Handle pattern (Recommended) | startAlarmSession() returns a session handle ({ ac, ...internals }); endAlarmSession(handle) accepts it and tears down. No module globals. Maps cleanly onto Phase 7's SegmentEngine + AlarmEngine each holding its own session ref. | ✓ |
| Module-level state | Mirrors keepalive.ts / wakeLock.ts where module globals hold _ctx / _sentinel. Simpler call sites; couples to one-active-session-at-a-time. | |
| End as a method on the handle | startAlarmSession() returns { ac, end }; caller calls handle.end(). Eliminates the bare endAlarmSession function — would bend the goal text slightly. | |

**User's choice:** Handle pattern (Recommended)
**Notes:** Locked as D-01.

### Q2 — Handle return shape

| Option | Description | Selected |
|--------|-------------|----------|
| Just { ac } (Recommended) | Handle exposes only the AudioContext. Keepalive osc, Wake Lock sentinel, visibility cleanup are held internally (closure or WeakMap) and reached via endAlarmSession(handle). Matches "AlarmSession is single owner". | ✓ |
| { ac } + opaque internals slot | Same as above but with an explicit opaque internals slot, e.g. { ac, _internal: SessionInternals }. Slightly more discoverable in TS. | |
| Expose individual handles | { ac, keepaliveOsc, visibilityCleanup, releaseLock } — caller can stop individual pieces. Breaks the "single owner" invariant. | |

**User's choice:** Just { ac } (Recommended)
**Notes:** Locked as D-02. Implementation choice between WeakMap and Symbol-keyed property left as Claude's Discretion.

### Q3 — Reentrancy guard

| Option | Description | Selected |
|--------|-------------|----------|
| Trust the caller (Recommended) | No internal guard. AlarmEngine already has _running; SegmentEngine will have its own. Pre-existing wakeLock _sentinel leak in v1 is NOT Phase 6's problem. | ✓ |
| Throw on double-start | startAlarmSession() rejects if any session is active. Requires module-level "is-active" flag — contradicts handle pattern. | |
| Idempotent / first-wins | Second call returns existing handle. Requires module-level state. | |

**User's choice:** Trust the caller (Recommended)
**Notes:** Locked as D-03. Pre-existing wakeLock _sentinel overwrite-without-release captured in Deferred Ideas.

### Q4 — Sync vs async teardown

| Option | Description | Selected |
|--------|-------------|----------|
| Sync, returns void (Recommended) | endAlarmSession(handle): void. Matches AlarmEngine.cleanup()'s current sync style. Wake Lock release stays fire-and-forget. Zero behavioral diff for SEG-05. | ✓ |
| Async, returns Promise<void> | endAlarmSession(handle): Promise<void> awaiting Wake Lock release. Slightly more correct but changes cleanup timing — risks tiny behavior shift on rapid stop→restart. | |

**User's choice:** Sync, returns void (Recommended)
**Notes:** Locked as D-04. SEG-05 zero-diff is the deciding factor.

---

## Wrap-up question

| Option | Description | Selected |
|--------|-------------|----------|
| Write CONTEXT.md now (Recommended) | Decisions captured are sufficient for the planner. Other gray areas become Claude's Discretion. | ✓ |
| Discuss regression-guard mechanism | Drill into automated test vs manual runbook. | |
| Discuss ownership boundary | Confirm exactly what moves vs stays. | |
| More questions on API shape | TS naming, sessionId, etc. | |

**User's choice:** Write CONTEXT.md now (Recommended)

---

## Claude's Discretion

The following gray areas were left for Claude / the planner to decide along the recommended-default position recorded in CONTEXT.md:

- **Ownership boundary** — locked default: AlarmSession owns *only* AC + keepalive + Wake Lock + visibility re-acquire (D-06). Phase 2/3 audio teardown stays in AlarmEngine.
- **Regression-guard mechanism** — locked default: automated tests on Quick Nap + Focus end-to-end as the primary CI gate, plus a written on-device manual checklist as documentation (D-07).
- **Barrel exports** — locked default: add `startAlarmSession` / `endAlarmSession` / `SessionHandle` to `src/engine/index.ts`; keep existing wakeLock re-exports (D-08).
- **Internal state implementation** — WeakMap vs Symbol-keyed property: pick whichever is most idiomatic in TS strict mode (D-02 commentary).
- **AlarmEngine private-field cleanup** — whether to delete the now-unused `keepaliveOsc` and `visibilityCleanup` fields, or leave for a follow-up.

## Deferred Ideas

- `acquireWakeLock` `_sentinel` overwrite bug (pre-existing v1)
- iOS AudioContext resume on `visibilitychange`
- Pause-aware session lifecycle
- Multi-active-session support
- Removing wakeLock primitive re-exports from the engine barrel
