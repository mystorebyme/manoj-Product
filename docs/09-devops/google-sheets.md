# Google Sheet — dukaan ka database (bina server kharch)

TRENDS YOUNIQUE ka data **teen jagah** rehta hai, aur sheet pehli jagah hai:

| Layer | Kya | Kahan |
| --- | --- | --- |
| **Google Sheet** | owner ka readable DB — products, orders, order items, WhatsApp enquiries, settings | owner ke Google account me |
| **Website ka store** | products.json + orders + enquiries (fast reads, site chalti rehti hai) | server disk / Postgres |
| **Apps Script** | sheet ↔ website ka bridge (token se protected) | owner ke Google account me |

Sheet **append-only log** hai orders/enquiries ke liye (purani row kabhi overwrite nahi hoti),
aur **upsert** hai products ke liye (ek handle = ek row). Sheet down ho jaye to site chalti
rehti hai — sirf owner ke edits ruk jaate hain, koi order fail nahi hota.

## 0. Ready sheet (bana di gayi hai)

| Cheez | Value |
| --- | --- |
| Naam | `TRENDS YOUNIQUE — Store DB (Orders · Products · Settings)` |
| Link | https://docs.google.com/spreadsheets/d/1ag5Ivpw8GWkX8oE5_KLe77GFR4KP-7uQFKsmjeZ2xVY/edit |
| Tabs | `Orders` (27 cols) · `Order Items` (12) · `Products` (15) · `Enquiries` (10) · `Payments` (12) · `Settings` (key/value) · `Messages` (7) · `Newsletter` (2) · `Read Me` |
| Settings values | `brand_name`, `tagline`, `support_phone`, `whatsapp`, `upi_id`, `upi_name`, `announcement`, `free_shipping`, `shipping_fee`, `gstin`, `max_qty_per_item` = 10, `max_qty_bulk` = 30, `max_qty_per_order` = 15, `admin_url` |

> **Security:** yeh link kisi customer ko nahi bhejni. Isme customer ke phone aur address hain.
> Sheet ko sirf owner ke Google account ke saath share rakhein — "Anyone with link" band.
> Sheet id/URL/token **kabhi** frontend bundle me nahi jaate (sirf server env).

> **Sabse chhota rasta:** `docs/09-devops/sheet-setup-5-min.md` — step-by-step, copy-paste.
> Admin panel me bhi **Google Sheet → "Sheet setup — 5 minute"** par wahi steps dikhte hain.

## 0b. "Data sheet me nahi aa raha" — kyun hota hai aur fix

Owner ne report kiya tha: **contact form, checkout, kuch bhi sheet me nahi aata**.

### Asli wajah (25 Oct, prove ho gayi)

Site **galat Apps Script deployment** par bhej rahi thi. GitHub ke repo variables
(`SHEET_WEBAPP_URL`, `SHEET_WRITE_TOKEN`) me jo URL tha, uska jawab har request par
`{"ok":false,"error":"unauthorized"}` aata tha — **`tyc-…` / `tyw-…` token match nahi
kar raha tha**, isliye koi row kabhi likhi hi nahi gayi. Sheet me sirf purane
`TY-TEST*` / `TY-SELFTEST*` rows the (wo bhi kisi aur deployment ne likhe the).

Proof (GitHub Actions runner se, browser jaisa hi rasta):

| Request | Jawab |
| --- | --- |
| purane URL par `?action=ping` | `{"ok":false,"error":"unauthorized"}` |
| **sahi URL** par POST `text/plain` (browser form jaisa) | row **`TY-POSTPROBE-…`** sheet ke `Orders` tab me aa gayi ✅ |
| **sahi URL** par `?action=append` (GET, r9 feature) | r8 deployed hai, isliye abhi support nahi |

Fix (is repo me ho gaya):

- `apps/web/src/lib/sheet-config.ts` me **verified** URL + write token code me hain;
  purane `SHEET_*` env variables **ignore** hote hain (naye naam:
  `NEXT_PUBLIC_SHEET_URL_OVERRIDE`, `NEXT_PUBLIC_SHEET_TOKEN_OVERRIDE`).
  `apps/web/public/sheet-endpoint.json` live deploy par yahi URL dikhata hai, aur
  ek unit test dono ko match karata hai — dobara galat deployment lagne par CI fail.
- `.github/workflows/pages.yml` se stale variables hata diye.
- `npm run test:unit` me `sheet-config` test: purana env asar na kare.

> **Kabhi bhi** URL/token badalne hon: sirf `sheet-config.ts` (ya override env) badlein,
> aur `/sheet-check/` par step 1–4 green dekhein.

### Baaki 4 wajah (r9 ki hardening)

1. **Browser POST ka jawab verify nahi ho sakta.** Apps Script `doPost` par CORS
   preflight nahi hota aur 302 redirect ke baad jawab opaque hota hai — isliye site
   ko kabhi pata nahi chalta tha ki row likhi gayi ya nahi. Ab site **GET**
   (`?action=append&data=<base64url>`) se likhti hai, jiska jawab
   `{ok:true,written:1}` padha ja sakta hai.
2. **Relay API ke baad chalta tha.** Contact form me `relayMessageToSheet()` server
   ke jawab ke *baad* aata tha — API slow/hang ho to message sheet me jaata hi nahi.
   Checkout me bhi order row enquiry-log ke baad thi. Ab **sheet sabse pehle**.
3. **Retry nahi tha.** Net gaya / Apps Script down → row gum. Ab har row
   localStorage queue me jaati hai aur `ok:true` milne tak retry hoti hai
   (server side `Order ID`/`Enquiry ID` se duplicate guard, isliye double rows nahi).
4. **Master token placeholder tha.** `TOKEN = 'PASTE-MASTER-TOKEN-HERE'` ka matlab
   tha reads open — aur owner ka asli `tym-…` token script me nahi tha. Ab
   *Script Properties* se set hota hai: `MASTER_TOKEN` (aur chaho to `WRITE_TOKEN`,
   `SPREADSHEET_ID`). Placeholder rehne par reads band rehte hain.

### Verified write matrix (25 Oct, GitHub runner se asli POST)

| Tab | Row pahunchi? | Notes |
| --- | --- | --- |
| `Orders` | ✅ | checkout + sheet-check page |
| `Order Items` | ✅ | har item ki alag row (size, qty, price) |
| `Enquiries` | ✅ | product page ka "pooch" / WhatsApp intent |
| `Messages` | ✅ | contact form |
| `Newsletter` | ✅ | footer signup |
| `Reviews` | ✅ | review form |
| `Payments` | ⛔ (by design) | browser write token is tab ko chhoo hi nahi sakta — sirf server (master token) likhta hai, warna koi UPI reference forge kar sakta |

`WRITE_SHEETS` (Apps Script) me yahi allowlist hai: `Orders, Order Items, Enquiries,
Messages, Newsletter, Reviews`. Naya tab chahiye to script + ye table dono update karein.

**5-minute fix (owner):**

1. Sheet → **Extensions → Apps Script** → purana code hata kar repo ki
   `scripts/google-apps-script/trends-sheets.gs` paste karein.
2. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**
   (URL wahi rehta hai, naya banane ki zaroorat nahi).
3. Site par **`/sheet-check/`** kholein → **Run check** dabayein:
   - step 1: `version 2026-10-25.r9`
   - step 4: `row likhi gayi (ref TY-CHECK-…)`
   Dono ✅ = sheet ab har order/message le rahi hai.

## 1. Apps Script setup (owner, ~5 minute)

1. Upar wali sheet kholiye → **Extensions → Apps Script**.
2. Repo ki file **`scripts/google-apps-script/trends-sheets.gs`** ka poora code paste kariye
   (purana code hata dijiye).
3. Sabse upar wali line badliye:

   ```js
   var TOKEN = 'CHANGE-ME-trends-token';              // master (server padhne ke liye)
   var WRITE_TOKEN = 'CHANGE-ME-trends-write-token';  // browser se rows add (write-only)
   ```

4. **Save → Run → `setup`** → permission maange to *Review permissions → Allow*.
   Isse saari tabs + headers verify hote hain aur missing settings keys add ho jaate hain
   (maujooda values chhedi nahi jaati).
5. **Deploy → New deployment → type "Web app"**
   - Description: `Trends Younique site`
   - Execute as: **Me**
   - Who has access: **Anyone** ← zaroori (website anonymous request bhejti hai, token script check karti hai)
6. **Deploy** → `…/exec` par khatam hone wala URL copy kariye.
7. Website **aur** admin ke environment me daaliye:

   ```
   GOOGLE_SHEETS_WEBAPP_URL = https://script.google.com/macros/s/AKfy…/exec
   GOOGLE_SHEETS_TOKEN      = trends-9f3k2m-2026
   ```

   Redeploy kariye. `GET /api/settings` me `"source": "google-sheet"` dikhne lage to connect ho gaya.

   **Static hosting (GitHub Pages) par** server hota hi nahi, isliye rows seedha browser se
   Apps Script par jaati hain. Uske liye repo → *Settings → Variables → Actions*:

   | Name | Value |
   | --- | --- |
   | `SHEET_WEBAPP_URL` | wahi `/exec` URL |
   | `SHEET_WRITE_TOKEN` | `WRITE_TOKEN` ki value |

   `WRITE_TOKEN` sirf `Orders` / `Order Items` / `Enquiries` / `Messages` / `Newsletter` me
   rows **add** kar sakta hai (padhna/settings nahi, aur 40 rows per request ka cap) —
   isliye ye browser bundle me hone par bhi sheet ka data leak nahi karta.

> Code badalne par: **Deploy → Manage deployments → Edit → New version → Deploy**. URL wahi rehta hai.

## 2. Tabs ka kaam

### Products (admin se upload)
Admin panel → **Products → + Add product** se photos, naam, price, MRP, size + stock, colour
bharte hi: storefront par product turant live ho jaata hai (`/products/<handle>`), aur sheet me
`Products` tab me row upsert hoti hai. Dobara save karne par **wahi row update** hoti hai
(duplicate nahi) — key column `Handle` hai.

| Column | Matlab |
| --- | --- |
| Handle | URL slug (`maroon-anarkali-set`) — key, isliye badalna nahi |
| Product name | card/PDP par naam |
| Price ₹ / MRP ₹ | selling price aur strike-through MRP (rupees me) |
| Sizes | `S (4), M (6), XL (12)` — bracket me stock |
| Colours | comma separated |
| Images | `/api/uploads/…` ya koi https URL |
| Stock | saare sizes ka total |
| Status | `Live` / `Draft` |

### Kaun si row kis tab me jaati hai (poora detail)

| Tab | Kab likhi jaati hai | Kya hota hai andar |
| --- | --- | --- |
| **Orders** | har order event par (placed → shipped → delivered) | Order ID, Date & Time, Event, Status, customer, phone, **WhatsApp link**, **email**, address, city, state, PIN, item-wise detail, qty, subtotal, **discount**, **coupon**, shipping, total, payment method/status/ref, **courier, AWB, tracking URL**, notes, source |
| **Order Items** | order place hone par (har item ek row) | Order ID, date, product, handle, **colour**, size, qty, price, line total, product link, image, order status |
| **Products** | admin se product save/update par (upsert) | handle, naam, price, MRP, **discount %**, size-wise stock/price, colours, images, collection, **category**, fabric, description, stock, status, updated |
| **Enquiries** | product page / cart se WhatsApp order par | date, **enquiry ID**, type, customer, phone, item-wise colour·size·qty·price·link, qty total, value, message, source page |
| **Payments** | payment submit / paid / reverse par | timestamp, event, order ID, status, customer, phone, total, payment status/ref, UPI ID, method, notes |
| **Messages** / **Newsletter** | contact form / footer signup | naam, email, phone, subject, message, status · email |

> **Bharosa:** Apps Script down ho ya network timeout ho jaye to row **disk outbox**
> (`.data/sheet-outbox.json`) me queue ho jaati hai aur agle successful call par khud
> chali jaati hai — isliye order ki koi detail gum nahi hoti.

### Orders + Order Items
Har order place hone par **Orders** me ek row, aur uske har item ki alag row **Order Items** me
(bill/invoice aur packing ke liye). Status badalne par nayi row append hoti hai — isliye poora
timeline milta hai: `placed → confirmed → packed → shipped → delivered`.

### Enquiries (WhatsApp orders)
Customer "Order on WhatsApp" dabata hai (product page ya cart drawer) to browser pehle
`POST /api/enquiry` par detail bhejta hai, phir WhatsApp khulta hai. Isliye chat ke saath-saath
sheet me bhi record rehta hai: kis din, kaun sa item, kaun sa size/colour, kitne pieces, kitne ka.

### Settings (owner ke controls)
| key | example | website me kahan |
| --- | --- | --- |
| `brand_name` | `TRENDS YOUNIQUE` | invoice / WhatsApp naam |
| `tagline` | `Couture for the woman who arrives` | home hero |
| `support_phone` | `8005900581` | footer, contact, header |
| `whatsapp` | `8005900581` | **saare** WhatsApp order links (91 auto lagta hai) |
| `upi_id` `upi_name` | `name@bank` | checkout QR / order page |
| `announcement` | `New drop live — free shipping` | top announcement bar |
| `max_qty_per_item` | `10` | ek product (ek size) ki max quantity |
| `max_qty_bulk` | `30` | XL aur usse bade size ki max quantity |
| `max_qty_per_order` | `15` | poore cart/order me max pieces |
| `gstin` | `08AAAAA0000A1Z5` | invoice |

Khaali cell = website apni default value use karti hai. Value badalte hi ~15 second me site par
asar dikhta hai (redeploy nahi).

## 3. Quantity rules (ek jagah)

`packages/validation/index.ts` me:

- ek line (product + size): **10** pieces, XL/XXL/3XL+ par **30**
- poora order: **15** pieces, aur agar **saare** items XL+ hain to **30**
- UI me `+` button limit par disable ho jaata hai, cart me saaf message aata hai,
  aur server (`createOrder` + zod schema) bhi wahi rule lagata hai — bypass nahi ho sakta.

Owner sheet me numbers badal sakta hai; default yahi rehte hain.

## 4. Verify (curl)

```bash
SHEET_URL="https://script.google.com/macros/s/AKfy…/exec"; TOKEN="trends-9f3k2m-2026"

curl -s "$SHEET_URL?action=settings&token=$TOKEN" | head -c 400      # settings
curl -s "$SHEET_URL?action=health&token=$TOKEN"                       # har tab kitni rows
curl -s "$SHEET_URL?action=recent&sheet=Orders&limit=5&token=$TOKEN"  # last rows

# test row
curl -s -X POST "$SHEET_URL" -H 'Content-Type: text/plain;charset=utf-8' \
  --data '{"token":"'"$TOKEN"'","action":"append","rows":[{"sheet":"Orders","row":{"Order ID":"TY-TEST01","Event":"test","Total ₹":1499}}]}'
```

## 5. Code map

| File | Kaam |
| --- | --- |
| `scripts/google-apps-script/trends-sheets.gs` | Apps Script: `setup`, `settings`, `recent`, `health`, `append`, `upsert` |
| `apps/web/src/lib/google-sheets.ts` | settings read (15s cache) + rows append (6s timeout, best-effort) |
| `apps/web/src/lib/sheet-format.ts` | pure row/format helpers (unit tested) |
| `apps/web/src/lib/store-settings.ts` | DB settings + sheet merge (sheet jeetti hai) |
| `apps/web/src/lib/enquiries.ts` | WhatsApp enquiry save + `Enquiries` row |
| `apps/admin/src/lib/sheets.ts` | admin → sheet (product upsert) |
| `packages/product-store/index.ts` | admin likhta hai, storefront padhta hai |

## 6. Owner ke liye ek line me

> Product daalna hai? Admin → Add product. WhatsApp number/UPI/limits badalna hai? Sheet → Settings.
> Order dekhna hai? Sheet → Orders (ya admin panel). Sheet ka link kisi ko share mat kariye.
