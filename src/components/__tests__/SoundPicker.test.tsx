/**
 * SoundPicker test suite — covers D-04 LOCKED 3-pill selected color contract,
 * D-06 LOCKED 'Alarm' (NOT 'Wake') label divergence from SegmentCountdown's
 * SOUND_LABELS, D-07 LOCKED ArrowLeft/Right wrap-around keyboard map (plus
 * ArrowUp/Down mirrored navigation), MDN-canonical roving tabindex
 * (exactly-one-tabbable pattern), and the full ARIA radiogroup contract
 * (role="radiogroup" + role="radio" × 3 + aria-checked + aria-label).
 *
 * Uses Vitest built-in matchers + RTL fireEvent + cleanup() in afterEach
 * (mirrors Dashboard.test.tsx + StepperInput.test.tsx idiom — vitest globals:
 * false means RTL doesn't auto-clean DOM between tests).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import SoundPicker from '../SoundPicker';

afterEach(() => cleanup());

describe('SoundPicker — rendering', () => {
  it('renders three pills labeled Gentle / Triangle / Alarm (D-06 LOCKED)', () => {
    render(<SoundPicker value="gentle" onChange={vi.fn()} />);
    expect(screen.getByText('Gentle')).toBeTruthy();
    expect(screen.getByText('Triangle')).toBeTruthy();
    expect(screen.getByText('Alarm')).toBeTruthy();
  });

  it('does NOT render "Wake" (D-06 — Wake is reserved for SegmentCountdown phase label)', () => {
    render(<SoundPicker value="alarm" onChange={vi.fn()} />);
    expect(screen.queryByText('Wake')).toBeNull();
  });

  it('exposes role="radiogroup" with aria-label "End-of-segment sound"', () => {
    render(<SoundPicker value="gentle" onChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup');
    expect(group.getAttribute('aria-label')).toBe('End-of-segment sound');
  });

  it('renders three role="radio" buttons', () => {
    render(<SoundPicker value="gentle" onChange={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
  });

  it('uses rowIndex to generate per-row aria-label when supplied', () => {
    render(<SoundPicker value="gentle" onChange={vi.fn()} rowIndex={2} />);
    const group = screen.getByRole('radiogroup');
    expect(group.getAttribute('aria-label')).toBe('Segment 3 sound');
  });
});

describe('SoundPicker — selection state', () => {
  it('sets aria-checked=true on the selected pill', () => {
    render(<SoundPicker value="triangle" onChange={vi.fn()} />);
    const triangle = screen.getByText('Triangle').closest('button')!;
    expect(triangle.getAttribute('aria-checked')).toBe('true');
  });

  it('sets aria-checked=false on the other two pills', () => {
    render(<SoundPicker value="triangle" onChange={vi.fn()} />);
    const gentle = screen.getByText('Gentle').closest('button')!;
    const alarm = screen.getByText('Alarm').closest('button')!;
    expect(gentle.getAttribute('aria-checked')).toBe('false');
    expect(alarm.getAttribute('aria-checked')).toBe('false');
  });

  it('applies selected pill colors per D-04: gentle→bg-sage, triangle→bg-sand, alarm→bg-accent', () => {
    const { rerender } = render(<SoundPicker value="gentle" onChange={vi.fn()} />);
    let selectedPill = screen.getByText('Gentle').closest('button')!;
    expect(selectedPill.className).toContain('bg-sage');

    rerender(<SoundPicker value="triangle" onChange={vi.fn()} />);
    selectedPill = screen.getByText('Triangle').closest('button')!;
    expect(selectedPill.className).toContain('bg-sand');

    rerender(<SoundPicker value="alarm" onChange={vi.fn()} />);
    selectedPill = screen.getByText('Alarm').closest('button')!;
    expect(selectedPill.className).toContain('bg-accent');
  });

  it('uses text-text-primary on the selected sand pill (contrast — UI-SPEC L165-170)', () => {
    render(<SoundPicker value="triangle" onChange={vi.fn()} />);
    const triangle = screen.getByText('Triangle').closest('button')!;
    expect(triangle.className).toContain('text-text-primary');
    expect(triangle.className).not.toContain('text-white');
  });
});

describe('SoundPicker — roving tabindex (D-07 LOCKED)', () => {
  it('selected pill has tabIndex=0; others have tabIndex=-1', () => {
    render(<SoundPicker value="triangle" onChange={vi.fn()} />);
    expect(screen.getByText('Gentle').closest('button')!.getAttribute('tabindex')).toBe('-1');
    expect(screen.getByText('Triangle').closest('button')!.getAttribute('tabindex')).toBe('0');
    expect(screen.getByText('Alarm').closest('button')!.getAttribute('tabindex')).toBe('-1');
  });

  it('only ONE pill is tab-focusable across all selection values (exactly-one tabbable invariant)', () => {
    (['gentle', 'triangle', 'alarm'] as const).forEach((value) => {
      cleanup();
      render(<SoundPicker value={value} onChange={vi.fn()} />);
      const tabbable = screen
        .getAllByRole('radio')
        .filter((btn) => btn.getAttribute('tabindex') === '0');
      expect(tabbable).toHaveLength(1);
    });
  });
});

describe('SoundPicker — click selection', () => {
  it('clicking an unselected pill invokes onChange with that endSound', () => {
    const onChange = vi.fn();
    render(<SoundPicker value="gentle" onChange={onChange} />);
    fireEvent.click(screen.getByText('Triangle'));
    expect(onChange).toHaveBeenCalledWith('triangle');
  });

  it('clicking the currently-selected pill still invokes onChange (idempotent)', () => {
    const onChange = vi.fn();
    render(<SoundPicker value="gentle" onChange={onChange} />);
    fireEvent.click(screen.getByText('Gentle'));
    expect(onChange).toHaveBeenCalledWith('gentle');
  });

  it('clicking the alarm pill from gentle invokes onChange("alarm")', () => {
    const onChange = vi.fn();
    render(<SoundPicker value="gentle" onChange={onChange} />);
    fireEvent.click(screen.getByText('Alarm'));
    expect(onChange).toHaveBeenCalledWith('alarm');
  });
});

describe('SoundPicker — keyboard map (D-07 LOCKED)', () => {
  it('ArrowRight from gentle invokes onChange("triangle")', () => {
    const onChange = vi.fn();
    render(<SoundPicker value="gentle" onChange={onChange} />);
    const gentleBtn = screen.getByText('Gentle').closest('button')!;
    fireEvent.keyDown(gentleBtn, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('triangle');
  });

  it('ArrowRight wraps from alarm to gentle', () => {
    const onChange = vi.fn();
    render(<SoundPicker value="alarm" onChange={onChange} />);
    const alarmBtn = screen.getByText('Alarm').closest('button')!;
    fireEvent.keyDown(alarmBtn, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('gentle');
  });

  it('ArrowLeft wraps from gentle to alarm', () => {
    const onChange = vi.fn();
    render(<SoundPicker value="gentle" onChange={onChange} />);
    const gentleBtn = screen.getByText('Gentle').closest('button')!;
    fireEvent.keyDown(gentleBtn, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('alarm');
  });

  it('ArrowLeft from triangle invokes onChange("gentle")', () => {
    const onChange = vi.fn();
    render(<SoundPicker value="triangle" onChange={onChange} />);
    const triangleBtn = screen.getByText('Triangle').closest('button')!;
    fireEvent.keyDown(triangleBtn, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('gentle');
  });

  it('ArrowDown behaves the same as ArrowRight (mirrored navigation)', () => {
    const onChange = vi.fn();
    render(<SoundPicker value="gentle" onChange={onChange} />);
    fireEvent.keyDown(screen.getByText('Gentle').closest('button')!, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith('triangle');
  });

  it('ArrowUp behaves the same as ArrowLeft (mirrored navigation)', () => {
    const onChange = vi.fn();
    render(<SoundPicker value="triangle" onChange={onChange} />);
    fireEvent.keyDown(screen.getByText('Triangle').closest('button')!, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledWith('gentle');
  });

  it('Arrow keys are e.preventDefault\'d to suppress page scroll', () => {
    const onChange = vi.fn();
    render(<SoundPicker value="gentle" onChange={onChange} />);
    const gentleBtn = screen.getByText('Gentle').closest('button')!;
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    gentleBtn.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(onChange).toHaveBeenCalled();
  });
});

describe('SoundPicker — touch target', () => {
  it('each pill is at least 44px tall (min-h-[44px] per D-04)', () => {
    render(<SoundPicker value="gentle" onChange={vi.fn()} />);
    screen.getAllByRole('radio').forEach((btn) => {
      expect(btn.className).toContain('min-h-[44px]');
    });
  });
});

describe('SoundPicker — className passthrough', () => {
  it('applies the className prop to the radiogroup container', () => {
    render(
      <SoundPicker value="gentle" onChange={vi.fn()} className="max-[480px]:col-span-3" />,
    );
    const group = screen.getByRole('radiogroup');
    expect(group.className).toContain('max-[480px]:col-span-3');
  });
});
