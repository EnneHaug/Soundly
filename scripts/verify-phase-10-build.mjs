/**
 * Phase 10 / SEO-01..09 — Final build verification (D-27).
 *
 * Run: node scripts/verify-phase-10-build.mjs
 *   (Prereq: `npm run build` has been run; `dist/` exists and is fresh.)
 *
 * Asserts the production dist/ output contains every SEO artifact + the
 * vite-plugin-pwa manifest link injection (Q3 RESOLVED from RESEARCH.md
 * Open Questions — confirms `<link rel="manifest" ...>` is auto-injected
 * under `injectManifest` strategy with the current vite.config.ts setup).
 *
 * Standalone Node script (NOT inline `node -e`) — eliminates Windows
 * PowerShell quoting hazards (chain operators differ between bash and
 * PowerShell; PS 5.1 lacks `&&`). Runs identically under bash, PowerShell,
 * and cmd.
 */
import { readFileSync, statSync, existsSync } from 'node:fs';

function fail(msg) {
  console.error(`[verify-phase-10-build] FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`[verify-phase-10-build] OK: ${msg}`);
}

// ─── 1. dist/index.html SEO meta (D-24, D-27) ────────────────────────
if (!existsSync('dist/index.html')) {
  fail('dist/index.html does not exist — run `npm run build` first');
}
const html = readFileSync('dist/index.html', 'utf8');

const seoSubstrings = [
  'og:title',
  'og:description',
  'og:image',
  'twitter:card',
  'rel="canonical"',
  'application/ld+json',
  '"WebApplication"',
  'UtilitiesApplication',
];
for (const needle of seoSubstrings) {
  if (!html.includes(needle)) fail(`dist/index.html missing SEO substring: ${needle}`);
}
ok(`dist/index.html contains all ${seoSubstrings.length} SEO substrings`);

// ─── 2. Q3 RESOLVED: vite-plugin-pwa auto-injects <link rel="manifest"> ─
// Per RESEARCH.md Open Questions Q3: confirms vite-plugin-pwa 0.21.x with
// `injectManifest` strategy + current vite.config.ts setup auto-injects the
// manifest link. If this FAILS, the fallback (CONTEXT D-25) is to add an
// explicit `<link rel="manifest" href="/Soundly/manifest.webmanifest">` to
// index.html source — but the prediction (RESEARCH Q3 RESOLVED with
// CONFIDENCE: MEDIUM) is that it's auto-injected. This check makes the
// verdict observable + actionable rather than silently assumed.
if (!/<link\s+rel="manifest"/i.test(html)) {
  fail(
    'dist/index.html missing `<link rel="manifest" ...>` (Q3 RESOLVED check) — ' +
      'fallback: add `<link rel="manifest" href="/Soundly/manifest.webmanifest">` to index.html source ' +
      'per CONTEXT D-25, then re-run build'
  );
}
ok('dist/index.html contains <link rel="manifest" ...> (Q3 RESOLVED confirmed)');

// ─── 3. dist/ JSON-LD parses + has @type: WebApplication (Pitfall 4) ──
const ldMatch = html.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/);
if (!ldMatch) fail('dist/index.html missing JSON-LD <script> block');
let ld;
try {
  ld = JSON.parse(ldMatch[1]);
} catch (e) {
  fail(`dist/index.html JSON-LD is invalid JSON: ${e.message}`);
}
if (ld['@type'] !== 'WebApplication') fail(`dist/ JSON-LD @type wrong: ${ld['@type']}`);
ok('dist/index.html JSON-LD parses + @type=WebApplication');

// ─── 4. dist/ static assets exist (D-27) ─────────────────────────────
const requiredAssets = [
  'dist/og-image-v1.png',
  'dist/robots.txt',
  'dist/sitemap.xml',
  'dist/sw.js',
];
for (const path of requiredAssets) {
  if (!existsSync(path)) fail(`required dist asset missing: ${path}`);
}
ok(`all ${requiredAssets.length} dist/ static assets present`);

// ─── 5. OG image size cap (SEO-02 ≤ 200 KB) ──────────────────────────
const ogSize = statSync('dist/og-image-v1.png').size;
if (ogSize > 204800) fail(`dist/og-image-v1.png exceeds 200 KB cap: ${ogSize} bytes`);
if (ogSize < 1000) fail(`dist/og-image-v1.png suspiciously small: ${ogSize} bytes`);
ok(`dist/og-image-v1.png size: ${ogSize} bytes (within bounds)`);

// ─── 6. dist/sw.js contains skipWaiting + clientsClaim (SEO-09) ──────
// vite/workbox MAY minify clientsClaim to a shorter identifier — accept
// both the function-name token and the underlying `clients.claim` call.
const sw = readFileSync('dist/sw.js', 'utf8');
if (!/skipWaiting/.test(sw)) fail('dist/sw.js missing skipWaiting reference');
if (!/clientsClaim|clients\.claim/.test(sw)) fail('dist/sw.js missing clientsClaim/clients.claim reference');
ok('dist/sw.js contains skipWaiting + clientsClaim references');

// ─── DONE ─────────────────────────────────────────────────────────────
console.log('[verify-phase-10-build] Phase 10 final build verification: ALL OK');
