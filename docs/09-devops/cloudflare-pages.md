# Cloudflare Pages — deployment guide (TRENDS YOUNIQUE)

> **Status:** repo **ready** hai (build, headers, docs) — Cloudflare account ka step **aapko**
> karna hai, kyunki deploy karne ke liye Cloudflare login / API token chahiye jo agent ke
> paas nahi hai. Neeche step-by-step hai (10–15 minute).

---

## 0. Sabse pehle: asli architecture (audit ka nichod)

| Cheez | Kya nikla |
| --- | --- |
| Repo | `mystorebyme/manoj-Product` (monorepo, npm workspaces) |
| Apps | `apps/web` (storefront), `apps/admin` (admin panel — deploy **nahi** hota), `apps/api` (alag Node API — deploy **nahi** hota) |
| Framework | **Next.js 16 (App Router)**, par production me **static export** (`output: "export"`) |
| Build script | `node scripts/pages/build-preview.mjs` → pehle Next build, phir `apps/web/out` → `dist/` |
| Output | `dist/` — **4768 files, ~135 MB**, sabse badi file 0.8 MB |
| Server chahiye? | **Nahi.** Production me `?action=api` wale 32 routes **hata diye jaate hain** (`build-preview.mjs` `src/app/api` aur `src/app/orders` ko build ke waqt side me rakhta hai) |
| Data | Google Sheet + Apps Script web app (browser se seedha), WhatsApp order confirm |
| Netlify-specific cheezein | sirf `netlify.toml` (headers + build). Koi Netlify Function nahi, koi `_redirects` nahi |
| Database / payments server-side | code me maujood hai (Postgres, pdfkit, OTP) par **production build me nahi jaata** — Cloudflare par iski zaroorat nahi |
| Verified | `https://trendsyounique.fashion/api/health` → site ka **404 page** (yaani hosting par koi Node/API nahi chal raha) |

Iska matlab: **Cloudflare Pages ka pure-static plan is app ke liye bilkul sahi hai.**
Koi Workers/OpenNext adapter ki zaroorat nahi (kyunki server routes production me hain hi nahi).

```
browser ──► Cloudflare Pages (static HTML/JS, edge CDN) ──► Apps Script ──► Google Sheet
                        │
                        └──► WhatsApp (order confirm)
```

---

## 1. Cloudflare Pages project settings (exactly ye daalein)

| Setting | Value |
| --- | --- |
| Project name | `trendsyounique` (ya jo aap chahein) |
| Git provider / repo | GitHub → `mystorebyme/manoj-Product` |
| Production branch | **`main`** |
| Framework preset | **None** (custom build) |
| Root directory | `/` (repo root — monorepo) |
| Build command | `npm ci && node scripts/pages/build-preview.mjs` |
| Build output directory | `dist` |
| Node version | `22` (env var `NODE_VERSION=22`; repo me `.nvmrc` bhi hai) |

Environment variables (Production **aur** Preview, dono):

| Variable | Value |
| --- | --- |
| `NODE_VERSION` | `22` |
| `NEXT_PUBLIC_SITE_URL` | `https://trendsyounique.fashion` |
| `PAGES_BASE_PATH` | *(khaali chhod dein)* |
| `NEXT_PUBLIC_API_BASE_URL` | *(khaali chhod dein)* |
| `NEXT_PUBLIC_GSC_VERIFICATION` | `hFaqyp-9LdUXSKPA9RF011TkO2m_-7AUMasXqm_0dGI` |
| `NEXT_PUBLIC_CAMPAIGN_ID` / `_START` / `_END` | jo abhi Netlify/Vercel par set hain (optional) |

> Koi secret/paid key build me nahi jaati — jo bhi sheet/Apps Script ka endpoint hai wo
> `apps/web/public/sheet-endpoint.json` me public hai (jaan-boojh kar).

**Pehla build ~4–6 minute** lega (`npm ci` + Next build + 4768 files ka upload).

---

## 2. Headers (repo me ho gaya)

`apps/web/public/_headers` add ki gayi hai aur build ke baad `dist/_headers` ban jaati hai
(`build-preview.mjs` ise guarantee ke saath copy karta hai). Isme:

- security headers (nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy, HSTS)
- CSP **report-only** (kuch block nahi karta)
- `/_next/static/*` aur `/images/*` → `max-age=31536000, immutable`
- `/*.html` → `max-age=0, must-revalidate` (price/stock sheet se aate hain)
- `/cart/*`, `/checkout/*`, `/account/*`, `/track-order/*` → `no-store` (personal flows)

`_redirects` ki zaroorat nahi — build `trailingSlash: true` se directory-style pages banata
hai (`/products/xyz/index.html`) aur Cloudflare Pages inhe khud serve karta hai. 404 ke liye
`dist/404.html` maujood hai.

---

## 3. GitHub → Cloudflare connect (aapko karna hai)

1. [dash.cloudflare.com](https://dash.cloudflare.com) → apna account.
2. **Workers & Pages → Create → Pages → Connect to Git**.
3. GitHub authorize karein → repo **`mystorebyme/manoj-Product`** chunein → **Begin setup**.
4. Project name: `trendsyounique`. **Production branch: `main`**.
5. Build settings: table (upar) ke exactly values daalein → **Save and Deploy**.
6. Build log poora dekhein. Umeed: `static preview ready: /opt/buildhome/repo/dist (/ )`
   aur phir `Success: Your site was deployed!`.
7. `https://trendsyounique.pages.dev` kholein → home, product page, cart, checkout →
   WhatsApp, track-order — sab test karein **DNS badalne se pehle**.

Preview deployments: har branch/PR ka apna URL milega (`<hash>.trendsyounique.pages.dev`).
Default me har branch ka preview build hota hai — chaahein to Pages → Settings → Builds &
deployments → *Preview deployments* me sirf `main` chhod dein.

---

## 4. Custom domain + DNS (yahan sabse zyada dhyan)

### Abhi ka verified DNS state (DoH se check kiya)

```
NS  trendsyounique.fashion → karsyn.ns.cloudflare.com, duke.ns.cloudflare.com   ✅ Cloudflare
A   trendsyounique.fashion → 104.21.46.187, 172.67.141.99                       → Cloudflare proxy ON
```

Matlab: **domain pehle se Cloudflare ke naam-servers par hai** (zone Cloudflare me hai),
aur traffic Cloudflare ke through ja raha hai. Isliye:

- **Nameservers badalne ki zaroorat nahi** (GoDaddy/registrar chhedne ki zaroorat nahi).
- Email (MX/SPF/DKIM/DMARC) records **jaisa hai waisa rahega** — hum sirf website wala
  record badlenge. Kisi bhi halat me MX/`TXT` records delete na karein.

### Step (Pages → Custom domains)

1. Pages project → **Custom domains → Set up a custom domain**.
2. `trendsyounique.fashion` daalein → **Continue**.
3. Cloudflare bolega ki zone me record update karna hai (apex ke liye `CNAME` flattening) →
   **Activate domain**. Ye maujooda proxied `A` records ko replace karega — **yahi asli
   switch hai** (is waqt purani hosting se naya Pages serve hone lagega).
4. `www.trendsyounique.fashion` bhi add karein → **Activate domain**.
5. `www` → apex redirect (ek hi canonical URL, SEO ke liye zaroori):
   **Zone → Rules → Redirect Rules → Create rule**
   - Name: `www → apex`
   - When: `Hostname equals www.trendsyounique.fashion`
   - Then: **Static redirect** → `https://trendsyounique.fashion` + *Preserve query string* → **301**
   - (Loop na bane, isliye destination me `www` na ho.)
6. HTTPS: zone par **Universal SSL** pehle se on hai; Pages custom domain apna certificate
   khud issue karta hai. **SSL/TLS → Overview → Full** (ya Full strict) rakhein,
   **Always Use HTTPS ON**.

### Rollback (agar kuch galat lage)

Purani hosting (Netlify/Vercel) ka deploy **delete na karein**. Wapas jaana ho to:

1. Pages → Custom domains se domain hata dein, **ya**
2. Zone → DNS me apex record wapas purane host par point kar dein (Netlify: `A @ → 75.2.60.5`,
   ya jo bhi pehle tha), proxy ON.
3. 1–5 minute me purani site wapas live (TTL 300).

> Pehle wala record screenshot/note kar lein switch se pehle — wahi rollback ka sabse aasan
> rasta hai.

---

## 5. Free plan limits (Cloudflare Pages) — is app par asar

| Limit | Free plan | Is app par asar |
| --- | --- | --- |
| Bandwidth | **Unlimited** | ✅ 135 MB site, images CDN se |
| Requests | **Unlimited** (static) | ✅ |
| Builds | **500 / month** | ✅ ~16/din — kaafi |
| Files per deployment | **20,000** | ✅ 4,768 |
| File size | **25 MB** | ✅ sabse badi 0.8 MB |
| Concurrent builds | 1 | ⚠️ do push ek saath → doosra wait karega |
| Build time limit | 20 min | ✅ hamara ~4–6 min |
| Custom domains | 100 / project | ✅ |
| Workers (Functions) | 100k requests/din | is app me use hi nahi ho rahe |

Traffic: 1 lakh monthly visitors bhi static plan par aaram se chalte hain — har visitor ke
liye koi backend call nahi hoti (data browser se Apps Script/Sheet par jaata hai, jo Google
ka infra hai). **Sheet/Apps Script ke apne quota** (Apps Script 20k URL fetch/din, MailApp
100/din, Sheet 60 requests/minute/user) hi asli limit hain — wo hosting se alag cheez hai.

---

## 6. Test jo deploy ke baad karna hai (checklist)

- [ ] Home → banners/campaign (sheet se) dikh rahe hain
- [ ] Product page → images, size chart, sheet stock line
- [ ] Collection page → "Load more" (client-side)
- [ ] Cart → add/remove, refresh ke baad cart bacha
- [ ] Checkout → PIN/state check, order → WhatsApp + `Orders` sheet me row
- [ ] Track order → order number + phone
- [ ] Contact / newsletter / review form
- [ ] Mobile + desktop layout, WhatsApp links (`wa.me/917740992663`)
- [ ] `www` → apex 301, HTTP → HTTPS
- [ ] DevTools → Network: `_headers` wale Cache-Control lag rahe hain
- [ ] Console me koi 404/JS error nahi

---

## 7. CLI se deploy (Git integration ke bina — optional)

Agar dashboard se Git connect nahi karna, to apne laptop se:

```bash
npm ci
node scripts/pages/build-preview.mjs          # dist/ banega
npx wrangler pages deploy dist --project-name trendsyounique
```

`wrangler` pehli baar browser me Cloudflare login maangega (aapka account). Token wala rasta:
`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` env me daal kar same command.

> Agent yahan se deploy nahi kar sakta — sandbox me Cloudflare login/token nahi hai
> (aur token chat me daalna safe nahi hota).

---

## 8. Jo aapko karna hai (short list)

1. Cloudflare → Pages → Connect to Git → repo + `main` + build settings (§1).
2. First deploy → `pages.dev` URL par full test (§6).
3. Custom domains: `trendsyounique.fashion` + `www...` → Activate.
4. `www → apex` 301 redirect rule + Always Use HTTPS on.
5. Sab theek → Netlify/Vercel ka deploy **band na karein** (rollback ke liye 1–2 hafte rakhein).
6. Mujhe `pages.dev` URL dein → main headers/cache/redirects verify kar dunga.
