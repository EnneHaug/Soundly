/**
 * Public API barrel export for the alarm engine.
 *
 * This is the single import point for Phase 3 React integration.
 * Import from 'src/engine' (not from individual files) to maintain
 * a stable public API surface as implementation details evolve.
 *
 * @example
 * import { AlarmEngine, AlarmPhase, AlarmConfig, DEFAULT_CONFIG, QUICK_NAP_CONFIG, FOCUS_CONFIG } from '../engine';
 */

export { AlarmEngine } from './AlarmEngine';
export {
  AlarmPhase,
  AlarmConfig,
  PhaseChangeCallback,
  DEFAULT_CONFIG,
  QUICK_NAP_CONFIG,
  FOCUS_CONFIG,
  validateConfig,
} from './AlarmState';
export { getAudioContext } from './AudioContext';
export { playTestSound, TEST_SOUND_GAIN } from './sounds/testSound';
export { playTick } from './sounds/tickPulse';
export { startVibration, stopVibration } from '../platform/vibration';
export { acquireWakeLock, releaseWakeLock, attachVisibilityReacquire } from '../platform/wakeLock';
