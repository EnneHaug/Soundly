/**
 * Alarm state machine types and configuration.
 *
 * Defines the vocabulary for the AlarmEngine state machine:
 * idle → (waiting) → phase1 → phase2 → phase3 → dismissed
 *
 * Phase progression:
 * - idle: Engine not started, no timers running
 * - phase1: Singing bowl strike — gentle audio wake attempt
 * - phase2: Vibration pattern — tactile escalation
 * - phase3: Rising swell with volume ramp 0→100% — guaranteed wakeup
 * - dismissed: Alarm acknowledged by user
 */

/**
 * The phases of the alarm escalation sequence.
 * Note: 'idle' also covers the countdown period while timers are running
 * but Phase 1 has not yet fired. The UI tracks "is timer running" separately.
 */
export type AlarmPhase = 'idle' | 'phase1' | 'phase2' | 'phase3' | 'dismissed';

/**
 * Configuration for the alarm escalation sequence.
 * All durations are in milliseconds.
 */
export interface AlarmConfig {
  /** Delay from start() before Phase 1 triggers (e.g. 300_000 = 5 min) */
  phase1DurationMs: number;
  /** Duration of Phase 2 before Phase 3 escalation (e.g. 300_000 = 5 min) */
  phase2DurationMs: number;
  /** Volume ramp duration for Phase 3 (default 60_000 = 1 min, per AUD-02) */
  phase3RampDurationMs: number;
  /**
   * Gap between Phase 2 end and Phase 3 start (default 10_000 = 10s).
   * Exposed so Phase 2 presets (ALM-02, ALM-03) can configure this value
   * without modifying Phase 1 code.
   */
  phase2to3GapMs: number;
}

/**
 * Callback fired on every state transition.
 * The AlarmEngine calls this on every phase change.
 */
export type PhaseChangeCallback = (phase: AlarmPhase) => void;

/**
 * Default alarm configuration.
 * 5 min soft sound, 5 min vibration, 10s gap, then 1 min volume ramp.
 */
export const DEFAULT_CONFIG: AlarmConfig = {
  phase1DurationMs: 300_000,
  phase2DurationMs: 300_000,
  phase3RampDurationMs: 60_000,
  phase2to3GapMs: 10_000,
};

/** Quick Nap: 5 min soft sound, 5 min vibration, 10s gap, 1 min ramp (ALM-02, D-06) */
export const QUICK_NAP_CONFIG: AlarmConfig = {
  phase1DurationMs: 300_000,
  phase2DurationMs: 300_000,
  phase2to3GapMs: 10_000,
  phase3RampDurationMs: 60_000,
};

/** Focus: 21 min soft sound, 2 min vibration, 10s gap, 1 min ramp (ALM-03, D-06) */
export const FOCUS_CONFIG: AlarmConfig = {
  phase1DurationMs: 1_260_000,
  phase2DurationMs: 120_000,
  phase2to3GapMs: 10_000,
  phase3RampDurationMs: 60_000,
};

/**
 * Validates the alarm configuration, throwing if any duration is invalid.
 *
 * Rules:
 * - All durations must be > 0
 * - All durations must be <= 14_400_000ms (4 hours max — prevents nonsensical
 *   timer values and potential integer overflow per T-01-04)
 *
 * @throws Error if any duration fails validation
 */
export function validateConfig(config: AlarmConfig): void {
  const MAX_MS = 14_400_000; // 4 hours

  const fields: (keyof AlarmConfig)[] = [
    'phase1DurationMs',
    'phase2DurationMs',
    'phase3RampDurationMs',
    'phase2to3GapMs',
  ];

  for (const field of fields) {
    const value = config[field];
    if (value <= 0) {
      throw new Error(`AlarmConfig.${field} must be > 0, got ${value}`);
    }
    if (value > MAX_MS) {
      throw new Error(
        `AlarmConfig.${field} must be <= ${MAX_MS}ms (4 hours), got ${value}`
      );
    }
  }
}
