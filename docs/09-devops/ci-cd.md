# CI/CD

## Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml (summary)
jobs:
  verify:
    - actions/checkout
    - setup-node 22 + cache npm
    - npm ci
    - npm run typecheck
    - npm run build --workspace @liksha/web
    - npm run build --workspace @liksha/admin
    - npm run build --workspace @liksha/api
    - npm test
  e2e:
    needs: verify
    - npx playwright install --with-deps chromium
    - npm run test:e2e
  deploy:
    needs: [verify, e2e]
    if: github.ref == 'refs/heads/main'
    - vercel deploy --prod (web)
    - vercel deploy --prod (admin)
    - render deploy hook (api)
```

## Gates

| Gate | Blocks merge |
| --- | --- |
| typecheck (3 apps) | ✅ |
| web build | ✅ |
| admin build | ✅ |
| api build | ✅ |
| unit tests | ✅ |
| e2e (main only) | warn on PR, block on main |
| `npm audit --omit=dev` high | warn |

## Branch strategy

- `main` = production.
- Feature branches → PR → squash merge (linear history).
- Hotfix branch → PR → merge → tag `v0.1.x`.

## Cache

- npm cache (`actions/setup-node` cache).
- Next build cache: `.next/cache` (Vercel handles; CI me optional).
- Playwright browsers cache.

## Failure playbook

Build fail → PR par fix, `main` par direct fix sirf deploy-breaking case me.
Deploy fail → previous deployment promote (Vercel instant rollback / Render previous deploy).

## Deployment workflows (Round 37 — Vercel production + Pages preview)

| Workflow | Trigger | Kahan deploy |
| --- | --- | --- |
| `trends-younique` (Vercel Git integration) | `main` push / PR | `https://trendsyounique.fashion` (production) · SSO-protected preview URLs |
| `pages.yml` — GitHub Pages project preview | `main` push, session branch (build only), `workflow_dispatch` | `https://mystorebyme.github.io/manoj-Product/` (preview only) |
| `ci.yml` — CI | `main` push, PR, manual | gate only (typecheck · build · tests · smoke) |
| `deploy.yml` — Deploy | manual, ya `ENABLE_VERCEL_DEPLOY=true` variable ke saath `main` push | Vercel (web/admin) + Render hook (api) |
| `catalog-sync.yml` / `reviews-sync.yml` | daily cron + manual | catalogue/reviews seed commit |

Production ab Vercel Git integration se `main` push par `trends-younique` me deploy hoti
hai; `NEXT_PUBLIC_SITE_URL=https://trendsyounique.fashion` env se canonical/sitemap/robots
custom domain par bante hain. `pages.yml` ab **sirf project preview** banata hai:
root `CNAME` aur Pages cname-attach step hata diye gaye hain, base path hamesha
`/<repo>` aur artifact me sirf `.nojekyll` jaata hai. Do platforms ek hi domain claim
na karein — Cloudflare DNS seedha Vercel par point karta hai. `github-pages` environment
ki branch policy sirf `main` allow karti hai — feature branch par deploy job skip hota
hai aur build verify hoti hai. Purana GitHub sample `nextjs.yml` restore me hata diya
gaya tha.

Details: `docs/09-devops/domain-and-brand.md` §3.5.
