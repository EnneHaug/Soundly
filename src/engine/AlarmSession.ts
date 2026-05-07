/**
 * AlarmSession — shared alarm session lifecycle.
 *
 * Owns four lifecycle responsibilities (D-06):
 *   1. AudioContext bring-up
 *   2. Silent keepalive oscillator
 *   3. Wake Lock sentinel
 *   4. Visibility re-acquire listener
 *
 * Exposes startAlarmSession() / endAlarmSession(handle) (D-01).
 * SessionHandle is opaque — internals are not callable by consumers (D-02).
 * No internal reentrancy guard (D-03). End is synchronous void (D-04).
 *
 * @see .planning/phases/06-alarmsession-refactor-v1-regression-guard/06-CONTEXT.md
 */

import { getAudioContext } from './AudioContext';
import { startKeepalive, stopKeepalive } from './sounds/keepalive';
import { acquireWakeLock, releaseWakeLock, attachVisibilityReacquire } from '../platform/wakeLock';

/**
 * Public handle returned by startAlarmSession. Opaque by design — the only
 * publicly accessible field is the AudioContext (D-02). Teardown internals
 * are recovered via a module-internal WeakMap keyed by this handle.
 */
export interface SessionHandle {
  readonly ac: AudioContext;
}

/**
 * Module-internal teardown state. NOT exported (T-06-02 mitigation —
 * prevents callers from constructing a synthetic handle that maps to
 * teardown callbacks they shouldn't be able to invoke selectively).
 */
interface SessionInternals {
  keepaliveOsc: OscillatorNode;
  releaseVisibility: () => void;
}

/**
 * Module-internal map of handle -> teardown internals (D-02).
 * WeakMap chosen over Symbol-keyed property because:
 *   - Reference-identity keying prevents forged-handle teardown (T-06-06)
 *   - GC-friendly: handle eligible for collection cleans up the map entry
 *   - Reads as straight TS without any non-enumerable property gymnastics
 *   - Matches the function-pair pattern from src/engine/sounds/keepalive.ts
 *     while keeping the internals genuinely private (keepalive returns
 *     the OscillatorNode directly; AlarmSession deliberately does not).
 */
const internals = new WeakMap<SessionHandle, SessionInternals>();

/**
 * Brings up the alarm session in the canonical order required by D-05/D-06.
 *
 * Order (MUST NOT change — preserves v1 byte-identical behavior):
 *   1. await getAudioContext()
 *   2. startKeepalive(ac)
 *   3. await acquireWakeLock()
 *   4. attachVisibilityReacquire()
 *
 * Failure profile (D-05):
 *  - getAudioContext() rejection propagates out (matches AlarmEngine v1 behavior).
 *  - acquireWakeLock() failures are already swallowed internally by wakeLock.ts;
 *    AlarmSession adds no redundant try/catch (no double-log, no shadowed bug).
 *
 * No reentrancy guard (D-03): calling twice without an intervening
 * endAlarmSession() is a programming error and is not policed here.
 * AlarmEngine's existing `_running` guard remains the single reentrancy gate.
 *
 * @returns A SessionHandle whose `ac` is the live AudioContext singleton.
 */
export async function startAlarmSession(): Promise<SessionHandle> {
  const ac = await getAudioContext();
  const keepaliveOsc = startKeepalive(ac);
  await acquireWakeLock();
  const releaseVisibility = attachVisibilityReacquire();

  const handle: SessionHandle = { ac };
  internals.set(handle, { keepaliveOsc, releaseVisibility });
  return handle;
}

/**
 * Tears the session down in reverse order (keepalive -> wake lock -> visibility).
 *
 * Synchronous, returns void (D-04). Fire-and-forget on the wake-lock release
 * Promise — matches AlarmEngine.cleanup()'s current style and preserves
 * v1 byte-identical teardown timing (SEG-05).
 *
 * Double-end / unknown-handle is a silent no-op (T-06-03 mitigation).
 * Forged handles (object literals not produced by startAlarmSession) silently
 * fail the WeakMap lookup since keying is by reference identity, not shape
 * (T-06-06 mitigation).
 *
 * @param handle - The SessionHandle returned by startAlarmSession.
 */
export function endAlarmSession(handle: SessionHandle): void {
  const i = internals.get(handle);
  if (!i) return; // double-end or unknown handle — no-op (D-04)
  stopKeepalive(i.keepaliveOsc);
  releaseWakeLock();
  i.releaseVisibility();
  internals.delete(handle);
}
