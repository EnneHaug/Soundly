import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHashComposition } from '../useHashComposition';

// Mock window.location.hash + window.history.replaceState per test.
// We use Object.defineProperty (standalone.test.ts:7-14 idiom) because jsdom's
// built-in location object isn't directly assignable.
const originalLocation = window.location;
const originalReplaceState = window.history.replaceState;
let replaceStateSpy: ReturnType<typeof vi.fn>;

function setHash(hash: string, pathname = '/Soundly/', search = '') {
  // We re-define window.location with a minimal shape carrying just what the hook reads.
  Object.defineProperty(window, 'location', {
    value: { hash, pathname, search, origin: 'http://localhost' },
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  replaceStateSpy = vi.fn();
  Object.defineProperty(window.history, 'replaceState', {
    value: replaceStateSpy,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  // Restore originals so subsequent test files aren't polluted.
  Object.defineProperty(window, 'location', {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window.history, 'replaceState', {
    value: originalReplaceState,
    writable: true,
    configurable: true,
  });
  vi.restoreAllMocks();
});

describe('useHashComposition — no hash present', () => {
  it('returns { composition: null, error: null } when window.location.hash is empty', () => {
    setHash('');
    const { result } = renderHook(() => useHashComposition());
    expect(result.current.composition).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('does NOT call history.replaceState when no hash present', () => {
    setHash('');
    renderHook(() => useHashComposition());
    expect(replaceStateSpy).not.toHaveBeenCalled();
  });
});

describe('useHashComposition — unrelated hash (not #c=)', () => {
  it('returns { composition: null, error: null } when hash does not start with #c=', () => {
    setHash('#unrelated');
    const { result } = renderHook(() => useHashComposition());
    expect(result.current.composition).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('does NOT call history.replaceState for non-#c= hashes', () => {
    setHash('#unrelated');
    renderHook(() => useHashComposition());
    expect(replaceStateSpy).not.toHaveBeenCalled();
  });
});

describe('useHashComposition — valid #c=v1:... hash (SHR-02 success path)', () => {
  it('decodes the composition into state.composition', () => {
    setHash('#c=v1:60000-0');
    const { result } = renderHook(() => useHashComposition());
    expect(result.current.composition).not.toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.composition?.segments).toHaveLength(1);
    expect(result.current.composition?.segments[0].durationMs).toBe(60000);
    expect(result.current.composition?.segments[0].endSound).toBe('gentle');
  });

  it('decodes a multi-segment composition with mixed sounds', () => {
    // 2 segments: 60s gentle (idx 0) + 30s triangle (idx 1)
    setHash('#c=v1:60000-0,30000-1');
    const { result } = renderHook(() => useHashComposition());
    expect(result.current.composition?.segments).toHaveLength(2);
    expect(result.current.composition?.segments[0].endSound).toBe('gentle');
    expect(result.current.composition?.segments[1].endSound).toBe('triangle');
    expect(result.current.composition?.segments[1].durationMs).toBe(30000);
  });

  it('clears the hash via history.replaceState(null, "", pathname + search) per D-18', () => {
    setHash('#c=v1:60000-0', '/Soundly/', '');
    renderHook(() => useHashComposition());
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/Soundly/');
  });

  it('preserves search query string when clearing the hash', () => {
    setHash('#c=v1:60000-0', '/Soundly/', '?dev=segments');
    renderHook(() => useHashComposition());
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/Soundly/?dev=segments');
  });
});

describe('useHashComposition — invalid hash (SHR-03 fallback path)', () => {
  it('returns error="wrong_version" for #c=v2:...', () => {
    setHash('#c=v2:60000-0');
    const { result } = renderHook(() => useHashComposition());
    expect(result.current.composition).toBeNull();
    expect(result.current.error).toBe('wrong_version');
  });

  it('returns error="malformed" for #c=garbage', () => {
    setHash('#c=garbage');
    const { result } = renderHook(() => useHashComposition());
    expect(result.current.composition).toBeNull();
    expect(result.current.error).toBe('malformed');
  });

  it('returns error="invalid_segment_data" for #c=v1:60000-9 (unknown sound idx)', () => {
    setHash('#c=v1:60000-9');
    const { result } = renderHook(() => useHashComposition());
    expect(result.current.composition).toBeNull();
    expect(result.current.error).toBe('invalid_segment_data');
  });

  it('returns error="too_long" for #c=v1:<huge>', () => {
    // Build a hash that exceeds MAX_HASH_LENGTH (1024) after the #c= strip.
    const body = '60000-0,'.repeat(200); // ~1600 chars
    setHash('#c=' + body);
    const { result } = renderHook(() => useHashComposition());
    expect(result.current.composition).toBeNull();
    expect(result.current.error).toBe('too_long');
  });

  it('still calls history.replaceState even on decode failure (so refresh does not re-trigger)', () => {
    setHash('#c=v2:60000-0');
    renderHook(() => useHashComposition());
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
  });
});

describe('useHashComposition — clearError', () => {
  it('clearError resets error to null without affecting composition', () => {
    setHash('#c=v2:60000-0');
    const { result } = renderHook(() => useHashComposition());
    expect(result.current.error).toBe('wrong_version');
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
    expect(result.current.composition).toBeNull();
  });

  it('clearError does NOT touch a successfully-decoded composition', () => {
    setHash('#c=v1:60000-0');
    const { result } = renderHook(() => useHashComposition());
    expect(result.current.composition).not.toBeNull();
    act(() => result.current.clearError());
    expect(result.current.composition).not.toBeNull();
    expect(result.current.error).toBeNull();
  });
});

describe('useHashComposition — never throws on tampered input (SHR-03)', () => {
  it('binary garbage in the hash does not crash the hook', () => {
    setHash('#c=\x00\x01\x02');
    expect(() => renderHook(() => useHashComposition())).not.toThrow();
  });

  it('empty c= body returns invalid_segment_data', () => {
    setHash('#c=v1:');
    const { result } = renderHook(() => useHashComposition());
    expect(result.current.error).toBe('invalid_segment_data');
  });
});

describe('useHashComposition — synchronous read (Pitfall 2 — no flicker)', () => {
  it('composition is populated on the FIRST render (not after a useEffect tick)', () => {
    setHash('#c=v1:60000-0');
    // renderHook returns the result of the first render synchronously.
    // If the hook used useEffect (Pitfall 2), result.current.composition
    // would be null here and only populate after a re-render.
    const { result } = renderHook(() => useHashComposition());
    expect(result.current.composition).not.toBeNull();
  });
});
