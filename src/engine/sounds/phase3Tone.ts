/**
 * Phase 3 urgent tone synthesis.
 *
 * Produces a siren-like rising tone in the 1–3 kHz ear-sensitivity band:
 *   - Three detuned sine voices at 1000 / 1003 / 1007 Hz (each sweeps ×1.4 over 3 s)
 *   - A 2 kHz sine harmonic for body (attenuated)
 *   - A 3 kHz triangle chirp for attention-grabbing edge (attenuated)
 *   - A 6 Hz sine LFO driving amplitude modulation (±0.35 around 0.65 mean) for
 *     siren-like warble (D-04)
 *
 * The master ramp is a single linear 0 → 1.0 over the full Phase 3 duration,
 * feeding a DynamicsCompressorNode before the destination. The compressor
 * replaces the previous `GainNode.gain > 1` overdrive (D-02) which hard-clipped
 * at the output stage rather than amplifying. Frequency band was shifted from
 * the old 80–220 Hz (phone-speaker roll-off, ear-insensitivity region) to the
 * 1–3 kHz sweet spot (D-03).
 *
 * Synthesizable entirely from OscillatorNode + GainNode + DynamicsCompressorNode
 * (no libraries — per CLAUDE.md "Raw Web Audio API").
 *
 * `startPhase3Swell` returns `OscillatorNode[]` (3 detuned + 1 harmonic + 1 chirp
 * + 1 LFO = 6 nodes). The caller MUST call `.stop()` on every node in the array
 * at teardown / loop-cycle replacement — including the LFO, to prevent orphans.
 *
 * @see .planning/phases/05-ios-audio-loudness-fixes/05-CONTEXT.md (D-02, D-03, D-04)
 * @see .planning/research/ios-alarm-feasibility.md
 */

/**
 * Creates the Phase 3 master GainNode, routed through a DynamicsCompressorNode
 * to the audio destination, with a linear ramp from 0 to 1.0 over the given
 * duration.
 *
 * CRITICAL: setValueAtTime(0) is called before linearRampToValueAtTime to
 * anchor the starting point — required per research pitfall 6 to prevent
 * ramp starting from an unexpected value.
 *
 * Signal chain: oscillators → masterGain → compressor → destination.
 * The returned GainNode is still the oscillator connect-point — callers do
 * not need to know about the compressor.
 *
 * @param ac - AudioContext in running state
 * @param durationSec - Duration of the 0→100% volume ramp in seconds
 * @returns The master GainNode (connect swell oscillators through this node)
 */
export function createPhase3Ramp(ac: AudioContext, durationSec: number): GainNode {
  const masterGain = new GainNode(ac, { gain: 0 });
  masterGain.gain.setValueAtTime(0, ac.currentTime);
  masterGain.gain.linearRampToValueAtTime(1.0, ac.currentTime + durationSec);

  const compressor = new DynamicsCompressorNode(ac, {
    threshold: -24,
    knee: 12,
    ratio: 12,
    attack: 0.003,
    release: 0.25,
  });
  masterGain.connect(compressor).connect(ac.destination);

  return masterGain;
}

/**
 * Creates and starts a Phase 3 swell voice stack (6 OscillatorNodes).
 *
 * Returns an array of ALL started oscillators (3 detuned + 1 harmonic +
 * 1 chirp + 1 LFO). The caller must call `.stop()` on every node in the
 * array at teardown / loop-cycle replacement — including the LFO, to
 * prevent orphan nodes in the audio graph.
 *
 * Routing: each source osc → amGain → masterGain. The 6 Hz LFO sine
 * modulates amGain.gain between 0.30 and 1.00 (mean 0.65, depth ±0.35)
 * for siren-like warble (D-04). AM depth intentionally never reaches 0
 * to avoid audible dropouts (research pitfall #3).
 *
 * OscillatorNode is single-use — the AlarmEngine must call this function
 * again to create a new stack for each loop cycle (~every 3.2 s).
 *
 * @param ac - AudioContext in running state
 * @param masterGain - The Phase 3 ramp GainNode (from createPhase3Ramp)
 * @returns Array of OscillatorNodes: [detune1, detune2, detune3, harmonic, chirp, lfo]
 */
export function startPhase3Swell(ac: AudioContext, masterGain: GainNode): OscillatorNode[] {
  // AM carrier: mean 0.65, ±0.35 depth via 6 Hz sine LFO (pitfall #3 — don't use 0→1.0 depth)
  const amGain = new GainNode(ac, { gain: 0.65 });
  const lfo = new OscillatorNode(ac, { type: 'sine', frequency: 6 });
  const lfoScale = new GainNode(ac, { gain: 0.35 });
  lfo.connect(lfoScale).connect(amGain.gain);
  lfo.start();
  amGain.connect(masterGain);

  // Three detuned sines around 1 kHz — each sweeps f → f*1.4 over 3 s for rising urgency.
  // Unrolled rather than mapped so the explicit `frequency: 1000 / 1003 / 1007` literals
  // remain grep-verifiable per plan acceptance criteria.
  const d1 = new OscillatorNode(ac, { type: 'sine', frequency: 1000 });
  d1.frequency.setValueAtTime(1000, ac.currentTime);
  d1.frequency.linearRampToValueAtTime(1000 * 1.4, ac.currentTime + 3.0);
  d1.connect(amGain);
  d1.start();

  const d2 = new OscillatorNode(ac, { type: 'sine', frequency: 1003 });
  d2.frequency.setValueAtTime(1003, ac.currentTime);
  d2.frequency.linearRampToValueAtTime(1003 * 1.4, ac.currentTime + 3.0);
  d2.connect(amGain);
  d2.start();

  const d3 = new OscillatorNode(ac, { type: 'sine', frequency: 1007 });
  d3.frequency.setValueAtTime(1007, ac.currentTime);
  d3.frequency.linearRampToValueAtTime(1007 * 1.4, ac.currentTime + 3.0);
  d3.connect(amGain);
  d3.start();

  const detuned = [d1, d2, d3];

  // 2 kHz harmonic layer (attenuated — body, not peak)
  const harmonic = new OscillatorNode(ac, { type: 'sine', frequency: 2000 });
  harmonic.connect(new GainNode(ac, { gain: 0.5 })).connect(amGain);
  harmonic.start();

  // 3 kHz attention-grabbing chirp (triangle waveform, further attenuated)
  const chirp = new OscillatorNode(ac, { type: 'triangle', frequency: 3000 });
  chirp.connect(new GainNode(ac, { gain: 0.3 })).connect(amGain);
  chirp.start();

  return [...detuned, harmonic, chirp, lfo];
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
