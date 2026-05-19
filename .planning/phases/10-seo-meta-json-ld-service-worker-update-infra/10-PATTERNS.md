# Phase 10: SEO Meta + JSON-LD + Service Worker Update Infra — Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 9 (5 created, 4 modified)
**Analogs found:** 9 / 9 (the 1 generated PNG artifact has no source analog but reuses the icon-generator script pattern; the deploy runbook has no in-repo analog and uses RESEARCH.md Finding 11 + general README conventions)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/generate-og-image.mjs` | utility (build-time helper) | file-I/O (SVG-string -> PNG-on-disk) | `scripts/generate-icons.mjs` | exact (same idiom, same dep, same target dir) |
| `public/og-image-v1.png` | static asset (generated, committed) | file-I/O (produced by generator) | `public/icons/icon-192x192.png` | role-match (PNG produced by sharp; binary output, no source analog) |
| `public/robots.txt` | config (static text asset) | request-response (HTTP GET passthrough) | `public/icons/*.png` (only existing public/ contents) | partial — first non-icon static asset in `public/`; pattern is "Vite copies `public/*` to `dist/*` byte-for-byte" |
| `public/sitemap.xml` | config (static XML asset) | request-response (HTTP GET passthrough) | `public/icons/*.png` | partial — same `public/` passthrough convention; XML content is hand-authored per CONTEXT verbatim |
| `index.html` (modify) | config (HTML entry, static head metadata) | request-response (served pre-hydration) | `index.html` itself (self-analog; ADDITIVE edit) | exact — keep all existing tags, append new tags in `<head>` |
| `vite.config.ts` (modify) | config (build config) | build-time | `vite.config.ts` itself (self-analog; single-line addition inside `VitePWA({...})`) | exact |
| `src/sw.ts` (modify) | service worker (browser runtime, install/activate lifecycle) | event-driven (lifecycle events) | `src/sw.ts` itself (self-analog; APPEND-only after the `notificationclick` handler) | exact — existing top-level `cleanupOutdatedCaches()` call shows the project's "call workbox helpers at module scope" pattern |
| `package.json` (modify) | config (manifest) | build-time | `package.json` itself (self-analog; add one entry to `scripts`) | exact |
| `docs/deploy-runbook.md` | docs (operator playbook) | n/a (human-read documentation) | No in-repo Markdown docs (only `README.md` is one line); pattern derives from RESEARCH.md §"Finding 11 — Deploy runbook structure" | no analog — see "No Analog Found" below |

---

## Pattern Assignments

### `scripts/generate-og-image.mjs` (utility, file-I/O)

**Analog:** `scripts/generate-icons.mjs` — same project, same dependency (`sharp`), same SVG-string -> PNG-to-disk recipe, proven to render Georgia serif on Windows without font registration.

**Header comment + import pattern** (`scripts/generate-icons.mjs:1-6`):
```js
/**
 * Generate PWA icons with a stylized "S" on the sage green background.
 * Run: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
```
Copy the header-block convention: a leading JSDoc `/** … */` comment describing purpose + a `Run: node scripts/<name>.mjs` line. For the OG image, only `sharp` is needed (no `mkdirSync` — `public/` already exists). Optionally add `import { fileURLToPath } from 'node:url'` + `import { dirname, resolve } from 'node:path'` per RESEARCH.md Finding 5 if absolute path resolution is preferred over `generate-icons.mjs`'s relative-string approach.

**Palette constants pattern** (`scripts/generate-icons.mjs:8-9`):
```js
const BG_COLOR = '#5c6b56';  // sage green
const TEXT_COLOR = '#f4f1eb'; // warm sand
```
Use ALL-CAPS module-level constants for palette hex values, with a trailing comment naming the swatch. Source the OG-image hex values from `src/index.css:5-11` (the `@theme` block):
- `--color-bg` = `#f4f1eb` (warm sand)
- `--color-sage` = `#5c6b56`
- `--color-text-primary` = `#3d4a38`

**SVG builder function pattern** (`scripts/generate-icons.mjs:11-28`):
```js
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
```
Mirror this for the OG image: a named SVG-builder function returning a template literal. Reuse the existing `font-family="Georgia, 'Times New Roman', serif"` declaration verbatim — it is the project's proven cross-platform serif stack for sharp's librsvg renderer. For the tagline, RESEARCH.md Finding 5 recommends `font-family="system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif"`.

**Sharp render + write pattern** (`scripts/generate-icons.mjs:49-67`):
```js
async function generate() {
  mkdirSync('public/icons', { recursive: true });

  // 192x192
  await sharp(Buffer.from(createIconSvg(192)))
    .png()
    .toFile('public/icons/icon-192x192.png');
  console.log('Created icon-192x192.png');
  // ...
}

generate().catch(console.error);
```
Copy this three-line core idiom verbatim: `sharp(Buffer.from(svg)).png().toFile(path)`, followed by a `console.log` confirmation. The top-level `async function generate() { … } generate().catch(console.error)` wrapper is the project's idiomatic Node CLI shape — reuse it.

**Differences vs the icon-generator** (intentional):
- Single output file (no loop over sizes).
- Output path is `public/og-image-v1.png` (not under `public/icons/`).
- No `mkdirSync` (target directory exists).
- Optional: pass `.png({ compressionLevel: 9 })` per RESEARCH.md Finding 5 — but the icon generator omits the option and gets the same level-9 default; staying consistent with the analog is acceptable.

---

### `public/og-image-v1.png` (static asset, file-I/O)

**Analog:** `public/icons/icon-192x192.png` (binary PNG produced by sharp from the icon generator; committed to git).

**Pattern:** Generator-produced PNG, committed to git, served byte-identical by Vite's `public/` passthrough. No source pattern to copy beyond the generator script itself (above). The Phase 10 D-09 user-approval checkpoint gates the commit — see CONTEXT.md `<specifics>` "Acceptance checkpoint flow."

**Filename versioning** (project-new pattern, per CONTEXT D-10): `og-image-v1.png` (not `og-image.png`). Future swaps go to `og-image-v2.png` to defeat Facebook's OG-image URL cache. No analog for this versioning convention in the repo; introduced by Phase 10.

---

### `public/robots.txt` (config, request-response)

**Analog:** `public/icons/icon-192x192.png` (only existing `public/` content) — the analog is the directory convention, not the file content.

**Pattern:** Vite copies every file in `public/` to `dist/` byte-for-byte. The deployed URL is `<base>/<filename>` where `<base>` is `/Soundly/` per `vite.config.ts:7`. No build-time processing; whatever is in the file is what ships.

**File content** (verbatim from CONTEXT.md D-20):
```
User-agent: *
Allow: /
Sitemap: https://soundly.local/Soundly/sitemap.xml
```

**Conventions to apply:**
- Trailing newline at end of file (POSIX text convention).
- No BOM, LF line endings (matches every other text file in the repo per `.gitignore`/editor defaults).
- The `https://soundly.local/Soundly/` is a deliberate placeholder per CONTEXT D-23; the user swaps to actual deploy URL before publishing (deploy runbook step).

---

### `public/sitemap.xml` (config, request-response)

**Analog:** `public/icons/icon-192x192.png` (same directory convention as robots.txt).

**Pattern:** Same `public/` passthrough as robots.txt. Hand-authored XML, no plugin (CONTEXT D-22 rejects `vite-plugin-sitemap`).

**File content** (verbatim from CONTEXT.md D-21/D-22 and `<specifics>` block):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://soundly.local/Soundly/</loc>
    <lastmod>2026-05-16</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://soundly.local/Soundly/app/</loc>
    <lastmod>2026-05-16</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

**Conventions to apply:**
- 2-space indentation (matches the project's TypeScript/JSON indentation in `src/`).
- `<lastmod>` = 2026-05-16 (CONTEXT-locked placeholder; manually bumped on subsequent meta changes).
- Same canonical-URL placeholder pattern as robots.txt.

---

### `index.html` — modified (config, request-response)

**Analog:** `index.html` itself (the existing file is the analog — Phase 10 is purely ADDITIVE; the existing apple-touch / theme-color tags are preserved per CONTEXT D-26).

**Existing structure** (`index.html:1-17` — current state):
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#5c6b56" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Soundly" />
    <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
    <title>Soundly</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Patterns to extract from the existing head:**
1. **Self-closing `<meta />` style with single space before `/>`** — matches HTML5 convention used by the existing apple tags; apply to all new `<meta>` tags.
2. **2-space indentation inside `<head>`** — every new tag indents to match the existing block.
3. **Attribute order** — `name="…"` or `property="…"` first, then `content="…"` (matches existing apple tags).
4. **No blank lines between meta groups** in the current file — Phase 10 MAY introduce HTML comment dividers (`<!-- SEO meta (Phase 10) -->`, `<!-- Open Graph -->`, `<!-- Twitter Card -->`, `<!-- JSON-LD (D-12) -->`) per CONTEXT `<specifics>`, since the meta block grows from 4 tags to ~15 and grouping aids readability.

**Title rewrite pattern** (modifies line 11 in-place):
- Existing: `<title>Soundly</title>`
- New: `<title>Soundly — a calmer alarm that alerts you gently</title>` (CONTEXT D-01 verbatim, em-dash `—` U+2014)

**Meta block to append** (verbatim from CONTEXT.md `<specifics>` — paste between the `<link rel="apple-touch-icon" />` and `<title>` lines, OR after `<title>` — CONTEXT does not lock placement, planner discretion):
```html
<!-- SEO meta (Phase 10) -->
<meta name="description" content="A free alarm app with soft sounds, vibration, or full volume — fully customizable. No accounts, no ads. Just share your setup. PWA — installs anywhere." />
<link rel="canonical" href="https://soundly.local/Soundly/" />

<!-- Open Graph -->
<meta property="og:type" content="website" />
<meta property="og:title" content="Soundly — gentle alarm" />
<meta property="og:description" content="A free alarm app with soft sounds or vibration or full volume - fully customizable. No accounts, no ads, just share your alarm setup. Progressive Web App (PWA), install on phone or desktop." />
<meta property="og:image" content="https://soundly.local/Soundly/og-image-v1.png" />
<meta property="og:url" content="https://soundly.local/Soundly/" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Soundly — gentle alarm" />
<meta name="twitter:description" content="A free alarm app with soft sounds or vibration or full volume - fully customizable. No accounts, no ads, just share your alarm setup. Progressive Web App (PWA), install on phone or desktop." />
<meta name="twitter:image" content="https://soundly.local/Soundly/og-image-v1.png" />

<!-- JSON-LD (D-12) -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Soundly Gentle Alarm",
  "description": "A free alarm app with soft sounds or vibration or full volume - fully customizable. No accounts, no ads, just share your alarm setup. Progressive Web App (PWA), install on phone or desktop.",
  "applicationCategory": "UtilitiesApplication",
  "operatingSystem": "Web Browser",
  "url": "https://soundly.local/Soundly/"
}
</script>
```

**Preservation rule (CONTEXT D-26):** Do NOT remove or modify `theme-color`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, `apple-touch-icon`. Phase 10 only ADDS.

---

### `vite.config.ts` — modified (config, build-time)

**Analog:** `vite.config.ts` itself (single-line addition to the existing `VitePWA({...})` block at line 11-33).

**Existing structure** (`vite.config.ts:11-33`):
```ts
VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  manifest: { … },
  devOptions: {
    enabled: true,
    type: 'module',
  },
}),
```

**Patterns to extract:**
1. **2-space indentation, trailing-comma object literals** — match exactly.
2. **Top-level VitePWA options appear before nested `manifest` / `devOptions`** — `registerType` is a top-level option, so insert it BEFORE `strategies:` (first line inside `VitePWA({` is canonical for `registerType` per official vite-plugin-pwa docs).

**The single-line addition** (insert after line 11, before `strategies:`):
```ts
VitePWA({
  registerType: 'autoUpdate',  // SEO-09: client-side auto-update directive (D-16)
  strategies: 'injectManifest',
  // ... existing options unchanged
}),
```

**Preservation rule (CONTEXT D-19):** Do NOT touch `devOptions.enabled: true`; CONTEXT explicitly preserves it.

---

### `src/sw.ts` — modified (service worker, event-driven)

**Analog:** `src/sw.ts` itself (the existing file — Phase 10 APPENDS after the `notificationclick` handler at line 41, and adds ONE new import).

**Existing import pattern** (`src/sw.ts:3-4`):
```ts
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
```
Pattern: each `workbox-*` package gets its own import line; destructured named imports; single quotes; semicolons. The new `clientsClaim` import follows the same shape:
```ts
import { clientsClaim } from 'workbox-core';
```
Insert this as the third import (alphabetical-ish ordering, matches the existing `workbox-*` grouping). RESEARCH.md Finding 2 + Open Question #1 note that `workbox-core@7.4.0` is transitively present; optional belt-and-suspenders is adding `workbox-core: ^7.4.0` to `package.json` devDependencies.

**Existing module-level workbox-call pattern** (`src/sw.ts:9-12`):
```ts
// Clean up old caches from previous versions
cleanupOutdatedCaches();

// Precache static assets injected by vite-plugin-pwa at build time
precacheAndRoute(self.__WB_MANIFEST);
```
Pattern: top-level workbox helper calls, each preceded by a short comment explaining purpose. The new `self.skipWaiting()` + `clientsClaim()` calls follow this same shape: top-level, with a 2-3 line comment block above explaining why.

**Existing event-listener pattern** (`src/sw.ts:26-41`):
```ts
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList: readonly Client[]) => {
        // ...
      })
  );
});
```
Pattern: `self.addEventListener('<event>', (event) => { event.waitUntil(...) })`. RESEARCH.md Finding 2 RECOMMENDS using the workbox helper `clientsClaim()` rather than hand-writing `self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))` — both are functionally equivalent; the helper saves three lines and avoids a "claim called before activation" runtime exception. CONTEXT D-17 allows either spelling; defer to RESEARCH.md recommendation.

**Append after line 41** (verbatim from RESEARCH.md Finding 2):
```ts
// Take control of the page immediately on activation (Phase 10 / SEO-09).
// Combined with registerType: 'autoUpdate' in vite.config.ts, installed PWA
// users receive updated meta + content on next launch without manual reload.
// `clientsClaim()` from workbox-core wraps self.clients.claim() in the correct
// activate-event listener internally — see workbox-core docs.
self.skipWaiting();
clientsClaim();
```

**Preservation rule (CONTEXT D-17):** Do NOT modify `cleanupOutdatedCaches()`, `precacheAndRoute`, the NavigationRoute setup, or the `notificationclick` handler. Phase 10 only APPENDS.

---

### `package.json` — modified (config, build-time)

**Analog:** `package.json` itself (single key addition to existing `scripts` object).

**Existing scripts block** (extracted from the minified `package.json`):
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest"
}
```

**The single addition** (RESEARCH.md Pattern 4):
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest",
  "og-image": "node scripts/generate-og-image.mjs"
}
```

**Format quirk:** `package.json` in this repo is currently a **single-line minified JSON** (all 642 bytes on one line). Preserve this format — either keep minified, or expand to multi-line (npm tolerates both). If the planner unminifies, document in the SUMMARY so the diff is reviewable. Recommendation: keep minified to match existing project state, edit as a surgical string insertion.

---

### `docs/deploy-runbook.md` — new (docs)

**Analog:** None in repo (`README.md` is one line; no other markdown docs exist outside `.planning/`). Use RESEARCH.md "Finding 11 — Deploy runbook structure" as the content template.

**Conventions to apply** (from project-wide observation):
- The `.planning/` directory uses Markdown extensively with `<section>` HTML tags as soft delimiters; `docs/` is a new top-level directory introduced here.
- CONTEXT D-28 allows EITHER `docs/deploy-runbook.md` OR appending to a top-level `DEPLOY.md` — Claude's Discretion. Recommendation: create `docs/deploy-runbook.md` (new dir, single-purpose file) to keep the top level clean.
- Use ATX-style `#` headers, GFM checklists for the deploy steps.

**Required content (from CONTEXT D-28):**
1. Swap placeholder canonical URL `https://soundly.local/Soundly/` to actual deploy URL in `index.html`, `public/robots.txt`, `public/sitemap.xml`.
2. Generate / accept the `og-image-v1.png` via the `npm run og-image` command + D-09 approval flow.
3. `npm run build` + deploy.
4. Submit `sitemap.xml` to Google Search Console (manual step — GitHub Pages does not auto-discover).
5. Force-refresh Facebook Sharing Debugger (https://developers.facebook.com/tools/debug/) after content changes so OG previews update for users who shared earlier URLs.

---

## Shared Patterns

### Static-asset test pattern (RESEARCH.md Pattern 5)

**Source:** RESEARCH.md §"Pattern 5: Static-asset test (text-regex assertions)" lines 842-889; vitest harness already configured per `vitest.config.ts` + existing pure-function test pattern at `src/lib/__tests__/shareUrl.test.ts:1-5`.

**Apply to:** A NEW test file `tests/static-assets.test.ts` (top-level `tests/` dir, NOT `src/`, because this asserts on source files at the repo root). Covers SEO-01..08 + the source-regex parts of SEO-09.

**Existing pure-function test idiom (from `src/lib/__tests__/shareUrl.test.ts:1-9`):**
```ts
import { describe, it, expect } from 'vitest';
import { encodeComposition, decodeComposition } from '../shareUrl';
// ...
describe('encodeComposition', () => {
  it('encodes WAKE_EASY_CONFIG to the exact D-16 locked string', () => {
    const encoded = encodeComposition(WAKE_EASY_CONFIG);
    expect(encoded).toBe('v1:240000-0,240000-0,240000-0,240000-0,60000-2');
  });
});
```
Match this style: top-level `import { describe, it, expect } from 'vitest'`, no `vi`/`beforeEach` ceremony for synchronous file-read assertions, one `describe` per logical concern, named assertions per requirement ID where possible.

**Concrete test scaffold (from RESEARCH.md lines 844-889):**
```ts
// tests/static-assets.test.ts — NEW
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '..');
const indexHtml = readFileSync(resolve(repoRoot, 'index.html'), 'utf8');

describe('index.html SEO meta', () => {
  it('contains the static og:title', () => {
    expect(indexHtml).toMatch(/<meta\s+property="og:title"\s+content="Soundly — gentle alarm"/);
  });
  it('contains the canonical link', () => {
    expect(indexHtml).toMatch(/<link\s+rel="canonical"\s+href="https:\/\/[^"]+"/);
  });
  it('contains a parseable JSON-LD WebApplication block', () => {
    const match = indexHtml.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const parsed = JSON.parse(match![1]);
    expect(parsed['@type']).toBe('WebApplication');
    expect(parsed['applicationCategory']).toBe('UtilitiesApplication');
    expect(parsed['name']).toBeTruthy();
  });
});

describe('sw.ts has SEO-09 update calls', () => {
  const swSrc = readFileSync(resolve(repoRoot, 'src/sw.ts'), 'utf8');
  it('imports clientsClaim from workbox-core', () => {
    expect(swSrc).toMatch(/import\s+\{[^}]*\bclientsClaim\b[^}]*\}\s+from\s+['"]workbox-core['"]/);
  });
  it('calls self.skipWaiting() at module level', () => {
    expect(swSrc).toMatch(/self\.skipWaiting\(\)/);
  });
  it('calls clientsClaim() at module level', () => {
    expect(swSrc).toMatch(/\bclientsClaim\(\)/);
  });
});

describe('vite.config.ts has SEO-09 registerType', () => {
  const cfgSrc = readFileSync(resolve(repoRoot, 'vite.config.ts'), 'utf8');
  it('sets registerType to autoUpdate', () => {
    expect(cfgSrc).toMatch(/registerType:\s*['"]autoUpdate['"]/);
  });
});
```

**ALSO add (NEW patterns not in RESEARCH.md):**
- Parse `public/sitemap.xml` (e.g., load it as a string and assert presence of `<loc>https://soundly.local/Soundly/</loc>` and `<loc>https://soundly.local/Soundly/app/</loc>`; optionally validate XML well-formedness via `DOMParser` from `jsdom` since the test env is already jsdom per `vitest.config.ts:7`).
- Sanity-check `public/robots.txt` contains `Sitemap:` line.

### Warm-earth palette source-of-truth pattern

**Source:** `src/index.css:5-11` (`@theme` block declaring CSS variables).

**Apply to:** `scripts/generate-og-image.mjs` (palette hex constants), and any documentation surfacing brand colors.

**Pattern:** Hex values are declared once in `src/index.css` as CSS custom properties; any non-CSS consumer (sharp script, OG image, future asset generators) copies the hex literal as an ALL-CAPS module-level `const` with an inline comment naming the swatch — matching `scripts/generate-icons.mjs:8-9`. There is no programmatic share; this is a code-convention discipline, not an automated link.

### Canonical URL placeholder pattern (introduced by Phase 10)

**Source:** CONTEXT D-23 — locks `https://soundly.local/Soundly/` as the placeholder string in committed files.

**Apply to:** `index.html` (canonical link + og:url + og:image + twitter:image + JSON-LD url), `public/robots.txt` (Sitemap line), `public/sitemap.xml` (both `<loc>` elements). **Six string occurrences across three files.**

**Pattern:** The literal `https://soundly.local/Soundly/` is the only placeholder; substring-replaceable via single find/replace before deploy. CONTEXT D-23 + the deploy runbook (D-28) make this the discoverable contract. RESEARCH.md Finding 7 considered + rejected build-time substitution (`loadEnv`/plugin); manual swap is the right tradeoff.

### Workbox `injectManifest` module-scope-call pattern

**Source:** `src/sw.ts:9` (`cleanupOutdatedCaches();`) and `src/sw.ts:12` (`precacheAndRoute(self.__WB_MANIFEST);`).

**Apply to:** New `self.skipWaiting()` + `clientsClaim()` calls in `src/sw.ts`.

**Pattern:** Workbox helpers run at module scope at SW install/registration time, each preceded by a 1-3 line comment explaining purpose. Do NOT wrap in `try/catch` (project does not handle SW startup errors); do NOT defer behind a feature-flag (these are install/activate lifecycle hooks, not runtime behaviors).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `docs/deploy-runbook.md` | docs | n/a | No existing in-repo Markdown documentation beyond a 1-line `README.md` and the `.planning/` workflow files. The `docs/` directory itself is new. Use RESEARCH.md Finding 11 as the content template. |
| `public/og-image-v1.png` (binary content) | static asset | file-I/O | Binary PNG output of the generator; no source pattern beyond `scripts/generate-icons.mjs`. The D-09 user-approval checkpoint substitutes for a programmatic test of visual quality. |

For both: planner should reference RESEARCH.md directly for the file-content template, and CONTEXT.md for the acceptance criteria.

---

## Metadata

**Analog search scope:**
- `scripts/` (1 file: `generate-icons.mjs`)
- `public/` (only contains `icons/*.png`)
- `src/sw.ts`, `vite.config.ts`, `index.html`, `package.json` (self-analogs for modify operations)
- `src/index.css` (palette source)
- `src/**/__tests__/**` (test idiom — `shareUrl.test.ts`, `timer.test.ts`)
- `docs/`, top-level `*.md` (confirmed: no existing in-repo docs except `README.md` = 1 line)

**Files scanned:** ~12 source files + glob coverage of `scripts/`, `public/`, `docs/`, top-level `*.md`, and tests.

**Pattern extraction date:** 2026-05-19

**Key project-wide patterns identified:**
- All build-time helper scripts live in `scripts/`, are ESM `.mjs`, use `sharp` for image generation, and follow a `async function generate() { … }; generate().catch(console.error)` shape.
- All `public/*` content is byte-for-byte passthrough; the project deploys at `/Soundly/` base per `vite.config.ts:7`, so canonical URLs must include the `/Soundly/` segment.
- All workbox-related module-scope calls in `src/sw.ts` are unguarded one-liners with a 1-3 line explanatory comment above; `self.addEventListener('<event>', e => e.waitUntil(...))` is the established lifecycle-handler shape, but RESEARCH.md Finding 2 advises using the `workbox-core.clientsClaim()` helper instead of hand-writing the activate listener.
- Vitest test files use top-level `import { describe, it, expect } from 'vitest'` (no `vi` ceremony for synchronous file-read assertions); pure-function tests live under `__tests__/` alongside the code they test. New top-level `tests/static-assets.test.ts` (outside `src/`) is the right placement for tests that assert against source files at the repo root — this is project-new but follows from Vitest's standard convention.
