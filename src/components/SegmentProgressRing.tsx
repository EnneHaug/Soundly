/**
 * SegmentProgressRing — SVG continuous duration-proportional progress ring.
 *
 * Renders ONE continuous ring (same radius/stroke as v1 ProgressRing) starting at
 * 12 o'clock and progressing clockwise as time elapses across all N segments —
 * NOT N disjoint arcs. Boundary markers (small dots colored by the ending
 * segment's endSound) sit on the ring at each segment-end angle.
 *
 * UAT feedback (Phase 8 Test 1, 2026-05-12) replaced the original N-arc design
 * because the per-segment offset positions read as visually disjoint rather than
 * a single continuous countdown. The new design matches v1 ProgressRing's
 * "filling" mental model while still surfacing segment boundaries via tick dots.
 *
 * Visual states:
 *   - Track (background): full circle in --color-faded
 *   - Elapsed arc: 0° → elapsedAngle clockwise, colored by current segment's
 *     endSound (so the arc takes on the upcoming sound's color as it advances).
 *     pausedDimming reduces opacity to 0.5 per D-19.
 *   - Pulsing alarm arc: when pulseActive (state === 'firing-alarm'), the alarm
 *     segment's slice renders as a separate arc in --color-accent with the
 *     .pulse-active CSS class (1 Hz opacity pulse per D-03/D-04).
 *   - Boundary dots: small filled circles at each non-final segment-end angle,
 *     colored by the ending segment's endSound. Past dots fade to opacity 0.4;
 *     future dots stay at opacity 1.
 *
 * Children render centered inside the ring via absolute positioning (wrapper
 * structure cloned verbatim from ProgressRing.tsx — SEG-05 byte-identical-protected,
 * NOT modified).
 */

import React from 'react';
import type { SegmentConfig } from '../engine/SegmentState';

export interface SegmentProgressRingProps {
  config: SegmentConfig;
  currentIndex: number;       // 0..N-1 of the segment currently elapsing; N when dismissed
  progress: number;           // 0..1: how far through the CURRENT segment
  pulseActive?: boolean;      // true when state === 'firing-alarm' (D-03)
  pausedDimming?: boolean;    // true when paused — drops elapsed-arc opacity to 0.5 (D-19)
  children?: React.ReactNode;
}

const CENTER = 100;       // SVG viewBox 200x200
const RADIUS = 80;
const STROKE_WIDTH = 14;
const TWO_PI = 2 * Math.PI;
const FULL_ARC_EPS = 0.001; // SVG arc with identical start/end won't render — close the loop with a hair less

const SOUND_COLORS: Record<'gentle' | 'triangle' | 'alarm', string> = {
  gentle:   'var(--color-sage)',
  triangle: 'var(--color-sand)',
  alarm:    'var(--color-accent)',
};

/**
 * Convert a clockwise angle (radians, 0 = top) at radius r to SVG x,y.
 */
function polarToCartesian(angleCw: number, r: number = RADIUS): { x: number; y: number } {
  const theta = angleCw - Math.PI / 2; // start from top
  return {
    x: CENTER + r * Math.cos(theta),
    y: CENTER + r * Math.sin(theta),
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

  // Cumulative angles: cumulative[i] = angle at END of segment i (clockwise from top)
  const cumulative: number[] = [];
  let acc = 0;
  for (const s of segments) {
    acc += (s.durationMs / totalDuration) * TWO_PI;
    cumulative.push(acc);
  }

  const clampedProgress = Math.min(1, Math.max(0, progress));
  const currentIdx = Math.max(0, Math.min(N - 1, currentIndex));
  const currentStart = currentIdx > 0 ? cumulative[currentIdx - 1] : 0;
  const currentSegmentArc = cumulative[currentIdx] - currentStart;

  // During firing-alarm the alarm segment itself is the pulsing arc; the
  // baseline elapsed arc stops at the alarm-segment's start angle.
  const elapsedAngle = pulseActive
    ? currentStart
    : currentStart + currentSegmentArc * clampedProgress;

  // Background track — two half-arcs so SVG renders a full circle reliably.
  const trackArcs = (
    <>
      <path
        key="track-half-1"
        d={arcPath(0, Math.PI)}
        fill="none"
        stroke="var(--color-faded)"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        opacity={0.4}
      />
      <path
        key="track-half-2"
        d={arcPath(Math.PI, TWO_PI - FULL_ARC_EPS)}
        fill="none"
        stroke="var(--color-faded)"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        opacity={0.4}
      />
    </>
  );

  // Elapsed foreground arc (one continuous path).
  const elapsedColor = SOUND_COLORS[segments[currentIdx].endSound];
  const showElapsed = elapsedAngle > FULL_ARC_EPS;
  const elapsedArc = showElapsed ? (
    <path
      key="elapsed"
      className="transition-opacity duration-200"
      d={arcPath(0, Math.min(elapsedAngle, TWO_PI - FULL_ARC_EPS))}
      fill="none"
      stroke={elapsedColor}
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      opacity={pausedDimming ? 0.5 : 1}
    />
  ) : null;

  // Pulsing alarm segment overlay during firing-alarm. The alarm segment is the
  // one with endSound === 'alarm' (CONTEXT D-02). Locate by endSound, not by index.
  const alarmIdx = segments.findIndex(s => s.endSound === 'alarm');
  const pulsingAlarmArc =
    pulseActive && alarmIdx >= 0
      ? (() => {
          const alarmStart = alarmIdx > 0 ? cumulative[alarmIdx - 1] : 0;
          const alarmEnd = cumulative[alarmIdx];
          return (
            <path
              key="alarm-pulse"
              className="pulse-active"
              d={arcPath(alarmStart, Math.min(alarmEnd, TWO_PI - FULL_ARC_EPS))}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              opacity={pausedDimming ? 0.5 : 1}
            />
          );
        })()
      : null;

  // Boundary marker dots — one per non-final segment-end angle.
  // The final segment's end angle == 2π == start angle, no need to mark it twice.
  const boundaryDots = cumulative.slice(0, -1).map((angle, i) => {
    const pos = polarToCartesian(angle);
    const tickColor = SOUND_COLORS[segments[i].endSound];
    const isPast = angle <= elapsedAngle + FULL_ARC_EPS;
    return (
      <circle
        key={`boundary-${i}`}
        cx={pos.x}
        cy={pos.y}
        r={STROKE_WIDTH / 2 - 2}
        fill={tickColor}
        opacity={isPast ? 0.4 : 1}
      />
    );
  });

  return (
    <div className="relative w-full max-w-[280px] mx-auto">
      <svg
        viewBox="0 0 200 200"
        className="w-full"
        role="img"
        aria-label="Alarm progress"
      >
        {trackArcs}
        {elapsedArc}
        {pulsingAlarmArc}
        {boundaryDots}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}
