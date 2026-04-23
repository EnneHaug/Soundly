import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPhase3Ramp, startPhase3Swell, fadeOutGain } from '../phase3Tone'

// ---- Mock infrastructure ----

type GainParamMock = {
  setValueAtTime: ReturnType<typeof vi.fn>
  linearRampToValueAtTime: ReturnType<typeof vi.fn>
  setTargetAtTime: ReturnType<typeof vi.fn>
  _calls: Array<{ method: string; args: unknown[] }>
}

function makeGainParamMock(): GainParamMock {
  const calls: Array<{ method: string; args: unknown[] }> = []
  return {
    setValueAtTime: vi.fn((...args: unknown[]) => calls.push({ method: 'setValueAtTime', args })),
    linearRampToValueAtTime: vi.fn((...args: unknown[]) =>
      calls.push({ method: 'linearRampToValueAtTime', args }),
    ),
    setTargetAtTime: vi.fn((...args: unknown[]) => calls.push({ method: 'setTargetAtTime', args })),
    _calls: calls,
  }
}

type GainNodeMock = {
  gain: GainParamMock
  connect: ReturnType<typeof vi.fn>
  _initGain: number
}

type OscNodeMock = {
  frequency: GainParamMock
  connect: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  _initFreq: number
  _initType: string
}

type CompressorNodeMock = {
  connect: ReturnType<typeof vi.fn>
  _initOpts: {
    threshold: number
    knee: number
    ratio: number
    attack: number
    release: number
  }
}

const gainNodeInstances: GainNodeMock[] = []
const oscNodeInstances: OscNodeMock[] = []
const compressorNodeInstances: CompressorNodeMock[] = []

function buildMockAudioContext(currentTime = 0): AudioContext {
  gainNodeInstances.length = 0
  oscNodeInstances.length = 0
  compressorNodeInstances.length = 0

  vi.stubGlobal(
    'GainNode',
    vi.fn().mockImplementation((_ac: unknown, opts: { gain?: number }) => {
      const instance: GainNodeMock = {
        gain: makeGainParamMock(),
        connect: vi.fn().mockReturnThis(),
        _initGain: opts?.gain ?? 1,
      }
      gainNodeInstances.push(instance)
      return instance
    }),
  )

  vi.stubGlobal(
    'OscillatorNode',
    vi.fn().mockImplementation(
      (_ac: unknown, options: { type: string; frequency: number }) => {
        const instance: OscNodeMock = {
          frequency: makeGainParamMock(),
          connect: vi.fn().mockReturnThis(),
          start: vi.fn(),
          stop: vi.fn(),
          _initFreq: options.frequency,
          _initType: options.type,
        }
        oscNodeInstances.push(instance)
        return instance
      },
    ),
  )

  vi.stubGlobal(
    'DynamicsCompressorNode',
    vi.fn().mockImplementation(
      (
        _ac: unknown,
        opts: { threshold: number; knee: number; ratio: number; attack: number; release: number },
      ) => {
        const instance: CompressorNodeMock = {
          connect: vi.fn().mockReturnThis(),
          _initOpts: opts,
        }
        compressorNodeInstances.push(instance)
        return instance
      },
    ),
  )

  return { currentTime, destination: { connect: vi.fn() } } as unknown as AudioContext
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

// ---- createPhase3Ramp tests ----

describe('createPhase3Ramp', () => {
  it('is exported as a function', () => {
    expect(typeof createPhase3Ramp).toBe('function')
  })

  it('creates a GainNode and connects it through a DynamicsCompressorNode to destination', () => {
    const ac = buildMockAudioContext()
    createPhase3Ramp(ac, 60)

    // Exactly one GainNode (masterGain) and one DynamicsCompressorNode
    expect(gainNodeInstances).toHaveLength(1)
    expect(compressorNodeInstances).toHaveLength(1)

    // masterGain.connect was called with the compressor instance
    const masterGain = gainNodeInstances[0]
    const compressor = compressorNodeInstances[0]
    expect(masterGain.connect).toHaveBeenCalledWith(compressor)
  })

  it('anchors masterGain.gain with setValueAtTime(0) before linearRampToValueAtTime (pitfall 6)', () => {
    const ac = buildMockAudioContext(5)
    createPhase3Ramp(ac, 60)

    const calls = gainNodeInstances[0].gain._calls
    const setValueIdx = calls.findIndex((c) => c.method === 'setValueAtTime')
    const rampIdx = calls.findIndex((c) => c.method === 'linearRampToValueAtTime')

    expect(setValueIdx).toBeGreaterThanOrEqual(0)
    expect(rampIdx).toBeGreaterThanOrEqual(0)
    expect(setValueIdx).toBeLessThan(rampIdx)
    expect(calls[setValueIdx].args[0]).toBe(0)
  })

  it('ramps masterGain.gain linearly from 0 to 1.0 over durationSec (no values > 1)', () => {
    const currentTime = 10
    const ac = buildMockAudioContext(currentTime)
    createPhase3Ramp(ac, 60)

    const calls = gainNodeInstances[0].gain._calls
    const rampCalls = calls.filter((c) => c.method === 'linearRampToValueAtTime')

    // Exactly one ramp — straight 0 -> 1.0 over durationSec.
    expect(rampCalls).toHaveLength(1)
    expect(rampCalls[0].args[0]).toBe(1.0)
    expect(rampCalls[0].args[1]).toBeCloseTo(currentTime + 60, 5)

    // No legacy overdrive values anywhere.
    const allTargets = calls.map((c) => c.args[0])
    expect(allTargets).not.toContain(3.0)
    expect(allTargets).not.toContain(5.0)
  })

  it('configures the compressor with threshold=-24, knee=12, ratio=12, attack=0.003, release=0.25', () => {
    const ac = buildMockAudioContext()
    createPhase3Ramp(ac, 60)

    expect(compressorNodeInstances).toHaveLength(1)
    const opts = compressorNodeInstances[0]._initOpts
    expect(opts.threshold).toBe(-24)
    expect(opts.knee).toBe(12)
    expect(opts.ratio).toBe(12)
    expect(opts.attack).toBe(0.003)
    expect(opts.release).toBe(0.25)
  })

  it('returns the masterGain GainNode (unchanged signature)', () => {
    const ac = buildMockAudioContext()
    const result = createPhase3Ramp(ac, 60)
    expect(result).toBe(gainNodeInstances[0])
  })
})

// ---- startPhase3Swell tests ----

describe('startPhase3Swell', () => {
  it('is exported as a function', () => {
    expect(typeof startPhase3Swell).toBe('function')
  })

  function buildContextAndMasterGain(currentTime = 0) {
    const ac = buildMockAudioContext(currentTime)
    // createPhase3Ramp would normally create masterGain; simulate a standalone one here.
    const masterGain = {
      gain: makeGainParamMock(),
      connect: vi.fn().mockReturnThis(),
      _initGain: 0,
    }
    // Reset so the Swell test sees only its own instances.
    gainNodeInstances.length = 0
    oscNodeInstances.length = 0
    compressorNodeInstances.length = 0
    return { ac, masterGain: masterGain as unknown as GainNode }
  }

  it('creates 6 oscillators: 3 detuned near 1 kHz, 1 at 2 kHz, 1 at 3 kHz, 1 at 6 Hz LFO', () => {
    const { ac, masterGain } = buildContextAndMasterGain()
    startPhase3Swell(ac, masterGain)
    expect(oscNodeInstances).toHaveLength(6)
  })

  it('primary oscillators start near 1000 Hz (fundamental band), not 80 Hz', () => {
    const { ac, masterGain } = buildContextAndMasterGain()
    startPhase3Swell(ac, masterGain)

    const freqs = oscNodeInstances.map((o) => o._initFreq)
    // At least one detune voice at 1000 Hz exactly.
    expect(freqs).toContain(1000)
    // Old 80 Hz fundamental must be gone.
    expect(freqs).not.toContain(80)
    expect(freqs).not.toContain(220)
  })

  it('includes a 6 Hz sine LFO oscillator for amplitude modulation (D-04)', () => {
    const { ac, masterGain } = buildContextAndMasterGain()
    startPhase3Swell(ac, masterGain)

    const lfoCandidates = oscNodeInstances.filter((o) => o._initFreq === 6)
    expect(lfoCandidates).toHaveLength(1)
    expect(lfoCandidates[0]._initType).toBe('sine')
  })

  it('includes a 2 kHz harmonic and 3 kHz chirp', () => {
    const { ac, masterGain } = buildContextAndMasterGain()
    startPhase3Swell(ac, masterGain)

    const at2k = oscNodeInstances.filter((o) => o._initFreq === 2000)
    const at3k = oscNodeInstances.filter((o) => o._initFreq === 3000)
    expect(at2k).toHaveLength(1)
    expect(at3k).toHaveLength(1)
    // Chirp is specified as triangle; harmonic as sine.
    expect(at3k[0]._initType).toBe('triangle')
    expect(at2k[0]._initType).toBe('sine')
  })

  it('sweeps the primary fundamental up by ×1.4 over 3 seconds (rising urgency)', () => {
    const { ac, masterGain } = buildContextAndMasterGain(0)
    startPhase3Swell(ac, masterGain)

    const primary = oscNodeInstances.find((o) => o._initFreq === 1000)
    expect(primary).toBeDefined()
    const rampCall = primary!.frequency._calls.find(
      (c) => c.method === 'linearRampToValueAtTime',
    )
    expect(rampCall).toBeDefined()
    expect(rampCall!.args[0]).toBeCloseTo(1400, 5) // 1000 * 1.4
    expect(rampCall!.args[1]).toBeCloseTo(3.0, 5)
  })

  it('calls start() on every returned oscillator', () => {
    const { ac, masterGain } = buildContextAndMasterGain()
    const result = startPhase3Swell(ac, masterGain)
    result.forEach((osc) => {
      // The returned node is one of our mocks — cast for the assertion.
      const mockOsc = osc as unknown as OscNodeMock
      expect(mockOsc.start).toHaveBeenCalledOnce()
    })
  })

  it('returns an array of OscillatorNode (new signature)', () => {
    const { ac, masterGain } = buildContextAndMasterGain()
    const result = startPhase3Swell(ac, masterGain)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(6)
  })
})

// ---- fadeOutGain tests ----

describe('fadeOutGain', () => {
  it('is exported as a function', () => {
    expect(typeof fadeOutGain).toBe('function')
  })

  it('calls setTargetAtTime(0.0001, currentTime, 0.015) on the gain param', () => {
    const ac = buildMockAudioContext(7)
    // Build a fresh gain mock to use as the argument
    const gainParam = makeGainParamMock()
    const fakeGainNode = { gain: gainParam, connect: vi.fn() } as unknown as GainNode

    fadeOutGain(fakeGainNode, ac)

    expect(gainParam.setTargetAtTime).toHaveBeenCalledOnce()
    const [target, startTime, timeConstant] = gainParam.setTargetAtTime.mock.calls[0] as [
      number,
      number,
      number,
    ]

    expect(target).toBe(0.0001)
    expect(startTime).toBe(7) // ac.currentTime
    expect(timeConstant).toBe(0.015)
  })
})
