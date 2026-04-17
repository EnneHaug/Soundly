/**
 * Dashboard — the primary screen users see when the alarm is not running.
 *
 * Shows two preset cards (Quick Nap and Focus) as large tappable targets,
 * a Test Sound button, and an iOS install banner (if applicable).
 *
 * Design decisions (UX-01, UX-04, D-11, D-12, D-13):
 * - Warm earth palette via Tailwind theme variables
 * - Generous vertical spacing for zen aesthetic
 * - Cards start alarm immediately on tap — no confirmation dialog
 */

import { QUICK_NAP_CONFIG, FOCUS_CONFIG } from '../engine';
import { UseAlarmReturn } from '../hooks/useAlarm';
import PresetCard from './PresetCard';
import TestSoundButton from './TestSoundButton';
import IosInstallBanner from './IosInstallBanner';

interface DashboardProps {
  alarm: UseAlarmReturn;
}

export default function Dashboard({ alarm }: DashboardProps) {
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
          onStart={() => alarm.start(QUICK_NAP_CONFIG)}
        />
        <PresetCard
          name="Focus"
          description="21 min gentle, 2 min nudge, wake"
          onStart={() => alarm.start(FOCUS_CONFIG)}
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
