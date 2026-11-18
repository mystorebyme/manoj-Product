# Round 34 — product ID, sheet se main photo, review approval, 1-second rotating reviews

_Owner ke 6 kaam: (1) har item ki **ID** aur poori item list sheet me, (2) review ke saath
**Product ID**, (3) main photo **sheet se** set, (4) review **approval** sheet se
(approve = site par), (5) home par review **har 1 second** rotate, (6) Vercel deploy._

---

## 1. Har product ki apni ID

- Har product ke paas ab ek chhoti, **kabhi na badalne wali** numeric id hai
  (`1001`–`1477`, kul 477 products).
- Ids `publishedAt` order me assign hoti hain aur purani ids **kabhi shift nahi**
  hoti — naya product aane par sirf agli id milti hai.
- Product page par id dikhti hai: category line me `· ID 1366`.
- Script: `npm run catalog:ids` (`scripts/assign-product-ids.mjs`, `--write` bina dry run).

Product page ka JSON-LD `sku` handle hi rehta hai (Google ke liye), id sheet/owner ke
liye hai.

## 2. Sheet me poori item list (`ProductList` tab)

`ProductList` tab me **477 items** — ID, Handle, Title, Price, MRP, Main Image
(default photo link), Images, Collections, URL.

Ye tab **khud bharti hai**: cell `A1` me
`=IMPORTDATA("https://www.trendsyounique.fashion/data/products-sheet.csv")`.

> **`www` hi use kariye.** Apex domain (`trendsyounique.fashion`) par Google ka
> `IMPORTDATA` `#REF!` deta hai (Google ki taraf se fetch fail hota hai, site par file
> maujood hai). `www.trendsyounique.fashion` par wahi file 477 rows ke saath import
> hoti hai — 25 Oct 2026 ko sheet me test karke confirm kiya.
CSV site ke build se banti hai (`npm run sheet:products` →
`apps/web/public/data/products-sheet.csv`), isliye list hamesha site ke saath match
karti hai.

Menu se bhi bhar sakte hain: **TRENDS tools → 1. Saare products ki list bharo**.

## 3. Review ke saath Product ID

`Reviews` tab me naya column **`Product ID`** (J):

| Timestamp | Handle | Product | … | Status | Source | Product ID |
| --- | --- | --- | --- | --- | --- | --- |

- Site se aaya review khud `Product ID` bharta hai.
- Aap jab manually review likhein, ID `ProductList` tab se copy karke daal dijiye —
  **ya sirf Handle** daaliye, dono se review sahi product par lagta hai.
- Purani 1684 rows ki ID column bharne ke liye ek click: **TRENDS tools → 4. Purane
  reviews me Product ID bharo** (`backfillReviewProductIds`). Handle se ID dhoondh kar
  likhta hai, pehle se bhari cells chhedta nahi.
- ID khaali ho (ya galat ho) tab bhi review **Handle** se sahi product par lagta hai.

## 4. Approval — sirf approved review site par

| Status | Site par |
| --- | --- |
| `publish` / `approved` / `live` | ✅ dikhega |
| khaali / `pending` / `reject` | ❌ nahi dikhega |

Status column me dropdown hai (publish / approved / pending / reject) — ek click me
approval. Site se aaya review `pending` bankar aata hai, aap approve karte hain.

> Purana rule (khaali = live) hata diya — ab **approval ke bina kuch nahi dikhta**.

## 5. Main photo Sheet se (`MainImage` tab)

`MainImage` tab: `Handle` | `Image` | `Note`.

```
premium-ivory-royal-zari-work-kali-cut-anarkali-suit-set | https://cdn…/naya-photo.jpg
```

- Site us product ki **pehli photo** yahi dikhati hai — home rails, collection cards,
  product page gallery (baaki photos jaisi hain waisi).
- Khaali chhodne par catalog wali photo (default) hi rehti hai.
- Site `?action=products_public` se 5 min ke cache me leti hai.

## 6. Home par reviews — har 1 second rotate

`components/reviews-ticker.tsx`:

- ek card me rating, text, customer, product link — **1 second** me agla review
- approved sheet reviews + synced reviews, dono rotate hote hain
  (`?action=reviews_all`, 80 reviews)
- hover/focus par rotation rukti hai (padhne ke liye), dots se kisi bhi review par jump
- koi dummy review nahi — sirf asli/approved

## 7. Apps Script — r12

`scripts/google-apps-script/trends-sheets.gs`:

- `Reviews` headers me `Product ID`, approval-only reading (`reviewApproved_`)
- naye public actions: `reviews_all` (home ticker), `products_public` (MainImage)
- menu: **1. Saare products ki list bharo · 2. Import all reviews · 3. Approval help ·
  4. Purane reviews me Product ID bharo**
- `setup()` `ProductList` + `MainImage` tabs banata hai aur Status dropdown lagata hai

Deploy: Extensions → Apps Script → poora code paste → **Deploy → Manage deployments →
✏️ → New version**.

## Reproduce

```bash
npm run catalog:ids          # ids assign (--write)
npm run sheet:products       # products-sheet.csv/json
node scripts/reviews-sync/export-for-sheet.mjs   # reviews-import.json (id ke saath)
```

## Tests

```
unit 181/181 · integration 40/40 · db 9/9 · web static build ✓ · admin tsc ✓
```
