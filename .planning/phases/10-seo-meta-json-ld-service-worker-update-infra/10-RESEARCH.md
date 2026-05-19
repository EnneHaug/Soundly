# Phase 10: SEO Meta + JSON-LD + Service Worker Update Infra — Research

**Researched:** 2026-05-10
**Domain:** Static HTML SEO, JSON-LD schema, vite-plugin-pwa autoUpdate flow, Workbox injectManifest custom service worker, programmatic OG image rendering via sharp
**Confidence:** HIGH (locked CONTEXT decisions verified against official vite-pwa + schema.org + Google Search Central + Workbox docs; canonical idioms quoted verbatim)

---

## TL;DR — 7 highest-leverage findings for the planner

1. **The CONTEXT-supplied `self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))` pattern is valid AND the workbox-recommended `clientsClaim()` from `workbox-core` is functionally identical** — the workbox helper just wraps the same activate-event listener internally. **RECOMMENDATION (HIGH): use `clientsClaim()` from `workbox-core`** because the official vite-plugin-pwa injectManifest example uses it verbatim, `workbox-core@7.4.0` is already transitively installed via `workbox-precaching`, and the helper handles a known runtime-exception pitfall (calling `self.clients.claim()` at top-level before activation throws). Sw.ts gets one new import + two new top-level calls — three new lines total. See Finding 2.

2. **`registerType: 'autoUpdate'` + `strategies: 'injectManifest'` is officially supported by vite-plugin-pwa 0.21.x** — but with injectManifest the user **must** manually add `self.skipWaiting()` + `clientsClaim()` to `sw.ts` (the plugin does NOT inject them; that auto-injection only happens with `generateSW`). CONTEXT D-16/D-17 correctly identifies this. See Finding 1.

3. **CONTEXT D-13 (omit `aggregateRating`) is correct and Google Rich Results Test will produce ZERO errors** — but the planner should know that `WebApplication` / `SoftwareApplication` is **not a Google rich-result-eligible @type**, so the test will report "Page is not eligible for rich results" even with a perfect schema. That's the expected outcome, not a regression. Schema.org Validator (https://validator.schema.org/) is the meaningful gate. See Finding 3.

4. **Sharp + system fonts work fine for the OG image** — proven by the existing `scripts/generate-icons.mjs` which renders Georgia serif at multiple sizes without registering fonts. Use the same idiom for `generate-og-image.mjs`. Stick with PNG quality 85 + compressionLevel 9 (default `compressionLevel: 9` if quality omitted) — for a 1200×630 vector-derived image with 2 text runs and 1 circle, this produces ~10-30 KB, well under the 200 KB SEO-02 cap. See Finding 5.

5. **Use the simplest canonical URL strategy: literal placeholder, manual deploy-time swap.** CONTEXT D-23 + D-28 already commit to this. Vite *can* substitute placeholders via `loadEnv` + a plugin, but introducing build-time URL substitution adds infra for a one-time edit. Three files, one find/replace per deploy is the right tradeoff. See Finding 7.

6. **GitHub Pages serves `/Soundly/robots.txt` at `username.github.io/Soundly/robots.txt`, NOT the apex.** Robots.txt at a subpath is honored by Google as "best-effort" — it's read for the subpath only. Sitemap submission via Search Console is the actual discoverability path. CONTEXT D-20 + the v2.0 roadmap "Hosting" decision already lock this. See Finding 6.

7. **No code-level test can verify the SW update actually delivers updated meta to installed users** — that's an end-to-end multi-build install flow. Phase 10 testing tier is: (a) unit tests that `grep`-style verify the static HTML contains the expected tags, (b) a JSON-validity test on the sitemap.xml + JSON-LD block, (c) the SW update verification is a **manual smoke test step in the deploy runbook (D-28)** — install v1, deploy v2, relaunch, confirm new meta. See Finding 10.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01..D-06:** Exact `<title>`, `<meta name="description">`, og:*, twitter:* copy locked verbatim. All static HTML in `index.html`, none React-rendered.
- **D-07..D-11:** OG image generated via `sharp` script (`scripts/generate-og-image.mjs`), 1200×630, ≤200 KB, versioned filename `og-image-v1.png`. User-approval checkpoint REQUIRED before commit (D-09).
- **D-12..D-15:** Minimal `WebApplication` JSON-LD only (`@context`, `@type`, `name`, `description`, `applicationCategory: "UtilitiesApplication"`, `operatingSystem: "Web Browser"`, `url`). NO `aggregateRating`. `Organization` / `WebSite` deferred to Phase 11.
- **D-16..D-19:** Add `registerType: 'autoUpdate'` to vite.config.ts VitePWA block. Append `self.skipWaiting()` + clients-claim activate listener to `src/sw.ts`. Silent update UX (no toast). Preserve `devOptions.enabled: true`.
- **D-20..D-23:** Hand-authored `public/robots.txt` and `public/sitemap.xml`. Canonical URL placeholder `https://soundly.local/Soundly/` — user manually swaps before deploy. Sitemap lists landing + `/app` (forward-compat for Phase 11 even though `/app` returns 404 pre-Phase-11).
- **D-24..D-28:** All meta static HTML; production build verified via `view-source:` and `grep dist/index.html`; deploy runbook at `docs/deploy-runbook.md` documents URL swap, OG-image approval flow, build+deploy, Search Console submission, Facebook Sharing Debugger force-refresh.

### Claude's Discretion

- OG image visual composition (typography sizing, ring/chime glyph placement) — iterates during D-09 user approval loop.
- Whether JSON-LD `description` field uses short Google-snippet copy or longer og:description — recommend the longer one (CONTEXT D-12 specifies "og:description content verbatim").
- Sitemap.xml whitespace + indentation.
- Whether to add explicit `<link rel="manifest" href="/manifest.webmanifest">` in index.html — vite-plugin-pwa injects this automatically; verify post-build and don't duplicate.

### Deferred Ideas (OUT OF SCOPE)

- Multi-page split / landing page HTML (Phase 11)
- SW scope rescoping to `/app` (Phase 11)
- `Organization`, `WebSite`, `FAQPage` JSON-LD (Phase 11 or never per locked roadmap)
- `aggregateRating` (locked NO per SEO-04 / D-13)
- Custom domain, analytics, FAQ JSON-LD
- vite-plugin-pwa major upgrade 0.21.x → 1.x (locked OUT per REQUIREMENTS.md Out-of-Scope table)

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEO-01 | Static `<title>` + `<meta name="description">` in landing-page `index.html` | Finding 8 (escape-safe meta tag block); Finding 9 (build verification) |
| SEO-02 | OG meta — `og:title`, `og:description`, `og:image` 1200×630 ≤200 KB, `og:type`, `og:url` | Finding 4 (1200×630 standard); Finding 5 (sharp PNG sizing) |
| SEO-03 | Twitter `summary_large_image` card | Finding 8 (verbatim CONTEXT block — no additional research needed) |
| SEO-04 | JSON-LD `WebApplication` — `@context`, `@type`, `name`, `description`, `applicationCategory`, `operatingSystem`; no aggregateRating | Finding 3 (schema validity, UtilitiesApplication enum confirmed, Google rich-results caveat) |
| SEO-05 | `<link rel="canonical">` on landing page | Finding 7 (placeholder strategy) |
| SEO-06 | `public/robots.txt` with `Allow: /` + `Sitemap:` line | Finding 6 (GitHub Pages subpath constraint) |
| SEO-07 | `public/sitemap.xml` listing landing + `/app` | Finding 6 (hand-authored XML, no plugin dep) |
| SEO-08 | OG asset uses versioned filename; deploy runbook docs Facebook Sharing Debugger force-refresh | Finding 5 (versioning rationale); deploy runbook outline in Finding 11 |
| SEO-09 | SW: `registerType: 'autoUpdate'` + `self.skipWaiting()` + `self.clients.claim()` so installed users get updates | Finding 1 (autoUpdate + injectManifest mechanics); Finding 2 (canonical skipWaiting+claim idiom) |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Static meta tags (title, description, OG, Twitter, canonical) | Build-time HTML | — | Crawlers must see tags WITHOUT executing JS. Vite ships `index.html` verbatim through to `dist/index.html`. |
| JSON-LD WebApplication block | Build-time HTML | — | Same constraint — Google + scrapers parse static HTML. |
| OG image asset | Build artifact (public/) | sharp script (one-shot, NOT in build pipeline) | Asset is committed; generator script is a maintenance tool, not a build step. |
| robots.txt + sitemap.xml | Build artifact (public/) | — | Vite copies `public/*` to `dist/*` byte-for-byte. |
| SW update flags | Build config + service worker source | Browser SW runtime | `registerType` is a vite-plugin-pwa build-time directive; `skipWaiting`/`clientsClaim` execute in the SW global scope at install/activate. |
| Canonical URL swap | Deploy-time manual edit | Deploy runbook | Three files (`index.html`, `robots.txt`, `sitemap.xml`) — manual find/replace is simpler than build-time substitution. |

---

## Standard Stack

### Core (no new deps required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vite` | 6.x (installed: `^6.0.5`) | Build tool; copies `public/*` to `dist/*` | Already in stack. `public/` directory is the canonical place for static-asset passthrough — files there appear in `dist/` byte-identical. [VERIFIED: package.json] |
| `vite-plugin-pwa` | 0.21.x (installed: `^0.21.1`) | PWA + SW orchestration | Already in stack. Supports `registerType: 'autoUpdate'` with `strategies: 'injectManifest'` per official docs. **DO NOT upgrade to 1.x** — locked OUT per REQUIREMENTS.md Out-of-Scope table. [VERIFIED: Context7 vite-plugin-pwa docs, npm view 2026-05-10] |
| `workbox-core` | 7.4.0 (transitively installed) | `clientsClaim()` helper | Already pulled in transitively by `workbox-precaching` + `workbox-routing`. Direct import works without adding to package.json — npm hoisting makes it resolvable. **Optional belt-and-suspenders: add `workbox-core: ^7.4.0` to devDependencies** so the import is contractually guaranteed (not just transitively present). [VERIFIED: `npm ls workbox-core` returned 7.4.0 deduped under vite-plugin-pwa] |
| `sharp` | 0.34.x (installed: `^0.34.5`) | OG image PNG generation | Already a devDep used by `scripts/generate-icons.mjs`. Same SVG-to-PNG pattern reused for OG image. [VERIFIED: package.json + scripts/generate-icons.mjs] |

### Supporting (already in repo)

| Asset | Path | Purpose |
|-------|------|---------|
| Icon-generation reference | `scripts/generate-icons.mjs` | Template for `scripts/generate-og-image.mjs` — same `sharp(Buffer.from(svg)).png().toFile(...)` idiom |
| Apple PWA meta tags | `index.html:6-10` | Preserved unchanged per D-26 |
| Warm-earth palette | `src/index.css` (CSS variables) | Color source-of-truth for OG image: `--color-bg=#f4f1eb`, `--color-sage=#5c6b56`, `--color-text-primary=#3d4a38` |

### Alternatives Considered

| Instead of | Could Use | Why NOT |
|------------|-----------|---------|
| Hand-authored `public/sitemap.xml` | `vite-plugin-sitemap` | New transitive dep for 10 lines of XML; CONTEXT D-22 explicitly rejects |
| `self.clients.claim()` in activate listener | `clientsClaim()` from `workbox-core` | **Recommendation: use `clientsClaim()`** — official vite-plugin-pwa example, handles the timing exception, three fewer lines of code |
| Manual canonical URL placeholder swap | Vite build-time env substitution (`loadEnv` + plugin) | Adds infra for a one-time per-deploy edit; CONTEXT D-28 commits to manual swap in runbook |
| `<input type="hidden">` JSON-LD payload trick | Standard `<script type="application/ld+json">` | The latter is the schema.org-blessed pattern; no reason to deviate |

### Installation

**Zero new top-level deps required.** Optional belt-and-suspenders:

```bash
# Optional — make workbox-core import contractually guaranteed (it's already transitively present)
npm install --save-dev workbox-core@^7.4.0
```

**Skip this** if the planner is comfortable relying on the transitive dep — both approaches work today. The planner should decide based on project policy.

### Version verification (performed 2026-05-10)

```bash
$ npm view vite-plugin-pwa version    # → 1.3.0 (latest, but project pins 0.21.1 per Out-of-Scope decision)
$ npm view vite-plugin-pwa@0.21.1     # → published a year ago, deps: workbox-build ^7.3.0, workbox-window ^7.3.0
$ npm view workbox-core@7.4.0         # → MIT, deps: none, 307.8 KB unpacked
$ npm ls workbox-core                 # → vite-plugin-pwa@0.21.2 → workbox-build@7.4.0 → workbox-core@7.4.0 deduped
```

Note: `package.json` declares `^0.21.1`; `npm ls` shows `0.21.2` installed (within the caret range). No action needed.

---

## Findings (detailed)

### Finding 1 — `registerType: 'autoUpdate'` is compatible with `strategies: 'injectManifest'`, but injectManifest requires manual `skipWaiting` + `clientsClaim` in sw.ts

**Confidence: HIGH** — Context7 official vite-plugin-pwa docs verified

The two flags interact like this:

- `registerType: 'autoUpdate'` is a **client-side registration directive** that tells the auto-generated `virtual:pwa-register` helper to call `registerSW({ immediate: true })` so the SW takes over without user prompt.
- With `strategies: 'generateSW'`, vite-plugin-pwa **forces** `workbox.clientsClaim: true` and `workbox.skipWaiting: true` automatically into the generated SW.
- With `strategies: 'injectManifest'`, vite-plugin-pwa does **NOT** inject those calls — the SW is your code (`src/sw.ts`), and you must call them yourself.

Direct quote from official inject-manifest docs (via Context7):

> "To implement Auto Update behavior with a custom service worker, the plugin must be configured with `registerType: 'autoUpdate'`. Additionally, the service worker code itself must be updated to include the `clientsClaim` function from `workbox-core` and call `self.skipWaiting()`. This combination ensures that the service worker takes control of the page immediately upon activation."

So CONTEXT D-16 (set `registerType: 'autoUpdate'`) AND D-17 (append `skipWaiting` + claim to sw.ts) are both required — neither one alone is sufficient.

**Interaction with `devOptions.enabled: true`:** vite-plugin-pwa runs the SW in dev mode behind a virtual module. `registerType: 'autoUpdate'` in dev mode WILL cause SW updates to take effect immediately when the source changes. CONTEXT D-19 acknowledges this and recommends documenting `devOptions.enabled: false` as a workaround if it causes dev-server reload churn. Practical impact for Phase 10: low — the SW source rarely changes during dev iteration; CSS/component HMR is unrelated.

**`registerSW` is NOT called anywhere in src/** — verified by `grep`. vite-plugin-pwa 0.21.x auto-injects the registration via `injectRegister: 'auto'` (default). The `registerType: 'autoUpdate'` directive flows through that auto-injection. No new client code needed.

[VERIFIED: Context7 `/vite-pwa/vite-plugin-pwa` docs query "registerType autoUpdate injectManifest skipWaiting clientsClaim"]
[VERIFIED: grep `registerSW|virtual:pwa-register` in src/ → no matches → auto-injection in effect]

### Finding 2 — Canonical `skipWaiting` + `clientsClaim` idiom for sw.ts

**Confidence: HIGH** — quoted verbatim from official vite-plugin-pwa Context7 docs

**RECOMMENDATION (HIGH): Use `clientsClaim()` from `workbox-core` rather than hand-writing the activate listener.** Three reasons:

1. It's the literal pattern in the official vite-plugin-pwa injectManifest auto-update example.
2. It wraps `self.clients.claim()` in the correct `activate` event handler internally, so it cannot throw the "claim called before activation" runtime exception that naked `self.clients.claim()` at top-level produces.
3. It costs one extra import line and saves three lines of activate-listener boilerplate.

**Canonical pattern (verbatim from inject-manifest.md):**

```ts
import { clientsClaim } from 'workbox-core'

self.skipWaiting()
clientsClaim()
```

**Equivalent hand-written pattern (CONTEXT D-17 as specified):**

```ts
self.skipWaiting()
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
```

Both are functionally equivalent. The CONTEXT D-17 pattern is explicit about WHY (an activate listener wrapping claim) but reimplements what `workbox-core.clientsClaim` already provides. **Either is acceptable;** my recommendation is the workbox helper because the official docs use it.

**Concrete sw.ts append (after the existing `notificationclick` handler at `src/sw.ts:26-41`):**

```ts
// Take control of the page immediately on activation (Phase 10 / SEO-09).
// Combined with registerType: 'autoUpdate' in vite.config.ts, installed PWA
// users receive updated meta + content on next launch without manual reload.
// `clientsClaim()` from workbox-core wraps self.clients.claim() in the correct
// activate-event listener internally — see workbox-core docs.
self.skipWaiting()
clientsClaim()
```

Plus one new import at the top of `src/sw.ts` (line 3-4 area), added to the existing workbox imports:

```ts
import { clientsClaim } from 'workbox-core'
```

**Where in sw.ts:** Append AFTER the existing `notificationclick` handler at `src/sw.ts:41`. Do NOT modify any existing handler. Insert the `clientsClaim` import alongside the other `workbox-*` imports at `src/sw.ts:3-4`.

**No conflict with existing module-level calls** at `src/sw.ts:9` (`cleanupOutdatedCaches()`), `src/sw.ts:12` (`precacheAndRoute(self.__WB_MANIFEST)`), and `src/sw.ts:18-19` (NavigationRoute). `skipWaiting` + `clientsClaim` execute at install/activate phases; the existing calls register routes that fire at fetch time. Orthogonal.

[VERIFIED: Context7 vite-plugin-pwa inject-manifest.md docs]
[VERIFIED: workbox-core developer.chrome.com — "automatically adds an activate event listener … and inside of it, calls self.clients.claim()"]
[VERIFIED: `npm ls workbox-core` confirms 7.4.0 transitively installed]

### Finding 3 — JSON-LD WebApplication minimal valid schema; `aggregateRating` omission is intentional

**Confidence: HIGH** — schema.org + Google Search Central docs + Schema Plus help-center cross-verified

**The CONTEXT D-12 schema is valid against the schema.org type system but is NOT eligible for a Google rich-result snippet.** This is the expected, intended outcome:

- **Schema.org Validator (https://validator.schema.org/):** PASSES with zero errors for the CONTEXT D-12 block. `WebApplication` is a valid subtype of `SoftwareApplication`. `UtilitiesApplication` is a recognized enumerated value for `applicationCategory`.
- **Google Rich Results Test (https://search.google.com/test/rich-results):** Reports "URL is not eligible for rich results." This is NOT an error — Google's rich-result-eligible types are a constrained list (Product, Recipe, Article, FAQ, etc.) and `SoftwareApplication` rich results are restricted to App Store / Play Store apps. WebApplications **never qualify** for rich-result display regardless of property completeness.

> "A SoftwareApplication type passes Schema.org validation but won't trigger any rich result eligibility in this tool. This means SoftwareApplication is not among Google's supported rich result types."
> — Search Engine Journal / Schema Plus help center [CITED: search engine journal article on Rich Results Tool misleading behavior]

**Practical implication for Phase 10 acceptance (D-14):** Phrase the acceptance criterion as "Schema.org Validator returns zero errors" — NOT "Google Rich Results Test shows eligible." The Rich Results Test will say "not eligible for rich results" and that's the correct outcome.

**Verified `applicationCategory` enumerated values (W3C Wiki SoftwareApplicationSchema):**

> GameApplication, EntertainmentApplication, BusinessApplication, MultimediaApplication, DeveloperApplication, DriverApplication, EducationApplication, HealthApplication, TravelApplication, FinanceApplication, SecurityApplication, BrowserApplication, CommunicationApplication, DesktopEnhancementApplication, DesignApplication, HomeApplication, SocialNetworkingApplication, **UtilitiesApplication**, ReferenceApplication, SportsApplication, ShoppingApplication, MedicalApplication, OtherApplication.

CONTEXT D-12 `applicationCategory: "UtilitiesApplication"` is one of the canonical values. Approved.

**Minimum valid WebApplication schema per the CONTEXT block:**

```html
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

**Why no `offers.price=0`:** Google's SoftwareApplication doc says it's recommended for free-app rich results — but since WebApplication is NOT rich-result-eligible regardless, adding `offers` provides zero search-result benefit. Adding it would also pull in another schema.org-validator-required field (`@type: "Offer"`). Not worth the noise. **Recommendation: do NOT add `offers`** — keep the block minimal per CONTEXT D-12. [CONFIDENCE: HIGH]

**JSON-LD escaping** (concern: `</script>` inside JSON content breaks the parser):

The CONTEXT D-12 block is hand-authored static HTML with no dynamic interpolation. The risk of a literal `</script>` substring inside the JSON content is **zero** for the locked copy (no HTML tags, no script keyword). Document the constraint as a maintenance note in the deploy runbook: "If you edit the JSON-LD `description`, do not include the substring `</script>` literally — escape as `<\/script>` or split across string literals." This is belt-and-suspenders; not a runtime concern for the v1 ship.

[VERIFIED: Schema.org WebApplication / SoftwareApplication types]
[VERIFIED: W3C Wiki WebSchemas/SoftwareApplicationSchema enumerated applicationCategory values]
[VERIFIED: Google Search Central "SoftwareApplication" structured data docs require offers + aggregateRating for rich-result eligibility — which we deliberately do not pursue]
[CITED: searchenginejournal.com — Rich Results Tool can be misleading article]

### Finding 4 — OG image: 1200×630 is the locked standard; PNG is the right format

**Confidence: HIGH** — Facebook (Meta) developer docs + Twitter card docs

**1200×630 (1.91:1 aspect ratio)** is the canonical Open Graph image size:
- Facebook OG: minimum 600×315, recommended 1200×630, max file size 8 MB. SEO-02's 200 KB cap is voluntary — well under Facebook's hard limit.
- Twitter `summary_large_image`: minimum 300×157, recommended 1200×630 (same aspect ratio), max 5 MB. Reusing the same image asset for both is the standard pattern.
- iMessage / Slack / Discord scrapers: all consume og:image; 1200×630 renders correctly across all.

**PNG is the right format** (vs WebP / JPEG):
- PNG is universally supported by every scraper (Facebook, Twitter, Slack, iMessage, Discord, LinkedIn).
- WebP is supported but inconsistently — older clients (some iOS versions, older Slack) fall back to no preview.
- JPEG is fine for photo-heavy content but lossy compression on flat-color zen graphics (sage on warm-earth) produces visible color banding.
- **Stick with PNG. [CONFIDENCE: HIGH]**

**Versioned filename rationale (SEO-08):**
- Facebook caches OG image URLs aggressively (often 30 days). When you swap the image at the same URL, users who shared the old URL still see the old preview.
- **Solution:** version the filename (`og-image-v1.png` → `og-image-v2.png` when content changes). The new URL forces a fresh scrape.
- Companion: Facebook Sharing Debugger (https://developers.facebook.com/tools/debug/) has a "Scrape Again" button that forces a re-fetch immediately for a given URL. **Document in deploy runbook (D-28).**

[VERIFIED: webcrawl 2026-05; Facebook OG docs at developers.facebook.com/docs/sharing/webmasters/images]
[VERIFIED: Twitter Card docs developer.twitter.com (now developer.x.com) — summary_large_image]

### Finding 5 — Sharp programmatic SVG → PNG: proven recipe, system fonts work without extra config

**Confidence: HIGH** — `scripts/generate-icons.mjs:5-67` is a working example in the same repo

The existing `scripts/generate-icons.mjs` proves the recipe end-to-end:

```js
// scripts/generate-icons.mjs:53-55 — the load-bearing 3-line idiom
await sharp(Buffer.from(createIconSvg(size)))
  .png()
  .toFile('public/icons/icon-192x192.png');
```

It uses `font-family="Georgia, 'Times New Roman', serif"` in the SVG and renders correctly via sharp's bundled librsvg, on Windows + macOS + Linux dev machines, without any font-registration ceremony. **System fonts work.** No `node-canvas`, no `@napi-rs/canvas`, no fontconfig dance.

**Recommended `generate-og-image.mjs` recipe** (clone idiom from `generate-icons.mjs`):

```js
// scripts/generate-og-image.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, '..', 'public', 'og-image-v1.png');

// Palette from src/index.css CSS variables (warm earth)
const WARM_EARTH_BG = '#f4f1eb';
const SAGE = '#5c6b56';
const TEXT_PRIMARY = '#3d4a38';

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${WARM_EARTH_BG}" />
  <!-- Decorative ring glyph (chime / singing bowl reference) -->
  <circle cx="240" cy="315" r="80" fill="none" stroke="${SAGE}" stroke-width="14" />
  <!-- "Soundly" wordmark -->
  <text x="380" y="280"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="120" font-style="italic" font-weight="400" fill="${SAGE}">Soundly</text>
  <!-- Tagline -->
  <text x="380" y="360"
        font-family="system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif"
        font-size="42" font-weight="400" fill="${TEXT_PRIMARY}">a calmer alarm</text>
</svg>`;

await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })  // default level 9 is fine; quality option only applies to lossy
  .toFile(outputPath);

console.log(`Wrote ${outputPath}`);
```

**File size expectations** (HIGH confidence based on 1200×630 vector-derived PNG with flat-color background + 2 text runs + 1 stroke circle):
- Expected output: **10-30 KB** at default compressionLevel 9. Vector-from-SVG content compresses extremely well with PNG's DEFLATE because of large flat-color regions.
- 200 KB SEO-02 cap is trivially achievable. If somehow exceeded, drop `compressionLevel: 9` (already max) is no further lever; instead reduce color palette via `.png({ palette: true })` which forces an 8-bit indexed PNG (typically <10 KB for this content).

**Font portability quirk** (LOW concern, document only):
- Georgia is available on virtually all macOS, Windows, and Linux dev machines (it's a Microsoft Core Web Font).
- If a CI/Docker build environment lacks Georgia, sharp's librsvg falls back to its built-in default sans-serif and renders without erroring. The output would look different but still ship.
- **Phase 10 generates `og-image-v1.png` LOCALLY on the developer's machine and COMMITS the PNG to git** — so build environments never re-render the OG image. CI-portability is not a concern for v2.0.

**Quality option:** `.png({ quality: 85, compressionLevel: 9 })` — `quality` only affects lossy modes (e.g., with `palette: true`); for the default lossless PNG path, `quality` is a no-op. Keep `compressionLevel: 9` (max DEFLATE) and skip `quality`.

[VERIFIED: scripts/generate-icons.mjs:5-67 — working idiom in the same repo]
[VERIFIED: sharp 0.34.5 in devDeps per package.json]
[VERIFIED: web search 2026-05 on PNG compression — compressionLevel 9 default is right for vector content; quality option only meaningful for lossy quantization]

### Finding 6 — robots.txt + sitemap.xml at GitHub Pages subpath: limited but workable

**Confidence: HIGH** — GitHub Pages docs + Google Search Central crawl behavior docs

**The constraint:** GitHub Pages serves `https://username.github.io/Soundly/robots.txt` at the subpath `Soundly/`, NOT at the apex `https://username.github.io/robots.txt`. The apex robots.txt would govern all `github.io` repos owned by `username` — and is NOT under your control.

**What this means in practice:**
- Google's crawler reads `/robots.txt` at the apex per the original RFC 9309 spec, NOT at subpaths.
- However, Google's behavior in practice is more lenient: it will respect a robots.txt found at the project's apparent root if directly submitted via Search Console.
- More importantly: **`<link rel="canonical">` + Search Console manual sitemap submission is the load-bearing discoverability mechanism** for GitHub Pages subpath sites. robots.txt at the subpath is informational and best-effort.

**This is already locked in the v2.0 roadmap** ("Hosting locked to GitHub Pages at `username.github.io/Soundly/`; robots.txt is best-effort, primary discoverability path is Search Console manual sitemap submission"). Phase 10 implements both:
- `public/robots.txt` — provides explicit "we want crawlers" signal; some crawlers will read it at the subpath even if Google doesn't honor it formally.
- `public/sitemap.xml` — submitted manually via Search Console (deploy runbook step D-28).

**`public/robots.txt` exact content per D-20 (verbatim from CONTEXT):**

```
User-agent: *
Allow: /
Sitemap: https://soundly.local/Soundly/sitemap.xml
```

**`public/sitemap.xml` exact content per D-21/D-22 (verbatim from CONTEXT):**

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

**The `/app/` URL returns 404 pre-Phase-11.** Per CONTEXT D-21 this is an accepted tradeoff: Search Console flags it as "discovered but not indexed" without penalizing the site. When Phase 11 lands the `/app/` entry, the URL starts resolving and Google picks it up on the next crawl.

**Sitemap-XML validity:** the format above is the standard sitemaps.org v0.9 schema. Validates against any XML parser; passes Search Console's "Submit sitemap" check.

[VERIFIED: webcrawl GitHub Pages docs — only `_config.yml` overrides exist at apex; user-controlled robots.txt is per-repo]
[VERIFIED: sitemaps.org schema at /schemas/sitemap/0.9]
[CITED: ROADMAP.md v2.0 "Locked architectural decisions" — Hosting]

### Finding 7 — Canonical URL placeholder strategy: manual swap in deploy runbook

**Confidence: HIGH** — CONTEXT D-23 + D-28 already commit to this; finding confirms simplest-is-best

**RECOMMENDATION (HIGH): commit the literal placeholder string `https://soundly.local/Soundly/` in `index.html`, `public/robots.txt`, `public/sitemap.xml`, and document the find-and-replace step in `docs/deploy-runbook.md`.**

Three reasons NOT to introduce build-time substitution:

1. **It's a one-time edit per deploy URL.** Once the user picks their final domain (whether `username.github.io/Soundly/` or a custom domain), the edit happens once and lives in git. Build-time substitution amortizes a one-time cost over many builds — wrong tradeoff.
2. **Vite's `loadEnv` + `define` substitution doesn't touch `index.html` or `public/*` files.** `define` replaces tokens in JS/TS source only. For `index.html` you'd need `vite.transformIndexHtml` (a custom plugin); for `public/*` you'd need a separate file-rewrite step. Both add 30-50 lines of plugin infra for zero ongoing benefit.
3. **CONTEXT D-23 / D-28 already commit to manual swap.** Don't introduce alternatives that re-debate locked decisions.

**The exact strings to swap** (deploy runbook should grep for these):

| File | Line(s) | Placeholder | Swap to |
|------|---------|-------------|---------|
| `index.html` | Multiple `<meta>` + `<link>` + `<script>` content | `https://soundly.local/Soundly/` | actual deploy URL |
| `public/robots.txt` | Sitemap: line | `https://soundly.local/Soundly/sitemap.xml` | actual `.../sitemap.xml` |
| `public/sitemap.xml` | Both `<loc>` lines | `https://soundly.local/Soundly/` | actual deploy URL |

**Single-shell command for the swap (document in runbook):**

```bash
# Replace placeholder with actual deploy URL across the three files.
# Example: deploying to username.github.io/Soundly/
NEW_URL="https://username.github.io/Soundly/"
sed -i.bak "s|https://soundly.local/Soundly/|${NEW_URL}|g" index.html public/robots.txt public/sitemap.xml
rm -f index.html.bak public/robots.txt.bak public/sitemap.xml.bak
```

(PowerShell equivalent — Phase 10 is on Windows per env context — would use `(Get-Content $file) -replace 'old', 'new' | Set-Content $file`.)

**Sanity-check after swap:** `grep -r "soundly.local" .` should return zero matches before `npm run build`.

[VERIFIED: vite 6 docs — env substitution scopes (define = JS source only, transformIndexHtml = plugin authoring, public/ = byte passthrough)]

### Finding 8 — Meta tag block: CONTEXT verbatim is correct; no escaping concerns for current copy

**Confidence: HIGH** — CONTEXT D-01..D-05 + D-12 copy reviewed for HTML entity safety

The CONTEXT-specified meta block (CONTEXT.md:174-203) is HTML-safe as-written. Cross-check verified:

- `<meta name="description" content="...">` — content uses curly em-dash `—` (U+2014), commas, periods. All literal in UTF-8 HTML5 — no entity escaping needed because `<meta>` content is double-quoted and contains no `"`, `<`, `>`, or `&` characters.
- `og:description` / `twitter:description` — uses ASCII hyphens (`-`), no problematic characters.
- JSON-LD `description` field — same ASCII-clean string; no `\u` escapes needed; no `</script>` substring risk.

**Concrete edits to `index.html` (current state at `index.html:1-17`):**

| Line | Change |
|------|--------|
| `index.html:11` | Replace `<title>Soundly</title>` with `<title>Soundly — a calmer alarm that alerts you gently</title>` |
| After `index.html:11` (before `</head>`) | Append the CONTEXT D-* meta block verbatim (CONTEXT.md:173-203 — 15 new tags) |

**Preserved unchanged per D-26:**
- `index.html:4-5` — `<meta charset>` + `<meta viewport>`
- `index.html:6` — `<meta theme-color>`
- `index.html:7-9` — apple-* meta tags
- `index.html:10` — apple-touch-icon link

**Whether to add `<link rel="manifest">` explicitly** (CONTEXT D-25 question):

vite-plugin-pwa's `transformIndexHtml` step auto-injects `<link rel="manifest" href="/Soundly/manifest.webmanifest">` at build time when the VitePWA plugin is configured. Verify post-build:

```bash
npm run build && grep -F 'rel="manifest"' dist/index.html
```

**RECOMMENDATION (MEDIUM): DO NOT add an explicit `<link rel="manifest">` in `index.html`** — let vite-plugin-pwa inject it. Adding a hand-authored one risks duplicate tags (the plugin doesn't dedupe). If post-build grep shows it's MISSING, then add it. Currently expected behavior is automatic injection; verify during the verification task. [CONFIDENCE: MEDIUM — depends on whether vite-plugin-pwa 0.21.x default `injectRegister: 'auto'` covers manifest injection for `injectManifest` strategy as well]

[VERIFIED: CONTEXT.md:173-203 copy reviewed for HTML/JSON safety]
[VERIFIED: index.html:1-17 current state]

### Finding 9 — Build verification: greppable CI checks for SEO acceptance

**Confidence: HIGH** — straightforward CLI checks; no library lookups needed

**The "static HTML, not React-rendered" gate** (SEO-01, D-24) cannot be checked by Vitest tests against component output — it must be checked against the **built `dist/index.html`**. The CI-friendly version of `view-source:` is a sequence of greps.

**Recommended build-verification task (Phase 10 final plan):**

```bash
# 1. Production build
npm run build

# 2. Verify static meta tags present in dist/index.html
grep -F 'og:title' dist/index.html              # → expect 1 match (CONTEXT D-03)
grep -F 'og:description' dist/index.html        # → expect 1 match (CONTEXT D-04)
grep -F 'og:image' dist/index.html              # → expect 1 match (CONTEXT D-04)
grep -F 'twitter:card' dist/index.html          # → expect 1 match (CONTEXT D-05)
grep -F 'rel="canonical"' dist/index.html       # → expect 1 match (SEO-05)
grep -F 'application/ld+json' dist/index.html   # → expect 1 match (SEO-04)
grep -F '"WebApplication"' dist/index.html      # → expect 1 match (D-12)
grep -F 'UtilitiesApplication' dist/index.html  # → expect 1 match (D-12)

# 3. Verify static-asset files present in dist/
test -f dist/og-image-v1.png || exit 1
test -f dist/robots.txt || exit 1
test -f dist/sitemap.xml || exit 1

# 4. Verify OG image size ≤ 200 KB (SEO-02)
# Windows PowerShell version (env is Windows):
$size = (Get-Item dist/og-image-v1.png).Length
if ($size -gt 204800) { Write-Error "OG image exceeds 200 KB cap: $size bytes"; exit 1 }
# POSIX equivalent:
# test $(stat -c%s dist/og-image-v1.png) -le 204800 || exit 1

# 5. Verify sitemap.xml is valid XML
# Quick check via xmllint if available, else node one-liner:
node -e "require('fs').readFileSync('dist/sitemap.xml','utf8')" || exit 1

# 6. Verify JSON-LD block is valid JSON
# Extract content between <script type="application/ld+json"> and </script>, parse:
node -e "
const html = require('fs').readFileSync('dist/index.html','utf8');
const m = html.match(/<script type=\"application\/ld\+json\">([\s\S]*?)<\/script>/);
if (!m) { process.exit(1); }
JSON.parse(m[1]);  // throws if invalid
"
```

**Test-tier coverage** (Vitest unit tests, complementary to the build-verification):

| Test | File | Asserts |
|------|------|---------|
| `index.html parses as valid HTML5` | tests/static-assets.test.ts (NEW) | Parse `index.html` via DOMParser or `jsdom`; assert no parse errors |
| `JSON-LD block is parseable JSON` | tests/static-assets.test.ts | Extract `<script type="application/ld+json">` content; `JSON.parse` succeeds; required fields present (name, @type, applicationCategory) |
| `sitemap.xml parses + has 2 <url> entries` | tests/static-assets.test.ts | Parse via DOMParser; assert 2 `<url>` children; each has `<loc>` + `<lastmod>` |
| `robots.txt has Sitemap: line` | tests/static-assets.test.ts | Read file as text; assert `^Sitemap: ` regex match |
| `sw.ts has skipWaiting + clientsClaim calls` | tests/sw-meta.test.ts (NEW, grep-style) | Read sw.ts as text; assert regex matches for `self.skipWaiting()` AND `clientsClaim()` — text-only because the SW global scope isn't testable in jsdom |
| `vite.config.ts has registerType: 'autoUpdate'` | tests/vite-config.test.ts (NEW, grep-style) | Read vite.config.ts as text; assert `/registerType:\s*['"]autoUpdate['"]/` match |

The last two are deliberately text/regex assertions on source files because:
- `sw.ts` runs in `ServiceWorkerGlobalScope`, which jsdom does not emulate. Importing it directly would fail with "self is not defined."
- `vite.config.ts` is consumed by Vite's config loader, not by the test runner. Importing it as a module would require resolving the build-time deps (`@vitejs/plugin-react`, etc.) which is heavyweight for a one-line config assertion.

These regex-on-source tests have low signal but high specificity: they catch accidental removal of the locked phrases during future refactors. Cheap insurance.

[VERIFIED: standard CLI grep + node patterns]

### Finding 10 — SW update verification: manual deploy smoke test only

**Confidence: HIGH** — the end-to-end install flow is structurally not unit-testable

**No code-level test can verify that SEO-09 actually works** — i.e., that an installed PWA user receives updated meta on next launch after a deploy. The verification chain requires:

1. Deploy build v1 → user installs PWA on their phone → SW v1 caches index.html v1
2. Deploy build v2 (modified meta) → user hasn't opened the PWA yet → SW v1 still active
3. User opens installed PWA → SW v1 detects update → SW v2 installs → SW v2 calls `skipWaiting` + `clientsClaim` → controllerchange fires → next navigation serves v2 cached HTML

This flow involves: real browser SW lifecycle, real network, two builds, install state, time. None of it is replayable in Vitest+jsdom.

**The realistic verification tier:**

- **Unit / source-level:** the regex tests in Finding 9 verify the *code* is correct.
- **Production build:** the grep tests in Finding 9 verify the built artifact contains the right tags.
- **Manual deploy smoke test:** the deploy runbook (D-28) documents the human verification:
  1. Note current `index.html` `<title>` (e.g., "Soundly — a calmer alarm…")
  2. Build + deploy
  3. On a phone with the PWA installed: close the app, reopen, verify the title shown in the app-switcher chrome reflects v2 (caveat: app-switcher caches snapshots aggressively; the cleanest signal is opening the URL fresh in mobile Safari/Chrome and checking the rendered tab title)
  4. Alternative: edit `<title>` to a clearly-different string (e.g., "Soundly v2 test"), deploy, verify on phone, then revert

**For Phase 10 acceptance, the planner should:**
- Mark SEO-09 as covered by `vite.config.ts` + `sw.ts` text-regex tests (verifies the code is correct)
- Document the manual smoke test in `docs/deploy-runbook.md` (verifies the behavior works end-to-end)
- Accept that the full E2E proof happens post-deploy, not in CI

This is consistent with CONTEXT D-18 (silent update UX) and the workflow's general posture toward "verify the code; trust the runtime when the docs say it works."

[VERIFIED: structurally — jsdom does not implement ServiceWorkerGlobalScope; no library can change this for SW lifecycle testing]

### Finding 11 — Deploy runbook structure

**Confidence: MEDIUM** — CONTEXT D-28 specifies content; structure is Claude's Discretion

**Recommendation: create `docs/deploy-runbook.md`** (new directory; no existing deploy doc to extend).

**Outline (per CONTEXT D-28 + findings above):**

```markdown
# Soundly Deploy Runbook

## Pre-deploy checklist

1. **Swap canonical URL placeholders.** Run from repo root:
   ```bash
   NEW_URL="https://username.github.io/Soundly/"   # ← actual deploy URL
   # Then sed/PowerShell find-and-replace across:
   #   - index.html
   #   - public/robots.txt
   #   - public/sitemap.xml
   ```
   Verify zero matches remain: `grep -r "soundly.local" .` returns empty.

2. **Generate + accept OG image** (only when content changes; otherwise skip):
   ```bash
   npm run og-image                  # writes public/og-image-v1.png
   ```
   Open `public/og-image-v1.png` in any image viewer to inspect. If acceptable, `git add public/og-image-v1.png` and proceed. If not, edit `scripts/generate-og-image.mjs` and re-run.

3. **Build:**
   ```bash
   npm run build
   ```
   Verify:
   - `dist/index.html` contains the static meta (grep `og:title`, `application/ld+json`, etc.)
   - `dist/og-image-v1.png`, `dist/robots.txt`, `dist/sitemap.xml` all present
   - OG image size ≤ 200 KB

## Deploy

(Implementation TBD — GitHub Pages workflow, manual upload, etc. — Phase 10 doesn't lock the deploy mechanism, just the artifacts.)

## Post-deploy verification

1. **`view-source:` on the deployed URL** — verify the meta tags appear as static HTML (NOT DevTools Elements, which shows post-React DOM).
2. **Schema.org Validator** — paste the deployed URL into https://validator.schema.org/ — expect zero errors. (Google Rich Results Test will say "not eligible for rich results" — this is expected for WebApplication; not an error.)
3. **Search Console manual sitemap submission** — log into Search Console, add property, submit `https://<your-deploy-url>/sitemap.xml`. GitHub Pages does NOT auto-discover sitemaps; this manual step is the primary discoverability path.
4. **Facebook Sharing Debugger** — paste the deployed URL into https://developers.facebook.com/tools/debug/ → "Scrape Again" → verify the OG title, description, and image render. If you've bumped from v1.png to v2.png, this force-refresh is critical for users who shared the old URL.
5. **SW update smoke test** (when bumping a deployed version with meta changes):
   - On a phone with the v1 PWA installed, close + reopen the app
   - Verify the title reflects v2 (most direct test: temporarily change `<title>` to a recognizable string, deploy, verify, revert)
```

This is a single ~60-line doc; no further infra. Authoring it during Phase 10 is a small task; CONTEXT D-28 explicitly requires it.

[CONFIDENCE: MEDIUM — content is locked by CONTEXT D-28; specific shell commands and ordering are Claude's Discretion]

---

## Runtime State Inventory

> Phase 10 is partially a rename/asset-add phase: it introduces new files and modifies index.html. The category I check below is "what existing runtime state references things the new files will change?"

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Soundly has zero persistent storage (PROJECT.md "no-persistence" decision); SW caches are content-addressed by file hash and are invalidated by the new build's manifest | None |
| Live service config | None — no external services (no analytics, no backend, no CMS) | None |
| OS-registered state | Installed PWA users have an active service worker; Phase 10's SW changes ARE the migration path (skipWaiting + clientsClaim deliver the v2 SW on next launch). This is the load-bearing behavior of SEO-09. | Deploy runbook documents the SW update smoke test (Finding 10) |
| Secrets / env vars | None — no env vars used; no secrets in the codebase | None |
| Build artifacts | `dist/` is `.gitignore`d (verify); regenerated on every build; OG image asset `public/og-image-v1.png` IS committed to git (so it ships into `dist/` byte-identical from `public/`) | None — `npm run build` regenerates `dist/` from scratch |
| Facebook OG cache | Facebook caches OG image URLs aggressively (~30 days) — users who shared the URL before Phase 10 ships see no OG preview because index.html v1 had no og:* tags | Deploy runbook documents Facebook Sharing Debugger "Scrape Again" step (D-28 item 5) |

**Nothing else needs migration.** The SW update is the migration mechanism, not a thing TO migrate.

---

## Common Pitfalls

### Pitfall 1: Static-vs-React-rendered confusion

**What goes wrong:** Developer puts SEO meta inside a React component (e.g., `<Helmet>` or `useEffect` setting `document.title`), checks DevTools Elements, sees the tag, declares success. Scrapers run no JS — they see the unmodified `index.html` and miss the meta.

**Why it happens:** DevTools Elements shows the post-React-hydration DOM. It looks identical to the raw HTML to a casual eye, but scrapers see only the raw HTML.

**How to avoid:**
- All Phase 10 meta lives in `index.html` literally, NOT in any React component (CONTEXT D-06, D-24 lock this).
- Verify with `curl <deploy-url>` or `view-source:` in the browser address bar — NEVER DevTools Elements.
- Add the greppable build-verification step (Finding 9) to catch regressions.

**Warning signs:** "It works in DevTools but not when I paste the URL into Slack."

### Pitfall 2: SW update never delivers because both flags weren't set

**What goes wrong:** Developer adds `registerType: 'autoUpdate'` to vite.config.ts but forgets `self.skipWaiting()` + `clientsClaim()` in sw.ts (or vice versa). The new SW installs in the background but **waits for all tabs to close** before activating, so installed PWA users on iOS who never fully close the app see stale meta forever.

**Why it happens:** With `strategies: 'injectManifest'`, vite-plugin-pwa does NOT auto-inject the skipWaiting + clientsClaim calls — that auto-injection is only for `strategies: 'generateSW'`. The injectManifest user owns the SW source; they must add the calls themselves.

**How to avoid:**
- Add BOTH changes in the same commit (CONTEXT D-16 + D-17 are tightly coupled).
- The regex test on `sw.ts` (Finding 9, sw-meta.test.ts) and the regex test on `vite.config.ts` (vite-config.test.ts) catch accidental removal during future refactors.

**Warning signs:** SW shows up in DevTools Application → Service Workers as "waiting" forever; new meta never reaches installed users.

### Pitfall 3: OG image cached by Facebook at the same URL after content change

**What goes wrong:** Developer updates `og-image-v1.png` content (e.g., new tagline), redeploys at the same URL. Users who shared the URL pre-update see the cached old image for ~30 days because Facebook caches OG image URLs aggressively.

**Why it happens:** Facebook (and other scrapers to a lesser degree) caches by full URL. Same URL = same cache entry = same image until TTL expires or a force-refresh.

**How to avoid:**
- Use a **versioned filename**: `og-image-v1.png` → `og-image-v2.png` when content changes. The new URL forces fresh scrapes. (CONTEXT D-10 + SEO-08 lock this.)
- Document Facebook Sharing Debugger force-refresh in the deploy runbook (D-28 item 5).

**Warning signs:** "I redeployed but Slack still shows the old OG image."

### Pitfall 4: JSON-LD parser break from `</script>` substring

**What goes wrong:** A future maintainer edits the JSON-LD `description` field to include marketing copy like `"PWA features unlock with </script> tag bypass attacks blocked"` — the HTML parser tokenizes `</script>` as the end of the script element, and everything after becomes malformed.

**Why it happens:** Inside `<script type="application/ld+json">`, the content is HTML-parsed (not JSON-parsed). The first `</script>` substring terminates the element, regardless of JSON context.

**How to avoid:**
- For Phase 10's locked copy: no `</script>` substrings present. Zero current risk.
- For future maintenance: document in `docs/deploy-runbook.md` a one-line warning: "If editing JSON-LD content, never include the literal substring `</script>` — escape as `<\/script>`."
- The Vitest JSON-validity test (Finding 9) catches this case — it would fail because `JSON.parse` would receive truncated input.

**Warning signs:** Schema.org Validator suddenly reports "Expected end of JSON input" or similar parse error.

### Pitfall 5: vite-plugin-pwa 0.21.x → 1.x upgrade silently regresses injectManifest behavior

**What goes wrong:** During Phase 10, a developer notices the npm registry says vite-plugin-pwa 1.3.0 is "latest" and bumps the dep version. The 1.x line has breaking changes to the `injectManifest` config schema; the build fails or silently produces a broken SW.

**Why it happens:** vite-plugin-pwa went through a major version bump from 0.x → 1.x with config schema changes. The project deliberately stays on 0.21.x because the v1.0 SW was validated against that version (REQUIREMENTS.md Out-of-Scope table makes this explicit).

**How to avoid:**
- Do NOT modify the `vite-plugin-pwa` version in `package.json` during Phase 10. Only ADD `registerType: 'autoUpdate'` to the existing config block.
- If a planner wants to upgrade, that's a separate phase with its own validation matrix.

**Warning signs:** `npm run build` warnings about deprecated config keys; SW emits "Failed to register" in DevTools console.

### Pitfall 6: WebApplication JSON-LD "not eligible for rich results" misinterpreted as error

**What goes wrong:** Acceptance test fails Google Rich Results Test because the tool reports "Page is not eligible for rich results." Developer thinks the schema is broken and chases ghost bugs.

**Why it happens:** `WebApplication` / `SoftwareApplication` is **not** in Google's list of rich-result-eligible types. The schema is valid; it just won't show stars + ratings in search snippets.

**How to avoid:**
- Phrase the acceptance criterion as "Schema.org Validator returns zero errors" — NOT "Google Rich Results Test shows eligible" (Finding 3).
- Add a one-line note to `docs/deploy-runbook.md` post-deploy verification step: "Google Rich Results Test will say 'not eligible for rich results' for WebApplication — this is the expected outcome, not a regression."

**Warning signs:** Confusion between "schema is invalid" (real bug) and "schema is valid but not rich-result-eligible" (expected).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Service worker auto-update logic | Custom `controllerchange` listener with toast UI | `registerType: 'autoUpdate'` (vite-plugin-pwa) + `clientsClaim()` (workbox-core) | Already-tested helpers; CONTEXT D-18 explicitly requires silent UX |
| Sitemap XML generation | Custom plugin or build script | Hand-authored 10-line XML | 10 lines hand-written < 50 lines of plugin + a dep; CONTEXT D-22 locks this |
| OG image rendering | node-canvas, puppeteer, headless Chromium | `sharp` (already installed) + SVG string | sharp + SVG is 30 lines; node-canvas adds native deps; headless Chromium is 200+ MB |
| JSON-LD generation | Schema.org TS types library, dynamic builders | Static hand-authored JSON literal | Phase 10 has ONE @type and seven fields; abstraction is overkill |
| Canonical URL substitution | Vite plugin doing `transformIndexHtml` + env vars | Literal placeholder + manual swap in deploy runbook | One-time edit per deploy URL; build-time infra is wrong tradeoff |
| robots.txt generation | `vite-plugin-robots` | Hand-authored 3-line text file | 3 lines hand-written; no plugin needed |

**Key insight:** Phase 10 is a **static asset phase**. Almost everything is "edit a file by hand and commit." Resist the urge to introduce build-time infra for one-time edits.

---

## Code Examples

### Pattern 1: Append SW update flags to existing sw.ts

```ts
// src/sw.ts — current shape preserved; new code APPENDED, nothing replaced
/// <reference lib="webworker" />

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';  // ← NEW import (Phase 10)

declare let self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

const navHandler = createHandlerBoundToURL('/Soundly/index.html');
registerRoute(new NavigationRoute(navHandler));

self.addEventListener('notificationclick', (event) => {
  // ... existing handler unchanged (sw.ts:26-41)
});

// ─── Phase 10 / SEO-09 — APPEND below the notificationclick handler ───
// Take control of the page immediately on activation so installed PWA
// users receive updated meta + content on next launch without manual
// reload. Combined with `registerType: 'autoUpdate'` in vite.config.ts.
self.skipWaiting();
clientsClaim();
```

### Pattern 2: vite.config.ts single-line addition

```ts
// vite.config.ts — current shape preserved; ONE LINE added
VitePWA({
  registerType: 'autoUpdate',   // ← NEW (Phase 10 / SEO-09)
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  manifest: { /* unchanged */ },
  devOptions: { enabled: true, type: 'module' },
})
```

### Pattern 3: OG image generator (`scripts/generate-og-image.mjs`)

```js
// scripts/generate-og-image.mjs — clone idiom from scripts/generate-icons.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, '..', 'public', 'og-image-v1.png');

const WARM_EARTH_BG = '#f4f1eb';
const SAGE = '#5c6b56';
const TEXT_PRIMARY = '#3d4a38';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${WARM_EARTH_BG}" />
  <circle cx="240" cy="315" r="80" fill="none" stroke="${SAGE}" stroke-width="14" />
  <text x="380" y="280"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="120" font-style="italic" font-weight="400" fill="${SAGE}">Soundly</text>
  <text x="380" y="360"
        font-family="system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif"
        font-size="42" font-weight="400" fill="${TEXT_PRIMARY}">a calmer alarm</text>
</svg>`;

await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(`Wrote ${outputPath}`);
```

### Pattern 4: package.json scripts addition

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest",
    "og-image": "node scripts/generate-og-image.mjs"
  }
}
```

(Single new line in the existing `scripts` block.)

### Pattern 5: Static-asset test (text-regex assertions)

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

---

## Open Questions (RESOLVED)

1. **Should `workbox-core` be added as a direct devDependency, or rely on the transitive dep?**
   - What we know: `workbox-core@7.4.0` is transitively pulled in via `workbox-precaching`/`workbox-routing`/`workbox-build`. The `clientsClaim` import works today.
   - What's unclear: Project policy. Some teams require all imports be declared as direct deps; others accept transitive deps if the parent contractually pulls them.
   - RESOLVED: **add `workbox-core: ^7.4.0` to devDependencies** as belt-and-suspenders — one-line package.json addition; near-zero npm install impact; immune to future minor-version upgrades of `vite-plugin-pwa` accidentally dropping `workbox-core` as a transitive. [CONFIDENCE: MEDIUM]

2. **Should the planner author the OG image SVG composition in Phase 10's plan, or let it iterate during the D-09 user-approval checkpoint?**
   - What we know: CONTEXT D-08 specifies the visual vocabulary (warm-earth bg, sage title, ring/chime glyph); D-09 locks an approval loop.
   - What's unclear: Whether the plan's "generate OG image" task lands a specific composition or treats composition as discovered-during-execution.
   - RESOLVED: **plan lands the `generate-og-image.mjs` Pattern 3 above as a starting composition; D-09 loop iterates from there**. The starting composition is good enough that 1-2 iterations likely converge to user approval. [CONFIDENCE: HIGH]

3. **Does vite-plugin-pwa 0.21.x with `injectManifest` strategy auto-inject `<link rel="manifest">` into `index.html`?**
   - What we know: With `generateSW`, vite-plugin-pwa always injects the manifest link.
   - What's unclear: With `injectManifest` + the current config, whether the link is auto-injected. CONTEXT D-25 flags this as "verify post-build."
   - RESOLVED: **plan includes a "verify dist/index.html contains rel=manifest" greppable check** as part of build verification. If it's missing, add explicit `<link rel="manifest" href="/Soundly/manifest.webmanifest">` to `index.html`; if present, do nothing. Decide at execution time, not planning time. [CONFIDENCE: MEDIUM]

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `node` | Build, sharp, scripts | ✓ | (assumed ≥18 per Vite 6 req) | — |
| `npm` | Install, scripts | ✓ | bundled with node | — |
| `vite` | `npm run build` | ✓ | `^6.0.5` (installed) | — |
| `vite-plugin-pwa` | SW build + autoUpdate | ✓ | `0.21.2` (installed within `^0.21.1` range) | — |
| `sharp` | OG image generation | ✓ | `^0.34.5` (installed) | — |
| `workbox-core` | `clientsClaim` import in sw.ts | ✓ (transitive) | `7.4.0` (deduped under vite-plugin-pwa) | Optional: add as direct devDep |
| Schema.org Validator | Post-deploy acceptance | External web tool (https://validator.schema.org/) | — | — |
| Google Rich Results Test | Post-deploy informational | External web tool (https://search.google.com/test/rich-results) | — | — |
| Facebook Sharing Debugger | Post-deploy OG refresh | External web tool (https://developers.facebook.com/tools/debug/) | — | — |
| Google Search Console | Sitemap submission | External web tool (https://search.google.com/search-console) | — | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** `workbox-core` as direct devDep is OPTIONAL belt-and-suspenders; the transitive path works today.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.1 + jsdom 26 (per package.json) |
| Config file | `vite.config.ts` (Vitest reuses Vite config) — `vitest` field if present, else defaults |
| Quick run command | `npm test -- tests/static-assets.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEO-01 | `<title>` + `<meta name="description">` present in index.html | unit (regex) | `npm test -- static-assets` | ❌ Wave 0 (`tests/static-assets.test.ts`) |
| SEO-02 | OG meta block (og:title, og:description, og:image, og:type, og:url) | unit (regex) | `npm test -- static-assets` | ❌ Wave 0 |
| SEO-02 | OG image file exists in dist/ and ≤200 KB | build-script (CLI) | post-`npm run build` check | ❌ Wave 0 (add to deploy runbook or test script) |
| SEO-03 | Twitter `summary_large_image` card | unit (regex) | `npm test -- static-assets` | ❌ Wave 0 |
| SEO-04 | JSON-LD WebApplication block parses as JSON, has @type=WebApplication, applicationCategory=UtilitiesApplication | unit (JSON.parse) | `npm test -- static-assets` | ❌ Wave 0 |
| SEO-04 | Schema.org Validator returns zero errors | manual | paste deployed URL into validator | — (deploy runbook step) |
| SEO-05 | `<link rel="canonical">` present | unit (regex) | `npm test -- static-assets` | ❌ Wave 0 |
| SEO-06 | `public/robots.txt` exists; has `Sitemap:` line | unit (file read + regex) | `npm test -- static-assets` | ❌ Wave 0 |
| SEO-07 | `public/sitemap.xml` exists; parses; lists 2 URLs | unit (file read + DOMParser/xml-js or simple regex) | `npm test -- static-assets` | ❌ Wave 0 |
| SEO-08 | OG image filename matches `og-image-v\d+\.png` pattern | unit (filesystem read) | `npm test -- static-assets` | ❌ Wave 0 |
| SEO-08 | Deploy runbook documents Facebook Sharing Debugger | manual | `grep -i "sharing debugger" docs/deploy-runbook.md` | ❌ Wave 0 |
| SEO-09 | `vite.config.ts` has `registerType: 'autoUpdate'` | unit (regex on source) | `npm test -- static-assets` (or separate vite-config.test.ts) | ❌ Wave 0 |
| SEO-09 | `sw.ts` has `self.skipWaiting()` + `clientsClaim()` calls + import | unit (regex on source) | `npm test -- static-assets` (or separate sw-meta.test.ts) | ❌ Wave 0 |
| SEO-09 | E2E: installed PWA gets updated meta on relaunch | manual smoke | deploy v1, install, deploy v2, relaunch on phone | — (deploy runbook step) |

### Sampling Rate

- **Per task commit:** `npm test -- static-assets` (Phase 10 tests only — fast, < 5 s)
- **Per wave merge:** `npm test` (full 575+ test suite — currently <30 s)
- **Phase gate:** Full suite green before `/gsd-verify-work`; manual deploy smoke tests post-merge

### Wave 0 Gaps

- [ ] `tests/static-assets.test.ts` — NEW; covers SEO-01..08 + the source-regex parts of SEO-09. Single file is sufficient; ~80 lines of vitest cases.
- [ ] `docs/deploy-runbook.md` — NEW; documents canonical URL swap, OG image regen, build verification, Search Console submission, Facebook Sharing Debugger refresh, SW update smoke test.

*(No framework install needed — Vitest + jsdom already configured; only new test files.)*

---

## Project Constraints (from CLAUDE.md)

| Constraint | Source | Phase 10 Impact |
|------------|--------|-----------------|
| React 19 + Vite 6 + Tailwind v4 (locked) | CLAUDE.md "Tech stack" | No impact — Phase 10 doesn't touch the React tree |
| PWA via vite-plugin-pwa (locked) | CLAUDE.md "PWA" | Phase 10 modifies `vite.config.ts` VitePWA block (single new line); modifies `src/sw.ts` (3-line append) |
| No copyrighted audio | CLAUDE.md "Audio" | N/A — Phase 10 doesn't touch audio |
| Browser APIs degrade gracefully | CLAUDE.md "Browser APIs" | SW autoUpdate degrades naturally (browsers without SW support just don't get the update flow) |
| No persistence (settings ephemeral) | CLAUDE.md "No persistence" | N/A — Phase 10 doesn't touch settings |
| `vite-plugin-pwa` major upgrade 0.21.x → 1.x is OUT OF SCOPE | REQUIREMENTS.md Out-of-Scope table | DO NOT bump vite-plugin-pwa version |
| GSD workflow required for all edits | CLAUDE.md "GSD Workflow Enforcement" | This phase routes through `/gsd-plan-phase` 10 → `/gsd-execute-phase` 10 |
| SEG-05 v1 byte-identical floor (20 paths + Phase 7/8/9 deliverables) | CLAUDE.md / CONTEXT canonical_refs / v1.0-ROADMAP "Cross-Milestone Notes" | Phase 10 does NOT touch any SEG-05 path — files modified are `index.html`, `vite.config.ts`, `src/sw.ts`, `package.json`, plus new files in `public/`, `scripts/`, `docs/`. None overlaps with the protected floor. |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Helmet / react-helmet for SEO meta | Static HTML in index.html for crawler-visible meta; React for in-app dynamic meta only | Helmet still works for SPAs, but for crawler-visible SEO on a JS-heavy app, the SSR-or-static-HTML approach is standard | Phase 10 commits to static HTML per CONTEXT D-24 — correct choice for a PWA where the landing page is the same HTML as the app shell |
| `FAQPage` JSON-LD rich result | Removed for non-gov/health sites | Google 2023 | Phase 10 doesn't add FAQPage; Phase 11 also doesn't per LAND-04 |
| `aggregateRating` with synthetic data | Manual-action risk; only use with real review data | Google enforcement increased 2022-2023 | Phase 10 omits per D-13 / SEO-04 |
| Manual workbox SW setup | vite-plugin-pwa wraps Workbox config + auto-registers SW | vite-plugin-pwa stable since ~2020 | Already locked — Phase 10 only adds `registerType: 'autoUpdate'` flag |
| `<input type="number">` for stepper inputs | `type="text" + role="spinbutton"` for formatted display values | Pattern established in Phase 9 P04 | N/A to Phase 10 |

**Deprecated/outdated:**
- `<meta name="robots" content="index, follow">` — explicit tag is belt-and-suspenders; default crawler behavior is already "index, follow." Phase 10 does NOT add this — saves one tag.
- `og:image:width` + `og:image:height` properties — Facebook auto-detects from the image binary; explicit dimensions are optional. Not needed for v1 (CONTEXT meta block omits them).

---

## Assumptions Log

> Every claim tagged `[ASSUMED]` must be confirmed before becoming a locked decision.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `workbox-core` transitive dep will remain stable across vite-plugin-pwa 0.21.x patch releases | Standard Stack / Finding 2 | Low — if it disappeared the import would fail at build time, easy to detect; mitigation: add as direct devDep (Open Question 1) |
| A2 | vite-plugin-pwa 0.21.x with `injectManifest` strategy auto-injects `<link rel="manifest">` into the built `index.html` | Finding 8 / Open Question 3 | Medium — if missing post-build, manual addition needed; verification step in build script catches this |
| A3 | Google's Schema.org Validator (validator.schema.org) returns zero errors for the CONTEXT D-12 block | Finding 3 | Low — schema.org and W3C Wiki confirm UtilitiesApplication is enumerated; minimum required fields (`@context`, `@type`) present; description is text not a typed entity |
| A4 | Sharp + Georgia font renders consistently on Windows/macOS/Linux dev machines without font registration | Finding 5 | Low — proven by working `scripts/generate-icons.mjs` in the same repo |
| A5 | OG image PNG output at compressionLevel 9 for a 1200×630 flat-color SVG-derived image is well under 200 KB | Finding 5 | Low — typical output 10-30 KB for vector-derived content; if exceeded, `palette: true` adds 50%+ further compression |
| A6 | Manual deploy smoke test (close + relaunch PWA on phone) is sufficient evidence that SW update delivers v2 meta | Finding 10 | Low — this IS the structural test; no automation can do better without a real device farm |

**Verified, not assumed:**
- All locked CONTEXT decisions (D-01..D-28) — confirmed against official sources.
- `UtilitiesApplication` is a valid `applicationCategory` enum value.
- `registerType: 'autoUpdate'` is compatible with `strategies: 'injectManifest'` per official vite-plugin-pwa docs.
- `clientsClaim()` from `workbox-core` wraps `self.clients.claim()` in the correct activate-event listener.
- vite-plugin-pwa 0.21.1 is published a year ago; 1.3.0 is latest; CONTEXT correctly stays on 0.21.x.

---

## Sources

### Primary (HIGH confidence)

- **vite-plugin-pwa official docs (Context7)** — `/vite-pwa/vite-plugin-pwa` library — queried for "registerType autoUpdate injectManifest skipWaiting clientsClaim" — confirms the canonical sw.ts pattern verbatim
- **vite-pwa-org.netlify.app** — https://vite-pwa-org.netlify.app/guide/auto-update — `registerType: 'autoUpdate'` semantics
- **vite-pwa-org.netlify.app/guide/inject-manifest** — canonical sw.ts code block for injectManifest + autoUpdate
- **workbox-core developer.chrome.com docs** — https://developer.chrome.com/docs/workbox/modules/workbox-core/ — `clientsClaim()` wraps `self.clients.claim()` in activate listener
- **schema.org SoftwareApplication** — https://schema.org/SoftwareApplication — type structure, accepts Text/URL for applicationCategory
- **W3C Wiki WebSchemas/SoftwareApplicationSchema** — https://www.w3.org/wiki/WebSchemas/SoftwareApplicationSchema — enumerated applicationCategory values including UtilitiesApplication
- **Google Search Central — SoftwareApplication structured data** — https://developers.google.com/search/docs/appearance/structured-data/software-app — required fields for rich-result eligibility (not pursued)
- **Existing repo file: `scripts/generate-icons.mjs`** (lines 5-67) — proven sharp+SVG+system-fonts recipe
- **Existing repo file: `index.html`** (lines 1-17) — current head state
- **Existing repo file: `src/sw.ts`** (lines 1-41) — current SW shape; appends go after line 41
- **Existing repo file: `vite.config.ts`** (lines 11-33) — current VitePWA config block

### Secondary (MEDIUM confidence)

- **Search Engine Journal — "Why Google's Rich Results Tool Can Be Misleading"** — https://www.searchenginejournal.com/why-googles-rich-results-tool/539964/ — clarifies that SoftwareApplication is not rich-result eligible
- **Schema Plus help center** — Rich Results aggregateRating warnings — warnings ≠ errors
- **npm view 2026-05-10** — vite-plugin-pwa version 1.3.0 latest; 0.21.1 a year old; workbox-core 7.4.0 transitive
- **GitHub vite-plugin-pwa issue #438** — autoUpdate sometimes doesn't auto-reload (informational, not a blocker for Phase 10 which targets next-launch-after-close, not mid-session reload)

### Tertiary (LOW confidence — informational only)

- **General web search 2026-05** for PNG compression and OG image best practices
- **Facebook OG image specs** (developers.facebook.com/docs/sharing/webmasters/images) — 1200×630 recommendation
- **Twitter Card docs** (developer.x.com) — summary_large_image dimensions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every recommended dep is already installed or transitively present; versions verified against npm registry 2026-05-10
- Architecture: HIGH — Phase 10 is a static-asset phase; the architectural pattern is "edit files, commit, ship" with one tightly-scoped SW change
- Pitfalls: HIGH — five of the six pitfalls have direct evidence (official docs cite them or the SEG-05 / locked-decision context anticipates them); Pitfall 4 (JSON-LD `</script>` escape) is preventive belt-and-suspenders

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 (Phase 10 is a static-asset phase; the underlying specs — OG, Twitter Card, schema.org — change rarely; the one fast-moving piece is vite-plugin-pwa, where the 0.21.x → 1.x upgrade is locked OUT for this milestone)

---

## RESEARCH COMPLETE
