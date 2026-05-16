/**
 * useHashComposition — App-mount URL-hash decoder hook.
 *
 * First URL-routing hook in the codebase (per 09-PATTERNS.md:23-29). Reads
 * window.location.hash exactly ONCE via a useState initializer (synchronous —
 * runs BEFORE the first render, avoiding the Dashboard-flicker bug per
 * Pitfall 2 at 09-RESEARCH.md:1247-1251). The hash is then cleared from the
 * URL bar by a post-commit useEffect calling history.replaceState (D-18).
 *
 * Locks SHR-02 (decoded compositions pass through SEG-04 validation gate via
 * shareUrl.decodeComposition's defence-in-depth final pass) and SHR-03
 * (invalid URLs fall back gracefully — decodeComposition NEVER throws).
 *
 * Hash discriminator: only '#c=' prefixes are processed. Other hashes are
 * ignored silently (not treated as errors) — keeps the hook benign if a
 * future feature adds different hash semantics.
 *
 * iOS Safari standalone-mode hash preservation: MEDIUM confidence per
 * 09-RESEARCH.md:890 + Assumption A1. Recommend a smoke-test during
 * integration; fallback would be query-string `?c=` (deferred to Phase 11).
 */

import { useState, useEffect } from 'react';
import { decodeComposition, type DecodeResult } from '../lib/shareUrl';
import type { SegmentConfig } from '../engine/SegmentState';

type HashError = Exclude<DecodeResult, { ok: true }>['reason'];

export interface HashCompositionState {
  composition: SegmentConfig | null;
  error: HashError | null;
  clearError: () => void;
}

export function useHashComposition(): HashCompositionState {
  const [state, setState] = useState<{
    composition: SegmentConfig | null;
    error: HashError | null;
  }>(() => {
    // useState initializer — runs ONCE synchronously before first render.
    // Critical: NOT useEffect, to avoid the Dashboard-flicker bug (Pitfall 2).
    if (typeof window === 'undefined' || !window.location.hash) {
      return { composition: null, error: null };
    }
    const raw = window.location.hash; // includes leading '#'
    if (!raw.startsWith('#c=')) {
      // Hash present but not ours — ignore, don't surface as error.
      return { composition: null, error: null };
    }
    const result = decodeComposition(raw);
    if (result.ok) {
      return { composition: result.config, error: null };
    }
    return { composition: null, error: result.reason };
  });

  // Post-commit: clear the hash from the URL bar (D-18).
  // useEffect avoids touching history during render (Pitfall 5 at 09-RESEARCH.md:1265-1269).
  // Empty deps array — runs exactly once after first mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.location.hash.startsWith('#c=')) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    composition: state.composition,
    error: state.error,
    clearError: () => setState((s) => ({ ...s, error: null })),
  };
}
