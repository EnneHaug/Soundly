/**
 * Static-asset SEO + SW verification (Phase 10 / SEO-01..09).
 *
 * Source-level regex + JSON.parse + DOMParser assertions on the files
 * shipped by Plans 10-01 through 10-04. These tests run via `npm run test`
 * alongside the existing 575-test suite — they read the source files at
 * the repo root and verify each requirement ID end-to-end.
 *
 * Vitest env: jsdom (per vitest.config.ts) — DOMParser is in scope.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '..');
const read = (relPath: string) =>
  readFileSync(resolve(repoRoot, relPath), 'utf8');

// ─── SEO-01..05: index.html static SEO meta ──────────────────────────
describe('index.html SEO meta (SEO-01..05)', () => {
  const html = read('index.html');

  it('SEO-01: has the locked <title> (D-01)', () => {
    expect(html).toMatch(/<title>Soundly — a calmer alarm that alerts you gently<\/title>/);
  });

  it('SEO-01: has the locked <meta name="description"> (D-02)', () => {
    expect(html).toMatch(
      /<meta\s+name="description"\s+content="A free alarm app with soft sounds, vibration, or full volume — fully customizable\. No accounts, no ads\. Just share your setup\. PWA — installs anywhere\."\s*\/>/
    );
  });

  it('SEO-02: has all 5 Open Graph tags (D-03/D-04)', () => {
    expect(html).toMatch(/<meta\s+property="og:type"\s+content="website"/);
    expect(html).toMatch(/<meta\s+property="og:title"\s+content="Soundly — gentle alarm"/);
    expect(html).toMatch(/<meta\s+property="og:description"\s+content="A free alarm app with soft sounds or vibration or full volume/);
    expect(html).toMatch(/<meta\s+property="og:image"\s+content="https:\/\/[^"]+\/og-image-v1\.png"/);
    expect(html).toMatch(/<meta\s+property="og:url"\s+content="https:\/\/[^"]+"/);
  });

  it('SEO-03: has Twitter summary_large_image card (D-05)', () => {
    expect(html).toMatch(/<meta\s+name="twitter:card"\s+content="summary_large_image"/);
    expect(html).toMatch(/<meta\s+name="twitter:title"\s+content="Soundly — gentle alarm"/);
    expect(html).toMatch(/<meta\s+name="twitter:description"/);
    expect(html).toMatch(/<meta\s+name="twitter:image"/);
  });

  it('SEO-05: has rel="canonical" link', () => {
    expect(html).toMatch(/<link\s+rel="canonical"\s+href="https:\/\/[^"]+"/);
  });

  it('SEO-04: contains a parseable JSON-LD WebApplication block (D-12)', () => {
    const match = html.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const parsed = JSON.parse(match![1]);
    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@type']).toBe('WebApplication');
    expect(parsed['name']).toBe('Soundly Gentle Alarm');
    expect(parsed['applicationCategory']).toBe('UtilitiesApplication');
    expect(parsed['operatingSystem']).toBe('Web Browser');
    expect(parsed['description']).toBeTruthy();
    expect(parsed['url']).toMatch(/^https:\/\//);
  });

  it('SEO-04: JSON-LD does NOT include aggregateRating (D-13 — Google manual-action risk)', () => {
    const match = html.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const parsed = JSON.parse(match![1]);
    expect(parsed['aggregateRating']).toBeUndefined();
    expect(parsed['offers']).toBeUndefined();
  });
});

// ─── D-26: preservation of base charset/viewport/theme-color on LANDING ─
// (Phase 11 / Finding 9 / Pitfall G — the apple-* tags MOVED to app/index.html;
// the landing is not installable on its own so it only keeps the base meta.)
describe('index.html preserved tags (D-26 — Phase 11 landing variant)', () => {
  const html = read('index.html');

  it('preserves charset meta tag', () => {
    expect(html).toMatch(/<meta\s+charset="UTF-8"/);
  });

  it('preserves viewport meta tag', () => {
    expect(html).toMatch(/<meta\s+name="viewport"/);
  });

  it('preserves theme-color meta tag (sage #5c6b56)', () => {
    expect(html).toMatch(/<meta\s+name="theme-color"\s+content="#5c6b56"/);
  });

  it('Phase 11 — landing does NOT carry apple-* meta tags (those MOVED to app/index.html per Finding 9 / Pitfall G)', () => {
    expect(html).not.toMatch(/<meta\s+name="apple-mobile-web-app-capable"/);
    expect(html).not.toMatch(/<meta\s+name="apple-mobile-web-app-status-bar-style"/);
    expect(html).not.toMatch(/<meta\s+name="apple-mobile-web-app-title"/);
    expect(html).not.toMatch(/<link\s+rel="apple-touch-icon"/);
  });
});

// ─── SEO-06: public/robots.txt ───────────────────────────────────────
describe('public/robots.txt (SEO-06)', () => {
  const robots = read('public/robots.txt');

  it('contains User-agent + Allow + Sitemap lines per D-20', () => {
    expect(robots).toMatch(/^User-agent:\s+\*$/m);
    expect(robots).toMatch(/^Allow:\s+\/$/m);
    expect(robots).toMatch(/^Sitemap:\s+https:\/\/\S+\/sitemap\.xml$/m);
  });

  it('does NOT contain Disallow directives (no private paths to hide)', () => {
    expect(robots).not.toMatch(/^Disallow:/m);
  });
});

// ─── SEO-07: public/sitemap.xml ──────────────────────────────────────
describe('public/sitemap.xml (SEO-07)', () => {
  const xml = read('public/sitemap.xml');

  it('starts with XML declaration', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it('uses the sitemaps.org v0.9 namespace', () => {
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  });

  it('parses as well-formed XML via DOMParser', () => {
    // vitest env = jsdom; DOMParser is global
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const parseError = doc.querySelector('parsererror');
    expect(parseError).toBeNull();
    expect(doc.documentElement.tagName).toBe('urlset');
  });

  it('lists exactly 2 <url> entries (landing + /app deep link per D-21)', () => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const urls = doc.querySelectorAll('url');
    expect(urls.length).toBe(2);
  });

  it('first <loc> is the landing URL, second is /app/ forward-compat (D-21)', () => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const locs = [...doc.querySelectorAll('loc')].map((el) => el.textContent);
    expect(locs[0]).toMatch(/^https:\/\/[^/]+\/Soundly\/$/);
    expect(locs[1]).toMatch(/^https:\/\/[^/]+\/Soundly\/app\/$/);
  });
});

// ─── SEO-02 + SEO-08: OG image asset ─────────────────────────────────
describe('public/og-image-v1.png (SEO-02, SEO-08)', () => {
  const imagePath = resolve(repoRoot, 'public/og-image-v1.png');

  it('exists with versioned filename (D-10 / SEO-08)', () => {
    expect(existsSync(imagePath)).toBe(true);
  });

  it('is ≤ 200 KB (SEO-02 cap)', () => {
    const size = statSync(imagePath).size;
    expect(size).toBeLessThanOrEqual(204800);  // 200 KB = 204800 bytes
    expect(size).toBeGreaterThan(1000);         // sanity: not a stub
  });

  it('is a valid PNG file (header byte check)', () => {
    const buf = readFileSync(imagePath);
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
  });
});

// ─── SEO-09 (source-regex tier): src/sw.ts ───────────────────────────
describe('src/sw.ts has SEO-09 update calls', () => {
  const sw = read('src/sw.ts');

  it('imports clientsClaim from workbox-core', () => {
    expect(sw).toMatch(/import\s+\{\s*clientsClaim\s*\}\s+from\s+['"]workbox-core['"]/);
  });

  it('calls self.skipWaiting() at module scope', () => {
    expect(sw).toMatch(/\bself\.skipWaiting\(\)/);
  });

  it('calls clientsClaim() at module scope', () => {
    expect(sw).toMatch(/\bclientsClaim\(\)/);
  });

  it('preserves the existing cleanupOutdatedCaches call (D-17)', () => {
    expect(sw).toMatch(/cleanupOutdatedCaches\(\)/);
  });

  it('preserves the existing precacheAndRoute call (D-17)', () => {
    expect(sw).toMatch(/precacheAndRoute\(self\.__WB_MANIFEST\)/);
  });

  it('Phase 11 — NavigationRoute narrowed to /Soundly/app/ with allowlist (LAND-02)', () => {
    expect(sw).toMatch(/createHandlerBoundToURL\('\/Soundly\/app\/index\.html'\)/);
    // Allowlist regex MUST include the ^ anchor (Plan 11-04 threat T-11-04-03 mitigation)
    expect(sw).toMatch(/allowlist:\s*\[\s*\/\^\\\/Soundly\\\/app\\\/\/\s*\]/);
  });

  it('Phase 11 — notificationclick openWindow targets /Soundly/app/', () => {
    expect(sw).toMatch(/openWindow\('\/Soundly\/app\/'\)/);
  });

  it('preserves the existing notificationclick handler (D-17)', () => {
    expect(sw).toMatch(/self\.addEventListener\('notificationclick'/);
  });
});

// ─── SEO-09 (source-regex tier): vite.config.ts ──────────────────────
describe('vite.config.ts has SEO-09 registerType', () => {
  const cfg = read('vite.config.ts');

  it('sets registerType to autoUpdate (D-16)', () => {
    expect(cfg).toMatch(/registerType:\s*['"]autoUpdate['"]/);
  });

  it('preserves strategies: injectManifest', () => {
    expect(cfg).toMatch(/strategies:\s*['"]injectManifest['"]/);
  });

  it('preserves devOptions.enabled: true (D-19 LOCKED)', () => {
    expect(cfg).toMatch(/devOptions:\s*\{\s*enabled:\s*true/);
  });

  it('preserves base: /Soundly/ (project base path)', () => {
    expect(cfg).toMatch(/base:\s*['"]\/Soundly\/['"]/);
  });

  it('Phase 11 — manifest.start_url narrowed to /Soundly/app/ (LAND-02)', () => {
    expect(cfg).toMatch(/start_url:\s*['"]\/Soundly\/app\/['"]/);
  });

  it('Phase 11 — manifest.scope narrowed to /Soundly/app/ (LAND-02)', () => {
    expect(cfg).toMatch(/scope:\s*['"]\/Soundly\/app\/['"]/);
  });

  it('Phase 11 — manifest.id is /Soundly/ for install-identity continuity (D-LAND-17, Finding 4)', () => {
    expect(cfg).toMatch(/id:\s*['"]\/Soundly\/['"]/);
  });

  it('Phase 11 — rollupOptions.input has both main and app entries (LAND-06)', () => {
    expect(cfg).toMatch(/main:\s*resolve\(__dirname,\s*['"]index\.html['"]\)/);
    expect(cfg).toMatch(/app:\s*resolve\(__dirname,\s*['"]app\/index\.html['"]\)/);
  });

  it('Phase 11 — injectManifest.globPatterns scoped to app/** (Pitfall B)', () => {
    expect(cfg).toMatch(/globPatterns:\s*\[\s*['"]app\/\*\*/);
  });
});

// ─── Cross-file placeholder consistency (D-23 + Phase 11 split per Pitfall G) ──
describe('placeholder canonical URL consistency (D-23 + Phase 11 split)', () => {
  it('landing keeps bare /Soundly/ placeholder', () => {
    const placeholder = 'https://soundly.local/Soundly/';
    expect(read('index.html')).toContain(placeholder);
    expect(read('public/robots.txt')).toContain(placeholder);
    expect(read('public/sitemap.xml')).toContain(placeholder);
  });

  it('Phase 11 — app shell uses /Soundly/app/ placeholder for its canonical', () => {
    expect(read('app/index.html')).toContain('https://soundly.local/Soundly/app/');
  });
});

// ─── Phase 11: app shell SEO meta (mirrors landing structure with /Soundly/app/ URLs) ──
describe('app/index.html SEO meta (Phase 11)', () => {
  const html = read('app/index.html');

  it('has the locked <title>', () => {
    expect(html).toMatch(/<title>Soundly — a calmer alarm that alerts you gently<\/title>/);
  });

  it('has the locked <meta name="description">', () => {
    expect(html).toMatch(
      /<meta\s+name="description"\s+content="A free alarm app with soft sounds, vibration, or full volume — fully customizable\. No accounts, no ads\. Just share your setup\. PWA — installs anywhere\."\s*\/>/
    );
  });

  it('has canonical pointing to /Soundly/app/', () => {
    expect(html).toMatch(/<link\s+rel="canonical"\s+href="https:\/\/[^"]+\/Soundly\/app\/"/);
  });

  it('has og:url pointing to /Soundly/app/', () => {
    expect(html).toMatch(/<meta\s+property="og:url"\s+content="https:\/\/[^"]+\/Soundly\/app\/"/);
  });

  it('has Twitter summary_large_image card', () => {
    expect(html).toMatch(/<meta\s+name="twitter:card"\s+content="summary_large_image"/);
  });

  it('contains a parseable JSON-LD WebApplication block with url ending in /Soundly/app/', () => {
    const match = html.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const parsed = JSON.parse(match![1]);
    expect(parsed['@type']).toBe('WebApplication');
    expect(parsed['url']).toMatch(/\/Soundly\/app\/$/);
  });
});

// ─── Phase 11: D-26 apple-* meta MOVED from root index.html to app/index.html ──
describe('app/index.html preserved tags (D-26 moved to app shell in Phase 11)', () => {
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

  it('preserves charset / viewport / theme-color', () => {
    expect(html).toMatch(/<meta\s+charset="UTF-8"/);
    expect(html).toMatch(/<meta\s+name="viewport"/);
    expect(html).toMatch(/<meta\s+name="theme-color"\s+content="#5c6b56"/);
  });
});

// ─── Phase 11: landing page structure (LAND-01..05 + UI-SPEC A11y) ──
describe('index.html landing page (Phase 11)', () => {
  const html = read('index.html');

  it('has lang="en" attribute (Lighthouse SEO + WCAG 3.1.1)', () => {
    expect(html).toMatch(/<html\s+lang="en"/);
  });

  it('LAND-03 — has install button placeholder hidden by default', () => {
    expect(html).toMatch(/<button[^>]+id="install-btn"[^>]+hidden/);
  });

  it('LAND-03 — has iOS install <details> panel hidden by default', () => {
    expect(html).toMatch(/<details[^>]+id="ios-install-panel"[^>]+hidden/);
    expect(html).toMatch(/<summary>Install on iPhone<\/summary>/);
  });

  it('LAND-03 — has install-confirm hidden by default (D-LAND-07)', () => {
    expect(html).toMatch(/id="install-confirm"[^>]+hidden/);
  });

  it('LAND-03 — install-cta container has aria-live="polite" (UI-SPEC A11y)', () => {
    expect(html).toMatch(/id="install-cta"[^>]*aria-live="polite"/);
  });

  it('LAND-03 — iOS detection includes navigator.maxTouchPoints check (Finding 6 iPadOS 13+ fix)', () => {
    expect(html).toMatch(/navigator\.maxTouchPoints\s*>\s*1/);
  });

  it('LAND-03 — post-install redirect uses literal /Soundly/app/ (Pitfall C — JS strings not Vite-rewritten)', () => {
    expect(html).toMatch(/window\.location\.href\s*=\s*['"]\/Soundly\/app\/['"]/);
  });

  it('LAND-01 — hero h1 has verbatim D-LAND-01 copy', () => {
    expect(html).toMatch(/<h1>A calmer alarm that alerts you gently<\/h1>/);
  });

  it('LAND-04 — FAQ section uses plain h3 + p (NO FAQPage JSON-LD)', () => {
    expect(html).not.toMatch(/"@type":\s*"FAQPage"/);
    expect(html).toMatch(/<section[^>]+class="faq"/);
  });

  it('LAND-05 — iOS honesty section has >= 2 paragraphs (D-LAND-04 two-paragraph structure)', () => {
    const match = html.match(/<section[^>]+class="ios-honesty"[\s\S]*?<\/section>/);
    expect(match).not.toBeNull();
    expect((match![0].match(/<p[^>]*>/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('LAND-01 — does NOT load Tailwind app bundle (no React runtime per LAND-01)', () => {
    expect(html).not.toMatch(/src="\/src\/main\.tsx"/);
    expect(html).not.toMatch(/<div\s+id="root">/);
  });

  it('D-LAND-12 — footer has GitHub link + Made by + © 2026', () => {
    expect(html).toMatch(/<a\s+href="https:\/\/github\.com\/J-B-E-Haug\/Soundly">GitHub<\/a>/);
    expect(html).toMatch(/Made by J\. B\. E\. Haug/);
    expect(html).toMatch(/© 2026/);
  });
});

// ─── Phase 11: screenshot asset (D-LAND-13 / SEO-08 versioning + 200 KB cap) ──
describe('public/screenshot-composer-v1.png (D-LAND-13)', () => {
  const screenshotPath = resolve(repoRoot, 'public/screenshot-composer-v1.png');

  it('exists with versioned filename (D-LAND-13)', () => {
    expect(existsSync(screenshotPath)).toBe(true);
  });

  it('is <= 200 KB (matches OG image discipline)', () => {
    const size = statSync(screenshotPath).size;
    expect(size).toBeLessThanOrEqual(204800);
    expect(size).toBeGreaterThan(1000);
  });

  it('is a valid PNG file (header byte check)', () => {
    const buf = readFileSync(screenshotPath);
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
  });
});
