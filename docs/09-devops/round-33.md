# Round 33 — support number, reviews sheet, trending edit, image audit

_Owner ke 4 kaam: (1) WhatsApp/phone number 7740992663 har jagah aur **sheet se badalne wala**, (2) new-arrivals image mismatch, (3) sheet ke reviews product page par + purane reviews sheet me, (4) 10 trending products + "Buy protected"._

---

## 1. Support details — ab **sirf sheet se** badalte hain

| Detail | Sheet key (`Settings` tab) | Kahan dikhta hai |
| --- | --- | --- |
| WhatsApp | `whatsapp` | footer, product page CTA, contact page, policy pages, WhatsApp order/enquiry |
| Call number | `support_phone` | footer, contact page, order-not-found, invoice |
| Email | `support_email` | policy pages (`{{email}}`), invoice |
| UPI | `upi_id`, `upi_name` | checkout QR card |
| Announcement | `announcement` | top bar |
| Free shipping / fee | `free_shipping`, `shipping_fee` | product page + cart |
| GSTIN | `gstin` | GST invoice |
| Qty limits | `max_qty_per_item`, `max_qty_per_order`, `max_qty_bulk` | cart + product page |

Number ab code me kahin display nahi hota — sirf **fallback** ke roop me
(`config/site.ts`, `lib/store-settings.ts`, `components/store-settings-provider.tsx`).
Render par value live aati hai:

```
Google Sheet Settings  →  /api/settings  →  useStoreSettings()
                       ↘  ?action=public (static build fallback)
```

Policy pages aur `/pages/*` ka text `{{whatsapp}}` / `{{phone}}` / `{{email}}` tokens
use karta hai (`lib/support-tokens.ts` + `components/support-text.tsx`) — isliye
sheet me number badalne par **policy text bhi** badal jaata hai, redeploy ke bina.

GST invoice bhi settings se: `buildInvoice(order, number, issuedAt, { phone, email, gstin, name })`.

Owner ke liye test: Sheet → `Settings` → `whatsapp` badlo → 1 minute me site par.

---

## 2. Image mismatch — asli wajah mil gayi

Pehle lag raha tha ki kisi product me doosre product ki photo chali gayi hai. Audit
me wo nahi mila — **asli problem duplicate listings thi**:

Source stores (likshaclothing + thestoreofbufani) me **ek hi dress do naam se**
listed hai — kabhi `-copy`, kabhi Shopify id ke saath, kabhi poora naya naam:

| Ek hi dress, do listings | Photos shared |
| --- | --- |
| `premium-ivory-royal-zari-work-kali-cut-anarkali-suit-set` ↔ `…-10456605851780` | 7 |
| `maharani-red-karva-chauth-special-anarkali-suit-set` ↔ `padmarani-red-special-anarkali-suit-set` | 9 |
| `azira-maroon-color-premium-anarkali-suit-set` ↔ `twinkle-maroon-silk-premium-anarkali-suit-set` | 6 |
| `light-pink-anarkali-suit-set` ↔ `pista-colour-anarkali-suit-set` (colour naam hi galat) | photo set |

Isi liye customer ko "ye image kis product ki hai" wala confusion hota tha.

**Fix:** `scripts/fix-duplicate-listings.mjs` photo-fingerprint (file ka naam,
extension/`?width` ignore) se same-shoot listings dhundhti hai, ek rakhti hai
(zabardast photos → phir asli reviews → phir saaf title) aur baaki 36 listings
hata deti hai. Hataye gaye handles `database/seeds/admin/overrides.json` ke
`hidden` me hain — dobara build me wapas nahi aayenge.

- 513 → **477 products**
- colour index se dead swatches prune (12 → 10 groups)
- review aggregates prune

**Titles bhi saaf:** `scripts/clean-titles.mjs` — `copy of`, `-copy`, `TD-6008`,
Shopify id, `*premium*anarkali*suit*set*`, `[3 Pis]` → saaf naam (36 titles).
Handle waisa hi rehta hai, isliye purane link / review / order par asar nahi.

---

## 3. Reviews — sheet se site par, aur purane reviews sheet me

**Sheet se site par (pehle se code tha, ek bug tha):**
`?action=reviews&handle=…` sirf wahi rows bhejta tha jinka Status `publish` ho.
Owner ne review likha tha par Status `pending` reh gaya → site par nahi dikha.

Ab:
- **Status khaali ya `publish` = live**, `pending`/`reject` = chhupa hua
  (`scripts/google-apps-script/trends-sheets.gs`, v`2026-10-25.r10`)
- Reviews tab ke Status column me **dropdown** lag gaya (sheet me hi)
- Site duplicate na dikhaye — sheet ka wahi review jo local sync me hai, ek hi baar
  (`components/product-reviews.tsx`, text ka fingerprint)

**Purane reviews sheet me (1,683 rows):**
`scripts/reviews-sync/export-for-sheet.mjs` → `apps/web/public/data/reviews-import.json`
(har Trustoo review, `Status = publish`, `Source = trustoo`).

Owner ka **ek click**:
1. Apps Script editor me naya code paste → Deploy → Manage deployments → Edit → New version → Deploy
2. Sheet me menu **TRENDS tools → Import all reviews**

Import khud site ka JSON padhta hai, duplicate skip karta hai, 400-400 rows ke
batch me likhta hai. Dobara chalane par kuch duplicate nahi aata.
(Manual rasta bhi hai: `?action=import_reviews&token=<master token>`.)

---

## 4. Trending edit — 10 products (2–3+ photos), asli data se

`scripts/patch-trending.mjs` — source se banaya hua "trending" nahi, **asli data**:

- customer reviews ka count + rating (Trustoo sync)
- stock me hai
- kam se kam 3 images (max 12)
- ek hi family / ek hi shoot do baar nahi

Ab `/collections/trending` = **15 products** (441 real reviews), har ek me 3–12 photos.

| Product | Images | Reviews |
| --- | --- | --- |
| Aniska White Embroidered Georgette Anarkali Set | 3 | 71 |
| Neha's Premium Anarkali Suit Set | 4 | 55 |
| Aarushi Heavy Pure Chinon Silk Gown | 9 | 52 |
| Manyata Maroon Embroidered Georgette Suit Set | 4 | 48 |
| Whispering Breeze Embroidered Georgette Suit Set | 5 | 40 |
| Sanaya's Black Embroidered Georgette Suit Set | 10 | 39 |
| Trendy Off-White Embroidered Sequin Suit Set | 5 | 38 |
| Orange Shades Premium Anarkali Suit Set | 6 | 38 |
| Prachi's Red Heavy Vichitra Royal Suit Set | 3 | 38 |
| Green Bandhej Muslin Anarkali Suit Set | 4 | 31 |

(`database/seeds/admin/trending-edit.json` me poora record.)

**"Buy protected" block** product page par (`components/buy-protected.tsx`):
order WhatsApp par protect, 7 day return, free shipping (sheet se), no online
payment. Sirf asli policy ki baatein.

---

## Reproduce / re-run

```bash
node scripts/fix-duplicate-listings.mjs          # audit
node scripts/fix-duplicate-listings.mjs --write  # fix (36 listings)
node scripts/clean-titles.mjs                    # clean titles
node scripts/patch-trending.mjs                  # 10 trending picks
node scripts/reviews-sync/export-for-sheet.mjs   # reviews import file
```

## Tests

```
unit 181/181 · integration 40/40 · db 9/9 · web build ✓ · admin build ✓
```
