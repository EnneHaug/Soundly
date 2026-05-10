/**
 * useSegmentAlarm — React hook wrapping SegmentEngine with reactive state.
 *
 * Provides a stable interface for React components to interact with the
 * SegmentEngine singleton. The engine ref persists across re-renders; state
 * changes trigger re-renders only when state, isPaused, isRunning,
 * currentSegment, segmentEndsAt, totalEndsAt, alarmStartedAt, or
 * activeConfig change.
 *
 * Security (T-03-01): The engine ref is not exposed outside the hook —
 * only controlled methods (start/stop/pause/resume) are returned.
 *
 * Mirrors useAlarm.ts:65-137 line-for-line per CONTEXT D-09 with three deltas:
 *   1. SegmentEngineState replaces AlarmPhase (the engine's enum, not v1's).
 *   2. segmentEndsAt + totalEndsAt + alarmStartedAt replace v1's single
 *      phaseEndsAt (D-05 segment-remaining vs total caption; D-03 count-up).
 *   3. onSegmentChange is registered in the body (last-wins) and polls
 *      engine.getState() to capture the engine's pre-callback state transition
 *      (verified SegmentEngine.ts:212).
 *
 * Pause guard (D-09 / D-03): pause() is a silent no-op when engine.canPause()
 * returns false — prevents the user from accidentally silencing the fail-safe
 * alarm during 'firing-alarm' state.
 */

import { useRef, useState } from 'react';
import { SegmentEngine } from '../engine/SegmentEngine';
import type {
  Segment,
  SegmentConfig,
  SegmentEngineState,
  SegmentChangeEvent,
} from '../engine/SegmentState';
import { requestNotificationPermission } from '../platform/notifications';

export interface UseSegmentAlarmReturn {
  state: SegmentEngineState;
  isPaused: boolean;
  isRunning: boolean;
  currentSegment: { index: number; total: number; segment: Segment } | null;
  /** Epoch ms when current segment ends (for segment-remaining countdown). 0 when idle/dismissed. */
  segmentEndsAt: number;
  /** Epoch ms when whole composition ends (for total-remaining caption). 0 when idle/dismissed/firing-alarm. */
  totalEndsAt: number;
  /** Epoch ms when alarm-firing started (for count-up display). 0 when not firing. */
  alarmStartedAt: number;
  activeConfig: SegmentConfig | null;
  start: (config: SegmentConfig) => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
}

interface SegmentAlarmState {
  state: SegmentEngineState;
  isPaused: boolean;
  isRunning: boolean;
  currentSegment: { index: number; total: number; segment: Segment } | null;
  segmentEndsAt: number;
  totalEndsAt: number;
  alarmStartedAt: number;
  activeConfig: SegmentConfig | null;
}

const INITIAL_STATE: SegmentAlarmState = {
  state: 'idle',
  isPaused: false,
  isRunning: false,
  currentSegment: null,
  segmentEndsAt: 0,
  totalEndsAt: 0,
  alarmStartedAt: 0,
  activeConfig: null,
};

export function useSegmentAlarm(): UseSegmentAlarmReturn {
  const engineRef = useRef<SegmentEngine | null>(null);
  const [state, setState] = useState<SegmentAlarmState>(INITIAL_STATE);

  // Lazy-initialize the engine singleton
  if (engineRef.current === null) {
    engineRef.current = new SegmentEngine();
  }

  const engine = engineRef.current;

  // Register onSegmentChange callback directly in the hook body (not in useEffect).
  // Last-registration-wins per the engine API contract — React re-renders replace
  // the callback with a fresh closure that has access to current state via setState.
  // This avoids stale closures and matches Pattern 1 from 08-RESEARCH.md.
  engine.onSegmentChange((event: SegmentChangeEvent) => {
    setState((prev) => {
      const newState = engine.getState(); // poll AFTER the engine's state transition
      let segmentEndsAt = prev.segmentEndsAt;
      let totalEndsAt = prev.totalEndsAt;
      let alarmStartedAt = prev.alarmStartedAt;
      let currentSegment = prev.currentSegment;

      if (event.kind === 'start') {
        segmentEndsAt = Date.now() + event.segment.durationMs;
        currentSegment = {
          index: event.segmentIndex,
          total: event.totalSegments,
          segment: event.segment,
        };
      } else if (event.kind === 'end' && event.segment.endSound === 'alarm') {
        // Engine has transitioned to 'firing-alarm' (verified SegmentEngine.ts:212).
        alarmStartedAt = Date.now();
        segmentEndsAt = 0;
        totalEndsAt = 0;
        currentSegment = {
          index: event.segmentIndex,
          total: event.totalSegments,
          segment: event.segment,
        };
      }

      return { ...prev, state: newState, segmentEndsAt, totalEndsAt, alarmStartedAt, currentSegment };
    });
  });

  const start = async (config: SegmentConfig): Promise<void> => {
    // Request notification permission from user gesture context (D-18; mirrors useAlarm.ts:90)
    await requestNotificationPermission();
    await engine.start(config);
    const now = Date.now();
    const totalDuration = config.segments.reduce((sum, s) => sum + s.durationMs, 0);
    setState({
      state: 'running',
      isPaused: false,
      isRunning: true,
      currentSegment: {
        index: 0,
        total: config.segments.length,
        segment: config.segments[0],
      },
      segmentEndsAt: now + config.segments[0].durationMs,
      totalEndsAt: now + totalDuration,
      alarmStartedAt: 0,
      activeConfig: config,
    });
  };

  const stop = (): void => {
    engine.stop();
    setState(INITIAL_STATE);
  };

  const pause = (): void => {
    // Silent no-op when engine.canPause() returns false (D-09 + PATTERNS L242-244).
    // Prevents UX from accidentally silencing the fail-safe alarm during firing-alarm.
    if (!engine.canPause()) return;
    engine.pause();
    setState((prev) => ({
      ...prev,
      isPaused: true,
      // Snapshot remaining time so resume can restore it (Pitfall 3 — both fields)
      segmentEndsAt: Math.max(0, prev.segmentEndsAt - Date.now()),
      totalEndsAt: Math.max(0, prev.totalEndsAt - Date.now()),
    }));
  };

  const resume = (): void => {
    engine.resume();
    setState((prev) => ({
      ...prev,
      isPaused: false,
      // segmentEndsAt + totalEndsAt were storing remaining ms while paused — convert back to epoch
      segmentEndsAt: Date.now() + prev.segmentEndsAt,
      totalEndsAt: Date.now() + prev.totalEndsAt,
    }));
  };

  return {
    state: state.state,
    isPaused: state.isPaused,
    isRunning: state.isRunning,
    currentSegment: state.currentSegment,
    segmentEndsAt: state.segmentEndsAt,
    totalEndsAt: state.totalEndsAt,
    alarmStartedAt: state.alarmStartedAt,
    activeConfig: state.activeConfig,
    start,
    stop,
    pause,
    resume,
  };
}
