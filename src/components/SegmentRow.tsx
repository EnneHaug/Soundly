/**
 * SegmentRow — single editable segment row in the Composer modal.
 *
 * Composes StepperInput (Plan 09-04) + SoundPicker (Plan 09-05) + Duplicate (⧉)
 * + Delete (×) icon buttons in a CSS Grid layout per UI-SPEC L354-391.
 *
 * Layout:
 *   - Desktop (≥ 480 px): single row, 4 cols [stepper | sound | duplicate | delete]
 *   - Mobile (< 480 px): row 1 = [stepper | duplicate | delete],
 *                        row 2 = [sound spanning all 3 cols via max-[480px]:col-span-3]
 *
 * Locked decisions:
 *   - D-11 LOCKED — invalid row gains 'border border-accent/50 rounded-lg'
 *     outline + aria-invalid propagates to the StepperInput (per UI-SPEC L411).
 *     Uses the existing accent token at 50% opacity — soft outlined card, NOT
 *     destructive red (the zen palette has no destructive token by design).
 *   - D-12 LOCKED — Delete is instant (no confirmation modal). The Delete
 *     button on the last remaining segment is disabled with the locked tooltip
 *     `At least one segment required`. The composer never reaches a zero-segment
 *     state. This is a UI-level guard; composerReducer (Plan 09-02) also rejects
 *     'delete' when segments.length <= 1 — belt-and-suspenders per T-09-06-01.
 *
 * Duplicate (COMP-05) callback semantics: the parent's composerReducer splices
 * the clone immediately AFTER the source segment with a fresh id. This component
 * only invokes onDuplicate; the reducer owns the array manipulation.
 *
 * Glyphs (UI-SPEC L278-281):
 *   - Duplicate: ⧉ U+29C9 (TWO JOINED SQUARES) — text glyph per Phase 3 D-11
 *     (no SVG icons in the design system).
 *   - Delete: × U+00D7 (MULTIPLICATION SIGN) — same glyph as the close-X for
 *     visual rhythm; context (row scope vs modal scope) disambiguates.
 *
 * The Delete button's native `disabled` attribute suppresses the synthetic
 * click event before our handler runs — no explicit guard in onClick needed.
 * This is the same idiom as SegmentCountdown.tsx:135-141's Pause button
 * (READ-ONLY analog — Phase 8 deliverable, never modify here).
 */

import StepperInput from './StepperInput';
import SoundPicker from './SoundPicker';
import type { Segment } from '../engine/SegmentState';

interface SegmentRowProps {
  segment: Segment;
  index: number;
  isOnlyRow: boolean;
  isInvalid: boolean;
  onDurationChange: (ms: number) => void;
  onSoundChange: (s: Segment['endSound']) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export default function SegmentRow({
  segment,
  index,
  isOnlyRow,
  isInvalid,
  onDurationChange,
  onSoundChange,
  onDuplicate,
  onDelete,
}: SegmentRowProps) {
  const baseClass =
    'grid gap-4 px-6 py-4 border-b border-border ' +
    'grid-cols-[auto_1fr_auto_auto] ' +
    'max-[480px]:grid-cols-[1fr_auto_auto] ' +
    'max-[480px]:grid-rows-[auto_auto] ' +
    'transition-colors duration-200';
  const invalidClass = isInvalid ? ' border border-accent/50 rounded-lg' : '';

  return (
    <div className={baseClass + invalidClass}>
      <StepperInput
        valueMs={segment.durationMs}
        onChange={onDurationChange}
        aria-invalid={isInvalid}
      />
      <SoundPicker
        value={segment.endSound}
        onChange={onSoundChange}
        rowIndex={index}
        className="max-[480px]:col-span-3"
      />
      <button
        type="button"
        onClick={onDuplicate}
        aria-label="Duplicate segment"
        className="w-11 h-11 rounded-full hover:bg-white/40 active:scale-[0.95] transition-transform text-text-secondary"
      >
        ⧉
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={isOnlyRow}
        title={isOnlyRow ? 'At least one segment required' : undefined}
        aria-label="Delete segment"
        className="w-11 h-11 rounded-full hover:bg-white/40 active:scale-[0.95] transition-transform text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ×
      </button>
    </div>
  );
}
