/**
 * Generate PWA icons with a stylized "S" on the sage green background.
 * Run: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';

const BG_COLOR = '#5c6b56';  // sage green
const TEXT_COLOR = '#f4f1eb'; // warm sand

function createIconSvg(size) {
  const fontSize = Math.round(size * 0.55);
  const yOffset = Math.round(size * 0.06); // optical center adjustment
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.15)}" fill="${BG_COLOR}"/>
  <text
    x="50%" y="${50 + (yOffset / size) * 100}%"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="${fontSize}"
    font-style="italic"
    font-weight="400"
    fill="${TEXT_COLOR}"
    text-anchor="middle"
    dominant-baseline="central"
    letter-spacing="-${Math.round(size * 0.02)}"
  >S</text>
</svg>`;
}

function createMaskableIconSvg(size) {
  const fontSize = Math.round(size * 0.45); // smaller for safe zone
  const yOffset = Math.round(size * 0.05);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG_COLOR}"/>
  <text
    x="50%" y="${50 + (yOffset / size) * 100}%"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="${fontSize}"
    font-style="italic"
    font-weight="400"
    fill="${TEXT_COLOR}"
    text-anchor="middle"
    dominant-baseline="central"
    letter-spacing="-${Math.round(size * 0.02)}"
  >S</text>
</svg>`;
}

async function generate() {
  mkdirSync('public/icons', { recursive: true });

  // 192x192
  await sharp(Buffer.from(createIconSvg(192)))
    .png()
    .toFile('public/icons/icon-192x192.png');
  console.log('Created icon-192x192.png');

  // 512x512
  await sharp(Buffer.from(createIconSvg(512)))
    .png()
    .toFile('public/icons/icon-512x512.png');
  console.log('Created icon-512x512.png');

  // 512x512 maskable (no rounded corners, smaller S for safe zone)
  await sharp(Buffer.from(createMaskableIconSvg(512)))
    .png()
    .toFile('public/icons/icon-512x512-maskable.png');
  console.log('Created icon-512x512-maskable.png');
}

generate().catch(console.error);
