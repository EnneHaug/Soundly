/**
 * PWA installation and standalone detection (PLT-04).
 *
 * Detects whether the app is running as an installed PWA or in a regular browser tab.
 * Used to show "Add to Home Screen" guidance for non-installed iOS Safari users.
 *
 * Security (T-02-07): User agent spoofing only affects whether the iOS install banner
 * is shown — cosmetic only, no security impact.
 */

/** True if running as an installed PWA on any platform */
export function isPwaInstalled(): boolean {
  // Standard display-mode media query (Chrome, Firefox, Safari 15.4+)
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS WebKit-proprietary property (all iOS versions)
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
  return false;
}

/** True if on iOS Safari and NOT installed to home screen */
export function isIosSafariNonInstalled(): boolean {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!isIos) return false;
  return !isPwaInstalled();
}
