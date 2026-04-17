/**
 * ProgressRing — SVG three-segment arc progress ring (D-06).
 *
 * Renders three concentric arc segments proportional to the three alarm phases:
 *   - Segment 1 (sage/green):     Phase 1 — Gentle Sound
 *   - Segment 2 (sand/warm beige): Phase 2 — Nudge
 *   - Segment 3 (accent/terracotta): Phase 3 — Wake
 *
 * Visual states per segment:
 *   - Past (depleted): faded gray stroke
 *   - Current: faded track behind + colored active fill showing remaining portion
 *   - Future: full colored stroke at full opacity (not yet begun)
 *
 * Children are rendered centered inside the ring via absolute positioning.
 */

import React from 'react';
import type { AlarmConfig, AlarmPhase } from '../engine';

interface ProgressRingProps {
  config: AlarmConfig;
  currentPhase: AlarmPhase;
  phaseProgress: number; // 0-1: how far through the CURRENT phase (0 = just started, 1 = complete)
  children?: React.ReactNode; // Renders inside the ring (countdown time + label)
}

const CENTER = 100;       // SVG viewBox 200x200
const RADIUS = 80;
const STROKE_WIDTH = 14;
const GAP_RADIANS = 0.05; // small visual gap between segments
const TWO_PI = 2 * Math.PI;

const PHASE_COLORS = [
  'var(--color-sage)',   // Phase 1
  'var(--color-sand)',   // Phase 2
  'var(--color-accent)', // Phase 3
];

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

/**
 * Map phase name to segment index (0-based).
 * Returns -1 for idle (before any phase), 3 for dismissed (all past).
 */
function phaseToIndex(phase: AlarmPhase): number {
  switch (phase) {
    case 'idle':
      return -1;
    case 'phase1':
      return 0;
    case 'phase2':
      return 1;
    case 'phase3':
      return 2;
    case 'dismissed':
      return 3;
    default:
      return -1;
  }
}

export default function ProgressRing({
  config,
  currentPhase,
  phaseProgress,
  children,
}: ProgressRingProps) {
  // Compute total duration across phases (excluding phase3 ramp which is post-ring)
  const total =
    config.phase1DurationMs + config.phase2DurationMs + config.phase2to3GapMs;

  // Available arc after subtracting 3 gaps between segments
  const availableArc = TWO_PI - 3 * GAP_RADIANS;

  // Arc lengths proportional to phase durations
  const arcLengths = [
    (config.phase1DurationMs / total) * availableArc,
    (config.phase2DurationMs / total) * availableArc,
    (config.phase2to3GapMs / total) * availableArc,
  ];

  // Compute start angles for each segment
  const startAngles: number[] = [];
  let cursor = 0;
  for (let i = 0; i < 3; i++) {
    startAngles[i] = cursor;
    cursor += arcLengths[i] + GAP_RADIANS;
  }

  const currentIndex = phaseToIndex(currentPhase);
  const clampedProgress = Math.min(1, Math.max(0, phaseProgress));

  const segments = arcLengths.map((arcLen, i) => {
    const start = startAngles[i];
    const end = start + arcLen;
    const color = PHASE_COLORS[i];
    const isPast = i < currentIndex;
    const isCurrent = i === currentIndex;
    const isFuture = i > currentIndex;

    // Background (faded) track always visible
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
      // Depleted: faded gray at slightly higher opacity
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
      // Remaining portion: from start to (start + remaining arc)
      // phaseProgress=0 → full arc remaining; phaseProgress=1 → nothing remaining
      const remainingArc = (1 - clampedProgress) * arcLen;
      if (remainingArc > 0.001) {
        activeFill = (
          <path
            key={`fill-${i}`}
            d={arcPath(start, start + remainingArc)}
            fill="none"
            stroke={color}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            opacity={1}
          />
        );
      }
    } else if (isFuture) {
      // Not yet started: full arc, full opacity
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
        {segments.map((pair) => pair)}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}
