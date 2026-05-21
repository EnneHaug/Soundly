# Phase 11: Multi-page Split + Landing Page — Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 8 (2 created, 6 modified)
**Analogs found:** 8 / 8 (3 exact-role, 3 self-analog updates, 2 cross-role-with-extraction)

This document tells the planner exactly which existing files to copy patterns
from for each new/modified file in Phase 11. **Concrete excerpts with file
paths and line numbers — not abstract guidance.** Every code block here is
either a "copy-this-shape" template or a "transform-from-this" before/after pair.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `index.html` (rewrite as static landing) | HTML entry / static page | request-response (no JS bundle) | `index.html` (current — Phase 10 meta block + apple-touch-icon pattern) + `src/components/IosInstallBanner.tsx` (iOS detection logic to extract to vanilla JS) | role-match + extract |
| `app/index.html` (new app shell entry) | HTML entry / SPA shell | request-response → bundler | `index.html` (current) — same shape; effectively the same file relocated under `app/` with its own SEO meta variant | exact (self-relocate) |
| `vite.config.ts` (multi-page input + manifest narrowing + SW globPatterns) | build config | n/a (config) | `vite.config.ts` (current — VitePWA + base + manifest block); no in-repo precedent for multi-page `rollupOptions.input` — use RESEARCH Finding 1 verbatim | self-analog + new-config |
| `src/sw.ts` (NavigationRoute allowlist narrowing + openWindow target update) | service worker | event-driven | `src/sw.ts` (current — `NavigationRoute` + `notificationclick`); RESEARCH Finding 2 verbatim allowlist pattern | exact (self-analog) |
| `public/screenshot-composer-v1.png` (manual capture) | static binary asset | n/a (file) | `public/og-image-v1.png` (versioned PNG sibling; same naming convention) + `scripts/generate-og-image.mjs` (size-cap + commit-discipline sibling) | role-match (sibling asset) |
| `public/sitemap.xml` (lastmod date update) | static XML | n/a (file) | `public/sitemap.xml` (current — already lists both URLs; only `lastmod` changes) | exact (self-analog, mechanical) |
| `docs/deploy-runbook.md` (Phase 11 SW-rescoping addendum) | docs / runbook | n/a (file) | `docs/deploy-runbook.md` §1 (placeholder swap table) + Phase 10 commit-pattern style | exact (self-analog, append) |
| `tests/static-assets.test.ts` (split-aware test expansion) | test (regex assertions on static files) | n/a (file-read tests) | `tests/static-assets.test.ts` (current — Vitest + jsdom; describe-block structure); `scripts/verify-phase-10-build.mjs` is the build-tier sibling | exact (self-analog, expand) |
| `scripts/verify-phase-10-build.mjs` (split-aware dist verification) | build verifier script | n/a (script) | `scripts/verify-phase-10-build.mjs` (current — readFileSync + substring/regex checks) | exact (self-analog, expand) |

---

## Pattern Assignments

### 1. `index.html` — wholesale rewrite as static landing (HTML entry / static page)

**Analogs:**
- **Primary structural analog:** current `index.html` (Phase 10 meta block, apple-touch-icon, charset/viewport)
- **iOS detection extract source:** `src/components/IosInstallBanner.tsx` + `src/platform/standalone.ts`
- **Authoritative content template:** UI-SPEC `## CSS-Level Contract Reference` block (lines 478–690) — *prescriptive*, planner ships verbatim
- **Full landing-page skeleton:** RESEARCH.md lines 712–869 (post-Phase-11 example with install JS)

#### Pattern A — Phase 10 meta-block (KEEP on landing, with landing-variant URLs)

**Source:** `index.html` lines 5–40 (current)

The landing **retains** charset, viewport, theme-color, the entire SEO meta cluster
(description, OG×5, Twitter×4, canonical, JSON-LD), and the `<title>` element. Only
the apple-* PWA meta tags are **moved** to `app/index.html` (the landing is not the
installable PWA entry). Excerpt to keep verbatim on the landing:

```html
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="theme-color" content="#5c6b56" />
<!-- SEO meta (Phase 10) — landing variant: canonical + og:url stay at /Soundly/ -->
<meta name="description" content="A free alarm app with soft sounds, vibration, or full volume — fully customizable. No accounts, no ads. Just share your setup. PWA — installs anywhere." />
<link rel="canonical" href="https://soundly.local/Soundly/" />
<!-- og: + twitter: blocks identical to current index.html lines 16–26 — verbatim -->
<!-- JSON-LD block identical to current index.html lines 28–39 — verbatim -->
<title>Soundly — a calmer alarm that alerts you gently</title>
```

**REMOVE from landing** (move to `app/index.html`):
```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="Soundly" />
<link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
```

**REMOVE from landing** (no React on landing per LAND-01):
```html
<div id="root"></div>
<script type="module" src="/src/main.tsx"></script>
```

#### Pattern B — iOS detection (extract from React to vanilla JS)

**Source:** `src/platform/standalone.ts` lines 12–25 (current)

```ts
// React/TS source — DO NOT IMPORT into landing
export function isPwaInstalled(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
  return false;
}

export function isIosSafariNonInstalled(): boolean {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!isIos) return false;
  return !isPwaInstalled();
}
```

**Copy-to-vanilla-JS pattern (inline `<script>` in landing) — WITH Finding 6
iPadOS UA-spoofing fix applied:**

```html
<script>
  (function () {
    function isInstalled() {
      if (window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.navigator.standalone === true) return true;  // iOS WebKit
      return false;
    }
    // Reliable iOS detection — handles iPadOS 13+ UA spoofing (RESEARCH Finding 6)
    function isIos() {
      var ua = navigator.userAgent;
      if (/iphone|ipod/i.test(ua)) return true;
      if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
      return false;
    }
    // ... install handler wiring (Pattern C below) ...
  })();
</script>
```

**Critical:** Do **NOT** import the React component or the TS module. The landing has
zero React runtime per LAND-01. The `maxTouchPoints` branch is a bug fix vs. the
current `standalone.ts` (which misses iPadOS 13+ Safari) — applied here only on
the landing, not retrofitted to `standalone.ts` (out of scope per RESEARCH Finding 6).

#### Pattern C — `beforeinstallprompt` + `appinstalled` install flow

**Source:** RESEARCH.md Finding 5 (lines 275–309) — canonical pattern verbatim.
**No in-repo analog** (Phase 10 had no install button; `IosInstallBanner.tsx` is
the closest, but it's iOS-only and React-based).

```html
<button id="install-btn" hidden>Install Soundly</button>
<script>
  var deferredPrompt = null;
  var installBtn = document.getElementById('install-btn');

  // 1. Defer + capture (NEVER fires on iOS Safari — Finding 7)
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();          // Suppress browser's mini-infobar
    deferredPrompt = e;
    if (installBtn) installBtn.hidden = false;  // D-LAND-05
  });

  // 2. User-click triggers native prompt
  if (installBtn) {
    installBtn.addEventListener('click', async function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      installBtn.hidden = true;
    });
  }

  // 3. Post-install (Chromium only) — D-LAND-07 sequenced confirm + navigate
  window.addEventListener('appinstalled', function () {
    if (installBtn) installBtn.hidden = true;
    deferredPrompt = null;
    var confirmEl = document.getElementById('install-confirm');
    if (confirmEl) confirmEl.hidden = false;
    setTimeout(function () {
      window.location.href = '/Soundly/app/';     // literal — JS strings not Vite-rewritten
    }, 1500);
  });
</script>
```

#### Pattern D — UI-SPEC inline `<style>` block (verbatim CSS)

**Source:** UI-SPEC lines 482–690 (`## CSS-Level Contract Reference`).

This is the **authoritative CSS source for the landing**. The UI-SPEC explicitly
states it is *prescriptive*: "the planner ships this CSS or a functionally identical
equivalent. Adding new selectors is allowed; modifying these values is NOT allowed
without revising this UI-SPEC."

The block covers:
- Warm-earth palette `:root` + `@media (prefers-color-scheme: dark)` overrides
- Reset + base (`box-sizing`, `body` typography, `img` defaults)
- Hero / install-CTA / details / main / screenshot / FAQ / iOS-honesty / footer
- Mobile breakpoint (`@media (max-width: 767px)`)
- Reduced-motion gate (`@media (prefers-reduced-motion: reduce)`)
- `<details>` custom-marker styling (RESEARCH Pitfall D — both vendor prefixes)

**Palette source-of-truth cross-ref:** `src/index.css` lines 4–11 (warm-earth tokens).
The landing duplicates these hex values inline (RESEARCH Finding 12). Dark-mode
variants in the UI-SPEC are NEW (not in `src/index.css`) — see UI-SPEC Color section
for the lifted-sage `#a4b29a` + lifted-accent `#d49075` derivation.

#### Pattern E — Asset path resolution (Pitfall C)

**Source:** RESEARCH Finding 11 (lines 480–506) + existing `index.html` line 10.

```html
<!-- Source (index.html — landing) -->
<img src="/og-image-v1.png" alt="Soundly — a calmer alarm" />
<img src="/screenshot-composer-v1.png" alt="..." />
<a href="/app/">Open Soundly</a>

<!-- After `npm run build` (dist/index.html) — Vite auto-prefixes with /Soundly/ -->
<img src="/Soundly/og-image-v1.png" alt="Soundly — a calmer alarm" />
<img src="/Soundly/screenshot-composer-v1.png" alt="..." />
<a href="/Soundly/app/">Open Soundly</a>
```

**Rule:** In HTML attributes (`src`, `href`, `srcset`), use **root-relative without
`/Soundly/` prefix** — Vite rewrites them. In inline `<script>` body strings, use
the **full literal `/Soundly/app/`** — JS strings are NOT rewritten. Existing
precedent: `index.html` line 10 uses `/icons/icon-192x192.png` and Vite emits
`/Soundly/icons/icon-192x192.png` in dist.

---

### 2. `app/index.html` — new app shell entry (HTML entry / SPA shell)

**Analog:** Current `index.html` (this is essentially the current file relocated to
`app/index.html` with its own SEO meta variant).

#### Pattern A — Direct relocation of current `index.html` shell

**Source:** Current `index.html` lines 1–46 — **the entire file moves under `app/`**
with two adjustments:

```html
<!doctype html>
<html lang="en">
  <head>
    <!-- KEEP verbatim from current index.html lines 4–10 -->
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#5c6b56" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Soundly" />
    <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />

    <!-- SEO meta (app-shell variant) — canonical + og:url change to /Soundly/app/ -->
    <title>Soundly — a calmer alarm that alerts you gently</title>
    <meta name="description" content="A free alarm app with soft sounds, vibration, or full volume — fully customizable. No accounts, no ads. Just share your setup. PWA — installs anywhere." />
    <link rel="canonical" href="https://soundly.local/Soundly/app/" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Soundly — gentle alarm" />
    <meta property="og:description" content="..." />
    <meta property="og:image" content="https://soundly.local/Soundly/og-image-v1.png" />
    <meta property="og:url" content="https://soundly.local/Soundly/app/" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Soundly — gentle alarm" />
    <meta name="twitter:description" content="..." />
    <meta name="twitter:image" content="https://soundly.local/Soundly/og-image-v1.png" />
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "Soundly Gentle Alarm",
      "description": "...",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Web Browser",
      "url": "https://soundly.local/Soundly/app/"
    }
    </script>
  </head>
  <body>
    <!-- KEEP verbatim from current index.html lines 42–45 -->
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Changes vs. source:**
1. `canonical` href: `https://soundly.local/Soundly/` → `https://soundly.local/Soundly/app/`
2. `og:url`: `https://soundly.local/Soundly/` → `https://soundly.local/Soundly/app/`
3. JSON-LD `url`: `https://soundly.local/Soundly/` → `https://soundly.local/Soundly/app/`
4. Apple-* meta and apple-touch-icon: **moved here** from root `index.html` (PWA install
   operates on app-shell entry post-rescope per Finding 9).

**Vite resolves `/src/main.tsx` correctly from `app/index.html`** — the path is
resolved against the project root (where `src/` lives), NOT against the HTML file's
directory. Verified pattern: Vite multi-page docs (Finding 1) confirm `<script
type="module" src="/src/main.tsx">` works from any HTML entry depth.

**No change needed to `src/main.tsx`** — it mounts to `#root`, which `app/index.html`
provides identically to the current root `index.html`.

---

### 3. `vite.config.ts` — multi-page input + manifest narrowing + SW globPatterns

**Analog:** Current `vite.config.ts` (lines 1–37) — the existing VitePWA + base
config is the structural template. The `rollupOptions.input` block is **NEW** with no
in-repo precedent; use RESEARCH Finding 1 verbatim.

#### Pattern A — Preserve existing structure

**Source:** Current `vite.config.ts` lines 1–37.

Keep:
- `import` statements (lines 1–4) — add `resolve, dirname` from `node:path` and
  `fileURLToPath` from `node:url`
- `base: '/Soundly/'` (line 7) — unchanged
- `plugins: [react(), tailwindcss(), VitePWA({ ... })]` array shape (line 8–34) —
  shape unchanged; manifest block modified per Pattern B
- `registerType: 'autoUpdate'`, `strategies: 'injectManifest'`, `srcDir: 'src'`,
  `filename: 'sw.ts'` (lines 12–15) — all unchanged
- `icons[]` array (lines 24–28) — unchanged
- `devOptions: { enabled: true, type: 'module' }` (lines 30–33) — unchanged

#### Pattern B — Manifest block transform (lines 16–29)

**Before (current):**
```ts
manifest: {
  name: 'Soundly Gentle Alarm',
  short_name: 'Soundly',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#f4f1eb',
  theme_color: '#5c6b56',
  start_url: '/Soundly/',
  icons: [ /* unchanged */ ],
},
```

**After (RESEARCH Finding 3 + Finding 4):**
```ts
manifest: {
  id: '/Soundly/',                          // NEW (Finding 4 — preserves install identity)
  name: 'Soundly Gentle Alarm',
  short_name: 'Soundly',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#f4f1eb',
  theme_color: '#5c6b56',
  start_url: '/Soundly/app/',               // CHANGED from '/Soundly/'
  scope: '/Soundly/app/',                   // NEW — narrows install scope
  icons: [ /* unchanged */ ],
},
```

#### Pattern C — `injectManifest.globPatterns` narrowing (NEW; no in-repo precedent)

**Source:** RESEARCH Pitfall B mitigation (lines 549–561) + Finding 3.

Insert **after** the `manifest: { ... }` block, **before** `devOptions`:

```ts
injectManifest: {
  globPatterns: ['app/**/*.{js,css,html,svg,png,webp,woff2}'],
  globIgnores: [
    'index.html',
    'screenshot-*.png',
    'og-image-*.png',
    'sitemap.xml',
    'robots.txt',
  ],
},
```

#### Pattern D — `build.rollupOptions.input` multi-page (NEW; RESEARCH Finding 1 verbatim)

**Source:** RESEARCH Finding 1 (lines 152–171) — Vite 6 canonical pattern. **Use
`rollupOptions`, NOT `rolldownOptions`** (the latter is Vite 7+).

Add the `build` block at the end of `defineConfig({ ... })`:

```ts
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: '/Soundly/',
  plugins: [ /* ... */ ],
  build: {                                          // NEW
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app/index.html'),
      },
    },
  },
});
```

**Critical:** Vite ignores the object keys (`main`, `app`) and uses the resolved
file path — `dist/index.html` + `dist/app/index.html` is the emitted structure
(Pitfall E confirms this is theoretical-only at Vite 6).

---

### 4. `src/sw.ts` — NavigationRoute allowlist narrowing + openWindow target update

**Analog:** Current `src/sw.ts` (lines 1–54) — this **IS the analog**; modify in place.

#### Pattern A — Preserve module-scope calls

**Source:** Current `src/sw.ts` lines 1–13, 22–25, 44–53.

Keep verbatim:
- Imports (lines 3–5) — unchanged
- `declare let self: ServiceWorkerGlobalScope` (line 7)
- `cleanupOutdatedCaches()` (line 10) — D-17 preservation
- `precacheAndRoute(self.__WB_MANIFEST)` (line 13) — D-17 preservation
- `self.skipWaiting(); clientsClaim();` (lines 52–53) — Phase 10 SEO-09 preservation
- Comment block lines 44–51 (Phase 10 / SEO-09 rationale) — keep, optionally
  extend with Phase 11 note

#### Pattern B — `NavigationRoute` allowlist narrowing

**Before (current lines 15–20):**
```ts
// SPA navigation fallback — serves cached index.html for all navigation requests.
// Belt-and-suspenders: precacheAndRoute handles exact URL matches, but
// NavigationRoute catches browser navigation to paths not in the precache manifest
// (e.g., direct URL entry, refresh on a deep link if one is ever added).
const navHandler = createHandlerBoundToURL('/Soundly/index.html');
registerRoute(new NavigationRoute(navHandler));
```

**After (RESEARCH Finding 2 — official vite-plugin-pwa pattern):**
```ts
// Phase 11 — narrowed to /Soundly/app/* only. Landing (/Soundly/) is served from
// the network, not the SW, per LAND-02 + D-LAND-15.
const navHandler = createHandlerBoundToURL('/Soundly/app/index.html');
registerRoute(
  new NavigationRoute(navHandler, {
    allowlist: [/^\/Soundly\/app\//],
  })
);
```

**Two changes:**
1. `createHandlerBoundToURL` URL: `/Soundly/index.html` → `/Soundly/app/index.html`
2. `NavigationRoute` gains `{ allowlist: [/^\/Soundly\/app\//] }` second argument

#### Pattern C — `notificationclick` openWindow target update

**Before (current line 39):**
```ts
return self.clients.openWindow('/Soundly/');
```

**After (RESEARCH Code Examples line 701):**
```ts
return self.clients.openWindow('/Soundly/app/');  // CHANGED — notification taps land in app, not landing
```

**Preserve** the surrounding `notificationclick` handler (lines 27–42) — only the
final `openWindow` URL string changes.

---

### 5. `public/screenshot-composer-v1.png` — manual capture (static binary asset)

**Analog:** `public/og-image-v1.png` (sibling versioned PNG) + `scripts/generate-og-image.mjs`
(sibling generator script — shares versioning + size-cap discipline).

#### Pattern A — Versioned filename convention

**Source:** `public/og-image-v1.png` (Phase 10 D-10 / SEO-08 convention).

The filename pattern is `[descriptor]-v[N].png` where future revisions become
`-v2`, `-v3`. Per D-LAND-13 + UI-SPEC Asset Contract, the file lives at
`public/screenshot-composer-v1.png` and **never overwrites** prior versions
(defeats browser/CDN cache).

#### Pattern B — Size-cap discipline (≤ 200 KB)

**Source:** `scripts/generate-og-image.mjs` lines 51–55 (sharp PNG compression) +
`tests/static-assets.test.ts` lines 163–166 (200 KB assertion).

```js
// From scripts/generate-og-image.mjs
await sharp(Buffer.from(createOgSvg()))
  .png({ compressionLevel: 9 })
  .toFile(outputPath);
```

```ts
// From tests/static-assets.test.ts (assertion to mirror for screenshot)
it('is ≤ 200 KB (SEO-02 cap)', () => {
  const size = statSync(imagePath).size;
  expect(size).toBeLessThanOrEqual(204800);  // 200 KB = 204800 bytes
  expect(size).toBeGreaterThan(1000);         // sanity: not a stub
});
```

#### Pattern C — Capture procedure (no Playwright; manual DevTools)

**Source:** UI-SPEC Asset Contract → "Screenshot Capture Spec (D-LAND-13)" lines
787–817 + RESEARCH Q3 recommendation (line 1033).

**Spec (verbatim from UI-SPEC):**
- Viewport: 1200×800px (desktop landscape, no scrollbar)
- State: `/app/` opened fresh in Chromium → Dashboard → "Custom" → Composer with
  Wake Easy template → wait ~240ms for `dialog-in` animation completion
- Must show: sticky `Custom alarm` header + X, "Total" caption + 17:00 total, 5
  segments (4×4:00 gentle + 1×1:00 Alarm), `+ Add segment`, Cancel/Share/Start footer
- Save: `public/screenshot-composer-v1.png`; if > 200 KB, downsample via `sharp` or
  `pngquant`
- Privacy: no browser chrome, DevTools, console, or bookmarks bar in frame

**No script needed** — this is a one-shot manual capture committed to the repo.
Adding `@playwright/test` (100+ MB) for one screenshot is overkill (RESEARCH "NOT to
be added" table line 137).

---

### 6. `public/sitemap.xml` — lastmod date update (static XML; mechanical)

**Analog:** `public/sitemap.xml` (current — already lists both URLs).

#### Pattern A — Existing structure (no shape change)

**Source:** `public/sitemap.xml` lines 1–16.

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

#### Pattern B — Mechanical update

Both `<lastmod>` values: `2026-05-16` → **current Phase 11 ship date** (e.g.,
`2026-05-21` per CONTEXT gathered date, or whatever the planner chooses for the
deploy date). No `<loc>`, `<changefreq>`, `<priority>`, or namespace changes — the
file already anticipated the split.

**Verification:** `tests/static-assets.test.ts` lines 122–153 already asserts
both URLs exist, well-formed XML, sitemaps.org v0.9 namespace, exactly 2 `<url>`
entries — no test update needed for the sitemap itself (only the lastmod date
moves).

---

### 7. `docs/deploy-runbook.md` — Phase 11 SW-rescoping addendum (docs / runbook)

**Analog:** `docs/deploy-runbook.md` (current; 277 lines) — append-only addendum.

#### Pattern A — §1 placeholder-swap table expansion

**Source:** `docs/deploy-runbook.md` lines 19–25 (the file-occurrence count table).

**Before:**
```markdown
| File | Occurrences | What gets replaced |
|------|-------------|--------------------|
| `index.html` | 5 (canonical link, og:url, og:image, twitter:image, JSON-LD url) | All `https://soundly.local/Soundly/...` substrings |
| `public/robots.txt` | 1 (Sitemap: line) | The full sitemap URL |
| `public/sitemap.xml` | 2 (both `<loc>` elements) | Both URLs |
```

**After (per RESEARCH Finding 9 — final counts recomputed by planner based on
landing + app-shell meta blocks):**
```markdown
| File | Occurrences | What gets replaced |
|------|-------------|--------------------|
| `index.html` (landing) | 5 (canonical + og:url + og:image + twitter:image + JSON-LD url — all `/Soundly/`) | All `https://soundly.local/Soundly/...` substrings |
| `app/index.html` (app shell) | 5 (canonical + og:url + og:image + twitter:image + JSON-LD url — canonical/og:url + JSON-LD url use `/Soundly/app/`; og:image + twitter:image stay at `/Soundly/og-image-v1.png`) | All `https://soundly.local/Soundly/...` and `.../Soundly/app/...` substrings |
| `public/robots.txt` | 1 (Sitemap: line) | The full sitemap URL |
| `public/sitemap.xml` | 2 (both `<loc>` elements) | Both URLs |
```

#### Pattern B — Add §3.1 build-output verification (dist/app/index.html)

**Source:** Current `docs/deploy-runbook.md` §3 (build section ~line 94 onward) —
insert after the build step.

```markdown
### 3.1 Verify multi-page build emits both entries (Phase 11)

After `npm run build`:

```bash
ls dist/index.html dist/app/index.html  # Both must exist
```

If either is missing, re-check `vite.config.ts` `build.rollupOptions.input`
keys map to existing files.
```

#### Pattern C — Add §8 / addendum for D-LAND-16 SW rescoping verification

**Source:** D-LAND-16 (CONTEXT line 76) + RESEARCH Pitfall A (lines 532–545).

```markdown
## 8. Phase 11 — Verify SW rescoping on installed device (D-LAND-16)

After deploy, on a phone that has the v1/v2.0 PWA already installed:

1. Open the installed PWA from home-screen icon
2. Wait for the SW to update (autoUpdate + clientsClaim — see Phase 10 SEO-09);
   first launch may still show the old SW serving stale `/Soundly/index.html`
3. Close + reopen — should now launch to `/Soundly/app/` per new `start_url`
4. Verify `/Soundly/app/` works offline (airplane mode + relaunch)
5. Verify the landing (`https://soundly.local/Soundly/` or your deploy URL)
   loads fresh from network (not from SW cache) — install button or iOS panel
   should NOT appear (installed users get the CTA stripped per D-LAND-08)

If the installed PWA loses its install identity (re-prompts to install,
icon goes stale), the cause is missing `manifest.id` — confirm
`vite.config.ts` has `id: '/Soundly/'` per RESEARCH Finding 4.
```

#### Pattern D — Commit-message style

**Source:** Recent commit log + Phase 10 commit pattern.

Recent commits use `docs(NN):` or `feat(NN):` prefixes (e.g., `docs(10): capture
phase 10 context`). Phase 11 runbook update should follow: `docs(11): append Phase
11 SW-rescoping addendum to deploy runbook`.

---

### 8. `tests/static-assets.test.ts` — split-aware test expansion

**Analog:** `tests/static-assets.test.ts` (current; 246 lines) — extend in place.

#### Pattern A — Vitest + jsdom + readFileSync structure (preserve)

**Source:** `tests/static-assets.test.ts` lines 1–17.

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '..');
const read = (relPath: string) =>
  readFileSync(resolve(repoRoot, relPath), 'utf8');
```

**Reuse `read()` helper unchanged.** Add `const appHtml = read('app/index.html');`
at the top of each new app-shell describe block.

#### Pattern B — Mirror existing `index.html` describe blocks for `app/index.html`

**Source:** `tests/static-assets.test.ts` lines 20–71 (SEO meta block) +
lines 73–104 (preserved tags block).

**New parallel block to add:**
```ts
// ─── Phase 11: app shell SEO meta (mirrors landing with /Soundly/app/) ───
describe('app/index.html SEO meta (Phase 11)', () => {
  const html = read('app/index.html');

  it('has the locked <title>', () => {
    expect(html).toMatch(/<title>Soundly — a calmer alarm that alerts you gently<\/title>/);
  });

  it('has canonical pointing to /Soundly/app/', () => {
    expect(html).toMatch(/<link\s+rel="canonical"\s+href="https:\/\/[^"]+\/Soundly\/app\/"/);
  });

  it('has og:url pointing to /Soundly/app/', () => {
    expect(html).toMatch(/<meta\s+property="og:url"\s+content="https:\/\/[^"]+\/Soundly\/app\/"/);
  });

  it('has JSON-LD with url ending in /Soundly/app/', () => {
    const match = html.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const parsed = JSON.parse(match![1]);
    expect(parsed['url']).toMatch(/\/Soundly\/app\/$/);
  });

  // ... mirror remaining SEO-02/03/04 assertions with app-shell URLs ...
});

// ─── Phase 11: D-26 apple-* meta MOVED to app shell ───
describe('app/index.html preserved tags (D-26 moved to app shell)', () => {
  const html = read('app/index.html');

  it('preserves apple-mobile-web-app-capable meta tag', () => {
    expect(html).toMatch(/<meta\s+name="apple-mobile-web-app-capable"\s+content="yes"/);
  });

  it('preserves apple-mobile-web-app-status-bar-style meta tag', () => {
    expect(html).toMatch(/<meta\s+name="apple-mobile-web-app-status-bar-style"/);
  });

  it('preserves apple-mobile-web-app-title meta tag', () => {
    expect(html).toMatch(/<meta\s+name="apple-mobile-web-app-title"\s+content="Soundly"/);
  });

  it('preserves apple-touch-icon link', () => {
    expect(html).toMatch(/<link\s+rel="apple-touch-icon"\s+href="\/icons\/icon-192x192\.png"/);
  });
});
```

#### Pattern C — UPDATE the existing `src/sw.ts` assertions (line 202–204)

**Source:** `tests/static-assets.test.ts` lines 202–205.

**Before:**
```ts
it('preserves the existing NavigationRoute handler (D-17)', () => {
  expect(sw).toMatch(/createHandlerBoundToURL\('\/Soundly\/index\.html'\)/);
  expect(sw).toMatch(/registerRoute\(new NavigationRoute\(navHandler\)\)/);
});
```

**After (RESEARCH Finding 9):**
```ts
it('NavigationRoute narrowed to /Soundly/app/ (Phase 11)', () => {
  expect(sw).toMatch(/createHandlerBoundToURL\('\/Soundly\/app\/index\.html'\)/);
  expect(sw).toMatch(/allowlist:\s*\[\s*\/\^\\\/Soundly\\\/app\\\/\/\s*\]/);
});

it('notificationclick openWindow targets /Soundly/app/ (Phase 11)', () => {
  expect(sw).toMatch(/openWindow\('\/Soundly\/app\/'\)/);
});
```

#### Pattern D — UPDATE the existing `vite.config.ts` assertion (line 233)

**Source:** `tests/static-assets.test.ts` lines 232–234.

**Before:**
```ts
it('preserves the manifest block with start_url', () => {
  expect(cfg).toMatch(/start_url:\s*['"]\/Soundly\/['"]/);
});
```

**After (RESEARCH Finding 9):**
```ts
it('manifest.start_url narrowed to /Soundly/app/ (Phase 11)', () => {
  expect(cfg).toMatch(/start_url:\s*['"]\/Soundly\/app\/['"]/);
});

it('manifest.scope narrowed to /Soundly/app/ (Phase 11)', () => {
  expect(cfg).toMatch(/scope:\s*['"]\/Soundly\/app\/['"]/);
});

it('manifest.id is /Soundly/ for install-identity continuity (Finding 4)', () => {
  expect(cfg).toMatch(/id:\s*['"]\/Soundly\/['"]/);
});

it('rollupOptions.input has both main and app entries', () => {
  expect(cfg).toMatch(/main:\s*resolve\(__dirname,\s*['"]index\.html['"]\)/);
  expect(cfg).toMatch(/app:\s*resolve\(__dirname,\s*['"]app\/index\.html['"]\)/);
});

it('injectManifest.globPatterns scoped to app/** (Pitfall B)', () => {
  expect(cfg).toMatch(/globPatterns:\s*\[\s*['"]app\/\*\*/);
});
```

#### Pattern E — EXTEND placeholder-consistency test (line 239–245)

**Source:** `tests/static-assets.test.ts` lines 237–245.

**Before:**
```ts
describe('placeholder canonical URL consistency (D-23)', () => {
  it('all 3 deploy-time-swap files use the same placeholder', () => {
    const placeholder = 'https://soundly.local/Soundly/';
    expect(read('index.html')).toContain(placeholder);
    expect(read('public/robots.txt')).toContain(placeholder);
    expect(read('public/sitemap.xml')).toContain(placeholder);
  });
});
```

**After (RESEARCH Pitfall G):**
```ts
describe('placeholder canonical URL consistency (D-23 + Phase 11 split)', () => {
  it('landing keeps bare /Soundly/ placeholder', () => {
    const placeholder = 'https://soundly.local/Soundly/';
    expect(read('index.html')).toContain(placeholder);
    expect(read('public/robots.txt')).toContain(placeholder);
    expect(read('public/sitemap.xml')).toContain(placeholder);
  });

  it('app shell uses /Soundly/app/ placeholder for its canonical (Phase 11)', () => {
    expect(read('app/index.html')).toContain('https://soundly.local/Soundly/app/');
  });
});
```

#### Pattern F — NEW assertions for landing-specific structural requirements

The landing has new content (FAQ, install button, iOS panel) — add UI-SPEC-anchored
assertions per UI-SPEC Accessibility Contract (lines 700–775):

```ts
describe('index.html landing page (Phase 11)', () => {
  const html = read('index.html');

  it('has lang="en" attribute (Lighthouse SEO + WCAG 3.1.1)', () => {
    expect(html).toMatch(/<html\s+lang="en"/);
  });

  it('has install button placeholder (D-LAND-05)', () => {
    expect(html).toMatch(/<button[^>]+id="install-btn"[^>]+hidden/);
  });

  it('has iOS install <details> panel (D-LAND-06)', () => {
    expect(html).toMatch(/<details[^>]+id="ios-install-panel"[^>]+hidden/);
    expect(html).toMatch(/<summary>Install on iPhone<\/summary>/);
  });

  it('has install-confirm element hidden by default (D-LAND-07)', () => {
    expect(html).toMatch(/id="install-confirm"[^>]+hidden/);
  });

  it('has install-cta container with aria-live=polite (UI-SPEC A11y)', () => {
    expect(html).toMatch(/id="install-cta"[^>]+aria-live="polite"/);
  });

  it('hero h1 has verbatim D-LAND-01 copy', () => {
    expect(html).toMatch(/A calmer alarm that alerts you gently/);
  });

  it('FAQ section uses plain h3 + p (D-LAND-03 — no FAQPage JSON-LD)', () => {
    expect(html).not.toMatch(/"@type":\s*"FAQPage"/);
    expect(html).toMatch(/<section[^>]+class="faq"/);
  });

  it('iOS honesty section has 2 paragraphs (D-LAND-04)', () => {
    const match = html.match(/<section[^>]+class="ios-honesty"[\s\S]*?<\/section>/);
    expect(match).not.toBeNull();
    expect((match![0].match(/<p[^>]*>/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('does NOT load Tailwind app bundle (no React runtime per LAND-01)', () => {
    expect(html).not.toMatch(/src="\/src\/main\.tsx"/);
    expect(html).not.toMatch(/<div\s+id="root">/);
  });
});
```

---

### 9. `scripts/verify-phase-10-build.mjs` — split-aware dist verification

**Analog:** `scripts/verify-phase-10-build.mjs` (current; 106 lines) — extend in place.
**Optional rename:** RESEARCH Finding 9 suggests `verify-build.mjs` (no longer
Phase-10-specific). Planner's discretion.

#### Pattern A — Preserve plain-Node + fail/ok helpers

**Source:** `scripts/verify-phase-10-build.mjs` lines 17–26.

```js
import { readFileSync, statSync, existsSync } from 'node:fs';

function fail(msg) {
  console.error(`[verify-phase-10-build] FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`[verify-phase-10-build] OK: ${msg}`);
}
```

Reuse unchanged. Optionally rename log prefix to `[verify-build]` if file is renamed.

#### Pattern B — Mirror SEO substring check for `dist/app/index.html`

**Source:** Current lines 29–47 (existing landing check).

**Add after the existing block:**
```js
// ─── Phase 11: dist/app/index.html SEO meta ──────────────────────────
if (!existsSync('dist/app/index.html')) {
  fail('dist/app/index.html does not exist — verify vite.config.ts build.rollupOptions.input');
}
const appHtml = readFileSync('dist/app/index.html', 'utf8');

const appSeoSubstrings = [
  'og:title',
  'og:description',
  'og:image',
  'twitter:card',
  'rel="canonical"',
  'application/ld+json',
  '"WebApplication"',
  'UtilitiesApplication',
  '/Soundly/app/',  // distinct from landing — confirms split
];
for (const needle of appSeoSubstrings) {
  if (!appHtml.includes(needle)) fail(`dist/app/index.html missing SEO substring: ${needle}`);
}
ok(`dist/app/index.html contains all ${appSeoSubstrings.length} SEO substrings`);
```

#### Pattern C — Mirror JSON-LD parse for `dist/app/index.html`

**Source:** Current lines 66–76.

```js
const appLdMatch = appHtml.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/);
if (!appLdMatch) fail('dist/app/index.html missing JSON-LD <script> block');
let appLd;
try {
  appLd = JSON.parse(appLdMatch[1]);
} catch (e) {
  fail(`dist/app/index.html JSON-LD is invalid JSON: ${e.message}`);
}
if (appLd['@type'] !== 'WebApplication') fail(`dist/app/ JSON-LD @type wrong: ${appLd['@type']}`);
if (!appLd['url'].endsWith('/Soundly/app/')) fail(`dist/app/ JSON-LD url must end with /Soundly/app/`);
ok('dist/app/index.html JSON-LD parses + @type=WebApplication + /app/ URL');
```

#### Pattern D — Expand required assets list (line 79–88)

**Before:**
```js
const requiredAssets = [
  'dist/og-image-v1.png',
  'dist/robots.txt',
  'dist/sitemap.xml',
  'dist/sw.js',
];
```

**After:**
```js
const requiredAssets = [
  'dist/og-image-v1.png',
  'dist/screenshot-composer-v1.png',  // NEW (D-LAND-13)
  'dist/robots.txt',
  'dist/sitemap.xml',
  'dist/sw.js',
  'dist/app/index.html',              // NEW (Phase 11)
];
```

#### Pattern E — Add allowlist + screenshot-size + manifest-link assertions

**Source:** Current lines 90–102 (existing SW + size checks).

```js
// ─── Phase 11: dist/sw.js has NavigationRoute allowlist ──────────────
if (!/allowlist/.test(sw)) {
  fail('dist/sw.js missing allowlist reference — Phase 11 SW rescope not shipped');
}
ok('dist/sw.js contains allowlist (SW rescope confirmed)');

// ─── Phase 11: screenshot size cap (mirror OG image discipline) ──────
const ssSize = statSync('dist/screenshot-composer-v1.png').size;
if (ssSize > 204800) fail(`dist/screenshot-composer-v1.png exceeds 200 KB cap: ${ssSize} bytes`);
if (ssSize < 1000) fail(`dist/screenshot-composer-v1.png suspiciously small: ${ssSize} bytes`);
ok(`dist/screenshot-composer-v1.png size: ${ssSize} bytes (within bounds)`);

// ─── Phase 11: <link rel="manifest"> on app shell (Q4 RESOLVED check) ─
if (!/<link\s+rel="manifest"/i.test(appHtml)) {
  fail(
    'dist/app/index.html missing `<link rel="manifest" ...>` — ' +
      'fallback: add `<link rel="manifest" href="/Soundly/manifest.webmanifest">` ' +
      'to app/index.html source per Phase 10 D-25 pattern'
  );
}
ok('dist/app/index.html contains <link rel="manifest" ...> (Q4 RESOLVED confirmed)');
```

---

## Shared Patterns

These cross-cutting patterns apply to multiple Phase 11 files.

### Shared 1 — Versioned PNG filename convention

**Source:** `public/og-image-v1.png` + Phase 10 D-10 / SEO-08.
**Applies to:** `public/screenshot-composer-v1.png` (and any future `-v2`, `-v3`
revisions).

**Rule:** Filename uses `-v[N].png` suffix; future content changes bump the integer
and update all references. Never overwrite — defeats cache. Same discipline as
`og-image-v1.png` (Phase 10 SEO-08 / Pitfall 3 — Facebook caches OG URLs ~30 days).

### Shared 2 — 200 KB image size cap

**Source:** `tests/static-assets.test.ts` lines 163–166 + `scripts/verify-phase-10-build.mjs` line 92.
**Applies to:** `public/og-image-v1.png` (existing) + `public/screenshot-composer-v1.png` (new).

```ts
// Test-tier assertion
expect(statSync(imagePath).size).toBeLessThanOrEqual(204800);  // 200 KB
expect(statSync(imagePath).size).toBeGreaterThan(1000);         // sanity
```

```js
// Build-verifier-tier assertion
const size = statSync('dist/screenshot-composer-v1.png').size;
if (size > 204800) fail(`exceeds 200 KB cap: ${size} bytes`);
if (size < 1000) fail(`suspiciously small: ${size} bytes`);
```

### Shared 3 — Warm-earth palette source-of-truth + inline duplication

**Source:** `src/index.css` lines 4–11 (`@theme` block — single source of truth
for app palette).
**Applies to:** Landing `<style>` block in `index.html` (duplicated inline per
RESEARCH Finding 12) + `scripts/generate-og-image.mjs` lines 19–22 (already
duplicated to script-scope constants).

```css
/* From src/index.css @theme — copy as :root vars for landing */
--color-bg: #f4f1eb;          /* → --bg on landing */
--color-text-primary: #3d4a38; /* → --text-primary */
--color-text-secondary: #8a7e6b;
--color-sage: #5c6b56;
--color-accent: #c27c5a;
--color-border: #d4cbbe;
```

**Synchronization rule:** If `src/index.css` palette changes, the landing's inline
`<style>` block and `scripts/generate-og-image.mjs` constants must be hand-updated.
Documented in UI-SPEC Color section ("synced manually; if `src/index.css` changes,
this inline block must be hand-updated").

### Shared 4 — Placeholder canonical URL (`https://soundly.local/Soundly/`)

**Source:** `index.html` + `public/robots.txt` + `public/sitemap.xml` (Phase 10
D-23) + `docs/deploy-runbook.md` §1 placeholder-swap procedure.
**Applies to:** New `app/index.html` (uses `/Soundly/app/` variant) + landing
`index.html` (keeps bare `/Soundly/`).

**Rule:** Source files in main commit the placeholder; deploy runbook step 1 swaps
to real deploy URL. Two variants now coexist:
- `https://soundly.local/Soundly/` — landing canonical/og:url + sitemap loc[0]
- `https://soundly.local/Soundly/app/` — app shell canonical/og:url + sitemap loc[1]

Both swap to the same actual deploy host + suffix on release.

### Shared 5 — Vite base-prefix path rewriting (HTML attributes only)

**Source:** RESEARCH Finding 11 + existing `index.html` line 10 (`<link
rel="apple-touch-icon" href="/icons/icon-192x192.png" />` → `dist/Soundly/icons/...`).
**Applies to:** Landing `index.html` asset references + app-shell `app/index.html`
asset references + any new `<img src="/...">` / `<a href="/...">` in either entry.

**Rule:**
- HTML attributes (`src`, `href`, `srcset`): use root-relative without `/Soundly/`
  prefix — Vite auto-prepends `base: '/Soundly/'` at build time.
- Inline `<script>` body strings: use literal `/Soundly/app/` (full prefix) — JS
  string literals are NOT rewritten by Vite's HTML transform.
- Inline `<style>` `url()` references: NOT rewritten — avoid (use HTML `<img>`
  instead) or use literal `/Soundly/...`.

### Shared 6 — Commit message style

**Source:** Recent git log (`docs(10): capture phase 10 context`, `feat(09): Cancel
discards...`, `feat(09): Stop returns...`).
**Applies to:** All Phase 11 commits.

**Pattern:** `<type>(<phase>): <imperative summary>` where:
- `<type>` ∈ `{feat, fix, docs, test, refactor, chore}`
- `<phase>` = padded phase number (`11`)
- `<imperative summary>` = lowercase, no trailing period, ≤ 72 chars

Examples for Phase 11:
- `feat(11): split build into landing + app entries (LAND-01, LAND-02)`
- `feat(11): narrow SW NavigationRoute to /Soundly/app (LAND-06)`
- `feat(11): add static landing page with install CTA (LAND-03)`
- `test(11): expand static-assets tests for landing + app shell split`
- `docs(11): append Phase 11 SW-rescoping addendum to deploy runbook`

---

## No Analog Found

| File | Role | Data Flow | Reason | Substitute Source |
|------|------|-----------|--------|-------------------|
| `vite.config.ts` `build.rollupOptions.input` multi-page block | build config (new shape) | n/a | No previous multi-page entry in this repo | RESEARCH Finding 1 verbatim (lines 152–171) — official Vite 6 docs |
| `vite.config.ts` `manifest.id` field | build config (new field) | n/a | Not previously set; Finding 4 NEW requirement | RESEARCH Finding 4 (lines 247–266) — MDN Web/Manifest/id |
| `vite.config.ts` `injectManifest.globPatterns` narrowing | build config (new field) | n/a | Previously used default glob | RESEARCH Pitfall B (lines 549–561) verbatim |
| `<button id="install-btn">` + `beforeinstallprompt` capture logic | inline JS / event-driven | event | No install prompt logic in repo before Phase 11 | RESEARCH Finding 5 (lines 275–309) — MDN canonical pattern |
| `<details id="ios-install-panel">` disclosure widget | static HTML (native disclosure) | n/a | `IosInstallBanner.tsx` is the closest concept but is React-based and uses a dismiss-banner pattern, not a disclosure panel | UI-SPEC Component States §2 (lines 364–404) — full implementation with custom-marker CSS |

For each of these, the planner cites the RESEARCH or UI-SPEC section as the
authoritative source (instead of an existing codebase analog) and reproduces the
verbatim pattern in the relevant PLAN.md action.

---

## Metadata

**Analog search scope:**
- `index.html` (root) — Phase 10 meta block, apple-* tags, JSON-LD shape
- `vite.config.ts` — VitePWA + base + manifest structure
- `src/sw.ts` — full SW source (54 lines)
- `src/components/IosInstallBanner.tsx` — React iOS banner reference
- `src/platform/standalone.ts` — iOS + standalone detection helpers
- `src/index.css` — `@theme` warm-earth palette source-of-truth
- `public/og-image-v1.png` + `scripts/generate-og-image.mjs` — versioned-PNG sibling
- `public/sitemap.xml` + `public/robots.txt` — placeholder canonical pattern
- `tests/static-assets.test.ts` — Phase 10 test structure (describe blocks, regex assertions)
- `scripts/verify-phase-10-build.mjs` — Phase 10 build verifier structure
- `docs/deploy-runbook.md` — placeholder-swap procedure + commit-style precedent

**Files NOT scanned (out of scope for Phase 11):**
- Phase 7–9 React components (`Composer.tsx`, `SegmentRow.tsx`, etc.) — Phase 11
  restructures HTML entries + SW scope, not React code (per CONTEXT line 127)
- All audio engine modules (`src/engine/*`, `src/lib/audio/*`) — untouched

**Pattern extraction date:** 2026-05-21

**Ready for planning:** Yes — each Phase 11 file has either a concrete in-repo
analog with extracted code excerpts, or a cited RESEARCH/UI-SPEC verbatim source
for greenfield additions.
