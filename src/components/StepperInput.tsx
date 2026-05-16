/**
 * StepperInput — duration stepper with adaptive step + keyboard support
 * + min/max clamps. First number stepper in the codebase (NEW pattern per
 * 09-PATTERNS.md:23-29).
 *
 * D-01 LOCKED — adaptive step size based on the 5:00 (300_000 ms) boundary:
 *   below 5:00            → step = 30 s (SMALL_STEP_MS)
 *   at or above 5:00      → step = 1 min (LARGE_STEP_MS)
 *   "−" at exactly 5:00   → drops by 1 MIN to 4:00 (boundary case per Pitfall 7),
 *                           NOT 30s to 4:30. Asymmetric with "+" by design: once
 *                           you're at 5:00 in either direction, the minute-step
 *                           granularity feels correct.
 *
 * D-02 LOCKED — keyboard map:
 *   ArrowUp/ArrowDown            → same step as +/− buttons (adaptive)
 *   Shift+ArrowUp/Down + PageUp/Down → 5 min (SHIFT_STEP_MS) regardless of current
 *   Min clamp                    → 5 s (5_000 ms) — matches SEG-04 validator floor
 *   Max clamp                    → 60 min (3_600_000 ms) per segment
 *
 * D-03 LOCKED — touch target ≥ 44 px on +/− buttons (w-11 h-11).
 *
 * Mobile keypad suppression: <input> with inputMode="none" readOnly keeps the
 * mobile soft keyboard suppressed while +/− buttons and arrow keys do the
 * mutation. **Discretionary fallback applied (per PLAN line 234):** the input
 * uses type="text" + role="spinbutton" rather than type="number" because the
 * displayed value is formatted as mm:ss ("04:00") — non-numeric — which a
 * <input type="number"> would refuse to render (empty .value in jsdom and in
 * real browsers). role="spinbutton" + aria-valuemin/max/now (in ms) + the
 * aria-valuetext mm:ss readout preserves the screen-reader semantics that
 * type="number" would have provided.
 *
 * aria-valuetext={formatMmSs(valueMs)} gives the screen reader a friendly
 * "04:00" readout instead of the raw millisecond count from aria-valuenow —
 * critical UX win because the visible value is also mm:ss.
 */

import type { KeyboardEvent } from 'react';
import { formatMmSs } from '../utils/formatTime';

// D-01 LOCKED adaptive step constants
const SMALL_STEP_THRESHOLD_MS = 300_000; // 5:00 boundary
const SMALL_STEP_MS = 30_000; // 30 s — below threshold
const LARGE_STEP_MS = 60_000; // 1 min — at or above threshold

// D-02 LOCKED keyboard + clamp constants
const SHIFT_STEP_MS = 300_000; // 5 min — Shift+Arrow + PageUp/Down
const DEFAULT_MIN = 5_000; // 5 s floor (D-02 + SEG-04 validator)
const DEFAULT_MAX = 3_600_000; // 60 min ceiling

interface StepperInputProps {
  valueMs: number;
  onChange: (next: number) => void;
  minMs?: number;
  maxMs?: number;
  'aria-invalid'?: boolean;
}

/**
 * Step size for "+" — depends only on the threshold. At exactly 5:00, "+" goes
 * up by 1 min to 6:00.
 */
function stepFor(currentMs: number): number {
  return currentMs >= SMALL_STEP_THRESHOLD_MS ? LARGE_STEP_MS : SMALL_STEP_MS;
}

/**
 * Step size for "−". D-01 boundary case: at exactly 5:00, "−" steps down by
 * LARGE (1 min → 4:00), NOT SMALL (30s → 4:30). Below 5:00 it uses SMALL,
 * above 5:00 it uses LARGE.
 */
function decreaseStep(currentMs: number): number {
  if (currentMs > SMALL_STEP_THRESHOLD_MS) return LARGE_STEP_MS;
  if (currentMs === SMALL_STEP_THRESHOLD_MS) return LARGE_STEP_MS;
  return SMALL_STEP_MS;
}

export default function StepperInput({
  valueMs,
  onChange,
  minMs = DEFAULT_MIN,
  maxMs = DEFAULT_MAX,
  'aria-invalid': ariaInvalid,
}: StepperInputProps) {
  const clamp = (ms: number) => Math.max(minMs, Math.min(maxMs, ms));

  function increase(by?: number) {
    const step = by ?? stepFor(valueMs);
    onChange(clamp(valueMs + step));
  }

  function decrease(by?: number) {
    const step = by ?? decreaseStep(valueMs);
    onChange(clamp(valueMs - step));
  }

  function handleStepperKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      e.key === 'PageUp' ||
      e.key === 'PageDown'
    ) {
      e.preventDefault();
    }
    if (e.key === 'ArrowUp') {
      if (e.shiftKey) increase(SHIFT_STEP_MS);
      else increase();
    } else if (e.key === 'ArrowDown') {
      if (e.shiftKey) decrease(SHIFT_STEP_MS);
      else decrease();
    } else if (e.key === 'PageUp') {
      increase(SHIFT_STEP_MS);
    } else if (e.key === 'PageDown') {
      decrease(SHIFT_STEP_MS);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => decrease()}
        disabled={valueMs <= minMs}
        aria-label="Decrease duration"
        className="w-11 h-11 rounded-full border border-border bg-white/60 text-text-primary text-xl leading-none flex items-center justify-center active:scale-[0.95] transition-transform hover:bg-white/80 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        −
      </button>
      <input
        type="text"
        role="spinbutton"
        inputMode="none"
        readOnly
        value={formatMmSs(valueMs)}
        aria-label="Segment duration"
        aria-valuemin={minMs}
        aria-valuemax={maxMs}
        aria-valuenow={valueMs}
        aria-valuetext={formatMmSs(valueMs)}
        aria-invalid={ariaInvalid}
        onKeyDown={handleStepperKeyDown}
        className="w-20 text-center text-lg text-text-primary bg-transparent border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 rounded"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      />
      <button
        type="button"
        onClick={() => increase()}
        disabled={valueMs >= maxMs}
        aria-label="Increase duration"
        className="w-11 h-11 rounded-full border border-border bg-white/60 text-text-primary text-xl leading-none flex items-center justify-center active:scale-[0.95] transition-transform hover:bg-white/80 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        +
      </button>
    </div>
  );
}
