import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { WAKE_EASY_CONFIG } from '../../engine/SegmentState';
import type { SegmentChangeEvent, SegmentEngineState } from '../../engine/SegmentState';

// === MOCKS ===

// Mock the SegmentEngine class so we can inject events without instantiating
// the real engine (which transitively pulls AudioContext, Wake Lock, etc.).
// Each test gets a fresh mock instance via vi.clearAllMocks() in beforeEach.

let mockSegmentChangeCb: ((e: SegmentChangeEvent) => void) | null = null;
let mockState: SegmentEngineState = 'idle';
let mockCanPause = true;

const mockEngineInstance = {
  onSegmentChange: vi.fn((cb: (e: SegmentChangeEvent) => void) => {
    mockSegmentChangeCb = cb;
  }),
  start: vi.fn().mockImplementation(async () => {
    mockState = 'running';
  }),
  pause: vi.fn(),
  resume: vi.fn(),
  stop: vi.fn().mockImplementation(() => {
    mockState = 'dismissed';
  }),
  dismiss: vi.fn(),
  getState: vi.fn(() => mockState),
  getCurrentSegment: vi.fn(() => null),
  isPaused: vi.fn(() => false),
  canPause: vi.fn(() => mockCanPause),
};

vi.mock('../../engine/SegmentEngine', () => ({
  SegmentEngine: vi.fn().mockImplementation(() => mockEngineInstance),
}));

vi.mock('../../platform/notifications', () => ({
  requestNotificationPermission: vi.fn().mockResolvedValue(true),
}));

import { useSegmentAlarm } from '../useSegmentAlarm';
import { requestNotificationPermission } from '../../platform/notifications';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-10T10:00:00.000Z'));
  vi.clearAllMocks();
  mockSegmentChangeCb = null;
  mockState = 'idle';
  mockCanPause = true;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSegmentAlarm — initial state', () => {
  it('returns idle state with all zero/null fields when never started', () => {
    const { result } = renderHook(() => useSegmentAlarm());
    expect(result.current.state).toBe('idle');
    expect(result.current.isRunning).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.currentSegment).toBeNull();
    expect(result.current.segmentEndsAt).toBe(0);
    expect(result.current.totalEndsAt).toBe(0);
    expect(result.current.alarmStartedAt).toBe(0);
    expect(result.current.activeConfig).toBeNull();
  });

  it('returns object with exactly the locked D-09 keys (T-03-01: no engine ref leak)', () => {
    const { result } = renderHook(() => useSegmentAlarm());
    const keys = Object.keys(result.current).sort();
    expect(keys).toEqual([
      'activeConfig',
      'alarmStartedAt',
      'currentSegment',
      'isPaused',
      'isRunning',
      'pause',
      'resume',
      'segmentEndsAt',
      'start',
      'state',
      'stop',
      'totalEndsAt',
    ]);
  });
});

describe('useSegmentAlarm — start()', () => {
  it('requests notification permission BEFORE engine.start()', async () => {
    const { result } = renderHook(() => useSegmentAlarm());
    await act(async () => {
      await result.current.start(WAKE_EASY_CONFIG);
    });
    expect(requestNotificationPermission).toHaveBeenCalledTimes(1);
    expect(mockEngineInstance.start).toHaveBeenCalledTimes(1);
    expect(mockEngineInstance.start).toHaveBeenCalledWith(WAKE_EASY_CONFIG);
    // requestNotificationPermission must be called BEFORE engine.start
    const reqOrder = (requestNotificationPermission as any).mock.invocationCallOrder[0];
    const startOrder = mockEngineInstance.start.mock.invocationCallOrder[0];
    expect(reqOrder).toBeLessThan(startOrder);
  });

  it('populates isRunning, currentSegment, segmentEndsAt, totalEndsAt, activeConfig after start resolves', async () => {
    const { result } = renderHook(() => useSegmentAlarm());
    const before = Date.now();
    await act(async () => {
      await result.current.start(WAKE_EASY_CONFIG);
    });
    expect(result.current.isRunning).toBe(true);
    expect(result.current.activeConfig).toBe(WAKE_EASY_CONFIG);
    expect(result.current.currentSegment).not.toBeNull();
    expect(result.current.currentSegment!.index).toBe(0);
    expect(result.current.currentSegment!.total).toBe(5);
    expect(result.current.currentSegment!.segment).toBe(WAKE_EASY_CONFIG.segments[0]);
    // 4-minute first segment
    expect(result.current.segmentEndsAt).toBe(before + 240_000);
    // 17-minute total composition
    expect(result.current.totalEndsAt).toBe(before + 1_020_000);
    expect(result.current.alarmStartedAt).toBe(0);
  });
});

describe('useSegmentAlarm — onSegmentChange callback wiring', () => {
  it('updates currentSegment + segmentEndsAt on kind=start event', async () => {
    const { result } = renderHook(() => useSegmentAlarm());
    await act(async () => {
      await result.current.start(WAKE_EASY_CONFIG);
    });
    // Engine fires 'start' for segment 1 (after segment 0 ended)
    const seg1 = WAKE_EASY_CONFIG.segments[1];
    const fireTime = Date.now();
    act(() => {
      mockSegmentChangeCb!({
        kind: 'start',
        segmentIndex: 1,
        totalSegments: 5,
        segment: seg1,
      });
    });
    expect(result.current.currentSegment!.index).toBe(1);
    expect(result.current.currentSegment!.segment).toBe(seg1);
    expect(result.current.segmentEndsAt).toBe(fireTime + 240_000);
  });

  it('populates alarmStartedAt when alarm-segment kind=end event fires AND state=firing-alarm', async () => {
    const { result } = renderHook(() => useSegmentAlarm());
    await act(async () => {
      await result.current.start(WAKE_EASY_CONFIG);
    });
    expect(result.current.alarmStartedAt).toBe(0);
    // Engine transitions to firing-alarm before the callback (per SegmentEngine.ts:212)
    mockState = 'firing-alarm';
    const fireTime = Date.now();
    act(() => {
      mockSegmentChangeCb!({
        kind: 'end',
        segmentIndex: 4,
        totalSegments: 5,
        segment: WAKE_EASY_CONFIG.segments[4],
      });
    });
    expect(result.current.state).toBe('firing-alarm');
    expect(result.current.alarmStartedAt).toBe(fireTime);
    expect(result.current.segmentEndsAt).toBe(0);
    expect(result.current.totalEndsAt).toBe(0);
  });

  it('does NOT populate alarmStartedAt when kind=end fires for a non-alarm segment', async () => {
    const { result } = renderHook(() => useSegmentAlarm());
    await act(async () => {
      await result.current.start(WAKE_EASY_CONFIG);
    });
    act(() => {
      mockSegmentChangeCb!({
        kind: 'end',
        segmentIndex: 0,
        totalSegments: 5,
        segment: WAKE_EASY_CONFIG.segments[0], // gentle endSound
      });
    });
    expect(result.current.alarmStartedAt).toBe(0);
  });
});

describe('useSegmentAlarm — pause/resume snapshot semantics', () => {
  it('pause() snapshots BOTH segmentEndsAt AND totalEndsAt as remaining-ms', async () => {
    const { result } = renderHook(() => useSegmentAlarm());
    await act(async () => {
      await result.current.start(WAKE_EASY_CONFIG);
    });
    const startSnapshot = { seg: result.current.segmentEndsAt, total: result.current.totalEndsAt };
    // Advance 30 seconds before pause
    vi.advanceTimersByTime(30_000);
    act(() => {
      result.current.pause();
    });
    expect(mockEngineInstance.pause).toHaveBeenCalledTimes(1);
    expect(result.current.isPaused).toBe(true);
    // After pause, segmentEndsAt holds REMAINING ms (epoch-now), so it should be < the original epoch
    expect(result.current.segmentEndsAt).toBe(startSnapshot.seg - Date.now());
    expect(result.current.totalEndsAt).toBe(startSnapshot.total - Date.now());
  });

  it('resume() restores both fields to fresh epochs (extending total duration by pause-length)', async () => {
    const { result } = renderHook(() => useSegmentAlarm());
    await act(async () => {
      await result.current.start(WAKE_EASY_CONFIG);
    });
    vi.advanceTimersByTime(30_000);
    act(() => {
      result.current.pause();
    });
    const pausedSeg = result.current.segmentEndsAt;
    const pausedTotal = result.current.totalEndsAt;
    // Hold paused for 60 seconds
    vi.advanceTimersByTime(60_000);
    act(() => {
      result.current.resume();
    });
    expect(mockEngineInstance.resume).toHaveBeenCalledTimes(1);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.segmentEndsAt).toBe(Date.now() + pausedSeg);
    expect(result.current.totalEndsAt).toBe(Date.now() + pausedTotal);
  });

  it('pause() is silent no-op when engine.canPause() returns false (e.g. during firing-alarm)', async () => {
    const { result } = renderHook(() => useSegmentAlarm());
    await act(async () => {
      await result.current.start(WAKE_EASY_CONFIG);
    });
    mockCanPause = false;
    act(() => {
      result.current.pause();
    });
    expect(result.current.isPaused).toBe(false);
  });
});

describe('useSegmentAlarm — stop()', () => {
  it('calls engine.stop() and resets all state to initial', async () => {
    const { result } = renderHook(() => useSegmentAlarm());
    await act(async () => {
      await result.current.start(WAKE_EASY_CONFIG);
    });
    expect(result.current.isRunning).toBe(true);
    act(() => {
      result.current.stop();
    });
    expect(mockEngineInstance.stop).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('idle');
    expect(result.current.isRunning).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.currentSegment).toBeNull();
    expect(result.current.segmentEndsAt).toBe(0);
    expect(result.current.totalEndsAt).toBe(0);
    expect(result.current.alarmStartedAt).toBe(0);
    expect(result.current.activeConfig).toBeNull();
  });
});
