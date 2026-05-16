# Phase 10: SEO Meta + JSON-LD + Service Worker Update Infra - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship all static SEO metadata + JSON-LD + robots.txt + sitemap.xml + service-worker update infrastructure so the deployed app is discoverable, scrapeable by OG/Twitter/iMessage bots without JavaScript, and capable of pushing updated meta to installed PWA users on next launch (rather than serving stale precached HTML indefinitely).

This phase is **orthogonal** to Phases 6-9 (and could have shipped in parallel), but the SW update flags MUST land in the same phase as the meta work — otherwise installed users see stale meta indefinitely.

**In scope:**
- Modified `index.html` — add `<meta name="description">`, Open Graph tags, Twitter card, canonical link, JSON-LD WebApplication block (all static, none React-rendered)
- New `public/robots.txt` — Allow: / + Sitemap: line
- New `public/sitemap.xml` — landing URL + /app deep link (note: /app doesn't exist yet — Phase 11 lands it; Phase 10 sitemap should still reference it for forward-compat)
- New `public/og-image-v1.png` — 1200×630, ≤200 KB, generated via `sharp` (already a dep)
- New `scripts/generate-og-image.mjs` — one-shot script to regenerate the OG image; runs as a build-time helper, NOT in the main build pipeline
- Modified `vite.config.ts` — set `registerType: 'autoUpdate'` on the VitePWA plugin
- Modified `src/sw.ts` — append `self.skipWaiting()` + `self.clients.claim()` calls
- Tests where reasonable (sitemap.xml parse test; JSON-LD JSON-validity test; sw.ts unit if straightforward)

**Explicitly out of scope (Phase 11 territory + future):**
- Multi-page build configuration (Vite multi-page entries — Phase 11)
- Landing page HTML at `/` distinct from `app/index.html` — Phase 11
- Service worker scope rescoping to `/app` — Phase 11
- FAQ section, hero pitch, install CTA — Phase 11
- Custom domain configuration / DNS — out of project scope
- Search Console submission automation — manual deploy-runbook step
- og-image content design iteration past v1 — can swap the file later without code change
- Analytics, keyword research, content marketing — explicitly out of v2.0 per PROJECT.md

</domain>

<decisions>
## Implementation Decisions

### Title + meta description copy

- **D-01 (LOCKED):** `<title>` = `Soundly — a calmer alarm that alerts you gently`
- **D-02 (LOCKED):** `<meta name="description">` (≤155 chars, Google snippet floor) = `A free alarm app with soft sounds, vibration, or full volume — fully customizable. No accounts, no ads. Just share your setup. PWA — installs anywhere.`
- **D-03 (LOCKED):** `og:title` (shorter for share cards) = `Soundly — gentle alarm`
- **D-04 (LOCKED):** `og:description` (full ~195 char version, no Google truncation in OG context) = `A free alarm app with soft sounds or vibration or full volume - fully customizable. No accounts, no ads, just share your alarm setup. Progressive Web App (PWA), install on phone or desktop.`
- **D-05 (LOCKED):** Twitter card uses `twitter:card=summary_large_image`, `twitter:title` mirrors `og:title`, `twitter:description` mirrors `og:description`.
- **D-06:** All copy is **static HTML in `index.html`** — none injected by React. Verified by `view-source:` showing the meta tags as plain text, not by DevTools Elements which would show React-rendered content.

### OG image generation

- **D-07 (LOCKED):** `public/og-image-v1.png` (1200×630, ≤200 KB) generated programmatically via `sharp` (already in `devDependencies` from icon-asset generation). A new script `scripts/generate-og-image.mjs` produces it.
- **D-08 (LOCKED):** Image content (Claude's Discretion within zen aesthetic): warm-earth background (`--color-bg` = `#f4f1eb`), "Soundly" title in `--color-sage` (`#5c6b56`), tagline "a calmer alarm" beneath the title, a decorative ring or chime glyph from the existing visual vocabulary. Avoid jarring colors; avoid stock-photo people; use the warm-earth palette only.
- **D-09 (LOCKED — acceptance flow):** **User-approval checkpoint required before commit.** The execution must:
  1. Run the generator script → output `public/og-image-v1.png`
  2. PAUSE and display the image path + visual description (the file itself can't be shown inline in a terminal, but the user can open it in any image viewer to inspect)
  3. Wait for user `approve` or `regenerate` decision; if `regenerate`, accept user-supplied adjustments and re-run the script
  4. Only commit the image + the generator script after explicit approval
- **D-10:** Versioned filename per SEO-08: `og-image-v1.png` (NOT `og-image.png`). Future image revisions go to `og-image-v2.png` with a deploy step to force Facebook Sharing Debugger re-scrape.
- **D-11:** Generator script lives in `scripts/` directory (consistent with project convention if exists, else introduces it). Add a `package.json` script entry like `"og-image": "node scripts/generate-og-image.mjs"` so the user can re-run on demand.

### JSON-LD scope

- **D-12 (LOCKED):** **Minimal `WebApplication` schema only.** Single `<script type="application/ld+json">` block in `index.html` with:
  ```json
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Soundly Gentle Alarm",
    "description": "<og:description content verbatim>",
    "applicationCategory": "UtilitiesApplication",
    "operatingSystem": "Web Browser",
    "url": "<canonical URL>"
  }
  ```
- **D-13 (LOCKED):** `aggregateRating` is **omitted** per SEO-04 (Google manual-action risk on synthetic ratings).
- **D-14:** Validates cleanly against both Google Rich Results Test (https://search.google.com/test/rich-results) and Schema.org Validator (https://validator.schema.org/). Acceptance criterion at execution: paste the deployed URL into both validators after deploy; zero errors expected.
- **D-15:** Adding `Organization` or `WebSite` schemas is **deferred** to Phase 11 (when the landing page lands and these schemas become more meaningful).

### Service worker update strategy

- **D-16 (LOCKED):** `vite.config.ts` `VitePWA(...)` config block gains `registerType: 'autoUpdate'` regardless of the current `strategies: 'injectManifest'` setting. `registerType` controls the client-side registration helper's behavior (auto-trigger updates) and is independent of the build-time bundling strategy.
- **D-17 (LOCKED):** `src/sw.ts` gets `self.skipWaiting()` (top-level, after the imports and `cleanupOutdatedCaches()` call) AND `self.clients.claim()` (inside an `install` or `activate` event handler — the standard idiom is `self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))`). The current sw.ts already has `cleanupOutdatedCaches()` + `precacheAndRoute(self.__WB_MANIFEST)` + the navigation route handler + the notification-click handler; the new code APPENDS to these without replacing.
- **D-18 (LOCKED):** **No user-facing update UX in Phase 10 — silent update.** When `controllerchange` fires, the new SW takes over invisibly. No toast, no banner. Matches zen aesthetic and the no-persistence-of-friction philosophy. If a future phase introduces user-visible behavior change that warrants explicit "the app updated" feedback, that toast can be added then.
- **D-19:** `devOptions.enabled: true` in vite.config.ts is preserved — it lets the SW work in `npm run dev`. Verify that autoUpdate during dev doesn't trigger constant reloads in the developer's browser; if it does, document the workaround (set `devOptions.enabled: false` while iterating, or use Vite's `vite preview` for SW testing).

### robots.txt + sitemap.xml

- **D-20 (LOCKED):** `public/robots.txt` content (entirety):
  ```
  User-agent: *
  Allow: /
  Sitemap: <CANONICAL_BASE>/sitemap.xml
  ```
  where `<CANONICAL_BASE>` is the canonical deploy URL (see D-23 for default).
- **D-21 (LOCKED):** `public/sitemap.xml` is hand-authored (not generated). Contents list two URLs:
  - The landing URL (`<CANONICAL_BASE>/`)
  - The `/app` deep link (`<CANONICAL_BASE>/app/`) — even though `/app` doesn't exist until Phase 11. Including it now gives crawlers the eventual URL surface; if it 404s pre-Phase-11, that's acceptable (Search Console flags it as "not found" but doesn't penalize the site).
- **D-22:** Sitemap `<lastmod>` field: use a stable date (the Phase 10 ship date). Manually updated on subsequent meta changes. No vite-plugin-sitemap dep — hand-authored XML is 10 lines and avoids a transitive dependency.
- **D-23 (Claude's Discretion — placeholder):** Canonical base URL defaults to `https://soundly.local/Soundly` as a placeholder in the committed file. The user must edit `index.html` + `public/sitemap.xml` + `public/robots.txt` to the actual deploy URL before publishing. Acceptable for v2.0 — the user owns the deploy domain decision. Acceptance criterion at execution: surface this requirement explicitly in the SUMMARY.md so the user remembers to swap before deploy.

### Static-vs-dynamic boundary

- **D-24 (LOCKED — per SEO-01 + SEO-02 + SEO-04 + SEO-05):** All SEO meta (title, description, OG, Twitter, canonical, JSON-LD) lives in `index.html` as static HTML. None is injected by React, useEffect, or runtime code. Acceptance criterion at execution: `curl <deploy-url>` returns HTML containing all the meta tags; do NOT trust `Inspect Element` in DevTools (which shows React's hydrated DOM, not the static HTML).

### Multi-page split prep

- **D-25:** Phase 10 puts all SEO meta in the **current single `index.html`**. Phase 11 will refactor to split landing vs app meta when the two-HTML-entry build lands. The Phase 10 meta MAY end up replaced or moved in Phase 11 — that's fine; Phase 10's job is to ship the meta + the SW infra so the deployed v2.0 build has SEO baseline coverage immediately.
- **D-26:** Apple PWA meta currently in `index.html` (apple-touch-icon, apple-mobile-web-app-capable, etc.) is **preserved unchanged** — Phase 10 only adds new tags, doesn't modify the existing ones.

### Build verification + deploy runbook

- **D-27 (LOCKED):** `npm run build` must succeed; the production bundle must contain the meta tags as static HTML (verified via `grep "og:title" dist/index.html` returning 1+ match).
- **D-28:** Deploy runbook (a new short doc at `docs/deploy-runbook.md` OR appended to a top-level `DEPLOY.md` — Claude's Discretion on filename) MUST document:
  1. Swap the placeholder canonical URL to the actual deploy URL in `index.html`, `robots.txt`, `sitemap.xml`
  2. Generate / accept the og-image-v1.png and ensure it's committed
  3. Build + deploy
  4. Submit `sitemap.xml` to Search Console manually (GitHub Pages doesn't auto-discover)
  5. Force-refresh the Facebook Sharing Debugger after content changes (so OG previews update for users who shared earlier)

### Claude's Discretion (further)

- OG image specific composition (typography sizing, ring/glyph placement, color contrast pass) — generator can iterate based on user feedback during the D-09 acceptance checkpoint
- Whether the JSON-LD's `description` field uses the short Google-snippet meta description or the longer og:description — recommend the longer one (no character cap in JSON-LD, surfaces more keywords to Google)
- Exact sitemap.xml whitespace + indentation
- Whether to add `<link rel="manifest" href="/manifest.webmanifest">` explicit reference in index.html — vite-plugin-pwa typically injects this; verify it's present in the built output and don't duplicate

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project / milestone
- `.planning/PROJECT.md` — v2.0 milestone scope; warm-earth aesthetic; no-persistence design
- `.planning/REQUIREMENTS.md` — SEO-01..09 (9 Phase 10 requirements)
- `.planning/ROADMAP.md` §"Phase 10" — goal + 5 success criteria; locked decision that Phases 6–9 ship in parallel
- `CLAUDE.md` — Tailwind v4 + Vite 6 + React 19; deploy at GitHub Pages `username.github.io/Soundly/`

### Existing files (read before modifying)
- `index.html` — current minimal markup with title + apple-touch icons; Phase 10 ADDS meta tags, does NOT remove existing tags
- `src/sw.ts` — current SW with cleanupOutdatedCaches + precacheAndRoute + NavigationRoute + notificationclick handler; Phase 10 APPENDS skipWaiting + clients.claim activate listener
- `vite.config.ts` — current VitePWA config with `strategies: 'injectManifest'`; Phase 10 ADDS `registerType: 'autoUpdate'`
- `package.json` — verify `sharp` is in devDependencies (it is, used for icon generation); Phase 10 adds an `og-image` script entry

### External validators (deploy-time acceptance gates)
- Google Rich Results Test — https://search.google.com/test/rich-results — Phase 10 acceptance requires the deployed JSON-LD to pass with zero errors
- Schema.org Validator — https://validator.schema.org/ — Phase 10 acceptance requires zero errors
- Facebook Sharing Debugger — https://developers.facebook.com/tools/debug/ — Phase 10 deploy runbook documents force-refresh

### Files protected by SEG-05 v1 byte-identical floor (NEVER modified)
- All 20 paths listed in `.planning/milestones/v1.0-ROADMAP.md` § "Cross-Milestone Notes"
- Plus Phase 7/8/9 deliverables: SegmentEngine.ts, SegmentState.ts, triangle.ts, segmentSound.ts, SegmentCountdown.tsx, SegmentProgressRing.tsx, useSegmentAlarm.ts, useActiveAlarm.ts, Composer.tsx, SegmentRow.tsx, StepperInput.tsx, SoundPicker.tsx, Toast.tsx, CustomCard.tsx, shareUrl.ts, composerReducer.ts, composerValidation.ts, useHashComposition.ts

### Files created by this phase
- `public/robots.txt`
- `public/sitemap.xml`
- `public/og-image-v1.png` (generated; user-accepted)
- `scripts/generate-og-image.mjs`
- `docs/deploy-runbook.md` (or appended to existing if a deploy doc exists)

### Files modified by this phase
- `index.html` — add meta description, OG, Twitter, canonical, JSON-LD
- `vite.config.ts` — add `registerType: 'autoUpdate'`
- `src/sw.ts` — append skipWaiting + clients.claim activate listener
- `package.json` — add `"og-image"` script entry

</canonical_refs>

<specifics>
## Specific Ideas

### Meta tag block to append to `index.html` `<head>` (verbatim)

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

### Title tag update

Change `<title>Soundly</title>` to:
```html
<title>Soundly — a calmer alarm that alerts you gently</title>
```

### `public/robots.txt` content (verbatim)

```
User-agent: *
Allow: /
Sitemap: https://soundly.local/Soundly/sitemap.xml
```

### `public/sitemap.xml` content (verbatim)

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

### Service worker append (`src/sw.ts`)

```ts
// Take control of the page immediately on activation (Phase 10 / SEO-09).
// Combined with registerType: 'autoUpdate' in vite.config.ts, installed PWA
// users receive updated meta + content on next launch without manual reload.
self.skipWaiting();
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
```

Append AFTER the existing `notificationclick` handler in `src/sw.ts`. Do not modify any existing handler.

### `vite.config.ts` change

```ts
VitePWA({
  registerType: 'autoUpdate',  // <-- ADD this line (SEO-09)
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  // ... rest unchanged
})
```

### OG image generator sketch (`scripts/generate-og-image.mjs`)

```js
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, '..', 'public', 'og-image-v1.png');

const WARM_EARTH_BG = '#f4f1eb';
const SAGE = '#5c6b56';
const TEXT_PRIMARY = '#3d4a38';

// Composite SVG content rendered to a 1200×630 PNG.
const svg = `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="${WARM_EARTH_BG}" />
  <!-- decorative ring or chime glyph -->
  <circle cx="240" cy="315" r="80" fill="none" stroke="${SAGE}" stroke-width="14" />
  <text x="380" y="280" font-family="system-ui, -apple-system, sans-serif" font-size="100" font-weight="300" fill="${SAGE}">Soundly</text>
  <text x="380" y="360" font-family="system-ui, -apple-system, sans-serif" font-size="42" font-weight="400" fill="${TEXT_PRIMARY}">a calmer alarm</text>
</svg>
`;

await sharp(Buffer.from(svg))
  .png({ quality: 85, compressionLevel: 9 })
  .toFile(outputPath);

console.log(`Wrote ${outputPath}`);
```

The planner can iterate on the exact composition; the user-acceptance checkpoint (D-09) is where final visual approval happens.

### Acceptance checkpoint flow (D-09 — user-approval required before commit)

The execution-phase plan that owns the OG image MUST include an explicit pause:
1. Task: Run `node scripts/generate-og-image.mjs` → writes `public/og-image-v1.png`
2. **Checkpoint:** Pause execution. Surface to the user: "OG image generated at `public/og-image-v1.png` — please open it in any image viewer to inspect. Reply `approve` to commit, or describe changes (e.g. 'make the ring bigger', 'try blue background') to regenerate."
3. If user says approve → commit + continue
4. If user describes changes → regenerate script per feedback → re-display path → re-pause → loop until approve

</specifics>

<code_context>
## Existing Code Insights

### Reusable assets (consumed unchanged)
- `sharp` (already in `devDependencies`, used for icon-asset generation) — Phase 10 reuses for OG image
- `src/index.css` warm earth palette CSS variables — generator script references the hex values
- `index.html` apple-touch-icon + apple-mobile-web-app-* meta tags — preserved unchanged

### Established patterns
- Tailwind v4 warm earth palette via CSS variables (`--color-bg`, `--color-sage`, `--color-text-primary`, etc.) — used as the source of truth for the OG image hex values
- vite-plugin-pwa with `injectManifest` strategy — Phase 10 keeps this and ADDS `registerType: 'autoUpdate'` (compatible)
- workbox-precaching + workbox-routing in `src/sw.ts` — Phase 10 appends to the file, doesn't replace

### Integration points (where the diff lands)
- `index.html:1-17` — `<head>` gains ~15 new tags (meta description, OG, Twitter, canonical, JSON-LD); `<title>` rewritten
- `vite.config.ts:11` — single-line addition: `registerType: 'autoUpdate',`
- `src/sw.ts:42+` — append skipWaiting + activate listener AFTER the existing notificationclick handler
- `package.json` `scripts` section — add `"og-image": "node scripts/generate-og-image.mjs"`
- `public/` directory — add robots.txt, sitemap.xml, og-image-v1.png

### Pre-existing v1 quirks NOT addressed in Phase 10
- The current `base: '/Soundly/'` in vite.config.ts means deployed URLs are at `<host>/Soundly/...` — canonical URLs in meta + sitemap must respect this base. The placeholder canonical (D-23) uses `https://soundly.local/Soundly/` to make this explicit.

</code_context>

<deferred>
## Deferred Ideas

- **Multi-page split** (separate landing index.html at `/` from app/index.html) — Phase 11
- **Hand-authored landing page content** (hero, value prop, FAQ, install CTA) — Phase 11
- **iOS honesty section** explaining locked-screen alarm limitations — Phase 11
- **SW scope rescoping to `/app`** — Phase 11
- **vite-plugin-sitemap** dependency — chose hand-authored sitemap.xml to avoid transitive dep; revisit if Phase 11 needs dynamic sitemap generation
- **Organization / WebSite JSON-LD schemas** — Phase 11 when landing page lands and brand authority becomes more relevant
- **FAQPage JSON-LD** — explicitly NOT pursued per ROADMAP locked decision (Google deprecated rich-result eligibility for non-gov/health sites in 2023)
- **Analytics / telemetry** — explicitly out of v2.0 per PROJECT.md "Out of Scope"
- **Custom domain + DNS configuration** — out of project scope; user decision
- **OG image content design iteration past v1** — the file can be swapped without code change; document in deploy runbook
- **"App updated" toast UX** — D-18 LOCKED silent for v2.0; revisit if a future phase introduces user-visible behavior change that warrants explicit feedback
- **Search Console submission automation** — manual step in deploy runbook for v2.0
- **`aggregateRating` in JSON-LD** — explicitly NOT included per SEO-04 / D-13 (Google manual-action risk on synthetic ratings)
- **WCAG audit of the OG image** — not a meta requirement; can be deferred to a polish phase

</deferred>

---

*Phase: 10-seo-meta-json-ld-service-worker-update-infra*
*Context gathered: 2026-05-16*
