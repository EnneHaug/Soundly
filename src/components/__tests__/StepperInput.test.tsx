/**
 * StepperInput test suite — covers D-01 LOCKED adaptive step (with the 5:00
 * boundary case per Pitfall 7), D-02 LOCKED keyboard map (Arrow / Shift+Arrow /
 * PageUp/Down), 5s/60min clamps via disabled-button assertions, and the ARIA
 * contract (aria-valuetext mm:ss readout, aria-label on buttons + input,
 * aria-invalid propagation from the row-level invalid state).
 *
 * Uses Vitest built-in matchers + RTL fireEvent + cleanup() in afterEach (mirrors
 * the Dashboard.test.tsx idiom — vitest globals: false means RTL doesn't
 * auto-clean DOM between tests).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import StepperInput from '../StepperInput';

afterEach(() => cleanup());

function renderStepper(initial: number, onChange = vi.fn()) {
  const utils = render(<StepperInput valueMs={initial} onChange={onChange} />);
  return {
    ...utils,
    onChange,
    minusBtn: screen.getByLabelText('Decrease duration') as HTMLButtonElement,
    plusBtn: screen.getByLabelText('Increase duration') as HTMLButtonElement,
    input: screen.getByLabelText('Segment duration') as HTMLInputElement,
  };
}

describe('StepperInput — adaptive step (D-01 LOCKED)', () => {
  it('"+" at 1 min advances by 30s (below 5:00 threshold)', () => {
    const { plusBtn, onChange } = renderStepper(60_000);
    fireEvent.click(plusBtn);
    expect(onChange).toHaveBeenCalledWith(90_000);
  });

  it('"+" at exactly 5:00 advances by 1 min (at threshold uses LARGE)', () => {
    const { plusBtn, onChange } = renderStepper(300_000);
    fireEvent.click(plusBtn);
    expect(onChange).toHaveBeenCalledWith(360_000);
  });

  it('"+" at 7:00 advances by 1 min', () => {
    const { plusBtn, onChange } = renderStepper(420_000);
    fireEvent.click(plusBtn);
    expect(onChange).toHaveBeenCalledWith(480_000);
  });

  it('"−" at exactly 5:00 drops by 1 MIN to 4:00 — BOUNDARY CASE per D-01 (Pitfall 7)', () => {
    const { minusBtn, onChange } = renderStepper(300_000);
    fireEvent.click(minusBtn);
    expect(onChange).toHaveBeenCalledWith(240_000);
  });

  it('"−" at 4:00 drops by 30s (below threshold)', () => {
    const { minusBtn, onChange } = renderStepper(240_000);
    fireEvent.click(minusBtn);
    expect(onChange).toHaveBeenCalledWith(210_000);
  });

  it('"−" at 6:00 drops by 1 min (above threshold)', () => {
    const { minusBtn, onChange } = renderStepper(360_000);
    fireEvent.click(minusBtn);
    expect(onChange).toHaveBeenCalledWith(300_000);
  });
});

describe('StepperInput — min/max clamps (D-02 LOCKED)', () => {
  it('"−" button is disabled at min (5_000 ms)', () => {
    const { minusBtn, onChange } = renderStepper(5_000);
    expect(minusBtn.hasAttribute('disabled')).toBe(true);
    fireEvent.click(minusBtn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('"+" button is disabled at max (3_600_000 ms)', () => {
    const { plusBtn, onChange } = renderStepper(3_600_000);
    expect(plusBtn.hasAttribute('disabled')).toBe(true);
    fireEvent.click(plusBtn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('"−" clamps via keyboard at min (ArrowDown at 5_000 yields 5_000)', () => {
    const { input, onChange } = renderStepper(5_000);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // Either no-op (disabled won't fire onChange via click, but keydown still calls handler)
    // The clamp ensures the value never goes below minMs.
    if (onChange.mock.calls.length > 0) {
      expect(onChange).toHaveBeenCalledWith(5_000);
    }
  });

  it('"+" clamps via keyboard at max (ArrowUp at 3_600_000 yields 3_600_000)', () => {
    const { input, onChange } = renderStepper(3_600_000);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    if (onChange.mock.calls.length > 0) {
      expect(onChange).toHaveBeenCalledWith(3_600_000);
    }
  });
});

describe('StepperInput — keyboard (D-02 LOCKED)', () => {
  it('ArrowUp at 1 min advances by 30s (same as +)', () => {
    const { input, onChange } = renderStepper(60_000);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledWith(90_000);
  });

  it('ArrowDown at 4 min drops by 30s', () => {
    const { input, onChange } = renderStepper(240_000);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith(210_000);
  });

  it('ArrowDown at exactly 5:00 drops by 1 min — keyboard parity with the "−" button', () => {
    const { input, onChange } = renderStepper(300_000);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith(240_000);
  });

  it('Shift+ArrowUp at 1 min advances by 5 min regardless of step', () => {
    const { input, onChange } = renderStepper(60_000);
    fireEvent.keyDown(input, { key: 'ArrowUp', shiftKey: true });
    expect(onChange).toHaveBeenCalledWith(360_000);
  });

  it('Shift+ArrowDown at 10 min drops by 5 min', () => {
    const { input, onChange } = renderStepper(600_000);
    fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true });
    expect(onChange).toHaveBeenCalledWith(300_000);
  });

  it('PageUp at 1 min advances by 5 min (same as Shift+ArrowUp)', () => {
    const { input, onChange } = renderStepper(60_000);
    fireEvent.keyDown(input, { key: 'PageUp' });
    expect(onChange).toHaveBeenCalledWith(360_000);
  });

  it('PageDown at 10 min drops by 5 min', () => {
    const { input, onChange } = renderStepper(600_000);
    fireEvent.keyDown(input, { key: 'PageDown' });
    expect(onChange).toHaveBeenCalledWith(300_000);
  });

  it('Arrow keys are e.preventDefault\'d to suppress page scroll', () => {
    const { input, onChange } = renderStepper(60_000);
    const event = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
    input.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(onChange).toHaveBeenCalled();
  });
});

describe('StepperInput — ARIA contract', () => {
  it('input has aria-valuetext formatted as mm:ss for SR readout', () => {
    const { input } = renderStepper(240_000);
    expect(input.getAttribute('aria-valuetext')).toBe('04:00');
  });

  it('input has aria-label "Segment duration"', () => {
    const { input } = renderStepper(60_000);
    expect(input.getAttribute('aria-label')).toBe('Segment duration');
  });

  it('buttons have aria-labels per UI-SPEC L272-273', () => {
    renderStepper(60_000);
    expect(screen.getByLabelText('Decrease duration')).toBeTruthy();
    expect(screen.getByLabelText('Increase duration')).toBeTruthy();
  });

  it('aria-invalid propagates from prop to input element', () => {
    render(<StepperInput valueMs={60_000} onChange={vi.fn()} aria-invalid={true} />);
    const input = screen.getByLabelText('Segment duration') as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('input value displays formatted mm:ss', () => {
    const { input } = renderStepper(240_000);
    expect(input.value).toBe('04:00');
  });
});
