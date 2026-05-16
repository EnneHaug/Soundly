import { describe, it, expect } from 'vitest';
import { rowIsValid, rowValidityArray } from '../composerValidation';
import type { Segment, SegmentConfig } from '../../engine/SegmentState';

/**
 * Tests for the per-row validity helpers consumed by Composer.tsx
 * (drives D-11 inline red-border state + disabled-Start state).
 *
 * Mirrors validateSegmentConfig per-segment rules but operates row-locally
 * so the composer can highlight WHICH rows are invalid (the engine validator
 * returns first-failure only). The 14_400_000 ms ceiling is duplicated inline
 * per 09-PATTERNS.md:431 (SegmentState.ts is SEG-05 frozen).
 */

function seg(durationMs: number, endSound: Segment['endSound'] = 'gentle', id = 'x'): Segment {
  return { id, durationMs, endSound };
}

describe('rowIsValid — happy path', () => {
  it('accepts valid segments for endSound=gentle', () => {
    expect(rowIsValid(seg(60_000, 'gentle'))).toBe(true);
  });

  it('accepts valid segments for endSound=triangle', () => {
    expect(rowIsValid(seg(60_000, 'triangle'))).toBe(true);
  });

  it('accepts valid segments for endSound=alarm', () => {
    expect(rowIsValid(seg(60_000, 'alarm'))).toBe(true);
  });

  it('accepts the 14_400_000 ms boundary (4-hour ceiling included)', () => {
    expect(rowIsValid(seg(14_400_000, 'gentle'))).toBe(true);
  });

  it('accepts a 1 ms duration (just above zero)', () => {
    expect(rowIsValid(seg(1, 'gentle'))).toBe(true);
  });
});

describe('rowIsValid — invalid duration', () => {
  it('rejects durationMs === 0', () => {
    expect(rowIsValid(seg(0, 'gentle'))).toBe(false);
  });

  it('rejects negative durationMs', () => {
    expect(rowIsValid(seg(-1, 'gentle'))).toBe(false);
    expect(rowIsValid(seg(-1000, 'gentle'))).toBe(false);
  });

  it('rejects NaN durationMs', () => {
    expect(rowIsValid(seg(NaN, 'gentle'))).toBe(false);
  });

  it('rejects Infinity durationMs', () => {
    expect(rowIsValid(seg(Infinity, 'gentle'))).toBe(false);
    expect(rowIsValid(seg(-Infinity, 'gentle'))).toBe(false);
  });

  it('rejects durationMs > 14_400_000 (boundary just above ceiling)', () => {
    expect(rowIsValid(seg(14_400_001, 'gentle'))).toBe(false);
  });

  it('rejects non-number duration (string coerced via cast)', () => {
    const malformed = { id: 'x', durationMs: '60000' as unknown as number, endSound: 'gentle' as const };
    expect(rowIsValid(malformed)).toBe(false);
  });
});

describe('rowIsValid — invalid endSound', () => {
  it('rejects unknown endSound keys', () => {
    const unknown = seg(60_000, 'unknown' as unknown as Segment['endSound']);
    expect(rowIsValid(unknown)).toBe(false);
  });

  it('rejects empty-string endSound', () => {
    const empty = seg(60_000, '' as unknown as Segment['endSound']);
    expect(rowIsValid(empty)).toBe(false);
  });
});

describe('rowValidityArray', () => {
  it('returns a boolean[] aligned with config.segments', () => {
    const config: SegmentConfig = {
      segments: [
        seg(60_000, 'gentle', 'a'),
        seg(0, 'gentle', 'b'),
        seg(60_000, 'triangle', 'c'),
      ],
    };
    expect(rowValidityArray(config)).toEqual([true, false, true]);
  });

  it('returns [] for an empty segments array', () => {
    expect(rowValidityArray({ segments: [] })).toEqual([]);
  });

  it('returns all-true for an all-valid config', () => {
    const config: SegmentConfig = {
      segments: [
        seg(60_000, 'gentle', 'a'),
        seg(120_000, 'triangle', 'b'),
        seg(30_000, 'alarm', 'c'),
      ],
    };
    expect(rowValidityArray(config)).toEqual([true, true, true]);
  });
});
