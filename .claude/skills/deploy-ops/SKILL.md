---
name: deploy-ops
description: Deploy the storefront (Cloudflare Pages / Netlify) and the Apps Script engine, verify it live, and roll back safely. Use for releases, go-live checks and incidents.
---

# Deploy & ops (current — Round 38/39 ke baad)

> Purana version (Vercel + Render + Razorpay) **historical** hai. Sach:
> `docs/00-overview/production-topology.md`. Cloudflare detail: `docs/09-devops/cloudflare-pages.md`.

## Topology

| Hissa | Host | Build / deploy |
| --- | --- | --- |
| Storefront (static) | **Cloudflare Pages** (target) · Netlify (purana) | `node scripts/pages/build-preview.mjs` → `dist/` |
| Backend / DB | **Google Apps Script + Google Sheet** | `.gs` paste + `setup` + **Deploy → New version** |
| Admin panel | alag deploy (repo me code) | `cd apps/admin && npx next build` |
| Domain | `trendsyounique.fashion` (+ `www` 301) | Cloudflare zone (NS pehle se Cloudflare par) |

## Pre-deploy

```bash
npm ci                              # node_modules snapshot me nahi aata
npm run typecheck                   # web + admin + api
npm run test:unit                   # 202
npm run sheet:test                  # 16 (Apps Script engine)
npm run lint                        # 0 error chahiye
npm run docs:check                  # living docs me 0 toota link
npm run build:preview               # dist/ banega (4.7k files)
```

## Deploy — storefront

**Git se (Cloudflare Pages):** `main` par push → build khud chalta hai
(`npm ci && node scripts/pages/build-preview.mjs`, output `dist`).

**Haath se (CLI):**

```bash
npx wrangler pages deploy dist --project-name trendsyounique
```

**Netlify (rollback ke liye):** `netlify deploy --prod --dir=dist`.

## Deploy — Apps Script (Sheet DB)

1. `scripts/google-apps-script/trends-sheets.gs` poora copy → Apps Script editor me paste.
2. `setup` Run (pehli baar permission maangega; email ke liye `authorizeMail`).
3. **Deploy → Manage deployments → Edit → Version: New version → Deploy** (URL wahi rehta hai).
4. Verify: `?action=ping` → `version 2026-10-25.r20`; menu → *9. Sab kuch test karo* (115 check).

## Verify (2 min)

```bash
curl -s  "<apps-script-url>?action=ping"                 # version r20
curl -s  "<apps-script-url>?action=public"               # settings aate hain
curl -sI https://trendsyounique.fashion | head -3        # 200 + headers
curl -s -o /dev/null -w "%{http_code}\n" https://trendsyounique.fashion/products/<handle>/
curl -sI http://trendsyounique.fashion | head -2         # 301 → https
curl -sI https://www.trendsyounique.fashion | head -2    # 301 → apex
```

Site par: home → product → cart → checkout (WhatsApp khula?) → track-order; DevTools me
Console/Network clean; `_headers` ki `Cache-Control` dikh rahi ho.

## Rollback

| Kya bigda | Wapas kaise |
| --- | --- |
| Site | Cloudflare Pages → Deployments → purana deployment → **Rollback**; ya DNS record purane host par |
| Domain/DNS | apex `A`/`CNAME` record purane host par point karo (proxy ON), 1–5 min |
| Sheet engine | Apps Script → Manage deployments → purani version par **Edit → Version** chuno → Deploy |
| Data | Sheet → File → Version history |

## Incident first 5 minutes

1. Site khuli? → `curl -sI` + Cloudflare deploy log.
2. Form/order nahi ja raha? → Apps Script Executions log + `?action=ping`.
3. Email nahi ja rahi? → Sheet `MailQueue` (Status/Last Error) + `EmailKeys` tab.
4. Fix forward < 5 min? warna rollback. Baad me `docs/11-maintenance/incidents.md`.

## Env / secrets

Sirf hosting ke environment me: `NEXT_PUBLIC_SITE_URL`, `NODE_VERSION=22`, optional
`NEXT_PUBLIC_GSC_VERIFICATION`, campaign vars. **Koi payment/DB key nahi** (online payment
nahi hai). Sheet ka token Apps Script ke Script Properties me — repo me kabhi nahi.
