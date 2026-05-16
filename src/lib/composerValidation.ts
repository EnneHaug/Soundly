/**
 * Per-row validity helpers for the Composer modal (Phase 9).
 *
 * Drives the inline red-border state on each row (D-11) and the
 * disabled-Start state (Start enabled iff rowValidityArray.every(Boolean)).
 *
 * Mirrors the per-segment checks in validateSegmentConfig
 * (src/engine/SegmentState.ts:67-91) but operates row-locally so the composer
 * knows WHICH rows to highlight — the engine validator returns first-failure
 * only, which would only highlight the first invalid row.
 *
 * The 14_400_000 ms ceiling mirrors MAX_DURATION_MS at
 * src/engine/SegmentState.ts:43. Duplicated inline because SegmentState.ts is
 * frozen (SEG-05 floor + Phase 7 deliverable freeze); see 09-PATTERNS.md:431.
 * Any change to the engine ceiling must update this constant too.
 */

import type { Segment, SegmentConfig } from '../engine/SegmentState';

const VALID_SOUND_KEYS: ReadonlyArray<Segment['endSound']> = ['gentle', 'triangle', 'alarm'];

export function rowIsValid(seg: Segment): boolean {
  if (typeof seg.durationMs !== 'number' || !Number.isFinite(seg.durationMs)) return false;
  if (seg.durationMs <= 0 || seg.durationMs > 14_400_000) return false;
  if (!VALID_SOUND_KEYS.includes(seg.endSound)) return false;
  return true;
}

export function rowValidityArray(config: SegmentConfig): boolean[] {
  return config.segments.map(rowIsValid);
}
