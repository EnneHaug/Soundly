# Phase 11: Multi-page Split + Landing Page — Research

**Researched:** 2026-05-21
**Domain:** Vite 6 multi-page build, vite-plugin-pwa scope rescoping, Workbox NavigationRoute allowlist, `beforeinstallprompt` + `appinstalled` event flow, iOS Safari detection, Lighthouse PWA + SEO scoring
**Confidence:** MEDIUM-HIGH (Vite multi-page + NavigationRoute allowlist are HIGH-confidence canonical idioms verified against official docs; SW migration on scope-narrow is MEDIUM-confidence because no official source enumerates the exact installed-user lifecycle when only `manifest.scope` and `start_url` change while the SW filename stays the same — this is the largest residual risk and is flagged in Open Questions Q1)

---

## TL;DR — 8 highest-leverage findings for the planner

1. **Vite 6 multi-page is a 6-line `rollupOptions.input` change with two HTML files at repo root.** The `app/` folder lives at `<repo-root>/app/index.html`, NOT under `src/`. Vite's dev server natively serves nested paths like `/app/`. The `base: '/Soundly/'` setting prefixes asset URLs for BOTH entries automatically. (Finding 1, VERIFIED via Context7 + Vite 6 docs.)

2. **Use `rollupOptions.input`, NOT `rolldownOptions.input`.** Context7 currently returns the Vite 7+ docs which already migrated to `rolldownOptions`. Vite 6.0.5 (this project's pin) requires `rollupOptions.input` — the legacy name. The CONTEXT sketch is correct. (VERIFIED via v6.vite.dev official docs + npm view vite-plugin-pwa.)

3. **`NavigationRoute` already supports `{ allowlist: [RegExp] }` — this is the official `injectManifest` rescoping idiom.** The vite-plugin-pwa docs show the exact pattern verbatim. Narrowing to `/Soundly/app/*` is a single `allowlist: [/^\/Soundly\/app\//]` option added to the existing `NavigationRoute` constructor. The CONTEXT sketch is correct. (Finding 2, VERIFIED via Context7 vite-plugin-pwa/development.md.)

4. **`manifest.id` MUST be added to preserve install identity across the `start_url` change** — without it, browsers may treat the new manifest as a *different* PWA. The `start_url: '/Soundly/app/'` change to an installed PWA without an `id` field risks the browser losing the "already installed" association. Add `id: '/Soundly/'` (or `id: '/Soundly/app/'` — pick one, document the choice, never change it again). (Finding 4, VERIFIED via MDN Manifest/id.) **THIS IS A NEW REQUIREMENT not in the CONTEXT decisions** — flag for planner.

5. **`beforeinstallprompt` MUST be deferred via `event.preventDefault()` BEFORE storing the event reference.** The deferred prompt fires once per page session, and only on Chromium browsers (Chrome, Edge, Android). iOS Safari NEVER fires this event — manual `<details>`/`<summary>` instructions are the only path. CONTEXT D-LAND-05 (button only after event fires) matches the canonical pattern. (Finding 5, VERIFIED via MDN BeforeInstallPromptEvent + web.dev/learn/pwa.)

6. **iOS Safari detection requires `navigator.maxTouchPoints` due to iPadOS UA spoofing.** Since iOS 13, iPadOS reports `navigator.userAgent` as `MacIntel` — pure UA sniffing misses iPad users. The reliable test is `(/iphone|ipod/i.test(ua)) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)`. The existing `src/platform/standalone.ts` uses ONLY UA sniffing (`iphone|ipad|ipod`) — this works because Apple's UA includes `ipad` on older iOS; but post-iPadOS-13 the `ipad` substring is absent. **The landing page detection must use the maxTouchPoints check; copying standalone.ts verbatim is a bug carried forward.** (Finding 6, VERIFIED via 2025 nielsleenheer article + Apple Developer Forums.)

7. **`appinstalled` fires ONLY on Chromium browsers — never iOS Safari.** So D-LAND-07's "auto-navigate to /app/ on appinstalled" works on Android/desktop but is silently skipped on iOS. This is fine and matches D-LAND-06 (iOS gets manual instructions; tapping the new home-screen icon is the navigation path on iOS). Document this asymmetry in the plan. (Finding 7, VERIFIED via web.dev/learn/pwa/detection + MDN.)

8. **Phase 10 test infrastructure NEEDS updating** — `tests/static-assets.test.ts` reads `index.html` directly (which becomes the LANDING file) and asserts SEO meta + `D-26` Apple meta + `D-23` placeholder consistency. After the split, the app shell at `app/index.html` will ALSO need its own SEO meta block (per CONTEXT line 109), and `D-26` Apple meta tags must move to the app shell (PWA install operates on `app/index.html` post-rescope). The verifier script `scripts/verify-phase-10-build.mjs` reads `dist/index.html` — after split, `dist/index.html` is the landing AND `dist/app/index.html` is the app shell; **both need verification**. (Finding 9 — detailed compatibility matrix below.)

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Landing copy + tone:**
- **D-LAND-01 (LOCKED):** Hero line = `A calmer alarm that alerts you gently` (verbatim, mirrors Phase 10 OG image + `<title>`)
- **D-LAND-02 (LOCKED):** Value framing = Calm-first, then "and reliable when it matters"
- **D-LAND-03 (LOCKED):** FAQ scope = 6–8 plain-HTML Q&A, no `FAQPage` JSON-LD. Candidate list of 8 questions provided
- **D-LAND-04 (LOCKED):** iOS honesty section = combined warm/apologetic + workaround-forward, two-paragraph structure

**Install CTA UX:**
- **D-LAND-05 (LOCKED):** Android install button visibility = `beforeinstallprompt`-driven only; no greyed/disabled state
- **D-LAND-06 (LOCKED):** iOS Safari instructions = click-to-expand inline `<details>` panel with 3 Share-menu steps
- **D-LAND-07 (LOCKED):** Post-install behavior = inline confirmation ("Installed ✓ — launching app…") for 1–1.5s, then `window.location` redirect to `/Soundly/app/`
- **D-LAND-08 (LOCKED):** Already-installed view = strip entire install CTA section (`display-mode: standalone` detection)

**Visual layout + screenshots:**
- **D-LAND-09 (LOCKED):** Compact one-page layout; 1.5–2× viewport desktop, 3–4× mobile
- **D-LAND-10 (LOCKED):** Hero visual = reuse `public/og-image-v1.png` (zero new assets)
- **D-LAND-11 (LOCKED):** Section order = Hero → value paragraph → screenshot → FAQ → iOS honesty → footer
- **D-LAND-12 (LOCKED):** Footer = minimal single-line: GitHub link + "Made by [name from git config]" + ©2026
- **D-LAND-13 (LOCKED):** Screenshot = Composer view with Wake Easy preset open, stored at `public/screenshot-composer-v1.png`

**SW migration safety:**
- **D-LAND-14:** Inherit Phase 10 D-18 silent-update; `registerType: 'autoUpdate'` + `skipWaiting()` + `clientsClaim()` already in place
- **D-LAND-15:** Stale `/Soundly/` content during SW swap is acceptable (landing served from network)
- **D-LAND-16:** Deploy runbook gets Phase 11 addendum: test SW rescoping on installed phone

### Claude's Discretion

- Specific FAQ question wording (planner drafts from D-LAND-03 candidate list)
- Footer attribution name (from `git config user.name` — currently "J. B. E. Haug")
- Screenshot capture method (manual via DevTools at fixed viewport — Playwright NOT installed per package.json check; manual capture is the only viable path)
- Dark mode on landing (follow `prefers-color-scheme`)
- Subtle CSS transitions (hover states, button feedback — no JS animations)
- Hero OG image responsive scaling
- Firefox / Edge / desktop fallback messaging
- Inline panel CSS (`<details>`/`<summary>` is cleanest — no JS needed)
- Schema.org `Organization` / `WebSite` JSON-LD additions (defer unless low-effort)

### Deferred Ideas (OUT OF SCOPE)

- Additional static pages (`/privacy`, `/about`, `/changelog`) — v2.1+
- Newsletter / waitlist / email signup — locked OUT per PROJECT.md
- Analytics / telemetry — locked OUT per PROJECT.md
- Localization / i18n — out for v2.0
- Native iOS app — PWA-only locked per PROJECT.md
- Custom domain configuration — user decision
- Tour / onboarding flow on first app load
- Animated hero / sticky nav / A/B testing — zen aesthetic prohibits

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LAND-01 | Marketing landing at `/` — hero + value + screenshot + install CTA + FAQ + footer; hand-authored static HTML, no React | Finding 8 (HTML structure); Finding 10 (Lighthouse SEO landing checklist) |
| LAND-02 | Two-tier routing — landing at `/`, app shell at `/app`; PWA `start_url` from `/` → `/app` | Finding 1 (Vite multi-page); Finding 3 (manifest start_url + scope); Finding 4 (manifest `id` requirement) |
| LAND-03 | Install CTA — `beforeinstallprompt` button on Android; iOS Safari manual `<details>` instructions | Finding 5 (beforeinstallprompt); Finding 6 (iOS detection); Finding 7 (appinstalled) |
| LAND-04 | FAQ — plain HTML `<h3>` + `<p>`, no `FAQPage` JSON-LD | Finding 8 (HTML structure — `<details>` accessibility verified) |
| LAND-05 | iOS honesty section — locked-screen audio limit + workaround | Finding 8 (copy structure); existing iOS limitation already documented in PROJECT.md |
| LAND-06 | Vite multi-page build; SW `NavigationRoute` rescoped to `/app/` only | Finding 1 (Vite multi-page); Finding 2 (NavigationRoute allowlist); Finding 3 (manifest scope) |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Static marketing landing HTML | Build-time HTML (`index.html`) | — | Crawlers + OG scrapers must see content WITHOUT executing JS. Vite copies through to `dist/index.html`. |
| React app shell HTML | Build-time HTML (`app/index.html`) | Vite build pipeline | Vite multi-page emits both HTML files; the `<script type="module" src="/src/main.tsx">` reference lives ONLY in `app/index.html`. |
| PWA install CTA logic | Browser / inline `<script>` | — | `beforeinstallprompt` + `appinstalled` are window-scoped events; tiny inline script (no bundler). Landing has NO React runtime. |
| iOS detection + standalone check | Browser / inline `<script>` | — | Vanilla JS; `navigator.maxTouchPoints` + `window.matchMedia` + `navigator.standalone`. |
| Service worker scope narrowing | Build config (`vite.config.ts` manifest) + SW source (`src/sw.ts`) | Browser SW runtime | `manifest.scope` + `manifest.start_url` declare PWA scope; `NavigationRoute` allowlist enforces SW-side navigation matching. |
| Asset URL resolution on landing | Vite base prefix (`/Soundly/`) | Manual `<img src="/Soundly/og-image-v1.png">` OR relative paths | Static HTML doesn't get `import.meta.env.BASE_URL` substitution by default — paths must either be relative or hard-coded with the `/Soundly/` prefix. Pitfall C below. |
| Landing CSS | Inline `<style>` block OR `public/landing.css` | NOT app bundle | Landing must NOT load app's full Tailwind bundle; tiny hand-rolled palette + layout = minimal landing footprint. |

---

## Standard Stack

### Core (no new deps required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vite` | 6.0.5 (installed) | Multi-page build via `rollupOptions.input` | Already in stack. Multi-page is built into core, no plugin. [VERIFIED: package.json + Context7 /vitejs/vite] |
| `vite-plugin-pwa` | 0.21.1 (installed) | PWA manifest + SW orchestration; supports `manifest.scope` + `manifest.start_url` config | Already in stack. **DO NOT upgrade to 1.x** — locked OUT per REQUIREMENTS.md Out-of-Scope. Latest is 1.3.0 (verified `npm view vite-plugin-pwa version` → 1.3.0). Pinning 0.21.x is intentional. [VERIFIED: npm registry] |
| `workbox-routing` | 7.4.0 (installed) | `NavigationRoute` + `allowlist` support | Already in stack. Latest is 7.4.1 — minor version unchanged. The `allowlist: RegExp[]` API is stable since 6.x. [VERIFIED: Context7 + npm view workbox-routing] |
| `workbox-precaching` | 7.4.0 (installed) | `createHandlerBoundToURL` + `precacheAndRoute` | Already in stack. Used unchanged. [VERIFIED: package.json] |
| `workbox-core` | 7.4.0 (installed) | `clientsClaim()` helper | Already in stack (added directly in Phase 10 / Plan 10-04). Used unchanged. [VERIFIED: package.json] |
| `sharp` | 0.34.5 (installed) | Screenshot generation (if Composer screenshot is regenerated programmatically) | Already a devDep. Same SVG-to-PNG idiom as `generate-og-image.mjs`. [VERIFIED: package.json] |

### Supporting (existing assets reused)

| Asset | Path | Purpose |
|-------|------|---------|
| OG image (hero visual) | `public/og-image-v1.png` (33 KB) | Reused as landing hero per D-LAND-10 |
| Warm-earth palette CSS variables | `src/index.css` `@theme` block | Source-of-truth for landing inline `<style>` or `public/landing.css` |
| iOS platform detection logic | `src/platform/standalone.ts` | **Pattern source only — copy to vanilla JS for landing**, with the maxTouchPoints fix (Finding 6) |
| IosInstallBanner reference | `src/components/IosInstallBanner.tsx` | Pattern source for inline iOS panel copy/structure (do NOT import — landing has no React) |
| OG image generator | `scripts/generate-og-image.mjs` | Template for `scripts/generate-screenshot.mjs` IF the screenshot is also scripted. **Otherwise: manual DevTools capture** at 1200×800 desktop or 390×844 iPhone 14 viewport per D-LAND-13. |

### NOT to be added

| Anti-recommendation | Reason |
|--------------------|--------|
| `react-router-dom` or any router | Locked OUT per v2.0 ROADMAP "Routing approach locked to Vite multi-page (no router dep)" |
| `vite-plugin-html` template engine | Hand-authored HTML is two files; templating adds infra for zero benefit |
| `@playwright/test` for screenshot | NOT installed; adding a 100+ MB browser dep for one screenshot is gross overkill — manual DevTools or sharp scripting suffices |
| `vite-plugin-pwa@1.x` upgrade | Locked OUT per REQUIREMENTS.md Out-of-Scope; breaking config-schema changes risk regression |
| Any iOS install-prompt automation | `beforeinstallprompt` is NOT implemented in iOS Safari (verified Finding 5) — manual instructions are the only path |

---

## Findings

### Finding 1: Vite 6 multi-page build = `rollupOptions.input` with HTML at repo root [HIGH]

**Source:** Context7 `/vitejs/vite` guide/build.md + WebFetch `v6.vite.dev/guide/build.html`

**Verbatim Vite 6 syntax (NOT Vite 7 `rolldownOptions`):**

```ts
// vite.config.ts (Vite 6.0.5)
import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: '/Soundly/',
  // ... plugins unchanged ...
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app/index.html'),
      },
    },
  },
});
```

**Key facts:**
- The `app/index.html` file lives at `<repo-root>/app/index.html` — NOT under `src/`. Vite resolves HTML entries against the repo root.
- The dev server (`npm run dev`) automatically serves `http://localhost:5173/Soundly/app/` as `app/index.html`. No router needed.
- The build (`npm run build`) emits `dist/index.html` (landing) and `dist/app/index.html` (app shell). Asset paths in both are prefixed with `/Soundly/` per the `base` setting.
- Vite ignores the `input` object key names ("main", "app") and uses the resolved file path. So `dist/` directory structure mirrors the source: `dist/index.html` + `dist/app/index.html`.
- **CSS/asset extraction is per-entry by default.** Vite emits separate JS+CSS chunks per entry. Shared modules go to a common chunk. The landing's `<script>` tag should be ABSENT (it's a static page); the app shell's `<script type="module" src="/src/main.tsx">` is the only entry binding to the bundler.

**Confidence:** HIGH — verified via two independent sources (Context7 + Vite 6 official docs).

---

### Finding 2: `NavigationRoute` allowlist is the official `injectManifest` rescoping idiom [HIGH]

**Source:** Context7 `/vite-pwa/vite-plugin-pwa` guide/development.md + workbox/inject-manifest.md

**Verbatim canonical pattern from vite-plugin-pwa docs:**

```ts
// src/sw.ts
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

// Narrow allowlist to /app/* only — landing is served fresh from network
const navHandler = createHandlerBoundToURL('/Soundly/app/index.html');
registerRoute(
  new NavigationRoute(navHandler, {
    allowlist: [/^\/Soundly\/app\//],
  })
);
```

**Key facts:**
- `allowlist: RegExp[]` is matched against the concatenated pathname + search of the request URL.
- If a navigation URL does NOT match any allowlist regex, the SW does NOT intercept — the browser fetches from the network (or whatever other cache strategy applies).
- The landing page (`/Soundly/`) is naturally outside the allowlist → SW does NOT serve it → browser fetches `dist/index.html` directly per LAND-02 + D-LAND-15.
- `denylist` is the inverse — also supported. Use allowlist (positive constraint) per CONTEXT specifics — clearer intent.

**Critical update to `createHandlerBoundToURL`:** the URL changes from `/Soundly/index.html` (current) to `/Soundly/app/index.html` (post-split) because the precache manifest will list the app shell's HTML at that path after the multi-page build.

**Confidence:** HIGH — exact pattern shown verbatim in vite-plugin-pwa official docs for the `injectManifest` strategy.

---

### Finding 3: PWA `manifest.scope` + `manifest.start_url` change to `/Soundly/app/` [HIGH]

**Source:** vite-plugin-pwa SvelteKit example + MDN Web App Manifest + web.dev/learn/pwa/web-app-manifest

**Exact `manifest` block diff for vite.config.ts:**

```ts
manifest: {
  id: '/Soundly/',                          // NEW (D-LAND-NEW per Finding 4)
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

**Key facts:**
- `scope` defines what navigation targets are inside the installed PWA's window vs. open-in-browser. After narrowing to `/Soundly/app/`, an installed user clicking a `/Soundly/` link from inside the PWA opens that link in the browser, not in the standalone window. **This is the intended behavior** — the landing is for marketing, the app is for use.
- `start_url` is what the installed icon launches. Setting to `/Soundly/app/` means the installed PWA opens directly into the app, not the landing — matches LAND-02 intent.
- The Workbox precache manifest (generated by vite-plugin-pwa from `globPatterns`) controls what's offline-cached. Need to narrow `injectManifest.globPatterns` to `app/**` so landing assets aren't precached (landing is meant to be network-fresh per D-LAND-15).

**Confidence:** HIGH for the property semantics. MEDIUM for whether the `globPatterns` narrowing is necessary vs. automatic — see Open Question Q2.

---

### Finding 4: `manifest.id` is REQUIRED to preserve install identity across `start_url` change [HIGH]

**Source:** MDN Web/Manifest/id

**The problem:** Without an explicit `manifest.id`, browsers use `start_url` (resolved against the manifest's origin) as the implicit identity. When `start_url` changes from `/Soundly/` (Phase 10) to `/Soundly/app/` (Phase 11), the browser may treat the new manifest as a **different application** — installed users could end up with the old PWA stuck pointing at the (now-rewritten) `/Soundly/` landing page, while the new manifest registers as an "uninstalled" candidate.

**Fix:** Add `id: '/Soundly/'` to the manifest. The `id` is the stable identity; once set, the browser uses it (not `start_url`) to match updates against existing installs.

**Verbatim from MDN:** *"When `id` matches an existing app, the new manifest is treated as an update to that app (regardless of `start_url` changes). When `id` differs, the manifest is treated as a distinct application."*

**Choice of value for `id`:**
- `'/Soundly/'` — matches the Phase 10 installed `start_url`; safest for migration of existing installs
- `'/Soundly/app/'` — matches the new `start_url`; cleaner if there are NO installs to migrate yet (unlikely — v2.0 is being deployed; v1.0 has shipped already)

**Recommendation:** Use `id: '/Soundly/'` to maximize the chance existing v1.0 PWA installs are recognized as the same app. Document the choice prominently in the plan; **changing `id` in the future is itself a breaking install identity change**.

**Caveat:** No locked CONTEXT decision covers `manifest.id`. This is a Finding-derived recommendation; the planner should surface this as a NEW decision (D-LAND-17 candidate) and have the user confirm before locking.

**Confidence:** HIGH for the requirement (MDN is authoritative). The specific choice between `/Soundly/` vs `/Soundly/app/` is MEDIUM-confidence and **user-confirmation-worthy** — [ASSUMED] that existing v1 installs benefit from `/Soundly/` continuity, but no telemetry confirms an existing install base.

---

### Finding 5: `beforeinstallprompt` canonical pattern [HIGH]

**Source:** MDN BeforeInstallPromptEvent + web.dev/articles/customize-install

**Three-step canonical pattern (matches CONTEXT D-LAND-05 + D-LAND-07):**

```html
<button id="install-btn" hidden>Install Soundly</button>
<script>
  let deferredPrompt = null;
  const installBtn = document.getElementById('install-btn');

  // 1. Capture + defer the event (NEVER fires on iOS Safari)
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();           // Defer browser's default mini-infobar
    deferredPrompt = event;            // Stash for later use
    installBtn.hidden = false;         // Reveal the custom button (D-LAND-05)
  });

  // 2. Trigger prompt on user click
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;       // Safety guard
    deferredPrompt.prompt();           // Show native install UI
    const { outcome } = await deferredPrompt.userChoice;
    // outcome === 'accepted' | 'dismissed'
    deferredPrompt = null;             // Event is single-use per page session
    installBtn.hidden = true;          // Button is single-use too
  });

  // 3. Post-install handler (D-LAND-07 sequenced confirmation + redirect)
  window.addEventListener('appinstalled', () => {
    installBtn.hidden = true;          // Hide install button
    deferredPrompt = null;
    // D-LAND-07: inline confirmation, then auto-navigate
    const confirmEl = document.getElementById('install-confirm');
    confirmEl.hidden = false;          // "Installed ✓ — launching app…"
    setTimeout(() => {
      window.location.href = '/Soundly/app/';
    }, 1500);
  });
</script>
```

**Key facts:**
- `event.preventDefault()` MUST be called BEFORE storing the event reference; otherwise Chrome's mini-infobar shows alongside your custom button (double UX).
- The event fires AT MOST ONCE per page session — capture immediately at script load, not lazily.
- The event fires only after Chrome's engagement heuristics pass (rough threshold: ~30s on page OR significant scroll). For low-engagement landings, the event may NEVER fire — D-LAND-05's "no button unless event fired" is the honest UX.
- `userChoice` is the legacy promise; `await deferredPrompt.prompt()` in newer Chrome (M76+) returns `{ outcome, platform }` directly. Both work; `userChoice` is the safest cross-version idiom.
- `appinstalled` ALSO does not fire on iOS Safari — iOS install flow has no programmatic hook.

**Confidence:** HIGH — three corroborating sources (MDN, web.dev, recent Stack search results).

---

### Finding 6: iOS detection requires `navigator.maxTouchPoints` due to iPadOS UA spoofing [HIGH]

**Source:** 2025 nielsleenheer.com article + Apple Developer Forums thread + Sentry GitHub issue

**The problem:** Since iOS 13 / iPadOS 13 (2019), Safari on iPad reports its user agent as `Mozilla/5.0 (Macintosh; Intel Mac OS X ...) ...` — IDENTICAL to Safari on Mac. The substring `ipad` is no longer in the UA on modern iPads.

**The existing `src/platform/standalone.ts` test:**
```ts
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
```
catches iPhone + iPod but **misses modern iPad** (post-iPadOS 13). For the landing page, this would cause the iOS panel to NOT appear for iPad users — an honest UX bug.

**Reliable cross-iOS detection:**

```js
function isIos() {
  const ua = navigator.userAgent;
  // iPhone / iPod (legacy UA still works)
  if (/iphone|ipod/i.test(ua)) return true;
  // iPad with old UA OR iPadOS 13+ pretending to be Mac
  // Mac has no touchscreen → maxTouchPoints is always 1 on real Mac
  // iPad has maxTouchPoints >= 5
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
  return false;
}

function isInstalled() {
  // All platforms — display-mode media query (covers Android, desktop Chromium, iOS 15.4+)
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS WebKit-proprietary fallback (covers older iOS that lacks display-mode standalone)
  if (window.navigator.standalone === true) return true;
  return false;
}

function isIosSafariNonInstalled() {
  return isIos() && !isInstalled();
}
```

**Note:** Adding the maxTouchPoints branch to `src/platform/standalone.ts` ALSO improves the existing IosInstallBanner — but doing so modifies a v1-shipped file and crosses a v1 boundary. Phase 11's scope (per CONTEXT) is HTML + SW + manifest; touching `standalone.ts` is OUT of scope. **For the landing, write a vanilla-JS copy of this corrected detection inline; leave `standalone.ts` alone.**

**Confidence:** HIGH — multiple independent 2025-dated sources confirm this is the industry-standard reliable iOS detection.

---

### Finding 7: `appinstalled` event support matrix [HIGH]

**Source:** web.dev/learn/pwa/detection + MDN PWA Installation + 2026 MagicBell PWA iOS guide

| Platform | `beforeinstallprompt` | `appinstalled` | Install mechanism |
|----------|----------------------|----------------|-------------------|
| Chrome (Android) | ✓ | ✓ | Programmatic via `prompt()` |
| Chrome / Edge (desktop) | ✓ | ✓ | Programmatic via `prompt()` OR omnibox install icon |
| Safari (iOS 16.4+) | ✗ | ✗ | Manual: Share menu → Add to Home Screen |
| Safari (macOS) | ✗ | ✗ | Manual: File → Add to Dock (Safari 17+) |
| Firefox (all) | ✗ | ✗ | No install support |

**Implication for D-LAND-07 (auto-navigate to /app/ on appinstalled):** Works on Android Chrome + desktop Chromium; silently skipped on iOS / Firefox / Safari macOS. Document this asymmetry — on iOS, the user installs manually, then taps the new home-screen icon, which itself navigates to `start_url` (`/Soundly/app/`). The behavior is functionally equivalent; just non-automated.

**Confidence:** HIGH — corroborated across MDN, web.dev, and multiple 2025–2026 ecosystem guides.

---

### Finding 8: `<details>`/`<summary>` accessibility is Baseline + needs no ARIA [HIGH]

**Source:** MDN HTML/Element/details

**Key facts:**
- Implicit ARIA role = `group`. No `role=` permitted (use native semantics).
- Screen readers announce the `<summary>` text as the disclosure widget label, with open/closed state.
- Baseline Widely Available since January 2020 — works in all major browsers.
- Keyboard accessible by default: Tab focuses summary, Space/Enter toggles open/closed.

**Recommended pattern for the iOS install panel (D-LAND-06):**

```html
<details id="ios-install-panel">
  <summary>Install on iPhone</summary>
  <ol>
    <li>Tap the <strong>Share</strong> button (square with up-arrow) at the bottom of Safari</li>
    <li>Scroll and tap <strong>Add to Home Screen</strong></li>
    <li>Tap <strong>Add</strong> in the top-right corner</li>
  </ol>
</details>
```

**Heavy-styling caveat:** If the summary's default disclosure triangle is hidden via CSS (`summary::-webkit-details-marker { display: none; }`), provide a visual replacement (custom rotating glyph) — but screen readers still announce the disclosure semantics correctly regardless of visual marker presence. No ARIA required even with heavy styling.

**Confidence:** HIGH — MDN authoritative; behavior is part of the HTML standard.

---

### Finding 9: Phase 10 test infrastructure compatibility matrix [HIGH]

**Source:** Direct reading of `tests/static-assets.test.ts` and `scripts/verify-phase-10-build.mjs`

#### Phase 10 tests that need updating:

| Current assertion | What breaks after split | Required change |
|-------------------|------------------------|-----------------|
| Lines 21–50 `describe('index.html SEO meta')` — reads `index.html` and asserts SEO-01..05 meta tags | After split, root `index.html` is the LANDING; it needs its own meta block (per CONTEXT line 109). Tests still pass IF landing's meta block is identical in shape. | Add parallel `describe('app/index.html SEO meta')` block reading `app/index.html` and asserting app-shell-specific meta (canonical → `/Soundly/app/`, og:url → `/Soundly/app/`). |
| Lines 73–104 `describe('index.html preserved tags (D-26)')` — asserts charset, viewport, theme-color, apple-* tags | Apple-PWA meta belongs on the APP SHELL (`app/index.html`), not the landing (the landing isn't the installable PWA — `start_url` is `/app/`). | Move D-26 assertions to a new `describe('app/index.html preserved tags')` block. Landing keeps charset + viewport + theme-color (Lighthouse SEO requires viewport on every page) but loses the apple-* meta. |
| Lines 178–210 `describe('src/sw.ts has SEO-09 update calls')` — line 202–204 asserts `createHandlerBoundToURL('/Soundly/index.html')` + `new NavigationRoute(navHandler)` | After Phase 11, `createHandlerBoundToURL` changes to `/Soundly/app/index.html` AND `NavigationRoute` gains the allowlist option. | Update regex to `createHandlerBoundToURL\('\/Soundly\/app\/index\.html'\)` and add a new assertion that allowlist `/^\/Soundly\/app\//` is present. |
| Lines 212–234 `describe('vite.config.ts has SEO-09 registerType')` — line 233 asserts `start_url: '/Soundly/'` | After Phase 11, `start_url` is `/Soundly/app/` and `scope` is `/Soundly/app/`. | Update regex to `start_url:\s*['"]\/Soundly\/app\/['"]`. Add new assertion for `scope` and `id` (if Finding 4 is adopted). Add new assertion for `rollupOptions.input` containing both `main` and `app` keys. |
| Lines 237–245 `describe('placeholder canonical URL consistency (D-23)')` — asserts `https://soundly.local/Soundly/` in `index.html`, `robots.txt`, `sitemap.xml` | Landing keeps `https://soundly.local/Soundly/` placeholder; app shell uses `https://soundly.local/Soundly/app/`. The deploy runbook swap needs to handle BOTH placeholders. | Expand the assertion: both placeholders exist; landing has the bare `/Soundly/`, `app/index.html` has the `/Soundly/app/` form. |

#### Phase 10 verifier script (`scripts/verify-phase-10-build.mjs`) updates:

| Current check | What breaks after split | Required change |
|---------------|------------------------|-----------------|
| Lines 29–32 — reads `dist/index.html` for SEO substrings | `dist/index.html` is now the landing; it has its own SEO meta. Check still passes if landing has same meta substrings. | Also check `dist/app/index.html` for SEO substrings (app shell's distinct meta). |
| Lines 49–64 — `<link rel="manifest"` auto-injection check on `dist/index.html` | vite-plugin-pwa injects the manifest link on EVERY HTML entry by default (verified in current `dist/index.html` line 43). So both `dist/index.html` AND `dist/app/index.html` should have the link. But the landing arguably should NOT (it's not the PWA entry). | Investigate: does vite-plugin-pwa allow per-entry manifest injection? OR is the manifest link benign on the landing (browser ignores when the scope doesn't match)? See Open Question Q4. |
| Lines 67–76 — JSON-LD parse on `dist/index.html` | Landing keeps JSON-LD; app shell should too (mirrors landing for app-shell-deep-link shareability per CONTEXT line 109 "the `/app/` shell gets its own (distinct) meta block"). | Add parallel JSON-LD parse on `dist/app/index.html`. |
| Lines 79–88 — required dist asset list | After split, add `dist/app/index.html` to required list. | Add `'dist/app/index.html'` to `requiredAssets`. |
| Lines 99–102 — `dist/sw.js` has skipWaiting + clientsClaim | Unchanged — same checks apply. | Add assertion that `dist/sw.js` source contains `allowlist` reference (verifies SW rescope shipped). |

**Confidence:** HIGH — direct file reading; all changes are mechanical.

---

### Finding 10: Lighthouse PWA + SEO 90+ checklist for BOTH entries [MEDIUM-HIGH]

**Source:** developer.chrome.com/docs/lighthouse/pwa/installable-manifest + DebugBear Lighthouse SEO + Unlighthouse SEO audit guide

#### Lighthouse Installability requirements (applies to app shell `/Soundly/app/` only):

| Requirement | App shell? | Landing? |
|-------------|-----------|----------|
| `name` OR `short_name` in manifest | ✓ (via vite-plugin-pwa) | n/a — landing is not installable |
| 192×192 + 512×512 icons | ✓ (existing) | n/a |
| `start_url` defined | ✓ (`/Soundly/app/`) | n/a |
| `display: 'standalone' | 'fullscreen' | 'minimal-ui'` | ✓ (`standalone`) | n/a |
| Not `prefer_related_applications: true` | ✓ (not set) | n/a |
| HTTPS | Deploy-dependent | Deploy-dependent |
| Service worker registered with scope covering `start_url` | ✓ (scope `/Soundly/app/`, SW served from `/Soundly/sw.js` with default scope `/Soundly/`) | n/a |

**Critical scope-vs-SW-registration check:** The SW is served from `/Soundly/sw.js` — its default scope is the directory it's served from, i.e., `/Soundly/`. The manifest declares `scope: '/Soundly/app/'`. **The SW scope must encompass the manifest scope** for installability to pass. `/Soundly/` covers `/Soundly/app/` — ✓ this works. (No SW registration-scope override is needed.)

#### Lighthouse SEO 8-check audit (applies to BOTH `/Soundly/` and `/Soundly/app/`):

| Check | Landing | App shell |
|-------|---------|-----------|
| Viewport meta tag | ✓ (must add explicitly) | ✓ (existing) |
| `<title>` element | ✓ (D-LAND-01 hero line) | ✓ (existing) |
| `<meta name="description">` | ✓ (per CONTEXT — own version) | ✓ (existing, may want a slightly different one for app-shell context) |
| HTTP 200 status | Deploy-dependent | Deploy-dependent |
| Descriptive link text (no "click here") | Hand-written copy responsibility | n/a (React renders) |
| `robots.txt` valid | ✓ (Phase 10) | (shared file) |
| `hreflang` valid (multi-language only) | n/a — English only | n/a — English only |
| Crawlable links (no `rel=nofollow` on internal) | Hand-written; ensure `<a href="/Soundly/app/">Open Soundly</a>` is unrestricted | n/a |

**Score-impact lever:** Skipping the viewport meta on the landing drops SEO by 1/8 = 12.5 points. Most likely culprit if landing scores below 90. **Mandatory: include `<meta name="viewport" content="width=device-width, initial-scale=1">` on the landing.**

**Confidence:** MEDIUM-HIGH — Lighthouse criteria are documented but the exact scoring weight per missed audit varies by Lighthouse version (current is 12.x as of 2026; deprecated PWA category was removed; "Installable" criteria moved to Chrome installability docs).

---

### Finding 11: Asset URL resolution on static landing — Pitfall C concrete fix [HIGH]

**Source:** Vite docs (base config) + direct experimentation evidence (existing icon paths in `index.html` use `/icons/` not `/Soundly/icons/` and STILL work because Vite rewrites them at build time)

**The issue:** The current `index.html` uses `<link rel="apple-touch-icon" href="/icons/icon-192x192.png" />` (line 10). At build time, Vite's HTML transform automatically prepends `/Soundly/` to root-relative paths in HTML. **So `/icons/icon-192x192.png` in source becomes `/Soundly/icons/icon-192x192.png` in `dist/index.html`.**

**Inspection of `dist/index.html` line 43:** `<link rel="manifest" href="/Soundly/manifest.webmanifest">` — confirms Vite did the prefix rewrite.

**For the new landing HTML, asset references should use root-relative paths:**

```html
<!-- Source (index.html — landing) -->
<img src="/og-image-v1.png" alt="Soundly" />
<img src="/screenshot-composer-v1.png" alt="..." />
<a href="/app/">Open Soundly</a>           <!-- Note: /app/ NOT /Soundly/app/ -->

<!-- After Vite build (dist/index.html) -->
<img src="/Soundly/og-image-v1.png" alt="Soundly" />
<img src="/Soundly/screenshot-composer-v1.png" alt="..." />
<a href="/Soundly/app/">Open Soundly</a>
```

**Critical caveat:** Vite ONLY rewrites paths recognized as resource paths in known HTML attributes (`src`, `href`, `srcset`, etc.). It does NOT rewrite paths inside `<style>` blocks, inline `<script>` bodies, or CSS `url()` references within `<style>`. For inline JS that constructs URLs, use literal `'/Soundly/...'` prefixes OR read from a data attribute set with a rewritten path.

**`<a href>` for navigation:** `<a href="/app/">` becomes `<a href="/Soundly/app/">` after build. The deep-link install button can use this same pattern, OR the JS `window.location.href = '/Soundly/app/'` literal (since JS strings aren't rewritten).

**Confidence:** HIGH — direct dist/ inspection confirms the existing behavior; Vite docs corroborate.

---

### Finding 12: CSS strategy for landing — inline `<style>` is the right tradeoff [MEDIUM]

**Source:** Reasoning from constraints + reading `src/index.css` (65 lines)

**The constraint:** Landing must NOT trigger the full Tailwind app bundle download. Currently `src/index.css` is ~65 lines (palette + 2 animation systems) but it's imported by `src/main.tsx` → compiled by `@tailwindcss/vite` → emitted as a separate CSS chunk referenced from `dist/app/index.html`'s build artifacts. The landing HTML (no `<script>` to app bundler) gets no CSS unless we explicitly add one.

**Three viable approaches:**

| Approach | Pros | Cons |
|----------|------|------|
| Inline `<style>` block in `index.html` | Zero HTTP requests; full control; ~2 KB inline CSS; matches "hand-authored static HTML" intent | Duplication of palette tokens (5–6 hex values); not auto-synced with `src/index.css` |
| Separate `public/landing.css` linked from `<link rel="stylesheet">` | Cacheable; same source-of-truth for palette possible via build-time include | Extra HTTP request; need to manage file in `public/` (no Vite transform) |
| Re-use Tailwind via `<link rel="stylesheet" href="/assets/...css">` | Single CSS file across app + landing | Couples landing to app bundle hash; landing breaks on any app rebuild; defeats "landing without React runtime" intent |

**Recommendation:** **Inline `<style>` block** with the warm-earth palette CSS variables duplicated from `src/index.css` (5 hex values; trivial), plus the 30–50 lines of landing-specific layout. Total inline CSS ≤ 3 KB. No HTTP request, no coupling to app bundle, matches the "hand-authored static" intent in LAND-01.

**Confidence:** MEDIUM — this is a judgment call. Either inline or separate file works; inline is simpler and matches the stated philosophy. The planner may revisit.

---

## Anticipated Pitfalls

### Pitfall A: Old SW at `/Soundly/` keeps serving cached `/Soundly/index.html` (the OLD app shell) to installed users [HIGH RISK]

**Reproduction:**
1. User has v2.0 installed (Phase 10 ship) — PWA installed at `start_url: /Soundly/`; SW precaches `/Soundly/index.html` containing the React app shell
2. Deploy Phase 11 — `start_url` changes to `/Soundly/app/`; SW source rewrites; landing replaces `/Soundly/index.html` content
3. Installed user opens PWA from home-screen icon → browser launches `/Soundly/` (the OLD `start_url`) → SW serves CACHED `/Soundly/index.html` (the OLD React app shell, byte-stale)
4. Eventually (next launch or so) the new SW takes over via `clientsClaim()`, manifest is re-fetched, browser sees new `start_url: /Soundly/app/`, BUT the icon may still launch the old URL until the manifest update propagates

**Mitigation:**
- **D-LAND-15 already accepts this transition window** — the landing is served from network so newer users see fresh content; installed users see the OLD app one more time, then the SW updates.
- Adding `manifest.id: '/Soundly/'` per Finding 4 ensures the browser doesn't lose the "already installed" association during the swap.
- For a hard guarantee, the SW could include a `clients.matchAll()` + `client.navigate('/Soundly/app/')` redirect on activate — but this risks navigating mid-use. Don't add unless the transition window proves unacceptable in testing.

**Test:** The D-LAND-16 deploy runbook addendum specifies the manual phone test.

---

### Pitfall B: vite-plugin-pwa manifest includes assets from BOTH entries — landing assets get precached unnecessarily [MEDIUM RISK]

**Reproduction:**
1. After Phase 11, `dist/` contains both landing assets (landing CSS, og-image, screenshot) and app assets (React bundle, app CSS)
2. vite-plugin-pwa's default `globPatterns` glob ALL of `dist/` → precaches both sets
3. Result: install of the app PWA also precaches landing.css + the screenshot — unnecessary bytes, opens cache invalidation surface

**Mitigation:**
- Narrow `injectManifest.globPatterns` to `'app/**/*.{js,css,html,svg,png,webp,woff2}'` so only app-shell artifacts are precached
- Add `injectManifest.globIgnores` to explicitly exclude root-level files: `['index.html', 'screenshot-*.png', 'og-image-*.png', 'sitemap.xml', 'robots.txt']`
- Verify by inspecting `dist/sw.js`'s `__WB_MANIFEST` content after build — it should list ONLY `app/`-prefixed entries

**Confidence:** MEDIUM — vite-plugin-pwa with `injectManifest` strategy's default glob behavior is documented but exact-default-pattern enumeration is missing from official docs. Verify experimentally.

---

### Pitfall C: Asset path resolution in static landing HTML [HIGH — but mitigation is simple]

Covered in Finding 11 above. **Mitigation:** Use root-relative paths (`/og-image-v1.png`, NOT `og-image-v1.png` and NOT `/Soundly/og-image-v1.png`). Vite's HTML transform will prepend `/Soundly/` at build time.

For inline JS (e.g., the install handler's `window.location.href = '/Soundly/app/'`), use the literal `/Soundly/app/` since JS strings aren't transformed. **Test by running `npm run build` and inspecting `dist/index.html` directly** — every URL should start with `/Soundly/`.

---

### Pitfall D: `<details>`/`<summary>` styled with custom marker breaks ARIA on Firefox [LOW RISK]

**Reproduction:** Hiding the default marker with `summary::-webkit-details-marker { display: none; }` (Webkit-only) silently does nothing on Firefox; conversely `summary { list-style: none; }` works on Firefox but not Webkit. Inconsistent styling can leave one browser without a disclosure visual indicator.

**Mitigation:** Use BOTH `summary::-webkit-details-marker { display: none; } summary::marker { content: ''; }` (the unprefixed `::marker` is Firefox-compatible). Provide a custom visual glyph (e.g., a CSS rotated `▸` that flips to `▾` on `details[open]`). Native ARIA semantics are preserved regardless.

---

### Pitfall E: Build emits `dist/main.html` instead of `dist/index.html` if `input` key naming clashes with Vite's HTML resolution [LOW]

Per Vite docs (Finding 1): "Vite ignores the name given to the entry in the `rollupOptions.input` object and instead respects the resolved id of the file when generating the HTML asset." So `{ main: '...index.html', app: '...app/index.html' }` correctly emits `dist/index.html` + `dist/app/index.html`. Pitfall is theoretical only.

---

### Pitfall F: Lighthouse PWA score drops because SW `scope` doesn't cover `start_url` [LOW with vite-plugin-pwa defaults]

vite-plugin-pwa registers the SW at the root level (`/Soundly/sw.js`) so its default scope is `/Soundly/` — which encompasses the new manifest `scope: '/Soundly/app/'`. ✓ Pass. **Verify in the Phase 11 build output**: confirm `dist/sw.js` is at `dist/sw.js` (root) NOT `dist/app/sw.js`.

---

### Pitfall G: Existing `tests/static-assets.test.ts` D-23 placeholder consistency test fails after split [MEDIUM — affects CI]

The test (line 239–245) asserts `https://soundly.local/Soundly/` literal substring appears in `index.html`, `robots.txt`, `sitemap.xml`. After split, `app/index.html`'s canonical/og:url uses `https://soundly.local/Soundly/app/`. The test as written still passes IF landing keeps the bare placeholder; but it doesn't verify the app shell's placeholder consistency. **Extend the assertion to cover `app/index.html` separately.**

---

## Code Examples

### vite.config.ts (post-Phase-11) — complete change-set

```ts
import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: '/Soundly/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      manifest: {
        id: '/Soundly/',                            // NEW (Finding 4)
        name: 'Soundly Gentle Alarm',
        short_name: 'Soundly',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f4f1eb',
        theme_color: '#5c6b56',
        start_url: '/Soundly/app/',                 // CHANGED from '/Soundly/'
        scope: '/Soundly/app/',                     // NEW
        icons: [
          { src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512x512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {                             // NEW (Pitfall B mitigation)
        globPatterns: ['app/**/*.{js,css,html,svg,png,webp,woff2}'],
        globIgnores: [
          'index.html',
          'screenshot-*.png',
          'og-image-*.png',
          'sitemap.xml',
          'robots.txt',
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  build: {                                          // NEW (multi-page)
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app/index.html'),
      },
    },
  },
});
```

### src/sw.ts (post-Phase-11) — NavigationRoute narrowing

```ts
/// <reference lib="webworker" />

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';

declare let self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Phase 11 — narrowed to /app/* only. Landing (/Soundly/) is served from
// the network, not the SW, per LAND-02 + D-LAND-15.
const navHandler = createHandlerBoundToURL('/Soundly/app/index.html');
registerRoute(
  new NavigationRoute(navHandler, {
    allowlist: [/^\/Soundly\/app\//],
  })
);

// notificationclick handler — UPDATE openWindow target to /Soundly/app/
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList: readonly Client[]) => {
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            return (client as WindowClient).focus();
          }
        }
        return self.clients.openWindow('/Soundly/app/');  // CHANGED from '/Soundly/'
      })
  );
});

self.skipWaiting();
clientsClaim();
```

### `index.html` (post-Phase-11) — landing page skeleton (planner refines copy)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#5c6b56" />
    <!-- SEO meta (landing variant — canonical & og:url point to /Soundly/) -->
    <title>Soundly — a calmer alarm that alerts you gently</title>
    <meta name="description" content="A free alarm app with soft sounds, vibration, or full volume — fully customizable. No accounts, no ads. Just share your setup. PWA — installs anywhere." />
    <link rel="canonical" href="https://soundly.local/Soundly/" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Soundly — gentle alarm" />
    <meta property="og:description" content="A free alarm app with soft sounds or vibration or full volume - fully customizable. No accounts, no ads, just share your alarm setup. Progressive Web App (PWA), install on phone or desktop." />
    <meta property="og:image" content="https://soundly.local/Soundly/og-image-v1.png" />
    <meta property="og:url" content="https://soundly.local/Soundly/" />
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
      "url": "https://soundly.local/Soundly/"
    }
    </script>
    <style>
      /* Warm-earth palette (synced from src/index.css @theme) */
      :root {
        --bg: #f4f1eb;
        --text-primary: #3d4a38;
        --text-secondary: #8a7e6b;
        --sage: #5c6b56;
        --accent: #c27c5a;
        --border: #d4cbbe;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #2a2f26;
          --text-primary: #d4cbbe;
          --text-secondary: #a89e8d;
        }
      }
      body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text-primary); line-height: 1.6; }
      .hero { max-width: 720px; margin: 0 auto; padding: 4rem 1.5rem 2rem; text-align: center; }
      .hero img { max-width: 100%; height: auto; }
      h1 { font-size: clamp(1.75rem, 5vw, 2.75rem); margin: 1rem 0; }
      .install-cta { margin: 2rem 0; }
      #install-btn, .open-app-link { display: inline-block; padding: 0.85rem 1.5rem; border-radius: 0.5rem; border: 0; background: var(--sage); color: var(--bg); font-size: 1rem; cursor: pointer; text-decoration: none; }
      #install-btn[hidden] { display: none; }
      details { max-width: 560px; margin: 1rem auto; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 0.5rem; }
      details summary { cursor: pointer; font-weight: 500; }
      /* ... more landing-specific styles ... */
    </style>
  </head>
  <body>
    <header class="hero">
      <img src="/og-image-v1.png" alt="Soundly — a calmer alarm" />
      <h1>A calmer alarm that alerts you gently</h1>
      <p>Wakes you with soft sounds first — vibration second, full volume only if needed. Calm first, reliable when it matters.</p>
      <div class="install-cta" id="install-cta">
        <button id="install-btn" hidden>Install Soundly</button>
        <details id="ios-install-panel" hidden>
          <summary>Install on iPhone</summary>
          <ol>
            <li>Tap the <strong>Share</strong> button at the bottom of Safari</li>
            <li>Tap <strong>Add to Home Screen</strong></li>
            <li>Tap <strong>Add</strong> in the top-right corner</li>
          </ol>
        </details>
        <p id="install-confirm" hidden>Installed ✓ — launching app…</p>
        <a href="/app/" class="open-app-link">Open Soundly</a>
      </div>
    </header>
    <main>
      <section class="screenshot-section">
        <img src="/screenshot-composer-v1.png" alt="Soundly Composer with Wake Easy preset" />
      </section>
      <section class="faq">
        <h2>Questions</h2>
        <!-- 6-8 plain <h3>+<p> Q&A pairs per D-LAND-03 -->
      </section>
      <section class="ios-honesty">
        <h2>If you're on iPhone</h2>
        <p>We wish Soundly worked perfectly on iPhone's locked screen — but iOS blocks PWA audio in that state. We're being honest so you can decide if Soundly fits your iPhone use.</p>
        <p>Here's how to use Soundly reliably on iPhone: install to your home screen, plug in or keep the screen on while the alarm is armed, and use it as a nap timer or focus timer where you'll be near the phone.</p>
      </section>
      <footer>
        <a href="https://github.com/J-B-E-Haug/Soundly">GitHub</a> · Made by J. B. E. Haug · © 2026
      </footer>
    </main>
    <script>
      // ─── Install CTA logic (D-LAND-05, 06, 07, 08) ───
      (function () {
        // D-LAND-08: strip install CTA entirely if already installed
        function isInstalled() {
          if (window.matchMedia('(display-mode: standalone)').matches) return true;
          if (window.navigator.standalone === true) return true;  // iOS WebKit
          return false;
        }
        if (isInstalled()) {
          var cta = document.getElementById('install-cta');
          if (cta) cta.remove();
          return;  // Bail — no install logic needed
        }

        // Reliable iOS detection (Finding 6 — handles iPadOS UA spoofing)
        function isIos() {
          var ua = navigator.userAgent;
          if (/iphone|ipod/i.test(ua)) return true;
          if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
          return false;
        }

        // D-LAND-06: show iOS panel on iOS Safari non-installed
        if (isIos()) {
          var iosPanel = document.getElementById('ios-install-panel');
          if (iosPanel) iosPanel.hidden = false;
        }

        // D-LAND-05: capture beforeinstallprompt + show button
        var deferredPrompt = null;
        var installBtn = document.getElementById('install-btn');
        window.addEventListener('beforeinstallprompt', function (e) {
          e.preventDefault();
          deferredPrompt = e;
          if (installBtn) installBtn.hidden = false;
        });
        if (installBtn) {
          installBtn.addEventListener('click', async function () {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
            installBtn.hidden = true;
          });
        }

        // D-LAND-07: post-install confirmation + auto-navigate
        window.addEventListener('appinstalled', function () {
          if (installBtn) installBtn.hidden = true;
          deferredPrompt = null;
          var confirmEl = document.getElementById('install-confirm');
          if (confirmEl) confirmEl.hidden = false;
          setTimeout(function () {
            window.location.href = '/Soundly/app/';
          }, 1500);
        });
      })();
    </script>
  </body>
</html>
```

### `app/index.html` (post-Phase-11) — app shell skeleton

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#5c6b56" />
    <!-- Apple PWA meta — MOVED from root index.html (D-26 carries to app shell) -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Soundly" />
    <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
    <!-- SEO meta (app shell variant — canonical & og:url point to /Soundly/app/) -->
    <title>Soundly — gentle alarm app</title>
    <meta name="description" content="The Soundly alarm app. Compose custom alarms with soft chimes, vibration, and full-volume escalation." />
    <link rel="canonical" href="https://soundly.local/Soundly/app/" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Soundly — gentle alarm" />
    <meta property="og:description" content="..." />
    <meta property="og:image" content="https://soundly.local/Soundly/og-image-v1.png" />
    <meta property="og:url" content="https://soundly.local/Soundly/app/" />
    <meta name="twitter:card" content="summary_large_image" />
    <!-- Twitter mirrors og:* -->
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
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## Phase 10 Test Compatibility Analysis

See Finding 9 above for the full table. Summary of action items for the planner:

1. **`tests/static-assets.test.ts`**:
   - Keep all current `describe('index.html ...')` blocks; they continue testing the LANDING file (which keeps its own canonical/og:url at `/Soundly/`)
   - Add parallel `describe('app/index.html SEO meta')` block — same shape, but assertions point to `/Soundly/app/` for canonical/og:url
   - **Move** the `describe('index.html preserved tags (D-26)')` apple-* assertions to a new `describe('app/index.html preserved tags')` block. The landing keeps charset + viewport + theme-color (Lighthouse SEO + brand consistency); the app shell keeps apple-* (it's the installable PWA entry).
   - **Update** the `src/sw.ts` test (line 202–204): regex changes to `createHandlerBoundToURL\('\/Soundly\/app\/index\.html'\)`; add new assertion for `allowlist: [/^\\\/Soundly\\\/app\\\//]`
   - **Update** the `vite.config.ts` test (line 233): regex changes to `start_url:\s*['"]\/Soundly\/app\/['"]`; add `scope:`, `id:`, and `rollupOptions.input` assertions
   - **Extend** the D-23 placeholder consistency test to cover BOTH `index.html` (bare `/Soundly/`) and `app/index.html` (`/Soundly/app/`)

2. **`scripts/verify-phase-10-build.mjs`** (rename to `verify-build.mjs` since it's no longer Phase-10-specific? — Claude's discretion):
   - Add `'dist/app/index.html'` to `requiredAssets`
   - Repeat the SEO substring check on `dist/app/index.html`
   - Repeat the JSON-LD parse on `dist/app/index.html`
   - Add new check: `dist/sw.js` contains `allowlist` reference (verifies SW rescope shipped)
   - Resolve Open Question Q4 about manifest link injection on landing — adjust the line 57–64 check accordingly

3. **`docs/deploy-runbook.md`**:
   - Update the URL-swap table in §1 — the file-occurrence counts change (likely 5→3 in `index.html` since canonicals split; +new occurrences in `app/index.html`). Re-count after planner finalizes the meta blocks.
   - Add §3.1: verify both `dist/index.html` AND `dist/app/index.html` exist after build
   - Add §8.1 (Phase 11 SW-rescope addendum per D-LAND-16): manual phone test for the SW migration

---

## Lighthouse Criteria Checklist (for BOTH entries)

### Landing `/Soundly/` (NOT installable; SEO + accessibility focus)

| Audit | Required content / fix |
|-------|------------------------|
| Document `<title>` | D-LAND-01 hero line |
| `<meta name="description">` | Landing-variant description (per CONTEXT line 109) |
| Viewport meta | `<meta name="viewport" content="width=device-width, initial-scale=1">` |
| Color contrast (AA) | Warm-earth palette pairings: sage (#5c6b56) on bg (#f4f1eb) — contrast ratio 4.7:1 ✓; verify in dark mode |
| Landmark roles | `<header>`, `<main>`, `<footer>` semantic elements (no `role=` needed) |
| Link text descriptive | "Open Soundly", "Install on iPhone", "GitHub" — all pass |
| Crawlable links | `<a href="/app/">` (no `rel=nofollow`); avoid JS-only navigation |
| HTTP 200 | Deploy-dependent (GitHub Pages serves static HTML at 200) |
| Image alt text | Hero img + screenshot — provide descriptive alt |

### App shell `/Soundly/app/` (installable PWA; needs Lighthouse Installability + SEO)

| Audit | Required content / fix |
|-------|------------------------|
| All Landing audits above | Same content needed |
| Apple PWA meta (`apple-mobile-web-app-*`, `apple-touch-icon`) | Per Phase 10 D-26 — MOVE from current root `index.html` to `app/index.html` |
| Manifest linked | vite-plugin-pwa auto-injects `<link rel="manifest" href="/Soundly/manifest.webmanifest">` per the current behavior (verified in Phase 10's `dist/index.html` line 43) — expected to inject into `app/index.html` post-split. Verify experimentally (Open Question Q4). |
| Manifest has name + 192/512 icons + start_url + display + non-prefer_related_applications | vite.config.ts `manifest` block already satisfies all |
| Service worker covers scope | SW served from `/Soundly/sw.js` (scope `/Soundly/`); manifest scope `/Soundly/app/` is inside ✓ |
| HTTPS | Deploy-dependent |

---

## Sources

### Primary (HIGH confidence)

- **Context7 `/vite-pwa/vite-plugin-pwa`** — guide/development.md (NavigationRoute allowlist verbatim pattern); workbox/inject-manifest.md (denylist pattern); guide/static-assets.md (globPatterns / globIgnores); frameworks/sveltekit.md (manifest scope + start_url example)
- **Context7 `/vitejs/vite`** — guide/build.md (multi-page rollupOptions.input syntax; note Context7 returned v7 docs using `rolldownOptions`)
- **WebFetch `https://v6.vite.dev/guide/build.html`** — confirmed Vite 6 uses `rollupOptions` (not `rolldownOptions`)
- **MDN BeforeInstallPromptEvent** — `https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent`
- **MDN Web/Manifest/id** — `https://developer.mozilla.org/en-US/docs/Web/Manifest/id`
- **MDN HTML/Element/details** — `https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details`
- **web.dev/articles/customize-install** — canonical install pattern
- **web.dev/learn/pwa/web-app-manifest** — manifest scope + start_url semantics + `id` migration caveat
- **web.dev/learn/pwa/detection** — appinstalled + display-mode detection
- **developer.chrome.com/docs/lighthouse/pwa/installable-manifest** — installability criteria
- **vite-pwa-org.netlify.app/guide/unregister-service-worker** — self-destroying SW pattern (referenced but NOT recommended for this use case)
- **npm registry** — `npm view vite-plugin-pwa version` → 1.3.0 latest; `npm view workbox-routing version` → 7.4.1 latest

### Secondary (MEDIUM confidence — verified against official sources)

- **DebugBear Lighthouse SEO guide** — 8-check audit enumeration
- **Unlighthouse SEO audit guide** — score-weight reasoning
- **2026 MagicBell PWA iOS guide** — iOS appinstalled non-support corroboration
- **2025 nielsleenheer.com Safari UA article** — iPadOS UA spoofing post-iOS 13
- **Apple Developer Forums #119186** — iPadOS UA reporting as Mac

### Tertiary (LOW confidence — informational, not load-bearing)

- **Bastaki Software Solutions blog** — cross-platform install button pattern (cross-reference only)
- **DEV.to PWA Icon Requirements 2025 checklist** — icon size enumeration

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Existing v1.0 PWA installs benefit from `manifest.id: '/Soundly/'` (vs. `/Soundly/app/`) | Finding 4 | If wrong, installed users may need to reinstall; landing analytics (none) can't measure. Mitigation: pick `/Soundly/`, document it, never change. |
| A2 | vite-plugin-pwa `injectManifest.globPatterns` narrowing is required to keep landing assets out of precache | Pitfall B | If unnecessary, build still works but landing CSS/screenshot get cached for installed users — small bandwidth waste, harmless. Verify by inspecting `dist/sw.js` `__WB_MANIFEST` after build. |
| A3 | Vite ONLY rewrites root-relative paths in HTML attributes, NOT in inline `<style>` or `<script>` | Finding 11 | If Vite DOES rewrite inside `<style>`/`<script>`, the landing's hard-coded `/Soundly/app/` JS literal becomes `/Soundly/Soundly/app/` — broken navigation. Mitigate: verify in built `dist/index.html` before deploy. |
| A4 | The SW served at `/Soundly/sw.js` automatically has scope `/Soundly/` (covers narrower manifest scope `/Soundly/app/`) without explicit registration scope override | Pitfall F | If scope is narrower (e.g., `/Soundly/sw.js` registered with `scope: /Soundly/app/`), Lighthouse installability passes; if wider, also passes. Risk is near-zero. |
| A5 | `manifest.id` was not set in Phase 10 — so existing installed PWAs use implicit `start_url`-based identity | Finding 4 | Verified by reading vite.config.ts (no `id` field present). Assumption: this implicit identity is `/Soundly/`. Browser-specific behavior may vary. |
| A6 | The `screenshot-composer-v1.png` for D-LAND-13 will be captured manually via DevTools — no Playwright in stack to script it | Standard Stack | If user requests automated capture later, add `@playwright/test` (deferred); doesn't block Phase 11. |
| A7 | App shell SEO meta on `app/index.html` should mirror landing's structure but with `/Soundly/app/` canonicals (CONTEXT line 109 implies this) | Code Examples / Finding 9 | If user wants a fully distinct meta block (different description, different OG image), planner adjusts copy during plan creation. |

---

## Open Questions (RESOLVED)

1. **Q1: What is the EXACT behavior of an installed v1.0 PWA when Phase 11 ships and `manifest.scope`/`start_url` narrow to `/Soundly/app/`?**
   - What we know: SW will update via `clientsClaim()` + `autoUpdate`; `manifest.id` (Finding 4) preserves install identity if added.
   - What's unclear: Whether the installed icon's `start_url` re-resolves on next browser launch, OR whether the user must uninstall + reinstall. No official source enumerates this exact migration path for scope-narrow-with-id-added.
   - **RESOLVED:** Adopt Finding 4 (add `manifest.id: '/Soundly/'` per D-LAND-17 derived in Plan 11-01); execute the D-LAND-16 manual phone test BEFORE shipping; treat any user-visible regression as a blocking issue with `selfDestroying: true` as the nuclear-option recovery.

2. **Q2: Is `injectManifest.globPatterns` narrowing required, or does vite-plugin-pwa auto-scope to the SW filename's directory?**
   - What we know: The SW is at `dist/sw.js` (root); the default glob picks up `dist/**`. Landing assets exist at `dist/`.
   - What's unclear: Whether vite-plugin-pwa's default `injectManifest` glob is already narrow enough to exclude root-level files like the landing's HTML/CSS by some hidden default.
   - **RESOLVED:** Explicit narrowing applied in Plan 11-01 — `injectManifest.globPatterns: ['app/**/*.{js,css,html,svg,png,webp,woff2}']` per Pitfall B mitigation (belt-and-suspenders, even if it overlaps with a default). Verify by inspecting `dist/sw.js` `__WB_MANIFEST` content after build.

3. **Q3: For the screenshot (D-LAND-13), is the planner expected to capture it manually, or should the plan include a `scripts/capture-screenshot.mjs` (Playwright-based) as part of the deliverable?**
   - What we know: Playwright is NOT installed (verified package.json). Adding it as a devDep for a one-shot screenshot is heavy.
   - What's unclear: User preference for one-shot manual vs. reproducible scripted capture.
   - **RESOLVED:** Manual capture via D-LAND-13 user checkpoint in Plan 11-05 Task 1 (DevTools at 1200×800 desktop). Capture procedure documented in plan + deploy runbook. No Playwright dependency added — deferred unless the user requests it.

4. **Q4: Does vite-plugin-pwa auto-inject `<link rel="manifest">` into BOTH HTML entries, or only one?**
   - What we know: Currently injects into `dist/index.html` (verified, line 43). Behavior with two entries is undocumented.
   - What's unclear: After split, does the link appear in both `dist/index.html` AND `dist/app/index.html`? Or only one (which one)?
   - **RESOLVED** (deferred to runtime verifier — Plan 11-05 Task 3 asserts `<link rel="manifest">` presence in both dist/index.html AND dist/app/index.html; Phase 10 D-25 manual fallback documented in deploy runbook): Add a check in the build verifier (`scripts/verify-phase-10-build.mjs` updates) to assert presence on `dist/app/index.html`. If it's NOT injected, add a manual `<link rel="manifest" href="/Soundly/manifest.webmanifest">` to `app/index.html` source per the Phase 10 D-25 fallback pattern. If it IS injected on the landing as well (harmless — browser ignores when scope mismatches), no action needed.

5. **Q5: Should the landing have its own ServiceWorker registration script, or is the auto-registered `/Soundly/registerSW.js` left untouched?**
   - What we know: vite-plugin-pwa with `registerType: 'autoUpdate'` injects `<script id="vite-plugin-pwa:register-sw" src="/Soundly/registerSW.js">` into HTML entries. The SW being registered has scope `/Soundly/` covering both `/` and `/app/`. From the LANDING, registering the SW is fine (the manifest scope narrows to `/app/` but the SW itself can have a wider scope).
   - What's unclear: Whether the landing entry should suppress the auto-register tag to keep the landing 100% network-fresh-no-SW. If suppressed, installed users still trigger SW update when they next visit `/Soundly/app/` — no harm done.
   - **RESOLVED:** Leave default registration on both entries. vite-plugin-pwa injects the register script on BOTH entries (default). The landing visit triggers a SW update check, which is benign and even desirable (faster propagation of fresh SW). If audit complaints arise about landing loading a SW for a different scope, revisit with `injectRegister: false` on the landing entry — not currently documented as supported per-entry but a custom plugin hook could achieve it.

6. **Q6: Should the `id` manifest field be `/Soundly/` (continuity with v1 installs) or a stable opaque string like `'soundly-v2'` (decouple from URL changes)?**
   - What we know: MDN says `id` should be a URL string OR relative URL. Apple/Chromium both accept relative strings.
   - What's unclear: Best-practice consensus is split. Some sources recommend a URL form for compatibility; some say opaque strings work.
   - **RESOLVED:** Use `id: '/Soundly/'` (URL form chosen in Plan 11-01 for v1.0 PWA install association) — maximizes Chrome/Edge compatibility, preserves continuity with v1's implicit identity. Document the choice prominently in plan + RESEARCH.md so future maintainers don't change it.

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all libraries already installed; versions verified via `npm view`
- Architecture (multi-page split): HIGH — Vite 6 docs unambiguous; one-config-block change
- NavigationRoute rescoping: HIGH — official vite-plugin-pwa pattern shown verbatim
- `manifest.id` requirement: HIGH for the requirement; MEDIUM for the specific value choice
- Install CTA flow: HIGH — MDN + web.dev canonical pattern; D-LAND-05/07 align
- iOS detection: HIGH — corroborated by 2025-dated sources
- Phase 10 test compatibility: HIGH — direct file reading; mechanical updates
- SW migration on rescope: MEDIUM — official docs don't enumerate this exact transition; D-LAND-16 manual test is the safety net
- Lighthouse criteria: MEDIUM-HIGH — criteria well-documented; exact 90+ scoring depends on Lighthouse version
- CSS strategy: MEDIUM — judgment call; inline `<style>` matches the static-HTML philosophy

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (30 days; vite-plugin-pwa 0.21.x and Vite 6 are stable; iOS Safari support matrix is the most likely to evolve — re-check `appinstalled` support for iOS Safari before deploying)
