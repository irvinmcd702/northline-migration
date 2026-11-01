# Case study: WordPress → Astro on Cloudflare Pages

**Live:** https://northline-demo-7x9.pages.dev/

*Demo project — fictional company. Built to show the full migration process
end to end; all code, data and measurements are in this repository.*

## The site

Northline Industrial Supply, a dealer of pumps, compressors and industrial
valves. WordPress with a block theme, custom post types (products, used
equipment, projects), ACF fields, Yoast SEO and a Contact Form 7 quote form:
84 public URLs and old links including archives, 20 products with PDF datasheets, 7 used
units with price and status, 7 projects, a blog and 3 outdated pages.

## Goal

A static site on Cloudflare Pages that is faster and cheaper to run, keeps
every URL and search ranking, and that the team (and AI tools) can edit as
Markdown files in Git.

## How it was done

1. **Our own exporter**, not copy-paste. A Node tool reads the WordPress REST
   API and writes Astro content collections: Markdown for text, typed front
   matter for SKU, specifications, prices, statuses and SEO fields.
   - Downloads originals of all images and PDFs and rewrites every link,
     including resized variants (`pump-1024x768.jpg` → original).
   - Galleries become optimisable Markdown images with their captions. Tables,
     embeds, iframes and any block Markdown cannot express are kept as HTML;
     each one, and any shortcode whose plugin output is missing, is listed in
     a migration report — nothing is dropped silently.
   - Text such as `&lt;br&gt;` stays text, so escaped code in posts cannot turn
     into live HTML.
   - Re-runnable: a second run produces a byte-identical result.
2. **Same URLs.** Every page keeps its address, trailing slash included.
   Outdated pages, archive pagination, category, tag and author archives and
   feeds get 301 redirects, and so do old links to PDF datasheets
   (`/wp-content/uploads/…`). Old `/?p=123` links are resolved by a small
   Pages middleware from an ID map written by the exporter.
3. **Forms without a backend.** A Pages Function checks Cloudflare Turnstile
   server-side and forwards the request to a webhook (CRM, Zapier, email).
   No form data is stored on the site. Errors are shown even without
   JavaScript; the spam check itself needs it, so visitors without JavaScript
   see the phone number and email instead. A Turnstile outage is reported as
   "try again", not as a failed check.
4. **Verified, not assumed.** Scripts check that all 84 old URLs answer with
   the same title and ≥ 90 % of the original text (or a 301 to a working page),
   that 1,023 internal links resolve, and run axe (WCAG 2.1 AA) and
   Lighthouse.

## Results

Lighthouse mobile, median of 3 runs:

| Page | Performance before → after | LCP before → after | Weight before → after |
|---|---|---|---|
| Home | 88 → **100** | 3.9 s → **0.9 s** | 518 KB → 254 KB |
| Product | 85 → **100** | 4.4 s → **1.4 s** | 585 KB → 108 KB |
| Used equipment | 78 → **100** | 6.4 s → **1.3 s** | 1,007 KB → 266 KB |
| Blog post | 86 → **100** | 4.2 s → **1.4 s** | 569 KB → 84 KB |

Accessibility 98–100, Best practices 100, SEO 100 after migration; 0 axe
violations on key templates. Full table: [measurements.md](measurements.md).

The "before" site ran locally in Docker, so its numbers are, if anything,
flattering to WordPress (no network latency to a real host).

## What a client gets

- The static site with the same URLs, redirects and SEO fields.
- Content as Markdown in Git, with a README written for people and AI tools.
- The migration report: what was converted, what was kept as HTML and why.
- A staging copy behind Cloudflare Access with preview links for every change.
- A DNS move plan that keeps Microsoft 365 email working ([deploy.md](deploy.md)).
