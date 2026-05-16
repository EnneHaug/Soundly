/**
 * Pure state-transition reducer for the Composer modal (Phase 9).
 *
 * First useReducer in the codebase per 09-PATTERNS.md:23-29 — introduces a NEW
 * pattern (not in the v1 hook stack which used useState only). Pure function,
 * zero React imports — unit-testable in isolation. All composer edits flow
 * through the single switch so constraints (MAX_SEGMENTS cap, D-12 last-segment
 * guard) live in one place.
 *
 * 6 actions cover the complete COMP-04..COMP-05 surface:
 *  - load             — replace state from default preset or decoded share URL
 *                       (regenerates ids so React keys stay stable across
 *                       re-decodes of the same shared URL — 09-RESEARCH.md:407-411)
 *  - add              — append a default segment at the end (D-21 defaults)
 *  - duplicate        — clone segment at index+1 with a fresh id (D-21)
 *  - delete           — remove segment at index; UNCHANGED when only one
 *                       segment remains (D-12 last-segment guard,
 *                       belt-and-suspenders with the UI's disabled Delete)
 *  - update_duration  — mutate one row's durationMs; other rows ref-equal
 *  - update_sound     — mutate one row's endSound; other rows ref-equal
 *
 * MAX_SEGMENTS = 32 mirrors shareUrl.ts D-17 cap, so any shared-URL decode
 * that fits the cap also fits the composer.
 *
 * Pitfall 6 (09-RESEARCH.md:1271-1275): never call dispatch in a render path —
 * always inside an event handler or effect.
 */

import type { Segment, SegmentConfig } from '../engine/SegmentState';

const MAX_SEGMENTS = 32; // Matches D-17 size cap (mirrors shareUrl.ts cap)

let nextId = 0;
function genSegmentId(): string {
  // Composer-owned IDs; engine treats them as opaque per Phase 7 D-18.
  // 'composer-<timestamp>-<counter>' avoids Date.now() alone (flaky in tests
  // because multiple ids generated in the same ms would collide) and avoids
  // a UUID lib (uniqueness within composer session is sufficient).
  return `composer-${Date.now()}-${++nextId}`;
}

export type ComposerAction =
  | { type: 'load'; config: SegmentConfig }
  | { type: 'add' }
  | { type: 'duplicate'; index: number }
  | { type: 'delete'; index: number }
  | { type: 'update_duration'; index: number; durationMs: number }
  | { type: 'update_sound'; index: number; endSound: Segment['endSound'] };

export function composerReducer(state: SegmentConfig, action: ComposerAction): SegmentConfig {
  switch (action.type) {
    case 'load':
      return {
        segments: action.config.segments.map((s) => ({ ...s, id: genSegmentId() })),
      };
    case 'add':
      if (state.segments.length >= MAX_SEGMENTS) return state;
      return {
        segments: [...state.segments, { id: genSegmentId(), durationMs: 60_000, endSound: 'gentle' }],
      };
    case 'duplicate': {
      if (state.segments.length >= MAX_SEGMENTS) return state;
      const src = state.segments[action.index];
      if (!src) return state;
      const clone: Segment = { ...src, id: genSegmentId() };
      const next = [...state.segments];
      next.splice(action.index + 1, 0, clone);
      return { segments: next };
    }
    case 'delete':
      // D-12: last-remaining segment can't be deleted — guard here as
      // belt-and-suspenders with the UI's disabled state.
      if (state.segments.length <= 1) return state;
      return { segments: state.segments.filter((_, i) => i !== action.index) };
    case 'update_duration':
      return {
        segments: state.segments.map((s, i) =>
          i === action.index ? { ...s, durationMs: action.durationMs } : s
        ),
      };
    case 'update_sound':
      return {
        segments: state.segments.map((s, i) =>
          i === action.index ? { ...s, endSound: action.endSound } : s
        ),
      };
  }
}
