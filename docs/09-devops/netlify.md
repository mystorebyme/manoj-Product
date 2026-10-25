# Netlify par site + apna domain (`trendsyounique.fashion`)

Ye repo Netlify ke liye ready hai — `netlify.toml` repo me hai, koi setting haath se
daalne ki zaroorat nahi. Netlify par **storefront** chalti hai (static, CDN se),
aur data Google Sheet me jaata hai.

```
customer browser ──► Netlify (static HTML/JS, CDN) ──► Apps Script ──► Google Sheet
                                   │
                                   └──► WhatsApp (order confirm)
```

## 1. Netlify par site banao (5 minute)

1. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project**.
2. **GitHub** chuno → repo `mystorebyme/manoj-Product` → branch `main`.
3. Build settings **khud bhar jaate hain** (`netlify.toml` se):
   - Build command: `npm ci && node scripts/pages/build-preview.mjs`
   - Publish directory: `dist`
4. **Deploy** dabaiye. Pehla build ~3–4 minute.
5. Deploy hone par Netlify ek URL dega (`https://<name>.netlify.app`) — us par site
   chal jaayegi (products, collections, cart, checkout → WhatsApp).

> Har naye push par Netlify khud rebuild karega. `main` branch par merge = live.

## 2. Apna domain jodo (`trendsyounique.fashion`)

1. Netlify → **Site configuration → Domain management → Add a domain** →
   `trendsyounique.fashion`.
2. Netlify bolega do raste — koi ek chuno:

   **A. Netlify DNS (aasan, recommended)**
   - Netlify 4 nameserver dega (`dns1.p0x.nsone.net` jaisa).
   - Jahan domain kharida tha (GoDaddy / Hostinger / BigRock) → **Nameservers** badal
     kar wahi 4 daal dein.
   - 1–24 ghante me live. Netlify HTTPS (Let's Encrypt) khud laga dega.

   **B. Sirf DNS records (nameserver nahi badalna)**
   - Registrar ke DNS me:
     - `A` record → `@` → `75.2.60.5` (Netlify load balancer)
     - `CNAME` → `www` → `<your-site>.netlify.app`
   - Netlify → Domain management me `www.trendsyounique.fashion` ko primary banao
     (aur `trendsyounique.fashion` → `www` redirect), phir **Verify DNS** dabaiye.

3. **HTTPS**: Netlify → Domain management → **HTTPS → Verify certificate**.
   Let's Encrypt free certificate 1–2 minute me lag jaata hai. "Force HTTPS" on kar dein.

4. Domain live hone ke baad ek baar:
   - Netlify → **Site configuration → Environment variables** →
     `NEXT_PUBLIC_SITE_URL = https://trendsyounique.fashion` (canonical, OG image,
     sitemap isi se bante hain) → **Deploys → Trigger deploy**.

## 2b. Environment variables (bas 5 lines)

Netlify → **Site configuration → Environment variables → Import environment variables**
me repo ki file **`.env.netlify`** ka poora content paste kar dein → **Import** →
**Deploys → Clear cache and retry**.

```ini
NEXT_PUBLIC_SITE_URL=https://trendsyounique.fashion
NEXT_PUBLIC_GSC_VERIFICATION=hFaqyp-9LdUXSKPA9RF011TkO2m_-7AUMasXqm_0dGI
NEXT_PUBLIC_CAMPAIGN_ID=diwali-2026
NEXT_PUBLIC_CAMPAIGN_START=2026-10-24T00:00:00+05:30
NEXT_PUBLIC_CAMPAIGN_END=2026-11-30T23:59:59+05:30
```

Bas itna. Kuch bhi **khaali ya fake** daalne ki zaroorat nahi:

| Cheez | Kahan se aati hai |
| --- | --- |
| `PAGES_BASE_PATH=""` | `netlify.toml` (root domain, `/repo/` prefix nahi) |
| `NEXT_PUBLIC_API_BASE_URL=""` | `netlify.toml` (koi Node API nahi) |
| Sheet relay URL + write token | `apps/web/src/lib/sheet-config.ts` (verified deployment, `verify_write: true`) |
| GA4 measurement ID | **abhi set nahi** — property banne ke baad `NEXT_PUBLIC_GA_ID=G-…` add karein |

> Sirf **public** values hain. Static site hai — Firebase OTP, Razorpay keys, DB URL aur
> master sheet token (`tym-…`) server ke liye hain aur Netlify par use hi nahi hote.
> Browser wala sheet token write-only hai (row add kar sakta hai, padh nahi sakta).

## 2c. Netlify **kaunsi branch** build karta hai (zaroori)

Netlify default me **production branch** build karta hai. Is repo me saara naya kaam
`arena/e13f4af5-manoj-product` branch par hai (`main` purana snapshot hai, dono ki
history alag hai — isliye direct merge nahi hota).

Do raste — koi ek:

**A. Netlify ka production branch badal dein (aasan, turant)**
Site → **Build & deploy → Branches and deploy contexts → Production branch → Edit**
→ `arena/e13f4af5-manoj-product` → Save → **Deploys → Trigger deploy → Deploy site**.
(Owner ne `main` ko chhedna nahi hai, isliye yahi recommended hai.)

**B. Alag branch deploy**
Branches → **Branch deploys → Add branch** me wahi branch add karein, phir branch
deploy URL se test karein; theek lage to use production bana dein.

> Isi wajah se `treand.netlify.app` par purana design dikh raha tha (email, CDN photos,
> purane circles) — wo build `main` se bana tha, is branch se nahi.

## 2d. Admin kaise kholein (Netlify par admin **nahi** hota)

Static export me login/server nahi hota, isliye `netlify.app/admin` ya
`trendsyounique.fashion/admin` dono 404 dete hain — ye jaan-boojh kar hai.
Admin chalane ke do raste (dono domain se pehle aur baad same):

1. **Laptop par (aaj, free):** `ADMIN_PASSWORD='ApnaPassword' npm run dev:admin`
   → `http://localhost:3001/login`. Edit ke baad `git push` → Netlify auto-deploy.
2. **24×7 (optional):** Render blueprint (`render.yaml`) →
   `trends-younique-admin.onrender.com`, chaho to `admin.trendsyounique.fashion`.

Poora detail + FAQ: [`admin-access.md`](./admin-access.md)

## 3. Netlify par kya chalta hai (aur kya nahi)

| Cheez | Netlify (static) |
| --- | --- |
| Products, collections, search, filters, "Load more" | ✅ static + `catalog-lite.json` |
| Cart / wishlist (localStorage, kabhi nahi udta) | ✅ |
| Checkout → WhatsApp order | ✅ + order row **Google Sheet** me |
| Contact form, product enquiry, newsletter, review | ✅ seedha sheet me |
| Order tracking page | ⛔ (server chahiye) — order status WhatsApp par |
| Admin panel (`/admin`) | ⛔ alag Node host par chalta hai (Render) ya locally |

> Isliye "My orders / tracking" jaisa server wala hissa Netlify par nahi hota.
> Customer order confirm WhatsApp par karta hai — wahi flow owner ne choose kiya tha.

## 4. Google Sheet (data ka ghar) — Netlify par bhi wahi

Sheet relay browser se chalta hai, isliye hosting badalne se kuch nahi badalta:

1. Sheet → **Extensions → Apps Script** → repo ki
   `scripts/google-apps-script/trends-sheets.gs` paste → **Deploy → Manage deployments
   → Edit → New version → Deploy**.
2. Script Properties: `MASTER_TOKEN` = `tym-…`, `SPREADSHEET_ID` = `1ag5…xVY`.
3. Site par `/sheet-check/` kholiye → **Run check** → step 4 me `row likhi gayi`
   (ya POST fallback) — phir `Orders` tab me `TY-CHECK-…` row.

Detail: `docs/09-devops/google-sheets.md`.

## 5. Troubleshooting

| Dukaan | Wajah + fix |
| --- | --- |
| Build fail: "catalog read" | `database/seeds/catalog.json` repo me hona chahiye (`git status`) |
| Products dikhe, click par 404 | `PAGES_BASE_PATH` khaali hona chahiye (root domain) — `netlify.toml` me set hai |
| Images 404 | `apps/web/public/images/**` push hua ho (`git status --ignored`) |
| "Load more" error | `/catalog-lite.json` deploy me hai ya nahi (Deploys → Files) |
| Sheet me row nahi | Apps Script deployment "Anyone" access + `/sheet-check/` Run check |
| Domain par purana page | Netlify CDN cache — **Deploys → Clear cache and retry** |
| Site par purana design/email/CDN photos | Netlify `main` build kar raha hai — production branch `arena/e13f4af5-manoj-product` karein (section 2c) |
| Env import ke baad bhi purani values | Redeploy ke bina env build me nahi aate — **Clear cache and retry** |

## 6. GitHub Pages bhi chal raha hai

Dono ek saath chal sakte hain (Pages preview + Netlify live). Bas canonical URL
(`NEXT_PUBLIC_SITE_URL`) apne asli domain par rakhein, warna Google ko duplicate
site lagegi.
