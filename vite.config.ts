import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: '/Soundly/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',  // SEO-09 / D-16: client-side auto-update directive
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      manifest: {
        // D-LAND-17 (Phase 11) — explicit identity preserves v1.0/v2.0 install association
        // across the start_url narrow. NEVER change this string; doing so would re-orphan
        // every installed PWA. See RESEARCH Finding 4 / Q6.
        id: '/Soundly/',
        name: 'Soundly Gentle Alarm',
        short_name: 'Soundly',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f4f1eb',
        theme_color: '#5c6b56',
        start_url: '/Soundly/app/', // CHANGED in Phase 11 — installed users launch into the app shell (LAND-02)
        scope: '/Soundly/app/', // NEW in Phase 11 — narrows installable PWA scope to /app/ (LAND-06)
        icons: [
          { src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512x512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Phase 11 / Pitfall B — narrow precache to app/** only.
      // Landing (/Soundly/index.html, og-image, screenshot, sitemap, robots) is
      // served from network per LAND-02 + D-LAND-15, not precached by the SW.
      // COUPLING (Pitfall A): These manifest changes (id + scope + start_url) MUST
      // ship in the SAME deploy as Plan 11-04's SW rescoping. Splitting them across
      // deploys leaves installed users on stale precached /Soundly/index.html.
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
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  // Phase 11 / LAND-06 — multi-page build emits two HTML entries:
  //   dist/index.html (hand-authored static landing — populated by Plan 11-02)
  //   dist/app/index.html (React app shell — populated by Plan 11-03)
  // Vite ignores the object key names ('main', 'app') and uses the resolved
  // file path, so the dist/ structure mirrors the source. See RESEARCH Finding 1.
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app/index.html'),
      },
    },
  },
})
