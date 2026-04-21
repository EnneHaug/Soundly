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
      return 0;
    case 'phase1':
      return 1;
    case 'phase2':
      return 2;
    case 'phase3':
      return 3; // past all segments — at the dot
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
  // Two arc segments + a dot for phase 3
  const total = config.phase1DurationMs + config.phase2DurationMs;

  // Available arc after subtracting 2 gaps (seg1-seg2, seg2-dot)
  const DOT_ARC = 0.08; // small fixed arc for the phase 3 dot
  const availableArc = TWO_PI - 2 * GAP_RADIANS - DOT_ARC;

  const arcLengths = [
    (config.phase1DurationMs / total) * availableArc,  // Gentle Sound
    (config.phase2DurationMs / total) * availableArc,  // Nudge
  ];

  // Compute start angles
  const startAngles = [0, arcLengths[0] + GAP_RADIANS];
  const dotStart = startAngles[1] + arcLengths[1] + GAP_RADIANS;

  const currentIndex = phaseToIndex(currentPhase);
  const clampedProgress = Math.min(1, Math.max(0, phaseProgress));

  const segments = arcLengths.map((arcLen, i) => {
    const start = startAngles[i];
    const end = start + arcLen;
    const color = PHASE_COLORS[i];
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

  // Phase 3 dot — terracotta when active/future, faded when all past
  const dotColor = currentIndex >= 3 ? 'var(--color-faded)' : PHASE_COLORS[2];
  const dotOpacity = currentIndex >= 3 ? 0.6 : 1;
  const dotCenter = polarToCartesian(dotStart + DOT_ARC / 2);
  const phase3Dot = (
    <circle
      key="dot-phase3"
      cx={dotCenter.x}
      cy={dotCenter.y}
      r={STROKE_WIDTH / 2}
      fill={dotColor}
      opacity={dotOpacity}
    />
  );

  return (
    <div className="relative w-full max-w-[280px] mx-auto">
      <svg
        viewBox="0 0 200 200"
        className="w-full"
        role="img"
        aria-label="Alarm progress"
      >
        {segments.map((pair) => pair)}
        {phase3Dot}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}
