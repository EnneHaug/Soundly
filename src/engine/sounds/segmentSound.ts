import { strikeBowl } from './singingBowl';
import { strikeTriangle } from './triangle';

/**
 * Dispatches a one-shot end-of-segment strike for gentle/triangle keys.
 *
 * The alarm key is intentionally NOT a valid argument — SegmentEngine handles
 * the alarm key directly via createPhase3Ramp + startPhase3Swell because the
 * ramp lifecycle is structurally different (multi-second sustain + 3.2 s loop,
 * not a one-shot strike). See Phase 7 CONTEXT D-13 for the carve-out rationale.
 *
 * @param ac - AudioContext (caller is responsible for resumed/running state;
 *   typically obtained from AlarmSession via SegmentEngine).
 * @param key - gentle (singing bowl) or triangle (F7 triangle ping).
 */
export function fireSegmentEndSound(ac: AudioContext, key: 'gentle' | 'triangle'): void {
  if (key === 'gentle') {
    strikeBowl(ac, 1.0);
  } else {
    strikeTriangle(ac, 1.0);
  }
}
