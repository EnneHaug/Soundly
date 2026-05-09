import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireSegmentEndSound } from '../sounds/segmentSound';

vi.mock('../sounds/singingBowl', () => ({
  strikeBowl: vi.fn(),
}));
vi.mock('../sounds/triangle', () => ({
  strikeTriangle: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fireSegmentEndSound', () => {
  it("routes 'gentle' to strikeBowl(ac, 1.0) exactly once and does not call strikeTriangle", async () => {
    const { strikeBowl } = await import('../sounds/singingBowl');
    const { strikeTriangle } = await import('../sounds/triangle');
    const ac = { tag: 'test-ac' } as unknown as AudioContext;

    fireSegmentEndSound(ac, 'gentle');

    expect(strikeBowl).toHaveBeenCalledTimes(1);
    expect(strikeBowl).toHaveBeenCalledWith(ac, 1.0);
    expect(strikeTriangle).not.toHaveBeenCalled();
  });

  it("routes 'triangle' to strikeTriangle(ac, 1.0) exactly once and does not call strikeBowl", async () => {
    const { strikeBowl } = await import('../sounds/singingBowl');
    const { strikeTriangle } = await import('../sounds/triangle');
    const ac = { tag: 'test-ac' } as unknown as AudioContext;

    fireSegmentEndSound(ac, 'triangle');

    expect(strikeTriangle).toHaveBeenCalledTimes(1);
    expect(strikeTriangle).toHaveBeenCalledWith(ac, 1.0);
    expect(strikeBowl).not.toHaveBeenCalled();
  });

  it('passes the AudioContext through by identity (no wrapping)', async () => {
    const { strikeBowl } = await import('../sounds/singingBowl');
    const ac = { distinct: Symbol('ac') } as unknown as AudioContext;

    fireSegmentEndSound(ac, 'gentle');

    const calls = (strikeBowl as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toBe(ac); // strict identity, not deep-equal
  });
});
