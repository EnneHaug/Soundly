/**
 * Toast — shared live-region notification for share-success + decode-error (D-18, D-19).
 *
 * Single-instance pattern (no queue): the latest message replaces any prior one.
 * Realistic emit cases (share-success, decode-error, share-fail) all fire from
 * explicit user actions and rarely overlap — the latest is the most relevant.
 *
 * ARIA: role="status" + aria-live="polite" announces the message after the
 * screen reader's current utterance finishes — NOT assertive, which would
 * interrupt mid-sentence (incompatible with the zen calm aesthetic).
 *
 * WCAG 2.2.1 (Timing Adjustable): the locked 3s share-success and 4s share-rejection /
 * decode-failure timings (D-18, D-19) are below the 5s floor but qualify for the
 * "non-essential informational" exception — no action is required to proceed.
 * See 09-RESEARCH.md:1174.
 */

import { useEffect } from 'react';

interface ToastProps {
  message: string | null;
  durationMs: number;
  onDismiss: () => void;
}

export default function Toast({ message, durationMs, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(id);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed left-1/2 -translate-x-1/2 bottom-8 z-50 px-4 py-3 rounded-xl bg-text-primary/95 text-bg text-sm shadow-lg max-w-[calc(100vw-2rem)] text-center transition-opacity duration-200 opacity-100"
    >
      {message}
    </div>
  );
}
