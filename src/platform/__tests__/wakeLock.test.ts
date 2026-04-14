import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { acquireWakeLock, releaseWakeLock, attachVisibilityReacquire } from '../wakeLock';

// ---- Mock sentinel factory ----

function createMockSentinel() {
  return {
    release: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    released: false,
  };
}

// ---- Document mock helpers ----
// The test environment is 'node', so document is not available.
// We stub it as a global with an EventTarget-based implementation.

type EventHandler = (event: Event) => void;

function createMockDocument(visibilityState = 'visible') {
  const listeners: Map<string, EventHandler[]> = new Map();
  return {
    visibilityState,
    addEventListener: vi.fn((type: string, handler: EventHandler) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push(handler);
    }),
    removeEventListener: vi.fn((type: string, handler: EventHandler) => {
      const arr = listeners.get(type) ?? [];
      const idx = arr.indexOf(handler);
      if (idx !== -1) arr.splice(idx, 1);
    }),
    dispatchEvent(event: Event) {
      const arr = listeners.get(event.type) ?? [];
      arr.forEach((h) => h(event));
    },
    _listeners: listeners,
  };
}

describe('wakeLock', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    // Reset module state by calling releaseWakeLock before each test
    releaseWakeLock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    releaseWakeLock();
  });

  describe('acquireWakeLock', () => {
    it('is exported as a function', () => {
      expect(typeof acquireWakeLock).toBe('function');
    });

    it('calls navigator.wakeLock.request("screen") when supported', async () => {
      const mockSentinel = createMockSentinel();
      const mockRequest = vi.fn().mockResolvedValue(mockSentinel);
      vi.stubGlobal('navigator', {
        wakeLock: { request: mockRequest },
      });

      await acquireWakeLock();

      expect(mockRequest).toHaveBeenCalledWith('screen');
    });

    it('is a no-op if wakeLock is not in navigator', async () => {
      vi.stubGlobal('navigator', {});

      await expect(acquireWakeLock()).resolves.toBeUndefined();
    });

    it('catches and logs NotAllowedError without throwing', async () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const mockRequest = vi.fn().mockRejectedValue(
        new DOMException('Document is not focused', 'NotAllowedError')
      );
      vi.stubGlobal('navigator', {
        wakeLock: { request: mockRequest },
      });

      await expect(acquireWakeLock()).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('attaches a release event listener to the sentinel', async () => {
      const mockSentinel = createMockSentinel();
      const mockRequest = vi.fn().mockResolvedValue(mockSentinel);
      vi.stubGlobal('navigator', {
        wakeLock: { request: mockRequest },
      });

      await acquireWakeLock();

      expect(mockSentinel.addEventListener).toHaveBeenCalledWith('release', expect.any(Function));
    });
  });

  describe('releaseWakeLock', () => {
    it('is exported as a function', () => {
      expect(typeof releaseWakeLock).toBe('function');
    });

    it('calls sentinel.release() when a sentinel is held', async () => {
      const mockSentinel = createMockSentinel();
      const mockRequest = vi.fn().mockResolvedValue(mockSentinel);
      vi.stubGlobal('navigator', {
        wakeLock: { request: mockRequest },
      });

      await acquireWakeLock();
      releaseWakeLock();

      expect(mockSentinel.release).toHaveBeenCalledTimes(1);
    });

    it('is safe to call when no sentinel is held', () => {
      expect(() => releaseWakeLock()).not.toThrow();
    });

    it('sets _shouldHoldLock to false so visibilitychange does not re-acquire', async () => {
      const mockDoc = createMockDocument('visible');
      vi.stubGlobal('document', mockDoc);

      const mockSentinel = createMockSentinel();
      const mockRequest = vi.fn().mockResolvedValue(mockSentinel);
      vi.stubGlobal('navigator', {
        wakeLock: { request: mockRequest },
      });

      await acquireWakeLock();
      releaseWakeLock();

      // After release, new request should not be made on visibilitychange
      const callCount = mockRequest.mock.calls.length;

      const cleanup = attachVisibilityReacquire();
      mockDoc.dispatchEvent(new Event('visibilitychange'));

      // Wait for async handlers
      await new Promise((r) => setTimeout(r, 10));

      expect(mockRequest.mock.calls.length).toBe(callCount); // no new call
      cleanup();
    });
  });

  describe('attachVisibilityReacquire', () => {
    it('is exported as a function', () => {
      expect(typeof attachVisibilityReacquire).toBe('function');
    });

    it('returns a cleanup function', () => {
      const mockDoc = createMockDocument();
      vi.stubGlobal('document', mockDoc);

      const cleanup = attachVisibilityReacquire();
      expect(typeof cleanup).toBe('function');
      cleanup();
    });

    it('re-acquires wake lock when document becomes visible and _shouldHoldLock is true', async () => {
      const mockDoc = createMockDocument('visible');
      vi.stubGlobal('document', mockDoc);

      const mockSentinel = createMockSentinel();
      const mockRequest = vi.fn().mockResolvedValue(mockSentinel);
      vi.stubGlobal('navigator', {
        wakeLock: { request: mockRequest },
      });

      await acquireWakeLock(); // sets _shouldHoldLock = true, calls request once

      const cleanup = attachVisibilityReacquire();

      mockDoc.dispatchEvent(new Event('visibilitychange'));

      // Wait for async handler
      await new Promise((r) => setTimeout(r, 10));

      // Should have been called again (re-acquisition)
      expect(mockRequest).toHaveBeenCalledTimes(2);

      cleanup();
    });

    it('removes the listener when cleanup is called', async () => {
      const mockDoc = createMockDocument('visible');
      vi.stubGlobal('document', mockDoc);

      const mockSentinel = createMockSentinel();
      const mockRequest = vi.fn().mockResolvedValue(mockSentinel);
      vi.stubGlobal('navigator', {
        wakeLock: { request: mockRequest },
      });

      await acquireWakeLock();
      const callCount = mockRequest.mock.calls.length;

      const cleanup = attachVisibilityReacquire();
      cleanup(); // remove listener immediately

      mockDoc.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r) => setTimeout(r, 10));

      // No additional calls after cleanup removed the listener
      expect(mockRequest.mock.calls.length).toBe(callCount);
    });
  });
});
