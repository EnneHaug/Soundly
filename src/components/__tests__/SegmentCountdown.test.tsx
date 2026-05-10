/**
 * SegmentCountdown test suite — locks the D-03/D-05/D-19/D-20 visual + interaction contract.
 *
 * Mirrors SegmentProgressRing.test.tsx idiom (vitest + @testing-library/react render +
 * direct-DOM read). Uses fake timers to assert the 250ms ticker behavior. Builds a
 * UseSegmentAlarmReturn fixture via makeAlarm() helper so each test mutates only the
 * field under exam.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import SegmentCountdown from '../SegmentCountdown';
import { WAKE_EASY_CONFIG } from '../../engine/SegmentState';
import type { UseSegmentAlarmReturn } from '../../hooks/useSegmentAlarm';

// Helper to build a UseSegmentAlarmReturn fixture with sensible defaults
function makeAlarm(overrides: Partial<UseSegmentAlarmReturn> = {}): UseSegmentAlarmReturn {
  return {
    state: 'running',
    isPaused: false,
    isRunning: true,
    currentSegment: {
      index: 0,
      total: 5,
      segment: WAKE_EASY_CONFIG.segments[0],
    },
    segmentEndsAt: Date.now() + 240_000, // 4 minutes from now
    totalEndsAt: Date.now() + 1_020_000, // 17 minutes from now
    alarmStartedAt: 0,
    activeConfig: WAKE_EASY_CONFIG,
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-10T10:00:00.000Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SegmentCountdown — initial render (segment 1, running)', () => {
  it('renders the big mm:ss timer with the segment-remaining value', () => {
    const alarm = makeAlarm();
    const { container } = render(<SegmentCountdown alarm={alarm} />);
    // 4:00 segment-remaining
    expect(container.textContent).toContain('04:00');
  });

  it('renders the total-time caption "{mm:ss} total"', () => {
    const alarm = makeAlarm();
    const { container } = render(<SegmentCountdown alarm={alarm} />);
    // 17:00 total
    expect(container.textContent).toContain('17:00 total');
  });

  it('renders the segment label "Segment 1 of 5 — Gentle chime"', () => {
    const alarm = makeAlarm();
    const { container } = render(<SegmentCountdown alarm={alarm} />);
    expect(container.textContent).toContain('Segment 1 of 5 — Gentle chime');
  });

  it('renders Pause and Stop buttons enabled', () => {
    const alarm = makeAlarm();
    const { getByText } = render(<SegmentCountdown alarm={alarm} />);
    const pauseBtn = getByText('Pause') as HTMLButtonElement;
    const stopBtn = getByText('Stop') as HTMLButtonElement;
    expect(pauseBtn.disabled).toBe(false);
    expect(stopBtn.disabled).toBe(false);
  });
});

describe('SegmentCountdown — phase label varies by endSound (UI-SPEC SOUND_LABELS)', () => {
  it('shows "Triangle ping" for triangle endSound', () => {
    const alarm = makeAlarm({
      currentSegment: {
        index: 0,
        total: 1,
        segment: { id: 'tri', durationMs: 60_000, endSound: 'triangle' },
      },
      activeConfig: {
        segments: [{ id: 'tri', durationMs: 60_000, endSound: 'triangle' }],
      },
    });
    const { container } = render(<SegmentCountdown alarm={alarm} />);
    expect(container.textContent).toContain('Triangle ping');
  });

  it('shows "Gentle chime" for gentle endSound', () => {
    const alarm = makeAlarm();
    const { container } = render(<SegmentCountdown alarm={alarm} />);
    expect(container.textContent).toContain('Gentle chime');
  });
});

describe('SegmentCountdown — pause state (D-19)', () => {
  it('Pause button label flips to "Resume" when isPaused=true', () => {
    const alarm = makeAlarm({ isPaused: true });
    const { getByText } = render(<SegmentCountdown alarm={alarm} />);
    expect(getByText('Resume')).toBeDefined();
  });

  it('clicking Pause invokes alarm.pause()', () => {
    const alarm = makeAlarm();
    const { getByText } = render(<SegmentCountdown alarm={alarm} />);
    (getByText('Pause') as HTMLButtonElement).click();
    expect(alarm.pause).toHaveBeenCalledTimes(1);
  });

  it('clicking Resume invokes alarm.resume()', () => {
    const alarm = makeAlarm({ isPaused: true });
    const { getByText } = render(<SegmentCountdown alarm={alarm} />);
    (getByText('Resume') as HTMLButtonElement).click();
    expect(alarm.resume).toHaveBeenCalledTimes(1);
  });

  it('clicking Stop invokes alarm.stop()', () => {
    const alarm = makeAlarm();
    const { getByText } = render(<SegmentCountdown alarm={alarm} />);
    (getByText('Stop') as HTMLButtonElement).click();
    expect(alarm.stop).toHaveBeenCalledTimes(1);
  });
});

describe('SegmentCountdown — firing-alarm state (D-03)', () => {
  it('Pause button is disabled and has disabled:opacity-40 class', () => {
    const alarm = makeAlarm({
      state: 'firing-alarm',
      alarmStartedAt: Date.now() - 5_000, // alarm started 5 seconds ago
      segmentEndsAt: 0,
      totalEndsAt: 0,
      currentSegment: {
        index: 4,
        total: 5,
        segment: WAKE_EASY_CONFIG.segments[4], // alarm endSound
      },
    });
    const { getByText } = render(<SegmentCountdown alarm={alarm} />);
    const pauseBtn = getByText('Pause') as HTMLButtonElement;
    expect(pauseBtn.disabled).toBe(true);
    expect(pauseBtn.className).toContain('disabled:opacity-40');
    expect(pauseBtn.className).toContain('disabled:cursor-not-allowed');
  });

  it('big timer shows count-up since alarmStartedAt (00:05)', () => {
    const alarm = makeAlarm({
      state: 'firing-alarm',
      alarmStartedAt: Date.now() - 5_000,
      segmentEndsAt: 0,
      totalEndsAt: 0,
      currentSegment: {
        index: 4,
        total: 5,
        segment: WAKE_EASY_CONFIG.segments[4],
      },
    });
    const { container } = render(<SegmentCountdown alarm={alarm} />);
    expect(container.textContent).toContain('00:05');
  });

  it('phase label shows "Wake" (not the segment-index format)', () => {
    const alarm = makeAlarm({
      state: 'firing-alarm',
      alarmStartedAt: Date.now() - 1_000,
      segmentEndsAt: 0,
      totalEndsAt: 0,
      currentSegment: {
        index: 4,
        total: 5,
        segment: WAKE_EASY_CONFIG.segments[4],
      },
    });
    const { container } = render(<SegmentCountdown alarm={alarm} />);
    expect(container.textContent).toContain('Wake');
    // "Segment 5 of 5" must NOT appear during firing-alarm
    expect(container.textContent).not.toContain('Segment 5 of 5');
  });

  it('total-time caption is hidden during firing-alarm', () => {
    const alarm = makeAlarm({
      state: 'firing-alarm',
      alarmStartedAt: Date.now() - 1_000,
      segmentEndsAt: 0,
      totalEndsAt: 0,
      currentSegment: {
        index: 4,
        total: 5,
        segment: WAKE_EASY_CONFIG.segments[4],
      },
    });
    const { container } = render(<SegmentCountdown alarm={alarm} />);
    expect(container.textContent).not.toContain('total');
  });
});

describe('SegmentCountdown — ticker (250ms cadence + freeze on pause)', () => {
  it('big timer ticks down by 1 second after 1000ms of fake time', () => {
    const alarm = makeAlarm();
    const { container, rerender } = render(<SegmentCountdown alarm={alarm} />);
    expect(container.textContent).toContain('04:00');
    vi.advanceTimersByTime(1000);
    rerender(<SegmentCountdown alarm={alarm} />);
    expect(container.textContent).toContain('03:59');
  });

  it('big timer text does NOT change when paused (timer freeze per D-19)', () => {
    const alarm = makeAlarm({ isPaused: true });
    const { container, rerender } = render(<SegmentCountdown alarm={alarm} />);
    const initialText = container.textContent;
    vi.advanceTimersByTime(5000);
    rerender(<SegmentCountdown alarm={alarm} />);
    expect(container.textContent).toBe(initialText);
  });
});

describe('SegmentCountdown — SegmentProgressRing wiring', () => {
  it('passes pulseActive=true to SegmentProgressRing during firing-alarm', () => {
    const alarm = makeAlarm({
      state: 'firing-alarm',
      alarmStartedAt: Date.now(),
      segmentEndsAt: 0,
      totalEndsAt: 0,
      currentSegment: {
        index: 4,
        total: 5,
        segment: WAKE_EASY_CONFIG.segments[4],
      },
    });
    const { container } = render(<SegmentCountdown alarm={alarm} />);
    // SegmentProgressRing applies the pulse-active class to the current arc when pulseActive=true
    expect(container.querySelectorAll('.pulse-active').length).toBe(1);
  });

  it('passes pausedDimming=true to SegmentProgressRing when isPaused', () => {
    const alarm = makeAlarm({ isPaused: true });
    const { container } = render(<SegmentCountdown alarm={alarm} />);
    // Current segment 0 is gentle (sage); when pausedDimming=true, opacity drops to 0.5
    const dimmed = Array.from(container.querySelectorAll('path')).filter(
      (p) =>
        p.getAttribute('stroke') === 'var(--color-sage)' &&
        p.getAttribute('opacity') === '0.5',
    );
    expect(dimmed.length).toBe(1);
  });
});
