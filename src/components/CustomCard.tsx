/**
 * CustomCard — the 4th Dashboard card (D-08 LOCKED, after the 4 x 4 card).
 *
 * Parallel-file pattern per CONTEXT.md `canonical_refs` strong preference for parallel
 * CustomCard.tsx (see 09-CONTEXT.md `<canonical_refs>` section) and RESEARCH Pattern 8
 * (09-RESEARCH.md:954-994): PresetCard.tsx is treated as frozen (CONTEXT.md
 * `canonical_refs` "strong preference"); cloning the shell into a sibling file is the
 * cleaner path than extending PresetCard with a variant prop. Visual deltas (D-09 LOCKED):
 *   - Border: border-2 border-dashed (vs PresetCard's border)
 *   - Background: bg-bg (vs PresetCard's bg-white/60) — creative space, not preset surface
 *   - '+' glyph in the top-left of an inner flex row, sage color
 *   - Hover deepens the border tone instead of scaling
 *   - Explicit focus-visible ring (dashed border weakens the default browser ring)
 *
 * Prop signature differs intentionally: onClick (opens composer modal) instead of
 * onStart (PresetCard's "launch an alarm" semantic). Labels are baked in — there's
 * only one CustomCard in the app.
 */

interface CustomCardProps {
  onClick: () => void;
}

export default function CustomCard({ onClick }: CustomCardProps) {
  return (
    <button
      onClick={onClick}
      type="button"
      aria-label="Open custom alarm composer"
      className="w-full p-6 rounded-2xl border-2 border-dashed border-border bg-bg text-left min-h-[80px] active:scale-[0.98] transition-transform duration-150 hover:border-text-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-2xl text-sage font-light leading-none mt-0.5">+</span>
        <div className="flex-1">
          <p className="text-xl font-semibold text-text-primary">Custom</p>
          <p className="text-sm text-text-secondary mt-1">Compose your own alarm</p>
        </div>
      </div>
    </button>
  );
}
