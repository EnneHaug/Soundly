import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AlarmEngine } from '../AlarmEngine';
import { DEFAULT_CONFIG, AlarmConfig, QUICK_NAP_CONFIG, FOCUS_CONFIG, validateConfig } from '../AlarmState';

// Mock all audio dependencies
vi.mock('../AudioContext', () => ({
  getAudioContext: vi.fn().mockResolvedValue({
    currentTime: 0,
    destination: {},
    state: 'running',
    createGain: vi.fn().mockReturnValue({
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        setTargetAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
  } as unknown as AudioContext),
}));

vi.mock('../sounds/singingBowl', () => ({
  strikeBowl: vi.fn(),
}));

vi.mock('../sounds/phase3Tone', () => ({
  createPhase3Ramp: vi.fn().mockReturnValue({
    gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
  startPhase3Swell: vi.fn().mockReturnValue({
    stop: vi.fn(),
    connect: vi.fn(),
    frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    start: vi.fn(),
  }),
  fadeOutGain: vi.fn(),
}));

vi.mock('../sounds/keepalive', () => ({
  startKeepalive: vi.fn().mockReturnValue({
    stop: vi.fn(),
    connect: vi.fn(),
    start: vi.fn(),
  }),
  stopKeepalive: vi.fn(),
}));

vi.mock('../sounds/tickPulse', () => ({
  playTick: vi.fn(),
}));

vi.mock('../../platform/wakeLock', () => ({
  acquireWakeLock: vi.fn().mockResolvedValue(undefined),
  releaseWakeLock: vi.fn(),
  attachVisibilityReacquire: vi.fn().mockReturnValue(vi.fn()), // returns cleanup fn
}));

vi.mock('../../platform/vibration', () => ({
  startVibration: vi.fn(),
  stopVibration: vi.fn(),
}));

/**
 * Helper: start the engine and flush async operations (getAudioContext promise).
 * Uses vi.runAllTimersAsync() which flushes both timers and microtasks.
 */
async function startEngine(engine: AlarmEngine, config = DEFAULT_CONFIG): Promise<void> {
  const startPromise = engine.start(config);
  // Flush the microtask queue so the getAudioContext promise resolves
  await Promise.resolve();
  await startPromise;
}

describe('AlarmEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.stubGlobal('navigator', { vibrate: vi.fn() }); // default: vibrate supported
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // ---- Existing tests ----

  it('getPhase() returns idle initially', () => {
    const engine = new AlarmEngine();
    expect(engine.getPhase()).toBe('idle');
  });

  it('start() throws if called when not idle', async () => {
    const engine = new AlarmEngine();
    await startEngine(engine);

    // calling start again should throw
    await expect(engine.start(DEFAULT_CONFIG)).rejects.toThrow('AlarmEngine already running');
  });

  it('start() throws on invalid config (negative duration)', async () => {
    const engine = new AlarmEngine();
    const badConfig: AlarmConfig = { ...DEFAULT_CONFIG, phase1DurationMs: -1 };
    await expect(engine.start(badConfig)).rejects.toThrow();
  });

  it('start() starts keepalive oscillator', async () => {
    const { startKeepalive } = await import('../sounds/keepalive');
    const engine = new AlarmEngine();

    await startEngine(engine);

    expect(startKeepalive).toHaveBeenCalledTimes(1);
  });

  it('onPhaseChange callback fires with phase1 when phase1 timer fires', async () => {
    const engine = new AlarmEngine();
    const callback = vi.fn();
    engine.onPhaseChange(callback);

    await startEngine(engine);

    // Advance to phase1 fire time
    vi.advanceTimersByTime(DEFAULT_CONFIG.phase1DurationMs + 300);

    expect(callback).toHaveBeenCalledWith('phase1');
  });

  it('onPhaseChange callback fires with phase2 when phase2 timer fires', async () => {
    const engine = new AlarmEngine();
    const callback = vi.fn();
    engine.onPhaseChange(callback);

    await startEngine(engine);

    // Advance to phase2 fire time (phase1 + phase2 duration)
    const phase2Time = DEFAULT_CONFIG.phase1DurationMs + DEFAULT_CONFIG.phase2DurationMs + 600;
    vi.advanceTimersByTime(phase2Time);

    expect(callback).toHaveBeenCalledWith('phase2');
  });

  it('onPhaseChange callback fires with phase3 when phase3 timer fires', async () => {
    const engine = new AlarmEngine();
    const callback = vi.fn();
    engine.onPhaseChange(callback);

    await startEngine(engine);

    // Advance to phase3 fire time (phase1 + phase2 duration + gap)
    const phase3Time =
      DEFAULT_CONFIG.phase1DurationMs +
      DEFAULT_CONFIG.phase2DurationMs +
      DEFAULT_CONFIG.phase2to3GapMs +
      900;
    vi.advanceTimersByTime(phase3Time);

    expect(callback).toHaveBeenCalledWith('phase3');
  });

  it('phase transitions happen in correct order: phase1 -> phase2 -> phase3', async () => {
    const engine = new AlarmEngine();
    const phases: string[] = [];
    engine.onPhaseChange((phase) => phases.push(phase));

    await startEngine(engine);

    // Advance through all phases
    const totalTime =
      DEFAULT_CONFIG.phase1DurationMs +
      DEFAULT_CONFIG.phase2DurationMs +
      DEFAULT_CONFIG.phase2to3GapMs +
      900;
    vi.advanceTimersByTime(totalTime);

    expect(phases[0]).toBe('phase1');
    expect(phases[1]).toBe('phase2');
    expect(phases[2]).toBe('phase3');
  });

  it('stop() returns phase to idle and cancels timers', async () => {
    const engine = new AlarmEngine();
    const callback = vi.fn();
    engine.onPhaseChange(callback);

    await startEngine(engine);

    engine.stop();
    expect(engine.getPhase()).toBe('idle');

    // Advance timers — no more phase callbacks should fire
    callback.mockClear();
    vi.advanceTimersByTime(
      DEFAULT_CONFIG.phase1DurationMs +
        DEFAULT_CONFIG.phase2DurationMs +
        DEFAULT_CONFIG.phase2to3GapMs +
        900
    );
    expect(callback).not.toHaveBeenCalled();
  });

  it('dismiss() sets phase to dismissed', async () => {
    const engine = new AlarmEngine();

    await startEngine(engine);

    engine.dismiss();
    expect(engine.getPhase()).toBe('dismissed');
  });

  it('stop() calls stopKeepalive to clean up audio', async () => {
    const { stopKeepalive } = await import('../sounds/keepalive');
    const engine = new AlarmEngine();

    await startEngine(engine);

    engine.stop();
    expect(stopKeepalive).toHaveBeenCalledTimes(1);
  });

  // ---- New Phase 2 + Wake Lock tests ----

  it('start() calls acquireWakeLock', async () => {
    const { acquireWakeLock } = await import('../../platform/wakeLock');
    const engine = new AlarmEngine();

    await startEngine(engine);

    expect(acquireWakeLock).toHaveBeenCalledTimes(1);
  });

  it('start() calls attachVisibilityReacquire', async () => {
    const { attachVisibilityReacquire } = await import('../../platform/wakeLock');
    const engine = new AlarmEngine();

    await startEngine(engine);

    expect(attachVisibilityReacquire).toHaveBeenCalledTimes(1);
  });

  it('stop() calls releaseWakeLock', async () => {
    const { releaseWakeLock } = await import('../../platform/wakeLock');
    const engine = new AlarmEngine();

    await startEngine(engine);
    engine.stop();

    expect(releaseWakeLock).toHaveBeenCalledTimes(1);
  });

  it('Phase 2 transition calls startVibration when navigator.vibrate is available', async () => {
    const { startVibration } = await import('../../platform/vibration');
    vi.stubGlobal('navigator', { vibrate: vi.fn() }); // vibrate supported

    const engine = new AlarmEngine();
    await startEngine(engine);

    // Advance to Phase 2
    const phase2Time = DEFAULT_CONFIG.phase1DurationMs + DEFAULT_CONFIG.phase2DurationMs + 600;
    vi.advanceTimersByTime(phase2Time);

    expect(startVibration).toHaveBeenCalledTimes(1);
  });

  it('Phase 2 transition starts tick loop when navigator.vibrate is NOT available', async () => {
    const { playTick } = await import('../sounds/tickPulse');
    vi.stubGlobal('navigator', {}); // no vibrate — iOS/desktop

    const engine = new AlarmEngine();
    await startEngine(engine);

    // Advance to Phase 2
    const phase2Time = DEFAULT_CONFIG.phase1DurationMs + DEFAULT_CONFIG.phase2DurationMs + 600;
    vi.advanceTimersByTime(phase2Time);

    // playTick should have been called at least once (first tick + interval)
    expect(playTick).toHaveBeenCalled();
  });

  it('stop() during Phase 2 calls stopVibration', async () => {
    const { stopVibration } = await import('../../platform/vibration');
    vi.stubGlobal('navigator', { vibrate: vi.fn() });

    const engine = new AlarmEngine();
    await startEngine(engine);

    // Advance to Phase 2
    const phase2Time = DEFAULT_CONFIG.phase1DurationMs + DEFAULT_CONFIG.phase2DurationMs + 600;
    vi.advanceTimersByTime(phase2Time);

    engine.stop();

    expect(stopVibration).toHaveBeenCalled();
  });

  it('stop() during Phase 2 tick loop clears the tick interval (no vibrate env)', async () => {
    const { playTick } = await import('../sounds/tickPulse');
    vi.stubGlobal('navigator', {}); // no vibrate

    const engine = new AlarmEngine();
    await startEngine(engine);

    // Advance to Phase 2
    const phase2Time = DEFAULT_CONFIG.phase1DurationMs + DEFAULT_CONFIG.phase2DurationMs + 600;
    vi.advanceTimersByTime(phase2Time);

    const callsAtStop = (playTick as ReturnType<typeof vi.fn>).mock.calls.length;
    engine.stop();

    // Advance more time — tick interval should be cleared, no more calls
    vi.advanceTimersByTime(2000);
    expect((playTick as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsAtStop);
  });

  // ---- Preset config tests ----

  it('QUICK_NAP_CONFIG passes validateConfig()', () => {
    expect(() => validateConfig(QUICK_NAP_CONFIG)).not.toThrow();
  });

  it('FOCUS_CONFIG passes validateConfig()', () => {
    expect(() => validateConfig(FOCUS_CONFIG)).not.toThrow();
  });

  it('QUICK_NAP_CONFIG has phase1DurationMs = 300_000', () => {
    expect(QUICK_NAP_CONFIG.phase1DurationMs).toBe(300_000);
  });

  it('FOCUS_CONFIG has phase1DurationMs = 1_260_000', () => {
    expect(FOCUS_CONFIG.phase1DurationMs).toBe(1_260_000);
  });

  // ---- pause/resume tests ----

  it('pause() on a running engine sets isPaused() to true', async () => {
    const engine = new AlarmEngine();
    await startEngine(engine);

    engine.pause();
    expect(engine.isPaused()).toBe(true);
  });

  it('resume() after pause sets isPaused() to false', async () => {
    const engine = new AlarmEngine();
    await startEngine(engine);

    engine.pause();
    engine.resume();
    expect(engine.isPaused()).toBe(false);
  });

  it('pause() on a non-running engine is a no-op (does not throw)', () => {
    const engine = new AlarmEngine();
    expect(() => engine.pause()).not.toThrow();
    expect(engine.isPaused()).toBe(false);
  });

  it('resume() on a non-paused engine is a no-op (does not throw)', async () => {
    const engine = new AlarmEngine();
    await startEngine(engine);

    expect(() => engine.resume()).not.toThrow();
    expect(engine.isPaused()).toBe(false);
  });

  it('pause() cancels pending timers (timers array is emptied via no more callbacks)', async () => {
    const engine = new AlarmEngine();
    const callback = vi.fn();
    engine.onPhaseChange(callback);
    await startEngine(engine);

    engine.pause();

    // Advance past all phase times — no callbacks should fire since timers were cancelled
    vi.advanceTimersByTime(
      DEFAULT_CONFIG.phase1DurationMs +
        DEFAULT_CONFIG.phase2DurationMs +
        DEFAULT_CONFIG.phase2to3GapMs +
        900
    );

    expect(callback).not.toHaveBeenCalled();
  });

  it('resume() re-registers timers — phase1 fires after remaining duration', async () => {
    const engine = new AlarmEngine();
    const callback = vi.fn();
    engine.onPhaseChange(callback);
    await startEngine(engine);

    // Advance halfway through phase1 countdown
    const halfPhase1 = DEFAULT_CONFIG.phase1DurationMs / 2;
    vi.advanceTimersByTime(halfPhase1);

    engine.pause();
    engine.resume();

    // Advance the remaining half — phase1 should fire
    vi.advanceTimersByTime(halfPhase1 + 300);

    expect(callback).toHaveBeenCalledWith('phase1');
  });

  it('stop() after pause works without errors', async () => {
    const engine = new AlarmEngine();
    await startEngine(engine);

    engine.pause();
    expect(() => engine.stop()).not.toThrow();
    expect(engine.getPhase()).toBe('idle');
  });

  // ============================================================================
  // Phase 6 Plan 2 — AlarmSession wiring + v1 byte-identity regression net.
  //
  // These tests prove that AlarmEngine.start() / cleanup() now delegate the
  // four session-lifecycle responsibilities to AlarmSession (Plan 1 module)
  // WITHOUT changing observable behavior. Per D-07 primary, the existing
  // ~29 tests above are preserved verbatim as the SEG-05 regression net;
  // these appended tests strengthen it across QUICK_NAP_CONFIG / FOCUS_CONFIG
  // end-to-end and pause/resume from each entry phase.
  //
  // Reuses the existing vi.mock(...) blocks at the top of the file —
  // AlarmSession's deps (../sounds/keepalive, ../../platform/wakeLock) are
  // already mocked since AlarmEngine used to call them directly.
  // ============================================================================

  // ---- AlarmSession wiring (proven via existing keepalive/wakeLock mocks) ----

  it('start() drives keepalive, wake lock, and visibility re-acquire via AlarmSession', async () => {
    const { startKeepalive } = await import('../sounds/keepalive');
    const { acquireWakeLock, attachVisibilityReacquire } = await import('../../platform/wakeLock');
    const engine = new AlarmEngine();

    await startEngine(engine);

    // Each underlying primitive should still be called exactly once — proves AlarmSession
    // is doing the work and AlarmEngine is calling AlarmSession exactly once.
    expect(startKeepalive).toHaveBeenCalledTimes(1);
    expect(acquireWakeLock).toHaveBeenCalledTimes(1);
    expect(attachVisibilityReacquire).toHaveBeenCalledTimes(1);
  });

  it('stop() drives stopKeepalive, releaseWakeLock, and the visibility cleanup via AlarmSession', async () => {
    const { stopKeepalive } = await import('../sounds/keepalive');
    const { releaseWakeLock, attachVisibilityReacquire } = await import('../../platform/wakeLock');

    const releaseVisibility = vi.fn();
    (attachVisibilityReacquire as ReturnType<typeof vi.fn>).mockReturnValueOnce(releaseVisibility);

    const engine = new AlarmEngine();
    await startEngine(engine);
    engine.stop();

    expect(stopKeepalive).toHaveBeenCalledTimes(1);
    expect(releaseWakeLock).toHaveBeenCalledTimes(1);
    expect(releaseVisibility).toHaveBeenCalledTimes(1);
  });

  it('dismiss() also drives the full session teardown via AlarmSession', async () => {
    const { stopKeepalive } = await import('../sounds/keepalive');
    const { releaseWakeLock, attachVisibilityReacquire } = await import('../../platform/wakeLock');

    const releaseVisibility = vi.fn();
    (attachVisibilityReacquire as ReturnType<typeof vi.fn>).mockReturnValueOnce(releaseVisibility);

    const engine = new AlarmEngine();
    await startEngine(engine);
    engine.dismiss();

    expect(stopKeepalive).toHaveBeenCalledTimes(1);
    expect(releaseWakeLock).toHaveBeenCalledTimes(1);
    expect(releaseVisibility).toHaveBeenCalledTimes(1);
  });

  it('cleanup() called twice (stop then stop) is idempotent — primitives still called only once', async () => {
    const { stopKeepalive } = await import('../sounds/keepalive');
    const { releaseWakeLock } = await import('../../platform/wakeLock');

    const engine = new AlarmEngine();
    await startEngine(engine);
    engine.stop();
    engine.stop(); // second call: this.session is null, endAlarmSession not invoked again

    expect(stopKeepalive).toHaveBeenCalledTimes(1);
    expect(releaseWakeLock).toHaveBeenCalledTimes(1);
  });

  // ---- v1 byte-identity regression: QUICK_NAP_CONFIG + FOCUS_CONFIG ----

  it('QUICK_NAP_CONFIG fires phase1 -> phase2 -> phase3 in order with correct durations', async () => {
    const engine = new AlarmEngine();
    const phases: string[] = [];
    engine.onPhaseChange((p) => phases.push(p));

    await startEngine(engine, QUICK_NAP_CONFIG);

    // Advance precisely to phase1
    vi.advanceTimersByTime(QUICK_NAP_CONFIG.phase1DurationMs);
    expect(phases[phases.length - 1]).toBe('phase1');

    // Advance to phase2
    vi.advanceTimersByTime(QUICK_NAP_CONFIG.phase2DurationMs);
    expect(phases[phases.length - 1]).toBe('phase2');

    // Advance to phase3
    vi.advanceTimersByTime(QUICK_NAP_CONFIG.phase2to3GapMs);
    expect(phases[phases.length - 1]).toBe('phase3');
  });

  it('FOCUS_CONFIG fires phase1 -> phase2 -> phase3 in order with correct durations', async () => {
    const engine = new AlarmEngine();
    const phases: string[] = [];
    engine.onPhaseChange((p) => phases.push(p));

    await startEngine(engine, FOCUS_CONFIG);

    vi.advanceTimersByTime(FOCUS_CONFIG.phase1DurationMs);
    expect(phases[phases.length - 1]).toBe('phase1');

    vi.advanceTimersByTime(FOCUS_CONFIG.phase2DurationMs);
    expect(phases[phases.length - 1]).toBe('phase2');

    vi.advanceTimersByTime(FOCUS_CONFIG.phase2to3GapMs);
    expect(phases[phases.length - 1]).toBe('phase3');
  });

  it('QUICK_NAP_CONFIG: strikeBowl is invoked exactly once at phase1', async () => {
    const { strikeBowl } = await import('../sounds/singingBowl');
    const engine = new AlarmEngine();
    await startEngine(engine, QUICK_NAP_CONFIG);

    vi.advanceTimersByTime(QUICK_NAP_CONFIG.phase1DurationMs + 1);

    expect(strikeBowl).toHaveBeenCalledTimes(1);
  });

  it('FOCUS_CONFIG: strikeBowl is invoked exactly once at phase1', async () => {
    const { strikeBowl } = await import('../sounds/singingBowl');
    const engine = new AlarmEngine();
    await startEngine(engine, FOCUS_CONFIG);

    vi.advanceTimersByTime(FOCUS_CONFIG.phase1DurationMs + 1);

    expect(strikeBowl).toHaveBeenCalledTimes(1);
  });

  // ---- Pause/resume snapshot from each entry phase (regression for SEG-05) ----

  it('pause/resume from phase1 entry: phase2 still fires after the remaining gap', async () => {
    const engine = new AlarmEngine();
    const phases: string[] = [];
    engine.onPhaseChange((p) => phases.push(p));
    await startEngine(engine, DEFAULT_CONFIG);

    // Advance into phase1
    vi.advanceTimersByTime(DEFAULT_CONFIG.phase1DurationMs + 100);
    expect(phases).toContain('phase1');

    // Pause for 1 second, then resume
    engine.pause();
    vi.advanceTimersByTime(1000);
    engine.resume();

    // Advance the remaining phase2 duration; phase2 should fire
    vi.advanceTimersByTime(DEFAULT_CONFIG.phase2DurationMs + 100);
    expect(phases).toContain('phase2');
  });

  it('pause/resume from phase2 entry: phase3 still fires after the remaining gap', async () => {
    const engine = new AlarmEngine();
    const phases: string[] = [];
    engine.onPhaseChange((p) => phases.push(p));
    vi.stubGlobal('navigator', { vibrate: vi.fn() });
    await startEngine(engine, DEFAULT_CONFIG);

    // Advance to phase2
    vi.advanceTimersByTime(
      DEFAULT_CONFIG.phase1DurationMs + DEFAULT_CONFIG.phase2DurationMs + 100
    );
    expect(phases).toContain('phase2');

    engine.pause();
    vi.advanceTimersByTime(1000);
    engine.resume();

    // Advance the remaining gap; phase3 should fire
    vi.advanceTimersByTime(DEFAULT_CONFIG.phase2to3GapMs + 100);
    expect(phases).toContain('phase3');
  });

  it('pause/resume during phase3 does not throw and engine remains in phase3', async () => {
    // The top-level vi.mock for '../sounds/phase3Tone' returns a single object from
    // startPhase3Swell, but the real source contract returns OscillatorNode[] (see
    // AlarmEngine.ts:202 — "returns an array of 6 oscillators"). The existing tests
    // never drive into phase3 AND then iterate the swell nodes (cleanup() iterates
    // them, but the existing tests stop() before phase3SwellNodes is populated).
    // This new test is the first to do so. Override the mock per-test to return a
    // properly-shaped array — matching the real source contract — using the same
    // mockReturnValue idiom already used elsewhere in this file.
    const { startPhase3Swell } = await import('../sounds/phase3Tone');
    const swellNodes = [
      { stop: vi.fn(), connect: vi.fn(), start: vi.fn(), frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } },
      { stop: vi.fn(), connect: vi.fn(), start: vi.fn(), frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } },
    ];
    (startPhase3Swell as ReturnType<typeof vi.fn>).mockReturnValue(swellNodes);

    const engine = new AlarmEngine();
    vi.stubGlobal('navigator', { vibrate: vi.fn() });
    await startEngine(engine, DEFAULT_CONFIG);

    vi.advanceTimersByTime(
      DEFAULT_CONFIG.phase1DurationMs +
        DEFAULT_CONFIG.phase2DurationMs +
        DEFAULT_CONFIG.phase2to3GapMs +
        100
    );
    expect(engine.getPhase()).toBe('phase3');

    expect(() => engine.pause()).not.toThrow();
    expect(() => engine.resume()).not.toThrow();
    expect(engine.getPhase()).toBe('phase3');
  });
});
