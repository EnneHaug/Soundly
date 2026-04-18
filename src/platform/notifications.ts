/**
 * Notification utilities for backgrounded alarm alerts (PLT-03).
 *
 * Uses ServiceWorkerRegistration.showNotification() — NOT new Notification() —
 * because the latter is unreliable on mobile browsers.
 *
 * Permission must be requested from a user gesture (e.g., the "Start" button).
 * Do NOT call requestNotificationPermission() on page load.
 */

/**
 * Requests notification permission. Must be called from a user gesture handler.
 * Returns true if permission is (or becomes) granted, false otherwise.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

/**
 * Shows a system notification that the alarm is ringing.
 * Uses tag 'soundly-alarm' so repeated calls replace (not stack) notifications.
 * requireInteraction: true keeps it visible until user dismisses.
 *
 * Security (T-02-05): Always checks Notification.permission before firing.
 * Security (T-02-08): tag + renotify:false ensures at most one notification at a time.
 */
export async function showAlarmNotification(): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (!navigator.serviceWorker) return;
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('Soundly \u2014 Alarm ringing', {
    body: 'Tap to return to the app and dismiss.',
    icon: '/icons/icon-192x192.png',
    tag: 'soundly-alarm',
    // renotify is a valid Notifications API option but missing from some TS lib typings
    ...(({ renotify: false }) as Record<string, unknown>),
    requireInteraction: true,
  });
}

/**
 * Clears any active alarm notification (e.g., after user dismisses alarm in-app).
 */
export async function clearAlarmNotification(): Promise<void> {
  if (!navigator.serviceWorker) return;
  const reg = await navigator.serviceWorker.ready;
  const notifications = await reg.getNotifications({ tag: 'soundly-alarm' });
  notifications.forEach((n) => n.close());
}
