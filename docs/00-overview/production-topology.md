# Production topology — kya asli me chal raha hai (verified)

> **Ye file "sach" hai.** Repo me purane docs (Liksha Clothing era: Vercel + Render + Postgres +
> Razorpay) bhi pade hain — wo **historical** hain. Kuch bhi build/deploy karne se pehle yahi file
> padho. Last verified: **Round 39/40 (Oct 2026)**, `docs/09-devops/cloudflare-pages.md`,
> `docs/09-devops/round-38.md`.

## 1. Customer-facing site (jo log dekhte hain)

| Cheez | Value |
| --- | --- |
| Domain | `https://trendsyounique.fashion` (+ `www` → apex 301) |
| Hosting | **static export** — Cloudflare Pages (target) / Netlify (purana) / GitHub Pages preview |
| Build | `node scripts/pages/build-preview.mjs` → `dist/` (4,768 files, ~135 MB) |
| Framework | Next.js 16 App Router, **`output: "export"`** — koi Node server nahi |
| Server | **nahi**. `src/app/api/*` aur `src/app/orders` build ke waqt hata diye jaate hain |
| Live check | `https://trendsyounique.fashion/api/health` → site ka **404** (yaani API nahi chal raha) |

## 2. Data + business logic (sheet)

```
browser ──► Cloudflare/Netlify (static) ──► Apps Script web app ──► Google Sheet
                       │                          (data + order + tracking + email)
                       └──► WhatsApp (order confirm, support)
```

| Cheez | Kahan |
| --- | --- |
| Database | Google Sheet `1ag5Ivpw8GWkX8oE5_KLe77GFR4KP-7uQFKsmjeZ2xVY` |
| Engine | `scripts/google-apps-script/trends-sheets.gs` (**r20**, `setup` + `selftest`) |
| Website endpoints | `?action=public/products_public/stock/order_status/timeline/invoice…` |
| Order flow | checkout → Apps Script `place_order` → Sheet row + customer email + owner alert |
| Email | MailQueue + provider chain (Brevo/EmailJS/Resend/Mailjet/ElasticEmail/Web3Forms) |
| Payments | **online payment nahi** — sirf UPI details WhatsApp par owner bhejta hai |
| Support number | +91 7740992663 |

## 3. Repo ke hisse: live vs legacy

| Path | Status |
| --- | --- |
| `apps/web` | **LIVE** — storefront (static export) |
| `scripts/google-apps-script/trends-sheets.gs` | **LIVE** — poori backend (Sheet DB) |
| `scripts/pages/build-preview.mjs` | **LIVE** — production build |
| `apps/admin` | **LIVE (separate)** — owner panel, `noindex`, yahan deploy nahi hota |
| `apps/api` | **LEGACY** — Express API; production me use nahi hoti (build me nahi jaati) |
| `packages/*` | shared types/validation — web build me compile hote hain |
| Postgres / Prisma / Razorpay / OTP | **LEGACY** — code mojood, production build me nahi |

## 4. Golden commands (sach wale)

```bash
npm ci
npm run build:preview        # = node scripts/pages/build-preview.mjs  → dist/
npm run typecheck            # web + admin + api
npm run test:unit            # 202 tests (storefront + apps-script harness)
npm run sheet:test           # 16 tests — Apps Script Node me chalta hai
npm run lint                 # eslint (web)
npm run docs:check           # living docs ke toote links
npm run verify               # typecheck + unit + sheet:test + lint + docs
```

## 5. Deploy

- **Cloudflare Pages** (target): `docs/09-devops/cloudflare-pages.md` (build command,
  `dist`, env vars, custom domain, rollback).
- **Netlify** (purana, rollback ke liye): `netlify.toml` — same build command + `dist`.
- **Apps Script**: naya `trends-sheets.gs` paste → `setup` Run → **Deploy → New version**
  (URL wahi rehta hai). Detail: `docs/09-devops/round-38.md` §4–§7.
- Site deploy aur Apps Script deploy **alag** hain. Sheet ka code badla to site ko chhune
  ki zaroorat nahi, aur ulta bhi.

## 6. Paisa / limits

Sab free tier: Cloudflare Pages (static unlimited requests), Apps Script (Sheets API quota),
MailApp 100/din, free email providers (Brevo 300/din etc.). Koi paid service production me
nahi hai — **isliye** payment gateway bhi nahi.
