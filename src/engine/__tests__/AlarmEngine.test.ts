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

  it('QUICK_NAP_CONFIG has phase1DurationMs = 60_000', () => {
    expect(QUICK_NAP_CONFIG.phase1DurationMs).toBe(60_000);
  });

  it('FOCUS_CONFIG has phase1DurationMs = 60_000', () => {
    expect(FOCUS_CONFIG.phase1DurationMs).toBe(60_000);
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
});
