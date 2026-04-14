/**
 * Public API barrel export for the alarm engine.
 *
 * This is the single import point for Phase 3 React integration.
 * Import from 'src/engine' (not from individual files) to maintain
 * a stable public API surface as implementation details evolve.
 *
 * @example
 * import { AlarmEngine, AlarmPhase, AlarmConfig, DEFAULT_CONFIG, getAudioContext, playTestSound, TEST_SOUND_GAIN } from '../engine';
 */

export { AlarmEngine } from './AlarmEngine';
export {
  AlarmPhase,
  AlarmConfig,
  PhaseChangeCallback,
  DEFAULT_CONFIG,
  validateConfig,
} from './AlarmState';
export { getAudioContext } from './AudioContext';
export { playTestSound, TEST_SOUND_GAIN } from './sounds/testSound';
