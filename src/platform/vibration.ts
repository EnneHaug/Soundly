/**
 * Android vibration loop manager.
 *
 * Implements D-01 and D-02: pulsing rhythm vibration pattern (300ms on, 200ms pause)
 * repeating continuously during Phase 2 until Phase 3 triggers or user dismisses.
 *
 * Feature-detects `navigator.vibrate` — no-op on iOS and desktop where vibration
 * is not supported (Vibration API has limited availability per CLAUDE.md).
 *
 * Anti-pattern avoided: A single long pattern array for the full Phase 2 duration
 * would be enormous and cannot be cancelled cleanly mid-pattern. setInterval +
 * vibrate(0) on stop is the clean approach (per 02-RESEARCH.md).
 *
 * @see .planning/phases/02-background-reliability/02-RESEARCH.md (Pattern 3)
 */

/** Vibration pattern: 300ms on, 200ms off (D-01) */
const PATTERN: number[] = [300, 200];

/** Cycle duration = 300 + 200 = 500ms */
const CYCLE_MS = PATTERN.reduce((a, b) => a + b, 0); // 500ms

let _handle: ReturnType<typeof setInterval> | null = null;

/**
 * Starts a repeating vibration loop using the [300, 200] pattern.
 *
 * Calls navigator.vibrate([300, 200]) immediately then sets up a 500ms interval
 * to repeat the pattern continuously. No-op if 'vibrate' is not in navigator
 * (iOS Safari, Firefox desktop, etc.).
 *
 * @see ALM-05 — Phase 2 uses Vibration API with audio fallback on iOS
 */
export function startVibration(): void {
  if (!('vibrate' in navigator)) return;
  navigator.vibrate(PATTERN);
  _handle = setInterval(() => navigator.vibrate(PATTERN), CYCLE_MS);
}

/**
 * Stops the vibration loop and cancels any in-progress vibration.
 *
 * Safe to call when not started, and when vibration is not supported.
 * Clears the setInterval handle and calls navigator.vibrate(0) to cancel
 * any currently running vibration hardware cycle (T-02-01 mitigation).
 */
export function stopVibration(): void {
  if (_handle !== null) {
    clearInterval(_handle);
    _handle = null;
  }
  if ('vibrate' in navigator) navigator.vibrate(0);
}
