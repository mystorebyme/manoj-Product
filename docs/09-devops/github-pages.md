# GitHub Pages — live site (`https://trendsyounique.fashion`)

> **Ye ab primary hosting hai.** Domain `trendsyounique.fashion` GitHub Pages par lagi hai,
> aur site **root** par serve hoti hai (`/products/...`, `/collections/...`).
> Netlify/Cloudflare setup purane hain (`docs/09-devops/netlify.md`, `cloudflare-pages.md`)
> aur rollback ke liye rakhe hain.

Workflow: `.github/workflows/pages.yml` → build job `scripts/pages/build-preview.mjs` chalata hai,
`dist/` banata hai, phir `actions/deploy-pages` usse publish karta hai.

---

## 1. Sabse zaroori baat — base path

| Site kahan khul rahi hai | `PAGES_BASE_PATH` |
| --- | --- |
| Custom domain (`trendsyounique.fashion`) — **production** | **khaali** (`/`) |
| `mystorebyme.github.io/manoj-Product` (bina domain, project site) | `/manoj-Product` |

Custom domain wali Pages site **domain root** par serve hoti hai. Agar build me base path
`/manoj-Product` reh jaye to HTML/JS ka har reference `/manoj-Product/_next/...`,
`/manoj-Product/images/...` ban jaata hai → **CSS, JS aur saari images 404** → page
bilkul toota hua (yehi 29 Oct wala bug tha).

Isliye workflow khud decide karta hai (`Resolve site URL + base path` step):

- repo variable `PAGES_CUSTOM_DOMAIN` (default `trendsyounique.fashion`) set/naam maujood →
  base path khaali, `NEXT_PUBLIC_SITE_URL=https://<domain>`
- variable ko `none` kar dein → preview mode: base path `/<repo>`, site URL `https://<owner>.github.io/<repo>`

Override chahiye to repo → **Settings → Variables → Actions → `PAGES_BASE_PATH`** set kar dein.

### Guard

Build ke baad `Verify build URLs` step check karta hai:

- root deploy me `index.html` me `/manoj-Product/_next/` nahi hona chahiye (warna fail),
- `robots.txt` + `sitemap.xml` me site URL hona chahiye,
- custom domain ho to `dist/CNAME` me wahi domain hona chahiye.

Yani base-path wala bug dobara chupchaap live nahi ja sakta.

---

## 2. CNAME (custom domain)

`build-preview.mjs` `dist/CNAME` likhta hai (`PAGES_CUSTOM_DOMAIN` se). Iske bina har naye
deploy par GitHub Pages custom domain bhool sakta hai (site `404` / default domain par).

Pages setting (ek baar): repo → **Settings → Pages**

| Field | Value |
| --- | --- |
| Source | **GitHub Actions** |
| Custom domain | `trendsyounique.fashion` |
| Enforce HTTPS | on (Cloudflare proxy ke saath "Full (strict)" SSL mode rakhein) |

DNS (Cloudflare):

| Record | Name | Value |
| --- | --- | --- |
| CNAME | `@` (apex, proxied) | `mystorebyme.github.io` |
| CNAME | `www` (proxied) | `mystorebyme.github.io` |

`www` + apex dono par site khulti hai; canonical ek hi (`https://trendsyounique.fashion`).

---

## 3. Purane link (`/manoj-Product/...`) → root

Domain se pehle site `mystorebyme.github.io/manoj-Product` par thi, isliye Google index,
WhatsApp messages aur purane shares me `/manoj-Product/...` link hain. Build har page ke liye
chhota redirect page banata hai:

```
/manoj-Product/products/ruhi-wine-anarkali-floral-sleeve-set/
        → 301-style meta refresh + JS → /products/ruhi-wine-anarkali-floral-sleeve-set/
```

- list repo variable `PAGES_LEGACY_BASE_PATHS` se aati hai (comma separated, default `/<repo>`)
- agar current base path hi legacy path hai (preview mode) to stubs banti hi nahi
- stubs me `noindex,follow` + canonical naye URL ka — SEO duplicate nahi banta

---

## 4. Deploy ke baad ek baar — Cloudflare cache purge

Domain Cloudflare proxy se jaata hai, isliye migration ke waqt purane **404 / Netlify pause**
pages cache me pade reh sakte hain (jaise `/manoj-Product/` par Netlify ka "site paused" page).

Cloudflare dashboard → **Caching → Configuration → Purge Everything** (ek baar).
Uske baad:

```bash
curl -sI https://trendsyounique.fashion/ | head -3
curl -s https://trendsyounique.fashion/robots.txt | tail -2   # Host + Sitemap = own domain
curl -s https://trendsyounique.fashion/ | grep -o '/_next/[^"]*' | head -1   # base path khaali
```

---

## 5. Deploy kaise hota hai

| Kab | Kya |
| --- | --- |
| push to `main` / production branch | build + deploy (auto) |
| manual | Actions → **Deploy site (GitHub Pages)** → *Run workflow* |
| local test | `PAGES_BASE_PATH="" NEXT_PUBLIC_SITE_URL=https://trendsyounique.fashion PAGES_CUSTOM_DOMAIN=trendsyounique.fashion node scripts/pages/build-preview.mjs` |

Build ~1 min (Next static export, ~5,300 files, ~137 MB). Artifact `static-preview` 14 din rakha
jaata hai — rollback ke liye Actions se purana run dobara deploy karein.

**Rollback:** Actions → purana successful run → *Re-run all jobs* (build + deploy dobara).
