/**
 * Segment engine type vocabulary, validator, and the Wake Easy named config.
 *
 * Paired pattern with AlarmState.ts (the v1 phase model). The contract divergence
 * is intentional and load-bearing per SEG-04: validateSegmentConfig MUST return a
 * discriminated union, NEVER throw. Composer (Phase 9) surfaces error strings
 * inline; engine (SegmentEngine.start) gates on result.ok for defense-in-depth.
 *
 * @see .planning/phases/07-segment-engine-triangle-sound/07-CONTEXT.md
 *      D-08 (state enum), D-09 (change event), D-11 (validation result),
 *      D-12 (validation rules + exact error wording), D-19 (pause snapshot).
 */

export interface Segment {
  id: string;
  durationMs: number;
  endSound: 'gentle' | 'triangle' | 'alarm';
}

export interface SegmentConfig {
  segments: Segment[];
}

export type SegmentEngineState = 'idle' | 'running' | 'firing-alarm' | 'dismissed';

export interface SegmentChangeEvent {
  kind: 'start' | 'end';
  segmentIndex: number;
  totalSegments: number;
  segment: Segment;
}

export interface SegmentPauseSnapshot {
  currentSegmentIndex: number;
  currentSegmentRemainingMs: number;
  futureSegmentDurationsMs: number[];
}

export type SegmentValidationResult =
  | { ok: true; config: SegmentConfig }
  | { ok: false; error: string };

const MAX_DURATION_MS = 14_400_000; // 4 hours — matches AlarmConfig ceiling per D-12
const VALID_SOUND_KEYS = new Set(['gentle', 'triangle', 'alarm']);

/**
 * Validate a segment-config input (typically from composer state or a decoded
 * share URL). NEVER throws — returns a discriminated union with user-readable
 * error string on failure.
 *
 * Order of checks (first failure wins):
 *  1. input is a non-null object
 *  2. segments is a non-empty array
 *  3. each segment is an object
 *  4. each segment has non-empty string id
 *  5. each segment has finite numeric duration in (0, 14_400_000ms] (4-hour ceiling)
 *  6. each segment has a known endSound key
 */
export function validateSegmentConfig(input: unknown): SegmentValidationResult {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Config must be an object' };
  }
  const cfg = input as Partial<SegmentConfig>;
  if (!Array.isArray(cfg.segments) || cfg.segments.length === 0) {
    return { ok: false, error: 'Segment list is empty — at least one segment is required' };
  }
  for (let i = 0; i < cfg.segments.length; i++) {
    const seg = cfg.segments[i] as Partial<Segment> | undefined;
    if (!seg || typeof seg !== 'object') {
      return { ok: false, error: `Segment ${i} is not an object` };
    }
    if (typeof seg.id !== 'string' || seg.id.length === 0) {
      return { ok: false, error: `Segment ${i} has invalid id` };
    }
    if (
      typeof seg.durationMs !== 'number' ||
      !Number.isFinite(seg.durationMs) ||
      seg.durationMs <= 0 ||
      seg.durationMs > MAX_DURATION_MS
    ) {
      return {
        ok: false,
        error: `Segment ${i} has invalid duration ${seg.durationMs}ms — must be > 0 and <= 14400000`,
      };
    }
    if (typeof seg.endSound !== 'string' || !VALID_SOUND_KEYS.has(seg.endSound)) {
      return {
        ok: false,
        error: `Unknown sound key '${seg.endSound}' in segment ${i} — expected 'gentle', 'triangle', or 'alarm'`,
      };
    }
  }
  return { ok: true, config: cfg as SegmentConfig };
}

/**
 * Wake Easy preset (Phase 8 dashboard card; Phase 7 harness fixture).
 *
 *   4 × (4 min ending in gentle chime) + 1 × (1 min ending in alarm) = 17 min total.
 *
 * The alarm segment fires the v1 Phase 3 stack at segment-start (not tail) per D-01.
 * Total = 240_000 × 4 + 60_000 = 1_020_000 ms = 17 min exact.
 */
export const WAKE_EASY_CONFIG: SegmentConfig = {
  segments: [
    { id: 'wake-easy-1', durationMs: 240_000, endSound: 'gentle' },
    { id: 'wake-easy-2', durationMs: 240_000, endSound: 'gentle' },
    { id: 'wake-easy-3', durationMs: 240_000, endSound: 'gentle' },
    { id: 'wake-easy-4', durationMs: 240_000, endSound: 'gentle' },
    { id: 'wake-easy-5', durationMs:  60_000, endSound: 'alarm'  },
  ],
};
