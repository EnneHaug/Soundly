# Soundly Deploy Runbook

Operator playbook for shipping Soundly to production (GitHub Pages or
equivalent static-host). Covers Phase 10 SEO + SW update artifacts.

> **Read first:** This runbook assumes Phase 10 has shipped — `index.html`,
> `public/robots.txt`, `public/sitemap.xml`, `public/og-image-v1.png`,
> `vite.config.ts`, and `src/sw.ts` are all in the v2.0 state described
> in `.planning/phases/10-seo-meta-json-ld-service-worker-update-infra/`.

---

## 1. Pre-deploy: swap placeholder canonical URL

All committed SEO files use the literal placeholder string
`https://soundly.local/Soundly/`. Before deploying, replace it with your
actual deploy URL across three files.

**Four files, thirteen occurrences (post-Phase-11 split):**

| File | Occurrences | What gets replaced |
|------|-------------|--------------------|
| `index.html` (landing, Phase 11) | 5 (canonical + og:url + og:image + twitter:image + JSON-LD url — all `/Soundly/`) | All `https://soundly.local/Soundly/...` substrings |
| `app/index.html` (app shell, Phase 11) | 5 (canonical + og:url + JSON-LD url use `/Soundly/app/`; og:image + twitter:image still reference `/Soundly/og-image-v1.png`) | All `https://soundly.local/Soundly/...` and `https://soundly.local/Soundly/app/...` substrings |
| `public/robots.txt` | 1 (Sitemap: line) | The full sitemap URL |
| `public/sitemap.xml` | 2 (both `<loc>` elements) | Both URLs |

**Single-command swap (POSIX shell):**

```bash
# 1. Set your actual deploy URL (MUST end with trailing slash + match the Vite `base` from vite.config.ts)
NEW_URL="https://username.github.io/Soundly/"

# 2. Find/replace across the four files (creates .bak files; cleaned up below)
sed -i.bak "s|https://soundly.local/Soundly/|${NEW_URL}|g" \
  index.html app/index.html public/robots.txt public/sitemap.xml

# 3. Clean up sed backup files
rm -f index.html.bak app/index.html.bak public/robots.txt.bak public/sitemap.xml.bak

# 4. Sanity check — should print NO matches
grep -r "soundly.local" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.planning
```

**PowerShell equivalent (Windows):**

```powershell
$NEW_URL = "https://username.github.io/Soundly/"
foreach ($file in @("index.html", "app/index.html", "public/robots.txt", "public/sitemap.xml")) {
  (Get-Content $file -Raw) -replace 'https://soundly\.local/Soundly/', $NEW_URL | Set-Content $file -NoNewline
}
# Sanity check — should return nothing
Select-String -Path "index.html","app/index.html","public/robots.txt","public/sitemap.xml" -Pattern "soundly.local"
```

**DO NOT commit the swapped state to main.** Make the swap on the deploy
branch / in CI / in a release commit only. The `soundly.local` placeholder
in main remains the source of truth so future contributors see the
deliberate placeholder pattern.

---

## 2. Pre-deploy: generate / accept OG image

Only when content changes; otherwise skip to step 3.

```bash
npm run og-image    # writes public/og-image-v1.png (1200x630, <= 200 KB)
```

Open `public/og-image-v1.png` in any image viewer:
- Windows: double-click in File Explorer (default Photos app)
- macOS: Preview.app
- VS Code: open the file directly (inline preview)

**Acceptance criteria:**
- Layout balanced (ring + wordmark + tagline)
- Typography readable at chat-preview size
- On-brand warm-earth palette only — no jarring colors

If unacceptable: edit `scripts/generate-og-image.mjs` (palette constants
+ SVG composition near the top), re-run `npm run og-image`, re-inspect.

Iterate until satisfied, then `git add public/og-image-v1.png` and proceed.

**When changing IMAGE CONTENT (not just regenerating same composition):**
bump the filename to `og-image-v2.png` (and update references in
`index.html`). Reason: Facebook caches OG image URLs aggressively
(~30 days). Same URL = same cache entry = stale preview for everyone
who shared the URL pre-update. New filename forces fresh scrapes.
See SEO-08 / D-10 / Pitfall 3.

---

## 3. Build

```bash
npm run build
```

Verify after build (sanity gates — Plan 06 automates these):

```bash
# Static meta in dist/index.html
grep -F 'og:title' dist/index.html              # expect 1+ match
grep -F 'og:description' dist/index.html        # expect 1+ match
grep -F 'twitter:card' dist/index.html          # expect 1+ match
grep -F 'rel="canonical"' dist/index.html       # expect 1+ match
grep -F 'application/ld+json' dist/index.html   # expect 1+ match
grep -F '"WebApplication"' dist/index.html      # expect 1+ match

# Static asset files present
test -f dist/og-image-v1.png && echo "og-image OK"
test -f dist/robots.txt && echo "robots OK"
test -f dist/sitemap.xml && echo "sitemap OK"

# OG image size <= 200 KB (POSIX)
test $(stat -c%s dist/og-image-v1.png 2>/dev/null || stat -f%z dist/og-image-v1.png) -le 204800 && echo "OG size OK"
```

**PowerShell OG size check:**

```powershell
$size = (Get-Item dist/og-image-v1.png).Length
if ($size -le 204800) { Write-Output "OG size OK ($size bytes)" } else { Write-Error "OG image exceeds 200 KB: $size bytes" }
```

### 3.1 Phase 11 — verify multi-page build emits both entries

```bash
# POSIX:
test -f dist/index.html && test -f dist/app/index.html && echo "Phase 11 dual-entry build OK"
```

```powershell
# PowerShell:
if ((Test-Path dist/index.html) -and (Test-Path dist/app/index.html)) {
  Write-Output "Phase 11 dual-entry build OK"
} else {
  Write-Error "Multi-page build did NOT emit both entries — verify vite.config.ts build.rollupOptions.input"
}
```

If either is missing, re-check `vite.config.ts`:
- `build.rollupOptions.input.main` must resolve `index.html`
- `build.rollupOptions.input.app` must resolve `app/index.html`
- Both source files must exist at the repo root (NOT under `src/`)

Then run `node scripts/verify-phase-10-build.mjs` — exits 0 means Phase 11 build
artifacts are correct (`dist/app/index.html` SEO meta + JSON-LD + manifest link +
`dist/sw.js` allowlist for the SW rescope all verified together — Pitfall A gate).

---

## 4. Deploy

Deploy mechanism is implementation-defined (GitHub Pages workflow, manual
upload, etc.). Phase 10 does NOT lock the deploy step — only the artifacts.

For GitHub Pages with Actions: push the contents of `dist/` to the
`gh-pages` branch (or use `peaceiris/actions-gh-pages`). Verify the
deployment by visiting `https://<NEW_URL>` (the URL set in step 1).

---

## 5. Post-deploy: verify static SEO meta

1. **`view-source:` (NOT DevTools Elements)** in your browser:
   - Navigate to `view-source:https://<your-deploy-url>/`
   - Confirm: title, description, all OG tags, Twitter tags, canonical
     link, and JSON-LD block appear as PLAIN TEXT in the page source
   - **DevTools Elements is NOT a valid check.** It shows the
     post-React-hydration DOM, which includes everything you might
     add later via JS. Scrapers run zero JS — `view-source:` is what
     they see. (Pitfall 1.)

2. **Schema.org Validator** — https://validator.schema.org/
   - Paste your deployed URL → expect **zero errors**
   - The WebApplication block should be detected as a valid
     SoftwareApplication subtype

3. **Google Rich Results Test** — https://search.google.com/test/rich-results
   - Paste your deployed URL → expect "Page is not eligible for rich results"
   - **This is NOT an error.** WebApplication / SoftwareApplication is
     NOT in Google's rich-result-eligible types list (rich-result-eligible
     types are limited: Product, Recipe, Article, etc.). The schema is
     valid; it just won't render with stars/ratings in search snippets.
     (Pitfall 6.)

---

## 6. Post-deploy: Search Console manual sitemap submission

GitHub Pages does NOT auto-discover sitemaps at subpath sites. Manual
submission via Google Search Console is the **primary discoverability
path** for the Soundly deploy (per v2.0 ROADMAP "Hosting" decision).

1. Sign in to https://search.google.com/search-console
2. Add your deploy URL as a property (URL-prefix property:
   `https://<your-deploy-url>/`)
3. Verify ownership (Search Console offers several methods — DNS TXT
   record, HTML file upload, or `<meta name="google-site-verification">`
   in `index.html`. The meta-tag method works without DNS access — paste
   Google's verification meta tag into `index.html` after the existing
   SEO meta block.)
4. Navigate to "Sitemaps" in the left nav
5. Enter `sitemap.xml` (the path relative to your property root) → Submit
6. Wait — initial indexing can take days/weeks

Note: the `/app/` URL in the sitemap will return 404 until Phase 11
ships. Search Console will flag it as "discovered but not indexed" —
this is the expected forward-compat tradeoff (D-21).

---

## 7. Post-deploy: force-refresh Facebook Sharing Debugger

Required when:
- You've deployed `index.html` with new OG copy (title/description)
- You've swapped the OG image content at the same URL (`og-image-v1.png`)
- You've bumped to a new versioned OG image (`og-image-v2.png`) and want
  existing shared links to render the new image

1. Visit https://developers.facebook.com/tools/debug/
2. Paste your deployed URL → Click "Debug"
3. Click "Scrape Again" to force fresh re-fetch
4. Verify the OG title, description, and image preview render correctly
5. The preview chip shown is what Facebook + Instagram + Messenger
   + Slack (via OG-spec consumption) + iMessage (via Twitter-card
   fallback) will display

See SEO-08 / D-10 for the versioned-filename rationale.

---

## 8. Post-deploy: SW update smoke test (when meta or SW changes)

The full end-to-end verification of SEO-09 (service worker auto-update)
is structurally NOT automatable — it requires a real browser, a real
install, and a real cross-deploy lifecycle (RESEARCH Finding 10).

Manual smoke test:

1. On a phone with the v1 PWA installed (e.g., a device where you
   installed Soundly before deploying v2):
   - Close the app fully (swipe away from app switcher)
   - Reopen the app
   - Expected: the v2 meta is now active (the new SW takes over via
     `skipWaiting()` + `clientsClaim()` from `src/sw.ts`)
2. Most direct verification:
   - Temporarily change `<title>` in `index.html` to a clearly-recognizable
     string like `Soundly v2 test`
   - Re-run swap → build → deploy
   - On the phone, close + reopen the PWA — confirm the new title shows
     in the app-switcher chrome (or in mobile Safari/Chrome tab title)
   - Revert the `<title>` change → swap → build → deploy

If the smoke test FAILS (installed PWA still shows old meta):
- Verify both `registerType: 'autoUpdate'` (vite.config.ts) AND
  `self.skipWaiting()` + `clientsClaim()` (src/sw.ts) are present —
  Pitfall 2 (both must land together; neither alone delivers updates)
- Verify the new build was actually deployed (check `dist/sw.ts.map`
  or the SW file in the deployed `/Soundly/sw.js` URL)
- On the phone, force-close the app fully (not just background it) —
  iOS especially keeps inactive SW workers alive longer than expected

---

## 9. Maintenance notes

### Bumping the sitemap `<lastmod>` date

When meta or content changes meaningfully, manually update both `<lastmod>`
elements in `public/sitemap.xml` to today's date (YYYY-MM-DD). No
automation; intentional manual gate per D-22.

### Editing JSON-LD `description` content

Never include the literal substring `</script>` inside the JSON-LD
`description` field. The HTML parser tokenizes `</script>` as the end
of the script element, regardless of JSON context — your JSON-LD block
will terminate prematurely and the rest of the JSON becomes malformed
markup. If you must include script-tag references, escape as
`<\/script>`. (Pitfall 4.)

### Upgrading vite-plugin-pwa

The project pins `vite-plugin-pwa@^0.21.1`. Do NOT bump to 1.x — breaking
config-schema changes risk regressing the validated v1.0 SW. If an
upgrade is needed, treat it as its own phase with a full validation
matrix. (Pitfall 5 + REQUIREMENTS.md Out-of-Scope table.)

### Adding new OG image versions

Always bump the filename (`og-image-v1.png` → `og-image-v2.png` →
`og-image-v3.png`). Update both `index.html` references (og:image,
twitter:image) to the new filename. The old file MAY remain in `public/`
for back-compat with pre-bump shared links, or MAY be removed after a
transition period.

---

## 10. Phase 11 — Verify SW rescoping on installed device (D-LAND-16)

**When to run:** After deploying the first Phase 11 build to production, on a
phone that has the v1.0 or v2.0 (pre-Phase-11) PWA already installed.

**Coupling reminder (Pitfall A — high risk):** Phase 11 manifest changes (`id`,
`scope`, `start_url` from Plan 11-01) and SW rescoping (`NavigationRoute`
allowlist from Plan 11-04) MUST ship in the same deploy. The
`scripts/verify-phase-10-build.mjs` enforces this at build time by asserting
BOTH `dist/app/index.html` exists (manifest changes work) AND `dist/sw.js`
contains `allowlist` (SW rescope shipped). If either is missing, the
verifier fails and the deploy is blocked. Manual verification on a real
device is the final gate.

**Manual smoke test:**

1. On a phone with the pre-Phase-11 PWA installed (v1.0 or v2.0 pre-deploy):
   - Open the installed PWA from the home-screen icon
   - First launch may still show the OLD SW serving OLD `/Soundly/index.html`
     (D-LAND-15 — accepted one-time transition)
   - Force-close + reopen the PWA (swipe away from app switcher, then re-launch)
2. **Expected second launch:** the PWA should open `/Soundly/app/` directly per
   the new `start_url`. The home-screen icon's destination has updated.
3. **Verify offline:** enable airplane mode + relaunch the PWA — alarm app
   continues to load (the SW precaches `app/**` per Plan 11-01 globPatterns).
4. **Verify landing serves from network:** in a regular browser (NOT the
   installed PWA), visit `https://<your-deploy-url>/` — landing renders;
   DevTools → Network → confirm the response is NOT served by the SW
   (Status column should say "200" without the SW indicator).
5. **Verify installed users see no install CTA:** in the installed PWA,
   navigate to the landing URL — the install button + iOS panel + Open Soundly
   link should NOT appear (D-LAND-08 — `display-mode: standalone` strips the
   entire `#install-cta` container).

**If the installed PWA loses its install identity** (re-prompts to install,
icon goes stale): the cause is most likely a missing `manifest.id`. Confirm
`vite.config.ts` contains `id: '/Soundly/'` per Plan 11-01 / D-LAND-17 /
RESEARCH Finding 4. The `id` field is a one-way ratchet — never change it
in subsequent deploys.

**If the SW rescoping doesn't propagate** (installed users keep landing on the
old React shell at `/Soundly/`): force-close the app fully (iOS especially
keeps inactive SW workers alive longer than expected), confirm
`registerType: 'autoUpdate'` (vite.config.ts) AND `self.skipWaiting()` +
`clientsClaim()` (src/sw.ts) all present — this is the Phase 10 SEO-09
update infrastructure that Phase 11's rescoping depends on.

See: Plan 11-01 + Plan 11-04 for the manifest + SW source changes that
this section verifies.

---

*Phase 10 + Phase 11 deploy runbook. Updated: see `git log -1 -- docs/deploy-runbook.md`.*
