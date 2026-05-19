/**
 * Generate the 1200×630 Open Graph share-card image (Phase 10 / SEO-02).
 * Run: node scripts/generate-og-image.mjs
 *
 * Output: public/og-image-v1.png — versioned filename per D-10 / SEO-08
 * so future image swaps (og-image-v2.png) defeat Facebook's OG cache.
 *
 * Palette is the warm-earth source-of-truth from src/index.css @theme block.
 * Sharp + librsvg renders Georgia + system-ui fonts without registration
 * (proven by scripts/generate-icons.mjs on Windows/macOS/Linux).
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, '..', 'public', 'og-image-v1.png');

// Palette — copied from src/index.css @theme block (warm earth)
const WARM_EARTH_BG = '#f4f1eb';   // --color-bg
const SAGE = '#5c6b56';            // --color-sage
const TEXT_PRIMARY = '#3d4a38';    // --color-text-primary

function createOgSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${WARM_EARTH_BG}"/>
  <!-- Decorative ring glyph (singing-bowl / chime reference) -->
  <circle cx="240" cy="315" r="80" fill="none" stroke="${SAGE}" stroke-width="14"/>
  <circle cx="240" cy="315" r="120" fill="none" stroke="${SAGE}" stroke-width="6" opacity="0.35"/>
  <!-- Wordmark — Georgia italic per project icon convention -->
  <text
    x="380" y="305"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="140"
    font-style="italic"
    font-weight="400"
    fill="${SAGE}"
    dominant-baseline="middle"
  >Soundly</text>
  <!-- Tagline — system-ui sans, deep forest -->
  <text
    x="380" y="395"
    font-family="system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif"
    font-size="42"
    font-weight="400"
    fill="${TEXT_PRIMARY}"
  >a calmer alarm</text>
</svg>`;
}

async function generate() {
  await sharp(Buffer.from(createOgSvg()))
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
  console.log(`Created ${outputPath}`);
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
