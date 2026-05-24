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

// ─── Phase 11: dist/app/index.html SEO meta ──────────────────────────
if (!existsSync('dist/app/index.html')) {
  fail('dist/app/index.html does not exist — verify vite.config.ts build.rollupOptions.input.app key resolves to app/index.html');
}
const appHtml = readFileSync('dist/app/index.html', 'utf8');

const appSeoSubstrings = [
  'og:title', 'og:description', 'og:image', 'twitter:card',
  'rel="canonical"', 'application/ld+json', '"WebApplication"',
  'UtilitiesApplication', '/Soundly/app/',
];
for (const needle of appSeoSubstrings) {
  if (!appHtml.includes(needle)) fail(`dist/app/index.html missing SEO substring: ${needle}`);
}
ok(`dist/app/index.html contains all ${appSeoSubstrings.length} SEO substrings`);

// ─── Phase 11: app shell JSON-LD parse + /Soundly/app/ url ──────────
const appLdMatch = appHtml.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/);
if (!appLdMatch) fail('dist/app/index.html missing JSON-LD <script> block');
let appLd;
try {
  appLd = JSON.parse(appLdMatch[1]);
} catch (e) {
  fail(`dist/app/index.html JSON-LD is invalid JSON: ${e.message}`);
}
if (appLd['@type'] !== 'WebApplication') fail(`dist/app/ JSON-LD @type wrong: ${appLd['@type']}`);
if (!String(appLd['url']).endsWith('/Soundly/app/')) fail(`dist/app/ JSON-LD url must end with /Soundly/app/; got: ${appLd['url']}`);
ok('dist/app/index.html JSON-LD parses + @type=WebApplication + url ends with /Soundly/app/');

// ─── Phase 11 / Q4 RESOLVED check: <link rel="manifest"> on app shell ─
// RESEARCH Q4 OPEN — verify vite-plugin-pwa auto-injects the manifest link
// on app/index.html post-split. If FAIL: add an explicit
// <link rel="manifest" href="/Soundly/manifest.webmanifest"> to
// app/index.html source per Phase 10 D-25 pattern.
if (!/<link\s+rel="manifest"/i.test(appHtml)) {
  fail(
    'dist/app/index.html missing `<link rel="manifest" ...>` (Q4 OPEN) — ' +
    'fallback: add explicit <link rel="manifest" href="/Soundly/manifest.webmanifest"> to app/index.html'
  );
}
ok('dist/app/index.html contains <link rel="manifest" ...> (Q4 RESOLVED confirmed)');

// ─── 4. dist/ static assets exist (D-27 + Phase 11) ──────────────────
const requiredAssets = [
  'dist/og-image-v1.png',
  'dist/screenshot-composer-v1.png',  // NEW Phase 11 (D-LAND-13)
  'dist/robots.txt',
  'dist/sitemap.xml',
  'dist/sw.js',
  'dist/app/index.html',              // NEW Phase 11 (LAND-06 multi-page emit)
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

// ─── Phase 11: screenshot size cap (mirror OG image discipline, D-LAND-13) ─
const ssSize = statSync('dist/screenshot-composer-v1.png').size;
if (ssSize > 204800) fail(`dist/screenshot-composer-v1.png exceeds 200 KB cap: ${ssSize} bytes`);
if (ssSize < 1000) fail(`dist/screenshot-composer-v1.png suspiciously small: ${ssSize} bytes`);
ok(`dist/screenshot-composer-v1.png size: ${ssSize} bytes (within bounds)`);

// ─── 6. dist/sw.js contains skipWaiting + clientsClaim (SEO-09) ──────
// vite/workbox MAY minify clientsClaim to a shorter identifier — accept
// both the function-name token and the underlying `clients.claim` call.
const sw = readFileSync('dist/sw.js', 'utf8');
if (!/skipWaiting/.test(sw)) fail('dist/sw.js missing skipWaiting reference');
if (!/clientsClaim|clients\.claim/.test(sw)) fail('dist/sw.js missing clientsClaim/clients.claim reference');
ok('dist/sw.js contains skipWaiting + clientsClaim references');

// ─── Phase 11 / Pitfall A coupling enforcement: dist/sw.js has allowlist ──
// If this fails, the SW rescoping (Plan 11-04) did NOT ship — Pitfall A
// triggers (installed users see stale precached /Soundly/index.html).
// Together with the requiredAssets dist/app/index.html check, this ensures
// both halves of Phase 11 (manifest + SW) shipped in the same deploy.
if (!/allowlist/.test(sw)) {
  fail('dist/sw.js missing allowlist reference — Phase 11 SW rescope (Plan 11-04) did not ship');
}
ok('dist/sw.js contains allowlist (SW rescope confirmed — Pitfall A gate passed)');

// ─── DONE ─────────────────────────────────────────────────────────────
console.log('[verify-phase-10-build] Phase 10 + Phase 11 final build verification: ALL OK');
