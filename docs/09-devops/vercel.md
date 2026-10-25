# Vercel — setup status (TRENDS YOUNIQUE)

## Ab kya-kya ho chuka hai (maine khud kiya)

| Cheez | Status |
| --- | --- |
| Vercel project `trends-younique` | ✅ bana (`prj_EQ3QLpdZAFF6fnLQSHjOte7p4Crb`) |
| Build command | ✅ `npm ci && node scripts/pages/build-preview.mjs` |
| Output directory | ✅ `dist` (wahi static build jo Netlify/Pages par test hua) |
| Install command | ✅ `npm ci --no-audit --no-fund` |
| Env vars (5) | ✅ SITE_URL, GSC, CAMPAIGN_ID/START/END |
| Domain | ⏳ `trends-younique.vercel.app` (deployment ke baad active hoga) |
| Git connection | ❌ **blocked** — Vercel ka GitHub App `mystorebyme/manoj-Product` repo dekhta hi nahi |

## Blocker (ek click aapka)

Vercel → **Add New → Project → Import Git Repository** → agar repo list me na dikhe to
**"Adjust GitHub App Permissions"** → GitHub par `mystorebyme` org → **Repository
access** me `manoj-Product` ko allow karein → Vercel me wapas aakar **Import**.

Ya seedha: <https://github.com/settings/installations> → **Vercel** → **Configure** →
Repository access → `manoj-Product` add → Save.

> Ye permission main API se nahi de sakta (GitHub App install org admin ka kaam hai).
> Iske baad **baaki sab main khud kar dunga**: production branch
> `arena/e13f4af5-manoj-product`, env check, deploy, verify, aur chahein to
> `trendsyounique.fashion` domain bhi.

## Deploy ke baad kya milega

- **Link:** `https://trends-younique.vercel.app`
- Same static build jo abhi test hai: browse, cart, qty limits, checkout → WhatsApp,
  Google Sheet writes, Diwali campaign, local product photos, 7 day return.
- Admin **Vercel par nahi chalega** (Vercel ka filesystem read-only hai; admin
  `overrides.json` + photo uploads disk par likhta hai). Admin local/Render —
  dekhein [`admin-access.md`](./admin-access.md).

## Custom domain `trendsyounique.fashion`

Vercel par domain add karna easy hai (main kar dunga), par **DNS aapke registrar par**
hai — do raste:

1. **Nameservers** → `ns1.vercel-dns.com`, `ns2.vercel-dns.com` (registrar me badlein)
2. **Records** → `A 76.76.21.21` (root) + `CNAME www → cname.vercel-dns.com`

Ek hi host par rakhein — Netlify aur Vercel dono par same domain nahi laga sakte.

## Kyun static build (SSR nahi)

`apps/web` SSR bhi chalta hai, par checkout/order API Postgres maangta hai (`DATABASE_URL`);
bina DB ke order `.data/` file me likhne ki koshish hoti hai jo Vercel par read-only
hota hai. Static build me checkout seedha **WhatsApp + Google Sheet** par jaata hai —
wahi tested flow. SSR + Postgres chahiye to bata dein, alag se karenge.
