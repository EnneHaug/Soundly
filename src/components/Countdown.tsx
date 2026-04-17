/**
 * Countdown — Active alarm screen (UX-02, D-06, D-07, D-08, D-09, D-10).
 *
 * Displays:
 *   - Three-segment ProgressRing with current phase progress
 *   - Large mm:ss timer showing time remaining in the current phase
 *   - Phase label (Gentle Sound / Nudge / Wake)
 *   - Pause/Resume and Stop buttons
 *
 * Timer ticks every 250ms from phaseEndsAt. Timer freezes on pause (Pitfall 4).
 * Interval is cleaned up on unmount and when paused (T-03-08: no interval leak).
 */

import { useState, useEffect } from 'react';
import type { UseAlarmReturn } from '../hooks/useAlarm';
import type { AlarmPhase } from '../engine';
import ProgressRing from './ProgressRing';
import { formatMmSs } from '../utils/formatTime';

interface CountdownProps {
  alarm: UseAlarmReturn;
}

/** D-08: Human-readable phase labels */
const PHASE_LABELS: Record<string, string> = {
  idle: 'Starting...',
  phase1: 'Gentle Sound',
  phase2: 'Nudge',
  phase3: 'Wake',
  dismissed: '',
};

/**
 * Map phase to 0-based segment index for ProgressRing.
 * -1 = before any phase (idle countdown), 3 = all depleted (dismissed).
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

/**
 * Get the total duration (ms) of the current phase from config.
 * Used to compute phaseProgress for the ProgressRing.
 */
function getPhaseDuration(
  phase: AlarmPhase,
  config: NonNullable<UseAlarmReturn['activeConfig']>
): number {
  switch (phase) {
    case 'idle':
      return config.phase1DurationMs;
    case 'phase1':
      return config.phase2DurationMs;
    case 'phase2':
      return config.phase2to3GapMs;
    case 'phase3':
      return config.phase3RampDurationMs;
    default:
      return config.phase1DurationMs;
  }
}

export default function Countdown({ alarm }: CountdownProps) {
  const [displayRemainingMs, setDisplayRemainingMs] = useState(
    Math.max(0, alarm.phaseEndsAt - Date.now())
  );

  // Tick every 250ms when running. Freezes on pause (Pitfall 4).
  // Interval cleared on unmount and when paused (T-03-08: no interval leak).
  useEffect(() => {
    if (alarm.isPaused || !alarm.isRunning) return;

    // Set immediately so there's no initial lag
    setDisplayRemainingMs(Math.max(0, alarm.phaseEndsAt - Date.now()));

    const id = setInterval(() => {
      setDisplayRemainingMs(Math.max(0, alarm.phaseEndsAt - Date.now()));
    }, 250);

    return () => clearInterval(id);
  }, [alarm.isPaused, alarm.isRunning, alarm.phaseEndsAt]);

  // Compute phaseProgress (0 = just started, 1 = complete) for ProgressRing
  const config = alarm.activeConfig;
  let phaseProgress = 0;
  if (config) {
    const phaseTotalMs = getPhaseDuration(alarm.phase, config);
    phaseProgress = phaseTotalMs > 0
      ? Math.min(1, Math.max(0, 1 - displayRemainingMs / phaseTotalMs))
      : 0;
  }

  // ProgressRing needs currentPhase mapped to index-based awareness.
  // The ring uses the phase string directly — we pass it through.
  const currentPhase = alarm.phase;

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto px-6 py-12">
      {config && (
        <ProgressRing
          config={config}
          currentPhase={currentPhase}
          phaseProgress={phaseProgress}
        >
          {/* D-07: Large mm:ss countdown with tabular-nums for stable width */}
          <span
            className="text-text-primary font-light tracking-tight"
            style={{
              fontSize: 'var(--font-size-countdown)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatMmSs(displayRemainingMs)}
          </span>
          {/* D-08: Phase label with subtle crossfade on transition (D-10) */}
          <span className="text-text-secondary text-sm mt-1 transition-opacity duration-500">
            {PHASE_LABELS[alarm.phase] || ''}
          </span>
        </ProgressRing>
      )}

      {/* D-09: Controls below ring */}
      <div className="flex gap-4 mt-10">
        {/* Pause/Resume toggle */}
        <button
          onClick={alarm.isPaused ? alarm.resume : alarm.pause}
          className="px-8 py-3 rounded-xl border border-border text-text-primary bg-white/60 text-base transition-colors hover:bg-white/80 active:scale-[0.98]"
        >
          {alarm.isPaused ? 'Resume' : 'Pause'}
        </button>
        {/* Stop — returns to Dashboard immediately (D-02) */}
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
