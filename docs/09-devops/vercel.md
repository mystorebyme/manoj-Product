# Vercel — LIVE status (TRENDS YOUNIQUE)

## ✅ Link (abhi live)

**https://trends-younique.vercel.app**

- Project: `trends-younique` (`prj_EQ3QLpdZAFF6fnLQSHjOte7p4Crb`)
- Account/team: `prkigothwal@gmail.com` → team **Prakash's projects** (`prakashs-projects-ad474173`, Hobby plan)
- Branch: `arena/e13f4af5-manoj-product` (production)
- Last good deploy: `dpl_5tdFKb5TMP1UNo5Gnr4eJrixbNmA` (READY / PROMOTED)

## Settings jo set hain

| Setting | Value |
| --- | --- |
| Framework preset | `vite` → isliye `dist/` **static** output serve hota hai (nextjs preset `.next` maangta hai) |
| Install command | `npm ci --include=dev --no-audit --no-fund` (Vercel `NODE_ENV=production` set karta hai, warna tailwind devDep skip ho jaata) |
| Build command | `node scripts/pages/build-preview.mjs` |
| Output directory | `dist` |
| Env vars | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GSC_VERIFICATION`, `NEXT_PUBLIC_CAMPAIGN_ID/_START/_END` |

`PAGES_BASE_PATH` / `NEXT_PUBLIC_API_BASE_URL` khaali (root domain + koi Node API nahi).

## Domain — add ho gaya, DNS baaki

`trendsyounique.fashion` **aur** `www.trendsyounique.fashion` project par add ho gaye
(Vercel par verified). DNS abhi **GoDaddy** par hai (nameservers `ns37/ns38.domaincontrol.com`)
aur parking IPs (`3.33.130.190`, `15.197.148.33`) par ja raha hai — isliye `misconfigured: true`.

GoDaddy → **My Products → Domain → DNS** me do record:

| Type | Name | Value | TTL |
| --- | --- | --- | --- |
| A | `@` | `76.76.21.21` | default |
| CNAME | `www` | `cname.vercel-dns.com` | default |

Purane parking records (GoDaddy "Parked" A/CNAME) delete kar dein. 10–30 min me HTTPS
khud ban jaata hai.

> DNS badalne ke baad main `NEXT_PUBLIC_SITE_URL` ko `https://trendsyounique.fashion`
> kar dunga + redeploy — tab canonical/OG/sitemap domain par chale jayenge.

## Admin par Vercel

Vercel ka filesystem read-only hai, isliye admin (`apps/admin`) yahan nahi chalega —
`localhost:3001` ya Render. Dekhein [`admin-access.md`](./admin-access.md).

## Auto-deploy (optional, ek click)

Project → **Settings → Git** → Connect `mystorebyme/manoj-Product` → Production branch
`arena/e13f4af5-manoj-product`. Uske baad har `git push` par deploy khud ho jayega.
(Abhi deploys API se trigger hote hain, isliye push ke baad mujhe bolna padta hai.)
