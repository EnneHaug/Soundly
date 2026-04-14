import { describe, it, expect, vi, beforeEach } from 'vitest'
import { startKeepalive, stopKeepalive } from '../keepalive'

// ---- Mock infrastructure ----

type OscNodeMock = {
  connect: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  _freq: number
}

type GainNodeMock = {
  connect: ReturnType<typeof vi.fn>
  _initialGain: number
}

const oscInstances: OscNodeMock[] = []
const gainInstances: GainNodeMock[] = []

function buildMockAudioContext(): AudioContext {
  oscInstances.length = 0
  gainInstances.length = 0

  vi.stubGlobal(
    'OscillatorNode',
    vi.fn().mockImplementation((_ac: unknown, opts: { type: string; frequency: number }) => {
      const inst: OscNodeMock = {
        connect: vi.fn().mockReturnThis(),
        start: vi.fn(),
        stop: vi.fn(),
        _freq: opts.frequency,
      }
      oscInstances.push(inst)
      return inst
    }),
  )

  vi.stubGlobal(
    'GainNode',
    vi.fn().mockImplementation((_ac: unknown, opts: { gain: number }) => {
      const inst: GainNodeMock = {
        connect: vi.fn().mockReturnThis(),
        _initialGain: opts.gain,
      }
      gainInstances.push(inst)
      return inst
    }),
  )

  return { currentTime: 0, destination: {} } as unknown as AudioContext
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

// ---- startKeepalive tests ----

describe('startKeepalive', () => {
  it('is exported as a function', () => {
    expect(typeof startKeepalive).toBe('function')
  })

  it('creates an oscillator at frequency 1 (inaudible)', () => {
    const ac = buildMockAudioContext()
    startKeepalive(ac)

    expect(oscInstances).toHaveLength(1)
    expect(oscInstances[0]._freq).toBe(1)
  })

  it('creates a GainNode with initial gain 0 (silent)', () => {
    const ac = buildMockAudioContext()
    startKeepalive(ac)

    expect(gainInstances).toHaveLength(1)
    expect(gainInstances[0]._initialGain).toBe(0)
  })

  it('starts the oscillator', () => {
    const ac = buildMockAudioContext()
    startKeepalive(ac)

    expect(oscInstances[0].start).toHaveBeenCalledOnce()
  })

  it('returns the OscillatorNode', () => {
    const ac = buildMockAudioContext()
    const result = startKeepalive(ac)
    expect(result).toBe(oscInstances[0])
  })

  it('does not start the oscillator more than once', () => {
    const ac = buildMockAudioContext()
    startKeepalive(ac)
    expect(oscInstances[0].start).toHaveBeenCalledTimes(1)
  })
})

// ---- stopKeepalive tests ----

describe('stopKeepalive', () => {
  it('is exported as a function', () => {
    expect(typeof stopKeepalive).toBe('function')
  })

  it('calls osc.stop()', () => {
    const ac = buildMockAudioContext()
    const osc = startKeepalive(ac)
    stopKeepalive(osc)
    expect(oscInstances[0].stop).toHaveBeenCalledOnce()
  })

  it('does not throw if osc is already stopped (safe double-stop)', () => {
    const ac = buildMockAudioContext()
    const osc = startKeepalive(ac)

    // Simulate already-stopped oscillator throwing on second stop()
    oscInstances[0].stop.mockImplementationOnce(() => {
      throw new DOMException('Cannot stop: already stopped', 'InvalidStateError')
    })

    expect(() => stopKeepalive(osc)).not.toThrow()
  })
})
