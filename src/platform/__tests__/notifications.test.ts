import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  requestNotificationPermission,
  showAlarmNotification,
  clearAlarmNotification,
} from '../notifications';

// --- Helpers ---

function mockNotification(permission: NotificationPermission, requestResult?: NotificationPermission) {
  const requestPermission = vi.fn().mockResolvedValue(requestResult ?? permission);
  const NotificationMock = Object.assign(
    vi.fn(),
    { permission, requestPermission }
  );
  Object.defineProperty(globalThis, 'Notification', {
    value: NotificationMock,
    writable: true,
    configurable: true,
  });
  return { requestPermission };
}

function mockServiceWorker(showNotification = vi.fn(), getNotifications = vi.fn().mockResolvedValue([])) {
  const reg = { showNotification, getNotifications };
  Object.defineProperty(globalThis.navigator, 'serviceWorker', {
    value: { ready: Promise.resolve(reg) },
    writable: true,
    configurable: true,
  });
  return { showNotification, getNotifications };
}

function removeNotification() {
  Object.defineProperty(globalThis, 'Notification', {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

function removeServiceWorker() {
  Object.defineProperty(globalThis.navigator, 'serviceWorker', {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

// --- Tests ---

describe('requestNotificationPermission', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when permission is already granted', async () => {
    mockNotification('granted');
    const result = await requestNotificationPermission();
    expect(result).toBe(true);
  });

  it('calls requestPermission and returns true when user grants from default state', async () => {
    const { requestPermission } = mockNotification('default', 'granted');
    const result = await requestNotificationPermission();
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(result).toBe(true);
  });

  it('returns false when permission is denied', async () => {
    mockNotification('denied');
    const result = await requestNotificationPermission();
    expect(result).toBe(false);
  });

  it('returns false when Notification is not in window', async () => {
    removeNotification();
    const result = await requestNotificationPermission();
    expect(result).toBe(false);
  });

  it('returns false when user denies from default state', async () => {
    mockNotification('default', 'denied');
    const result = await requestNotificationPermission();
    expect(result).toBe(false);
  });
});

describe('showAlarmNotification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls reg.showNotification with correct title and tag', async () => {
    mockNotification('granted');
    const { showNotification } = mockServiceWorker();
    await showAlarmNotification();
    expect(showNotification).toHaveBeenCalledOnce();
    const [title, options] = showNotification.mock.calls[0];
    expect(title).toContain('Soundly');
    expect(options.tag).toBe('soundly-alarm');
    expect(options.requireInteraction).toBe(true);
  });

  it('is a no-op when permission is not granted', async () => {
    mockNotification('default');
    const { showNotification } = mockServiceWorker();
    await showAlarmNotification();
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('is a no-op when navigator.serviceWorker is unavailable', async () => {
    mockNotification('granted');
    removeServiceWorker();
    // Should not throw
    await expect(showAlarmNotification()).resolves.toBeUndefined();
  });
});

describe('clearAlarmNotification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls getNotifications with soundly-alarm tag and closes each notification', async () => {
    const close = vi.fn();
    const fakeNotif = { close };
    const getNotifications = vi.fn().mockResolvedValue([fakeNotif, fakeNotif]);
    mockServiceWorker(vi.fn(), getNotifications);
    await clearAlarmNotification();
    expect(getNotifications).toHaveBeenCalledWith({ tag: 'soundly-alarm' });
    expect(close).toHaveBeenCalledTimes(2);
  });

  it('is a no-op when navigator.serviceWorker is unavailable', async () => {
    removeServiceWorker();
    await expect(clearAlarmNotification()).resolves.toBeUndefined();
  });
});
