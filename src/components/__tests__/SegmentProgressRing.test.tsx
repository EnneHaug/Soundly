/**
 * SegmentProgressRing test suite — locks the continuous-ring visual contract.
 *
 * Replaces the original N-arc geometry test suite after Phase 8 UAT (2026-05-12)
 * surfaced that users read the staggered per-segment offsets as visually disjoint
 * rather than a single continuous countdown. The new contract:
 *
 *   - Background: two faded half-arcs that together form a full circle (single
 *     SVG path can't span the full 0→2π reliably, so the implementation draws
 *     two halves).
 *   - Elapsed: ONE arc from 0° to (cumulative-past-segments + current-segment-elapsed),
 *     colored by the current segment's endSound.
 *   - Pulsing alarm: separate accent arc with `.pulse-active` class during firing-alarm.
 *   - Boundary dots: N-1 small `<circle>` markers at each segment-end angle,
 *     colored by the ending segment's endSound. Past dots fade to opacity 0.4.
 *   - pausedDimming drops the elapsed-arc opacity to 0.5 (D-19).
 *
 * Pure-presentation tests; no fake timers. Asserts SVG attribute shape per the
 * codebase's direct-DOM-read convention (see src/test/setup.ts header).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import SegmentProgressRing from '../SegmentProgressRing';
import { WAKE_EASY_CONFIG } from '../../engine/SegmentState';
import type { SegmentConfig } from '../../engine/SegmentState';

afterEach(() => cleanup());

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

describe('SegmentProgressRing — continuous track + elapsed arc', () => {
  it('renders exactly TWO background track paths (two halves forming a full circle)', () => {
    const { container } = render(
      <SegmentProgressRing config={WAKE_EASY_CONFIG} currentIndex={0} progress={0} />,
    );
    const tracks = container.querySelectorAll(
      'path[stroke="var(--color-faded)"][opacity="0.4"]',
    );
    expect(tracks.length).toBe(2);
  });

  it('renders no elapsed arc when progress=0 and currentIndex=0 (nothing has elapsed yet)', () => {
    const { container } = render(
      <SegmentProgressRing config={WAKE_EASY_CONFIG} currentIndex={0} progress={0} />,
    );
    const sage = Array.from(container.querySelectorAll('path')).filter(
      (p) => p.getAttribute('stroke') === 'var(--color-sage)',
    );
    expect(sage.length).toBe(0);
  });

  it('renders ONE elapsed arc colored by current segment endSound when progress > 0', () => {
    const { container } = render(
      <SegmentProgressRing config={WAKE_EASY_CONFIG} currentIndex={0} progress={0.5} />,
    );
    const elapsed = Array.from(container.querySelectorAll('path')).filter(
      (p) => p.getAttribute('stroke') === 'var(--color-sage)',
    );
    expect(elapsed.length).toBe(1);
    const d = elapsed[0].getAttribute('d');
    expect(d).toMatch(/^M /);
    expect(d).toContain('A 80 80');
  });

  it('renders one elapsed arc when progressing within a later segment (currentIndex > 0)', () => {
    const { container } = render(
      <SegmentProgressRing config={WAKE_EASY_CONFIG} currentIndex={2} progress={0.5} />,
    );
    // segment 2 (third one) is gentle; elapsed reaches mid-way through it
    const elapsed = Array.from(container.querySelectorAll('path')).filter(
      (p) => p.getAttribute('stroke') === 'var(--color-sage)',
    );
    expect(elapsed.length).toBe(1);
  });
});

describe('SegmentProgressRing — elapsed-arc color follows current segment endSound (D-02)', () => {
  it('paints elapsed arc with var(--color-sage) when current segment endSound is gentle', () => {
    const cfg: SegmentConfig = {
      segments: [
        { id: 'g', durationMs: 60_000, endSound: 'gentle' },
        { id: 'a', durationMs: 60_000, endSound: 'alarm' },
      ],
    };
    const { container } = render(
      <SegmentProgressRing config={cfg} currentIndex={0} progress={0.5} />,
    );
    const elapsed = Array.from(container.querySelectorAll('path')).filter(
      (p) => p.getAttribute('stroke') === 'var(--color-sage)',
    );
    expect(elapsed.length).toBe(1);
  });

  it('paints elapsed arc with var(--color-sand) when current segment endSound is triangle', () => {
    const cfg: SegmentConfig = {
      segments: [
        { id: 'g', durationMs: 60_000, endSound: 'gentle' },
        { id: 't', durationMs: 60_000, endSound: 'triangle' },
        { id: 'a', durationMs: 60_000, endSound: 'alarm' },
      ],
    };
    const { container } = render(
      <SegmentProgressRing config={cfg} currentIndex={1} progress={0.5} />,
    );
    const elapsed = Array.from(container.querySelectorAll('path')).filter(
      (p) => p.getAttribute('stroke') === 'var(--color-sand)',
    );
    expect(elapsed.length).toBe(1);
  });

  it('paints elapsed arc with var(--color-accent) when current segment endSound is alarm', () => {
    const cfg: SegmentConfig = {
      segments: [
        { id: 'g', durationMs: 60_000, endSound: 'gentle' },
        { id: 'a', durationMs: 60_000, endSound: 'alarm' },
      ],
    };
    const { container } = render(
      <SegmentProgressRing config={cfg} currentIndex={1} progress={0.3} />,
    );
    const elapsed = Array.from(container.querySelectorAll('path')).filter(
      (p) => p.getAttribute('stroke') === 'var(--color-accent)' &&
             !p.classList.contains('pulse-active'),
    );
    expect(elapsed.length).toBe(1);
  });
});

describe('SegmentProgressRing — boundary marker dots', () => {
  it('renders N-1 boundary <circle> dots for an N-segment config (Wake Easy = 5 segments → 4 dots)', () => {
    const { container } = render(
      <SegmentProgressRing config={WAKE_EASY_CONFIG} currentIndex={0} progress={0} />,
    );
    const dots = container.querySelectorAll('circle');
    expect(dots.length).toBe(4);
  });

  it('colors boundary dots by the ending segment endSound', () => {
    // Wake Easy: segs 0..3 are gentle (dots after each), seg 4 is alarm (no dot after).
    // So we should see 4 sage-colored dots.
    const { container } = render(
      <SegmentProgressRing config={WAKE_EASY_CONFIG} currentIndex={0} progress={0} />,
    );
    const sageDots = Array.from(container.querySelectorAll('circle')).filter(
      (c) => c.getAttribute('fill') === 'var(--color-sage)',
    );
    expect(sageDots.length).toBe(4);
  });

  it('fades past boundary dots to opacity 0.4 once the elapsed arc has crossed them', () => {
    // currentIndex=2 with progress=0 means segments 0 and 1 are past — their boundary
    // dots (at end of seg 0 and end of seg 1) should be past.
    const { container } = render(
      <SegmentProgressRing config={WAKE_EASY_CONFIG} currentIndex={2} progress={0} />,
    );
    const dots = Array.from(container.querySelectorAll('circle'));
    const pastDots = dots.filter((c) => c.getAttribute('opacity') === '0.4');
    expect(pastDots.length).toBe(2);
  });

  it('keeps future boundary dots at full opacity', () => {
    const { container } = render(
      <SegmentProgressRing config={WAKE_EASY_CONFIG} currentIndex={0} progress={0} />,
    );
    const dots = Array.from(container.querySelectorAll('circle'));
    const futureDots = dots.filter((c) => c.getAttribute('opacity') === '1');
    expect(futureDots.length).toBe(4);
  });
});

describe('SegmentProgressRing — pulseActive prop (D-03 / D-04)', () => {
  it('applies .pulse-active to the alarm-segment overlay arc when pulseActive=true', () => {
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
    expect(pulsing[0].getAttribute('stroke')).toBe('var(--color-accent)');
  });

  it('renders no .pulse-active path when pulseActive=false', () => {
    const { container } = render(
      <SegmentProgressRing
        config={WAKE_EASY_CONFIG}
        currentIndex={4}
        progress={0}
        pulseActive={false}
      />,
    );
    expect(container.querySelectorAll('path.pulse-active').length).toBe(0);
  });

  it('renders no .pulse-active path when pulseActive prop is omitted', () => {
    const { container } = render(
      <SegmentProgressRing config={WAKE_EASY_CONFIG} currentIndex={4} progress={0} />,
    );
    expect(container.querySelectorAll('path.pulse-active').length).toBe(0);
  });
});

describe('SegmentProgressRing — pausedDimming prop (D-19)', () => {
  it('drops elapsed-arc opacity to 0.5 when pausedDimming=true', () => {
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

  it('keeps elapsed-arc opacity=1 when pausedDimming=false', () => {
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

describe('SegmentProgressRing — arc path uses RADIUS=80', () => {
  it('elapsed-arc d attribute contains "A 80 80" (correct radius)', () => {
    const { container } = render(
      <SegmentProgressRing config={WAKE_EASY_CONFIG} currentIndex={0} progress={0.5} />,
    );
    const elapsed = Array.from(container.querySelectorAll('path')).find(
      (p) => p.getAttribute('stroke') === 'var(--color-sage)',
    );
    expect(elapsed).toBeDefined();
    expect(elapsed!.getAttribute('d')).toContain('A 80 80');
  });
});
