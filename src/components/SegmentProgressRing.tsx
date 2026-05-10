/**
 * SegmentProgressRing — SVG N-arc duration-proportional progress ring (D-01, D-02, D-03, D-19).
 *
 * Renders one arc per segment in a SegmentConfig, with arc width proportional to
 * segment.durationMs and color keyed by segment.endSound:
 *   - gentle   → var(--color-sage)
 *   - triangle → var(--color-sand)
 *   - alarm    → var(--color-accent)
 *
 * Visual states per arc:
 *   - Past (i < currentIndex):   faded gray stroke, opacity 0.6
 *   - Current (i === currentIndex): colored stroke, width clipped to (1 - progress) * arcLen
 *     - +pulseActive: className="pulse-active" → 1 Hz opacity pulse via @keyframes (D-03)
 *     - +pausedDimming: opacity drops to 0.5 (D-19)
 *   - Future (i > currentIndex): colored stroke at opacity 1.0
 *
 * Children render centered inside the ring via absolute positioning (matches
 * ProgressRing.tsx:188-203 byte-identical wrapper structure).
 *
 * This component is NEW (NOT a refactor of ProgressRing.tsx — that file is SEG-05
 * byte-identical-protected). The geometry helpers and SVG wrapper are CLONED
 * verbatim from ProgressRing.tsx to keep visual consistency with v1's continuous-mode ring.
 */

import React from 'react';
import type { SegmentConfig } from '../engine/SegmentState';

export interface SegmentProgressRingProps {
  config: SegmentConfig;
  currentIndex: number;       // 0..N-1 of the segment currently elapsing; N when dismissed
  progress: number;           // 0..1: how far through the CURRENT segment
  pulseActive?: boolean;      // true when state === 'firing-alarm' (D-03)
  pausedDimming?: boolean;    // true when paused — drops active arc opacity to 0.5 (D-19)
  children?: React.ReactNode;
}

const CENTER = 100;       // SVG viewBox 200x200
const RADIUS = 80;
const STROKE_WIDTH = 14;
const GAP_RADIANS = 0.05; // small visual gap between segments
const TWO_PI = 2 * Math.PI;

const SOUND_COLORS: Record<'gentle' | 'triangle' | 'alarm', string> = {
  gentle:   'var(--color-sage)',
  triangle: 'var(--color-sand)',
  alarm:    'var(--color-accent)',
};

/**
 * Convert a clockwise angle (radians, 0 = top) to SVG x,y coordinates.
 */
function polarToCartesian(angleCw: number): { x: number; y: number } {
  const theta = angleCw - Math.PI / 2; // start from top
  return {
    x: CENTER + RADIUS * Math.cos(theta),
    y: CENTER + RADIUS * Math.sin(theta),
  };
}

/**
 * Build an SVG arc path from startAngle to endAngle (clockwise radians from top).
 */
function arcPath(startAngle: number, endAngle: number): string {
  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export default function SegmentProgressRing({
  config,
  currentIndex,
  progress,
  pulseActive = false,
  pausedDimming = false,
  children,
}: SegmentProgressRingProps) {
  const segments = config.segments;
  const N = segments.length;
  const totalDuration = segments.reduce((sum, s) => sum + s.durationMs, 0);
  // N gaps total — one after each arc, the final one closing the loop for visual symmetry
  // (RESEARCH §"Three subtleties"; PATTERNS L582-763 critical implementation note).
  const totalGap = N * GAP_RADIANS;
  const availableArc = TWO_PI - totalGap;

  let cursor = 0;
  const arcs = segments.map((seg, i) => {
    const arcLen = (seg.durationMs / totalDuration) * availableArc;
    const start = cursor;
    const end = cursor + arcLen;
    cursor = end + GAP_RADIANS;
    return { i, segment: seg, start, end, arcLen };
  });

  const clampedProgress = Math.min(1, Math.max(0, progress));

  const renderedArcs = arcs.map(({ i, segment, start, end, arcLen }) => {
    const color = SOUND_COLORS[segment.endSound];
    const isPast = i < currentIndex;
    const isCurrent = i === currentIndex;
    const isFuture = i > currentIndex;

    const track = (
      <path
        key={`track-${i}`}
        d={arcPath(start, end)}
        fill="none"
        stroke="var(--color-faded)"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        opacity={0.4}
      />
    );

    let activeFill: React.ReactNode = null;

    if (isPast) {
      activeFill = (
        <path
          key={`fill-${i}`}
          d={arcPath(start, end)}
          fill="none"
          stroke="var(--color-faded)"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          opacity={0.6}
        />
      );
    } else if (isCurrent) {
      const remainingArc = (1 - clampedProgress) * arcLen;
      if (remainingArc > 0.001) {
        const className = [
          pulseActive ? 'pulse-active' : null,
          'transition-opacity duration-200',
        ]
          .filter(Boolean)
          .join(' ');
        activeFill = (
          <path
            key={`fill-${i}`}
            className={className}
            d={arcPath(start, start + remainingArc)}
            fill="none"
            stroke={color}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            opacity={pausedDimming ? 0.5 : 1}
          />
        );
      }
    } else if (isFuture) {
      activeFill = (
        <path
          key={`fill-${i}`}
          d={arcPath(start, end)}
          fill="none"
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          opacity={1}
        />
      );
    }

    return [track, activeFill];
  });

  return (
    <div className="relative w-full max-w-[280px] mx-auto">
      <svg
        viewBox="0 0 200 200"
        className="w-full"
        role="img"
        aria-label="Alarm progress"
      >
        {renderedArcs.map((pair) => pair)}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}
