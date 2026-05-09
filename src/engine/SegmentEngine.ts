/**
 * SegmentEngine — orchestrator for the v2.0 segment-based alarm composition.
 *
 * Mirrors AlarmEngine's shape exactly per Phase 7 CONTEXT D-07. The novelty
 * vs AlarmEngine is concentrated in three places:
 *   1. Absolute-epoch scheduling loop replaces three discrete phase fires (SEG-02 / D-16).
 *   2. The alarm-segment fire enters 'firing-alarm' state and reuses the v1
 *      Phase 3 ramp + swell stack BYTE-IDENTICALLY (D-01).
 *   3. Per-key auto-stop window for the last gentle/triangle strike (D-04).
 *
 * cleanup() ordering is copied VERBATIM from AlarmEngine.cleanup():354-407 with
 * the phase3* → alarm* rename and Phase 2 vibration/tick blocks dropped — the
 * SegmentEngine has no Phase 2 equivalent. This ordering is load-bearing per
 * threat T-07-03 (DoS via orphaned audio nodes) and T-07-03b (alarm-loop timer
 * leak via incorrect cleanup ordering).
 *
 * State machine: 'idle' → 'running' → ('firing-alarm' | 'dismissed').
 * canPause() returns false while in 'firing-alarm' (D-03) — pause() during the
 * alarm phase is a silent no-op so the user cannot accidentally silence the
 * fail-safe alarm by tapping a stale pause button.
 *
 * @see .planning/phases/07-segment-engine-triangle-sound/07-CONTEXT.md
 *      (D-01..D-04 alarm semantics; D-07..D-10 class API; D-16/D-17 scheduling;
 *       D-19..D-21 pause snapshot; D-22..D-23 test split).
 * @see .planning/phases/07-segment-engine-triangle-sound/07-RESEARCH.md
 *      (Pattern 1-5; Pitfall #4 fadeOutGain ordering; Pitfall #6 increment
 *       ordering; Open Q #1 per-key auto-stop window; Open Q #2 throw on invalid).
 * @see src/engine/AlarmEngine.ts:354-407 — cleanup() analog (verbatim ordering).
 */

import {
  Segment,
  SegmentConfig,
  SegmentEngineState,
  SegmentChangeEvent,
  SegmentPauseSnapshot,
  validateSegmentConfig,
} from './SegmentState';
import { scheduleAt, TimerHandle } from './timer';
import {
  createPhase3Ramp,
  startPhase3Swell,
  fadeOutGain,
} from './sounds/phase3Tone';
import { fireSegmentEndSound } from './sounds/segmentSound';
import { startAlarmSession, endAlarmSession, type SessionHandle } from './AlarmSession';

export class SegmentEngine {
  private ac: AudioContext | null = null;
  private session: SessionHandle | null = null;
  private state: SegmentEngineState = 'idle';
  private _running: boolean = false;
  private _paused: boolean = false;
  private timers: TimerHandle[] = [];

  // Alarm-segment audio teardown handles (mirrors AlarmEngine.phase3* with rename per D-01)
  private alarmRampGain: GainNode | null = null;
  private alarmSwellNodes: OscillatorNode[] | null = null;
  private alarmLoopTimer: ReturnType<typeof setInterval> | null = null;

  // Segment-fire bookkeeping
  private currentIdx: number = -1;
  private epochBaseline: number = 0;
  private activeConfig: SegmentConfig | null = null;

  // Pause/resume state (SEG-03 / D-19)
  private pauseSnapshot: SegmentPauseSnapshot | null = null;

  // Auto-stop teardown handle (D-04 — only set when last segment is gentle/triangle)
  private autoStopTimer: ReturnType<typeof setTimeout> | null = null;

  // Segment-change callback (D-09 — single, last-wins)
  private segmentChangeCb: ((e: SegmentChangeEvent) => void) | null = null;

  /**
   * Per-key decay window for auto-stop after the last gentle/triangle strike (D-04).
   *
   * gentle (singing bowl) — longest partial decays over ~6.0 s; 6100 ms gives
   *   a safety margin beyond singingBowl's exponential tail.
   * triangle — 2.0 s exponential decay; 2100 ms matches osc.stop(t + 2.1) in
   *   the strikeTriangle implementation.
   */
  private static readonly DECAY_WINDOW_MS: Record<'gentle' | 'triangle', number> = {
    gentle: 6100,
    triangle: 2100,
  };

  /**
   * Registers a segment change callback. Last registration wins (D-09).
   * Caller wraps in a React ref / hook for component lifetime safety.
   */
  onSegmentChange(cb: (e: SegmentChangeEvent) => void): void {
    this.segmentChangeCb = cb;
  }

  /** Fires the registered callback (if any). Mirrors AlarmEngine.setPhase fan-out. */
  private fireChange(e: SegmentChangeEvent): void {
    this.segmentChangeCb?.(e);
  }

  /** D-08: returns the engine state ('idle' | 'running' | 'firing-alarm' | 'dismissed'). */
  getState(): SegmentEngineState {
    return this.state;
  }

  /** Returns whether the engine is currently paused. */
  isPaused(): boolean {
    return this._paused;
  }

  /**
   * D-03: pause is disabled while in 'firing-alarm' state. The alarm is the
   * fail-safe — once it fires it MUST run until manual dismiss/stop. Returning
   * false here makes pause() a silent no-op (UX cannot accidentally silence it).
   */
  canPause(): boolean {
    return this.state !== 'firing-alarm' && this._running && !this._paused;
  }

  /** D-10: returns null when state is 'idle' or 'dismissed', otherwise the current snapshot. */
  getCurrentSegment(): { index: number; total: number; segment: Segment } | null {
    if (this.state === 'idle' || this.state === 'dismissed') return null;
    if (!this.activeConfig || this.currentIdx < 0) return null;
    const segment = this.activeConfig.segments[this.currentIdx];
    if (!segment) return null;
    return { index: this.currentIdx, total: this.activeConfig.segments.length, segment };
  }

  /**
   * Starts the alarm composition.
   *
   * MUST be called from a user gesture handler so that getAudioContext() can
   * create and/or resume the AudioContext (mirrors AlarmEngine.start contract).
   *
   * Validation gate (SEG-04 + D-11 + RESEARCH Open Q #2): validateSegmentConfig
   * is called first; the engine throws Error(result.error) on !ok. The validator
   * itself does NOT throw (it returns a discriminated union) — composer (Phase 9)
   * surfaces the message inline; this throw is the safety net for direct callers
   * (Phase 7 harness, Phase 8 hook, tests).
   *
   * Reentrancy gate (T-07-02): _running guard mirrors AlarmEngine T-01-04.
   *
   * @param config - SegmentConfig with at least one segment.
   * @throws Error with validator's user-readable message on invalid config.
   * @throws Error('SegmentEngine already running') when called while _running.
   */
  async start(config: SegmentConfig): Promise<void> {
    const result = validateSegmentConfig(config);
    if (!result.ok) {
      throw new Error(result.error);
    }

    if (this._running) {
      throw new Error('SegmentEngine already running');
    }
    this._running = true;

    // Bring up the shared session lifecycle (Phase 6 D-01..D-08).
    this.session = await startAlarmSession();
    this.ac = this.session.ac;

    // Absolute-epoch scheduling per SEG-02 + D-16. NEVER chained setTimeout —
    // each segment-end fires at epochBaseline + cumulativeDuration so drift
    // through 17 minutes of Wake Easy stays within scheduleAt's ±10 ms gate.
    this.activeConfig = result.config;
    this.epochBaseline = Date.now();
    this.state = 'running';
    this.currentIdx = 0;

    let cumulative = 0;
    for (let i = 0; i < result.config.segments.length; i++) {
      cumulative += result.config.segments[i].durationMs;
      const fireAt = this.epochBaseline + cumulative;
      this.timers.push(
        scheduleAt(fireAt, () => this.handleSegmentFire(i)),
      );
    }

    // Emit the initial 'start' event for segment 0 (D-09 — pairs with the eventual 'end').
    this.fireChange({
      kind: 'start',
      segmentIndex: 0,
      totalSegments: result.config.segments.length,
      segment: result.config.segments[0],
    });
  }

  /**
   * Per-segment fire callback. Ordering is load-bearing per RESEARCH Pitfall #6:
   *   1. Emit 'end' event for the segment that just elapsed.
   *   2. Increment currentIdx.
   *   3. Either start the alarm phase (terminal) or fire the strike + emit 'start'
   *      for the next segment, OR schedule auto-stop if this was the last
   *      gentle/triangle segment (D-04).
   */
  private handleSegmentFire(firingIdx: number): void {
    if (!this._running || !this.activeConfig || !this.ac) return;

    const segment = this.activeConfig.segments[firingIdx];
    const total = this.activeConfig.segments.length;

    // 1. Emit 'end' event for the segment that just elapsed.
    this.fireChange({ kind: 'end', segmentIndex: firingIdx, totalSegments: total, segment });

    // 2. Increment AFTER 'end' but BEFORE strike + 'start' (RESEARCH Pitfall #6).
    this.currentIdx = firingIdx + 1;

    if (segment.endSound === 'alarm') {
      // D-01: alarm starts at segment-START (this fire IS the start of the alarm phase).
      // State transition MUST happen BEFORE creating the ramp so canPause() flips to false
      // atomically (D-03). The alarm runs until manual dismiss/stop (D-02).
      this.state = 'firing-alarm';
      this.alarmRampGain = createPhase3Ramp(this.ac, segment.durationMs / 1000);
      this.alarmSwellNodes = startPhase3Swell(this.ac, this.alarmRampGain);
      this.alarmLoopTimer = setInterval(() => {
        // OscillatorNode factory: cannot restart, must rebuild each cycle (CLAUDE.md mandate).
        this.alarmSwellNodes?.forEach((n) => {
          try {
            n.stop();
          } catch {
            // already stopped — safe to ignore
          }
        });
        if (this.ac && this.alarmRampGain) {
          this.alarmSwellNodes = startPhase3Swell(this.ac, this.alarmRampGain);
        }
      }, 3200);
      // No 'start' event for a synthesized "next segment" — alarm is terminal until dismiss.
      return;
    }

    // 3. Gentle / triangle: fire the strike via the dispatcher.
    fireSegmentEndSound(this.ac, segment.endSound);

    // 4. Last-segment auto-stop (D-04) OR continue with 'start' for next segment.
    const isLast = firingIdx === total - 1;
    if (isLast) {
      // D-04: auto-stop after this strike's per-key decay window.
      const decayMs = SegmentEngine.DECAY_WINDOW_MS[segment.endSound];
      this.autoStopTimer = setTimeout(() => {
        this.autoStopTimer = null;
        this.cleanup();
        this.state = 'dismissed';
      }, decayMs);
    } else {
      const next = this.activeConfig.segments[this.currentIdx];
      this.fireChange({ kind: 'start', segmentIndex: this.currentIdx, totalSegments: total, segment: next });
    }
  }

  /**
   * Pauses the alarm: snapshots remaining time inside the current segment and
   * the durations of all future segments, cancels pending segment-end timers.
   *
   * D-03: silent no-op when !canPause() (also covers _running && !_paused &&
   * state !== firing-alarm). UX cannot pause during the alarm phase.
   *
   * Does NOT abort in-flight strike decay envelopes — they are owned by the
   * audio graph and finish naturally.
   */
  pause(): void {
    if (!this.canPause()) return;
    if (!this.activeConfig) return;
    this._paused = true;

    const now = Date.now();
    // currentIdx is updated AFTER 'end' fires, so during normal running it points
    // to the segment currently elapsing (whose timer fires at the END of that segment).
    const cumulativeUpToCurrent = this.activeConfig.segments
      .slice(0, this.currentIdx)
      .reduce((sum, s) => sum + s.durationMs, 0);
    const currentSegmentEndEpoch = this.epochBaseline
      + cumulativeUpToCurrent
      + this.activeConfig.segments[this.currentIdx].durationMs;
    const currentSegmentRemainingMs = Math.max(0, currentSegmentEndEpoch - now);

    this.pauseSnapshot = {
      currentSegmentIndex: this.currentIdx,
      currentSegmentRemainingMs: currentSegmentRemainingMs,
      futureSegmentDurationsMs: this.activeConfig.segments
        .slice(this.currentIdx + 1)
        .map((s) => s.durationMs),
    };

    // Cancel pending segment-end timers (D-20). Do NOT touch in-flight strike decay envelopes —
    // they are owned by the audio graph and finish naturally.
    this.timers.forEach((t) => t.cancel());
    this.timers = [];

    // Cancel any pending auto-stop (will be re-scheduled if applicable on resume).
    if (this.autoStopTimer !== null) {
      clearTimeout(this.autoStopTimer);
      this.autoStopTimer = null;
    }
  }

  /**
   * Resumes a paused alarm: re-baselines epoch, re-registers scheduleAt for
   * the current segment's remaining time and each future segment's full duration.
   *
   * Re-emits 'start' for the current segment so any UI subscriber repaints
   * (last-wins callback, no debouncing needed).
   */
  resume(): void {
    if (!this._paused || !this.pauseSnapshot || !this.activeConfig) return;
    const snapshot = this.pauseSnapshot;
    const total = this.activeConfig.segments.length;
    const now = Date.now();

    // Re-baseline: epochBaseline shifts forward so cumulative offsets still align.
    // After resume, fire epochs for current segment = now + currentSegmentRemainingMs;
    // each future segment = previous fire epoch + duration.
    this.epochBaseline = now - this.activeConfig.segments
      .slice(0, snapshot.currentSegmentIndex)
      .reduce((sum, s) => sum + s.durationMs, 0)
      - (this.activeConfig.segments[snapshot.currentSegmentIndex].durationMs - snapshot.currentSegmentRemainingMs);

    // Re-register timers for current + future segments.
    let cumulative = now + snapshot.currentSegmentRemainingMs;
    this.timers.push(scheduleAt(cumulative, () => this.handleSegmentFire(snapshot.currentSegmentIndex)));
    for (let k = 0; k < snapshot.futureSegmentDurationsMs.length; k++) {
      cumulative += snapshot.futureSegmentDurationsMs[k];
      const fireIdx = snapshot.currentSegmentIndex + 1 + k;
      this.timers.push(scheduleAt(cumulative, () => this.handleSegmentFire(fireIdx)));
    }

    this._paused = false;
    this.pauseSnapshot = null;

    // Repaint UI state (last-wins callback) — re-emit 'start' for current segment.
    this.fireChange({
      kind: 'start',
      segmentIndex: snapshot.currentSegmentIndex,
      totalSegments: total,
      segment: this.activeConfig.segments[snapshot.currentSegmentIndex],
    });
  }

  /** Stops the alarm and transitions to 'dismissed' (per PATTERNS line 218). */
  stop(): void {
    this.cleanup();
    this.state = 'dismissed';
  }

  /** Dismisses the alarm and transitions to 'dismissed'. */
  dismiss(): void {
    this.cleanup();
    this.state = 'dismissed';
  }

  /**
   * Internal cleanup — VERBATIM 7-step ordering from AlarmEngine.cleanup():354-407
   * with phase3* → alarm* rename and Phase 2 vibration/tick blocks DROPPED.
   *
   * Ordering is load-bearing per threats T-07-03 + T-07-03b:
   *   Step 1: clear running/paused/state flags FIRST.
   *   Step 2: cancel pending TimerHandles BEFORE session teardown.
   *   Step 3: end the AlarmSession (keepalive + Wake Lock + visibility).
   *   Step 4: clear alarm-segment swell loop BEFORE stopping its swell oscillators.
   *   Step 5: stop alarm-segment swell oscillator stack (try/catch per node).
   *   Step 6: fade out alarm-segment ramp gain (LAST step — Pitfall #4).
   */
  private cleanup(): void {
    // Step 1: clear running/paused/state flags FIRST — prevents reentrancy from any callback
    // that fires mid-teardown.
    this._running = false;
    this._paused = false;
    this.pauseSnapshot = null;
    this.activeConfig = null;

    // Step 2: cancel pending TimerHandles (segment-boundary fires) BEFORE session teardown so
    // no new fires queue against an already-released AlarmSession.
    this.timers.forEach((t) => t.cancel());
    this.timers = [];

    // Cancel any pending auto-stop scheduled by D-04.
    if (this.autoStopTimer !== null) {
      clearTimeout(this.autoStopTimer);
      this.autoStopTimer = null;
    }

    // Step 3: end the AlarmSession (keepalive + Wake Lock + visibility re-acquire teardown).
    // Position preserved (between timer cancel and audio teardown) per Phase 6 D-04.
    if (this.session) {
      endAlarmSession(this.session);
      this.session = null;
    }

    // Step 4: clear alarm-segment swell loop interval BEFORE stopping its swell oscillators —
    // prevents the loop from rebuilding the swell stack while we tear it down.
    if (this.alarmLoopTimer !== null) {
      clearInterval(this.alarmLoopTimer);
      this.alarmLoopTimer = null;
    }

    // Step 5: stop alarm-segment swell oscillator stack (every node, including LFO if any).
    this.alarmSwellNodes?.forEach((n) => {
      try {
        n.stop();
      } catch {
        // OscillatorNode may already be stopped — safe to ignore (factory pattern lifecycle).
      }
    });
    this.alarmSwellNodes = null;

    // Step 6: fade out alarm-segment ramp gain (smooth taper, no audible click per Pitfall #4).
    if (this.alarmRampGain && this.ac) {
      fadeOutGain(this.alarmRampGain, this.ac);
      this.alarmRampGain = null;
    }
  }
}
