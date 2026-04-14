/**
 * Test sound playback.
 *
 * Plays the singing bowl at comfortable mid-range volume (~3s duration) so the
 * user can verify their device audio works before starting the alarm.
 *
 * Decision reference:
 *   D-07: Test Sound plays the singing bowl only at comfortable mid-range volume.
 *         Duration ~3 seconds (strike + initial decay, then fade out).
 *   D-08: Per-phase test buttons deferred to v2 — only one test sound needed here.
 *   AUD-03: Requirement intent is verified audio works; singing bowl satisfies this
 *           (D-07 supersedes AUD-03's "Phase 3 sound" wording per research note).
 *
 * @see .planning/phases/01-audio-engine-and-timer/01-RESEARCH.md (Open Question 3 resolution)
 */

import { getAudioContext } from '../AudioContext'
import { strikeBowl } from './singingBowl'

/**
 * Mid-range gain for the test sound playback.
 *
 * Exposed as a named constant for easy tuning without modifying internal modules.
 * 0.4 = 40% of full volume — comfortable across typical device output levels.
 *
 * @see .planning/phases/01-audio-engine-and-timer/01-RESEARCH.md (Open Question 3)
 */
export const TEST_SOUND_GAIN = 0.4

/**
 * Plays the singing bowl at mid-range volume to verify audio works.
 *
 * Must be called from a user gesture handler (click/tap) — calls getAudioContext()
 * which creates or resumes the AudioContext from the gesture context.
 *
 * The bowl's natural exponential decay handles the ~3s duration — the fundamental
 * decays over 6s but is near-silent by 3s. No explicit stop needed; oscillators
 * are self-stopping via the scheduled osc.stop() in singingBowl.ts.
 */
export async function playTestSound(): Promise<void> {
  const ac = await getAudioContext()
  strikeBowl(ac, TEST_SOUND_GAIN)
}
