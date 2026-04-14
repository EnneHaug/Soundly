import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AlarmEngine } from '../AlarmEngine';
import { DEFAULT_CONFIG, AlarmConfig } from '../AlarmState';

// Mock all audio dependencies
vi.mock('../AudioContext', () => ({
  getAudioContext: vi.fn().mockResolvedValue({
    currentTime: 0,
    destination: {},
    state: 'running',
  } as unknown as AudioContext),
}));

vi.mock('../sounds/singingBowl', () => ({
  strikeBowl: vi.fn(),
}));

vi.mock('../sounds/phase3Tone', () => ({
  createPhase3Ramp: vi.fn().mockReturnValue({
    gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
    connect: vi.fn(),
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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
});
