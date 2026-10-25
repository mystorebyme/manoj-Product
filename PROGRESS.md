# Progress

**Last updated:** 2026-10-24 (live-parity pass: galleries, OTP, tracking, GST invoice)

## Status snapshot

| Area | State | Evidence |
| --- | --- | --- |
| Catalogue (287 products, 9 collections, 1,971 images, live descriptions) | ✅ done | `npm run catalog:verify` → `catalog ok` (snapshot parity) |
| Storefront (live-clone home, 9 static PLPs, 287 static PDPs, gallery, cart, checkout + OTP, tracking, invoices, policies) | ✅ done | `npm run build:web` → 309 routes |
| Admin (login + 15 routes, server actions, audit) | ✅ done | `cd apps/admin && npx next build` → 16 routes |
| API (products, orders, payments, webhook, health) | ✅ done | `tsc` clean, `npm run test:integration` → 36 pass |
| Order lifecycle (pricing, coupons, COD, idempotency, transitions) | ✅ done | integration tests + HTTP tests |
| Phone OTP (Firebase) at checkout | ✅ code ready, keys pending | `docs/07-security/phone-otp.md` |
| GST invoice (HTML + PDF, phone-gated) | ✅ done | order page → Download invoice |
| Courier/AWB tracking (admin → customer) | ✅ done | admin order → Courier & tracking |
| Tests | ✅ 47 unit + 38 integration + 35 smoke checks | `npm run test:all`, `npm run test:smoke` |
| Docs 00–11 | ✅ 87 files | `docs/` |
| Skills (15), agent guides (6), infra, CI/CD | ✅ done | `.claude/skills`, `agent-guides`, `infra`, `.github` |
| Live Razorpay keys + webhook registration | ⛔ blocked on business KYC | env `RAZORPAY_*` empty |
| Full image galleries + exact `body_html` descriptions | ✅ done (live snapshot) | `database/seeds/live/`, `npm run catalog:sync` |
| Firebase project + authorized domains | ⏳ owner action | `docs/07-security/phone-otp.md` |
| Postgres migration | ⏳ Phase 2 | `database/prisma/schema.prisma` ready |

## Verified commands (this build)

```
npm run typecheck                       → 0 errors (web, admin, api)
npm test                                → 47 pass
npm run test:integration                → 36 pass
npm run catalog:verify                  → 287 products, 9 collections, catalog ok
npm run build --workspace @liksha/web   → compiled, 309 routes (287 PDP prerendered)
cd apps/admin && npx next build         → 16 routes
npm run build --workspace @liksha/api   → esbuild → dist/server.cjs (2.0MB bundle, boots in ~1.5s)
BASE_URL=… npm run test:smoke           → 20 pass
bash infra/monitoring/health.sh         → 9/9 endpoints ok
```

Runtime smoke (dev):
- `POST /api/orders` (COD, coupon) → order created, total computed server-side
- Same `Idempotency-Key` → same order, `idempotent-replay: true`
- COD above Rs. 3,500 → 400 `COD_NOT_ALLOWED`
- `GET /api/v1/orders` without Bearer → 401
- Admin `/` without cookie → 307 `/login`
- Order page renders timeline + support details

## Recent changes (this pass)

- Order status machine centralised in `@liksha/validation` (was duplicated in web/api/admin).
- Collision-safe order numbers (`LK-` + base36 time + 4 crypto chars; was 3 chars of `Math.random`).
- Disk-backed idempotency (web route + API middleware) — survives restarts, 7-day TTL.
- Strict size validation: unknown size is rejected with the valid options (no silent fallback).
- Admin server actions now require a valid session and take the actor from the session (not a form field).
- Size normalisation fixed: `"Red / L [40]"`, `"L(40)"`, `"XXL [44]"` → canonical `L [40]`, `2XL [44]`.
- Emoji handle sanitised to an ASCII slug, original kept in `sourceHandle`.
- `trending` collection populated from the live store (4 products, verified 2026-10-24).
- Health endpoints share the `{ data: … }` envelope.
- Collection pages are now **static** (9 SSG) with client-side sort/price filtering and shareable URLs;
  PLP HTML dropped to 101KB raw / 15KB gzip.
- Fixed broken sort dropdown (options pointed at non-existent sort keys: `price-asc`, `best-selling`).
- Removed the fake "filled" saree/wedding collections — empty collections now show an honest state and
  are `noindex` + excluded from the sitemap.
- API production build is an esbuild bundle (`dist/server.cjs` + `dist/worker.cjs`) — `tsc` had `noEmit`,
  so `node dist/server.js` could never have worked on Render.
- `data-testid` hooks added (product card, size options, add-to-cart, cart drawer, search, checkout, order number).
- Health endpoints share the `{ data: … }` envelope; docs aligned with the real API (`quantity`, flat customer
  fields, `price-low/price-high/discount` sort keys, 400 vs 409 codes).
- Customer-facing images render through `SafeImage` — a blocked/slow CDN now degrades to the brand
  placeholder instead of a broken icon (preview sandboxes fail Shopify CDN TLS).
- Security headers completed: HSTS on web + admin, CSP in report-only mode, `/api/health` and
  `/api/v1/health` share the same envelope.
- `allowedDevOrigins` added to both Next configs so sandbox/preview hosts can load HMR assets.
- New: 73 tests, smoke suite, Playwright spec, CI + deploy workflows, infra scripts,
  15 skills, 6 agent guides, root README/STRUCTURE/AGENTS/CLAUDE, docs 04–11.

## Round 2 — owner feedback (2026-10-24)

- **Colour merge:** same design ke different colours ab ek PDP me (10 designs / 20 colourways).
  Listing par sirf representative card (287 products → 277 cards), PDP par swatch switcher +
  `history.replaceState` (share karne par wahi colour khulta hai). Card par colour dots.
- **Size-wise pricing:** XL +Rs 100, 2XL +200, 3XL +300, 4XL +400, 5XL +500 (MRP se upar nahi jaata).
  PDP par live price + savings, cart/checkout/invoice usi price par.
- **Add to cart:** naya line cart me sabse **upar** (pehle niche add hota tha), "Just added" chip,
  drawer top par scroll, header par count.
- **Copy cleanup:** home ka "287 styles, one wardrobe" band + "Shop new arrivals" CTA hataya;
  payment badges (Visa/Mastercard/UPI/Rupay/COD) hataye; **prepaid only** — COD radio, COD fee,
  "COD under Rs. 3,500" ke saare strings (header, drawer, cart, policies, meta) hataye.
- **Remove controls:** cart page (icon button), checkout summary, order summary — teeno jagah item
  delete. Cart line par size + colour.
- **GST invoice:** PDF Amazon-style — maroon masthead + ORIGINAL FOR RECIPIENT, sold-by/GSTIN,
  invoice meta, billing + shipping boxes, HSN/qty/rate/taxable/GST%/CGST-SGST table, rate-wise tax
  summary, invoice total band, amount in words, declaration + authorised signatory, page x of y.
  HTML invoice bhi same layout me.
- **Descriptions:** emoji (🏻 skin tones samet) + copyright NOTE + `*markers*` strip — bullet copy
  saaf, `*FABRIC*` → **bold**.
- **Search:** typeahead suggestions (curated + live colours/fabrics), "Recommended for you" jab
  query khaali, "You may also like" jab result zero, search page par related searches + fallback grid.
- **Responsive:** 16px inputs on phones (iOS zoom fix), hover-only card CTA mobile par visible,
  touch devices par hover transform off, `overflow-x: clip`, tablet container padding.
- Docs/policies updated: shipping, terms, refund — COD ki jagah prepaid.

## Next up

1. `npm run catalog:sync-live` (internet) → full galleries + store descriptions → `catalog:verify` → deploy.
2. Razorpay live keys + webhook → test Rs. 1 payment → refund.
3. Final price spot-check (10 random products) with the owner.
4. ~~Homepage hero copy for Diwali/November 2026~~ — done (Diwali 2026 copy + dispatch cutoff).
5. Go-live checklist (`docs/10-deployment/go-live-checklist.md`).

## Round 14 — brand + pre-domain pass (2026-10-24)

- **Brand:** site naam `Designer Clothing`; owner ka final logo local assets me —
  `logo-mark-128/192/512.png` (header badge, footer, favicon/Apple icon, PWA 512, invoice),
  `logo.png` + `logo.webp` (lockup), `og-image.jpg` (1200×630). Ek hi component:
  `apps/web/src/components/brand-lockup.tsx`.
- **Hero:** `diwali-sale-70-2026.webp` (Diwali poster, mobile full + desktop panel, base-path safe).
- **One env:** domain badalne par sirf `NEXT_PUBLIC_SITE_URL` — canonical/OG/`metadataBase`,
  sitemap, robots, product JSON-LD offer URL, UPI callback aur WhatsApp order link sab isi se.
  Product JSON-LD aur UPI callback se cloned-site URL (`likshaclothing.com`) hata diya.
- **CORS:** Pages static preview se `POST /api/orders`, `/api/payments/manual`,
  `/api/payments/failed` aur `GET /api/settings` Render par cross-origin jaate hain
  (`apps/web/src/lib/cors.ts`, allowlist + preflight, koi `*` nahi). `STORE_API_URL` set hone
  par Pages par order sach me banta hai (pehle browser block karta tha).
- **Sheet ready:** `Designer Clothing — Store (Orders · Payments · Settings)` — 5 tabs,
  headers + settings values bhare hue, owner email par Editor access. Link + setup:
  `docs/09-devops/google-sheets.md`.
- **Reviews:** sirf customer photos (product gallery ki image review me nahi) —
  151 products / 1690 reviews / 147 photo reviews / 252 unique photos.
- **Env checklist:** `docs/09-devops/domain-and-brand.md` §3 (Render vars, GitHub `STORE_API_URL`,
  DNS/SSL, domain ke baad verification curl).
- Verified: `npm run test:unit` → 84 pass, smoke → 82/0, Pages preview + CI green.

## Round 15 — responsive logo, hero aur header (2026-10-24)

Owner ka master prompt: har screen par professional logo/header/hero, device-specific assets.

- **Asset pipeline:** `scripts/brand/build-responsive-assets.mjs` — owner ke original files
  (`assets/source/`) se sirf crop/trim/resize/WebP. Header logo unki hi wide banner ke header
  se crop hota hai (flat version jo mockup me hai), favicon/invoice official 3D mark se.
- **Logo:** `brand/logo-mobile.png` (<768), `logo-tablet.png` (768–1023), `logo-desktop.png`
  (≥1024), `logo-fluid.png` (stacked, footer/invoice), `logo-mark-{128,192,512}` — ek hi
  `<picture>`, browser sirf ek file download karta hai. Header me logo mobile par centre
  (`grid-cols-[auto_1fr_auto]`), desktop par left — kabhi overlap nahi.
- **Hero:** `banners/banner-mobile.webp` (860×1290 portrait), `banner-tablet.webp`
  (1200×900, poster + blurred backdrop — kuch crop nahi), `banner-desktop.webp`
  (1779×594, baked carousel arrows side-trim se hataye), `banner-fluid.webp`.
  Har box ka `aspect-ratio` file ke ratio ke barabar → stretch/crop/CLS zero.
- **Header:** announcement bar 3-part (phone / shipping / tagline), nav labels chhote
  (SHOP · ANARKALI · LEHENGA CHOLI · PRINTED SET · NEW IN · SALE · CONTACT), naya
  `/collections` landing (SHOP link pehle dead tha), SAREES dead link hata diya.
- **Checkout UPI:** GPay/PhonePe/Paytm/BHIM/Amazon Pay ke alag buttons hata diye — sirf
  QR + UPI ID + Open UPI app + Copy.
- **Socials:** Instagram sirf URL text (`designer_clothing_9`), WhatsApp hi working link;
  Facebook/Pinterest dummy links removed.
- **Tests:** `tests/e2e/responsive.mjs` (39 checks) + `tests/e2e/breakpoints.mjs`
  (18 viewports, 48 checks) — CI me add; smoke 86/0, unit 89/0.
- **Proof sheet:** `docs/assets/responsive-proof.png` (`npm run assets:proof`) — asli assets
  + asli CSS heights se 320 se 1920 tak ka header+hero.
- Docs: `docs/05-design/responsive-assets.md`.

## Round 16 — audit, trust fixes, DB replies aur speed (2026-10-24)

Owner ka full-site audit prompt. Sabse pehle code/data inspect kiya, phir fix + test.

- **Reviews (trust):** 1,273 generated sample reviews (`seed-reviews.json`) poore hata diye —
  public page par sirf asli Trustoo reviews. "Verified buyer" badge sirf `verified === true`
  par; rating 0 wale aggregates par stars/average hide, JSON-LD `aggregateRating` sirf real
  rating par (schema valid). Sync script aggregate rating 0 ho to asli reviews se average
  nikalta hai.
- **Stock:** sold-out product/size ka add-to-cart + buy-now disabled (card + PDP), server
  `createOrder` par bhi 409 — UI bypass karke bhi kharid nahi ho sakta.
- **Prepaid only:** API `paymentMethod: "cod"` ab 400 deta hai (pehle server COD accept
  karta tha jabki site prepaid-only thi).
- **Routes:** `/pages/size-cheart` → 200 alias (canonical `size-guide`), naya
  `/collections/wedding-collection` (canonical `weddin-collection`), saree nav me nahi,
  unknown product/collection 404, order not-found ka apna page ("Order nahi mila" +
  WhatsApp), order numbers case-insensitive.
- **Batch/checkout detail:** contact messages me `replied` flag (migration 0006, API,
  admin mark/undo, sheet status), best sellers ab asli orders ki quantity se rank hote hain.
- **Speed:** collection me agla page prefetch (idle + 900px pehle), Pages preview par
  `catalog-lite.json` se client-side pagination (pehle "load more" preview par fail tha).
- **Copy:** "Up to 70% OFF" (60% + 70% dono hain), `CUSTOMER SUPPORT`, admin title
  "Designer Clothing Admin", PDP shipping copy prepaid-only.
- **Tests:** naya `tests/e2e/round16.mjs` (37 checks) + `tests/e2e/links.mjs` (45 pages
  crawl) CI me; smoke 86/0, responsive 40/0, breakpoints 48/0, unit 89/0.
- Docs: `docs/08-testing/round16-audit.md` (issues, decisions, verification matrix).

## Round 17 — TRENDS YOUNIQUE rebrand, WhatsApp orders aur Google Sheet DB (2026-10-25)

Project kisi aur ka tha; owner ne ise apne brand ke hisaab se poora badalne ko kaha.
Sab kuch ek hi pass me: brand, WhatsApp order flow, admin panel, sheet database.

**Brand**
- Naam/logo **TRENDS YOUNIQUE** — owner ki di hui logo file se assets bane
  (`scripts/brand/build-trends-assets.py`): header lockup, cream version (maroon bg),
  stacked lockup, 4 square marks (favicon/PWA/WhatsApp thumb), invoice logo.
- Palette: ink `#14100e`, wine `#6f1d2b`, wine-deep `#4a1220`, gold `#b08a4a`,
  cream `#faf6ef`, sand `#eadfce`. Fonts: Cormorant Garamond + Jost.
- Home hero naya (2026 drop, "Couture for the woman who arrives"), announcement bar
  naye messages par, footer wine band + cream logo + gold heading.
- Purane brand ke saare strings hata diye: `likshaclothing.com` email/handle/host
  (`care@trendsyounique.com`), `likshaclothing@upi` → `trendsyounique@upi`,
  admin login email `admin@trendsyounique.com`, invoice/sheet/docs.

**WhatsApp = order channel (koi gateway nahi)**
- Product page par "Order on WhatsApp": message me naam · colour · size · qty · price · link.
- Cart drawer + cart page par "Send cart on WhatsApp": poora cart ek message me
  (item-wise colour/size/qty/price + total) — aur saath hi `Enquiries` me log.
- Cart se order place hone ke baad order page par WhatsApp confirmation link
  (`orderWhatsAppMessage`) — ab **colour bhi** message me jaata hai.
- Har click se pehle `POST /api/enquiry` (sendBeacon) → detail DB + sheet me save.

**Quantity limits (owner: 10 / 30 / 15)**
- Ek line 10 pieces, XL+ 30, poora order 15 (sirf XL+ order ho to 30).
- Teen numbers sheet `Settings` + admin Settings se configurable.
- `createOrderSchema.superRefine` server par bhi yahi rule lagata hai — UI bypass nahi hota.
- `tests/unit/quantity-limits.test.ts` (10 tests).

**Admin panel (sirf zaroori)**
- Multi-image upload (12 tak, 8 MB, jpg/png/webp/avif, pehli = cover), naam, price, MRP,
  colour, collection, **size + stock + size-wise price** (khaali = base price), draft/live.
- Size-wise price storefront tak pahunchta hai (`sizePricing`) aur sheet row me
  `XL (2 @2899)` ki tarah dikhta hai.
- Settings page: brand, WhatsApp, UPI, announcement + teen quantity limits.
- Uploaded photos `/api/uploads/<name>` se serve hote hain; admin panel `noindex` +
  HMAC cookie session.

**Google Sheet = database (link public nahi)**
- Sheet: `TRENDS YOUNIQUE — Store DB`, tabs Orders · Order Items · Products · Enquiries ·
  Payments · Settings · Messages · Newsletter · Read Me.
- `scripts/google-apps-script/trends-sheets.gs`: `setup()`, `settings`, `recent`, `health`,
  `append`, `upsert`; token-protected; deploy as *Me* + *Anyone*.
- **Bug fix:** `orderSheetRow` purane column naam bhej raha tha (`Order number`, `Total`,
  `Item details`) jabki sheet ke headers (`Order ID`, `Total ₹`, `Items`) — Apps Script
  header ke naam se map karta hai, isliye customer ka phone/address chupchaap khaali
  reh jaata. Ab keys exactly headers par, plus naye `orderItemRows` (har item ki alag row
  with colour/size/qty/price/link) aur `paymentSheetRow` (Payments tab).
- `tests/unit/sheet-headers.test.ts` — header contract test jo `.gs` file se headers padh
  kar row keys se compare karta hai (drift pakad leta hai).
- Docs: `docs/09-devops/google-sheets.md` (setup, tabs, settings keys, verify commands).

**Sheet = "every detail" (Round 17b)**
- Owner ne kaha: sheet me **har detail** aani chahiye. Isliye columns poore kiye:
  - Orders (27): email, WhatsApp link, discount, coupon, payment method, courier, AWB, tracking URL
  - Order Items (12): colour + order status, product link, image
  - Products (15): discount %, category, fabric, size-wise `XL (2 @2899)`
  - Enquiries (10): enquiry ID + item-wise colour·size·qty·price·link
  - Payments (12): method
- Row builders ab pure module (`sheet-format.ts`) me — Messages/Newsletter/Enquiries bhi wahin se.
- **Outbox:** Apps Script down/timeout ho to row `.data/sheet-outbox.json` me queue hoti hai aur
  agli successful call par purani rows pehle chali jaati hain — detail gum nahi hoti.
- Checkout ka WhatsApp fallback bhi ab enquiry log karta hai (naam, phone, poora address).
- `tests/unit/sheet-outbox.test.ts` (4) + header-contract test ab "koi zaroori cell khaali
  nahi" bhi check karta hai. `Read Me` tab `setup()` se regenerate hota hai (Hinglish guide).
- `writeSheetSettings` ab brand, tagline aur teen quantity limits bhi sheet me likhta hai.

**Verification**
- `npm run typecheck` — web + admin + api clean.
- `npm run test:unit` — 116/0, `npm run test:integration` — 40/0.
- Manual (dev servers): product save → PDP 200 / listing / `/api/products`; order with
  colour → stored order + order page + WhatsApp link; settings round-trip (10/30/15 →
  8/25/12 → restore); admin pages 200 with session.

## Round 18 — WhatsApp-first checkout, sheet relay aur "poochhein" (2026-10-25)

Owner: "cart me add karke buy kare to WhatsApp par le jaaye, buy-now bhi wahi, aur sheet me
data save nahi ho raha — setup kaise karun?" Isliye flow poora WhatsApp-first kiya.

- **Checkout:** naya primary CTA **"Send order on WhatsApp"** — naam/phone/address/pincode
  validate karke poora order (item link · colour · size · qty · price + address + notes +
  total + UPI) pre-filled WhatsApp me kholta hai. Usi click par enquiry/order DB me aur
  sheet me bhi chala jaata hai. Online payment (`Pay online & place order`) secondary.
- **PDP:** "Buy it now" → checkout (detail bharne ke liye), "Order on WhatsApp" (ek click),
  aur naya **"Poochhein — size, fabric ya delivery?"** button jo item ke link ke saath
  owner se sawaal bhejta hai.
- **Sheet relay (static hosting ka fix):** GitHub Pages par Node server nahi hota, isliye
  `lib/sheet-relay.ts` browser se seedha Apps Script par rows bhejta hai
  (`no-cors`, write-only token). Server ho to pehle jaisa API path bhi chalta hai.
- **Apps Script:** naya `WRITE_TOKEN` (append-only), `WRITE_SHEETS` allowlist, 40 row cap.
- **Admin:** Google Sheet page par "Sheet setup — 5 minute" steps + naye product form me
  4–6 photos ki salah. Naya guide: `docs/09-devops/sheet-setup-5-min.md`.
- Tests: `tests/unit/whatsapp-order.test.ts` (5) — message me link/colour/size/qty/address
  aur "undefined" na aane ki guarantee. Unit 121/0, integration 40/0.

## Round 22 — cart bug fix, naya theme layer, poora Apps Script (2026-10-25)

**Cart bug (asli wajah mil gayi):** "Add to cart dabao par cart khaali".
`cart-provider` naya item add karte waqt limit check `checkLineQuantity(lines, lines.length, …)`
se karta tha — us index par koi line hoti hi nahi, to function turant
`{ ok: false, "Ye item cart me nahi mila." }` deta tha. Isliye **naya item kabhi cart me
jaata hi nahi tha** (sirf pehle se maujood item ki quantity badhti thi).

- Saari cart logic ab pure module `apps/web/src/lib/cart-logic.ts` me: `addToCart`,
  `updateQuantity`, `removeFromCart`, `mergeCarts`, `cartTotals`.
- Fix: pehle **candidate cart** banta hai, phir usi par validate hota hai → naya item
  add hota hai, quantity badhti hai, limits (10 / XL 30 / order 15) wahi lagti hain.
- Side-effects (notice) state updater ke andar se hata kar `linesRef` par shift — double
  render par bhi behaviour deterministic.
- `tests/unit/cart-logic.test.ts` (12 tests): naya item add, duplicate merge, per-line
  limit, XL 30, order cap 15, quantity 0 = remove, storage merge.

**Naya theme layer (`globals.css` → 2026 theme):** ivory "gallery" card frame with gold
corner ticks, gold gradient badges, quick-add pill (desktop hover / mobile always),
serif section titles + gold eyebrow, refined buttons, hero me gold frame + vertical
"Hand-finished in Jaipur" side label + quick category links, warm paper texture bands.

**Apps Script:** `Newsletter` me `Source` column, `health` me token-status,
naya `schema` action (website ko tabs/headers bata deta hai), har bade tab par filter,
`setup()` sab tabs + headers + Settings + Read Me banata hai.

**Sheet relay breadth:** ab footer newsletter aur contact form bhi static hosting par
seedha sheet me likhte hain (server na ho to bhi data save).

**Tests:** unit 133/0, integration 40/0, typecheck clean.

## Round 23 — Apps Script live + website ka sheet bridge configure (2026-10-25)

Owner ne `/exec` deployment de diya. Sandbox se script.google.com `curl` se reachable
nahi hai, lekin `fetch_page` se **GET** chalta hai — usse deployment verify hua:

- `?action=health` → `ok: true`, tabs: Orders (1 test row), Order Items, Products,
  Enquiries, Payments, Settings (15 rows), Messages, Newsletter. Yaani `setup()` chal chuka hai.
- Deployed version purana tha (health me token flags nahi aaye) → naya `VERSION` +
  `?action=ping` + `?action=verify_write` add kiya, taaki deployment check ho sake.
- **Security fix:** master token abhi default `CHANGE-ME-trends-token` tha, yaani URL
  jaanne wala koi bhi `?action=recent&sheet=Orders` se aapke orders padh sakta tha.
  Ab script me placeholder hai (jo kisi ko pata nahi) aur asli master token sirf chat me
  diya gaya. Write token (public-by-design) script + website me same rakha gaya, aur
  ek test dono ko match karta hai.

Website side: naya `apps/web/src/lib/sheet-config.ts` — `/exec` URL + write token ke
build-time defaults (env var se override ho sakte hain). Isliye GitHub Pages par repo
variables set karne ki zaroorat nahi; order/enquiry/contact/newsletter seedha sheet me.

Tests: unit **138/0** (5 naye sheet-config tests), typecheck clean.

Round 23 addendum: relay dono tokens (naya `tyw-…` + transition) bhejta hai, isliye
purani deployment par bhi rows save hoti hain aur naya version deploy hone ke baad
transition token ki request chup-chaap reject ho jaati hai (duplicate row nahi banti).

Round 23 (cont.) — live settings from sheet + write-path self-test

- `?action=public`: sirf non-secret settings (whatsapp, announcement, UPI, quantity limits).
  Site ab static hosting par bhi ye padhti hai (60s cache) → owner sheet me number badale,
  site 1 minute me update, redeploy nahi.
- `?action=append_test` (write token): browser se write-path verify, Orders me TY-SELFTEST row.
- VERSION r5.
- Note: `.github/workflows/sheet-check.yml` banaya tha, par GitHub branch-only naye workflow
  ko register nahi karta (dispatch 404) — hataya. Verification ab URL se hoti hai.
- Owner ka deployment abhi bhi **Version 1 (purana code)** chala raha hai: `?action=ping`
  par `unauthorized` aata hai. Unhe "New version" deploy karna hai.

### Round 23 result — sheet bridge LIVE ✅

Owner ne naya deployment banaya (URL badal gaya):
`…/AKfycbwQxTH7BIhPkYvlTi7SWzUnh5WD2mP-AijXB2vrfLr9j3TvcD7fW3XtM4N9406VYDhO/exec`

Verify kiya (GET se, fetch_page):
- `?action=ping` → `{"ok":true,"version":"2026-10-25.r5"}`
- `?action=public` → Settings tab se live values (brandName, whatsapp, limits 10/30/15)
- `?action=append_test` → `{"ok":true,"written":1,"ref":"TY-SELFTEST-1792901670395"}`
  yaani **write path end-to-end kaam kar raha hai** (Orders tab me row pahunchi).

Config naye URL par shift kiya, transition/legacy write token hata diya (ab bekaar).
Purana deployment (AKfycbztH…, Version 1, master token public default) abhi zinda hai —
owner ko usse **archive/delete** karna chahiye, warna wo URL purana code (aur default
master token) chalaata rahega.

## Round 24 — online payment poora hata, sheet write double-transport, self-check page

Owner ki shikayat: checkout par UPI/QR + "Pay online & place order" dikh raha tha aur UPI ID
**kisi aur ki** (`dhakadgourav@fam`, cloned project se) thi. Website par online payment
bilkul nahi hona chahiye.

- Checkout se **Payment section, UPI QR, UPI apps, "Pay online & place order" button** — sab hata.
  Ab sirf: order details → **Send order on WhatsApp**. Payment owner WhatsApp par batata hai.
- `dhakadgourav@fam` saare defaults se hata (web + admin + store-settings + tests).
- `checkoutWhatsAppMessage` se payment/UPI line gayab (test bhi update).
- Orders page se UPI payment block hata.

Sheet me data na aane par (real order `TY-NBL7ITUPM` kabhi nahi pahuncha):
- `relayRows` ab **do transport** se bhejta hai: form-encoded `fetch` (no-cors) + **hidden form POST**
  (iframe) — CORS/redirect kuch bhi ho, row pahunchti hai.
- Script me **duplicate guard** (`rowKeyOf_` / `existingKeys_`): Orders = Order ID, Order Items =
  Order ID+Product+Size+Colour, Newsletter = Email. Isliye do transport se double row nahi banti.
- `doPost` ab **form-encoded** body bhi padhta hai (`e.parameter`).
- Naya page **`/sheet-check`**: ping → token match → settings → test row, sab browser se, aur
  aakhri relay ka log. Owner khud 10 second me verify kar sakta hai.

## Round 24 (cont.) — 3 naye original products + sheet-based reviews

**Naye products (apne original shoot images — AI se banaye, kahin se copy nahi):**
| Product | Price | Images |
| --- | --- | --- |
| Meher Wine Velvet Zari Anarkali Set | ₹2,499 (MRP ₹4,599) | 3 (front / detail / side) |
| Noor Ivory Chikankari Kurta & Palazzo Set | ₹1,899 (MRP ₹3,499) | 3 |
| Rani Emerald Raw Silk Gota Lehenga Choli | ₹3,499 (MRP ₹6,299) | 3 |

- Images `apps/web/public/images/own/` me (repo ke andar, Shopify CDN par depend nahi).
- `source: "own"` — imported catalogue ki parity checks se alag, kyunki inke price/photos
  owner khud set karta hai. Test `own products: 3+ original photos` isko guard karta hai.
- `imageUrl()` local `/images/...` path par base path lagata hai (Pages par 404 na ho).
- catalog verify: meta.source ki hard-coded likshaclothing check hata di (ab store URL),
  count meta se aata hai.

**Reviews (asli, sheet-backed):**
- Apps Script me naya tab **Reviews** (`Timestamp, Handle, Product, Name, Rating, Title, Body, Status, Source`)
- Product page ka "Write a review" ab **real form**: naam + 1–5 star + text → `Reviews` tab me
  row (`Status = pending`). Har review ka source site ka apna URL hai — koi fake review nahi.
- `?action=reviews&handle=…` sirf **publish** kiye hue reviews deta hai (naam, rating, text;
  koi phone/email nahi) → approve karne par site par turant dikh jaate hain, redeploy nahi.
- Sheet na mile to site ke Trustoo-synced reviews jaise the waise dikhte hain.

Round 24 (cont.): relay ab **JSON fetch + form POST dono** bhejta hai (purane script version par
bhi data save, naye par form fallback). Script me Enquiries/Messages/Reviews ke duplicate keys bhi
add kiye (r8) — do transport se double row nahi banti.

## Round 25 — Diwali 75% campaign engine, banner assets, domain, nav/collections

**Banner assets** (owner ke 3 PNG se, crop ke bina, WebP):
`apps/web/public/images/banners/trends-younique-diwali-75-off-{desktop,tablet,mobile}.webp`
— desktop 1920×1081, tablet 1280×960, mobile 1024×1536 (278/258/305 kB).

**Campaign engine — `apps/web/src/lib/campaign.ts`:**
- Ek jagah config: dates, discount %, banner assets, CTA, announcement.
- `CAMPAIGNS[]` registry → mahine ke hisaab se rotate (dates ke bahar offer gayab).
- `campaignPrice(mrp, 75)` = MRP ka 25% (poore rupee) — **MRP ko kabhi nahi chhedte**,
  isliye "flat 75% off" sach hai. 446/446 products par exactly 75% (test).
- `withCampaignPricing()` `store.ts` me lagti hai, isliye card, PDP, size-price, cart,
  checkout, invoice, WhatsApp message aur JSON-LD — sab ek hi price dikhate hain.
- Hero: campaign chalu ho to **owner ka banner** (banner me text already hai, isliye
  overlay copy hata di — do headline ek doosre par nahi chadhte); khatam hote hi
  editorial hero wapas. Announcement bar aur header strip me bhi campaign line.
- JSON-LD `priceRange` ab asli catalogue se, hard-coded ₹499–₹699 hata.

**Domain:** default site URL ab `https://trendsyounique.fashion` (config, api-base,
CORS allowlist me domain + www). Render fallback sirf tab jab env set ho.

**Brand/config:** collection display titles saaf kiye (Anarkali Suits, Lehenga Chunni &
Choli Sets, Suit Sets & Gowns, Printed Suits, Wedding & Festive Wear) — URLs waise hi.
Header nav ab Anarkali · Lehenga · Suit Sets · Printed · Wedding · New In · Sale (10 links,
1024px par scroll-safe).

**Collections jo inventory hi nahi rakhte** (owner list me the, par 0 products):
Salwar Suits, Dupatta/Chunni, Festive Wear (alag) — jaan-boojh kar **nahi** banaye,
kyunki khaali collection = jhootha nav. Inventory aane par add honge.

Docs: `docs/09-devops/campaigns.md` (mahine ka rotation + naya campaign + env switches).
Tests: **145 unit + 40 integration + 9**, typecheck clean, catalog verify clean.

### Round 25 (cont.) — titles saaf, nav collections, build pipeline

- `scripts/clean-titles.mjs` — ALL-CAPS → Title Case, "Beutifull/Lehnga/Waite/Sequence/Jari/Pent"
  spelling fix, duplicate words ("Anarkali Anarkali"), keyword-stuffed 110+ akshar titles.
  **234 titles** update (teeno catalogue copies + seeds). Handles/URLs waise hi — koi
  purana link nahi toota.
- `scripts/build-catalog.mjs` ab build ke waqt bhi wahi `cleanTitle()` lagata hai (generated
  copy dobara ganda na ho). Local variable rename (`plainTitle`) — import shadow nahi hota.
- `lib/collections.ts` (client nav) aur home ke circle labels saaf: Anarkali Suits, Lehenga
  Chunni & Choli Sets, Suit Sets & Gowns, Printed Suits, Wedding & Festive Wear.

Round 25 (cont.): price filter buckets campaign ke hisaab se (Under 500 / 500-800 /
800-1200 / 1200+) — pehle Rs. 2,500+ ke buckets sab khaali dikhte the.
