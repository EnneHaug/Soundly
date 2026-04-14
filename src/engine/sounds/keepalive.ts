/**
 * Silent keepalive oscillator.
 *
 * Keeps AudioContext alive on mobile browsers by running a silent oscillator
 * at gain=0. Without this, mobile browsers may suspend an AudioContext that
 * appears idle between alarm sound events.
 *
 * Caveat: Effectiveness varies by browser/OS. iOS Safari may still suspend
 * AudioContext on screen lock regardless of active oscillators. Phase 2
 * (Background Reliability) extends this with visibilitychange re-acquisition
 * and notification-triggered audio.
 *
 * @see .planning/phases/01-audio-engine-and-timer/01-RESEARCH.md (Pattern 5, AUD-04)
 */

/**
 * Starts a silent keepalive oscillator connected through a zero-gain GainNode.
 *
 * The oscillator runs at 1Hz (inaudible) with gain=0, keeping the AudioContext
 * in 'running' state on mobile browsers that would otherwise suspend an idle context.
 *
 * Keeps AudioContext alive on mobile browsers. Effectiveness varies by OS —
 * iOS Safari may still suspend. See Phase 2 for extended keepalive strategy.
 *
 * @param ac - AudioContext in running state
 * @returns The OscillatorNode — must be passed to stopKeepalive() on alarm dismiss
 */
export function startKeepalive(ac: AudioContext): OscillatorNode {
  const osc = new OscillatorNode(ac, { type: 'sine', frequency: 1 });
  const gain = new GainNode(ac, { gain: 0 }); // silent — gain is zero

  osc.connect(gain).connect(ac.destination);
  osc.start();

  return osc;
}

/**
 * Stops the keepalive oscillator.
 *
 * Safe to call even if the oscillator has already been stopped (e.g., on
 * double-dismiss or context close). Wrapped in try/catch for safety.
 *
 * @param osc - The OscillatorNode returned by startKeepalive()
 */
export function stopKeepalive(osc: OscillatorNode): void {
  try {
    osc.stop();
  } catch {
    // OscillatorNode may already be stopped — safe to ignore
  }
}
