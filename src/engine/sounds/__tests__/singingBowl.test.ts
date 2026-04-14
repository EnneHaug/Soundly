import { describe, it, expect, vi, beforeEach } from 'vitest'
import { strikeBowl } from '../singingBowl'

/**
 * Mock AudioNode that tracks connect() chains
 */
function makeMockAudioNode() {
  return {
    connect: vi.fn().mockReturnThis(),
  }
}

/**
 * Mock OscillatorNode constructor — tracks creation args and supports start/stop
 */
const mockOscillatorInstances: Array<{
  type: string
  frequency: number
  connect: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
}> = []

/**
 * Mock GainNode constructor — tracks creation and exposes gain AudioParam mock
 */
const mockGainInstances: Array<{
  gain: {
    setValueAtTime: ReturnType<typeof vi.fn>
    linearRampToValueAtTime: ReturnType<typeof vi.fn>
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>
  }
  connect: ReturnType<typeof vi.fn>
}> = []

function makeGainParamMock() {
  return {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  }
}

/**
 * Build a mock AudioContext that captures OscillatorNode and GainNode construction
 * via global constructor mocks.
 */
function buildMockAudioContext() {
  mockOscillatorInstances.length = 0
  mockGainInstances.length = 0

  const destination = makeMockAudioNode()

  // Mock OscillatorNode constructor
  vi.stubGlobal(
    'OscillatorNode',
    vi.fn().mockImplementation((_ac: unknown, options: { type: string; frequency: number }) => {
      const instance = {
        type: options.type,
        frequency: options.frequency,
        connect: vi.fn().mockReturnThis(),
        start: vi.fn(),
        stop: vi.fn(),
      }
      mockOscillatorInstances.push(instance)
      return instance
    }),
  )

  // Mock GainNode constructor
  vi.stubGlobal(
    'GainNode',
    vi.fn().mockImplementation((_ac: unknown, options: { gain: number }) => {
      const instance = {
        gain: makeGainParamMock(),
        connect: vi.fn().mockReturnThis(),
        _initialGain: options.gain,
      }
      mockGainInstances.push(instance)
      return instance
    }),
  )

  return {
    currentTime: 0,
    destination,
  } as unknown as AudioContext
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('strikeBowl', () => {
  it('is exported as a function', () => {
    expect(typeof strikeBowl).toBe('function')
  })

  it('accepts (AudioContext, number?) signature', () => {
    const ac = buildMockAudioContext()
    // Should not throw when called with just AudioContext
    expect(() => strikeBowl(ac)).not.toThrow()
    // Should not throw when called with optional masterGain
    const ac2 = buildMockAudioContext()
    expect(() => strikeBowl(ac2, 0.4)).not.toThrow()
  })

  it('creates exactly 5 oscillator instances per strike', () => {
    const ac = buildMockAudioContext()
    strikeBowl(ac)
    expect(mockOscillatorInstances).toHaveLength(5)
  })

  it('creates all 5 gain nodes (one per partial)', () => {
    const ac = buildMockAudioContext()
    strikeBowl(ac)
    expect(mockGainInstances).toHaveLength(5)
  })

  it('sets fundamental frequency to 220 Hz', () => {
    const ac = buildMockAudioContext()
    strikeBowl(ac)
    // First oscillator is the fundamental
    expect(mockOscillatorInstances[0].frequency).toBe(220)
  })

  it('uses correct inharmonic partial ratios (2.76, 4.72, 6.83)', () => {
    const ac = buildMockAudioContext()
    strikeBowl(ac)

    const fund = 220
    const frequencies = mockOscillatorInstances.map((osc) => osc.frequency)

    // Verify partial frequencies against decision D-01
    expect(frequencies[1]).toBeCloseTo(fund * 2.76, 5)
    expect(frequencies[2]).toBeCloseTo(fund * 4.72, 5)
    expect(frequencies[3]).toBeCloseTo(fund * 6.83, 5)
  })

  it('uses detuned shimmer partial at 1.003x fundamental (D-02)', () => {
    const ac = buildMockAudioContext()
    strikeBowl(ac)

    const fund = 220
    const frequencies = mockOscillatorInstances.map((osc) => osc.frequency)
    expect(frequencies[4]).toBeCloseTo(fund * 1.003, 5)
  })

  it('applies masterGain scaling to all partial peak gains', () => {
    const ac = buildMockAudioContext()
    const masterGain = 0.4
    strikeBowl(ac, masterGain)

    // Each gain node should have linearRampToValueAtTime called with scaled gain
    // Fundamental peak gain is 0.35 * masterGain = 0.14
    const fundamentalGainNode = mockGainInstances[0]
    const rampCall = fundamentalGainNode.gain.linearRampToValueAtTime.mock.calls[0]
    expect(rampCall[0]).toBeCloseTo(0.35 * masterGain, 5)
  })

  it('uses exponential ramp to 0.001 (not 0) to avoid spec violation', () => {
    const ac = buildMockAudioContext()
    strikeBowl(ac)

    // All gain nodes should decay to 0.001, never to 0
    for (const gainNode of mockGainInstances) {
      const expRampCalls = gainNode.gain.exponentialRampToValueAtTime.mock.calls
      expect(expRampCalls.length).toBeGreaterThan(0)
      for (const call of expRampCalls) {
        expect(call[0]).toBe(0.001)
        expect(call[0]).not.toBe(0)
      }
    }
  })

  it('starts and stops each oscillator', () => {
    const ac = buildMockAudioContext()
    strikeBowl(ac)

    for (const osc of mockOscillatorInstances) {
      expect(osc.start).toHaveBeenCalledOnce()
      expect(osc.stop).toHaveBeenCalledOnce()
    }
  })
})
