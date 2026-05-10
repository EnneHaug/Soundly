/**
 * SegmentCountdown — Active alarm screen for segment-mode (D-01, D-03, D-05, D-19).
 *
 * Pairs with v1's Countdown.tsx (SEG-05 byte-identical-protected). Consumes
 * UseSegmentAlarmReturn from the useSegmentAlarm hook and renders:
 *   - Big mm:ss timer (segment-remaining during running; count-up since
 *     alarmStartedAt during firing-alarm — D-03)
 *   - "{mm:ss} total" caption (composition-remaining; hidden during firing-alarm — D-05)
 *   - Phase label "Segment X of N — {soundLabel}" (during running) or "Wake" (firing-alarm)
 *   - SegmentProgressRing (pulseActive during firing-alarm; pausedDimming when paused)
 *   - Pause/Resume + Stop buttons (Pause disabled during firing-alarm — D-03)
 *
 * Timer ticks every 250ms when running. Timer freezes on pause (mirrors
 * Countdown.tsx:74-93 pattern). Interval cleaned up on unmount and pause.
 *
 * Layout class strings copied verbatim from Countdown.tsx per UI-SPEC
 * §"Layout Reuse Map" — the only Tailwind addition this phase makes is
 * the disabled:opacity-40 disabled:cursor-not-allowed pair on the Pause button.
 */

import { useState, useEffect } from 'react';
import type { UseSegmentAlarmReturn } from '../hooks/useSegmentAlarm';
import SegmentProgressRing from './SegmentProgressRing';
import { formatMmSs } from '../utils/formatTime';

interface SegmentCountdownProps {
  alarm: UseSegmentAlarmReturn;
}

/** UI-SPEC L174-180: Sound-label vocabulary (LOCKED). */
const SOUND_LABELS: Record<'gentle' | 'triangle' | 'alarm', string> = {
  gentle:   'Gentle chime',
  triangle: 'Triangle ping',
  alarm:    'Wake',
};

export default function SegmentCountdown({ alarm }: SegmentCountdownProps) {
  const [segmentRemainingMs, setSegmentRemainingMs] = useState(
    Math.max(0, alarm.segmentEndsAt - Date.now()),
  );
  const [totalRemainingMs, setTotalRemainingMs] = useState(
    Math.max(0, alarm.totalEndsAt - Date.now()),
  );
  const [elapsedSinceAlarmMs, setElapsedSinceAlarmMs] = useState(0);

  // Tick every 250ms when running. Freezes on pause (mirrors Countdown.tsx:74-93).
  // Interval cleared on unmount and when paused (T-03-08: no interval leak).
  useEffect(() => {
    if (alarm.isPaused || !alarm.isRunning) return;

    // Set immediately so there's no initial lag
    setSegmentRemainingMs(Math.max(0, alarm.segmentEndsAt - Date.now()));
    setTotalRemainingMs(Math.max(0, alarm.totalEndsAt - Date.now()));
    if (alarm.state === 'firing-alarm' && alarm.alarmStartedAt > 0) {
      setElapsedSinceAlarmMs(Date.now() - alarm.alarmStartedAt);
    }

    const id = setInterval(() => {
      setSegmentRemainingMs(Math.max(0, alarm.segmentEndsAt - Date.now()));
      setTotalRemainingMs(Math.max(0, alarm.totalEndsAt - Date.now()));
      if (alarm.state === 'firing-alarm' && alarm.alarmStartedAt > 0) {
        setElapsedSinceAlarmMs(Date.now() - alarm.alarmStartedAt);
      }
    }, 250);

    return () => clearInterval(id);
  }, [
    alarm.isPaused,
    alarm.isRunning,
    alarm.segmentEndsAt,
    alarm.totalEndsAt,
    alarm.state,
    alarm.alarmStartedAt,
  ]);

  // Compute progress (0 = just started, 1 = complete) for SegmentProgressRing.
  // During firing-alarm, force progress=0 so the alarm arc renders at full
  // length (it's the visual that the .pulse-active keyframe drives — D-03).
  const config = alarm.activeConfig;
  const currentSegment = alarm.currentSegment;
  const isFiringAlarm = alarm.state === 'firing-alarm';
  const progress = isFiringAlarm
    ? 0
    : currentSegment
      ? Math.min(
          1,
          Math.max(0, 1 - segmentRemainingMs / currentSegment.segment.durationMs),
        )
      : 0;

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto px-6 py-12">
      {config && currentSegment && (
        <SegmentProgressRing
          config={config}
          currentIndex={currentSegment.index}
          progress={progress}
          pulseActive={isFiringAlarm}
          pausedDimming={alarm.isPaused}
        >
          {/* Big mm:ss timer with tabular-nums for stable width (verbatim from Countdown.tsx:118-127) */}
          <span
            className="text-text-primary font-light tracking-tight"
            style={{
              fontSize: 'var(--font-size-countdown)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatMmSs(isFiringAlarm ? elapsedSinceAlarmMs : segmentRemainingMs)}
          </span>

          {/* Total-time caption (NEW — UI-SPEC L259-265). Hidden during firing-alarm per D-05. */}
          {!isFiringAlarm && (
            <span
              className="text-text-secondary text-xs mt-1"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatMmSs(totalRemainingMs)} total
            </span>
          )}

          {/* Phase label — segment-index format during running, "Wake" during firing-alarm. */}
          <span className="text-text-secondary text-sm mt-2 transition-opacity duration-500">
            {isFiringAlarm
              ? 'Wake'
              : `Segment ${currentSegment.index + 1} of ${currentSegment.total} — ${SOUND_LABELS[currentSegment.segment.endSound]}`}
          </span>
        </SegmentProgressRing>
      )}

      {/* Controls below ring — verbatim from Countdown.tsx:136-151 with one delta on Pause (D-03). */}
      <div className="flex gap-4 mt-10">
        <button
          onClick={alarm.isPaused ? alarm.resume : alarm.pause}
          disabled={isFiringAlarm}
          className="px-8 py-3 rounded-xl border border-border text-text-primary bg-white/60 text-base transition-colors hover:bg-white/80 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {alarm.isPaused ? 'Resume' : 'Pause'}
        </button>
        <button
          onClick={alarm.stop}
          className="px-8 py-3 rounded-xl bg-accent text-white text-base transition-colors hover:bg-accent/90 active:scale-[0.98]"
        >
          Stop
        </button>
      </div>
    </div>
  );
}
