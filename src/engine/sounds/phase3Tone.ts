/**
 * Phase 3 urgent tone synthesis.
 *
 * Implements a rising sine swell (80Hz → 220Hz sweep over 3 seconds, looping)
 * as the Phase 3 alarm tone. This tone is fed through a master GainNode that
 * ramps from 0% to 100% volume over the configured Phase 3 duration.
 *
 * Design rationale (D-05: Claude's discretion):
 *   - Contrasts with singing bowl: slow continuous attack vs. bowl's sharp strike + decay
 *   - Rising frequency creates upward momentum and urgency
 *   - Stays in the same low-frequency zen register (80–220Hz)
 *   - Synthesizable entirely from OscillatorNode + GainNode (no libraries)
 *   - Loops via factory pattern — new OscillatorNode every ~3s cycle
 *
 * @see .planning/phases/01-audio-engine-and-timer/01-RESEARCH.md (Pattern 6, Pattern 7)
 */

/**
 * Creates the Phase 3 master GainNode, connected to the audio destination,
 * with a linear ramp from 0 to 1.0 over the given duration.
 *
 * CRITICAL: setValueAtTime(0) is called before linearRampToValueAtTime to
 * anchor the starting point — required per research pitfall 6 to prevent
 * ramp starting from an unexpected value.
 *
 * @param ac - AudioContext in running state
 * @param durationSec - Duration of the 0→100% volume ramp in seconds
 * @returns The master GainNode (connect swell oscillators through this node)
 */
export function createPhase3Ramp(ac: AudioContext, durationSec: number): GainNode {
  const masterGain = new GainNode(ac, { gain: 0 });

  // Anchor required before ramp (pitfall 6: linearRamp needs prior setValueAtTime)
  masterGain.gain.setValueAtTime(0, ac.currentTime);
  masterGain.gain.linearRampToValueAtTime(1.0, ac.currentTime + durationSec);

  masterGain.connect(ac.destination);
  return masterGain;
}

/**
 * Creates and starts a single swell oscillator cycle (80Hz → 220Hz over 3s).
 *
 * The swell is routed through the provided masterGain node (not directly to
 * destination), so Phase 3's volume ramp applies to it automatically.
 *
 * OscillatorNode is single-use — the AlarmEngine must call this function again
 * to create a new oscillator for each loop cycle (~every 3s).
 *
 * @param ac - AudioContext in running state
 * @param masterGain - The Phase 3 ramp GainNode (from createPhase3Ramp)
 * @returns The OscillatorNode (caller stops it after ~3s and creates a new one)
 */
export function startPhase3Swell(ac: AudioContext, masterGain: GainNode): OscillatorNode {
  const osc = new OscillatorNode(ac, { type: 'sine', frequency: 80 });
  const oscGain = new GainNode(ac, { gain: 0 });

  // Frequency sweep: 80Hz → 220Hz over 3 seconds (creates rising urgency)
  osc.frequency.setValueAtTime(80, ac.currentTime);
  osc.frequency.linearRampToValueAtTime(220, ac.currentTime + 3.0);

  // Soft attack on the swell tone (0 → 1.0 over 0.5s, avoids click at loop start)
  oscGain.gain.setValueAtTime(0, ac.currentTime);
  oscGain.gain.linearRampToValueAtTime(1.0, ac.currentTime + 0.5);

  // Route through masterGain (which handles the 0→100% Phase 3 volume ramp)
  osc.connect(oscGain).connect(masterGain);
  osc.start();

  return osc;
}

/**
 * Smoothly fades out a GainNode to avoid audible click artifacts.
 *
 * Uses setTargetAtTime (15ms time constant) rather than abrupt gain assignment.
 * This is required per research pitfall 4 — abrupt stops cause audible pops.
 *
 * @param gain - The GainNode to fade out
 * @param ac - AudioContext (needed for currentTime)
 */
export function fadeOutGain(gain: GainNode, ac: AudioContext): void {
  // setTargetAtTime asymptotically approaches 0.0001 — no audible click
  gain.gain.setTargetAtTime(0.0001, ac.currentTime, 0.015);
}
