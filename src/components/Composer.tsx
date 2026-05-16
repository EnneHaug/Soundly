/**
 * Composer — Full-screen modal segment builder (COMP-02, COMP-06, COMP-07, COMP-08, SHR-01).
 *
 * First modal in the codebase. Uses native <dialog> + showModal() (RESEARCH
 * Pattern 1 / 09-RESEARCH.md:261-371) for free focus trap, free Escape-key
 * handling, free aria-modal, free top-layer stacking via the browser's
 * ::backdrop. No createPortal, no react-focus-lock.
 *
 * State machine: useReducer over composerReducer (Plan 09-02) — pure-function,
 * 6 actions, unit-tested in isolation. Initial config flows through the 'load'
 * action via the lazy-init (3rd) useReducer argument so IDs are normalized
 * (Pattern 2 — handles re-decoded shared URLs without React key collisions).
 *
 * Derived state (Pattern 7 / 09-RESEARCH.md:894-933): totalMs + validation +
 * rowValid all memoized off config.segments. Always-fresh; no
 * "I forgot to revalidate" bugs.
 *
 * Share handler (Pattern 5 / 09-RESEARCH.md:651-705): navigator.canShare gate
 * → navigator.share, else navigator.clipboard.writeText fallback. AbortError
 * on user-cancel is silent (Pitfall 4 / 09-RESEARCH.md:1252-1257). URL built
 * from location.origin + location.pathname to honor the GitHub Pages base
 * path (Pitfall 9 / 09-RESEARCH.md:1300-1304).
 *
 * Open/close lifecycle (D-14 LOCKED): close-X, Cancel, Escape, and browser-
 * back all route through one path — the native <dialog>.close() event listener
 * invokes onClose. Tap-outside does NOT close (native <dialog> default per
 * 09-RESEARCH.md:370).
 *
 * Footer button class strings: BYTE-IDENTICAL from Countdown.tsx:138-150 per
 * Phase 8 UI-SPEC Layout Reuse Map. Countdown.tsx is SEG-05 byte-identical-
 * protected — copy idioms FROM it, never modify it.
 */

import { useEffect, useMemo, useReducer, useRef } from 'react';
import { composerReducer } from '../lib/composerReducer';
import { rowValidityArray } from '../lib/composerValidation';
import { encodeComposition } from '../lib/shareUrl';
import { validateSegmentConfig, type SegmentConfig } from '../engine/SegmentState';
import { formatMmSs } from '../utils/formatTime';
import SegmentRow from './SegmentRow';

interface ComposerProps {
  open: boolean;
  initialConfig: SegmentConfig;
  onClose: () => void;
  onStart: (config: SegmentConfig) => Promise<void>;
  onShareSuccess: (msg: string) => void;
  onShareError: (msg: string) => void;
}

export default function Composer({
  open,
  initialConfig,
  onClose,
  onStart,
  onShareSuccess,
  onShareError,
}: ComposerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Lazy init: route initialConfig through 'load' so IDs are normalized
  // (handles re-decoded shared URLs without React key collisions per Pattern 2).
  const [config, dispatch] = useReducer(
    composerReducer,
    initialConfig,
    (init) => composerReducer({ segments: [] }, { type: 'load', config: init })
  );

  // Sync React 'open' prop to the dialog's native open state.
  // Pitfall 1 guard: dialogRef.current may be null on first render.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  // Bind native <dialog>.close() to onClose — Escape, close-X, Cancel, and
  // browser-back all flow through this one path per D-14.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const handler = () => onClose();
    dlg.addEventListener('close', handler);
    return () => dlg.removeEventListener('close', handler);
  }, [onClose]);

  // Derived state (Pattern 7) — always-fresh, no stale-revalidate bugs.
  const totalMs = useMemo(
    () => config.segments.reduce((s, seg) => s + seg.durationMs, 0),
    [config.segments]
  );
  const validation = useMemo(() => validateSegmentConfig(config), [config]);
  const rowValid = useMemo(() => rowValidityArray(config), [config]);
  const isValid = validation.ok && rowValid.every((v) => v);

  // Close-X / Cancel handler: invokes native close() which fires the 'close'
  // event listener above (single onClose path per D-14).
  function handleCloseClick() {
    const dlg = dialogRef.current;
    if (dlg && dlg.open) {
      dlg.close();
    } else {
      // Defensive fallback: if for any reason close() can't fire the event,
      // invoke onClose directly so the parent's state still flips.
      onClose();
    }
  }

  // Share handler (Pattern 5).
  async function onShareClick() {
    const fragment = encodeComposition(config);
    // Pitfall 9: build URL from origin + pathname so GitHub Pages base path
    // (`/Soundly/`) is honored. location.origin alone would drop the prefix.
    const url = `${location.origin}${location.pathname}#c=${fragment}`;
    const data = {
      url,
      title: 'My alarm composition',
      text: 'Open this gentle alarm in Soundly',
    };

    if (typeof navigator.canShare === 'function' && navigator.canShare(data)) {
      try {
        await navigator.share(data);
        // Success — the system share sheet IS the feedback; no toast needed.
      } catch (err) {
        // AbortError = user cancelled the share sheet; silent (Pitfall 4).
        if ((err as Error).name !== 'AbortError') {
          onShareError("Couldn't share — try copying from the address bar");
        }
      }
      return;
    }

    // Fallback: clipboard.
    try {
      await navigator.clipboard.writeText(url);
      onShareSuccess('Share link copied to clipboard');
    } catch {
      onShareError("Couldn't copy — try copying from the address bar");
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="bg-bg text-text-primary p-0 m-0 w-full h-full max-w-none max-h-none rounded-none"
      aria-labelledby="composer-title"
    >
      <div className="flex flex-col h-full">
        {/* Sticky header (D-13) */}
        <header className="sticky top-0 bg-bg/95 backdrop-blur-sm flex justify-between items-center px-6 py-4 border-b border-border z-10">
          <h2
            id="composer-title"
            className="text-xl font-semibold text-text-primary"
          >
            Custom alarm
          </h2>
          <button
            type="button"
            onClick={handleCloseClick}
            aria-label="Close composer"
            className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-white/40 text-text-primary text-xl"
          >
            ×
          </button>
        </header>

        {/* Total display (D-13) — COMP-06 live total via useMemo */}
        <div className="px-6 mt-6">
          <p className="text-sm text-text-secondary">Total</p>
          <p
            className="text-3xl font-light text-text-primary"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatMmSs(totalMs)}
          </p>
        </div>

        {/* Scrollable segment list */}
        <div className="flex-1 overflow-y-auto mt-8">
          {config.segments.map((segment, i) => (
            <SegmentRow
              key={segment.id}
              segment={segment}
              index={i}
              isOnlyRow={config.segments.length === 1}
              isInvalid={!rowValid[i]}
              onDurationChange={(ms) =>
                dispatch({ type: 'update_duration', index: i, durationMs: ms })
              }
              onSoundChange={(s) =>
                dispatch({ type: 'update_sound', index: i, endSound: s })
              }
              onDuplicate={() => dispatch({ type: 'duplicate', index: i })}
              onDelete={() => dispatch({ type: 'delete', index: i })}
            />
          ))}
        </div>

        {/* Add segment button (COMP-04 — reducer 'add' action) */}
        <div className="px-6 mt-6">
          <button
            type="button"
            onClick={() => dispatch({ type: 'add' })}
            aria-label="Add segment"
            className="px-6 py-3 rounded-xl border border-border text-text-primary bg-white/60 text-base transition-colors hover:bg-white/80 active:scale-[0.98]"
          >
            + Add segment
          </button>
        </div>

        {/* Whole-config validation rejection (D-12 — surfaces validator message) */}
        {!validation.ok && (
          <p className="px-6 mt-3 text-xs text-text-secondary">
            {validation.error}
          </p>
        )}

        {/* Sticky footer (D-13): Cancel | Share | Start */}
        <footer className="sticky bottom-0 bg-bg/95 backdrop-blur-sm border-t border-border px-6 py-4 mt-auto">
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleCloseClick}
                className="px-8 py-3 rounded-xl border border-border text-text-primary bg-white/60 text-base transition-colors hover:bg-white/80 active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onShareClick}
                className="px-8 py-3 rounded-xl border border-border text-text-primary bg-white/60 text-base transition-colors hover:bg-white/80 active:scale-[0.98]"
              >
                Share
              </button>
            </div>
            <div className="flex flex-col items-end">
              <button
                type="button"
                disabled={!isValid}
                onClick={() => onStart(config)}
                title={!isValid ? 'Fix invalid segments first' : undefined}
                className="px-8 py-3 rounded-xl bg-accent text-white text-base transition-colors hover:bg-accent/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Start
              </button>
              {!isValid && (
                <p className="text-xs text-text-secondary mt-1">
                  Fix invalid segments first
                </p>
              )}
            </div>
          </div>
        </footer>
      </div>
    </dialog>
  );
}
