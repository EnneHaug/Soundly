/**
 * SegmentProgressRing test suite — locks the D-01/D-02/D-03/D-19 visual contract.
 *
 * Pure-presentation tests; no fake timers. Asserts SVG attribute shape rather than
 * pixel-level rendering to match the codebase's direct-DOM-read convention
 * (see src/test/setup.ts header for the rationale).
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import SegmentProgressRing from '../SegmentProgressRing';
import { WAKE_EASY_CONFIG } from '../../engine/SegmentState';
import type { SegmentConfig } from '../../engine/SegmentState';

describe('SegmentProgressRing — SVG wrapper', () => {
  it('renders <svg> with viewBox 200x200, role=img, aria-label="Alarm progress"', () => {
    const { container } = render(
      <SegmentProgressRing config={WAKE_EASY_CONFIG} currentIndex={0} progress={0} />,
    );
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('viewBox')).toBe('0 0 200 200');
    expect(svg!.getAttribute('role')).toBe('img');
    expect(svg!.getAttribute('aria-label')).toBe('Alarm progress');
  });

  it('renders children inside the centered overlay div', () => {
    const { getByText } = render(
      <SegmentProgressRing config={WAKE_EASY_CONFIG} currentIndex={0} progress={0}>
        <span>centered content</span>
      </SegmentProgressRing>,
    );
    expect(getByText('centered content')).toBeTruthy();
  });
});

describe('SegmentProgressRing — N-arc rendering', () => {
  it('renders N track paths for an N-segment config (Wake Easy = 5 segments)', () => {
    const { container } = render(
      <SegmentProgressRing config={WAKE_EASY_CONFIG} currentIndex={0} progress={0} />,
    );
    const tracks = container.querySelectorAll('path[stroke="var(--color-faded)"][opacity="0.4"]');
    expect(tracks.length).toBe(5);
  });

  it('renders N=3 arcs for a 3-segment config', () => {
    const cfg: SegmentConfig = {
      segments: [
        { id: 'a', durationMs: 60_000, endSound: 'gentle' },
        { id: 'b', durationMs: 60_000, endSound: 'triangle' },
        { id: 'c', durationMs: 60_000, endSound: 'alarm' },
      ],
    };
    const { container } = render(
      <SegmentProgressRing config={cfg} currentIndex={0} progress={0} />,
    );
    const tracks = container.querySelectorAll('path[stroke="var(--color-faded)"][opacity="0.4"]');
    expect(tracks.length).toBe(3);
  });
});

describe('SegmentProgressRing — color by endSound (D-02)', () => {
  it('paints gentle endSound with var(--color-sage)', () => {
    const cfg: SegmentConfig = {
      segments: [{ id: 'g', durationMs: 60_000, endSound: 'gentle' }],
    };
    const { container } = render(
      <SegmentProgressRing config={cfg} currentIndex={0} progress={0} />,
    );
    const fills = Array.from(container.querySelectorAll('path')).filter(
      (p) => p.getAttribute('stroke') === 'var(--color-sage)',
    );
    expect(fills.length).toBeGreaterThanOrEqual(1);
  });

  it('paints triangle endSound with var(--color-sand)', () => {
    const cfg: SegmentConfig = {
      segments: [{ id: 't', durationMs: 60_000, endSound: 'triangle' }],
    };
    const { container } = render(
      <SegmentProgressRing config={cfg} currentIndex={0} progress={0} />,
    );
    const fills = Array.from(container.querySelectorAll('path')).filter(
      (p) => p.getAttribute('stroke') === 'var(--color-sand)',
    );
    expect(fills.length).toBeGreaterThanOrEqual(1);
  });

  it('paints alarm endSound with var(--color-accent)', () => {
    const cfg: SegmentConfig = {
      segments: [{ id: 'a', durationMs: 60_000, endSound: 'alarm' }],
    };
    const { container } = render(
      <SegmentProgressRing config={cfg} currentIndex={0} progress={0} />,
    );
    const fills = Array.from(container.querySelectorAll('path')).filter(
      (p) => p.getAttribute('stroke') === 'var(--color-accent)',
    );
    expect(fills.length).toBeGreaterThanOrEqual(1);
  });
});

describe('SegmentProgressRing — past/current/future opacity contract', () => {
  it('past segments (i < currentIndex) render with stroke=var(--color-faded) opacity=0.6', () => {
    const { container } = render(
      <SegmentProgressRing config={WAKE_EASY_CONFIG} currentIndex={2} progress={0} />,
    );
    const pastFills = Array.from(container.querySelectorAll('path')).filter(
      (p) =>
        p.getAttribute('stroke') === 'var(--color-faded)' &&
        p.getAttribute('opacity') === '0.6',
    );
    expect(pastFills.length).toBe(2);
  });

  it('future segments render at full color opacity=1', () => {
    const { container } = render(
      <SegmentProgressRing config={WAKE_EASY_CONFIG} currentIndex={0} progress={0} />,
    );
    const sageFutureFills = Array.from(container.querySelectorAll('path')).filter(
      (p) =>
        p.getAttribute('stroke') === 'var(--color-sage)' &&
        p.getAttribute('opacity') === '1',
    );
    // Segments 1, 2, 3 are gentle and future at currentIndex=0 (not segment 0 which is current)
    expect(sageFutureFills.length).toBeGreaterThanOrEqual(3);
  });
});

describe('SegmentProgressRing — pulseActive prop (D-03)', () => {
  it('applies pulse-active className to the current arc when pulseActive=true', () => {
    const { container } = render(
      <SegmentProgressRing
        config={WAKE_EASY_CONFIG}
        currentIndex={4}
        progress={0}
        pulseActive={true}
      />,
    );
    const pulsing = container.querySelectorAll('path.pulse-active');
    expect(pulsing.length).toBe(1);
  });

  it('applies NO pulse-active class when pulseActive=false', () => {
    const { container } = render(
      <SegmentProgressRing
        config={WAKE_EASY_CONFIG}
        currentIndex={4}
        progress={0}
        pulseActive={false}
      />,
    );
    const pulsing = container.querySelectorAll('path.pulse-active');
    expect(pulsing.length).toBe(0);
  });

  it('applies NO pulse-active class when pulseActive prop is omitted', () => {
    const { container } = render(
      <SegmentProgressRing config={WAKE_EASY_CONFIG} currentIndex={4} progress={0} />,
    );
    const pulsing = container.querySelectorAll('path.pulse-active');
    expect(pulsing.length).toBe(0);
  });
});

describe('SegmentProgressRing — pausedDimming prop (D-19)', () => {
  it('drops current arc opacity to 0.5 when pausedDimming=true', () => {
    const { container } = render(
      <SegmentProgressRing
        config={WAKE_EASY_CONFIG}
        currentIndex={0}
        progress={0.5}
        pausedDimming={true}
      />,
    );
    const dimmed = Array.from(container.querySelectorAll('path')).filter(
      (p) =>
        p.getAttribute('stroke') === 'var(--color-sage)' &&
        p.getAttribute('opacity') === '0.5',
    );
    expect(dimmed.length).toBe(1);
  });

  it('keeps current arc opacity=1 when pausedDimming=false', () => {
    const { container } = render(
      <SegmentProgressRing
        config={WAKE_EASY_CONFIG}
        currentIndex={0}
        progress={0.5}
        pausedDimming={false}
      />,
    );
    const dimmed = Array.from(container.querySelectorAll('path')).filter(
      (p) =>
        p.getAttribute('stroke') === 'var(--color-sage)' &&
        p.getAttribute('opacity') === '0.5',
    );
    expect(dimmed.length).toBe(0);
  });
});

describe('SegmentProgressRing — duration-proportional widths (D-01)', () => {
  it('Wake Easy alarm arc (60s of 1020s) renders an SVG arc path with the correct radius', () => {
    const { container } = render(
      <SegmentProgressRing config={WAKE_EASY_CONFIG} currentIndex={0} progress={0} />,
    );
    const alarmFill = Array.from(container.querySelectorAll('path')).find(
      (p) =>
        p.getAttribute('stroke') === 'var(--color-accent)' &&
        p.getAttribute('opacity') === '1',
    );
    expect(alarmFill).toBeDefined();
    const d = alarmFill!.getAttribute('d');
    expect(d).toMatch(/^M /);
    expect(d).toContain('A 80 80');
  });
});
