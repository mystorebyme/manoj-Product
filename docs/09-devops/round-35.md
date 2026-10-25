# Round 35 — address↔PIN check, sheet images, order tracking, Buy protected hatao

Owner ke 6 kaam is round me:

1. **Address ka state aur PIN code mel khata hai ya nahi** — verify + sheet me record,
   aur admin decide kare kaunsa state/PIN block karna hai (customer ko kuch nahi dikhta).
2. **Product ID sirf admin ke liye** — public product page se hata diya.
3. **Product ki saari images sheet me** — admin kisi bhi image ko badal ya delete kar sake.
4. **"Buy protected" block hata do** — site se poora nikal diya.
5. **Order tracking** — 5 step (placed → confirmed → packed → shipped → delivered) aur
   team ke messages, sab **sheet se**.
6. **Mini image** — alag se confirm karke fix (neeche note).

---

## 1. Address ↔ PIN verification (admin-only data)

Naya module: `apps/web/src/lib/address-check.ts`

- PIN ka **asli state/district** India Post data se nikalta hai
  (`public/pincode-map.json`, 19,486 pincodes).
- Customer ka chuna hua state ≠ PIN ka state → **order aage nahi badhta**, message:
  _"PIN 302001 Jaipur, Rajasthan ka hai — par state Kerala chuna gaya hai."_ +
  ek click ka button: **"State Rajasthan kariye"**.
- Checkout ka state dropdown ab India Post ke saare state/UT se aata hai
  (default **Rajasthan**, kyunki store Jaipur ka hai).
- Har check **`AddressCheck` tab** me log hota hai:

  `Timestamp · Result · Customer · Phone · Address · City · State chosen · PIN · PIN state · District · Blocked · Source page`

  `Result` = `ok` / `state-mismatch` / `blocked-state` / `blocked-pincode` / `unknown-pin`.
  Ye tab **sirf owner ki sheet me** hai — website par kahin nahi dikhta.

### Block kaise karein (admin)

`Settings` tab me do nayi keys:

| key | value (comma se alag) | matlab |
| --- | --- | --- |
| `blocked_states` | `Kerala, Assam` | in states me delivery band |
| `blocked_pincodes` | `682001, 560001` | in PIN codes par delivery band |

Value khaali = sab allowed. Sheet badalne ke ~1 minute me site par lag jaata hai
(redeploy nahi). Blocked state/PIN par customer ko sirf "is PIN par delivery available
nahi hai, WhatsApp par baat kariye" dikhta hai — reason (mismatch/block) internal rehta hai.

## 2. Product ID ab sirf admin ke liye

- Product page se `· ID 1366` hata diya.
- ID abhi bhi `data-product-id` attribute me hai (debug/admin ke liye, screen par nahi),
  sheet ke `ProductList` aur `Reviews` me hai, aur review submit ke saath jaati hai —
  isliye review sahi product par lagta hai.

## 3. Saari product images sheet me (admin update/delete)

- `products-sheet.csv` ka **`Images`** column ab **saari photos ke poore link**
  (` | ` se alag) deta hai, aur alag `Image count` column bhi hai.
- Naya tab **`ProductImages`**: `Handle | Position | Image | Note`
  - **badalna**: us position ka Image cell naya URL
  - **hatana**: us cell me `delete` likh dein
  - **jodna**: nayi row — Handle + agli Position + naya URL
  - Tab khaali ho to site catalog ki photos dikhati hai.
- Menu **5. Saari products ki images list bharo** (`syncProductImages`) ek click me
  saare products ki saari photos rows bana deta hai (jo handle pehle se hai uski rows
  nahi chhedta).
- Site `?action=images_public` se 5 min cache me leti hai; product page ki gallery
  turant wahi dikhati hai. `MainImage` tab pehli photo alag se set karta hai.

## 4. "Buy protected" hata diya

`components/buy-protected.tsx` delete; product page se block, import aur
`data-testid="buy-protected"` sab gaye. Policy lines (free shipping · 7 day return ·
payment on WhatsApp) waisi hi dikhti hain jahan pehle se thin.

## 5. Order tracking — sab kuch sheet se

Naya public action: **`?action=order_status&order=LK-XXXX&phone=98XXXXXXXX`**

- Order number **aur** registered mobile dono match hone par hi jawab (koi doosre ka
  order nahi dekh sakta).
- `Orders` tab se: status, courier, AWB, tracking URL, notes.
- `Order Items` tab se: product, colour, size, qty, price, image.
- Naya tab **`Order Updates`**: `Order ID | Date & Time | Status | Message | Visible`
  - owner row likhta hai → site ke timeline me **"Updates"** me dikhta hai
  - `Visible` = `no` karne par chhup jaata hai (khaali = dikhega)
- Track page par 5 step: **placed → confirmed → packed → shipped → delivered**
  (status `cancelled/return` ho to alag message). Status ka dropdown `Orders` tab me
  `placed / confirmed / packed / shipped / delivered / cancelled`.
- Tracking static hosting par bhi chalti hai (sheet se seedha) — redeploy nahi chahiye.

## 6. Mini image

Is round me thumbnails/gallery code chhua nahi gaya — owner se confirm karke agla
step (kis jagah ki chhoti image kharab dikh rahi hai) fix hoga.

---

## Owner ke steps (ek baar)

1. **Apps Script r14** paste karein → **Deploy → Manage deployments → Edit → New version**.
   (`?action=ping` se `2026-10-25.r14` confirm.)
2. Ek baar **`setup`** run — naye tabs (`ProductImages`, `AddressCheck`, `Order Updates`),
   dropdowns (Reviews Status, Orders Status, Order Updates Visible) aur Settings keys
   (`blocked_states`, `blocked_pincodes`) khud lag jaate hain. (Ye sab live sheet me
   pehle se bana diya gaya hai.)
3. Menu **5. Saari products ki images list bharo** — 477 products × unki saari photos.
4. Block karna ho to `Settings` me `blocked_states` / `blocked_pincodes` bhar dein.
5. Order bhejne par: `Orders` me Status badlein, aur `Order Updates` me message likhein.

## Reproduce / checks

```bash
npm run sheet:products      # products-sheet.csv (saari images ke saath) + json
npm run test:unit           # 181
npm run test:integration    # 40
npm run test:db             # 9
npm run typecheck
node scripts/pages/build-preview.mjs   # dist
```
