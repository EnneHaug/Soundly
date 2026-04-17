# Phase 4: PWA Shell - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Make Soundly installable from a browser and fully functional offline. This phase tightens the existing PWA plumbing (manifest, service worker, icons) into a complete installable package, adds Apple-specific meta tags for iOS polish, and verifies the offline story end-to-end. Most infrastructure was built in Phases 2-3 — this phase completes and validates it.

</domain>

<decisions>
## Implementation Decisions

### Service Worker Update Strategy
- **D-01:** Silent update — new service worker installs in the background and activates on next full page load. No user-facing toast, prompt, or auto-reload. Simplest approach, avoids any risk of interrupting an active alarm.

### Apple Web App Meta Tags
- **D-02:** Claude's discretion — add the appropriate set of Apple meta tags (`apple-touch-icon`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`) based on current Safari PWA support. Goal is a polished iOS home screen experience that matches the warm earth palette.

### Notification Click Routing
- **D-03:** Focus-only approach. The existing SW `notificationclick` handler (which focuses the app window or opens `/`) is sufficient. Since navigation is state-driven (Phase 3 D-01), the alarm state already determines whether the user sees the countdown or dashboard. No `postMessage` intent or URL parameter routing needed.

### Offline Caching Strategy
- **D-04:** Precache-only. Workbox `precacheAndRoute(self.__WB_MANIFEST)` in `sw.ts` caches all build assets at install time. Soundly is fully client-side with no API calls — no runtime caching strategies, offline fallback pages, or navigation routes needed.

### Claude's Discretion
- Which Apple meta tags to include and their values (D-02)
- Whether to add a Workbox `NavigationRoute` fallback to `index.html` (may be prudent even with precache-only, as a belt-and-suspenders measure for SPA navigation)
- SW registration approach — vite-plugin-pwa handles this automatically, but verify it works correctly in production build
- Any `index.html` cleanup needed (e.g., `<meta name="theme-color">`, `<link rel="manifest">` if not auto-injected)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — PLT-01 defines the acceptance criteria for this phase

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, PWA requirement, tech stack
- `CLAUDE.md` — vite-plugin-pwa configuration notes, display/orientation/color settings, icon requirements, injectManifest vs generateSW guidance

### Prior Phase Context
- `.planning/phases/02-background-reliability/02-CONTEXT.md` — Notification behavior decisions, iOS standalone detection, custom SW rationale
- `.planning/phases/03-react-ui/03-CONTEXT.md` — Warm earth palette hex values (D-04), manifest color updates (D-05), state-driven navigation (D-01)

### Existing PWA Code
- `vite.config.ts` — VitePWA plugin config with injectManifest strategy, manifest definition, icon references, devOptions
- `src/sw.ts` — Custom service worker with Workbox precaching and notificationclick handler
- `index.html` — App entry point (needs Apple meta tags added)
- `public/icons/` — Contains icon-192x192.png, icon-512x512.png, icon-512x512-maskable.png

### Existing Platform Utilities
- `src/platform/standalone.ts` — `isPwaInstalled()`, `isIosSafariNonInstalled()` (iOS install detection already built)
- `src/components/IosInstallBanner.tsx` — iOS "Add to Home Screen" prompt component (already built in Phase 3)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `VitePWA` config in `vite.config.ts` — manifest, icons, injectManifest strategy all configured
- `src/sw.ts` — custom service worker with precaching and notification click handler
- `public/icons/` — all three required icon sizes already generated
- `src/platform/standalone.ts` — iOS standalone detection utilities
- `src/components/IosInstallBanner.tsx` — iOS install prompt already in the UI

### Established Patterns
- `injectManifest` strategy chosen (Phase 2) — SW contains custom logic, not auto-generated
- Manifest colors already match warm earth palette: `background_color: '#f4f1eb'`, `theme_color: '#5c6b56'`
- State-driven navigation — no URL routes, alarm state determines screen

### Integration Points
- `index.html` — needs Apple meta tags added to `<head>`
- `src/main.tsx` — SW registration handled by vite-plugin-pwa auto-injection (verify)
- `src/sw.ts` — may need minor adjustments for update lifecycle (skipWaiting/claim behavior for silent updates)
- Build pipeline — verify `vite build` produces correct SW, manifest, and precache manifest

</code_context>

<specifics>
## Specific Ideas

- Most PWA work is already done — this phase is primarily about verification, Apple polish, and ensuring the build pipeline produces a correct installable package
- The notification click handler already focuses the window and the state-driven UI shows the right screen — success criterion 3 is essentially already met
- Silent SW updates mean no `skipWaiting()` / `clients.claim()` calls needed — natural lifecycle handles it

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-pwa-shell*
*Context gathered: 2026-04-17*
