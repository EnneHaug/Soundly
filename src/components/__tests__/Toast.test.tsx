/**
 * Toast test suite — visibility gate (null = nothing), live-region ARIA contract,
 * auto-dismiss timing via fake timers, unmount cleanup, and the locked
 * fixed-position class string (UI-SPEC L484-498).
 *
 * Fake timers are essential here — real setTimeout would force a 3s delay per
 * timing test. vi.useFakeTimers() lets us advance time deterministically.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Toast from '../Toast';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('Toast', () => {
  it('renders nothing when message is null', () => {
    const { container } = render(<Toast message={null} durationMs={3000} onDismiss={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders message text with role="status" aria-live="polite" when message is non-null', () => {
    render(<Toast message="Share link copied to clipboard" durationMs={3000} onDismiss={vi.fn()} />);
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('Share link copied to clipboard');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('aria-atomic')).toBe('true');
  });

  it('auto-dismisses after durationMs by invoking onDismiss', () => {
    const onDismiss = vi.fn();
    render(<Toast message="Hi" durationMs={3000} onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2999);
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('clears the pending timeout when unmounted before durationMs elapses', () => {
    const onDismiss = vi.fn();
    const { unmount } = render(<Toast message="Hi" durationMs={3000} onDismiss={onDismiss} />);
    vi.advanceTimersByTime(1000);
    unmount();
    vi.advanceTimersByTime(5000);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('uses the fixed-position bottom-center class string per UI-SPEC L488-491', () => {
    render(<Toast message="Hi" durationMs={3000} onDismiss={vi.fn()} />);
    const status = screen.getByRole('status');
    expect(status.className).toContain('fixed');
    expect(status.className).toContain('bottom-8');
    expect(status.className).toContain('left-1/2');
    expect(status.className).toContain('-translate-x-1/2');
    expect(status.className).toContain('z-50');
  });
});
