# CLAUDE.md

Claude / Codex / koi bhi coding agent — **yahi se shuru karo**. Poora sach:
`docs/00-overview/production-topology.md`. Kahan kya hai: `docs/00-overview/repo-map.md`.
Rules: `AGENTS.md`.

## TL;DR (Round 39 tak ka sach)

- **Site static hai.** `apps/web` (Next.js 16) `output: "export"` se build hoti hai →
  `dist/` → Cloudflare Pages / Netlify. **Koi Node server production me nahi.**
- **Backend = Google Apps Script + Google Sheet** (`scripts/google-apps-script/trends-sheets.gs`,
  r20). Order, stock, tracking, email, reviews — sab wahan. Site sirf `?action=…` endpoints
  call karti hai. `src/app/api/*` build ke waqt hata diya jaata hai — naya server route
  mat add karo.
- **Online payment nahi hai** (by design). Order → WhatsApp + Sheet; UPI detail owner bhejta hai.
- **Domain:** `trendsyounique.fashion` (Cloudflare zone). Contact: +91 7740992663.
- Monorepo me `apps/admin` (owner panel, alag deploy) aur `apps/api` (**legacy**, production
  me use nahi) bhi hain — lekin production storefront unhe nahi chalata.

## Verify loop (paisa/order touch karne se pehle)

```bash
npm ci                       # node_modules snapshot me nahi aata — pehle chalao
npm run verify               # typecheck + unit + sheet:test + lint + docs:check
npm run build:preview        # dist/ — deploy jaisa build
```

Bhejne se pehle: `PROGRESS.md` me ek line; behaviour badla to `docs/` update.

## Skills (`.claude/skills/`)

`storefront-ui` · `sheet-backend` · `catalogue-sync` · `order-lifecycle` · `api-module` · `admin-panel` ·
`database-prisma` · `testing` · `deploy-ops` · `monorepo-conventions` · `security-baseline` ·
`storefront-quality` · `ecommerce-payments` · `inventory-concurrency` · `india-compliance` ·
`agent-common-mistakes`

Task se match hone wali skill pehle padho. `database-prisma`, `api-module` aur
`ecommerce-payments` **legacy** code ke liye hain (production me nahi chalte) — storefront ka
kaam unse nahi hota.

## Known traps

- `src/data/catalog.json` generated hai — hand-edit nahi; `npm run catalog:build`.
- Client component me `@/lib/store` / `catalog.json` import mat karo (bundle phat jaata hai).
  Client data `catalog-lite.json` se aata hai.
- `.gs` file par `node --check` seedha nahi chalta — pehle `.js` me copy karo.
- Apps Script me `includes` par bharosa mat karo — `indexOf` use karo.
- Admin build root se nahi chalti: `cd apps/admin && npx next build`.
- **Client me localStorage/scroll/UA padhna ho to `lib/client-env.ts` / `lib/local-store.ts`
  use karo** — `useEffect(() => setState(read()), [])` mat likho (lint `react-hooks/set-state-in-effect`
  pakadta hai; `docs/09-devops/repo-audit.md` §Round 41 me pattern samjhaya hai).
- Sandbox me bash se internet sirf GitHub/npm tak hai — live checks ke liye `fetch` tool.
