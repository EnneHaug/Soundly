/**
 * Singing bowl synthesis factory.
 *
 * Produces a warm, deep tibetan singing bowl sound using 5 sine oscillator
 * partials with inharmonic ratios and exponential decay envelopes.
 *
 * Decision references:
 *   D-01: Low fundamental (~220Hz), rich inharmonic overtones, slow exponential decay
 *   D-02: Slight detuning for natural beating/shimmer effect
 *
 * @see .planning/phases/01-audio-engine-and-timer/bowl-demo.html
 * @see .planning/phases/01-audio-engine-and-timer/01-RESEARCH.md (Pattern 1, Code Examples)
 */

/**
 * Creates a single sine partial with attack + exponential decay envelope.
 *
 * Note: OscillatorNode is single-use — this function creates fresh nodes
 * every call. Never reuse a stopped OscillatorNode.
 *
 * @param ac - AudioContext to use for node creation
 * @param freq - Oscillator frequency in Hz
 * @param peakGain - Peak gain level (0–1 scale)
 * @param attackTime - Time in seconds to reach peak gain
 * @param decayTime - Time in seconds to decay from peak to near-silence
 * @param startTime - AudioContext timestamp when partial should start
 */
function createPartial(
  ac: AudioContext,
  freq: number,
  peakGain: number,
  attackTime: number,
  decayTime: number,
  startTime: number,
): void {
  const osc = new OscillatorNode(ac, { type: 'sine', frequency: freq });
  const gainNode = new GainNode(ac, { gain: 0 });

  // Envelope: attack phase
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(peakGain, startTime + attackTime);

  // Envelope: exponential decay — cannot ramp to exactly 0 (spec forbids it)
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + attackTime + decayTime);

  osc.connect(gainNode).connect(ac.destination);
  osc.start(startTime);
  osc.stop(startTime + attackTime + decayTime + 0.1);
}

/**
 * Strikes the singing bowl — creates 5 oscillator partials with
 * inharmonic ratios producing a warm, meditative tibetan bowl tone.
 *
 * Partial structure (per D-01 and D-02):
 *   1. 220 Hz (fund)         — fundamental, dominant presence
 *   2. fund × 2.76           — 1st inharmonic partial
 *   3. fund × 4.72           — 2nd inharmonic partial
 *   4. fund × 6.83           — 3rd inharmonic partial
 *   5. fund × 1.003          — detuned shimmer (creates beating per D-02)
 *
 * Each call creates fresh AudioNodes — factory pattern required because
 * OscillatorNode cannot be restarted after stop().
 *
 * @param ac - AudioContext (must be in 'running' state — call getAudioContext() first)
 * @param masterGain - Overall gain multiplier (default 1.0, use ~0.4 for test sound)
 */
export function strikeBowl(ac: AudioContext, masterGain = 1.0): void {
  const now = ac.currentTime;
  const fund = 220;

  // 5 partials per D-01 and D-02 decisions
  createPartial(ac, fund, 0.35 * masterGain, 0.08, 6.0, now);           // fundamental
  createPartial(ac, fund * 2.76, 0.20 * masterGain, 0.05, 4.5, now);    // 1st inharmonic partial
  createPartial(ac, fund * 4.72, 0.12 * masterGain, 0.03, 3.5, now);    // 2nd inharmonic partial
  createPartial(ac, fund * 6.83, 0.06 * masterGain, 0.02, 2.5, now);    // 3rd inharmonic partial
  createPartial(ac, fund * 1.003, 0.15 * masterGain, 0.08, 5.5, now);   // detuned shimmer (D-02)
}
