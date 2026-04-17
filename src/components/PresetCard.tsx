/**
 * PresetCard — tappable card that starts an alarm preset immediately (D-11, D-12).
 *
 * Renders as a <button> for accessibility. Tapping calls onStart() directly with
 * no confirmation dialog, matching the fast-start UX decision (D-12).
 *
 * Touch target: min-h-[80px] exceeds the 48px minimum for mobile accessibility.
 */

interface PresetCardProps {
  name: string;        // "Quick Nap" or "Focus"
  description: string; // Human-readable phase breakdown
  onStart: () => void; // Calls alarm.start(config)
}

export default function PresetCard({ name, description, onStart }: PresetCardProps) {
  return (
    <button
      onClick={onStart}
      className="w-full p-6 rounded-2xl border border-border bg-white/60 text-left min-h-[80px] active:scale-[0.98] transition-transform duration-150"
      type="button"
    >
      <p className="text-xl font-semibold text-text-primary">{name}</p>
      <p className="text-sm text-text-secondary mt-1">{description}</p>
    </button>
  );
}
