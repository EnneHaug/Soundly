/**
 * useAlarm — React hook wrapping AlarmEngine with reactive state.
 *
 * Provides a stable interface for React components to interact with the
 * AlarmEngine singleton. The engine ref persists across re-renders; state
 * changes trigger re-renders only when phase, isPaused, or isRunning change.
 *
 * Security (T-03-01): The engine ref is not exposed outside the hook —
 * only controlled methods (start/stop/pause/resume) are returned.
 */

import { useRef, useState } from 'react';
import { AlarmEngine } from '../engine/AlarmEngine';
import { AlarmPhase, AlarmConfig } from '../engine/AlarmState';
import { requestNotificationPermission } from '../platform/notifications';

export interface UseAlarmReturn {
  phase: AlarmPhase;
  isPaused: boolean;
  isRunning: boolean;
  /** Epoch ms when current phase ends (for countdown display). 0 when not running. */
  phaseEndsAt: number;
  activeConfig: AlarmConfig | null;
  start: (config: AlarmConfig) => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
}

interface AlarmState {
  phase: AlarmPhase;
  isPaused: boolean;
  isRunning: boolean;
  phaseEndsAt: number;
  activeConfig: AlarmConfig | null;
}

const INITIAL_STATE: AlarmState = {
  phase: 'idle',
  isPaused: false,
  isRunning: false,
  phaseEndsAt: 0,
  activeConfig: null,
};

/**
 * Computes the epoch ms when the current phase ends, given the phase that just
 * started and the active config. Used in the onPhaseChange callback.
 */
function computePhaseEndsAt(phase: AlarmPhase, config: AlarmConfig | null): number {
  if (!config) return 0;
  const now = Date.now();
  switch (phase) {
    case 'phase1':
      return now + config.phase2DurationMs; // phase1 ends when phase2 fires
    case 'phase2':
      return now + config.phase2to3GapMs; // phase2 ends when phase3 fires
    case 'phase3':
      return now + config.phase3RampDurationMs;
    default:
      return 0;
  }
}

export function useAlarm(): UseAlarmReturn {
  const engineRef = useRef<AlarmEngine | null>(null);
  const [state, setState] = useState<AlarmState>(INITIAL_STATE);

  // Lazy-initialize the engine singleton
  if (engineRef.current === null) {
    engineRef.current = new AlarmEngine();
  }

  const engine = engineRef.current;

  // Register onPhaseChange callback directly in the hook body (not in useEffect).
  // Last-registration-wins per the engine API contract — React re-renders replace
  // the callback with a fresh closure that has access to current state via setState.
  // This avoids stale closures and matches Pattern 1 from 03-RESEARCH.md.
  engine.onPhaseChange((newPhase: AlarmPhase) => {
    setState((prev) => ({
      ...prev,
      phase: newPhase,
      phaseEndsAt: computePhaseEndsAt(newPhase, prev.activeConfig),
    }));
  });

  const start = async (config: AlarmConfig): Promise<void> => {
    // Request notification permission from user gesture context (Pitfall 2)
    await requestNotificationPermission();
    await engine.start(config);
    setState({
      phase: 'idle', // still idle during countdown
      isPaused: false,
      isRunning: true,
      phaseEndsAt: Date.now() + config.phase1DurationMs,
      activeConfig: config,
    });
  };

  const stop = (): void => {
    engine.stop();
    setState(INITIAL_STATE);
  };

  const pause = (): void => {
    engine.pause();
    setState((prev) => ({
      ...prev,
      isPaused: true,
      // Snapshot remaining time so resume can restore it
      phaseEndsAt: Math.max(0, prev.phaseEndsAt - Date.now()),
    }));
  };

  const resume = (): void => {
    engine.resume();
    setState((prev) => ({
      ...prev,
      isPaused: false,
      // phaseEndsAt was storing remaining ms while paused — convert back to epoch
      phaseEndsAt: Date.now() + prev.phaseEndsAt,
    }));
  };

  return {
    phase: state.phase,
    isPaused: state.isPaused,
    isRunning: state.isRunning,
    phaseEndsAt: state.phaseEndsAt,
    activeConfig: state.activeConfig,
    start,
    stop,
    pause,
    resume,
  };
}
