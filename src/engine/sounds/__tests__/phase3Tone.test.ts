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
}

type OscNodeMock = {
  frequency: GainParamMock
  connect: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
}

const gainNodeInstances: GainNodeMock[] = []
const oscNodeInstances: OscNodeMock[] = []

function buildMockAudioContext(currentTime = 0): AudioContext {
  gainNodeInstances.length = 0
  oscNodeInstances.length = 0

  vi.stubGlobal(
    'GainNode',
    vi.fn().mockImplementation((_ac: unknown, _opts: unknown) => {
      const instance: GainNodeMock = {
        gain: makeGainParamMock(),
        connect: vi.fn().mockReturnThis(),
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
        }
        // Record initial frequency from constructor options
        ;(instance as OscNodeMock & { _initFreq: number })._initFreq = options.frequency
        oscNodeInstances.push(instance)
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

  it('creates a GainNode and connects it to destination', () => {
    const ac = buildMockAudioContext()
    createPhase3Ramp(ac, 60)
    expect(gainNodeInstances).toHaveLength(1)
    expect(gainNodeInstances[0].connect).toHaveBeenCalled()
  })

  it('calls setValueAtTime(0) before linearRampToValueAtTime — anchor required (pitfall 6)', () => {
    const ac = buildMockAudioContext(5)
    createPhase3Ramp(ac, 60)

    const calls = gainNodeInstances[0].gain._calls
    const setValueIdx = calls.findIndex((c) => c.method === 'setValueAtTime')
    const rampIdx = calls.findIndex((c) => c.method === 'linearRampToValueAtTime')

    // Both calls must exist
    expect(setValueIdx).toBeGreaterThanOrEqual(0)
    expect(rampIdx).toBeGreaterThanOrEqual(0)

    // setValueAtTime must come BEFORE linearRampToValueAtTime
    expect(setValueIdx).toBeLessThan(rampIdx)

    // setValueAtTime anchor must be 0
    expect(calls[setValueIdx].args[0]).toBe(0)
  })

  it('front-loads ramp: reaches 0.8 at quarter duration, 1.0 at full duration', () => {
    const currentTime = 10
    const ac = buildMockAudioContext(currentTime)
    createPhase3Ramp(ac, 60)

    const calls = gainNodeInstances[0].gain._calls
    const rampCalls = calls.filter((c) => c.method === 'linearRampToValueAtTime')

    // Two-stage ramp: 0→0.8 at quarter, 0.8→1.0 at full
    expect(rampCalls).toHaveLength(2)
    expect(rampCalls[0].args[0]).toBe(0.8)
    expect(rampCalls[0].args[1]).toBeCloseTo(currentTime + 15, 5)
    expect(rampCalls[1].args[0]).toBe(1.0)
    expect(rampCalls[1].args[1]).toBeCloseTo(currentTime + 60, 5)
  })

  it('returns the GainNode', () => {
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
    // createPhase3Ramp creates 1 gain node — simulate masterGain
    const masterGain = gainNodeInstances[0] ?? {
      gain: makeGainParamMock(),
      connect: vi.fn().mockReturnThis(),
    }
    // Reset for swell test
    gainNodeInstances.length = 0
    oscNodeInstances.length = 0
    return { ac, masterGain: masterGain as unknown as GainNode }
  }

  it('creates an oscillator starting at 80 Hz', () => {
    const { ac, masterGain } = buildContextAndMasterGain()
    startPhase3Swell(ac, masterGain)

    expect(oscNodeInstances).toHaveLength(1)
    const osc = oscNodeInstances[0] as OscNodeMock & { _initFreq: number }
    expect(osc._initFreq).toBe(80)
  })

  it('sweeps frequency from 80Hz to 220Hz over 3 seconds', () => {
    const { ac, masterGain } = buildContextAndMasterGain(0)
    startPhase3Swell(ac, masterGain)

    const osc = oscNodeInstances[0]
    const freqCalls = osc.frequency._calls

    const setCall = freqCalls.find((c) => c.method === 'setValueAtTime')
    const rampCall = freqCalls.find((c) => c.method === 'linearRampToValueAtTime')

    expect(setCall).toBeDefined()
    expect(setCall!.args[0]).toBe(80) // start at 80Hz

    expect(rampCall).toBeDefined()
    expect(rampCall!.args[0]).toBe(220) // sweep to 220Hz
    expect(rampCall!.args[1]).toBeCloseTo(3.0, 5) // over 3 seconds
  })

  it('applies soft attack on oscGain (0 → 1.0 over 0.5s)', () => {
    const { ac, masterGain } = buildContextAndMasterGain(0)
    startPhase3Swell(ac, masterGain)

    // oscGain is the second GainNode created (first is masterGain if created together,
    // but in this test we cleared instances — so it's the first)
    const oscGainNode = gainNodeInstances[0]
    const gainCalls = oscGainNode.gain._calls

    const setCall = gainCalls.find((c) => c.method === 'setValueAtTime')
    const rampCall = gainCalls.find((c) => c.method === 'linearRampToValueAtTime')

    expect(setCall!.args[0]).toBe(0)    // start at 0
    expect(rampCall!.args[0]).toBe(1.0) // ramp to 1.0
    expect(rampCall!.args[1]).toBeCloseTo(0.5, 5) // over 0.5s
  })

  it('starts the oscillator', () => {
    const { ac, masterGain } = buildContextAndMasterGain()
    startPhase3Swell(ac, masterGain)
    expect(oscNodeInstances[0].start).toHaveBeenCalledOnce()
  })

  it('returns the OscillatorNode', () => {
    const { ac, masterGain } = buildContextAndMasterGain()
    const result = startPhase3Swell(ac, masterGain)
    expect(result).toBe(oscNodeInstances[0])
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
