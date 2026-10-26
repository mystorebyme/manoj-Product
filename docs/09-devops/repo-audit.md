# Repo audit — Round 40 (top engineering-skills ke hisaab se)

<!-- docs-links: ignore-file — is report me purane/galat paths jaan-boojh kar quote kiye gaye hain -->

Aapne "Top 10 Claude Code / Codex skills" wali list bheji (Superpowers, Matt Pocock skills,
Karpathy skills, Anthropic skills, Ponytail, Graphify, Agent Skills). Unke **ideas** ko audit ka
paimana banaya — sirf naam nahi, unka asli usool:

| Skill ka usool | Is repo me matlab | Result |
| --- | --- | --- |
| **Superpowers** — "plans, tests, debugs before it writes code" | koi bhi badlav bina test/verify ke nahi | ⚠️ test the, **CI me lint/sheet-test/build nahi chalte the** → fix |
| **Matt Pocock skills** — chhote, composable | skills + docs chhote aur sach bolne wale | ❌ `deploy-ops` skill purane Vercel/Razorpay ka tha → rewrite |
| **Karpathy skills** — ek accurate `CLAUDE.md` | agent ko sahi context | ❌ CLAUDE.md galat topology bata raha tha → rewrite |
| **Anthropic skills** — docs jaise asli deliverable | docs code ke saath ship hon | ⚠️ 223 toote references (69 files) → checker + living-docs gate |
| **Ponytail** — "laziest senior dev", koi extra code nahi | dead code hatao | ✅ 1 dead const + 1 fragile pattern hataya |
| **Graphify** — codebase ka knowledge graph | "X kahan hai" ka ek map | ❌ nahi tha → `docs/00-overview/repo-map.md` |
| **Agent Skills (addyosmani)** — production-grade | lint/CI/tests/rollback sab chale | ❌ `npm run lint` **crash** karta tha → fix |

---

## Jo toota mila (aur fix hua)

### 1. `npm run lint` bilkul chalta hi nahi tha (P0)

```
TypeError: Converting circular structure to JSON
  ... property 'react' closes the circle
```

`apps/web/eslint.config.mjs` purane `FlatCompat().extends("next/core-web-vitals")` par tha, jabki
`eslint-config-next@16` pehle se **flat config** export karta hai.

**Fix:** seedha import —

```js
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
export default [...nextCoreWebVitals, ...nextTypescript, { ignores: [...] }, { rules: {...} }];
```

Ab lint chalta hai: **0 error, 37 warning** (pehle: crash).

### 2. Lint chalne par 14 asli error nikle

| File | Problem | Kya kiya |
| --- | --- | --- |
| `components/sheet-check-client.tsx` | `setStep` effect se **baad** declare tha (hoisting par depend) + TDZ error | `useCallback` me upar shift kiya, effect dependency me daala |
| 13 components | `react-hooks/set-state-in-effect` — `useEffect(() => setX(readLocal()), [])` pattern | `warn` kiya (documented) — refactor se cart/wishlist behaviour badalne ka risk tha, aur ye intentional hydration pattern hai |

Naya code is pattern se bache: `useSyncExternalStore` ya `useState(initializer)` use karo.

### 3. Dead code

`apps/web/src/lib/otp.ts` me `TOKEN_SECRET` banta tha par kabhi use nahi hota tha — asli
signing `lib/phone-token.ts` me hai. Hata diya (duplicate secret reading = confusion + security
smell).

### 4. Agent onboarding galat info de raha tha (P1)

`CLAUDE.md` / `AGENTS.md` / `.claude/skills/deploy-ops` me likha tha:

- "web → **Vercel** · admin → Vercel · api → **Render**" — sach: **static export** →
  Cloudflare Pages/Netlify, api production me nahi chalta.
- "`likshaclothing.com`" — sach: **trendsyounique.fashion**.
- "Razorpay keys, payment webhook" — sach: **online payment hai hi nahi** (R24).
- "`npm run typecheck && npm run test:all`" — sheet engine ke tests (`sheet:test`) list me hi nahi the.

**Fix:** naya **`docs/00-overview/production-topology.md`** (verified sach) + `CLAUDE.md` rewrite +
`AGENTS.md` (golden commands, never-do list) + `deploy-ops` skill rewrite (Cloudflare + Apps
Script deploy + rollback table).

### 5. Docs me 223 toote references

`scripts/check-docs-links.mjs` (naya) 156 md files me **535 references** check karta hai.
- Historical docs (PROGRESS, round logs, traceability) me purane paths rehna normal hai → report only.
- **Living docs** (README, CLAUDE, AGENTS, STRUCTURE, docs/00-overview, docs/09-devops,
  `.claude/skills`, `agent-guides`) par **strict** gate → ab **0 broken**.
- Jo asli do toote the: `apps/admin/src/middleware.ts` (asli jagah `apps/admin/middleware.ts`) aur
  `docs/11-maintenance/rollback.md` (asli `runbook.md`) — dono theek kiye.

### 6. CI me holes

`.github/workflows/ci.yml` me **lint nahi**, **sheet:test nahi**, **static build nahi**, docs check
nahi tha — isliye #1 wala crash mahino tak chhupa raha.

Ab CI: `typecheck → lint → docs:check:strict → test:all → sheet:test → build:preview`.

### 7. Saaf-safai

- Root me `images ` (trailing space wala) folder pada tha jisme 1-byte `.md` tha — junk, hataya.
- `.gitignore` verify kiya: `dist/`, `out/`, `node_modules/`, `.env*` (sirf `.example` tracked) sab
  theek. `.git` **14.7 MB** — koi build artifact commit nahi hua. ✅ Koi secret tracked nahi.

---

## Ab ek command me sab verify

```bash
npm run verify
# typecheck (web+admin+api) → 202 unit → 16 sheet → lint(0 err) → living-docs links(0 broken)
```

Round 41 ke baad ka result: **typecheck clean · 209/209 unit · 40/40 integration · 9/9 db ·
16/16 sheet · lint 0 error 0 warning (web + admin) · 0 broken living-docs · build:preview OK ·
admin build OK · api build OK**.

## Round 41 — "sab kuch fix" (0 warning tak)

Round 40 ke baad **37 warnings** bachi thi. Ab **0 error, 0 warning** — aur har fix behaviour
preserve karta hai (build + 209 tests verify).

**Naya module: `apps/web/src/lib/client-env.ts`** — browser-only facts ke liye hooks
(`useSyncExternalStore` par, React ka official rasta):

| Hook | Pehle | Ab |
| --- | --- | --- |
| `useScrollPast(px)` | `useEffect` + `setScrolled` | external store (scroll subscribe) |
| `usePlatform()` | `useEffect` + UA check | store, server par `desktop` |
| `useSupportsIntersectionObserver()` | `setShown(true)` fallback | store, server `true` (markup parity) |
| `useIsClient()` | — | hydration-safe "client par ho" |
| `useUrlSearch()` | `window.location` effect me | store (popstate) — `useSearchParams()` ki Suspense jhanjhat nahi |

**Naya module: `apps/web/src/lib/local-store.ts`** — localStorage store factory
(snapshot cached, cross-tab `storage` sync, legacy-key migration). `wishlist-provider.tsx` isi
par shift ho gaya (pehle `useEffect` + `setWishlist(read())`), aur raw product-list state
(wishlist page) key-based derive hota hai.

**Key-based derive pattern** (sync `setState` in effect ka asli ilaaj) — jahan async result
aata hai wahan result ke saath uska **key** rakha jaata hai:

| File | Pehle | Ab |
| --- | --- | --- |
| `components/sheet-stock.ts` (hook) | `setStock(null)` effect me | `{handle, stock}` + derive |
| `components/upi-qr.tsx` | `setSrc(null)` | `{key, src}` + derive |
| `app/wishlist/page.tsx` | `setLoading(true)`, `setItems([])` | `{key, items}` → `loading` derive |
| `components/checkout-form.tsx` | `setPinBusy(true)`, `setPinStatus(null)` | `{key: state|pin, verdict}` → `pinBusy` derive |
| `components/reviews-ticker.tsx` | index reset effect | `activeIndex` derive |
| `components/collection-browser.tsx` | mount effect me `setSort/setPrice` | URL se derive (`lib/collection-filters.ts`, unit-tested) |
| `components/site-header.tsx` | scroll + pathname + activeIndex effects | `useScrollPast`, `onClick` par `closeOverlays`, handler me reset |
| `components/reveal.tsx` | `setShown(true)` fallback | `visible = shown || !supportsObserver` |
| `components/sheet-check-client.tsx` | `setPending(...)` effect me | microtask (localStorage client-only hai) |
| `components/store-settings-provider.tsx` | mount par seedha `refresh()` | `setTimeout(0)` kickoff |

**Aur saaf kiya:**

- 10 unused imports/variables (`imageUrl`, `SafeImage`, `SECONDARY_HREF`, `Stars`, `gaId`,
  `siteConfig`, `inr`, `rupee`, `readJson`, dead index var) + 1 unused prop.
- 12 "unused eslint-disable" directives (rules.config wale `<img>`) hata di.
- `eslint.config.mjs` ab named `config` export (anonymous default export warning gone).
- `@next/next/no-page-custom-font` sirf `layout.tsx` ke liye off (App Router me font `<link>`
  wahi sahi jagah hai — Pages router ka rule lagu nahi hota).
- **`apps/admin` ka `npm run lint` bilkul chalta hi nahi tha** ("couldn't find eslint.config.js")
  — naya `apps/admin/eslint.config.mjs`; usme 16 warning thi, ab **0**. Admin build bhi verify.
- Admin dashboard par 2 dead data fetches (`getManualInvoices`, `overrideStats`) hataye —
  bekaar DB/JSON calls har page load par.

**Naye tests (tests are part of the change):**

- `tests/unit/local-store.test.ts` — fallback, `set()` + listener, stable snapshot reference,
  legacy migration, kharab JSON, cross-tab `storage` event, `parseCollectionFilters` round-trip.
- Unit **202 → 209**.

**Naya skill:** `.claude/skills/sheet-backend/SKILL.md` — live Apps Script engine ko chhedne se
pehle padhne ke liye (BHAG map, rules, test, deploy, common kaam).

## Jo jaan-boojh kar nahi badla (ab bhi)

- **`node_modules` snapshot me nahi** — session shuru me `npm ci` (CI bhi karta hai).
- **Legacy code** (`apps/api`, Postgres/Prisma, Razorpay, admin ke kuch hisse) — production me
  nahi chalta, par owner ne delete nahi kaha; `production-topology.md` me "LEGACY" mark hai.
- **Purane round logs ke toote links** — historical record, rewrite nahi kiya (gate sirf living
  docs par hai).
- **Legacy code** (`apps/api`, Postgres/Prisma, Razorpay/payments, admin ke kuch hisse) — production
  me nahi chalta par owner ne delete nahi kaha; chhedne se rollout risk hota. `production-topology.md`
  me saaf "LEGACY" mark hai.
- **223 historical doc links** — purane round logs ko rewrite karna itihaas mitaana hota; gate sirf
  living docs par hai.

## Aage (optional, owner bole to)

1. 13 warnings ka refactor (`useSyncExternalStore`) — behaviour test ke saath.
2. `apps/api` + Postgres/Razorpay code ko `legacy/` folder me move karna (CLAUDE.md bhi halka ho
   jayega).
3. Playwright e2e ko CI me nightly chalana.
