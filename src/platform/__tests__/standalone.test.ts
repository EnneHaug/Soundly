import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isPwaInstalled, isIosSafariNonInstalled } from '../standalone';

// --- Helpers ---

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(globalThis, 'window', {
    value: {
      ...globalThis.window,
      matchMedia: vi.fn().mockReturnValue({ matches }),
    },
    writable: true,
    configurable: true,
  });
}

function setNavigatorStandalone(value: boolean | undefined) {
  Object.defineProperty(globalThis.navigator, 'standalone', {
    value,
    writable: true,
    configurable: true,
  });
}

function setNavigatorUserAgent(ua: string) {
  Object.defineProperty(globalThis.navigator, 'userAgent', {
    value: ua,
    writable: true,
    configurable: true,
  });
}

describe('isPwaInstalled', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setNavigatorStandalone(undefined);
  });

  it('returns true when display-mode is standalone', () => {
    mockMatchMedia(true);
    expect(isPwaInstalled()).toBe(true);
  });

  it('returns true when navigator.standalone is true (iOS WebKit)', () => {
    mockMatchMedia(false);
    setNavigatorStandalone(true);
    expect(isPwaInstalled()).toBe(true);
  });

  it('returns false when neither condition matches', () => {
    mockMatchMedia(false);
    setNavigatorStandalone(false);
    expect(isPwaInstalled()).toBe(false);
  });
});

describe('isIosSafariNonInstalled', () => {
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    setNavigatorUserAgent(originalUserAgent);
    setNavigatorStandalone(undefined);
  });

  it('returns true on iOS user agent when not installed', () => {
    setNavigatorUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15');
    mockMatchMedia(false);
    setNavigatorStandalone(false);
    expect(isIosSafariNonInstalled()).toBe(true);
  });

  it('returns false on non-iOS user agent', () => {
    setNavigatorUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120');
    mockMatchMedia(false);
    expect(isIosSafariNonInstalled()).toBe(false);
  });

  it('returns false on iOS when installed as PWA (display-mode standalone)', () => {
    setNavigatorUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
    mockMatchMedia(true);
    expect(isIosSafariNonInstalled()).toBe(false);
  });

  it('returns false on iOS when installed via navigator.standalone', () => {
    setNavigatorUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
    mockMatchMedia(false);
    setNavigatorStandalone(true);
    expect(isIosSafariNonInstalled()).toBe(false);
  });
});
