# Technology Stack — v2.0 Additions

**Project:** Soundly Gentle Alarm — Custom Alarm Composer + Discoverability
**Researched:** 2026-05-04
**Confidence:** HIGH for routing/metadata/sitemap; MEDIUM for drag-and-drop pick (two viable libraries with different tradeoffs).
**Scope note:** This file documents ONLY the new dependencies and configuration changes for v2.0. The v1.0 baseline (React 19, Vite 6, TypeScript 5, Tailwind v4, vite-plugin-pwa, Web Audio API, Wake Lock, etc.) remains in `.planning/research/v1.0/STACK.md` and is unchanged.

---

## TL;DR — What v2.0 Adds

| Need | Pick | Version | Bundle (gz, approx) |
|------|------|---------|----------------------|
| Routing (landing `/` ↔ app `/app`) | **react-router (library mode)** | `^7.14` | ~14 KB |
| Sitemap.xml + robots.txt at build | **vite-plugin-sitemap** | `^0.8` | dev-only (no runtime cost) |
| Per-page meta tags + JSON-LD | **React 19 native `<title>`/`<meta>`/`<script>` hoisting** | — (built-in) | 0 KB |
| Drag-and-drop segment reorder | **`motion` (Reorder)** if already adopting Motion, else **`@dnd-kit/core` + `@dnd-kit/sortable`** | Motion `^12.x` / dnd-kit `^6.3` | Motion ~15 KB (LazyMotion+drag) / dnd-kit ~10 KB |
| Static landing assets (screenshots, OG image) | **`public/`** dir (no plugin) | — | — |

**What v2.0 explicitly does NOT add:** react-helmet-async, @tanstack/react-router, react-dnd, @dnd-kit/react (0.x), Next.js, Astro, vite-ssg, react-schemaorg, vite-plugin-pages, or any CMS. Reasoning in "Alternatives Considered" below.

---

## 1. Routing — `react-router` v7 (library mode)

### The decision

Adopt **`react-router` v7 in library mode** (not framework mode, not TanStack Router).

```bash
npm install react-router@^7
```

Use `createBrowserRouter` + `RouterProvider` exactly the same shape v6 users know — v7's library mode is a non-breaking superset of v6.

### Why a router at all (vs Vite multi-entry)

The milestone needs two URL surfaces from one deployment:

- `/` — marketing landing (above-the-fold pitch, screenshots, FAQ). **Should be indexable.** Should be the default entry for first-time visitors arriving from Google.
- `/app` — the existing alarm app shell. Installable PWA `start_url`. Returning users should land here directly when launched from home screen.

Three architectural options were evaluated:

| Option | How it works | Verdict |
|--------|--------------|---------|
| **A. Vite multi-entry (`rollupOptions.input` with two HTML files)** | Build `index.html` (landing) + `app.html` (app shell), each with its own JS entry | **Rejected.** Doubles the bundle (two React trees, two CSS roots), splits the service worker precache logic, complicates `vite-plugin-pwa` (it expects one navigation fallback), and the landing's CTA → `/app` becomes a hard navigation — losing the React SPA feel. Also: Vite's MPA dev mode has [known rough edges](https://github.com/vitejs/vite/issues/17817) where `rollupOptions.input` is not always honored in dev. |
| **B. Static landing `index.html` + nested SPA at `/app/*`** | Hand-write a static landing HTML in `public/` and let the SPA take over only at `/app` | **Rejected.** Sounds simple but fights the PWA's `NavigationRoute` SPA fallback in `src/sw.ts:18-19`. Either the SW intercepts `/` (and you lose the static HTML) or you carve `/` out via `denylist` (and the landing is no longer offline-cached, breaking the "fully offline PWA" guarantee). Also: hand-rolling marketing HTML loses Tailwind v4 utility classes from the design system unless you re-set up Tailwind for the static page. |
| **C. Single React app with `react-router` v7 library mode** ✅ | Two routes (`/` landing, `/app` alarm shell) inside one React tree, one Vite entry, one service worker, one Tailwind config | **Selected.** One bundle (small, code-split per route via `lazy`), one PWA, one design system. Service worker keeps its existing `NavigationRoute` fallback unchanged. Manifest `start_url` switches to `/app` so PWA launch goes straight to the alarm. |

### Why `react-router` v7 specifically (vs TanStack Router)

| Criterion | react-router v7 (library) | @tanstack/react-router |
|-----------|---------------------------|------------------------|
| Bundle (gzip) | ~14 KB | ~13 KB |
| API stability | Mature; v6→v7 is non-breaking | 1.x active; healthier semver but lots of churn (see [release log](https://github.com/TanStack/router/releases) — multiple releases per week through April 2026) |
| Learning curve for this app | Trivial — two routes | High — file-based routing, type-safe params, codegen step |
| Type-safe routing | Manual | First-class (the headline feature) |
| Fit for Soundly | Two routes, no params, no nested layouts. Type-safe routing buys nothing. | Optimized for apps with deep nested routes and search-param state. Overkill here. |
| Vite integration | Pure runtime — no plugin | Requires `@tanstack/router-plugin/vite` codegen plugin |

For a two-route SPA with no params and no nested layouts, react-router library mode is the lower-friction pick. TanStack Router's value prop (compile-time type safety on dynamic routes) doesn't apply.

### Versions verified (npm, 2026-05-04)

- `react-router@7.14.2` — latest stable; v7 library mode is the recommended migration target from v6, non-breaking upgrade.
- TanStack Router `@1.169.1` — actively churning, not chosen.

### Integration notes (with existing config)

**`vite.config.ts`** — no plugin changes needed. `react-router` library mode is runtime-only.

**`src/sw.ts`** — keep `NavigationRoute(navHandler)` exactly as-is. It already serves `index.html` for any navigation request, which is the correct behavior for a client-side router. The SPA fallback comment on line 14-17 is already correct for both `/` and `/app`.

**Manifest `start_url`** — change in `vite.config.ts` from `/Soundly/` to `/Soundly/app`. PWA launch should go straight to the alarm shell, not the marketing page. Spec: [W3C Web App Manifest §start_url](https://www.w3.org/TR/appmanifest/#start_url-member).

**`base: '/Soundly/'`** — keep as-is. Use react-router's `basename` option:

```ts
createBrowserRouter([...routes], { basename: '/Soundly' })
```

Otherwise router-internal `<Link>` clicks will produce `/app` instead of `/Soundly/app` and the SW will fail to match its precache.

**Code-splitting** — use `lazy: () => import('./routes/LandingPage')` on the `/` route. The marketing page should NOT be in the initial bundle — alarm users on home screen launch shouldn't pay the cost. Returning PWA users hitting `/app` will skip the landing chunk entirely.

**Confidence:** HIGH. Verified via [reactrouter.com/start/modes](https://reactrouter.com/start/modes), [reactrouter.com/how-to/spa](https://reactrouter.com/how-to/spa).

---

## 2. SEO Meta Tags + JSON-LD — React 19 native, NO library

### The decision

Use **React 19's built-in metadata hoisting**. No `react-helmet-async`, no `react-schemaorg`, no `@dr.pogodin/react-helmet`.

```tsx
// In LandingPage.tsx
export default function LandingPage() {
  return (
    <>
      <title>Soundly — A Gentle Alarm That Wakes You Calmly</title>
      <meta name="description" content="..." />
      <meta property="og:title" content="..." />
      <meta property="og:image" content="https://.../og.png" />
      <meta name="twitter:card" content="summary_large_image" />
      <link rel="canonical" href="https://.../Soundly/" />
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Soundly",
          // ...
        })}
      </script>
      {/* page content */}
    </>
  );
}
```

React 19 (the v1.0 baseline) auto-hoists `<title>`, `<meta>`, `<link>`, and `<script>` tags rendered anywhere in the tree to `<head>`. No provider, no portal, no library.

### Why no library

| Option | Why not |
|--------|---------|
| `react-helmet-async` | Original maintainer abandoned React 19 support ([staylor/react-helmet-async#239](https://github.com/staylor/react-helmet-async/issues/239)). Community fork `@dr.pogodin/react-helmet` 3.x detects React 19 at runtime and becomes a no-op passthrough — i.e. it adds zero value and ~5 KB of dead code on a React 19 app. |
| `react-schemaorg` | Provides typed JSON-LD wrappers. Single landing page with one `WebApplication` schema doesn't justify a typed library — it's ~30 lines of object literal + `JSON.stringify`. The TypeScript type for the schema can come from the free [`schema-dts`](https://github.com/google/schema-dts) types package as a dev dependency if wanted (no runtime cost). |
| Manual `document.head.appendChild` in `useEffect` | Works but loses SSR/hydration correctness. React 19 native handling does this for you and is the documented path. |

### Per-route metadata pattern

The alarm app shell at `/app` does NOT need indexable metadata (it's the running app, not a marketing page) but should still set a sensible `<title>` and `<meta name="robots" content="noindex">`. Each route component owns its own metadata:

```tsx
// src/routes/AppShell.tsx
<>
  <title>Soundly — Set Alarm</title>
  <meta name="robots" content="noindex" />
  {/* existing App.tsx content */}
</>
```

Returning to a different route automatically replaces hoisted tags.

### What about Open Graph image generation?

Generate a single static OG image (1200×630 PNG) once and ship it in `public/og-image.png`. Reference it via `<meta property="og:image">`. No need for runtime OG generators (`@vercel/og`, `satori`) — Soundly has one shareable URL, not per-content cards.

**Confidence:** HIGH. Verified via [react.dev/reference/react-dom/components/meta](https://react.dev/reference/react-dom/components/meta), [react.dev v19 release post](https://react.dev/blog/2024/12/05/react-19), `react-helmet-async` issue tracker.

---

## 3. Sitemap.xml + robots.txt — `vite-plugin-sitemap`

### The decision

```bash
npm install -D vite-plugin-sitemap
```

```ts
// vite.config.ts
import Sitemap from 'vite-plugin-sitemap'

plugins: [
  // ...existing plugins
  Sitemap({
    hostname: 'https://toreinarenne.github.io/Soundly',
    dynamicRoutes: ['/', '/app'],
    generateRobotsTxt: true,
    robots: [
      { userAgent: '*', allow: '/', disallow: ['/app'] },
    ],
    exclude: ['/app'], // app shell is noindex
  }),
]
```

### Why this plugin (vs alternatives)

| Plugin | Verdict |
|--------|---------|
| **`vite-plugin-sitemap`** ([npm](https://www.npmjs.com/package/vite-plugin-sitemap)) ✅ | Single-purpose, generates both `sitemap.xml` and `robots.txt`, supports `exclude` and `dynamicRoutes`. Plays well with vite-plugin-pwa because it writes files into `dist/` *after* the Vite build but *before* the PWA plugin's precache manifest is finalized — both files end up in the precache (which is what we want — `sitemap.xml` should be served offline too for crawler resilience). |
| `vite-plugin-pages-sitemap` | Requires `vite-plugin-pages` (file-based routing). We're using `react-router` library mode, not file-based. Wrong tool. |
| `BrowserUX SEO Files` | Newer, smaller community, fewer downloads. Functional but `vite-plugin-sitemap` is the more established pick. |
| Manual static `public/sitemap.xml` + `public/robots.txt` | Acceptable fallback (and what we'd do if the plugin breaks on a future Vite version). With only two routes the maintenance cost is near-zero. **Recommended fallback if `vite-plugin-sitemap` introduces friction.** |

### Integration with vite-plugin-pwa precache

vite-plugin-pwa's Workbox precache only includes `js`, `css`, and `html` by default ([docs](https://vite-pwa-org.netlify.app/guide/service-worker-precache)). `sitemap.xml` and `robots.txt` are NOT precached out of the box, which is fine — search crawlers fetch them over the network on the indexable origin, not via the SW. No config change needed.

**Confidence:** MEDIUM-HIGH. Plugin is established but I could not verify the exact latest version number via npm registry (web access denied for npmjs.com page in this session). Verify with `npm show vite-plugin-sitemap version` before installing — expected `^0.7` or `^0.8` based on release cadence.

---

## 4. Drag-and-Drop Segment Reorder — Two viable picks

The Custom Mode UI needs to let users reorder segments in their alarm composition. This is the only v2.0 addition where two libraries are genuinely competitive.

### Pick A (PREFERRED): `motion` library `Reorder` component

```bash
npm install motion
```

```tsx
import { Reorder } from 'motion/react'

<Reorder.Group axis="y" values={segments} onReorder={setSegments}>
  {segments.map((seg) => (
    <Reorder.Item key={seg.id} value={seg}>
      {/* segment row UI */}
    </Reorder.Item>
  ))}
</Reorder.Group>
```

**Pros:**

- Trivially simple API — fits the v2.0 segment list (single column, vertical reorder, no cross-list dragging).
- Same library covers route transitions, segment add/remove animations, and the zen-aesthetic micro-interactions PROJECT.md calls for. Buying drag-and-drop and animations from one dep is a strict win.
- Lightweight when used with `LazyMotion` + `domAnimation` features — ~15 KB gzip total ([Motion docs upgrade guide](https://www.framer.com/motion/guide-upgrade/)).
- Active development; Framer Motion was rebranded to `motion` (npm package `motion`, import `motion/react`) in 2025 ([motion.dev](https://motion.dev/)). API is identical; v1.0 STACK already lists `framer-motion` as optional, so this is a name update rather than a new dep.

**Cons:**

- No multi-row, no cross-list dragging, no scrollable container support. **All N/A for this milestone** — segments are a flat vertical list.
- If Soundly later needs richer DnD (e.g. dragging segments between presets), would need to migrate. Low risk given v2.0 scope.

### Pick B (FALLBACK): `@dnd-kit/core` + `@dnd-kit/sortable`

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Pros:**

- Industry-standard React DnD; recommended by Motion's own docs for use cases beyond simple reordering.
- ~10 KB gzip combined (smaller than Motion if Motion is not already in the bundle).
- Excellent accessibility (keyboard reorder, screen reader announcements) baked in — Soundly's calm UX brand benefits.
- Stable 6.x API with React 19 fixes ([clauderic/dnd-kit releases](https://github.com/clauderic/dnd-kit/releases)).

**Cons:**

- Three packages to install. More API surface than needed for a single-column reorder.
- No animation primitives — would still need CSS transitions or Motion for the "bowl of jello" feel during drag.

**DO NOT USE `@dnd-kit/react` 0.x.** This is the in-progress next-gen rewrite from the same author (current 0.4.0). Pre-1.0, churning API, smaller community. The stable 6.x line (`@dnd-kit/core` + `@dnd-kit/sortable`) is the production pick.

### Recommendation

**Use Motion `Reorder`** unless the design phase reveals a need for keyboard-accessible reorder (in which case switch to dnd-kit, which has better a11y out of the box). For a touch-first PWA on mobile, Motion's pointer-driven Reorder is the natural fit and reuses the animation dep we'd add anyway for landing-page scroll animations and route transitions.

### What about `react-dnd` and `react-beautiful-dnd`?

- **`react-dnd`** — Architectural mismatch (HTML5 drag API based, awkward on touch, requires backend providers). React 19 support has been [open since early 2025](https://github.com/react-dnd/react-dnd/issues/3655). Not chosen.
- **`react-beautiful-dnd`** — Officially deprecated by Atlassian in 2024. Replaced by `@atlaskit/pragmatic-drag-and-drop`, which is excellent but heavier than needed here.

**Confidence:** MEDIUM. Both Motion and dnd-kit are valid; the pick depends on whether Motion is adopted for animations elsewhere. I lean Motion to keep the dep count low.

---

## 5. Marketing Landing Page — No new framework

The landing page is a single React route. It does NOT need:

- Astro, Next.js, Remix, vite-ssg, or any SSG/SSR pipeline. The crawler benefit of pre-rendered HTML is real but marginal at the scale of one indexable URL — modern Googlebot fully renders JS ([web.dev/javascript-and-google-search](https://web.dev/articles/javascript-and-google-search-io-2019)). React 19's native metadata is in the rendered HTML, which is what crawlers see after rendering.
- A CMS (Contentful, Sanity, Payload). The page is static copy. Hardcode it as a TSX component.
- A landing-page component library (Once UI, Aceternity UI, Magic UI). Tailwind v4 already supplies the design tokens and the existing zen palette. Custom-build the page in ~200 lines of TSX to match the rest of the app's aesthetic exactly.

### What goes in `public/` for the landing

- `og-image.png` (1200×630, theme-matched)
- `screenshots/` — Soundly app screenshots referenced from the landing
- `favicon.ico`, `apple-touch-icon.png` (already present)
- `robots.txt`, `sitemap.xml` (generated — see §3)

These files are served directly by Vite's static handler and end up in the SW precache automatically because vite-plugin-pwa scans `dist/` after build.

---

## 6. Triangle Sound — No new dependency

Synthesized via the existing Web Audio API code path (`OscillatorNode` + sharp attack envelope on `GainNode`). Singing-bowl synth code already in v1.0 is the template — triangle is simpler (single fundamental, faster decay). **Zero new deps.**

---

## Updated `vite.config.ts` (v2.0 target shape)

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import Sitemap from 'vite-plugin-sitemap'

export default defineConfig({
  base: '/Soundly/',
  plugins: [
    react(),
    tailwindcss(),
    Sitemap({
      hostname: 'https://toreinarenne.github.io/Soundly',
      dynamicRoutes: ['/'],   // /app is excluded (noindex)
      exclude: ['/app'],
      generateRobotsTxt: true,
      robots: [{ userAgent: '*', allow: '/', disallow: ['/app'] }],
    }),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      manifest: {
        name: 'Soundly Gentle Alarm',
        short_name: 'Soundly',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f4f1eb',
        theme_color: '#5c6b56',
        start_url: '/Soundly/app',  // ← changed from /Soundly/ — PWA launches into the app, not landing
        icons: [
          { src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512x512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
})
```

`src/sw.ts` is unchanged. `NavigationRoute(createHandlerBoundToURL('/Soundly/index.html'))` correctly serves the SPA shell for both `/` and `/app`.

---

## Updated `package.json` deltas

```jsonc
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.14.0",       // NEW
    "motion": "^12.0.0"              // NEW (only if using Motion Reorder; else: "@dnd-kit/core" + "@dnd-kit/sortable" + "@dnd-kit/utilities")
  },
  "devDependencies": {
    // ... existing
    "vite-plugin-sitemap": "^0.8.0", // NEW
    "schema-dts": "^1.1.5"           // NEW (optional — typed JSON-LD)
  }
}
```

**Verify before installing** (web access to npmjs.com was denied during research; versions are best-effort from search results):

```bash
npm show react-router version          # expect 7.14.x
npm show motion version                # expect 12.x
npm show vite-plugin-sitemap version   # expect 0.7.x or 0.8.x
npm show vite-plugin-pwa version       # confirm whether to bump from 0.21.1 to 1.2.0
```

`vite-plugin-pwa` 1.2.0 is now stable (vs 0.21.1 currently installed). **Don't bump as part of this milestone** — the upgrade is orthogonal to v2.0 features and risks regressing hard-won `injectManifest` behavior validated in Phase 4. Defer to a separate "deps maintenance" task.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| `react-router` v7 library mode is correct routing pick | HIGH | Verified via reactrouter.com docs; v6→v7 non-breaking; library mode designed exactly for this case. |
| TanStack Router rejection | HIGH | Type-safe routing has zero value on a 2-route app; codegen plugin adds friction. |
| React 19 native metadata replaces helmet libraries | HIGH | Verified via react.dev meta reference + react-helmet-async maintainer abandonment. |
| `vite-plugin-sitemap` is the canonical pick | MEDIUM-HIGH | Plugin works; minor uncertainty on exact latest version number — verify with `npm show` before install. |
| Motion Reorder vs dnd-kit pick | MEDIUM | Both work. Motion if animations are also adopted; dnd-kit if a11y is a hard requirement. Decision deferrable to UI design phase. |
| Single SPA bundle with two routes is best architecture | HIGH | Multi-entry Vite has known dev-server issues; static landing fights the SW NavigationRoute. |
| `start_url` change to `/Soundly/app` | HIGH | Standard PWA pattern: `start_url` reflects user intent on app launch (alarm), not first-time discovery (landing). |
| GitHub Pages base path stays `/Soundly/` | HIGH | No reason to change it for v2.0; routing must use `basename: '/Soundly'`. |
| No SSG needed for SEO | MEDIUM-HIGH | Modern Googlebot renders JS reliably for static-rendered SPAs with proper metadata. Ranking ceiling vs Astro/Next is a few percentage points at most for a single landing URL — not worth a stack rewrite. |

---

## Sources

- [react-router v7 — Picking a Mode (library vs framework)](https://reactrouter.com/start/modes)
- [react-router — SPA how-to](https://reactrouter.com/how-to/spa)
- [react-router — npm](https://www.npmjs.com/package/react-router) (v7.14.2 confirmed via search)
- [TanStack Router releases](https://github.com/TanStack/router/releases) (1.169.x, very active)
- [React 19 — `<meta>` reference](https://react.dev/reference/react-dom/components/meta)
- [React 19 release blog post](https://react.dev/blog/2024/12/05/react-19)
- [react-helmet-async — React 19 issue (abandoned)](https://github.com/staylor/react-helmet-async/issues/239)
- [`@dr.pogodin/react-helmet` — React 19 passthrough](https://www.npmjs.com/package/@dr.pogodin/react-helmet)
- [vite-plugin-sitemap — npm](https://www.npmjs.com/package/vite-plugin-sitemap)
- [vite-plugin-pwa — Service Worker Precache](https://vite-pwa-org.netlify.app/guide/service-worker-precache)
- [vite-plugin-pwa — injectManifest config](https://vite-pwa-org.netlify.app/workbox/inject-manifest.html)
- [Motion — Reorder docs](https://motion.dev/docs/react-reorder)
- [Motion — upgrade guide (framer-motion → motion)](https://www.framer.com/motion/guide-upgrade/)
- [dnd-kit/dnd-kit — releases & React 19 compat](https://github.com/clauderic/dnd-kit/releases)
- [dnd-kit migration guide (core → react)](https://dndkit.com/react/guides/migration/)
- [Vite — Multi-page App build docs](https://vite.dev/guide/build) and [issue #17817 (MPA dev mode quirks)](https://github.com/vitejs/vite/issues/17817)
- [W3C Web App Manifest — `start_url`](https://www.w3.org/TR/appmanifest/#start_url-member)
