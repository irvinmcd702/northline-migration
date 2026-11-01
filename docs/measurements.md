# Measurements

Lighthouse mobile (default throttling), median of 3 runs per URL. "before" is the WordPress site in Docker, "after" the Astro build served by `wrangler pages dev`, "live" the deployed site.

| Site | URL | Performance | Accessibility | Best practices | SEO | LCP | Page weight |
|---|---|---|---|---|---|---|---|
| before | `/` | 88 | 98 | 100 | 100 | 3.9 s | 518 KB |
| before | `/products/centrifugal-pump-cp-200/` | 85 | 100 | 100 | 100 | 4.4 s | 585 KB |
| before | `/inventory/` | 78 | 100 | 100 | 92 | 6.4 s | 1007 KB |
| before | `/blog/how-to-size-an-air-compressor/` | 86 | 100 | 100 | 100 | 4.2 s | 569 KB |
| after | `/` | 100 | 98 | 100 | 100 | 0.9 s | 254 KB |
| after | `/products/centrifugal-pump-cp-200/` | 100 | 100 | 100 | 100 | 1.4 s | 108 KB |
| after | `/inventory/` | 100 | 100 | 100 | 100 | 1.3 s | 266 KB |
| after | `/blog/how-to-size-an-air-compressor/` | 100 | 100 | 100 | 100 | 1.4 s | 84 KB |

## Other checks (after)

- Live site (Cloudflare Pages): parity 84/84 against https://northline-demo-7x9.pages.dev, see "live" rows above.
- URL parity: 84/84 old URLs (pages, archives, feeds, `?p=` links, old PDF links) answer on the new site (200 with the same title and ≥ 90% of the original text, or a 301 to a working page). `node scripts/parity.mjs --old … --new …`
- Internal links: 56 pages, 1,023 links, 0 broken. `node scripts/linkcheck.mjs site/dist`
- axe (WCAG 2.0/2.1 A and AA rules) on 6 key templates: 0 violations. `node scripts/a11y.mjs …`

Notes:

- Accessibility 98 on `/` comes from the migrated home page content itself (an `h3` right after the `h1`, as on the WordPress site, which scores the same 98). It is a content fix for the client, not a template issue.
- Images: WordPress served 1.1 MB JPEG originals scaled down in the browser; the static site serves responsive WebP (9–100 KB per card) generated at build time.
| live | `/` | 100 | 98 | 100 | 100 | 0.9 s | 255 KB |
| live | `/products/centrifugal-pump-cp-200/` | 100 | 100 | 100 | 100 | 1.4 s | 108 KB |
| live | `/inventory/` | 100 | 100 | 100 | 100 | 1.3 s | 267 KB |
| live | `/blog/how-to-size-an-air-compressor/` | 100 | 100 | 100 | 100 | 1.3 s | 84 KB |
