# Deploy — production storefront (Vercel)

`trendsyounique.fashion` ka **production target** Vercel project `trends-younique` hai.
GitHub Pages sirf project preview (`https://mystorebyme.github.io/manoj-Product/`) hai —
custom domain claim nahi.

## Project (asli settings)

| Setting | Value |
| --- | --- |
| Team | `prakashs-projects-ad474173` (`team_Uy1pjnl8Qgh0P8nw55xpEvsO`) |
| Project | `trends-younique` (`prj_EQ3QLpdZAFF6fnLQSHjOte7p4Crb`) |
| Git | `mystorebyme/manoj-Product`, production branch `main` |
| Framework | `vite` (static export) |
| Install | `npm ci --include=dev --no-audit --no-fund` |
| Build | `node scripts/pages/build-preview.mjs` |
| Output | `dist` |
| Node | `24.x` |
| Production URL | `https://trends-younique.vercel.app` |

`main` par push = naya production deployment + automatic aliases. Git integration on hai;
PR = SSO-protected preview URL.

## Domains (Vercel project me already added)

- `trendsyounique.fashion` (apex, verified)
- `www.trendsyounique.fashion` (verified)
- `trends-younique.vercel.app` (built-in)

> Preview `*.vercel.app` URLs SSO-protected hain (`all_except_custom_domains`).
> Custom domain par SSO nahi lagta — isliye Cloudflare se domain Vercel par point
> karte hi site public ho jaati hai, bina login ke.

## Env vars (production + preview)

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://trendsyounique.fashion` |
| `NEXT_PUBLIC_GSC_VERIFICATION` | `hFaqyp-9LdUXSKPA9RF011TkO2m_-7AUMasXqm_0dGI` |
| `NEXT_PUBLIC_CAMPAIGN_ID` | `diwali-2026` |
| `NEXT_PUBLIC_CAMPAIGN_START` | `2026-10-24T00:00:00+05:30` |
| `NEXT_PUBLIC_CAMPAIGN_END` | `2026-11-30T23:59:59+05:30` |

`NEXT_PUBLIC_SITE_URL` se canonical, OG, `robots.txt` host, `sitemap.xml` aur WhatsApp/
invoice links custom domain par bante hain. Badalne ke baad production redeploy zaroori.

## Cloudflare DNS

Vercel `get_domain_config` ke mutabik domain pehle se `misconfigured: false` /
`ipStatus: no-change` hai. Naye records daalne hon to:

| Name | Type | Value |
| --- | --- | --- |
| `@` | A | `216.198.79.1` |
| `@` | A | `64.29.17.1` |
| `@` (alternate) | A | `76.76.21.21` |
| `@` (CNAME flattening) | CNAME | `cname.vercel-dns.com.` |
| `www` | CNAME | `cname.vercel-dns.com.` |

Vercel-specific CNAME: `9df202833530d309.vercel-dns-017.com.`.

## Redeploy / verify

Vercel dashboard → Deployments → **Redeploy (production)**, ya connector se
`create_deployment` with `git_source.ref=main`, `target=production`.

```bash
curl -I https://trendsyounique.fashion
curl -s https://trendsyounique.fashion/robots.txt | grep -i '^Host:'
# expected: Host: https://trendsyounique.fashion
```
