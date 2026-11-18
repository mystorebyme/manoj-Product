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

## Deployment workflows (Round 36 — sahi TRENDS YOUNIQUE tree)

| Workflow | Trigger | Kahan deploy |
| --- | --- | --- |
| `pages.yml` — GitHub Pages — TRENDS YOUNIQUE (custom domain) | `main` push, session branch (build only), `workflow_dispatch` | `https://trendsyounique.fashion` (GitHub Pages) |
| `ci.yml` — CI | `main` push, PR, manual | gate only (typecheck · build · tests · smoke) |
| `deploy.yml` — Deploy | manual, ya `ENABLE_VERCEL_DEPLOY=true` variable ke saath `main` push | Vercel (web/admin) + Render hook (api) |
| `catalog-sync.yml` / `reviews-sync.yml` | daily cron + manual | catalogue/reviews seed commit |

`pages.yml` root `CNAME` dekh kar base path decide karta hai: custom domain ho to `/`
(root), warna `/<repo>`. Har artifact me `CNAME` + `.nojekyll` jaate hain,
`NEXT_PUBLIC_SITE_URL` custom domain par set hota hai. `github-pages` environment ki
branch policy sirf `main` allow karti hai — isliye feature branch par deploy job skip
hota hai aur build verify hoti hai. Purana GitHub sample `nextjs.yml` restore me hata
diya gaya tha (dono ek hi `pages` concurrency group use karte the, aur `./out` bina
`output: export` ke build karta tha).

Details: `docs/09-devops/domain-and-brand.md` §3.5.
