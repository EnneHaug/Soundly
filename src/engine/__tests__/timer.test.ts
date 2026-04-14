import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scheduleAt, TimerHandle } from '../timer';

describe('scheduleAt', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires callback when target time is reached', () => {
    const callback = vi.fn();
    const now = Date.now();
    scheduleAt(now + 500, callback);

    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(600);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('cancel prevents callback from firing', () => {
    const callback = vi.fn();
    const now = Date.now();
    const handle: TimerHandle = scheduleAt(now + 500, callback);

    handle.cancel();
    vi.advanceTimersByTime(1000);
    expect(callback).not.toHaveBeenCalled();
  });

  it('fires callback immediately when target is in the past', () => {
    const callback = vi.fn();
    const now = Date.now();
    scheduleAt(now - 1000, callback);

    // Advance by the check interval to allow the first tick to fire
    vi.advanceTimersByTime(250);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('callback fires only once even when timer advances far past target', () => {
    const callback = vi.fn();
    const now = Date.now();
    scheduleAt(now + 100, callback);

    vi.advanceTimersByTime(10000);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
