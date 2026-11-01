# Deploy to Cloudflare Pages

Everything below runs from `site/`. Steps marked **owner** need the account
owner (logins, secrets, dashboard settings).

## 1. First deploy

1. **owner:** `npx wrangler login` (personal Cloudflare account, not a client's).
2. `npm ci && npm run build && npm test`
3. `npx wrangler pages project create northline-demo --production-branch main`
4. `npx wrangler pages deploy dist --branch main`
   → `https://northline-demo-7x9.pages.dev/`

The deploy uploads `dist/` and the `functions/` folder (quote form and the
`?p=` redirect middleware).

## 2. Form settings

1. **owner:** Cloudflare dashboard → Turnstile → add widget for
   `northline-demo-7x9.pages.dev` (and `*.northline-demo-7x9.pages.dev` for
   previews). Copy the site key and the secret.
2. Site key: set `PUBLIC_TURNSTILE_SITEKEY` in `site/.env` before building
   (it is public; without it the build uses Cloudflare's always-pass test key).
3. **owner:** secrets (never in git):

       npx wrangler pages secret put TURNSTILE_SECRET --project-name northline-demo
       npx wrangler pages secret put WEBHOOK_URL --project-name northline-demo

   `WEBHOOK_URL` is optional: without it the form runs in demo mode (spam check
   only, nothing is sent). Otherwise any endpoint that accepts a JSON POST (Zapier/Make
   webhook, a Google Apps Script web app, or a CRM web-to-lead endpoint).
4. Rebuild and redeploy (step 1.2 and 1.4).

## 3. Staging behind Cloudflare Access

1. `npx wrangler pages deploy dist --branch staging`
   → `https://staging.northline-demo-7x9.pages.dev/`
2. **owner:** Pages project → Settings → General → *Enable access policy*
   for preview deployments, allow your email.
3. Check: an anonymous request to the staging URL gets the Access login page,
   production stays public.

## 4. Check the live site

    node ../scripts/parity.mjs --old http://localhost:8080 --new https://northline-demo-7x9.pages.dev
    MSYS_NO_PATHCONV=1 node ../scripts/lighthouse.mjs --label live --base https://northline-demo-7x9.pages.dev --runs 3 / /products/centrifugal-pump-cp-200/

(`MSYS_NO_PATHCONV=1` only matters in Git Bash on Windows.)

## For a real client: moving DNS without breaking email

Not demonstrated here (the demo has no domain). The procedure used on real
sites:

1. Two days before: lower TTLs at the current DNS host to 300 s.
2. Export every record from the old DNS host and import it into Cloudflare.
   Check by hand the records that are easy to miss: `MX`,
   `autodiscover` CNAME, `_dmarc` TXT, SPF TXT, and Microsoft 365 DKIM
   CNAMEs `selector1._domainkey` / `selector2._domainkey`, plus every
   subdomain in use.
3. Mail-related records stay **DNS only** (grey cloud) in Cloudflare.
4. Switch nameservers at the registrar; keep the old zone untouched for a week.
5. After propagation: send and receive test mail, check DKIM/SPF/DMARC pass in
   the message headers, then point the site records to Pages.
