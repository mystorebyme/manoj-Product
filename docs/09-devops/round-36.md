# Round 36 — sheet audit + har product ki ID aur saari image links

Owner ne published link diya
(`docs.google.com/spreadsheets/d/e/2PACX-1vQFvvmVmL8jQl0lNPONqgVOXN1J3LZf1BACkoTv-RRakvQHDRRXz6CYFNdPgFPckMc7SjCHLctLqCGx`)
aur kaha: **"khud hi saari sheet dekh lo, sab fix karo Apps Script se — product hai to
uski ID bhi honi chahiye (sirf admin ke liye), aur product ki jitni bhi images hain
(5, 10, 20) unke link sheet me ID ke saath hone chahiye."**

---

## 1. Published link se kya dikha (audit)

`pubhtml` khulta hai, saare 15 tab listed hain: Settings, Orders, Order Items, Products,
Enquiries, Payments, Messages, Reviews, Newsletter, Read Me, ProductList, MainImage,
ProductImages, AddressCheck, Order Updates.

Published `pub?output=csv` **HTTP 500** deta hai (Google ki taraf se) — isliye audit
seedha Sheets API se kiya gaya (wahi sheet, same data).

Jo kami mili:

| Tab | Pehle | Ab |
| --- | --- | --- |
| `ProductList` | 4 column dikh rahe the (ID · Handle · Title · Price) | **10 column, 477 rows** — `Images` me har product ki saari links, `Image count`, URL |
| `Products` | 8 column, **koi `Product ID` column nahi**, koi product row nahi | `Product ID` column (P) add, IDs menu se bharti hain |
| `ProductImages` | sirf 3-4 sample row, **ID nahi** | `Product ID` column (E) + saari images (menu 5) |
| `MainImage` | sirf 1 sample row, ID nahi | `Product ID` column (D) + IDs |
| `ImagesAll` | tab hi nahi tha | **naya tab, live filled — 2738 image rows** (ID · Handle · Title · Position · Image) |

R36 me moolya (live, verify kiya):

- `ProductList` — **477 products**, column A–J bhari hui (ID 1001–1477).
- `ImagesAll` — **2738 rows**, har row me `ID` + `Handle` + `Position` + poora image link.
  Matlab har product ki 2–20 photos, sab sheet me ID ke saath.
- `Products` / `MainImage` / `ProductImages` — `Product ID` column ban gaya; `MainImage`
  aur `ProductImages` ki maujooda rows me ID bhar di (1407, 1001, 1002 …).

## 2. Apps Script r15 (yahi "sab fix" karta hai)

`scripts/google-apps-script/trends-sheets.gs` → `VERSION = '2026-10-25.r15'`

Naya/updated:

- **`HEADERS.Products`** me `Product ID` (aakhir me — purani rows shift nahi hoti).
- **`ensureColumn_(tab, 'Product ID')`** — jo tab purana hai usme column aakhir me jodta hai
  (`ProductImages`, `MainImage` dono).
- **`productIdByHandle_()` / `nextProductId_()`** — ProductList (477 IDs, 1001–1477) se map;
  naya product aaye to agli ID khud.
- **`backfillAllProductIds()`** (menu **7**) — `Products`, `MainImage`, `ProductImages`,
  `Reviews` — sab me missing ID bhar deta hai (jo cell bhari hai use chhedta nahi).
- **`syncProductImages()`** (menu **5**) — `products-images.json` se **har product ki har
  photo** ki row likhta hai: `Handle · Position · Image · Note · Product ID`.
  Pehle se maujood `handle+position` skip hoti hai, isliye duplicate nahi bante.
- **`syncAllImages()`** (menu **6**) — naya `ImagesAll` tab: **2738 image rows** (477
  products, 2–20 photos each), har row me ID.
- **`writeCsvTab_()` / `parseCsv_()` / `fetchFirst_()`** — CSV seedha values me likhta hai.
  Kyun: `IMPORTDATA` badi file par `#N/A`/`#REF!` de deta hai (R36 me test kiya), Apps Script
  ka `UrlFetchApp` wahi file le aata hai. URL list me site ka URL pehla, **GitHub raw**
  backup doosra — ek block ho to doosra chal jaata hai.
- `syncProductList()` — IMPORTDATA ke baad agar rows < 10 aayein to CSV seedha likh deta hai.

## 3. Data files (jo script padhta hai)

`node scripts/export-products-for-sheet.mjs`:

- `apps/web/public/data/products-sheet.csv` — 477 rows, column:
  `ID · Handle · Title · Price · MRP · Main Image · Images (saari links, " | " se) · Image count · Collections · URL`
- `apps/web/public/data/products-images.csv` — **2738 rows**, column:
  `ID · Handle · Title · Position · Image`
- `products-sheet.json` me `images` (handle → saari links) aur **`ids`** (handle → ID) map.
- `products-images.json` — `rows: [[ID, Handle, Title, Position, Image], …]`

## 4. Owner ke 2 minute ke step

`ImagesAll` aur `ProductList` **already bhare hue hain** (agent ne khud bhar diye), isliye
sirf ye karna hai:

1. Sheet → Extensions → Apps Script → poora `trends-sheets.gs` paste → **Save**.
2. Run → `setup` (headers/dropdown theek karta hai, data chhedta nahi).
3. `TRENDS tools` menu → **7. Har product ki ID bharo (admin-only)** — `Reviews` ke 1684
   purane review rows me bhi ID aa jaayegi (baaki tabs already bhari hain).
4. Menu → **6. Saari images ek jagah (ImagesAll)** — optional; abhi `ImagesAll` GitHub ke
   data file se bhara hai. Ek baar click karne par wahi data site ke URL se aata hai
   (permanent, branch delete hone par bhi chalta rahega).
5. Menu → **5. Saari products ki images list bharo** — `ProductImages` tab (photo
   badalne/hatane ka control) bhi poori bhar jaati hai. **Iske baad koi photo badalni ho to
   yahin kariye.**
6. Deploy → Manage deployments → **New version** (warna live site purana code hi bhejti hai).

> `IMPORTDATA` ka note: site ke `/data/*.csv` URL par Google kabhi `#N/A` de deta hai
> (R36 me hua). Isliye `ImagesAll` filhaal GitHub ke raw data file se bhara hai aur
> Apps Script ka naya `writeCsvTab_()` URL fail hone par GitHub raw se le leta hai.

## 5. Product ID public par nahi

- Product page par `· ID 1366` R35 me hi hata diya gaya (confirm: live page par sirf
  `Anarkali suit`, koi ID nahi).
- Sheet ke `Product ID` column sirf sheet me hain — website inhe kabhi render nahi karti
  (`order_items` me bhi nahi). Admin panel route authenticated + `noindex`.

---

## 6. Tracking live kyun nahi chal raha tha (asli wajah)

Production Apps Script ka deployed version **`2026-10-25.r8`** hai (agent ne
`?action=ping` se check kiya), jabki repo me **r16** hai. r8 purana gate lagata hai —
`?action=order_status` par bhi `{"ok":false,"error":"unauthorized"}` aata hai. Isliye
track page par "order nahi mila" jaisa message aata tha, aur sheet se reviews/images
bhi site par nahi pahunch rahe the.

**Isliye deploy karna zaroori hai:**

1. Sheet → Extensions → Apps Script → poora `trends-sheets.gs` (r16) paste → Save.
2. Deploy → **Manage deployments** → pencil (Edit) → **Version: New version** → Deploy.
   (Naya deployment banane se URL badal jaata hai — edit karke "New version" hi kariye.)
3. Confirm: browser me `<webapp-url>?action=ping` kholiye → `"version":"2026-10-25.r16"`
   aana chahiye.
4. Uske baad `<webapp-url>?action=order_status&order=LK-XXXXXX&phone=98XXXXXXXX`
   JSON deta hai, aur site par tracking kaam karta hai.

## 7. Tracking page ab kya dikhata hai (r16 + site)

- Order number + registered mobile se **sheet ke `Orders` tab** se status (
  `placed → confirmed → packed → shipped → delivered`, cancel/RTO bhi samajhta hai).
- **`Order Updates` tab** ki rows step ke hisaab se group hoti hain — ek step par
  **2-3 comment** ho sakte hain, sab usi step ke neeche (nayi pehle) dikhte hain,
  date ke saath. `Visible` = `no` wali row customer ko nahi dikhti.
- Naya menu item **9. Order ke 5 step comments banao** — har order ke liye 5 ready
  rows banata hai (default message, `Visible` = `no`). Aap date/message theek karke
  `yes` kar dijiye.
- `Orders` ka `Status` column: dropdown (placed/confirmed/packed/shipped/delivered/cancelled).

## 8. Review photos sheet me

- `scripts/reviews-sync/export-for-sheet.mjs` ab `photos` + `images` bhi export karta hai
  — **146 reviews, 251 photo links** (Trustoo customer photos).
- `Reviews` tab me naya column **`Images`** (`URL1 | URL2 …`).
- Menu **8. Reviews ki photos bharo** — purane 1684 review rows me photo links bhar deta hai
  (handle + body se match, kuch delete nahi hota).
- Site (`?action=reviews`) ab `photos` array deta hai, aur product page ki
  **Customer photos** strip me sheet wali photos bhi aati hain.
