/**
 * Wake Lock acquisition and visibility re-acquisition.
 *
 * Keeps the screen on during an active alarm timer using the Screen Wake Lock API
 * (Baseline 2025, iOS Safari 18.4+). Degrades gracefully on unsupported browsers.
 *
 * Key behaviors:
 * - acquireWakeLock(): requests a 'screen' wake lock sentinel
 * - releaseWakeLock(): releases the sentinel and clears the re-acquire flag
 * - attachVisibilityReacquire(): listens for visibilitychange to re-acquire when
 *   the document becomes visible (OS releases wake lock on tab hide/screen-off)
 *
 * Wake Lock loss handling (discretion per 02-RESEARCH.md):
 * - Silently re-acquire on visibilitychange when document becomes visible
 * - No user-facing warning — keepalive oscillator and notifications cover backgrounded case
 * - Log Wake Lock state changes via console.debug for diagnostic purposes (T-02-04)
 *
 * @see .planning/phases/02-background-reliability/02-RESEARCH.md (Pattern 2)
 * @see MDN Screen Wake Lock API
 * @see PLT-02 — Wake Lock API keeps screen on during active timer
 */

let _sentinel: WakeLockSentinel | null = null;

/**
 * Whether the engine currently wants to hold the wake lock.
 * Used by the visibilitychange handler to decide whether to re-acquire.
 * Set to true by acquireWakeLock(), set to false by releaseWakeLock().
 */
let _shouldHoldLock = false;

/**
 * Requests a screen wake lock sentinel.
 *
 * No-op if 'wakeLock' is not in navigator (unsupported browser).
 * Catches NotAllowedError (document not visible at time of request) and logs it —
 * the visibilitychange handler will re-acquire when the document becomes visible.
 *
 * MUST be called from a user gesture handler or immediately after one, before
 * any other awaits that could yield the event loop (Pitfall 3).
 */
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

/**
 * Releases the wake lock sentinel and clears the re-acquire flag.
 *
 * Safe to call when no sentinel is held (e.g., on unsupported browsers or
 * after an acquisition failure). Calling this prevents the visibilitychange
 * handler from re-acquiring the lock after it is intentionally released.
 */
export function releaseWakeLock(): void {
  _shouldHoldLock = false;
  _sentinel?.release();
  _sentinel = null;
}

/**
 * Attaches a visibilitychange listener that re-acquires the wake lock
 * when the document becomes visible and _shouldHoldLock is true.
 *
 * Call once when the engine starts. Returns a cleanup function that removes
 * the listener — call it from cleanup() alongside releaseWakeLock().
 *
 * @returns Cleanup function that removes the visibilitychange listener
 */
export function attachVisibilityReacquire(): () => void {
  const handler = async () => {
    if (_shouldHoldLock && document.visibilityState === 'visible') {
      await acquireWakeLock();
    }
  };
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}
