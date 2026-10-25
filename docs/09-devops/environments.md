# Environments

| Env | Web | Admin | API | Data | Payments |
| --- | --- | --- | --- | --- | --- |
| local | :3000 | :3001 | :4000 | `.data/` | Razorpay test |
| preview (PR) | `*.vercel.app` | `*.vercel.app` | shared staging | ephemeral | test |
| staging | `staging.likshaclothing.com` | `staging-admin…` | `staging-api…` | separate disk | test |
| production | `likshaclothing.com` | `admin.likshaclothing.com` | `api.likshaclothing.com` | persistent disk | live |

## Env matrix

| Var | local | staging | prod |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | http://localhost:3000 | staging URL | https://likshaclothing.com |
| `ORDERS_API_URL` | — (direct) | staging-api | https://api… |
| `ADMIN_SESSION_SECRET` | dev default | random 32B | random 32B |
| `RAZORPAY_KEY_ID` | test | test | live |
| `RESEND_API_KEY` | optional | test key | live key |
| `NODE_ENV` | development | production | production |
| `NEXT_PUBLIC_GA_ID` | optional | GA4 property | GA4 property |
| `NEXT_PUBLIC_GSC_VERIFICATION` | optional | Search Console token | Search Console token |

## Search Console + traffic

- **Google Search Console verification** — `apps/web/src/app/layout.tsx` me
  `metadata.verification.google` se meta tag aata hai. Default token commit hai;
  dusri property verify karni ho to `NEXT_PUBLIC_GSC_VERIFICATION` me naya token
  daal ke deploy karein (ek page par ek hi verification meta tag Google padhta hai).
  Sitemap: `/sitemap.xml` (robots.txt me declare) — deploy ke baad Search Console
  → Sitemaps me `sitemap.xml` submit karein.
- **Har page ki traffic** — `apps/web/src/components/analytics.tsx` GA4 ka
  `page_view` **har route change** par bhejta hai (product, collection, home,
  orders sab alag). Env `NEXT_PUBLIC_GA_ID` khaali ho to kuch load nahi hota.
  GA4 property banane ke baad Measurement ID (`G-XXXXXXXXXX`) daal dein.

## Rules

1. Prod secrets kabhi local `.env` me copy nahi (vault/dashboard se).
2. Staging par live customer data nahi — synthetic orders.
3. Test payment keys staging me zaroori; live keys kabhi staging par nahi.
4. Local data reset: `rm -rf .data && npm run seed:dev`.

## Local bootstrap

```bash
cp .env.example .env
npm install
npm run catalog:build
bash scripts/setup.sh
npm run dev        # 3000, 3001, 4000 (alag terminals ya concurrently)
```
