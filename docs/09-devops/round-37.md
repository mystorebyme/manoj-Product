# Round 37 — poora e-commerce engine ek Apps Script me (4,500 lines, self-tested)

Owner: _"e-commerce wale jitne bhi use karte hain saare, aur working ok unke add kar do,
Apps Script working tested, saare feature tested, 4-5k lines de do, jo saare function
run kare, aur website par jo dikhna chahiye dikhe — proper."_

File: **`scripts/google-apps-script/trends-sheets.gs`** → `VERSION = '2026-10-25.r17'`,
**4,513 lines**, sab kuch ek hi file me (copy-paste kariye, bas).

---

## 1. Naya kya hai (pehle se jo chal raha tha, wo waisa hi hai)

| Feature | Tab | Endpoint / menu |
| --- | --- | --- |
| **Stock (size-wise)** | `Stock` | `?action=stock` · POST `stock_set` |
| **Coupons** (percent / flat / free-shipping, min order, expiry, usage limit) | `Coupons` | `?action=coupons&code=…&total=…` · POST `coupon_save` / `coupon_disable` |
| **Return / exchange** (7 din window, Settings se) | `Returns` | POST `return_request` · `?action=returns` |
| **Invoice** (printable HTML, GST + invoice number) | — | `?action=invoice&order=…&phone=…` |
| **Order lifecycle server-side** (price/stock/coupon dobara check) | `Orders`+`Order Items`+`Payments` | POST `place_order` |
| **Admin status change** (+ timeline row + customer message + items update + stock wapas on cancel) | `Orders` | POST `order_status` |
| **Order note** | `Orders` | POST `order_note` |
| **Review moderation** | `Reviews` | POST `review_moderate` |
| **Content** — banners, FAQs, categories | `Banners` `FAQs` `Categories` | `?action=banners|faqs|categories` · POST `*_save` |
| **Search** (ProductList) | `ProductList` | `?action=search&q=…` |
| **Reports** — summary, daily, top products, top customers, low stock | — | `?action=reports&type=…` |
| **Notifications log** (WhatsApp link + email) | `Notifications` | — |
| **AuditLog** — kisne kya badla | `AuditLog` | — |
| **Triggers** — Status badla → timeline + message (self-trigger + roz 9 baje digest) | — | menu 10 |
| **Self-test** — 97 check | `_selftest_report` | `?action=selftest` · menu 9 |

Purane saare features (orders, items, payments, enquiries, messages, newsletter, reviews +
photos, ProductList, MainImage, ProductImages, ImagesAll, AddressCheck, Order Updates,
blocked state/PIN, settings cache) **waise hi** hain — site ka koi endpoint nahi toota.

## 2. File ka layout (dhoondhna aasan)

```
BHAG 0  Config, HEADERS (20 tabs), default settings          ~250 lines
BHAG 1  Sheet helpers, product/image sync, setup, Read Me    ~900
BHAG 2  Chhote helpers — text, money (₹12,34,567), phone,
        email, PIN, slug, hash, CSV, dates                   ~250
BHAG 3  Settings cache · Stock · Coupons                     ~360
BHAG 4  Notifications (WhatsApp/email templates) · Invoice
        · Audit log                                          ~290
BHAG 5  Order lifecycle (place → status → timeline) · Returns ~600
BHAG 6  Reports · Banners/FAQs/Categories · Product search   ~250
BHAG 7  doGet / doPost — website ke saare endpoints          ~800
BHAG 8  Self-test (97 check) · Menu · Triggers · Digests     ~900
```

Har section ke upar Hinglish me likha hai ki wo kya karta hai aur kaun use karta hai.

## 3. Self-test — "saare function run kare"

`TRENDS tools → 9. Sab kuch test karo (self-test)` (ya `?action=selftest&token=…`) —
**97 check**, aur jo test sheet me row likhta hai wo khud saaf kar deta hai:

- 25+ helper check (text, number, money, phone, email, PIN, slug, hash, CSV, dates)
- CSV parser (quotes, escaped quotes, khaali lines)
- WhatsApp/email template + invoice number + invoice HTML
- delivery validation (PIN, blocked list) + order totals (subtotal, coupon, qty)
- coupon reasons (expired, usage over, min order, inactive)
- sheet read/write/`ensureColumn_` (scratch tab, baad me delete)
- stock set/read/reduce/restore + out-of-stock rok
- coupon sheet round-trip + redeem count
- order validation (khaali cart, naam/phone/address, galat order number)
- reports + content + search shapes
- **14 live endpoint check** (`public`, `ping`, `schema`, `reviews`, `products_public`,
  `images_public`, `order_status`, `coupons`, `stock`, `banners/faqs/categories`,
  `search`, `invoice`, unauthorized cases)
- POST security (galat token, khaali body, write-token se admin kaam band)

Owner ko sirf itna dekhna hai: **`Fail: 0`**. Fail hone par `_selftest_report` tab me
kaun sa check aur kya error — saaf likha hota hai.

## 4. Developer ke liye: script Node me bhi chalti hai

`tests/helpers/apps-script-harness.mjs` — Apps Script ke globals (SpreadsheetApp,
ContentService, PropertiesService, CacheService, LockService, UrlFetchApp, MailApp,
ScriptApp, Utilities) ka chhota sa "Google" banata hai. Us se:

```
npm run sheet:test        # node --test tests/unit/apps-script.test.ts
```

6 test, aur unke andar:
1. `setup()` saare 24 tab + settings + dropdown bana deta hai
2. **`runSelfTests()` — 97/97 pass**
3. Poora order: `place_order` → Orders/Order Items/Payments rows → coupon 10% (1198 →
   1078) → stock 3 → 1 → `order_status` shipped → timeline (step 3, AWB) → invoice HTML
4. `?action=order_status` ka shape site ke hisaab se
5. Blocked PIN / blocked state par order rukta hai
6. `onEditAutoStatus` — sheet me Status badalne par timeline khud banti hai

Yani sheet me paste karne se **pehle** hi poora flow chalta hua dekha ja chuka hai.

## 5. Owner ke steps (ek baar, 5 minute)

1. Sheet → **Extensions → Apps Script** → poora `trends-sheets.gs` paste → **Save**
2. Run → **`setup`** (naye tabs: Stock, Coupons, Returns, Banners, FAQs, Categories,
   Notifications, AuditLog ban jaate hain — purana data chhedta nahi)
3. **TRENDS tools → 9. Sab kuch test karo** → `Fail: 0` aana chahiye
4. Deploy → **Manage deployments → Edit → New version → Deploy** (URL wahi)
5. Chaho to **menu 10** → automatic triggers (Status badalne par timeline khud)

Roz ka kaam: `Orders` me `Status` badalna, `Order Updates` me comment likhna,
`Stock`/`Coupons`/`Returns` dekhna — website sab turant dikhati hai.

## 6. Website par kya dikhta hai

| Sheet me badla | Website par kahan |
| --- | --- |
| `Settings` | header, footer, announcement, WhatsApp number, qty limits, free shipping, blocked state/PIN |
| `Orders.Status` + `Order Updates` | `/track-order` — 5 step + har step ke 2-3 comment |
| `Reviews` (Status = publish) + `Images` | product page ki reviews + **Customer photos** strip |
| `MainImage` / `ProductImages` | home card, collection, product gallery, cart, checkout, tracking thumbnails |
| `Stock` | **product page par** "Only 2 left in M" / "out of stock" (sheet me row ho to) |
| `Coupons` | checkout coupon validate (site jab chahe use kar sakti hai) |
| `Banners`/`FAQs`/`Categories` | home page content + nav (ready) |
| `ProductList`/`ImagesAll` | admin ke liye poora product + image master |

Product ID **sirf sheet/admin me** — storefront par kabhi nahi (live product page par
sirf "Anarkali suit" dikhta hai, ID nahi).

---

## 7. Site par jo already jud gaya (r17 ke saath)

- **Product page par stock line** — `apps/web/src/lib/sheet-stock.ts` +
  `product-detail.tsx`: `?action=stock&handle=…` se aata hai.
  - row na ho → kuch extra nahi dikhta (purana behaviour)
  - `5` se kam → "Only 2 left in M."
  - `0` → "M — out of stock. WhatsApp …"
  - Sheet purane version par ho (action na ho) → chup-chaap ignore (page normal).
- Tracking, reviews + photos, image overrides — pehle se sheet-driven hi hain.
