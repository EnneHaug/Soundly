/**
 * Composer test suite — Phase 9 Plan 08.
 *
 * Covers Composer.tsx (full-screen modal segment builder) across the locked
 * surface from 09-08-PLAN.md:
 *   - COMP-02: pre-loaded with initialConfig (never blank — 5 WAKE_EASY segments)
 *   - COMP-04: '+ Add segment' appends a row through composerReducer
 *   - COMP-05: Duplicate adds a clone after the source
 *   - COMP-06: live total via useMemo re-derives on every edit
 *   - COMP-07: Start invokes onStart with current config
 *   - COMP-08: full-screen modal via native <dialog>.showModal()
 *   - SHR-01:  Share invokes navigator.share when canShare; clipboard fallback otherwise
 *   - D-11:    Start disabled with 'Fix invalid segments first' tooltip when any row invalid
 *   - D-12:    last-segment Delete disabled
 *   - D-14:    close-X + Cancel both invoke onClose
 *   - D-19:    Share is ALWAYS enabled — user can intentionally share a draft
 *   - Pitfall 4: AbortError on share-cancel is silent (no toast)
 *
 * jsdom v26 ships HTMLDialogElement but DOES NOT implement showModal/close —
 * polyfill them in beforeEach so the open/close lifecycle works during render.
 * The polyfilled close() dispatches the native 'close' event so the Composer's
 * close-listener fires onClose, matching the real-browser contract.
 *
 * Uses only Vitest matchers (no @testing-library/jest-dom — Plan 01 omitted it).
 * Single-instance RTL render() with explicit cleanup() in afterEach because
 * vitest globals: false disables auto-cleanup (matches SegmentCountdown.test.tsx
 * + Dashboard.test.tsx pattern established in Phase 8).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import Composer from '../Composer';
import { WAKE_EASY_CONFIG, type SegmentConfig } from '../../engine/SegmentState';

// jsdom v26 doesn't implement HTMLDialogElement.showModal/close — polyfill here
// so the open/close lifecycle works during render. The close() polyfill
// dispatches the native 'close' event so the Composer's close listener fires.
beforeEach(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      value: function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
        (this as unknown as { open: boolean }).open = true;
      },
      writable: true,
      configurable: true,
    });
  }
  if (!HTMLDialogElement.prototype.close) {
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      value: function (this: HTMLDialogElement) {
        this.removeAttribute('open');
        (this as unknown as { open: boolean }).open = false;
        this.dispatchEvent(new Event('close'));
      },
      writable: true,
      configurable: true,
    });
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeProps(
  overrides: Partial<ComponentProps<typeof Composer>> = {}
): ComponentProps<typeof Composer> {
  return {
    open: overrides.open ?? true,
    initialConfig: overrides.initialConfig ?? WAKE_EASY_CONFIG,
    onClose: overrides.onClose ?? vi.fn(),
    onStart: overrides.onStart ?? vi.fn().mockResolvedValue(undefined),
    onShareSuccess: overrides.onShareSuccess ?? vi.fn(),
    onShareError: overrides.onShareError ?? vi.fn(),
  };
}

describe('Composer — rendering (COMP-02, COMP-08)', () => {
  it('renders pre-loaded with WAKE_EASY_CONFIG (5 segments) — COMP-02 never blank', () => {
    render(<Composer {...makeProps()} />);
    // Five Duplicate buttons = five segments
    expect(screen.getAllByLabelText('Duplicate segment')).toHaveLength(5);
    expect(screen.getAllByLabelText('Delete segment')).toHaveLength(5);
  });

  it('renders title "Custom alarm" linked to dialog via aria-labelledby', () => {
    render(<Composer {...makeProps()} />);
    const title = screen.getByText('Custom alarm');
    expect(title.id).toBe('composer-title');
  });

  it('renders close-X with aria-label "Close composer"', () => {
    render(<Composer {...makeProps()} />);
    expect(screen.getByLabelText('Close composer')).toBeTruthy();
  });

  it('renders Cancel + Share + Start footer buttons', () => {
    render(<Composer {...makeProps()} />);
    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByText('Share')).toBeTruthy();
    expect(screen.getByText('Start')).toBeTruthy();
  });

  it('renders + Add segment button', () => {
    render(<Composer {...makeProps()} />);
    expect(screen.getByText('+ Add segment')).toBeTruthy();
  });

  it('mounts as a native <dialog> element', () => {
    const { container } = render(<Composer {...makeProps()} />);
    const dialog = container.querySelector('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute('aria-labelledby')).toBe('composer-title');
  });
});

describe('Composer — open/close lifecycle (D-14, COMP-08)', () => {
  it('calls showModal() when open=true on mount', () => {
    const showModalSpy = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    render(<Composer {...makeProps({ open: true })} />);
    expect(showModalSpy).toHaveBeenCalled();
  });

  it('does NOT call showModal() when open=false on mount', () => {
    const showModalSpy = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    render(<Composer {...makeProps({ open: false })} />);
    expect(showModalSpy).not.toHaveBeenCalled();
  });

  it('clicking close-X invokes onClose', () => {
    const onClose = vi.fn();
    render(<Composer {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByLabelText('Close composer'));
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking Cancel invokes onClose', () => {
    const onClose = vi.fn();
    render(<Composer {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Composer — live total (COMP-06)', () => {
  it('shows formatMmSs of the sum of segment durations on mount (WAKE_EASY = 17:00)', () => {
    render(<Composer {...makeProps()} />);
    // 4×240_000 + 60_000 = 1_020_000 ms = 17:00
    expect(screen.getByText('17:00')).toBeTruthy();
  });

  it('updates Total when a segment duration changes (live derivation)', () => {
    render(<Composer {...makeProps()} />);
    // First segment is 240_000 (above SMALL_STEP_THRESHOLD_MS=300_000? — 240_000 is below)
    // 240_000 < 300_000 so SMALL_STEP_MS=30_000 (+0:30 per click)
    // Click '+' once → first seg becomes 270_000 → total = 1_050_000 ms = 17:30
    const plusButtons = screen.getAllByLabelText('Increase duration');
    fireEvent.click(plusButtons[0]);
    expect(screen.getByText('17:30')).toBeTruthy();
  });

  it('renders Total label "Total"', () => {
    render(<Composer {...makeProps()} />);
    expect(screen.getByText('Total')).toBeTruthy();
  });
});

describe('Composer — reducer dispatch (COMP-04, COMP-05)', () => {
  it('clicking "+ Add segment" appends a 6th segment (COMP-04)', () => {
    render(<Composer {...makeProps()} />);
    fireEvent.click(screen.getByText('+ Add segment'));
    expect(screen.getAllByLabelText('Duplicate segment')).toHaveLength(6);
  });

  it('clicking Duplicate adds a clone (COMP-05)', () => {
    render(<Composer {...makeProps()} />);
    const duplicateButtons = screen.getAllByLabelText('Duplicate segment');
    fireEvent.click(duplicateButtons[0]);
    expect(screen.getAllByLabelText('Duplicate segment')).toHaveLength(6);
  });

  it('clicking Delete removes that segment (when more than 1 exists)', () => {
    render(<Composer {...makeProps()} />);
    const deleteButtons = screen.getAllByLabelText('Delete segment');
    fireEvent.click(deleteButtons[0]);
    expect(screen.getAllByLabelText('Delete segment')).toHaveLength(4);
  });

  it('Delete is disabled when only 1 segment remains (D-12)', () => {
    const singleSegment: SegmentConfig = {
      segments: [{ id: 's0', durationMs: 60_000, endSound: 'gentle' }],
    };
    render(<Composer {...makeProps({ initialConfig: singleSegment })} />);
    const del = screen.getByLabelText('Delete segment') as HTMLButtonElement;
    expect(del.disabled).toBe(true);
  });
});

describe('Composer — validation (D-11)', () => {
  it('Start is enabled when composition is valid', () => {
    render(<Composer {...makeProps()} />);
    const start = screen.getByText('Start') as HTMLButtonElement;
    expect(start.disabled).toBe(false);
  });

  it('Start is disabled with tooltip when any segment is invalid (durationMs=0)', () => {
    const invalid: SegmentConfig = {
      segments: [
        { id: 's0', durationMs: 0, endSound: 'gentle' },
        { id: 's1', durationMs: 60_000, endSound: 'alarm' },
      ],
    };
    render(<Composer {...makeProps({ initialConfig: invalid })} />);
    const start = screen.getByText('Start') as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    expect(start.getAttribute('title')).toBe('Fix invalid segments first');
  });

  it('renders the "Fix invalid segments first" caption below Start when disabled', () => {
    const invalid: SegmentConfig = {
      segments: [{ id: 's0', durationMs: 0, endSound: 'gentle' }],
    };
    render(<Composer {...makeProps({ initialConfig: invalid })} />);
    // Caption text appears twice: once as title attribute, once as visible caption.
    // getAllByText with the exact phrase finds at least 1 visible occurrence.
    const captions = screen.getAllByText('Fix invalid segments first');
    expect(captions.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Composer — Start (COMP-07)', () => {
  it('clicking Start invokes onStart with the current config', () => {
    const onStart = vi.fn().mockResolvedValue(undefined);
    render(<Composer {...makeProps({ onStart })} />);
    fireEvent.click(screen.getByText('Start'));
    expect(onStart).toHaveBeenCalled();
    const arg = onStart.mock.calls[0][0];
    expect(arg.segments).toHaveLength(5);
  });

  it('Start passes through edits to onStart (verifies current-state capture)', () => {
    const onStart = vi.fn().mockResolvedValue(undefined);
    render(<Composer {...makeProps({ onStart })} />);
    // Add a segment, then Start
    fireEvent.click(screen.getByText('+ Add segment'));
    fireEvent.click(screen.getByText('Start'));
    expect(onStart).toHaveBeenCalled();
    const arg = onStart.mock.calls[0][0];
    expect(arg.segments).toHaveLength(6);
  });
});

describe('Composer — share handler (SHR-01)', () => {
  it('invokes navigator.share when canShare returns true', async () => {
    const shareSpy = vi.fn().mockResolvedValue(undefined);
    const canShareSpy = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'share', {
      value: shareSpy,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'canShare', {
      value: canShareSpy,
      writable: true,
      configurable: true,
    });
    render(<Composer {...makeProps()} />);
    fireEvent.click(screen.getByText('Share'));
    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    const arg = shareSpy.mock.calls[0][0];
    expect(arg.url).toContain('#c=v1:');
    expect(arg.title).toBe('My alarm composition');
    expect(arg.text).toBe('Open this gentle alarm in Soundly');
  });

  it('falls back to clipboard.writeText when canShare returns false', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'canShare', {
      value: () => false,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      writable: true,
      configurable: true,
    });
    const onShareSuccess = vi.fn();
    render(<Composer {...makeProps({ onShareSuccess })} />);
    fireEvent.click(screen.getByText('Share'));
    await waitFor(() => expect(writeTextSpy).toHaveBeenCalled());
    expect(onShareSuccess).toHaveBeenCalledWith('Share link copied to clipboard');
  });

  it('falls back to clipboard.writeText when navigator.canShare is undefined entirely', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'canShare', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      writable: true,
      configurable: true,
    });
    const onShareSuccess = vi.fn();
    render(<Composer {...makeProps({ onShareSuccess })} />);
    fireEvent.click(screen.getByText('Share'));
    await waitFor(() => expect(writeTextSpy).toHaveBeenCalled());
    expect(onShareSuccess).toHaveBeenCalledWith('Share link copied to clipboard');
  });

  it('user-cancel via AbortError is silent (Pitfall 4)', async () => {
    const abortErr = new Error('User cancelled');
    abortErr.name = 'AbortError';
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockRejectedValue(abortErr),
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'canShare', {
      value: () => true,
      writable: true,
      configurable: true,
    });
    const onShareError = vi.fn();
    render(<Composer {...makeProps({ onShareError })} />);
    fireEvent.click(screen.getByText('Share'));
    // Flush microtask queue so the rejected promise resolves
    await new Promise((r) => setTimeout(r, 0));
    expect(onShareError).not.toHaveBeenCalled();
  });

  it('non-AbortError on share invokes onShareError', async () => {
    const otherErr = new Error('Network failed');
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockRejectedValue(otherErr),
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'canShare', {
      value: () => true,
      writable: true,
      configurable: true,
    });
    const onShareError = vi.fn();
    render(<Composer {...makeProps({ onShareError })} />);
    fireEvent.click(screen.getByText('Share'));
    await waitFor(() =>
      expect(onShareError).toHaveBeenCalledWith(
        "Couldn't share — try copying from the address bar"
      )
    );
  });

  it('clipboard failure invokes onShareError with copy-fallback message', async () => {
    const writeTextSpy = vi.fn().mockRejectedValue(new Error('clipboard denied'));
    Object.defineProperty(navigator, 'canShare', {
      value: () => false,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      writable: true,
      configurable: true,
    });
    const onShareError = vi.fn();
    render(<Composer {...makeProps({ onShareError })} />);
    fireEvent.click(screen.getByText('Share'));
    await waitFor(() =>
      expect(onShareError).toHaveBeenCalledWith(
        "Couldn't copy — try copying from the address bar"
      )
    );
  });

  it('Share is enabled even when composition is invalid (D-19 — share a draft)', () => {
    const invalid: SegmentConfig = {
      segments: [{ id: 's0', durationMs: 0, endSound: 'gentle' }],
    };
    render(<Composer {...makeProps({ initialConfig: invalid })} />);
    const share = screen.getByText('Share') as HTMLButtonElement;
    expect(share.disabled).toBe(false);
  });
});
