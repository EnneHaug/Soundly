import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startVibration, stopVibration } from '../vibration';

describe('vibration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    // Ensure clean state after each test by stopping vibration
    stopVibration();
  });

  describe('startVibration', () => {
    it('is exported as a function', () => {
      expect(typeof startVibration).toBe('function');
    });

    it('calls navigator.vibrate with [300, 200] immediately when supported', () => {
      const mockVibrate = vi.fn().mockReturnValue(true);
      vi.stubGlobal('navigator', { vibrate: mockVibrate });

      startVibration();

      expect(mockVibrate).toHaveBeenCalledWith([300, 200]);
    });

    it('sets up interval to repeat vibrate([300, 200]) every 500ms', () => {
      const mockVibrate = vi.fn().mockReturnValue(true);
      vi.stubGlobal('navigator', { vibrate: mockVibrate });

      startVibration();

      // Initial call
      expect(mockVibrate).toHaveBeenCalledTimes(1);

      // Advance by one cycle (500ms)
      vi.advanceTimersByTime(500);
      expect(mockVibrate).toHaveBeenCalledTimes(2);

      // Advance by another cycle
      vi.advanceTimersByTime(500);
      expect(mockVibrate).toHaveBeenCalledTimes(3);
    });

    it('is a no-op if vibrate is not in navigator', () => {
      vi.stubGlobal('navigator', {}); // no vibrate property

      expect(() => startVibration()).not.toThrow();

      // No interval should run
      vi.advanceTimersByTime(2000);
      // Just verifying no crash
    });

    it('does not throw on desktop/iOS where vibrate is absent', () => {
      vi.stubGlobal('navigator', {});
      expect(() => startVibration()).not.toThrow();
    });
  });

  describe('stopVibration', () => {
    it('is exported as a function', () => {
      expect(typeof stopVibration).toBe('function');
    });

    it('clears the interval so vibrate is no longer called after stop', () => {
      const mockVibrate = vi.fn().mockReturnValue(true);
      vi.stubGlobal('navigator', { vibrate: mockVibrate });

      startVibration();
      expect(mockVibrate).toHaveBeenCalledTimes(1);

      stopVibration();
      // stopVibration() calls vibrate(0) — record that count
      const callsAfterStop = mockVibrate.mock.calls.length;

      // Advance time — interval should be cleared, no more pattern calls
      vi.advanceTimersByTime(2000);
      // Call count must not increase (interval is cleared)
      expect(mockVibrate.mock.calls.length).toBe(callsAfterStop);
    });

    it('calls navigator.vibrate(0) to cancel in-progress vibration when supported', () => {
      const mockVibrate = vi.fn().mockReturnValue(true);
      vi.stubGlobal('navigator', { vibrate: mockVibrate });

      startVibration();
      stopVibration();

      expect(mockVibrate).toHaveBeenCalledWith(0);
    });

    it('is safe to call when vibration was never started', () => {
      const mockVibrate = vi.fn().mockReturnValue(true);
      vi.stubGlobal('navigator', { vibrate: mockVibrate });

      expect(() => stopVibration()).not.toThrow();
    });

    it('is safe to call when vibrate is not in navigator', () => {
      vi.stubGlobal('navigator', {});
      expect(() => stopVibration()).not.toThrow();
    });
  });
});
