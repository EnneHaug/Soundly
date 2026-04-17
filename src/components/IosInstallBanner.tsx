/**
 * IosInstallBanner — shows "Add to Home Screen" guidance for iOS Safari users
 * who haven't installed the PWA (PLT-04).
 *
 * Security (T-03-07): sessionStorage only stores a boolean "true" — no PII.
 * Security (T-03-05): UA sniffing is cosmetic — wrong banner state is harmless.
 */

import { useState, useEffect } from 'react';
import { isIosSafariNonInstalled } from '../platform/standalone';

const SESSION_KEY = 'ios-banner-dismissed';

export default function IosInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show on iOS Safari non-installed and if not already dismissed this session
    if (isIosSafariNonInstalled() && !sessionStorage.getItem(SESSION_KEY)) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(SESSION_KEY, 'true');
    setShow(false);
  };

  return (
    <div className="bg-sand/30 border border-border rounded-xl p-4 text-sm text-text-secondary flex items-start gap-3">
      <p className="flex-1">
        For the best experience, tap Share then &ldquo;Add to Home Screen&rdquo;
      </p>
      <button
        onClick={handleDismiss}
        type="button"
        className="text-text-secondary hover:text-text-primary transition-colors shrink-0 font-medium"
        aria-label="Dismiss install banner"
      >
        Dismiss
      </button>
    </div>
  );
}
