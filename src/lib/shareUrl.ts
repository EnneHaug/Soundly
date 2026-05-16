/**
 * Pure encode/decode for the versioned share-URL hash format.
 *
 * Format spec (D-16 LOCKED, SHR-01):
 *   c=v1:<durationMs>-<soundIdx>,<durationMs>-<soundIdx>,...
 *
 * Sound index mapping (D-16 LOCKED):
 *   gentle   -> 0
 *   triangle -> 1
 *   alarm    -> 2
 *
 * Size caps (D-17 LOCKED):
 *   - Maximum 1024 characters of hash payload (post `#` and `c=` stripping)
 *   - Maximum 32 segments per composition
 *
 * Version prefix (SHR-04):
 *   The literal `v1:` token gates the format. Future versions (`v2:`, `v3:`, ...)
 *   are reserved and currently rejected with reason 'wrong_version' — a
 *   non-breaking extension point for additive format changes.
 *
 * NEVER-THROWS contract (SHR-03):
 *   decodeComposition is a discriminated Result type — it MUST never throw on
 *   any string input, even binary garbage or oversized tampered URLs.
 *   The discriminator is `ok: true | false`. Every error path enumerates a
 *   reason so callers (and future telemetry) can distinguish failure modes.
 *
 * Defence-in-depth (SHR-02):
 *   The decoder's final step routes the parsed segments through
 *   validateSegmentConfig — the engine's single source of truth for segment
 *   validity. If a future engine-level rule rejects a config that passed
 *   shape parsing, the result reason is 'failed_validation'.
 *
 * URL-encoding:
 *   No percent-encoding needed. Digits `0-9`, `-`, and `,` are all RFC 3986
 *   fragment-safe characters (per 09-RESEARCH.md:832). The full share URL is
 *   constructed at the call site:
 *
 *     `${location.origin}${location.pathname}#c=${encodeComposition(config)}`
 *
 *   shareUrl.ts intentionally does NOT include the full URL builder — the
 *   caller honours the GitHub Pages `base: '/Soundly/'` path itself, avoiding
 *   the Pitfall-9 ambiguity (09-RESEARCH.md:1300-1304).
 *
 * Result idiom mirrors validateSegmentConfig (src/engine/SegmentState.ts:39-94)
 * — a Paired pattern that keeps "never throws" testable by `not.toThrow()`.
 *
 * @see .planning/phases/09-custom-composer-share-via-url/09-CONTEXT.md (D-16..D-19)
 * @see .planning/phases/09-custom-composer-share-via-url/09-RESEARCH.md (Pattern 6)
 * @see .planning/REQUIREMENTS.md (SHR-01..SHR-04)
 */

import { validateSegmentConfig, type SegmentConfig, type Segment } from '../engine/SegmentState';

const VERSION_PREFIX = 'v1:';
const MAX_HASH_LENGTH = 1024;
const MAX_SEGMENTS = 32;

const SOUND_BY_IDX: Record<string, Segment['endSound']> = {
  '0': 'gentle',
  '1': 'triangle',
  '2': 'alarm',
};

const IDX_BY_SOUND: Record<Segment['endSound'], string> = {
  gentle: '0',
  triangle: '1',
  alarm: '2',
};

export type DecodeResult =
  | { ok: true; config: SegmentConfig }
  | { ok: false; reason: 'wrong_version' | 'malformed' | 'too_long' | 'invalid_segment_data' | 'failed_validation' };

/**
 * Encode a validated SegmentConfig to the `v1:<dur>-<idx>,...` fragment value.
 * Returns the fragment payload only — without leading `#` or `c=` (the caller
 * composes the full URL).
 *
 * Pure function. Does not validate the input — callers should run
 * validateSegmentConfig first if the source is untrusted. (Roundtrip is
 * symmetric for any SegmentConfig that the engine validator accepts.)
 */
export function encodeComposition(config: SegmentConfig): string {
  const body = config.segments
    .map((s) => `${s.durationMs}-${IDX_BY_SOUND[s.endSound]}`)
    .join(',');
  return `${VERSION_PREFIX}${body}`;
}

/**
 * Decode a share-URL hash fragment into a SegmentConfig.
 *
 * Tolerates the following input prefixes (caller may pass raw `location.hash`):
 *   `#c=v1:...`  →  strip `#` then `c=`
 *   `c=v1:...`   →  strip `c=`
 *   `v1:...`     →  consume directly
 *
 * NEVER throws — every code path returns a DecodeResult. Errors are mapped to
 * the smallest reason category that distinguishes the failure mode:
 *
 *   too_long             — input exceeds MAX_HASH_LENGTH (1024) after prefix strip
 *   wrong_version        — starts with `vN:` where N != 1
 *   malformed            — version present but body shape unparseable
 *   invalid_segment_data — body parsed but value out of range (unknown sound idx,
 *                          zero duration, > MAX_SEGMENTS, empty body)
 *   failed_validation    — body produced a SegmentConfig that the engine
 *                          validator rejected (defence-in-depth, SHR-02)
 */
export function decodeComposition(input: string): DecodeResult {
  // Tolerate leading '#' and 'c=' prefixes so the caller can pass raw
  // window.location.hash or a stripped fragment interchangeably.
  let s = input;
  if (s.startsWith('#')) s = s.slice(1);
  if (s.startsWith('c=')) s = s.slice(2);

  // Hard size cap first — protects against algorithmic-complexity DoS via
  // pathologically long inputs (T-09-01-02 mitigation).
  if (s.length > MAX_HASH_LENGTH) {
    return { ok: false, reason: 'too_long' };
  }

  // Version prefix gate (SHR-04). If the input starts with any `vN:` other
  // than `v1:`, surface wrong_version so future format upgrades have an
  // explicit non-breaking signal. Everything else is malformed.
  if (!s.startsWith(VERSION_PREFIX)) {
    if (/^v\d+:/.test(s)) return { ok: false, reason: 'wrong_version' };
    return { ok: false, reason: 'malformed' };
  }

  const body = s.slice(VERSION_PREFIX.length);
  if (body.length === 0) {
    return { ok: false, reason: 'invalid_segment_data' };
  }

  const pairs = body.split(',');
  if (pairs.length === 0 || pairs.length > MAX_SEGMENTS) {
    return { ok: false, reason: 'invalid_segment_data' };
  }

  const segments: Segment[] = [];
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    const dashIdx = pair.indexOf('-');
    // Dash must exist, and must not be at position 0 (empty duration) or last (empty sound).
    if (dashIdx < 1 || dashIdx === pair.length - 1) {
      return { ok: false, reason: 'malformed' };
    }
    const durStr = pair.slice(0, dashIdx);
    const sndStr = pair.slice(dashIdx + 1);

    // Strict integer parsing — protects against NaN-corruption attacks where
    // Number('123abc') silently coerces or `Number('')` returns 0 (Pitfall 3,
    // 09-RESEARCH.md:1252-1257).
    if (!/^\d+$/.test(durStr) || !/^\d+$/.test(sndStr)) {
      return { ok: false, reason: 'malformed' };
    }
    const durationMs = Number(durStr);
    const endSound = SOUND_BY_IDX[sndStr];
    if (!endSound) {
      return { ok: false, reason: 'invalid_segment_data' };
    }
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      return { ok: false, reason: 'invalid_segment_data' };
    }
    segments.push({ id: `shared-${i}`, durationMs, endSound });
  }

  // Final defence-in-depth: route through the engine's validator (SHR-02).
  // Any engine-level rule (duration ceiling, empty list, future rules) flows
  // through here without duplicating logic in the decoder.
  const result = validateSegmentConfig({ segments });
  if (!result.ok) return { ok: false, reason: 'failed_validation' };
  return { ok: true, config: result.config };
}
