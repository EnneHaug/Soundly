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

// ─── D-26: preservation of existing apple/theme/charset/viewport tags ──
describe('index.html preserved tags (D-26)', () => {
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

  it('preserves the existing NavigationRoute handler (D-17)', () => {
    expect(sw).toMatch(/createHandlerBoundToURL\('\/Soundly\/index\.html'\)/);
    expect(sw).toMatch(/registerRoute\(new NavigationRoute\(navHandler\)\)/);
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

  it('preserves the manifest block with start_url', () => {
    expect(cfg).toMatch(/start_url:\s*['"]\/Soundly\/['"]/);
  });
});

// ─── Cross-file placeholder consistency (D-23) ───────────────────────
describe('placeholder canonical URL consistency (D-23)', () => {
  it('all 3 deploy-time-swap files use the same placeholder', () => {
    const placeholder = 'https://soundly.local/Soundly/';
    expect(read('index.html')).toContain(placeholder);
    expect(read('public/robots.txt')).toContain(placeholder);
    expect(read('public/sitemap.xml')).toContain(placeholder);
  });
});
