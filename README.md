# Northline: WordPress → Astro migration

Live: https://northline-demo-7x9.pages.dev/

*Demo project — fictional company.* A complete, reproducible WordPress to
static-site migration: the original WordPress site, the exporter that moves
it, the resulting Astro site on Cloudflare Pages, and the checks that prove
nothing was lost. Results: [docs/case-study.md](docs/case-study.md).

| Folder | What it is |
|---|---|
| `wp-source/` | The "before" WordPress site in Docker, rebuilt from files by `seed.sh` |
| `exporter/` | Node tool: WordPress REST API → Astro content, media, redirects, report |
| `site/` | The "after" Astro site with Pages Functions (quote form, `?p=` redirects) |
| `scripts/` | Parity, link check, Lighthouse and axe checks |
| `docs/` | Migration report, measurements, deploy guide, case study |

## Run it

Requirements: Docker, Node 24.

    bash wp-source/seed.sh                         # WordPress at http://localhost:8080
    (cd exporter && npm ci && npm test)
    node exporter/bin/export.mjs --wp http://localhost:8080 --out site --docs docs --retire wp-source/content/retired.json
    (cd site && npm ci && npm run build && npm test)
    (cd site && npx wrangler pages dev dist --port 8788)   # new site with functions
    (cd scripts && npm ci)
    node scripts/parity.mjs --old http://localhost:8080 --new http://127.0.0.1:8788
    node scripts/linkcheck.mjs site/dist
    node scripts/a11y.mjs http://127.0.0.1:8788

In Git Bash on Windows prefix commands that pass URL paths (`seed.sh` does it
itself, `lighthouse.mjs` needs it) with `MSYS_NO_PATHCONV=1`.

Deploy: [docs/deploy.md](docs/deploy.md).
