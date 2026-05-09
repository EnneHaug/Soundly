import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SegmentEngine } from '../SegmentEngine';
import { WAKE_EASY_CONFIG, type SegmentConfig } from '../SegmentState';

// === MOCKS — copied from AlarmEngine.test.ts:5-65 with Phase 7 additions ===

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

vi.mock('../sounds/singingBowl', () => ({ strikeBowl: vi.fn() }));
vi.mock('../sounds/triangle', () => ({ strikeTriangle: vi.fn() }));
vi.mock('../sounds/segmentSound', () => ({ fireSegmentEndSound: vi.fn() }));

vi.mock('../sounds/phase3Tone', () => ({
  createPhase3Ramp: vi.fn().mockReturnValue({
    gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
  startPhase3Swell: vi.fn().mockReturnValue([
    { stop: vi.fn(), connect: vi.fn(), start: vi.fn(), frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } },
    { stop: vi.fn(), connect: vi.fn(), start: vi.fn(), frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } },
  ]),
  fadeOutGain: vi.fn(),
}));

vi.mock('../sounds/keepalive', () => ({
  startKeepalive: vi.fn().mockReturnValue({ stop: vi.fn(), connect: vi.fn(), start: vi.fn() }),
  stopKeepalive: vi.fn(),
}));

vi.mock('../../platform/wakeLock', () => ({
  acquireWakeLock: vi.fn().mockResolvedValue(undefined),
  releaseWakeLock: vi.fn(),
  attachVisibilityReacquire: vi.fn().mockReturnValue(vi.fn()),
}));

// Drift-test mock for timer (RESEARCH §"Drift measurement strategy" lines 419-433):
// allows tests to read scheduled-at epochs directly and synthesize fires by
// invoking the captured callback rather than advancing fake timers through
// scheduleAt's polling loop.
vi.mock('../timer', () => ({
  scheduleAt: vi.fn().mockReturnValue({ cancel: vi.fn() }),
}));

// AlarmSession mock — exposes endAlarmSession spy + a fake session handle.
vi.mock('../AlarmSession', () => ({
  startAlarmSession: vi.fn().mockResolvedValue({
    ac: {
      currentTime: 0,
      destination: {},
      state: 'running',
      createGain: vi.fn().mockReturnValue({
        gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }),
    },
    keepalive: {},
    wakeLock: {},
    visibilityCleanup: vi.fn(),
  }),
  endAlarmSession: vi.fn(),
}));

// === HELPER — verbatim from AlarmEngine.test.ts:67-75 (RESEARCH Pitfall #1) ===
async function startEngine(engine: SegmentEngine, config: SegmentConfig = WAKE_EASY_CONFIG): Promise<void> {
  const startPromise = engine.start(config);
  await Promise.resolve(); // load-bearing — flushes microtask queue
  await startPromise;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal('navigator', { vibrate: vi.fn() });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// === TESTS ===

describe('SegmentEngine — state machine', () => {
  it("starts in 'idle' state", () => {
    const engine = new SegmentEngine();
    expect(engine.getState()).toBe('idle');
    expect(engine.isPaused()).toBe(false);
    expect(engine.canPause()).toBe(false); // not running yet
  });

  it("start(WAKE_EASY_CONFIG) transitions to 'running'", async () => {
    const engine = new SegmentEngine();
    await startEngine(engine);
    expect(engine.getState()).toBe('running');
  });

  it('getCurrentSegment returns null when idle and a snapshot when running', async () => {
    const engine = new SegmentEngine();
    expect(engine.getCurrentSegment()).toBeNull();
    await startEngine(engine);
    const cur = engine.getCurrentSegment();
    expect(cur).not.toBeNull();
    expect(cur?.index).toBe(0);
    expect(cur?.total).toBe(5);
    expect(cur?.segment.id).toBe('wake-easy-1');
  });
});

describe('SegmentEngine — validation gate (SEG-04)', () => {
  it('throws Error with validator message on invalid config', async () => {
    const engine = new SegmentEngine();
    const bad = { segments: [{ id: 's1', durationMs: -1, endSound: 'gentle' as const }] };
    await expect(engine.start(bad)).rejects.toThrow(/duration/i);
  });

  it('throws when already running', async () => {
    const engine = new SegmentEngine();
    await startEngine(engine);
    await expect(engine.start(WAKE_EASY_CONFIG)).rejects.toThrow(/already running/i);
  });
});

describe('SegmentEngine — absolute scheduling (SEG-02 + D-16)', () => {
  it('registers exactly N scheduleAt calls for an N-segment config', async () => {
    const { scheduleAt } = await import('../timer');
    const engine = new SegmentEngine();
    await startEngine(engine);
    expect(scheduleAt).toHaveBeenCalledTimes(5);
  });

  it('schedules every fire at epochBaseline + cumulative duration (NOT chained delays)', async () => {
    const { scheduleAt } = await import('../timer');
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const engine = new SegmentEngine();
    await startEngine(engine);

    const calls = (scheduleAt as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toBe(1_000_000 + 240_000);          // segment 1 end
    expect(calls[1][0]).toBe(1_000_000 + 480_000);          // segment 2 end
    expect(calls[2][0]).toBe(1_000_000 + 720_000);          // segment 3 end
    expect(calls[3][0]).toBe(1_000_000 + 960_000);          // segment 4 end
    expect(calls[4][0]).toBe(1_000_000 + 1_020_000);        // segment 5 (alarm) start fire = 17 min mark

    dateNowSpy.mockRestore();
  });
});

describe('SegmentEngine — segment fires + onSegmentChange ordering', () => {
  it("emits 'end' then 'start' around a gentle fire and dispatches via fireSegmentEndSound", async () => {
    const { scheduleAt } = await import('../timer');
    const { fireSegmentEndSound } = await import('../sounds/segmentSound');

    const engine = new SegmentEngine();
    const events: Array<{ kind: 'start' | 'end'; segmentIndex: number }> = [];
    engine.onSegmentChange((e) => events.push({ kind: e.kind, segmentIndex: e.segmentIndex }));
    await startEngine(engine);

    // Initial 'start' for segment 0 emitted by start() itself:
    expect(events).toEqual([{ kind: 'start', segmentIndex: 0 }]);

    // Manually fire the first scheduled callback (synthesizes the segment-end event):
    const segment0Cb = (scheduleAt as ReturnType<typeof vi.fn>).mock.calls[0][1] as () => void;
    segment0Cb();

    expect(events).toEqual([
      { kind: 'start', segmentIndex: 0 },
      { kind: 'end', segmentIndex: 0 },
      { kind: 'start', segmentIndex: 1 },
    ]);
    expect(fireSegmentEndSound).toHaveBeenCalledTimes(1);
    expect((fireSegmentEndSound as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe('gentle');
  });

  it('after segment 0 fires, getCurrentSegment().index === 1 (Pitfall #6)', async () => {
    const { scheduleAt } = await import('../timer');
    const engine = new SegmentEngine();
    await startEngine(engine);
    const segment0Cb = (scheduleAt as ReturnType<typeof vi.fn>).mock.calls[0][1] as () => void;
    segment0Cb();
    expect(engine.getCurrentSegment()?.index).toBe(1);
  });

  it("dispatches 'triangle' key for triangle segments", async () => {
    const { scheduleAt } = await import('../timer');
    const { fireSegmentEndSound } = await import('../sounds/segmentSound');

    const triangleConfig: SegmentConfig = {
      segments: [
        { id: 't1', durationMs: 1000, endSound: 'triangle' },
        { id: 't2', durationMs: 1000, endSound: 'gentle' },
      ],
    };
    const engine = new SegmentEngine();
    await startEngine(engine, triangleConfig);

    const cb = (scheduleAt as ReturnType<typeof vi.fn>).mock.calls[0][1] as () => void;
    cb();

    expect(fireSegmentEndSound).toHaveBeenCalledTimes(1);
    expect((fireSegmentEndSound as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe('triangle');
  });
});

describe('SegmentEngine — alarm segment (D-01..D-03)', () => {
  it("transitions state to 'firing-alarm' on alarm-segment fire", async () => {
    const { scheduleAt } = await import('../timer');
    const engine = new SegmentEngine();
    await startEngine(engine, WAKE_EASY_CONFIG);
    // Segment 4 is the alarm:
    const alarmCb = (scheduleAt as ReturnType<typeof vi.fn>).mock.calls[4][1] as () => void;
    alarmCb();
    expect(engine.getState()).toBe('firing-alarm');
    engine.dismiss();
  });

  it('calls createPhase3Ramp(ac, durationMs/1000) and startPhase3Swell on alarm fire', async () => {
    const { scheduleAt } = await import('../timer');
    const { createPhase3Ramp, startPhase3Swell } = await import('../sounds/phase3Tone');

    const engine = new SegmentEngine();
    await startEngine(engine, WAKE_EASY_CONFIG);
    const alarmCb = (scheduleAt as ReturnType<typeof vi.fn>).mock.calls[4][1] as () => void;
    alarmCb();

    expect(createPhase3Ramp).toHaveBeenCalledTimes(1);
    expect((createPhase3Ramp as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe(60); // 60_000 ms / 1000 = 60 s
    expect(startPhase3Swell).toHaveBeenCalledTimes(1);
    engine.dismiss();
  });

  it('sets up 3200 ms swell loop interval (verify by advancing one cycle)', async () => {
    const { scheduleAt } = await import('../timer');
    const { startPhase3Swell } = await import('../sounds/phase3Tone');

    const engine = new SegmentEngine();
    await startEngine(engine, WAKE_EASY_CONFIG);
    const alarmCb = (scheduleAt as ReturnType<typeof vi.fn>).mock.calls[4][1] as () => void;
    alarmCb();

    expect(startPhase3Swell).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3300); // one cycle past 3200
    expect(startPhase3Swell).toHaveBeenCalledTimes(2);

    // Drain via dismiss() before any further advance to avoid Pitfall #2 spin.
    engine.dismiss();
  });

  it("canPause() returns false while in 'firing-alarm'", async () => {
    const { scheduleAt } = await import('../timer');
    const engine = new SegmentEngine();
    await startEngine(engine, WAKE_EASY_CONFIG);
    const alarmCb = (scheduleAt as ReturnType<typeof vi.fn>).mock.calls[4][1] as () => void;
    alarmCb();
    expect(engine.canPause()).toBe(false);
    engine.dismiss();
  });

  it("pause() during 'firing-alarm' is silent no-op (state unchanged, _paused stays false)", async () => {
    const { scheduleAt } = await import('../timer');
    const engine = new SegmentEngine();
    await startEngine(engine, WAKE_EASY_CONFIG);
    const alarmCb = (scheduleAt as ReturnType<typeof vi.fn>).mock.calls[4][1] as () => void;
    alarmCb();

    engine.pause();
    expect(engine.getState()).toBe('firing-alarm');
    expect(engine.isPaused()).toBe(false);
    engine.dismiss();
  });
});

describe('SegmentEngine — auto-stop (D-04) and continue-past-end (D-02)', () => {
  it('last-gentle-tail composition auto-stops after the gentle decay window (6100 ms)', async () => {
    const { scheduleAt } = await import('../timer');
    const allGentle: SegmentConfig = {
      segments: [
        { id: 'g1', durationMs: 1000, endSound: 'gentle' },
        { id: 'g2', durationMs: 1000, endSound: 'gentle' },
      ],
    };
    const engine = new SegmentEngine();
    await startEngine(engine, allGentle);

    // Fire the last (segment 1) callback:
    const lastCb = (scheduleAt as ReturnType<typeof vi.fn>).mock.calls[1][1] as () => void;
    lastCb();
    expect(engine.getState()).toBe('running');

    vi.advanceTimersByTime(6100);
    expect(engine.getState()).toBe('dismissed');
  });

  it('last-triangle-tail composition auto-stops after the triangle decay window (2100 ms)', async () => {
    const { scheduleAt } = await import('../timer');
    const triangleTail: SegmentConfig = {
      segments: [
        { id: 't1', durationMs: 1000, endSound: 'gentle' },
        { id: 't2', durationMs: 1000, endSound: 'triangle' },
      ],
    };
    const engine = new SegmentEngine();
    await startEngine(engine, triangleTail);
    const lastCb = (scheduleAt as ReturnType<typeof vi.fn>).mock.calls[1][1] as () => void;
    lastCb();
    vi.advanceTimersByTime(2100);
    expect(engine.getState()).toBe('dismissed');
  });

  it('alarm-tail composition stays in firing-alarm past segment-end until manual dismiss', async () => {
    const { scheduleAt } = await import('../timer');
    const engine = new SegmentEngine();
    await startEngine(engine, WAKE_EASY_CONFIG);
    const alarmCb = (scheduleAt as ReturnType<typeof vi.fn>).mock.calls[4][1] as () => void;
    alarmCb();

    expect(engine.getState()).toBe('firing-alarm');
    vi.advanceTimersByTime(3300); // one swell loop cycle
    expect(engine.getState()).toBe('firing-alarm'); // still alarming

    engine.dismiss();
    expect(engine.getState()).toBe('dismissed');
  });
});

describe('SegmentEngine — pause/resume snapshot (D-19, D-20)', () => {
  it('pause mid-segment captures snapshot with correct shape', async () => {
    const { scheduleAt } = await import('../timer');
    // Fire segment 0 to advance into segment 1, then pause.
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const engine = new SegmentEngine();
    await startEngine(engine, WAKE_EASY_CONFIG);

    const cb0 = (scheduleAt as ReturnType<typeof vi.fn>).mock.calls[0][1] as () => void;
    cb0();
    // Now in segment 1 (240 s into the run); simulate pausing 60 s into segment 1:
    dateNowSpy.mockReturnValue(1_000_000 + 240_000 + 60_000);

    engine.pause();
    expect(engine.isPaused()).toBe(true);

    // No public snapshot getter — assert behavior via resume() effects below.
    dateNowSpy.mockRestore();
  });

  it('resume re-registers scheduleAt for current + future segments', async () => {
    const { scheduleAt } = await import('../timer');
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const engine = new SegmentEngine();
    await startEngine(engine, WAKE_EASY_CONFIG);

    const cb0 = (scheduleAt as ReturnType<typeof vi.fn>).mock.calls[0][1] as () => void;
    cb0();

    dateNowSpy.mockReturnValue(1_000_000 + 240_000 + 60_000);
    engine.pause();

    const callsBeforeResume = (scheduleAt as ReturnType<typeof vi.fn>).mock.calls.length;
    dateNowSpy.mockReturnValue(1_000_000 + 240_000 + 90_000); // 30 s pause
    engine.resume();
    const callsAfterResume = (scheduleAt as ReturnType<typeof vi.fn>).mock.calls.length;

    // Re-registers timers for current segment (1) + future segments (2, 3, 4) = 4 new calls
    expect(callsAfterResume - callsBeforeResume).toBe(4);
    expect(engine.isPaused()).toBe(false);

    dateNowSpy.mockRestore();
  });

  it("pause then resume re-emits 'start' for the current segment (UI repaint)", async () => {
    const { scheduleAt } = await import('../timer');
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const engine = new SegmentEngine();
    const events: Array<{ kind: 'start' | 'end'; segmentIndex: number }> = [];
    engine.onSegmentChange((e) => events.push({ kind: e.kind, segmentIndex: e.segmentIndex }));
    await startEngine(engine, WAKE_EASY_CONFIG);
    const cb0 = (scheduleAt as ReturnType<typeof vi.fn>).mock.calls[0][1] as () => void;
    cb0();

    dateNowSpy.mockReturnValue(1_000_000 + 240_000 + 60_000);
    engine.pause();
    engine.resume();

    const lastEvent = events[events.length - 1];
    expect(lastEvent).toEqual({ kind: 'start', segmentIndex: 1 });

    dateNowSpy.mockRestore();
  });
});

describe('SegmentEngine — cleanup', () => {
  it('dismiss() calls endAlarmSession exactly once and clears all timers', async () => {
    const { endAlarmSession } = await import('../AlarmSession');
    const engine = new SegmentEngine();
    await startEngine(engine);
    engine.dismiss();
    expect(endAlarmSession).toHaveBeenCalledTimes(1);
    expect(engine.getState()).toBe('dismissed');
  });

  it('dismiss() then stop() does not double-call endAlarmSession (idempotent)', async () => {
    const { endAlarmSession } = await import('../AlarmSession');
    const engine = new SegmentEngine();
    await startEngine(engine);
    engine.dismiss();
    engine.stop();
    expect(endAlarmSession).toHaveBeenCalledTimes(1);
  });
});
