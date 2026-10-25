# Sheet setup — 5 minute (owner ke liye)

> **Kya chahiye:** Google account (jisme sheet bani hai) aur 5 minute.
> Ek hi baar karna hai. Baad me sirf settings badalni hain to sheet ke `Settings` tab se.

## Step 0 — sheet ready hai

| | |
| --- | --- |
| Sheet | `TRENDS YOUNIQUE — Store DB` |
| Link | https://docs.google.com/spreadsheets/d/1ag5Ivpw8GWkX8oE5_KLe77GFR4KP-7uQFKsmjeZ2xVY/edit |

- Sheet ka link **kisi customer ko na bhejein** (usme phone/address hai).
- Sharing: sirf aapka account. "Anyone with link" **band** rakhein.

## Step 1 — Apps Script kholiye

Sheet kholiye → upar menu **Extensions → Apps Script**.
Ek naya tab khulega (script editor).

## Step 2 — code paste kariye

Repo me file hai: **`scripts/google-apps-script/trends-sheets.gs`**
Uska **poora code** copy karke script editor me paste kar dein (jo default
`function myFunction() {}` likha hai use hata dein).

## Step 3 — do token daaliye

Code ki shuru me ye do line hain:

```js
var TOKEN = 'CHANGE-ME-trends-token';              // master (server padhne/likhne ke liye)
var WRITE_TOKEN = 'CHANGE-ME-trends-write-token';  // write-only (website se rows add)
```

Dono me apna lamba random word daaliye, jaise:

```js
var TOKEN = 'trends-9f3k2m-2026';
var WRITE_TOKEN = 'trends-write-7p4x9q';
```

> `WRITE_TOKEN` sirf rows **add** kar sakta hai — padh nahi sakta, settings nahi badal sakta.
> Ye website ke browser code me hota hai (static hosting par server nahi hota), isliye alag
> rakha gaya hai. Kabhi leak lage to ise badal kar dobara deploy kar dein.

## Step 4 — setup chalaiye

1. 💾 **Save** (Ctrl/Cmd + S)
2. Upar dropdown me `setup` chuniye → **Run**
3. Permission maange to: *Review permissions → apna account → Advanced → Go to (unsafe) → Allow*
   ("unsafe" sirf isliye dikhta hai kyunki script aapki hi hai, publish nahi hui.)
4. Sheet me sab tabs + headers + `Read Me` ban jayenge.

## Step 5 — web app deploy kariye

**Deploy → New deployment → gear icon → Web app**

| Field | Value |
| --- | --- |
| Description | `Trends Younique site` |
| Execute as | **Me** |
| Who has access | **Anyone** ← zaroori |

**Deploy** → URL copy kariye (ends with `/exec`).

## Step 6 — website me URL + token daaliye

**Agar site Render/VPS par hai** (`.env` me):

```
GOOGLE_SHEETS_WEBAPP_URL=https://script.google.com/macros/s/AKfy…/exec
GOOGLE_SHEETS_TOKEN=trends-9f3k2m-2026
```

**Agar site GitHub Pages par hai** (server nahi hota — browser se seedha sheet):

Repo → **Settings → Secrets and variables → Actions → Variables** → *New repository variable*:

| Name | Value |
| --- | --- |
| `SHEET_WEBAPP_URL` | wahi `/exec` URL |
| `SHEET_WRITE_TOKEN` | `trends-write-7p4x9q` (Step 3 ka write token) |

Phir **Actions → GitHub Pages preview → Run workflow** (ya koi bhi push) — build me ye
values chali jayengi.

## Step 7 — test

1. Site par koi product kholiye → **Order on WhatsApp** dabaiye.
2. Sheet kholiye → `Enquiries` tab me row aa jayegi (naam, phone, item, colour, size, qty, price, link).
3. Cart → checkout → address bhar kar **Send order on WhatsApp** → `Orders` + `Order Items` me rows.

Kuch na aaye to: Apps Script me **Deploy → Manage deployments** me "Who has access: Anyone"
check kariye, aur token bilkul same hai ya nahi.

## Code badalne par

**Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.**
URL wahi rehta hai, website me kuch badalna nahi padta.

## Tab kis kaam ka

| Tab | Kab bharta hai |
| --- | --- |
| `Orders` | checkout se order bhejne par (address, phone, items, total, payment) |
| `Order Items` | us order ka har item alag row (colour, size, qty, price, link) |
| `Enquiries` | product page / cart se WhatsApp order ya sawaal |
| `Products` | admin se product save karne par |
| `Payments` | payment submit / paid / reverse |
| `Messages` / `Newsletter` | contact form / footer signup |
| `Settings` | WhatsApp number, UPI, announcement, quantity limits (site 15s me utha leti hai) |
