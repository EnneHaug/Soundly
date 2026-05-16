/**
 * SoundPicker — 3-pill ARIA radiogroup for endSound selection (D-04, D-05, D-06, D-07).
 *
 * First ARIA radiogroup in the codebase (NEW pattern per 09-PATTERNS.md:23-29).
 *
 * Locked decisions:
 *   - D-04: 3-pill segmented control 'Gentle | Triangle | Alarm', selected pill
 *     filled with SOUND_COLORS[endSound] (gentle→sage, triangle→sand, alarm→accent)
 *   - D-05: Unselected pills stroked outline on bg, hover/focus 10% tint preview
 *     via color-mix(in srgb, var(--pill-tint) 10%, transparent)
 *   - D-06: Picker uses 'Alarm' (NOT 'Wake' — calmer for form context). SegmentCountdown's
 *     SOUND_LABELS at src/components/SegmentCountdown.tsx:30-35 still uses 'Wake' for the
 *     running-alarm screen. DO NOT consolidate the two label maps — this divergence is
 *     by design per 09-CONTEXT.md D-06 LOCKED.
 *   - D-07: ArrowLeft/Right move BOTH focus and selection (wraps); ArrowUp/Down mirrored;
 *     Enter/Space implicit on <button> (click handler fires automatically)
 *
 * Roving tabindex: only the currently-selected pill is tab-focusable (tabIndex=0); the
 * other two get tabIndex=-1. Arrow keys move between pills via JS focus(). This is the
 * MDN-canonical radiogroup pattern (09-RESEARCH.md:560-647 Pattern 4).
 *
 * The selected sand pill uses text-text-primary instead of text-white because sand is
 * a light warm tone — white text would fail contrast per UI-SPEC L165-170.
 */

import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { Segment } from '../engine/SegmentState';

type SoundKey = Segment['endSound'];

const PILL_OPTIONS: ReadonlyArray<{ value: SoundKey; label: string; tint: string }> = [
  { value: 'gentle',   label: 'Gentle',   tint: 'var(--color-sage)'   },
  { value: 'triangle', label: 'Triangle', tint: 'var(--color-sand)'   },
  { value: 'alarm',    label: 'Alarm',    tint: 'var(--color-accent)' },
];

function selectedClass(sound: SoundKey): string {
  if (sound === 'gentle')   return 'bg-sage text-white font-semibold';
  if (sound === 'triangle') return 'bg-sand text-text-primary font-semibold';
  return 'bg-accent text-white font-semibold';
}

const UNSELECTED_CLASS =
  'bg-transparent text-text-secondary ' +
  'hover:bg-[color-mix(in_srgb,var(--pill-tint)_10%,transparent)] ' +
  'focus-visible:bg-[color-mix(in_srgb,var(--pill-tint)_10%,transparent)]';

interface SoundPickerProps {
  value: SoundKey;
  onChange: (next: SoundKey) => void;
  rowIndex?: number;
  className?: string;
}

export default function SoundPicker({ value, onChange, rowIndex, className }: SoundPickerProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([null, null, null]);
  const currentIdx = PILL_OPTIONS.findIndex((p) => p.value === value);

  function handlePickerKeyDown(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (idx + 1) % PILL_OPTIONS.length;
      onChange(PILL_OPTIONS[next].value);
      refs.current[next]?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (idx - 1 + PILL_OPTIONS.length) % PILL_OPTIONS.length;
      onChange(PILL_OPTIONS[prev].value);
      refs.current[prev]?.focus();
    }
    // Enter/Space: implicit on <button> — click handler fires automatically.
  }

  const ariaLabel =
    rowIndex !== undefined ? `Segment ${rowIndex + 1} sound` : 'End-of-segment sound';

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex items-stretch rounded-xl border border-border bg-bg p-1 gap-1 ${className ?? ''}`}
    >
      {PILL_OPTIONS.map((opt, i) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={i === currentIdx ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handlePickerKeyDown(e, i)}
            style={{ ['--pill-tint' as never]: opt.tint }}
            className={
              'flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm transition-colors ' +
              (isSelected ? selectedClass(opt.value) : UNSELECTED_CLASS)
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
