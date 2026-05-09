/**
 * Triangle sound — synthesized bright single-strike at F7 (2793.83 Hz).
 *
 * Per AUD-05 (reframed by Phase 7 D-06): the fundamental sits at least one
 * octave above the singing bowl's dominant partials (peak gain >=0.10 at
 * 220/607/1038 Hz, effective floor ~2076 Hz). F7 was chosen — above the
 * floor and forming a warm major-third-flavored interval against the bowl's
 * A root for a cheerful "ping" feel.
 *
 * Envelope locked by Phase 7 D-05:
 *  - Frequency: 2793.83 Hz (equal temperament, A4=440 reference)
 *  - Attack: 8 ms linearRampToValueAtTime — click-free per AUD-05 (>=5 ms)
 *  - Decay: 2.0 s exponentialRampToValueAtTime to 0.001 — never to 0 (Web Audio spec forbids)
 *  - Peak: 0.4 * masterGain
 *  - osc.stop(t + 2.1) — cleanly past decay end
 *
 * @see .planning/phases/07-segment-engine-triangle-sound/triangle-demo.html
 *      (preserved as historical record of why F7 won over F#7/G7).
 */
export function strikeTriangle(ac: AudioContext, masterGain = 1.0): void {
  const t = ac.currentTime;
  const osc = new OscillatorNode(ac, { type: 'sine', frequency: 2793.83 });
  const g = new GainNode(ac, { gain: 0 });
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.4 * masterGain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 2.1);
}
