import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { strikeTriangle } from '../triangle';

/**
 * Constructor-stub test pattern (mirrors singingBowl.test.ts:48-88, simplified
 * for single-osc + single-gain assertions).
 *
 * Why stubGlobal (not vi.mock): OscillatorNode and GainNode are global
 * constructors in the Web Audio API, not module exports. We capture every
 * instance constructed inside strikeTriangle so tests can assert on the
 * envelope params per Phase 7 D-05.
 */

const mockOscillatorInstances: Array<{
  type: string;
  frequency: number;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}> = [];

const mockGainInstances: Array<{
  gain: {
    setValueAtTime: ReturnType<typeof vi.fn>;
    linearRampToValueAtTime: ReturnType<typeof vi.fn>;
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  };
  connect: ReturnType<typeof vi.fn>;
  _initialGain: number;
}> = [];

function makeGainParamMock() {
  return {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
}

function buildMockAudioContext() {
  mockOscillatorInstances.length = 0;
  mockGainInstances.length = 0;

  vi.stubGlobal(
    'OscillatorNode',
    vi.fn().mockImplementation((_ac: unknown, options: { type: string; frequency: number }) => {
      const instance = {
        type: options.type,
        frequency: options.frequency,
        connect: vi.fn().mockReturnThis(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      mockOscillatorInstances.push(instance);
      return instance;
    }),
  );

  vi.stubGlobal(
    'GainNode',
    vi.fn().mockImplementation((_ac: unknown, options: { gain: number }) => {
      const instance = {
        gain: makeGainParamMock(),
        connect: vi.fn().mockReturnThis(),
        _initialGain: options.gain,
      };
      mockGainInstances.push(instance);
      return instance;
    }),
  );

  return { currentTime: 0, destination: {} } as unknown as AudioContext;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('strikeTriangle', () => {
  it('is exported as a function', () => {
    expect(typeof strikeTriangle).toBe('function');
  });

  it('creates exactly 1 OscillatorNode per strike', () => {
    const ac = buildMockAudioContext();
    strikeTriangle(ac);
    expect(mockOscillatorInstances).toHaveLength(1);
  });

  it('sets frequency to F7 (2793.83 Hz)', () => {
    const ac = buildMockAudioContext();
    strikeTriangle(ac);
    expect(mockOscillatorInstances[0].frequency).toBe(2793.83);
  });

  it('uses sine wave type', () => {
    const ac = buildMockAudioContext();
    strikeTriangle(ac);
    expect(mockOscillatorInstances[0].type).toBe('sine');
  });

  it('creates exactly 1 GainNode initialized at gain 0', () => {
    const ac = buildMockAudioContext();
    strikeTriangle(ac);
    expect(mockGainInstances).toHaveLength(1);
    expect(mockGainInstances[0]._initialGain).toBe(0);
  });

  it('applies 8 ms linear attack to peak 0.4 * masterGain (default 1.0)', () => {
    const ac = buildMockAudioContext();
    strikeTriangle(ac);
    const calls = mockGainInstances[0].gain.linearRampToValueAtTime.mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe(0.4); // 0.4 * 1.0 default masterGain
    expect(calls[0][1]).toBe(0.008); // t (=0) + 8 ms
  });

  it('uses exponential decay to 0.001 (never to 0) over 2.0 s', () => {
    const ac = buildMockAudioContext();
    strikeTriangle(ac);
    const calls = mockGainInstances[0].gain.exponentialRampToValueAtTime.mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe(0.001);
    expect(calls[0][0]).not.toBe(0);
    expect(calls[0][1]).toBe(2.0);
  });

  it('starts at t and stops at t + 2.1 (cleanly past decay)', () => {
    const ac = buildMockAudioContext();
    strikeTriangle(ac);
    expect(mockOscillatorInstances[0].start).toHaveBeenCalledWith(0);
    expect(mockOscillatorInstances[0].stop).toHaveBeenCalledWith(2.1);
  });

  it('scales peak gain linearly with masterGain', () => {
    const ac = buildMockAudioContext();
    strikeTriangle(ac, 0.5);
    const calls = mockGainInstances[0].gain.linearRampToValueAtTime.mock.calls;
    expect(calls[0][0]).toBe(0.2); // 0.4 * 0.5 = 0.2
  });
});
