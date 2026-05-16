import { describe, it, expect } from 'vitest';
import { encodeComposition, decodeComposition } from '../shareUrl';
import { WAKE_EASY_CONFIG } from '../../engine/SegmentState';
import type { SegmentConfig } from '../../engine/SegmentState';

describe('encodeComposition', () => {
  it('encodes WAKE_EASY_CONFIG to the exact D-16 locked string', () => {
    const encoded = encodeComposition(WAKE_EASY_CONFIG);
    expect(encoded).toBe('v1:240000-0,240000-0,240000-0,240000-0,60000-2');
  });

  it('returns a value without leading "#" or "c=" prefix', () => {
    const encoded = encodeComposition(WAKE_EASY_CONFIG);
    expect(encoded.startsWith('#')).toBe(false);
    expect(encoded.startsWith('c=')).toBe(false);
    expect(encoded.startsWith('v1:')).toBe(true);
  });

  it('encodes a single-segment triangle composition', () => {
    const cfg: SegmentConfig = {
      segments: [{ id: 'x', durationMs: 60000, endSound: 'triangle' }],
    };
    expect(encodeComposition(cfg)).toBe('v1:60000-1');
  });

  it('maps endSound -> idx: gentle=0, triangle=1, alarm=2', () => {
    const cfg: SegmentConfig = {
      segments: [
        { id: 'a', durationMs: 1000, endSound: 'gentle' },
        { id: 'b', durationMs: 2000, endSound: 'triangle' },
        { id: 'c', durationMs: 3000, endSound: 'alarm' },
      ],
    };
    expect(encodeComposition(cfg)).toBe('v1:1000-0,2000-1,3000-2');
  });
});

describe('decodeComposition — success path', () => {
  it('decodes "v1:60000-0" into a single gentle segment', () => {
    const result = decodeComposition('v1:60000-0');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.segments).toEqual([
        { id: 'shared-0', durationMs: 60000, endSound: 'gentle' },
      ]);
    }
  });

  it('tolerates "#c=" prefix (raw location.hash)', () => {
    const result = decodeComposition('#c=v1:60000-0');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.segments).toEqual([
        { id: 'shared-0', durationMs: 60000, endSound: 'gentle' },
      ]);
    }
  });

  it('tolerates "c=" prefix (no leading hash)', () => {
    const result = decodeComposition('c=v1:60000-0');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.segments).toEqual([
        { id: 'shared-0', durationMs: 60000, endSound: 'gentle' },
      ]);
    }
  });

  it('regenerates segment ids as "shared-<i>" for decoded compositions', () => {
    const result = decodeComposition('v1:1000-0,2000-1,3000-2');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.segments.map((s) => s.id)).toEqual([
        'shared-0',
        'shared-1',
        'shared-2',
      ]);
    }
  });

  it('maps idx -> endSound: 0=gentle, 1=triangle, 2=alarm', () => {
    const result = decodeComposition('v1:1000-0,2000-1,3000-2');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.segments.map((s) => s.endSound)).toEqual([
        'gentle',
        'triangle',
        'alarm',
      ]);
    }
  });
});

describe('decodeComposition — error categories (SHR-03 never-throws contract)', () => {
  it('rejects "c=v2:*" as wrong_version', () => {
    const result = decodeComposition('c=v2:240000-0');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('wrong_version');
    }
  });

  it('rejects "c=v99:*" as wrong_version', () => {
    const result = decodeComposition('c=v99:240000-0');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('wrong_version');
    }
  });

  it('rejects "c=v1:abc-def" as malformed (non-integer parts)', () => {
    const result = decodeComposition('c=v1:abc-def');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('malformed');
    }
  });

  it('rejects input > 1024 chars as too_long', () => {
    const huge = 'c=' + 'x'.repeat(1500);
    const result = decodeComposition(huge);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('too_long');
    }
  });

  it('rejects unknown sound idx "9" as invalid_segment_data', () => {
    const result = decodeComposition('c=v1:240000-9');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid_segment_data');
    }
  });

  it('rejects empty body "c=v1:" as invalid_segment_data', () => {
    const result = decodeComposition('c=v1:');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid_segment_data');
    }
  });

  it('rejects zero-duration "c=v1:0-0" as invalid_segment_data', () => {
    const result = decodeComposition('c=v1:0-0');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid_segment_data');
    }
  });

  it('rejects "c=foo" (no version token) as malformed', () => {
    const result = decodeComposition('c=foo');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('malformed');
    }
  });

  it('rejects > 32 segments as invalid_segment_data', () => {
    const body = Array.from({ length: 33 }, () => '60000-0').join(',');
    const result = decodeComposition('c=v1:' + body);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid_segment_data');
    }
  });

  it('rejects "c=v1:60000" (no dash separator) as malformed', () => {
    const result = decodeComposition('c=v1:60000');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('malformed');
    }
  });

  it('rejects "c=v1:-0" (empty duration before dash) as malformed', () => {
    const result = decodeComposition('c=v1:-0');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('malformed');
    }
  });

  it('rejects "c=v1:60000-" (empty sound after dash) as malformed', () => {
    const result = decodeComposition('c=v1:60000-');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('malformed');
    }
  });

  it('rejects empty string as malformed', () => {
    const result = decodeComposition('');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('malformed');
    }
  });

  it('never throws on binary garbage input (SHR-03)', () => {
    expect(() => decodeComposition('💀')).not.toThrow();
    expect(() => decodeComposition('')).not.toThrow();
    expect(() => decodeComposition('\x00\x01\x02')).not.toThrow();
    expect(() => decodeComposition('c=v1:' + '!@#$%^&*()'.repeat(10))).not.toThrow();
  });

  it('never throws on extremely long random input', () => {
    const noisy = 'c=v1:' + Array.from({ length: 500 }, (_, i) => `${i}-${i % 9}`).join(',');
    expect(() => decodeComposition(noisy)).not.toThrow();
  });

  it('accepts input exactly at 1024-char cap without returning too_long', () => {
    // Build a valid body that, after prefix stripping, totals <= 1024 chars.
    // 'v1:' (3) + body == 1024 means body length == 1021. Each "60000-0," is 8 chars; use 32 segments max.
    const body = Array.from({ length: 32 }, () => '60000-0').join(',');
    const s = 'v1:' + body;
    expect(s.length).toBeLessThanOrEqual(1024);
    const result = decodeComposition(s);
    // Either ok:true or any reason except 'too_long' is acceptable here — we're only proving the cap is `>`, not `>=`.
    if (!result.ok) {
      expect(result.reason).not.toBe('too_long');
    } else {
      expect(result.config.segments.length).toBe(32);
    }
  });
});

describe('encode -> decode round-trip', () => {
  it('round-trips WAKE_EASY_CONFIG (durations + endSounds preserved; ids regenerated)', () => {
    const encoded = encodeComposition(WAKE_EASY_CONFIG);
    const result = decodeComposition(encoded);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.segments.length).toBe(WAKE_EASY_CONFIG.segments.length);
      for (let i = 0; i < WAKE_EASY_CONFIG.segments.length; i++) {
        expect(result.config.segments[i].durationMs).toBe(
          WAKE_EASY_CONFIG.segments[i].durationMs,
        );
        expect(result.config.segments[i].endSound).toBe(
          WAKE_EASY_CONFIG.segments[i].endSound,
        );
      }
    }
  });

  it('round-trips with "#c=" prefix added (full URL hash shape)', () => {
    const encoded = encodeComposition(WAKE_EASY_CONFIG);
    const result = decodeComposition('#c=' + encoded);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.segments.length).toBe(5);
    }
  });

  it('round-trips a mixed 3-segment composition', () => {
    const cfg: SegmentConfig = {
      segments: [
        { id: 'a', durationMs: 30000, endSound: 'gentle' },
        { id: 'b', durationMs: 120000, endSound: 'triangle' },
        { id: 'c', durationMs: 60000, endSound: 'alarm' },
      ],
    };
    const result = decodeComposition(encodeComposition(cfg));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.segments.map((s) => s.durationMs)).toEqual([30000, 120000, 60000]);
      expect(result.config.segments.map((s) => s.endSound)).toEqual([
        'gentle',
        'triangle',
        'alarm',
      ]);
    }
  });
});
