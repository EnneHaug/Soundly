/**
 * CustomCard test suite — visible label coverage (D-09 LOCKED), aria contract,
 * dashed-border class string lock-in, and onClick wiring.
 *
 * Mirrors the Dashboard.test.tsx idiom (vitest globals: false, explicit cleanup
 * in afterEach, no @testing-library/jest-dom — assert via plain matchers).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CustomCard from '../CustomCard';

afterEach(() => {
  cleanup();
});

describe('CustomCard', () => {
  it('renders the locked label "Custom" and description "Compose your own alarm" per D-09', () => {
    render(<CustomCard onClick={vi.fn()} />);
    expect(screen.getByText('Custom')).toBeTruthy();
    expect(screen.getByText('Compose your own alarm')).toBeTruthy();
  });

  it('exposes aria-label "Open custom alarm composer" for screen readers (UI-SPEC L257)', () => {
    render(<CustomCard onClick={vi.fn()} />);
    const button = screen.getByLabelText('Open custom alarm composer');
    expect(button.tagName).toBe('BUTTON');
  });

  it('renders the dashed-border class string per UI-SPEC L199-207', () => {
    render(<CustomCard onClick={vi.fn()} />);
    const button = screen.getByLabelText('Open custom alarm composer');
    expect(button.className).toContain('border-2');
    expect(button.className).toContain('border-dashed');
    expect(button.className).toContain('bg-bg');
  });

  it('invokes onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<CustomCard onClick={handleClick} />);
    fireEvent.click(screen.getByLabelText('Open custom alarm composer'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('marks the "+" glyph as aria-hidden (decorative)', () => {
    render(<CustomCard onClick={vi.fn()} />);
    const plus = screen.getByText('+');
    expect(plus.getAttribute('aria-hidden')).toBe('true');
  });
});
