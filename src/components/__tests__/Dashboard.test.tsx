/**
 * Dashboard test suite — automated coverage for ROADMAP success criterion #1
 * ("4 x 4" card visible on Dashboard alongside Quick Nap and Focus) and the
 * locked dispatch payloads (D-12, D-14), plus Phase 9 D-08 (4th Custom card)
 * and COMP-01 (Custom card opens composer via onCustomClick prop).
 *
 * Uses only Vitest's built-in matchers (no @testing-library/jest-dom — Plan 01
 * Task 1 explicitly omitted it). Document order is verified via the native DOM
 * compareDocumentPosition API on jsdom, not via getAllByRole array indexing,
 * because that would couple the assertion to PresetCard's internal markup.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Dashboard from '../Dashboard';
import { WAKE_EASY_CONFIG, QUICK_NAP_CONFIG, FOCUS_CONFIG } from '../../engine';
import type { ActiveAlarmState } from '../../hooks/useActiveAlarm';

// Build the idle-mode variant of ActiveAlarmState that Dashboard accepts.
function makeIdleActiveAlarm(): Extract<ActiveAlarmState, { mode: 'idle' }> {
  return {
    mode: 'idle',
    start: vi.fn().mockResolvedValue(undefined),
  };
}

afterEach(() => {
  // SegmentCountdown test suite established this pattern — vitest globals: false
  // means RTL doesn't auto-cleanup between tests, so we clean up explicitly to
  // avoid duplicate-DOM matches on getByText() across tests.
  cleanup();
});

describe('Dashboard (ROADMAP success criterion #1)', () => {
  it('renders the three preset cards in document order: Quick Nap → Focus → 4 x 4', () => {
    const idle = makeIdleActiveAlarm();
    render(<Dashboard activeAlarm={idle} onCustomClick={vi.fn()} />);

    // Each PresetCard renders its `name` as the visible card heading.
    const quickNap = screen.getByText('Quick Nap');
    const focus = screen.getByText('Focus');
    const wakeEasy = screen.getByText('4 x 4');

    expect(quickNap).toBeTruthy();
    expect(focus).toBeTruthy();
    expect(wakeEasy).toBeTruthy();

    // Document-order check via DOCUMENT_POSITION_FOLLOWING (bit 0x04).
    // quickNap precedes focus, focus precedes wakeEasy.
    expect(quickNap.compareDocumentPosition(focus) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(focus.compareDocumentPosition(wakeEasy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders the "4 x 4" card description verbatim per D-12', () => {
    const idle = makeIdleActiveAlarm();
    render(<Dashboard activeAlarm={idle} onCustomClick={vi.fn()} />);

    expect(screen.getByText('4 chimes over 16 min, then alarm')).toBeTruthy();
  });

  it('clicking the "4 x 4" card dispatches { kind: "segments", config: WAKE_EASY_CONFIG }', () => {
    const idle = makeIdleActiveAlarm();
    render(<Dashboard activeAlarm={idle} onCustomClick={vi.fn()} />);

    // PresetCard wraps the whole card in a <button>. Click via the visible label.
    const wakeEasyCard = screen.getByText('4 x 4');
    fireEvent.click(wakeEasyCard);

    expect(idle.start).toHaveBeenCalledTimes(1);
    expect(idle.start).toHaveBeenCalledWith({ kind: 'segments', config: WAKE_EASY_CONFIG });
  });

  it('clicking the "Quick Nap" card dispatches { kind: "continuous", config: QUICK_NAP_CONFIG }', () => {
    const idle = makeIdleActiveAlarm();
    render(<Dashboard activeAlarm={idle} onCustomClick={vi.fn()} />);

    fireEvent.click(screen.getByText('Quick Nap'));

    expect(idle.start).toHaveBeenCalledWith({ kind: 'continuous', config: QUICK_NAP_CONFIG });
  });

  it('clicking the "Focus" card dispatches { kind: "continuous", config: FOCUS_CONFIG }', () => {
    const idle = makeIdleActiveAlarm();
    render(<Dashboard activeAlarm={idle} onCustomClick={vi.fn()} />);

    fireEvent.click(screen.getByText('Focus'));

    expect(idle.start).toHaveBeenCalledWith({ kind: 'continuous', config: FOCUS_CONFIG });
  });

  // ─── Phase 9 D-08 + COMP-01 — the 4th Custom card ─────────────────────────

  it('renders the 4th Custom card after 4 x 4 (D-08 LOCKED order)', () => {
    const idle = makeIdleActiveAlarm();
    render(<Dashboard activeAlarm={idle} onCustomClick={vi.fn()} />);

    const wakeEasy = screen.getByText('4 x 4');
    const custom = screen.getByText('Custom');

    expect(wakeEasy).toBeTruthy();
    expect(custom).toBeTruthy();
    // 4 x 4 must come BEFORE Custom in document order.
    expect(wakeEasy.compareDocumentPosition(custom) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders the CustomCard description "Compose your own alarm"', () => {
    const idle = makeIdleActiveAlarm();
    render(<Dashboard activeAlarm={idle} onCustomClick={vi.fn()} />);
    expect(screen.getByText('Compose your own alarm')).toBeTruthy();
  });

  it('clicking the Custom card invokes onCustomClick (COMP-01)', () => {
    const idle = makeIdleActiveAlarm();
    const onCustomClick = vi.fn();
    render(<Dashboard activeAlarm={idle} onCustomClick={onCustomClick} />);
    fireEvent.click(screen.getByLabelText('Open custom alarm composer'));
    expect(onCustomClick).toHaveBeenCalledTimes(1);
  });
});
