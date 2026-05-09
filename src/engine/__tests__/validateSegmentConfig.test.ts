import { describe, it, expect } from 'vitest';
import {
  validateSegmentConfig,
  WAKE_EASY_CONFIG,
  type SegmentConfig,
} from '../SegmentState';

describe('validateSegmentConfig', () => {
  describe('valid inputs', () => {
    it('returns { ok: true, config } for the Wake Easy preset', () => {
      const result = validateSegmentConfig(WAKE_EASY_CONFIG);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.config).toEqual(WAKE_EASY_CONFIG);
      }
    });

    it('returns { ok: true } for a minimal 1-segment config', () => {
      const minimal: SegmentConfig = {
        segments: [{ id: 's1', durationMs: 1000, endSound: 'gentle' }],
      };
      const result = validateSegmentConfig(minimal);
      expect(result.ok).toBe(true);
    });

    it('accepts duration at the 4-hour ceiling (14_400_000)', () => {
      const cfg = { segments: [{ id: 's1', durationMs: 14_400_000, endSound: 'triangle' as const }] };
      const result = validateSegmentConfig(cfg);
      expect(result.ok).toBe(true);
    });
  });

  describe('rejects malformed input shape', () => {
    it('returns { ok: false } for null', () => {
      const result = validateSegmentConfig(null);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/object/i);
    });

    it('returns { ok: false } for undefined', () => {
      const result = validateSegmentConfig(undefined);
      expect(result.ok).toBe(false);
    });

    it('returns { ok: false } for string input', () => {
      const result = validateSegmentConfig('foo');
      expect(result.ok).toBe(false);
    });

    it('returns { ok: false } for missing segments field', () => {
      const result = validateSegmentConfig({});
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/empty|required/i);
    });

    it('returns { ok: false } for empty segments array with user-readable message', () => {
      const result = validateSegmentConfig({ segments: [] });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/empty|required/i);
    });
  });

  describe('rejects invalid duration values', () => {
    it('rejects NaN duration', () => {
      const result = validateSegmentConfig({
        segments: [{ id: 's1', durationMs: NaN, endSound: 'gentle' }],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/duration/i);
    });

    it('rejects zero duration', () => {
      const result = validateSegmentConfig({
        segments: [{ id: 's1', durationMs: 0, endSound: 'gentle' }],
      });
      expect(result.ok).toBe(false);
    });

    it('rejects negative duration', () => {
      const result = validateSegmentConfig({
        segments: [{ id: 's1', durationMs: -100, endSound: 'gentle' }],
      });
      expect(result.ok).toBe(false);
    });

    it('rejects duration exceeding the 4-hour ceiling', () => {
      const result = validateSegmentConfig({
        segments: [{ id: 's1', durationMs: 14_400_001, endSound: 'gentle' }],
      });
      expect(result.ok).toBe(false);
    });

    it('rejects Infinity duration', () => {
      const result = validateSegmentConfig({
        segments: [{ id: 's1', durationMs: Infinity, endSound: 'gentle' }],
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('rejects invalid sound keys', () => {
    it('rejects unknown sound key with key name in error message', () => {
      const result = validateSegmentConfig({
        segments: [{ id: 's1', durationMs: 1000, endSound: 'beep' }],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/beep/);
        expect(result.error).toMatch(/gentle.*triangle.*alarm|expected/i);
      }
    });
  });

  describe('rejects invalid ids', () => {
    it('rejects empty-string id', () => {
      const result = validateSegmentConfig({
        segments: [{ id: '', durationMs: 1000, endSound: 'gentle' }],
      });
      expect(result.ok).toBe(false);
    });

    it('rejects non-string id', () => {
      const result = validateSegmentConfig({
        segments: [{ id: 42, durationMs: 1000, endSound: 'gentle' }],
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('defensive contract — never throws (SEG-04)', () => {
    it('does not throw on null', () => {
      expect(() => validateSegmentConfig(null)).not.toThrow();
    });

    it('does not throw on undefined', () => {
      expect(() => validateSegmentConfig(undefined)).not.toThrow();
    });

    it('does not throw on primitive', () => {
      expect(() => validateSegmentConfig(42)).not.toThrow();
      expect(() => validateSegmentConfig('foo')).not.toThrow();
      expect(() => validateSegmentConfig(true)).not.toThrow();
    });

    it('does not throw on circular reference', () => {
      const circular: { segments: unknown[] } = { segments: [] };
      circular.segments.push(circular);
      expect(() => validateSegmentConfig(circular)).not.toThrow();
    });

    it('does not throw on segments containing null entries', () => {
      expect(() => validateSegmentConfig({ segments: [null] })).not.toThrow();
    });

    it('first-failure-wins — reports the first invalid segment by index', () => {
      const result = validateSegmentConfig({
        segments: [
          { id: 's1', durationMs: 1000, endSound: 'gentle' },
          { id: 's2', durationMs: -1, endSound: 'gentle' },     // bad
          { id: 's3', durationMs: 1000, endSound: 'unknown' },  // also bad
        ],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Segment 1');
        expect(result.error).not.toContain('Segment 2');
      }
    });
  });
});
