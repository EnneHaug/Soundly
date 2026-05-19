---
phase: 10-seo-meta-json-ld-service-worker-update-infra
plan: 03
subsystem: infra
tags: [pwa, service-worker, vite-plugin-pwa, workbox, workbox-core, autoUpdate, skipWaiting, clientsClaim, seo-09]

# Dependency graph
requires:
  - phase: 10-seo-meta-json-ld-service-worker-update-infra
    provides: Plan 10-01 static SEO meta in index.html (the content this SW update infra delivers to installed users on next launch)
  - phase: 10-seo-meta-json-ld-service-worker-update-infra
    provides: Plan 10-02 robots.txt + sitemap.xml (placeholder canonical URL also resolved by the same Plan 05 deploy runbook swap)
provides:
  - SW auto-update wiring — vite.config.ts registerType: 'autoUpdate' triggers virtual:pwa-register helper at runtime
  - SW lifecycle acceleration — src/sw.ts self.skipWaiting() (install) + clientsClaim() (activate) take over all clients in /Soundly/ scope immediately on new-SW activation
  - End-to-end SEO meta delivery to installed PWA users (no manual reinstall needed for v1→v2 launch and beyond)
affects: [phase-10-04-workbox-core-pin, phase-10-05-deploy-runbook, phase-10-06-build-verification, phase-11-routing-app-rescope, phase-11-multi-page-build]

# Tech tracking
tech-stack:
  added: []  # No new package.json deps in this plan; Plan 04 Task 2 pins workbox-core as direct devDep (Q1 RESOLVED). The 'workbox-core' import resolves against the existing transitive 7.4.0 install today and against the first-party pin once Plan 04 ships.
  patterns:
    - "vite-plugin-pwa injectManifest + registerType: 'autoUpdate' compatibility (RESEARCH Finding 1 — officially supported combo)"
    - "workbox-core clientsClaim() helper variant over hand-written activate listener (RESEARCH Finding 2 — canonical idiom, wraps self.clients.claim() internally to avoid 'claim called before activation' exception)"
    - "Append-only SW edits — existing handlers preserved byte-identical per D-17 NON-NEGOTIABLE"

key-files:
  created: []
  modified:
    - vite.config.ts
    - src/sw.ts

key-decisions:
  - "Used workbox-core clientsClaim() helper (RESEARCH Finding 2) rather than CONTEXT D-17's original hand-written self.addEventListener('activate', e => e.waitUntil(self.clients.claim())) — functionally equivalent, but the helper is the literal pattern in the official vite-plugin-pwa injectManifest auto-update example and avoids the known 'claim called before activation' runtime exception of naked top-level self.clients.claim(). Both variants accepted by D-17."
  - "registerType: 'autoUpdate' inserted as the FIRST option inside VitePWA({...}) (before strategies: 'injectManifest') to surface the directive at the top of the config block. Existing keys preserved with byte-identical indentation and values."
  - "devOptions.enabled: true preserved (D-19 NON-NEGOTIABLE) — flipping it would silence the SW in dev. The documented workaround (Plan 05 deploy runbook) is manual toggle, not a Phase 10 change."
  - "SW edits placed AFTER the existing notificationclick handler (lines 44-53) so the lifecycle calls run last at module-evaluation time — matches the project's unguarded module-scope idiom (cleanupOutdatedCaches, precacheAndRoute)."

patterns-established:
  - "SW auto-update pair pattern: vite.config.ts registerType + sw.ts skipWaiting + clientsClaim must always land together (Pitfall 2 — neither alone delivers updates)"
  - "Comment block convention for cross-plan / cross-file pairing — '── Phase 10 / SEO-09 ──' banner with 8 lines of rationale documents BOTH halves of the change so a future reader doesn't accidentally remove one"

requirements-completed: [SEO-09]

# Metrics
duration: 3m 58s
completed: 2026-05-19
---

# Phase 10 Plan 03: Service Worker Auto-Update Infrastructure Summary

**vite-plugin-pwa registerType: 'autoUpdate' wired in vite.config.ts + workbox-core clientsClaim() + self.skipWaiting() appended to src/sw.ts so installed PWA users receive Plan 10-01 SEO meta on next launch without manual reinstall**

## Performance

- **Duration:** 3m 58s
- **Started:** 2026-05-19T19:51:45Z
- **Completed:** 2026-05-19T19:55:43Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- vite.config.ts: 1-line addition (`registerType: 'autoUpdate'`) — triggers vite-plugin-pwa's virtual:pwa-register helper to auto-trigger SW updates on the client side
- src/sw.ts: 1 import + 6-line comment block + 2 module-scope calls (`self.skipWaiting()` + `clientsClaim()`) — the new SW takes over all clients in `/Soundly/` scope immediately on activation
- End-to-end SEO-09 wiring: combined with Plan 10-01 static meta + Plan 10-02 sitemap, installed PWA users now receive updated `<meta>`/OG/JSON-LD on next launch (instead of seeing stale precached HTML forever)
- Build verified: `npm run build` exits 0, `dist/sw.js` (17.00 kB) and `dist/registerSW.js` (0.15 kB) both emitted, 70 modules transformed clean
- Full test suite verified: 575/575 passing across 42 test files (zero regression)
- SEG-05 v1 byte-identical floor preserved across all 26 protected paths (no v1 engine/hook/component touched)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add registerType: 'autoUpdate' to vite.config.ts VitePWA block** — `6e1b2bf` (feat)
2. **Task 2: Append skipWaiting + clientsClaim to src/sw.ts** — `ed7feca` (feat)

**Plan metadata commit:** (to follow this SUMMARY)

## The Two Diffs

### `vite.config.ts` (1-line addition, +1/-0)

```diff
     VitePWA({
+      registerType: 'autoUpdate',  // SEO-09 / D-16: client-side auto-update directive
       strategies: 'injectManifest',
       srcDir: 'src',
       filename: 'sw.ts',
       manifest: { ... },
       devOptions: {
         enabled: true,           // D-19 PRESERVED
         type: 'module',
       },
     }),
```

### `src/sw.ts` (1 import + 10-line append, +12/-0)

```diff
 import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
 import { NavigationRoute, registerRoute } from 'workbox-routing';
+import { clientsClaim } from 'workbox-core';

 ... (lines 7-42 unchanged: declare self, cleanupOutdatedCaches, precacheAndRoute,
      navHandler/NavigationRoute, notificationclick handler — ALL byte-identical)

 self.addEventListener('notificationclick', (event) => { ... });
+
+// ─── Phase 10 / SEO-09 — Service worker auto-update ───────────────────
+// Take control of the page immediately on activation so installed PWA
+// users receive updated meta + content on next launch without manual
+// reload. Combined with `registerType: 'autoUpdate'` in vite.config.ts.
+// `clientsClaim()` from workbox-core wraps self.clients.claim() in the
+// correct activate-event listener internally — avoids the "claim called
+// before activation" runtime exception that naked self.clients.claim()
+// at top-level produces. See workbox-core docs + RESEARCH Finding 2.
+self.skipWaiting();
+clientsClaim();
```

## Files Created/Modified

- `vite.config.ts` — Added `registerType: 'autoUpdate'` as the first option inside the `VitePWA({...})` block (line 12). All other keys (`strategies: 'injectManifest'`, `srcDir`, `filename`, `manifest`, `devOptions.enabled: true`, the 3 icon entries) preserved byte-identical at the same string values, just shifted down 1 line.
- `src/sw.ts` — Added `import { clientsClaim } from 'workbox-core';` (line 5) and appended `self.skipWaiting();` + `clientsClaim();` at module scope (lines 52-53) AFTER the existing notificationclick handler. All 5 existing handlers/calls preserved byte-identical: `cleanupOutdatedCaches()`, `precacheAndRoute(self.__WB_MANIFEST)`, `createHandlerBoundToURL('/Soundly/index.html')` + `NavigationRoute(navHandler)`, `self.addEventListener('notificationclick', ...)`, and the `declare let self: ServiceWorkerGlobalScope;` line.

## Decisions Made

- **workbox-core helper variant over hand-written activate listener:** CONTEXT D-17 originally specified `self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))`. RESEARCH Finding 2 (post-CONTEXT) confirmed that `clientsClaim()` from `workbox-core` is the canonical vite-plugin-pwa injectManifest auto-update idiom AND safer (the helper wraps `self.clients.claim()` in the correct activate-event listener internally; naked top-level `self.clients.claim()` produces a "claim called before activation" runtime exception). The plan's `must_haves.truths` and Task 2 `<action>` both adopt the helper variant. Both forms are functionally equivalent; the helper saves 3 lines and matches the official example.
- **Insert order — registerType FIRST in VitePWA({...}):** Plan-mandated placement so the auto-update directive surfaces at the top of the SW config block. Pure stylistic choice; the option's semantics are order-independent.
- **`workbox-core` import resolution under transitive resolution (today) vs Plan 04 pin (next plan):** Plan 04 Task 2 will land `workbox-core` as a DIRECT devDep pinned at `^7.4.0` (Q1 RESOLVED in plan frontmatter). Today the import resolves transitively via `vite-plugin-pwa → workbox-build → workbox-core@7.4.0` (confirmed by inspecting `node_modules/workbox-core/package.json` showing 7.4.0). Build passes and tests pass either way; Plan 04's pin protects against future `vite-plugin-pwa` minor-version upgrades silently dropping the transitive.

## Deviations from Plan

None — plan executed exactly as written.

The Task 2 plan body explicitly described the workbox-core helper variant as the implemented approach (overriding CONTEXT D-17's original hand-written activate listener) — both forms accepted by D-17, and the plan locked in the helper before execution started. Not a deviation; it was the spec.

## Issues Encountered

None.

## Pitfall 2 Lesson — Both Changes Must Land Together

The CONTEXT and plan repeatedly call out Pitfall 2: neither half of the SW auto-update wiring is sufficient on its own.

- `registerType: 'autoUpdate'` WITHOUT `skipWaiting + clientsClaim` → new SW installs in background but waits forever for ALL tabs to close before activating. Installed iOS PWA users especially never close all tabs, so they never see the update.
- `skipWaiting + clientsClaim` WITHOUT `registerType: 'autoUpdate'` → the page never auto-triggers an update check, so the new SW never even starts installing in the first place.

Phase 10 Plan 03 ships BOTH atomic commits (`6e1b2bf` + `ed7feca`) in a single plan execution to enforce this co-shipment guarantee.

## Cross-Reference: End-to-End Verification (Plan 05)

Per RESEARCH Finding 10, the full SW update behavior is NOT unit-testable (jsdom doesn't implement `ServiceWorkerGlobalScope`). End-to-end verification happens via the Plan 05 deploy runbook smoke test:

1. Build + deploy v1 (Plan 10-01 + 10-02 + this plan committed)
2. Install the v1 PWA on a device (Add to Home Screen)
3. Bump version + redeploy v2 (e.g., trivial meta change)
4. Reopen the installed PWA from the home-screen icon (not via browser)
5. CONFIRM the v2 meta is in effect (e.g., `<title>` reflects the v2 string)

If step 5 still shows v1 meta, the auto-update infra has regressed and Plan 10-03's commits should be reviewed.

## Cross-Reference: workbox-core Direct Pin (Plan 04)

Plan 10-04 Task 2 lands `workbox-core: ^7.4.0` as a DIRECT devDep in `package.json`. After Plan 04 ships, this plan's `import { clientsClaim } from 'workbox-core'` line will resolve against the first-party pin instead of the transitive chain. The plan's threat model T-10-03-07 (Tampering / workbox-core transitive-dep drift) is fully mitigated only after Plan 04 ships.

## Next Phase Readiness

- Plan 10-04 (workbox-core direct pin) — UNBLOCKED, recommended next
- Plan 10-05 (deploy runbook + canonical URL swap) — UNBLOCKED
- Plan 10-06 (build verification + SW bundle audit) — UNBLOCKED
- Phase 11 (multi-page split + landing page + SW rescope to `/app`) — no new dependency; this plan's auto-update infra carries forward unchanged into Phase 11's rescoped SW

## Self-Check: PASSED

- FOUND: vite.config.ts (modified, contains `registerType: 'autoUpdate'`)
- FOUND: src/sw.ts (modified, contains `import { clientsClaim } from 'workbox-core'`, `self.skipWaiting()`, `clientsClaim()`)
- FOUND: commit 6e1b2bf (Task 1)
- FOUND: commit ed7feca (Task 2)

---
*Phase: 10-seo-meta-json-ld-service-worker-update-infra*
*Completed: 2026-05-19*
