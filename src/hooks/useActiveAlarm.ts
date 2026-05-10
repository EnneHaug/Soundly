/**
 * useActiveAlarm — Mode-dispatching hook composing useAlarm + useSegmentAlarm.
 *
 * Returns a TypeScript discriminated union (locked per CONTEXT D-07):
 *   { mode: 'idle';       start }
 *   { mode: 'continuous'; alarm: UseAlarmReturn }
 *   { mode: 'segments';   alarm: UseSegmentAlarmReturn }
 *
 * App.tsx (Phase 8 wiring plan) narrows on `mode` and renders <Countdown> or
 * <SegmentCountdown> with the right shape — no runtime cast required (RESEARCH
 * Pattern 5).
 *
 * Both useAlarm and useSegmentAlarm are mounted unconditionally per D-08
 * (always-both-mounted pattern). Engines do nothing on construction (verified
 * SegmentEngine.ts:48-73), so this is safe — no AC, Wake Lock, or notifications
 * fire until start() is called.
 *
 * Concurrency is enforced by UI takeover (D-10): once an alarm starts, the
 * Dashboard is unmounted and the user must Stop/Dismiss before they see the
 * preset cards again. So `continuous.isRunning && segments.isRunning` should
 * never be true in practice; the dispatch picks 'continuous' first as a
 * defensive default.
 *
 * pendingMode covers the microtask race between calling start() (which is async)
 * and isRunning flipping true. Without it, mode would briefly revert to 'idle'
 * between the tap and engine.start() resolving — a visual flicker.
 */

import { useState } from 'react';
import type { AlarmConfig } from '../engine/AlarmState';
import type { SegmentConfig } from '../engine/SegmentState';
import { useAlarm, type UseAlarmReturn } from './useAlarm';
import { useSegmentAlarm, type UseSegmentAlarmReturn } from './useSegmentAlarm';

export type PresetSelection =
  | { kind: 'continuous'; config: AlarmConfig }
  | { kind: 'segments'; config: SegmentConfig };

export type ActiveAlarmState =
  | { mode: 'idle'; start: (preset: PresetSelection) => Promise<void> }
  | { mode: 'continuous'; alarm: UseAlarmReturn }
  | { mode: 'segments'; alarm: UseSegmentAlarmReturn };

export function useActiveAlarm(): ActiveAlarmState {
  const continuous = useAlarm(); // always mounted (D-08)
  const segments = useSegmentAlarm(); // always mounted (D-08)
  const [pendingMode, setPendingMode] = useState<'continuous' | 'segments' | null>(null);

  // Derived mode: prefer continuous if running (defensive ordering — both shouldn't
  // run simultaneously thanks to D-10 UI takeover); pendingMode covers the
  // microtask race between start() and isRunning flipping true.
  const mode = continuous.isRunning
    ? 'continuous'
    : segments.isRunning
      ? 'segments'
      : (pendingMode ?? 'idle');

  if (mode === 'continuous') return { mode: 'continuous', alarm: continuous };
  if (mode === 'segments') return { mode: 'segments', alarm: segments };

  return {
    mode: 'idle',
    start: async (preset: PresetSelection) => {
      setPendingMode(preset.kind);
      try {
        if (preset.kind === 'continuous') {
          await continuous.start(preset.config);
        } else {
          await segments.start(preset.config);
        }
      } finally {
        setPendingMode(null);
      }
    },
  };
}
