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
| Tabs | `Orders` (20 cols) · `Order Items` (11) · `Products` (12) · `Enquiries` (9) · `Payments` (11) · `Settings` (key/value) · `Messages` (7) · `Newsletter` (2) · `Read Me` |
| Settings values | `brand_name`, `tagline`, `support_phone`, `whatsapp`, `upi_id`, `upi_name`, `announcement`, `free_shipping`, `shipping_fee`, `gstin`, `max_qty_per_item` = 10, `max_qty_bulk` = 30, `max_qty_per_order` = 15, `admin_url` |

> **Security:** yeh link kisi customer ko nahi bhejni. Isme customer ke phone aur address hain.
> Sheet ko sirf owner ke Google account ke saath share rakhein — "Anyone with link" band.
> Sheet id/URL/token **kabhi** frontend bundle me nahi jaate (sirf server env).

## 1. Apps Script setup (owner, ~5 minute)

1. Upar wali sheet kholiye → **Extensions → Apps Script**.
2. Repo ki file **`scripts/google-apps-script/trends-sheets.gs`** ka poora code paste kariye
   (purana code hata dijiye).
3. Sabse upar wali line badliye:

   ```js
   var TOKEN = 'CHANGE-ME-trends-token';   // apna lamba random word, jaise trends-9f3k2m-2026
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
