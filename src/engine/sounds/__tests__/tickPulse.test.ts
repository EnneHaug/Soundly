import { describe, it, expect, vi, beforeEach } from 'vitest';
import { playTick } from '../tickPulse';

// ---- Mock infrastructure ----

type AudioBufferSourceNodeMock = {
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  buffer: unknown;
};

type BiquadFilterNodeMock = {
  connect: ReturnType<typeof vi.fn>;
  _type: string;
  _frequency: number;
  _Q: number;
};

type AudioBufferMock = {
  getChannelData: ReturnType<typeof vi.fn>;
  length: number;
  sampleRate: number;
};

type GainNodeMock = {
  connect: ReturnType<typeof vi.fn>;
  gain: { setValueAtTime: ReturnType<typeof vi.fn> };
};

const sourceInstances: AudioBufferSourceNodeMock[] = [];
const filterInstances: BiquadFilterNodeMock[] = [];
const bufferInstances: AudioBufferMock[] = [];

function buildMockAudioContext(sampleRate = 44100): AudioContext {
  sourceInstances.length = 0;
  filterInstances.length = 0;
  bufferInstances.length = 0;

  vi.stubGlobal(
    'AudioBuffer',
    vi.fn().mockImplementation((opts: { length: number; sampleRate: number }) => {
      const data = new Float32Array(opts.length);
      const inst: AudioBufferMock = {
        getChannelData: vi.fn().mockReturnValue(data),
        length: opts.length,
        sampleRate: opts.sampleRate,
      };
      bufferInstances.push(inst);
      return inst;
    })
  );

  vi.stubGlobal(
    'AudioBufferSourceNode',
    vi.fn().mockImplementation((_ac: unknown, opts: { buffer: unknown }) => {
      // connect() will be set up after filter is created, so we use a late-binding approach
      const inst: AudioBufferSourceNodeMock = {
        connect: vi.fn().mockImplementation(() => {
          // Returns the filter instance so .connect(masterGain) is called on filter
          return filterInstances[filterInstances.length - 1] ?? inst;
        }),
        start: vi.fn(),
        buffer: opts.buffer,
      };
      sourceInstances.push(inst);
      return inst;
    })
  );

  vi.stubGlobal(
    'BiquadFilterNode',
    vi.fn().mockImplementation(
      (_ac: unknown, opts: { type: string; frequency: number; Q: number }) => {
        const inst: BiquadFilterNodeMock = {
          connect: vi.fn().mockReturnValue(undefined),
          _type: opts.type,
          _frequency: opts.frequency,
          _Q: opts.Q,
        };
        filterInstances.push(inst);
        return inst;
      }
    )
  );

  return { currentTime: 0, destination: {}, sampleRate } as unknown as AudioContext;
}

function buildMockGainNode(): GainNodeMock {
  return {
    connect: vi.fn().mockReturnThis(),
    gain: { setValueAtTime: vi.fn() },
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('playTick', () => {
  it('is exported as a function', () => {
    expect(typeof playTick).toBe('function');
  });

  it('creates an AudioBuffer with length = ceil(sampleRate * 0.05)', () => {
    const sampleRate = 44100;
    const ac = buildMockAudioContext(sampleRate);
    const masterGain = buildMockGainNode() as unknown as GainNode;

    playTick(ac, masterGain);

    expect(bufferInstances).toHaveLength(1);
    const expectedLength = Math.ceil(sampleRate * 0.05);
    expect(bufferInstances[0].length).toBe(expectedLength);
    expect(bufferInstances[0].sampleRate).toBe(sampleRate);
  });

  it('fills the buffer with white noise data via getChannelData', () => {
    const ac = buildMockAudioContext();
    const masterGain = buildMockGainNode() as unknown as GainNode;

    playTick(ac, masterGain);

    expect(bufferInstances[0].getChannelData).toHaveBeenCalledWith(0);
  });

  it('creates a BiquadFilterNode with type="bandpass"', () => {
    const ac = buildMockAudioContext();
    const masterGain = buildMockGainNode() as unknown as GainNode;

    playTick(ac, masterGain);

    expect(filterInstances).toHaveLength(1);
    expect(filterInstances[0]._type).toBe('bandpass');
  });

  it('uses default bandpass frequency of 2000Hz', () => {
    const ac = buildMockAudioContext();
    const masterGain = buildMockGainNode() as unknown as GainNode;

    playTick(ac, masterGain);

    expect(filterInstances[0]._frequency).toBe(2000);
  });

  it('uses Q=2 for the bandpass filter', () => {
    const ac = buildMockAudioContext();
    const masterGain = buildMockGainNode() as unknown as GainNode;

    playTick(ac, masterGain);

    expect(filterInstances[0]._Q).toBe(2);
  });

  it('accepts a custom bandHz parameter', () => {
    const ac = buildMockAudioContext();
    const masterGain = buildMockGainNode() as unknown as GainNode;

    playTick(ac, masterGain, 3000);

    expect(filterInstances[0]._frequency).toBe(3000);
  });

  it('creates an AudioBufferSourceNode', () => {
    const ac = buildMockAudioContext();
    const masterGain = buildMockGainNode() as unknown as GainNode;

    playTick(ac, masterGain);

    expect(sourceInstances).toHaveLength(1);
  });

  it('connects source → filter → masterGain and calls start()', () => {
    const ac = buildMockAudioContext();
    const masterGain = buildMockGainNode() as unknown as GainNode;

    playTick(ac, masterGain);

    // source.connect returns source (via mockReturnThis), then filter.connect returns filter
    // The chain: source.connect(filter).connect(masterGain)
    expect(sourceInstances[0].connect).toHaveBeenCalledWith(filterInstances[0]);
    expect(filterInstances[0].connect).toHaveBeenCalledWith(masterGain);
    expect(sourceInstances[0].start).toHaveBeenCalledOnce();
  });
});
