# Domain, brand aur links

> **Current production (2026-11-18):** `trendsyounique.fashion` Vercel project
> `trends-younique` se serve hota hai. GitHub Pages sirf
> `https://mystorebyme.github.io/manoj-Product/` par project preview hai — custom
> domain claim nahi. Cloudflare DNS Vercel target par point karta hai.

## 1. Apna domain lagana (recommended: ek hi domain, sab jagah)

| Kahan | Kya set karna hai | Kyun |
| --- | --- | --- |
| Vercel → `trends-younique` → Env | `NEXT_PUBLIC_SITE_URL=https://trendsyounique.fashion` | canonical/OG/sitemap/robots/WhatsApp/invoice links isi se bante hain |
| Vercel → `trends-younique` → Domains | `trendsyounique.fashion` + `www` (dono verified) | Auto SSL; custom domain par SSO protection nahi |
| Cloudflare → DNS | `@` A `216.198.79.1` / `64.29.17.1` (ya CNAME `cname.vercel-dns.com.`), `www` CNAME | apex + www Vercel par point |
| GitHub → Settings → Variables → Actions | `STORE_API_URL` | GitHub Pages **project preview** se order/payment API par jaata hai |
| GitHub Pages | sirf `mystorebyme.github.io/manoj-Product/` | production nahi, custom domain claim nahi |

**Rule:** WhatsApp par bheja gaya product/order link **isi site ka** hota hai
(`window.location.origin`), purani/cloned store ka nahi. Production (Vercel + custom
domain) par base path khaali (`/`) hota hai; GitHub Pages project preview par
`/manoj-Product` judta hai.

## 2. Brand

- Naam: `TRENDS YOUNIQUE` (`apps/web/src/config/site.ts` → `siteConfig.name`).
- Logo owner ke original file (`assets/source/trends-younique-logo-original.png`) se banta hai —
  koi redraw nahi (`scripts/brand/build-trends-assets.py`):
  - `apps/web/public/images/brand/trends-header.png` — crest + wordmark (header, light bg)
  - `apps/web/public/images/brand/trends-header-cream.png` — cream (maroon/dark bg)
  - `apps/web/public/images/brand/trends-lockup.png` — stacked full lockup (footer, invoices, about)
  - `apps/web/public/images/brand/trends-lockup-cream.png` — stacked, cream (dark bg)
  - `apps/web/public/images/brand/trends-mark-{64,128,192,512}.png` — square crest (favicon, PWA, WhatsApp thumb)
  - `apps/web/public/images/og-image.jpg` — social share card (1200×630)
  - Ek hi component: `apps/web/src/components/brand-lockup.tsx` (header, mobile menu, footer)
  - Admin: `apps/admin/public/invoice-logo.png` + `/brand-mark.png` + `trends-mark-*.png`
- Phone / WhatsApp: `7740992663` (Settings sheet se override ho sakta hai:
  `support_phone`, `whatsapp`).
- UPI: **owner ki apni UPI id** — Sheet `Settings` ke `upi_id` / `upi_name`, ya `STORE_UPI_ID` env.
  Khaali ho to site par UPI card nahi khulta (koi placeholder VPA nahi dikhta).
- Instagram: owner abhi handle dena baaki hai (`siteConfig.socials.instagram` khaali hai).
  WhatsApp hi working social link hai.

## 3. Domain se pehle: poora env checklist (ek jagah)

Production domain lagane par sirf **ek** value badalni chahiye — `NEXT_PUBLIC_SITE_URL`.
Canonical, OG, sitemap, robots, product JSON-LD, WhatsApp message links, invoice/UPI
callback — sab isi se bante hain (`apps/web/src/config/site.ts`).

### 3.1 Render → storefront (`apps/web`)

> **Current production:** Vercel project `trends-younique` me bhi yahi
> `NEXT_PUBLIC_SITE_URL=https://trendsyounique.fashion` set hai (production + preview).
> Render blueprint future/full-app option hai; live storefront Vercel static build se chalta hai.

| Variable | Domain ke saath | Kya control karta hai |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://trendsyounique.fashion` | canonical + `metadataBase`, `sitemap.xml`, `robots.txt` host, product/offer JSON-LD URL, UPI callback URL, WhatsApp order link fallback |
| `NEXT_PUBLIC_LIVE_STORE_URL` | `https://trendsyounique.fashion` | "Buy on live store" type fallback links |
| `ADMIN_PANEL_URL` | `https://admin.trendsyounique.fashion` | admin button/link (sheet ki `admin_url` row isko override karti hai) |
| `STORE_UPI_ID` / `STORE_UPI_NAME` | *(khaali — owner khud daalta hai)* / `TRENDS YOUNIQUE` | UPI QR (sheet `upi_id`/`upi_name` override karte hain) |
| `ADMIN_API_TOKEN` | 32+ char random | admin → storefront API auth |
| `GOOGLE_SHEETS_WEBAPP_URL` / `GOOGLE_SHEETS_TOKEN` | Apps Script `/exec` | owner settings + order/payment log |
| `CONTACT_EMAIL` | `care@trendsyounique.com` | contact form delivery |

### 3.2 GitHub → Settings → Variables (`STORE_API_URL`)

| Variable | Value | Kyun |
| --- | --- | --- |
| `STORE_API_URL` | `https://trendsyounique.fashion` | GitHub Pages project preview ka checkout/payment/track-order seedha Render API par jaata hai (`pages.yml` ise `NEXT_PUBLIC_API_BASE_URL` banata hai) |

Variable (secret nahi) rakhein — workflow `vars.STORE_API_URL` padhta hai. Set karne ya badalne par
Pages workflow dobara chalao (Actions → Pages → Re-run) — static build me value inject hoti hai.

**CORS (zaroori):** Pages static site se order/payment call **cross-origin** jaati hai, isliye
Render API par allowlist wala CORS hai (`apps/web/src/lib/cors.ts`): apni site
(`NEXT_PUBLIC_SITE_URL`), `https://mystorebyme.github.io`, localhost aur apne
`*.onrender.com` hosts. Koi `*` nahi. Aur domain add karna ho to Render env me
`CORS_ALLOWED_ORIGINS=https://a.com,https://b.com` daal dein. In routes par OPTIONS preflight
bhi handle hota hai: `/api/orders`, `/api/payments/manual`, `/api/payments/failed`, `/api/settings`.

Iske bina Pages par "Order place nahi hua" (browser CORS block) dikhta hai — `STORE_API_URL`
set karte hi order seedha Render par banta hai, UPI payment ke baad wahi order page khulta hai.

### 3.3 Custom domain + SSL

1. Render → storefront → **Settings → Custom Domains** → `trendsyounique.fashion` + `www.trendsyounique.fashion` add.
2. DNS (registrar): apex `A` → Render ka IP; `www` `CNAME` → `<service>.onrender.com`.
3. Render SSL auto (Let's Encrypt) — 10–30 min.
4. `www` → apex **Redirect** (ya ulta) — dono par site khule, canonical ek hi ho.
5. Admin alag subdomain par ho to `admin.trendsyounique.fashion` bhi add karein (admin app alag service hai).

### 3.4 Domain ke baad verify (copy-paste)

```bash
SITE=https://trendsyounique.fashion

# canonical + OG absolute URL
curl -s $SITE | grep -o '<link rel="canonical"[^>]*>' | head -1
curl -s $SITE | grep -o '<meta property="og:url"[^>]*>' | head -1

# sitemap/robots apne domain par
curl -s $SITE/robots.txt | grep -i sitemap
curl -s $SITE/sitemap.xml | head -c 200

# product JSON-LD offer url
curl -s "$SITE/products/$(curl -s $SITE/sitemap.xml | grep -o 'products/[a-z0-9-]*' | head -1 | cut -d/ -f2)" \
  | grep -o '"url":"[^"]*products[^"]*"' | head -2

# settings live (sheet connected?)
curl -s $SITE/api/settings | head -c 400
```

Sab URLs `trendsyounique.fashion` ke hone chahiye — kahin `onrender.com` ya
`trendsyounique.fashion` nahi dikhna chahiye. `www` + non-`www` dono test karein.

> Note: `NEXT_PUBLIC_*` values **build time** par bake hoti hain. Render par env badalne ke
> baad **Manual Deploy → Clear build cache & deploy** karein, warna purana URL HTML me reh jaata hai.

### 3.5 Production = Vercel, Pages = project preview

Custom domain `trendsyounique.fashion` ab **Vercel project `trends-younique`** se serve hota hai
(Cloudflare DNS → Vercel). GitHub Pages sirf `https://mystorebyme.github.io/manoj-Product/`
par project preview hai — isliye root `CNAME` aur Pages cname-attach step hata diye gaye hain.

- Vercel env: `NEXT_PUBLIC_SITE_URL=https://trendsyounique.fashion` (production + preview).
- Vercel build: `node scripts/pages/build-preview.mjs` → `dist`, root base path `/`.
- `pages.yml` ab `PAGES_BASE_PATH=/manoj-Product` aur `.nojekyll` ke saath preview banata hai;
  `NEXT_PUBLIC_SITE_URL` preview URL par set hota hai.
- `github-pages` environment sirf `main` se deploy allow karta hai — feature branch par
  sirf build (verification) hoti hai.
- Diwali campaign (`flat 75% off`) ke liye `NEXT_PUBLIC_CAMPAIGN_*` env Vercel aur workflow
  dono me hain.

Cloudflare DNS values: [`docs/10-deployment/dns.md`](../10-deployment/dns.md).

## 4. Sheet kabhi public nahi

- `GOOGLE_SHEETS_WEBAPP_URL` + `GOOGLE_SHEETS_TOKEN` sirf server env me hain.
- `/api/settings` sirf public values deta hai (UPI, phone, email, announcement) — sheet ka URL/token nahi.
- `/api/admin/sheet` token ke bina 401 deta hai; admin page sirf “Connected” status dikhata hai.
- Admin link (`admin_url`) sirf admin panel me dikhta hai, frontend par kabhi nahi.
