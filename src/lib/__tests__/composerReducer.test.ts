import { describe, it, expect } from 'vitest';
import { composerReducer, type ComposerAction } from '../composerReducer';
import { WAKE_EASY_CONFIG } from '../../engine/SegmentState';
import type { Segment, SegmentConfig } from '../../engine/SegmentState';

/**
 * Tests for the pure composer reducer.
 *
 * Mirrors the validateSegmentConfig.test.ts idiom (src/engine/__tests__):
 * describe-per-action + it-per-behavior. No mocking, no React.
 *
 * Covers the full action union (load | add | duplicate | delete |
 * update_duration | update_sound) plus invariants:
 *  - reference-equality on no-ops (proves no mutation)
 *  - MAX_SEGMENTS=32 cap blocks add/duplicate beyond cap
 *  - D-12 last-segment delete guard
 *  - id regeneration on load (stable React keys across re-decodes)
 */

function makeSeg(id: string, durationMs = 60_000, endSound: Segment['endSound'] = 'gentle'): Segment {
  return { id, durationMs, endSound };
}

describe('composerReducer — load action', () => {
  it('regenerates ids so React keys are stable across re-decodes', () => {
    const result = composerReducer({ segments: [] }, { type: 'load', config: WAKE_EASY_CONFIG });
    expect(result.segments).toHaveLength(WAKE_EASY_CONFIG.segments.length);
    result.segments.forEach((seg, i) => {
      expect(seg.id).not.toBe(WAKE_EASY_CONFIG.segments[i].id);
      expect(seg.id.startsWith('composer-')).toBe(true);
    });
  });

  it('preserves durationMs and endSound from the loaded config', () => {
    const result = composerReducer({ segments: [] }, { type: 'load', config: WAKE_EASY_CONFIG });
    result.segments.forEach((seg, i) => {
      expect(seg.durationMs).toBe(WAKE_EASY_CONFIG.segments[i].durationMs);
      expect(seg.endSound).toBe(WAKE_EASY_CONFIG.segments[i].endSound);
    });
  });

  it('returns a fresh top-level object reference (so React re-renders)', () => {
    const initial: SegmentConfig = { segments: [makeSeg('a')] };
    const result = composerReducer(initial, { type: 'load', config: WAKE_EASY_CONFIG });
    expect(result).not.toBe(initial);
  });
});

describe('composerReducer — add action (COMP-04)', () => {
  it('appends a segment with defaults { durationMs: 60_000, endSound: "gentle" } per D-21 on empty state', () => {
    const result = composerReducer({ segments: [] }, { type: 'add' });
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].durationMs).toBe(60_000);
    expect(result.segments[0].endSound).toBe('gentle');
    expect(result.segments[0].id.startsWith('composer-')).toBe(true);
  });

  it('appends a default segment at the end on non-empty state', () => {
    const state: SegmentConfig = { segments: [makeSeg('a', 120_000, 'triangle')] };
    const result = composerReducer(state, { type: 'add' });
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]).toBe(state.segments[0]); // existing ref preserved
    expect(result.segments[1].durationMs).toBe(60_000);
    expect(result.segments[1].endSound).toBe('gentle');
  });

  it('returns state UNCHANGED when at MAX_SEGMENTS (32) cap', () => {
    const state: SegmentConfig = {
      segments: Array(32).fill(null).map((_, i) => makeSeg(`s-${i}`)),
    };
    const result = composerReducer(state, { type: 'add' });
    expect(result).toBe(state); // reference equality — no mutation, no new object
  });
});

describe('composerReducer — duplicate action (COMP-05)', () => {
  it('clones the segment at index+1 with a fresh id per D-21', () => {
    const state: SegmentConfig = {
      segments: [makeSeg('a', 120_000, 'triangle'), makeSeg('b', 90_000, 'alarm')],
    };
    const result = composerReducer(state, { type: 'duplicate', index: 0 });
    expect(result.segments).toHaveLength(3);
    expect(result.segments[0]).toBe(state.segments[0]); // original ref-equal
    expect(result.segments[1].durationMs).toBe(120_000);
    expect(result.segments[1].endSound).toBe('triangle');
    expect(result.segments[1].id).not.toBe('a');
    expect(result.segments[1].id.startsWith('composer-')).toBe(true);
    expect(result.segments[2]).toBe(state.segments[1]); // b shifted, still ref-equal
  });

  it('returns state UNCHANGED when index is out of range', () => {
    const state: SegmentConfig = { segments: [makeSeg('a')] };
    const result = composerReducer(state, { type: 'duplicate', index: 999 });
    expect(result).toBe(state);
  });

  it('returns state UNCHANGED when at MAX_SEGMENTS cap', () => {
    const state: SegmentConfig = {
      segments: Array(32).fill(null).map((_, i) => makeSeg(`s-${i}`)),
    };
    const result = composerReducer(state, { type: 'duplicate', index: 0 });
    expect(result).toBe(state);
  });
});

describe('composerReducer — delete action', () => {
  it('removes the segment at the given index', () => {
    const state: SegmentConfig = {
      segments: [makeSeg('a'), makeSeg('b'), makeSeg('c')],
    };
    const result = composerReducer(state, { type: 'delete', index: 1 });
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]).toBe(state.segments[0]);
    expect(result.segments[1]).toBe(state.segments[2]);
  });

  it('returns state UNCHANGED when only one segment remains (D-12 guard)', () => {
    const state: SegmentConfig = { segments: [makeSeg('only')] };
    const result = composerReducer(state, { type: 'delete', index: 0 });
    expect(result).toBe(state);
  });
});

describe('composerReducer — update_duration', () => {
  it('updates only the target segment; others are reference-equal', () => {
    const state: SegmentConfig = {
      segments: [makeSeg('s0'), makeSeg('s1'), makeSeg('s2')],
    };
    const result = composerReducer(state, { type: 'update_duration', index: 1, durationMs: 30_000 });
    expect(result.segments[0]).toBe(state.segments[0]);
    expect(result.segments[1]).not.toBe(state.segments[1]);
    expect(result.segments[1].durationMs).toBe(30_000);
    expect(result.segments[1].id).toBe('s1');
    expect(result.segments[1].endSound).toBe('gentle');
    expect(result.segments[2]).toBe(state.segments[2]);
  });
});

describe('composerReducer — update_sound', () => {
  it('updates only the target segment endSound; others are reference-equal', () => {
    const state: SegmentConfig = {
      segments: [makeSeg('s0', 60_000, 'gentle'), makeSeg('s1', 60_000, 'gentle')],
    };
    const result = composerReducer(state, { type: 'update_sound', index: 0, endSound: 'alarm' });
    expect(result.segments[0]).not.toBe(state.segments[0]);
    expect(result.segments[0].endSound).toBe('alarm');
    expect(result.segments[0].durationMs).toBe(60_000);
    expect(result.segments[0].id).toBe('s0');
    expect(result.segments[1]).toBe(state.segments[1]);
  });
});

describe('composerReducer — invariants', () => {
  it('never throws on any action input', () => {
    const state: SegmentConfig = { segments: [makeSeg('a')] };
    const actions: ComposerAction[] = [
      { type: 'add' },
      { type: 'duplicate', index: -1 },
      { type: 'duplicate', index: 999 },
      { type: 'delete', index: 999 },
      { type: 'update_duration', index: 999, durationMs: 0 },
      { type: 'update_sound', index: 999, endSound: 'alarm' },
      { type: 'load', config: { segments: [] } },
    ];
    actions.forEach((action) => {
      expect(() => composerReducer(state, action)).not.toThrow();
    });
  });

  it('returns the original top-level reference for no-op actions (no needless re-render)', () => {
    const capped: SegmentConfig = {
      segments: Array(32).fill(null).map((_, i) => makeSeg(`s-${i}`)),
    };
    expect(composerReducer(capped, { type: 'add' })).toBe(capped);
    expect(composerReducer(capped, { type: 'duplicate', index: 0 })).toBe(capped);

    const single: SegmentConfig = { segments: [makeSeg('only')] };
    expect(composerReducer(single, { type: 'delete', index: 0 })).toBe(single);
  });

  it('returns a new top-level reference for mutating actions (drives React re-render)', () => {
    const state: SegmentConfig = { segments: [makeSeg('a')] };
    expect(composerReducer(state, { type: 'add' })).not.toBe(state);
    expect(composerReducer(state, { type: 'duplicate', index: 0 })).not.toBe(state);
    expect(composerReducer(state, { type: 'update_duration', index: 0, durationMs: 1000 })).not.toBe(state);
    expect(composerReducer(state, { type: 'update_sound', index: 0, endSound: 'alarm' })).not.toBe(state);
  });
});
