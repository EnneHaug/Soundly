/**
 * Drift-free wall-clock timer.
 *
 * Uses repeated setTimeout calls with Date.now() comparison rather than
 * setInterval tick counting. This avoids accumulated drift over long durations
 * (e.g., 21-minute Focus preset) where setInterval's ±10ms error per tick
 * compounds to hundreds of milliseconds total drift.
 *
 * Pattern: scheduleAt(targetEpochMs, callback)
 * - Each tick checks `Date.now()` against the absolute target time
 * - Schedules next tick at `min(remaining, checkIntervalMs)` for responsiveness
 * - Fires callback when `remaining <= 10` (10ms threshold to avoid overshoot)
 *
 * @see .planning/phases/01-audio-engine-and-timer/01-RESEARCH.md (Pattern 2: Drift-Free Wall-Clock Timer)
 */

/** Handle returned by scheduleAt — call cancel() to abort the timer */
export interface TimerHandle {
  cancel: () => void;
}

/**
 * Schedules a callback to fire at the given absolute epoch millisecond timestamp.
 *
 * Uses Date.now() comparison on each tick to eliminate drift. The default
 * check interval of 250ms means the callback fires within 250ms of the target,
 * satisfying the ALM-04 requirement of < 250ms accuracy over 21 minutes.
 *
 * @param targetEpochMs - Absolute time to fire (e.g. Date.now() + delayMs)
 * @param callback - Function to call when target time is reached
 * @param checkIntervalMs - How often to check wall clock (default 250ms)
 * @returns Handle with cancel() method to abort the timer
 */
export function scheduleAt(
  targetEpochMs: number,
  callback: () => void,
  checkIntervalMs: number = 250
): TimerHandle {
  let timeoutId: ReturnType<typeof setTimeout>;
  let cancelled = false;

  function tick() {
    if (cancelled) return;

    const remaining = targetEpochMs - Date.now();

    if (remaining <= 10) {
      // Target time reached (within 10ms threshold to avoid overshoot)
      callback();
      return;
    }

    // Schedule next check at the sooner of: remaining time or check interval
    timeoutId = setTimeout(tick, Math.min(remaining, checkIntervalMs));
  }

  // Kick off the first tick
  timeoutId = setTimeout(tick, Math.min(targetEpochMs - Date.now(), checkIntervalMs));

  return {
    cancel: () => {
      cancelled = true;
      clearTimeout(timeoutId);
    },
  };
}
