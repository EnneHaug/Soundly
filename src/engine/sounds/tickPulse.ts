/**
 * iOS tick pulse synthesis.
 *
 * iOS Phase 2 audio fallback: synthesizes a 50ms bandpass-filtered white noise burst
 * to serve as a subtle ticking pulse when the Vibration API is unavailable.
 *
 * Uses the AudioBuffer factory pattern (new AudioBufferSourceNode per tick) because
 * AudioBufferSourceNode cannot be restarted after start() — same constraint as
 * OscillatorNode (see singingBowl.ts, keepalive.ts for the same pattern).
 *
 * The tick sound is distinct from Phase 1 (singing bowl harmonics) and Phase 3
 * (rising sine swell) per D-05.
 *
 * Volume escalation over Phase 2 duration is controlled by the caller via a masterGain
 * node. The gain ramps from near-zero to ~0.7 over phase2DurationMs (D-04).
 *
 * @see .planning/phases/02-background-reliability/02-RESEARCH.md (Pattern 4)
 * @see MDN Advanced Techniques — noise burst synthesis pattern
 */

/** Tick duration in seconds — 50ms filtered noise burst (D-03) */
const TICK_DURATION_SEC = 0.05;

/**
 * Plays a single tick: a 50ms burst of white noise through a bandpass filter.
 *
 * Creates a fresh AudioBufferSourceNode and BiquadFilterNode per call (factory
 * pattern). The source auto-stops when the buffer is exhausted — no explicit
 * .stop() call needed.
 *
 * @param ac - AudioContext in running state
 * @param masterGain - GainNode managed by the caller for D-04 volume ramp
 * @param bandHz - Bandpass center frequency in Hz (default 2000 — crisp tick)
 */
export function playTick(
  ac: AudioContext,
  masterGain: GainNode,
  bandHz = 2000
): void {
  const bufferSize = Math.ceil(ac.sampleRate * TICK_DURATION_SEC);
  const buf = new AudioBuffer({ length: bufferSize, sampleRate: ac.sampleRate });
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1; // bipolar white noise
  }

  const source = new AudioBufferSourceNode(ac, { buffer: buf });
  const filter = new BiquadFilterNode(ac, { type: 'bandpass', frequency: bandHz, Q: 2 });

  source.connect(filter).connect(masterGain);
  source.start();
  // source auto-stops when buffer is exhausted — no .stop() call needed
}
