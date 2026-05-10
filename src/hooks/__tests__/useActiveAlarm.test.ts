import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QUICK_NAP_CONFIG } from '../../engine/AlarmState';
import { WAKE_EASY_CONFIG } from '../../engine/SegmentState';
import type { UseAlarmReturn } from '../useAlarm';
import type { UseSegmentAlarmReturn } from '../useSegmentAlarm';

// === MOCKS — mock both underlying hooks; their return values are mutated per-test ===

let continuousMock: UseAlarmReturn;
let segmentsMock: UseSegmentAlarmReturn;

const continuousStartSpy = vi.fn().mockResolvedValue(undefined);
const segmentsStartSpy = vi.fn().mockResolvedValue(undefined);

const useAlarmCallCount = vi.fn();
const useSegmentAlarmCallCount = vi.fn();

vi.mock('../useAlarm', () => ({
  useAlarm: () => {
    useAlarmCallCount();
    return continuousMock;
  },
}));

vi.mock('../useSegmentAlarm', () => ({
  useSegmentAlarm: () => {
    useSegmentAlarmCallCount();
    return segmentsMock;
  },
}));

import { useActiveAlarm } from '../useActiveAlarm';

beforeEach(() => {
  vi.clearAllMocks();
  continuousMock = {
    phase: 'idle',
    isPaused: false,
    isRunning: false,
    phaseEndsAt: 0,
    activeConfig: null,
    start: continuousStartSpy,
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  };
  segmentsMock = {
    state: 'idle',
    isPaused: false,
    isRunning: false,
    currentSegment: null,
    segmentEndsAt: 0,
    totalEndsAt: 0,
    alarmStartedAt: 0,
    activeConfig: null,
    start: segmentsStartSpy,
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  };
});

afterEach(() => {
  // no global timers used here
});

describe('useActiveAlarm — initial state', () => {
  it('returns mode=idle with a start() function when neither hook is running', () => {
    const { result } = renderHook(() => useActiveAlarm());
    expect(result.current.mode).toBe('idle');
    if (result.current.mode === 'idle') {
      expect(typeof result.current.start).toBe('function');
    }
  });

  it('mounts both useAlarm and useSegmentAlarm exactly once on initial render (D-08 always-both-mounted)', () => {
    renderHook(() => useActiveAlarm());
    expect(useAlarmCallCount).toHaveBeenCalledTimes(1);
    expect(useSegmentAlarmCallCount).toHaveBeenCalledTimes(1);
  });
});

describe('useActiveAlarm — mode dispatch', () => {
  it('returns mode=continuous when useAlarm reports isRunning=true', () => {
    continuousMock.isRunning = true;
    const { result } = renderHook(() => useActiveAlarm());
    expect(result.current.mode).toBe('continuous');
    if (result.current.mode === 'continuous') {
      expect(result.current.alarm).toBe(continuousMock);
    }
  });

  it('returns mode=segments when useSegmentAlarm reports isRunning=true', () => {
    segmentsMock.isRunning = true;
    const { result } = renderHook(() => useActiveAlarm());
    expect(result.current.mode).toBe('segments');
    if (result.current.mode === 'segments') {
      expect(result.current.alarm).toBe(segmentsMock);
    }
  });

  it('continuous takes precedence if both report running (defensive — should not happen in practice per D-10 UI takeover)', () => {
    continuousMock.isRunning = true;
    segmentsMock.isRunning = true;
    const { result } = renderHook(() => useActiveAlarm());
    expect(result.current.mode).toBe('continuous');
  });
});

describe('useActiveAlarm — start() dispatch', () => {
  it('start({ kind: "continuous", config }) invokes useAlarm.start with the config', async () => {
    const { result } = renderHook(() => useActiveAlarm());
    if (result.current.mode !== 'idle') throw new Error('expected idle');
    await act(async () => {
      if (result.current.mode === 'idle') {
        await result.current.start({ kind: 'continuous', config: QUICK_NAP_CONFIG });
      }
    });
    expect(continuousStartSpy).toHaveBeenCalledTimes(1);
    expect(continuousStartSpy).toHaveBeenCalledWith(QUICK_NAP_CONFIG);
    expect(segmentsStartSpy).not.toHaveBeenCalled();
  });

  it('start({ kind: "segments", config }) invokes useSegmentAlarm.start with the config', async () => {
    const { result } = renderHook(() => useActiveAlarm());
    if (result.current.mode !== 'idle') throw new Error('expected idle');
    await act(async () => {
      if (result.current.mode === 'idle') {
        await result.current.start({ kind: 'segments', config: WAKE_EASY_CONFIG });
      }
    });
    expect(segmentsStartSpy).toHaveBeenCalledTimes(1);
    expect(segmentsStartSpy).toHaveBeenCalledWith(WAKE_EASY_CONFIG);
    expect(continuousStartSpy).not.toHaveBeenCalled();
  });
});

describe('useActiveAlarm — pendingMode race-window (RESEARCH Pattern 2)', () => {
  it('mode flips to "segments" between tap and isRunning=true (no flicker back to idle)', async () => {
    // Make segmentsMock.start a never-resolving promise to simulate the in-flight window
    let resolveStart!: () => void;
    const blockingStart = new Promise<void>((r) => {
      resolveStart = r;
    });
    segmentsMock.start = vi.fn(() => blockingStart);

    const { result, rerender } = renderHook(() => useActiveAlarm());
    if (result.current.mode !== 'idle') throw new Error('expected idle');

    // Kick off start without awaiting
    act(() => {
      if (result.current.mode === 'idle') {
        void result.current.start({
          kind: 'segments',
          config: WAKE_EASY_CONFIG,
        });
      }
    });
    rerender();
    // pendingMode now drives mode → segments, even though isRunning is still false
    expect(result.current.mode).toBe('segments');

    // Now resolve the start, simulating the engine flipping isRunning true
    segmentsMock.isRunning = true;
    await act(async () => {
      resolveStart();
      await blockingStart;
    });
    rerender();
    expect(result.current.mode).toBe('segments');
  });
});

describe('useActiveAlarm — mode reset after stop', () => {
  it('mode reverts to idle when underlying hook isRunning flips back to false', () => {
    continuousMock.isRunning = true;
    const { result, rerender } = renderHook(() => useActiveAlarm());
    expect(result.current.mode).toBe('continuous');

    // Simulate stop: underlying hook now reports not running
    continuousMock.isRunning = false;
    rerender();
    expect(result.current.mode).toBe('idle');
  });
});
