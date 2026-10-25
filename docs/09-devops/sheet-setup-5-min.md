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

## Step 3 — tokens (sirf ek line badalni hai)

Code ke shuru me:

```js
var TOKEN = 'PASTE-MASTER-TOKEN-HERE';                 // master (sirf aapke liye)
var WRITE_TOKEN = 'tyw-cb77177528f9474049ffa98fead4cee1';  // website isi se rows add karti hai
```

- `WRITE_TOKEN` **pehle se bhar hua hai** — use chhedna nahi hai (website ka build isi se banta hai).
- `TOKEN` me chat me diya gaya `tym-…` wala lamba token paste kar dein. Ye **master** token hai:
  isse sheet padhi ja sakti hai, isliye ye kabhi public nahi hota.
  Paste na karein to bhi order save hota rahega — bas sheet padne ki permission
  (admin panel / server) band rahegi. Jo placeholder hai wo kisi ko pata nahi, isliye safe hai.

> `WRITE_TOKEN` sirf rows **add** kar sakta hai — padh nahi sakta. Ye website ke browser
> code me hota hai (static hosting par server nahi hota), isliye alag rakha gaya hai.
> Leak lage to ise badal kar, website ke `sheet-config.ts` me bhi wahi value daal kar
> redeploy kar dein.

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

## Step 6 — website me URL (aapke case me pehle se set hai)

Site GitHub Pages par hai, isliye URL + write token **repo ke build** me hain
(`apps/web/src/lib/sheet-config.ts`):

```ts
SHEET_WEBAPP_URL_DEFAULT    = https://script.google.com/macros/s/AKfy…/exec
SHEET_WRITE_TOKEN_DEFAULT   = tyw-cb77…cee1
```

Agar kabhi URL badle (naya deployment), to yahi file badal kar push kar dein — bas.
Repo variables (`SHEET_WEBAPP_URL` / `SHEET_WRITE_TOKEN`) bhi kaam karte hain aur
default ko override kar dete hain.

Server (Render/VPS) par chalane ke liye `.env` me:

```
GOOGLE_SHEETS_WEBAPP_URL=https://script.google.com/macros/s/AKfy…/exec
GOOGLE_SHEETS_TOKEN=<master token (tym-…)>
```

## Step 7 — test

1. Site par koi product kholiye → **Order on WhatsApp** dabaiye.
2. Sheet kholiye → `Enquiries` tab me row aa jayegi (naam, phone, item, colour, size, qty, price, link).
3. Cart → checkout → address bhar kar **Send order on WhatsApp** → `Orders` + `Order Items` me rows.

Kuch na aaye to: Apps Script me **Deploy → Manage deployments** me "Who has access: Anyone"
check kariye, aur token bilkul same hai ya nahi.

## Code badalne par (zaroori)

**Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.**
URL wahi rehta hai, website me kuch badalna nahi padta.

Check karne ke liye browser me kholiye (koi password nahi chahiye):

```
<web app URL>?action=ping
→ {"ok":true,"app":"trends-sheets","version":"2026-10-25.r3", ...}
```

aur write token sahi hai ya nahi:

```
<web app URL>?action=verify_write&token=tyw-cb77…cee1
→ {"ok":true,"writeTokenMatch":true}
```

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
