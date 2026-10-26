# Repo map — "mujhe X badalna hai, kahan jaun?"

> Ye **knowledge map** hai (code search se pehle yahi padho). Har entry me file path +
> ek line ki "kya hai". Live/legacy ka farq: `docs/00-overview/production-topology.md`.

## 1. Data flow (ek nazar me)

```
database/seeds/catalog.json ──► scripts/build-catalog.mjs ──► apps/web/src/data/catalog.json
                                                            └► apps/web/public/data/*.json (+catalog-lite)
apps/web (static export) ──► Apps Script (trends-sheets.gs) ──► Google Sheet
                                     └► MailQueue ──► provider chain ──► customer / owner email
                                     └► WhatsApp link (browser)
```

## 2. "Ye badalna hai" → file

| Kaam | File |
| --- | --- |
| Product ka price/photo/naam (sheet se) | Google Sheet `Products` / `ProductList` / `ProductImages` (code nahi) |
| Product ka static fallback data | `database/seeds/catalog.json` + `npm run catalog:build` |
| Home page ka layout | `apps/web/src/app/page.tsx`, `components/home-*` |
| Header / nav / announcement | `components/site-header.tsx`, `announcement-bar.tsx` |
| Product page (gallery, size, stock line) | `components/product-detail.tsx`, `product-gallery.tsx`, `lib/sheet-stock.ts` |
| Collection + filters + Load more | `components/collection-browser.tsx`, `lib/catalog-lite.ts` |
| Cart ki logic (limits, qty) | `components/cart-provider.tsx`, `packages/validation` |
| Checkout + WhatsApp + sheet relay | `components/checkout-form.tsx`, `lib/sheet-relay.ts` |
| Track order page | `components/track-order-form.tsx`, `apps/web/src/app/track-order/page.tsx` |
| Order email / templates / queue | `scripts/google-apps-script/trends-sheets.gs` (BHAG 9 + 9b) |
| Sheet schema / tabs | same file — `HEADERS` object (sabse upar) |
| Site ke security headers / cache | `apps/web/public/_headers` |
| Deploy config | `netlify.toml`, `docs/09-devops/cloudflare-pages.md` |
| Build script | `scripts/pages/build-preview.mjs` |
| Browser-only data (localStorage, scroll, UA, URL query) | `apps/web/src/lib/local-store.ts`, `lib/client-env.ts` |
| Collection ke URL filters (`?sort=&price=`) | `apps/web/src/lib/collection-filters.ts` |
| Test harness (Apps Script ko Node me chalana) | `tests/helpers/apps-script-harness.mjs` |

## 3. Tests ka naksha

| Suite | Command | Kya cover |
| --- | --- | --- |
| Unit (202) | `npm run test:unit` | pricing, cart, tracking steps, sheet headers, apps-script engine |
| Apps Script (16) | `npm run sheet:test` | setup, self-test (115 check), order flow, email provider chain |
| Integration | `npm run test:integration` | API endpoints (legacy API) |
| DB | `npm run test:db` | Postgres migrations (legacy) |
| E2E | `npm run test:e2e` | Playwright (optional, manual) |
| Docs links | `npm run docs:check` | living docs ke toote path |
| Smoke (build ke baad) | `npm run test:smoke` | live server par routes |

## 4. Guardrails jo pehle se hain

- `.claude/skills/*` — 17 skills, task ke hisaab se padho (`storefront-ui`, `sheet-backend`,
  `order-lifecycle`, `deploy-ops`, `testing`, `agent-common-mistakes`…). Sheet DB chhedna ho to
  **`sheet-backend`** pehle padho.
- `AGENTS.md` — 10 rules + "never do" list.
- `docs/09-devops/repo-audit.md` — Round 40 ka audit (kya toota tha, kya fix hua).
- `.github/workflows/ci.yml` — typecheck, lint, tests, docs-check, build.

## 5. Traps (jo dobara nahi dohrane)

1. `apps/web` ko **static export** me chalana hai — koi route handler likha to build side me
   chala jayega (ya build fail). Server logic = Apps Script.
2. `src/data/catalog.json` hand-edit mat karo — generated hai.
3. `.gs` file ko `node --check` se pehle `.js` copy karke check karo (`node --check f.gs` fail).
4. Apps Script me `includes` nahi hota (V8 me hoga par sheet ke liye `indexOf` use karte hain).
5. Admin build root se nahi chalti: `cd apps/admin && npx next build`.
6. `node_modules` snapshot me nahi aata — session shuru me `npm ci` chalao.
