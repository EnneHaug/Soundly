import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TEST_SOUND_GAIN, playTestSound } from '../testSound'

// ---- Mock the module dependencies ----

// We mock the modules that testSound.ts imports so we can verify
// that playTestSound() calls them correctly.

vi.mock('../singingBowl', () => ({
  strikeBowl: vi.fn(),
}))

vi.mock('../../AudioContext', () => ({
  getAudioContext: vi.fn(),
}))

// Import after mocking so we get the mock versions
import { strikeBowl } from '../singingBowl'
import { getAudioContext } from '../../AudioContext'

const mockStrikeBowl = vi.mocked(strikeBowl)
const mockGetAudioContext = vi.mocked(getAudioContext)

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---- TEST_SOUND_GAIN tests ----

describe('TEST_SOUND_GAIN', () => {
  it('is exported as a constant', () => {
    expect(TEST_SOUND_GAIN).toBeDefined()
  })

  it('equals 0.4 (comfortable mid-range volume per D-07)', () => {
    expect(TEST_SOUND_GAIN).toBe(0.4)
  })
})

// ---- playTestSound tests ----

describe('playTestSound', () => {
  it('is exported as an async function', () => {
    expect(typeof playTestSound).toBe('function')
    // Should return a Promise
    const mockAc = { currentTime: 0 } as unknown as AudioContext
    mockGetAudioContext.mockResolvedValue(mockAc)
    const result = playTestSound()
    expect(result).toBeInstanceOf(Promise)
    return result
  })

  it('calls getAudioContext() to ensure AudioContext is running', async () => {
    const mockAc = { currentTime: 0 } as unknown as AudioContext
    mockGetAudioContext.mockResolvedValue(mockAc)

    await playTestSound()

    expect(mockGetAudioContext).toHaveBeenCalledOnce()
  })

  it('calls strikeBowl with the AudioContext', async () => {
    const mockAc = { currentTime: 0 } as unknown as AudioContext
    mockGetAudioContext.mockResolvedValue(mockAc)

    await playTestSound()

    expect(mockStrikeBowl).toHaveBeenCalledOnce()
    expect(mockStrikeBowl).toHaveBeenCalledWith(mockAc, TEST_SOUND_GAIN)
  })

  it('calls strikeBowl with gain 0.4 (TEST_SOUND_GAIN)', async () => {
    const mockAc = { currentTime: 0 } as unknown as AudioContext
    mockGetAudioContext.mockResolvedValue(mockAc)

    await playTestSound()

    const [, gainArg] = mockStrikeBowl.mock.calls[0] as [AudioContext, number]
    expect(gainArg).toBe(0.4)
    expect(gainArg).toBe(TEST_SOUND_GAIN)
  })

  it('awaits getAudioContext before calling strikeBowl', async () => {
    const callOrder: string[] = []
    const mockAc = { currentTime: 0 } as unknown as AudioContext

    mockGetAudioContext.mockImplementation(
      () =>
        new Promise<AudioContext>((resolve) => {
          callOrder.push('getAudioContext')
          resolve(mockAc)
        }),
    )

    mockStrikeBowl.mockImplementation(() => {
      callOrder.push('strikeBowl')
    })

    await playTestSound()

    expect(callOrder).toEqual(['getAudioContext', 'strikeBowl'])
  })
})
