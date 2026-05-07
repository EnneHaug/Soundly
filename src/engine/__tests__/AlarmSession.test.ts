/**
 * AlarmSession unit tests.
 *
 * Covers (per 06-01-PLAN.md and D-05/D-07):
 *   1. start() resolves with a SessionHandle whose `ac` is defined
 *   2. start() calls each of the four dependencies exactly once
 *   3. start() invokes deps in canonical order (D-05):
 *        getAudioContext -> startKeepalive -> acquireWakeLock -> attachVisibilityReacquire
 *   4. end(handle) calls stopKeepalive, releaseWakeLock, and releaseVisibility once each
 *   5. end(handle) called twice is a silent no-op the second time (D-04)
 *   6. AC failure propagates out of start (D-05 — matches v1 reject behavior)
 *   7. Wake-lock failure profile is preserved unchanged by AlarmSession (D-05):
 *      - When the dep behaves per its real contract (resolves — wakeLock.ts
 *        swallows internally), startAlarmSession resolves and the subsequent
 *        attachVisibilityReacquire still gets called (covered by Tests 1-5).
 *      - When the dep is forced to reject (simulated future leak / mock override),
 *        AlarmSession passes the rejection through *unchanged* — it does NOT
 *        add a try/catch wrapper that would either swallow it (and shadow a
 *        real bug) or transform it (and double-log via console.debug).
 *        This is the defensive contract: AlarmSession is a thin orchestrator,
 *        not a second-line error handler. The real swallow lives where it
 *        already lives, in src/platform/wakeLock.ts (D-05).
 *
 * Mock pattern copied verbatim from src/engine/__tests__/AlarmEngine.test.ts
 * lines 6-65, but limited to the three modules AlarmSession actually imports
 * (../AudioContext, ../sounds/keepalive, ../../platform/wakeLock). No mocks
 * for singingBowl, phase3Tone, tickPulse, or vibration — AlarmSession does
 * not touch them.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startAlarmSession, endAlarmSession, type SessionHandle } from '../AlarmSession';

vi.mock('../AudioContext', () => ({
  getAudioContext: vi.fn().mockResolvedValue({
    currentTime: 0,
    destination: {},
    state: 'running',
  } as unknown as AudioContext),
}));

vi.mock('../sounds/keepalive', () => ({
  startKeepalive: vi.fn().mockReturnValue({
    stop: vi.fn(),
    connect: vi.fn(),
    start: vi.fn(),
  }),
  stopKeepalive: vi.fn(),
}));

vi.mock('../../platform/wakeLock', () => ({
  acquireWakeLock: vi.fn().mockResolvedValue(undefined),
  releaseWakeLock: vi.fn(),
  attachVisibilityReacquire: vi.fn().mockReturnValue(vi.fn()), // returns cleanup fn
}));

describe('AlarmSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.stubGlobal('navigator', { vibrate: vi.fn() });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('startAlarmSession() resolves with a handle exposing ac', async () => {
    const handle: SessionHandle = await startAlarmSession();
    expect(handle.ac).toBeDefined();
  });

  it('startAlarmSession() calls each dependency exactly once', async () => {
    const { getAudioContext } = await import('../AudioContext');
    const { startKeepalive } = await import('../sounds/keepalive');
    const { acquireWakeLock, attachVisibilityReacquire } = await import('../../platform/wakeLock');

    await startAlarmSession();

    expect(getAudioContext).toHaveBeenCalledTimes(1);
    expect(startKeepalive).toHaveBeenCalledTimes(1);
    expect(acquireWakeLock).toHaveBeenCalledTimes(1);
    expect(attachVisibilityReacquire).toHaveBeenCalledTimes(1);
  });

  it('startAlarmSession() invokes deps in the order: getAudioContext -> startKeepalive -> acquireWakeLock -> attachVisibilityReacquire', async () => {
    const { getAudioContext } = await import('../AudioContext');
    const { startKeepalive } = await import('../sounds/keepalive');
    const { acquireWakeLock, attachVisibilityReacquire } = await import('../../platform/wakeLock');

    await startAlarmSession();

    const ac = (getAudioContext as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    const ka = (startKeepalive as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    const wl = (acquireWakeLock as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    const vis = (attachVisibilityReacquire as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];

    expect(ac).toBeLessThan(ka);
    expect(ka).toBeLessThan(wl);
    expect(wl).toBeLessThan(vis);
  });

  it('endAlarmSession(handle) tears down keepalive, wake lock, and visibility listener exactly once', async () => {
    const { stopKeepalive } = await import('../sounds/keepalive');
    const { releaseWakeLock, attachVisibilityReacquire } = await import('../../platform/wakeLock');

    const releaseVisibility = vi.fn();
    (attachVisibilityReacquire as ReturnType<typeof vi.fn>).mockReturnValueOnce(releaseVisibility);

    const handle = await startAlarmSession();
    endAlarmSession(handle);

    expect(stopKeepalive).toHaveBeenCalledTimes(1);
    expect(releaseWakeLock).toHaveBeenCalledTimes(1);
    expect(releaseVisibility).toHaveBeenCalledTimes(1);
  });

  it('endAlarmSession(handle) called twice is a silent no-op the second time', async () => {
    const { stopKeepalive } = await import('../sounds/keepalive');
    const { releaseWakeLock, attachVisibilityReacquire } = await import('../../platform/wakeLock');

    const releaseVisibility = vi.fn();
    (attachVisibilityReacquire as ReturnType<typeof vi.fn>).mockReturnValueOnce(releaseVisibility);

    const handle = await startAlarmSession();
    endAlarmSession(handle);
    expect(() => endAlarmSession(handle)).not.toThrow();

    expect(stopKeepalive).toHaveBeenCalledTimes(1);
    expect(releaseWakeLock).toHaveBeenCalledTimes(1);
    expect(releaseVisibility).toHaveBeenCalledTimes(1);
  });

  it('AudioContext failure propagates out of startAlarmSession', async () => {
    const { getAudioContext } = await import('../AudioContext');
    (getAudioContext as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('AC failed'));

    await expect(startAlarmSession()).rejects.toThrow('AC failed');
  });

  it('Wake-lock acquisition failure is passed through unchanged (AlarmSession adds no try/catch wrapper)', async () => {
    // D-05: AlarmSession MUST NOT wrap acquireWakeLock() in try/catch.
    // The real wakeLock.ts already swallows internally; double-wrapping would
    // either shadow a real bug or double-log via console.debug.
    //
    // Defensive contract proof: when the dep is *forced* to reject (simulating
    // a hypothetical future regression where wakeLock.ts stops swallowing),
    // AlarmSession passes the error through unchanged — same error type, same
    // message — proving no transforming wrapper exists. The "swallow profile"
    // that callers see in production is therefore exactly what wakeLock.ts
    // emits, with zero AlarmSession-side modification.
    //
    // Real-world resolve-path coverage (the dep behaves per its actual
    // contract and resolves) is provided by Tests 1-5, which all rely on the
    // default mockResolvedValue(undefined) and assert that visibility still
    // attaches downstream of acquireWakeLock.
    const { acquireWakeLock } = await import('../../platform/wakeLock');
    const err = new DOMException('NotAllowedError');
    (acquireWakeLock as ReturnType<typeof vi.fn>).mockRejectedValueOnce(err);

    await expect(startAlarmSession()).rejects.toBe(err);
  });
});
