/**
 * AlarmEngine — main orchestrator for the three-phase escalation sequence.
 *
 * State machine: idle → (countdown) → phase1 → phase2 → phase3 → dismissed
 *
 * Phase progression:
 * - idle: Engine not started, no timers running
 * - phase1: Singing bowl strike — gentle audio wake attempt (AUD-01)
 * - phase2: Vibration pattern — tactile escalation (Phase 2 handles vibration logic)
 * - phase3: Rising swell with volume ramp 0→100% — guaranteed wakeup (AUD-02)
 * - dismissed: Alarm acknowledged by user
 *
 * Thread safety note: AlarmEngine is designed for single-threaded JS. The
 * `start()` guard (_running flag) prevents duplicate timer registration
 * per threat T-01-06. The _running flag is separate from `phase` because
 * phase stays 'idle' during the countdown period before Phase 1 fires.
 *
 * @see .planning/phases/01-audio-engine-and-timer/01-RESEARCH.md (Pattern 3)
 */

import {
  AlarmPhase,
  AlarmConfig,
  PhaseChangeCallback,
  validateConfig,
} from './AlarmState';
import { scheduleAt, TimerHandle } from './timer';
import { getAudioContext } from './AudioContext';
import { strikeBowl } from './sounds/singingBowl';
import {
  createPhase3Ramp,
  startPhase3Swell,
  fadeOutGain,
} from './sounds/phase3Tone';
import { startKeepalive, stopKeepalive } from './sounds/keepalive';

export class AlarmEngine {
  private ac: AudioContext | null = null;
  private phase: AlarmPhase = 'idle';
  private _running: boolean = false; // true from start() until stop()/dismiss()
  private timers: TimerHandle[] = [];
  private keepaliveOsc: OscillatorNode | null = null;
  private phase3RampGain: GainNode | null = null;
  private phase3SwellOsc: OscillatorNode | null = null;
  private phase3LoopTimer: ReturnType<typeof setInterval> | null = null;
  private phaseCallback: PhaseChangeCallback | null = null;

  /** Returns the current alarm phase (read-only) */
  getPhase(): AlarmPhase {
    return this.phase;
  }

  /**
   * Registers a phase change callback.
   * Only one callback is held at a time — last registration wins.
   * React will use this with a ref in the useAlarmEngine hook.
   */
  onPhaseChange(cb: PhaseChangeCallback): void {
    this.phaseCallback = cb;
  }

  /** Updates phase and fires the registered callback (if any) */
  private setPhase(newPhase: AlarmPhase): void {
    this.phase = newPhase;
    this.phaseCallback?.(newPhase);
  }

  /**
   * Starts the alarm countdown sequence.
   *
   * MUST be called from a user gesture handler (click/tap) so that
   * getAudioContext() can create and/or resume the AudioContext.
   * Calling from page load will result in a suspended AudioContext.
   *
   * @param config - Phase durations and ramp configuration
   * @throws Error if engine is already running (phase !== 'idle')
   * @throws Error if config contains invalid durations
   */
  async start(config: AlarmConfig): Promise<void> {
    validateConfig(config); // throws on invalid durations (T-01-04)

    if (this._running) {
      throw new Error('AlarmEngine already running');
    }
    this._running = true;

    this.ac = await getAudioContext();

    // Start silent keepalive oscillator to keep AudioContext alive on mobile (AUD-04)
    this.keepaliveOsc = startKeepalive(this.ac);

    // Calculate absolute wall-clock fire times
    const phase1FireAt = Date.now() + config.phase1DurationMs;
    const phase2FireAt = phase1FireAt + config.phase2DurationMs;
    const phase3FireAt = phase2FireAt + config.phase2to3GapMs; // configurable gap per ALM-02/03

    // Phase 1: Singing bowl strike — gentle audio wake attempt
    this.timers.push(
      scheduleAt(phase1FireAt, () => {
        this.setPhase('phase1');
        strikeBowl(this.ac!, 1.0); // full volume singing bowl
      })
    );

    // Phase 2: State transition — vibration handled in Phase 2 (Background Reliability)
    this.timers.push(
      scheduleAt(phase2FireAt, () => {
        this.setPhase('phase2');
        // Singing bowl's natural decay handles D-04 overlap-then-fade
        // Phase 2 React layer will trigger navigator.vibrate() from this callback
      })
    );

    // Phase 3: Volume ramp + rising swell — guaranteed wakeup
    this.timers.push(
      scheduleAt(phase3FireAt, () => {
        this.enterPhase3(config.phase3RampDurationMs);
      })
    );

    // Note: phase stays 'idle' during countdown period.
    // The UI tracks "is timer running" via a separate boolean, not phase.
  }

  /**
   * Enters Phase 3: creates volume ramp gain node and starts looping swell oscillator.
   *
   * The swell loops every 3.2 seconds using the factory pattern (new OscillatorNode
   * per cycle) because OscillatorNode cannot be restarted after stop() (D-05).
   *
   * @param rampDurationMs - Duration of 0→100% volume ramp in milliseconds
   */
  private enterPhase3(rampDurationMs: number): void {
    this.setPhase('phase3');

    // Create volume ramp gain: 0→100% over rampDuration seconds
    this.phase3RampGain = createPhase3Ramp(this.ac!, rampDurationMs / 1000);

    // Start initial swell cycle
    this.phase3SwellOsc = startPhase3Swell(this.ac!, this.phase3RampGain);

    // Loop: stop old swell and create new one every 3.2 seconds (T-01-05: interval cleared on stop/dismiss)
    this.phase3LoopTimer = setInterval(() => {
      try {
        this.phase3SwellOsc?.stop();
      } catch {
        // OscillatorNode may already be stopped — safe to ignore
      }
      this.phase3SwellOsc = startPhase3Swell(this.ac!, this.phase3RampGain!);
    }, 3200);
  }

  /**
   * Stops the alarm, cancels all timers, and returns to idle.
   * Safe to call from any phase.
   */
  stop(): void {
    this.cleanup();
    this.setPhase('idle');
  }

  /**
   * Dismisses the alarm — same cleanup as stop() but transitions to 'dismissed'.
   * Used when the user explicitly acknowledges the alarm.
   */
  dismiss(): void {
    this.cleanup();
    this.setPhase('dismissed');
  }

  /**
   * Internal cleanup: cancels all timers and stops all audio nodes.
   * Called by both stop() and dismiss().
   */
  private cleanup(): void {
    this._running = false;

    // Cancel all pending timers (phase1, phase2, phase3 transitions)
    this.timers.forEach((t) => t.cancel());
    this.timers = [];

    // Stop silent keepalive oscillator
    if (this.keepaliveOsc) {
      stopKeepalive(this.keepaliveOsc);
      this.keepaliveOsc = null;
    }

    // Stop Phase 3 swell loop (T-01-05: prevents OscillatorNode accumulation)
    if (this.phase3LoopTimer !== null) {
      clearInterval(this.phase3LoopTimer);
      this.phase3LoopTimer = null;
    }

    // Stop Phase 3 swell oscillator
    try {
      this.phase3SwellOsc?.stop();
    } catch {
      // Already stopped — safe to ignore
    }
    this.phase3SwellOsc = null;

    // Fade out Phase 3 ramp gain (smooth stop, no audible click per pitfall 4)
    if (this.phase3RampGain && this.ac) {
      fadeOutGain(this.phase3RampGain, this.ac);
      this.phase3RampGain = null;
    }
  }
}
