# DNS & domains

> **Current (Nov 2026):** production Vercel `trends-younique` par hai. Cloudflare nameservers
> `duke.ns.cloudflare.com` / `karsyn.ns.cloudflare.com`; Vercel config `misconfigured: false`,
> `ipStatus: no-change`. GitHub Pages custom-domain claim repo se hata diya gaya hai.
## Records

| Name | Type | Value | TTL |
| --- | --- | --- | --- |
| `@` | A | `216.198.79.1` (Vercel anycast) | 300 |
| `@` | A | `64.29.17.1` (Vercel anycast) | 300 |
| `@` | A (alternate) | `76.76.21.21` | 300 |
| `@` | CNAME (flattening) | `cname.vercel-dns.com.` ya `9df202833530d309.vercel-dns-017.com.` | 300 |
| `www` | CNAME | `cname.vercel-dns.com.` | 300 |
| `admin` | CNAME | `cname.vercel-dns.com.` (separate admin project) | 300 |
| `api` | CNAME | `trends-younique-storefront.onrender.com` | 300 |
| `_dmarc` | TXT | `v=DMARC1; p=none; rua=mailto:…` | 3600 |
| `@` | TXT | SPF / Resend verification | 3600 |

## Steps

1. Cloudflare → DNS panel me upar wale `@` / `www` records daalein (proxy ON ya OFF — Vercel dono support karta hai).
2. Vercel project `trends-younique` → Domains me `trendsyounique.fashion` + `www` pehle se added/verified hain; naye add karne ki zarurat nahi.
3. Admin subdomain alag Vercel project me add karein (optional).
4. HTTPS auto (Let's Encrypt via Vercel); `www` → apex 308 redirect Vercel domain settings se.
5. Email deliverability: Resend domain verify (SPF + DKIM + DMARC), `EMAIL_FROM = orders@trendsyounique.com`.

## Old deployments

`trends-younique-storefront.onrender.com` (purana), `clone-trends-younique-website` (reference app) — DNS se point nahi karte.
GitHub Pages `mystorebyme.github.io/manoj-Product/` bhi sirf preview hai — custom domain par point nahi karta.
Purana deploy band karne se pehle 301 redirect: purana host → naya domain (2-4 hafte), phir shutdown.

## Verify

```bash
dig +short trendsyounique.fashion
curl -I https://trendsyounique.fashion | head -5
curl -I https://admin.trendsyounique.fashion   # 200 login, noindex header
```
