/**
 * SegmentRow test suite — covers composition of StepperInput + SoundPicker +
 * Duplicate + Delete, the verbatim UI-SPEC L354-391 grid layout (desktop +
 * mobile breakpoint), D-11 LOCKED invalid-row accent border + aria-invalid
 * propagation, D-12 LOCKED last-segment Delete guard with locked tooltip,
 * all 4 callback wirings (onDuplicate, onDelete, onDurationChange,
 * onSoundChange), per-row aria-label on the SoundPicker via the rowIndex
 * pass-through, and the visible glyphs (⧉ U+29C9 + × U+00D7) per UI-SPEC
 * L278-281.
 *
 * Idiom: vitest globals: false (matches existing pattern of explicit imports
 * in all 39 prior test files); cleanup() in afterEach to prevent DOM leaks
 * between tests (established by SegmentCountdown.test.tsx in Plan 08-05 and
 * carried forward through every UI test since).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ComponentProps } from 'react';
import SegmentRow from '../SegmentRow';
import type { Segment } from '../../engine/SegmentState';

afterEach(() => cleanup());

function makeProps(overrides: Partial<ComponentProps<typeof SegmentRow>> = {}) {
  const defaultSegment: Segment = { id: 's0', durationMs: 240_000, endSound: 'gentle' };
  return {
    segment: overrides.segment ?? defaultSegment,
    index: overrides.index ?? 0,
    isOnlyRow: overrides.isOnlyRow ?? false,
    isInvalid: overrides.isInvalid ?? false,
    onDurationChange: overrides.onDurationChange ?? vi.fn(),
    onSoundChange: overrides.onSoundChange ?? vi.fn(),
    onDuplicate: overrides.onDuplicate ?? vi.fn(),
    onDelete: overrides.onDelete ?? vi.fn(),
  };
}

describe('SegmentRow — rendering', () => {
  it('renders StepperInput + SoundPicker + Duplicate + Delete', () => {
    render(<SegmentRow {...makeProps()} />);
    expect(screen.getByLabelText('Segment duration')).toBeTruthy();
    expect(screen.getByRole('radiogroup')).toBeTruthy();
    expect(screen.getByLabelText('Duplicate segment')).toBeTruthy();
    expect(screen.getByLabelText('Delete segment')).toBeTruthy();
  });

  it('uses the verbatim grid-cols-[auto_1fr_auto_auto] desktop layout', () => {
    const { container } = render(<SegmentRow {...makeProps()} />);
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain('grid-cols-[auto_1fr_auto_auto]');
  });

  it('uses the max-[480px] mobile breakpoint for stacking', () => {
    const { container } = render(<SegmentRow {...makeProps()} />);
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain('max-[480px]:grid-cols-[1fr_auto_auto]');
  });

  it('passes max-[480px]:col-span-3 className to SoundPicker so it spans the mobile row', () => {
    render(<SegmentRow {...makeProps()} />);
    const group = screen.getByRole('radiogroup');
    expect(group.className).toContain('max-[480px]:col-span-3');
  });
});

describe('SegmentRow — invalid border (D-11 LOCKED)', () => {
  it('renders no accent border when isInvalid={false}', () => {
    const { container } = render(<SegmentRow {...makeProps({ isInvalid: false })} />);
    const row = container.firstChild as HTMLElement;
    expect(row.className).not.toContain('border-accent/50');
  });

  it('renders accent border + rounded-lg when isInvalid={true}', () => {
    const { container } = render(<SegmentRow {...makeProps({ isInvalid: true })} />);
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain('border-accent/50');
    expect(row.className).toContain('rounded-lg');
  });

  it('propagates aria-invalid="true" to the StepperInput when isInvalid={true}', () => {
    render(<SegmentRow {...makeProps({ isInvalid: true })} />);
    const stepperInput = screen.getByLabelText('Segment duration');
    expect(stepperInput.getAttribute('aria-invalid')).toBe('true');
  });

  it('does NOT propagate aria-invalid when isInvalid={false}', () => {
    render(<SegmentRow {...makeProps({ isInvalid: false })} />);
    const stepperInput = screen.getByLabelText('Segment duration');
    // React serializes undefined aria-invalid to absent attribute; explicit false would be "false".
    expect(stepperInput.getAttribute('aria-invalid')).not.toBe('true');
  });
});

describe('SegmentRow — last-segment delete guard (D-12 LOCKED)', () => {
  it('disables Delete when isOnlyRow={true}', () => {
    render(<SegmentRow {...makeProps({ isOnlyRow: true })} />);
    const del = screen.getByLabelText('Delete segment');
    expect(del.hasAttribute('disabled')).toBe(true);
  });

  it('shows the locked tooltip "At least one segment required" when disabled', () => {
    render(<SegmentRow {...makeProps({ isOnlyRow: true })} />);
    const del = screen.getByLabelText('Delete segment');
    expect(del.getAttribute('title')).toBe('At least one segment required');
  });

  it('does NOT disable Delete when isOnlyRow={false}', () => {
    render(<SegmentRow {...makeProps({ isOnlyRow: false })} />);
    const del = screen.getByLabelText('Delete segment');
    expect(del.hasAttribute('disabled')).toBe(false);
  });

  it('clears the title attribute when isOnlyRow={false}', () => {
    render(<SegmentRow {...makeProps({ isOnlyRow: false })} />);
    const del = screen.getByLabelText('Delete segment');
    expect(del.getAttribute('title')).toBeNull();
  });

  it('Delete click is suppressed natively when disabled (D-12 belt-and-suspenders)', () => {
    const onDelete = vi.fn();
    render(<SegmentRow {...makeProps({ isOnlyRow: true, onDelete })} />);
    const del = screen.getByLabelText('Delete segment');
    fireEvent.click(del);
    expect(onDelete).not.toHaveBeenCalled();
  });
});

describe('SegmentRow — callback wiring', () => {
  it('clicking Delete (when enabled) invokes onDelete exactly once', () => {
    const onDelete = vi.fn();
    render(<SegmentRow {...makeProps({ onDelete })} />);
    fireEvent.click(screen.getByLabelText('Delete segment'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('clicking Duplicate invokes onDuplicate exactly once (COMP-05)', () => {
    const onDuplicate = vi.fn();
    render(<SegmentRow {...makeProps({ onDuplicate })} />);
    fireEvent.click(screen.getByLabelText('Duplicate segment'));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
  });

  it('clicking the stepper "+" invokes onDurationChange with the next value', () => {
    const onDurationChange = vi.fn();
    render(<SegmentRow {...makeProps({ onDurationChange })} />);
    fireEvent.click(screen.getByLabelText('Increase duration'));
    // Default segment is 240_000 ms (above the 300_000 SMALL_STEP_THRESHOLD: false,
    // so step is SMALL_STEP_MS = 30_000 → 270_000). At/above threshold uses LARGE.
    // 240_000 is BELOW threshold so step is 30_000 → next value is 270_000.
    expect(onDurationChange).toHaveBeenCalledWith(270_000);
  });

  it('clicking a sound pill invokes onSoundChange with the pill value', () => {
    const onSoundChange = vi.fn();
    render(<SegmentRow {...makeProps({ onSoundChange })} />);
    fireEvent.click(screen.getByText('Triangle'));
    expect(onSoundChange).toHaveBeenCalledWith('triangle');
  });
});

describe('SegmentRow — sound picker per-row aria-label', () => {
  it('passes index to SoundPicker for per-row aria-label "Segment N sound" (1-indexed)', () => {
    render(<SegmentRow {...makeProps({ index: 2 })} />);
    const group = screen.getByRole('radiogroup');
    expect(group.getAttribute('aria-label')).toBe('Segment 3 sound');
  });

  it('index=0 renders aria-label "Segment 1 sound"', () => {
    render(<SegmentRow {...makeProps({ index: 0 })} />);
    const group = screen.getByRole('radiogroup');
    expect(group.getAttribute('aria-label')).toBe('Segment 1 sound');
  });
});

describe('SegmentRow — visible glyphs (UI-SPEC L278-281)', () => {
  it('renders the duplicate glyph ⧉ (U+29C9) inside the Duplicate button', () => {
    render(<SegmentRow {...makeProps()} />);
    const dup = screen.getByLabelText('Duplicate segment');
    expect(dup.textContent).toBe('⧉');
  });

  it('renders the delete glyph × (U+00D7) inside the Delete button', () => {
    render(<SegmentRow {...makeProps()} />);
    const del = screen.getByLabelText('Delete segment');
    expect(del.textContent).toBe('×');
  });
});

describe('SegmentRow — touch target (UI-SPEC 44px floor)', () => {
  it('Duplicate button sets w-11 h-11 (44 px touch target)', () => {
    render(<SegmentRow {...makeProps()} />);
    const dup = screen.getByLabelText('Duplicate segment');
    expect(dup.className).toContain('w-11');
    expect(dup.className).toContain('h-11');
  });

  it('Delete button sets w-11 h-11 (44 px touch target)', () => {
    render(<SegmentRow {...makeProps()} />);
    const del = screen.getByLabelText('Delete segment');
    expect(del.className).toContain('w-11');
    expect(del.className).toContain('h-11');
  });
});

describe('SegmentRow — segment prop wiring', () => {
  it('renders the segment durationMs through the StepperInput value (formatMmSs)', () => {
    const seg: Segment = { id: 's42', durationMs: 360_000, endSound: 'triangle' };
    render(<SegmentRow {...makeProps({ segment: seg })} />);
    const stepperInput = screen.getByLabelText('Segment duration') as HTMLInputElement;
    expect(stepperInput.value).toBe('06:00');
  });

  it('reflects segment.endSound as the selected radio (aria-checked="true")', () => {
    const seg: Segment = { id: 's42', durationMs: 60_000, endSound: 'alarm' };
    render(<SegmentRow {...makeProps({ segment: seg })} />);
    const alarmPill = screen.getByText('Alarm');
    expect(alarmPill.getAttribute('aria-checked')).toBe('true');
  });
});
