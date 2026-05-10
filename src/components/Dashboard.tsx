/**
 * Dashboard — the primary screen users see when the alarm is not running.
 *
 * Shows three preset cards (Quick Nap, Focus, and the "4 x 4" Wake Easy preset)
 * as large tappable targets, a Test Sound button, and an iOS install banner
 * (if applicable).
 *
 * Design decisions (UX-01, UX-04, D-11, D-12, D-13, D-14):
 * - Warm earth palette via Tailwind theme variables
 * - Generous vertical spacing for zen aesthetic
 * - Cards start alarm immediately on tap — no confirmation dialog
 * - The third card carries the user-facing label "4 x 4" (single ASCII spaces,
 *   not Unicode ×) and dispatches the segment-mode WAKE_EASY_CONFIG preset.
 *   Internal symbol naming keeps "Wake Easy" per D-13; only the UI label diverges.
 * - Phase 8 D-14: Dashboard's prop signature changed from { alarm: UseAlarmReturn }
 *   to the idle-mode variant of ActiveAlarmState. The dispatcher's
 *   start(preset: PresetSelection) routes between continuous and segments engines.
 */

import { QUICK_NAP_CONFIG, FOCUS_CONFIG, WAKE_EASY_CONFIG } from '../engine';
import type { ActiveAlarmState } from '../hooks/useActiveAlarm';
import PresetCard from './PresetCard';
import TestSoundButton from './TestSoundButton';
import IosInstallBanner from './IosInstallBanner';

interface DashboardProps {
  activeAlarm: Extract<ActiveAlarmState, { mode: 'idle' }>;
}

export default function Dashboard({ activeAlarm }: DashboardProps) {
  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto px-6 py-12">
      {/* Header */}
      <h1 className="text-3xl font-semibold text-sage tracking-tight">Soundly</h1>
      <p className="text-text-secondary text-sm mt-1">gentle alarm</p>

      {/* Preset cards */}
      <div className="mt-10 w-full flex flex-col gap-4">
        <PresetCard
          name="Quick Nap"
          description="5 min gentle, 5 min nudge, wake"
          onStart={() => activeAlarm.start({ kind: 'continuous', config: QUICK_NAP_CONFIG })}
        />
        <PresetCard
          name="Focus"
          description="21 min gentle, 2 min nudge, wake"
          onStart={() => activeAlarm.start({ kind: 'continuous', config: FOCUS_CONFIG })}
        />
        <PresetCard
          name="4 x 4"
          description="4 chimes over 16 min, then alarm"
          onStart={() => activeAlarm.start({ kind: 'segments', config: WAKE_EASY_CONFIG })}
        />
      </div>

      {/* Test Sound button */}
      <div className="mt-8">
        <TestSoundButton />
      </div>

      {/* iOS install banner — only renders on non-installed iOS Safari */}
      <div className="mt-6 w-full">
        <IosInstallBanner />
      </div>

    </div>
  );
}
