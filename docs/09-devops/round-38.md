# Round 38 — customer ko asli email (free) + site ki bhasha saaf

Owner ne do cheezein maangi thi:

1. Site par jo technical / "AI jaisi" lines thi (`Status seedha store ke Google Sheet se aata hai…`)
   wo hata do — customer ko sheet/internal ka pata na chale.
2. Order status ki **asli email** customer ko jaye — placed, confirmed, packed, shipped,
   delivered, cancel — poore detail ke saath, **free**, aur **30 tak retry** ho taaki mail gum na ho.

---

## 1. Site ki bhasha (customer-facing copy)

| Pehle | Ab |
| --- | --- |
| "Team ke updates (sheet se)" | "Team ke updates" |
| "Status seedha store ke Google Sheet se aata hai — team jo update karti hai, wahi yahan dikhta hai." | "Order ki har update yahan dikhti hai. Status ke saath email aur WhatsApp par bhi bhej diya jaata hai." |
| "review Google Sheet me save hota hai, owner approve karke publish karta hai" | "team check karke publish karti hai" |
| checkout: sirf WhatsApp ka zikr | + "Order ki poori detail aapke email par bhi pahunch jayegi — aur har update (confirm, packed, shipped, delivered) par nayi email aayegi." |

Poori site par `Sheet`, `API`, `server`, `database`, `sync`, `deploy`, `Apps Script`,
`webhook`, `token`, `JSON` jaise shabd grep karke check kiye — UI me aur kahin nahi mile.
`/sheet-check` page (owner ka diagnostic, `noindex`, navigation me link nahi) jaan-boojh kar
waisa hi hai — wo customer ka page nahi hai. Code comments bhi user ko nahi dikhte.

---

## 2. Email — kaise kaam karti hai

Email **Google ke apne `MailApp`** se jaati hai (Apps Script ke andar free). Koi paid
service, koi SMTP password, koi API key nahi.

### Kab jaati hai

`notifyOrder_()` har status change par chalti hai, aur wahi email bhejta hai. Isliye:

| Kahan se status badla | Email jati hai? |
| --- | --- |
| Site se naya order (`place_order`) | ✅ placed |
| Admin panal se status (`order_status` POST) | ✅ us status ki |
| Sheet me Orders tab ke `Status` column me type (`onEditAutoStatus`) | ✅ us status ki |
| `notify_resend` (dobara bhejna) | ✅ |

Status → email ka head line: placed, confirmed, packed, shipped, delivered, cancel
(`emailStepIndex_`, `orderEmailSubject_`).

### Email me kya hota hai

- Brand header + us status ki head line (Jaise "Aapka order raste me hai 🚚")
- 5-step ki progress strip (placed → confirmed → packed → shipped → delivered)
- Har dress ki photo, naam, colour, size, qty, line total
- Subtotal / discount / shipping / total
- Courier + AWB (ship hone ke baad)
- Address block
- **Order track karein** button (site ke track page par)
- WhatsApp number (Settings se) + payment status + 7 day return
- Footer: "Ye email aapke order par apne aap bheji gayi hai."

Design table + inline CSS me hai — Gmail, Outlook aur phone par ek jaisa dikhta hai.

### Bharosa — 30 retry

1. Har mail pehle **`MailQueue`** tab me row banti hai (Queued At, Order ID, To, Template,
   Subject, Body, Attempts, Next Try, Status, Last Error).
2. Usi waqt bhejne ki koshish (`sendMailNow_`), quota check ke saath
   (`MailApp.getRemainingDailyQuota()`).
3. Fail (net/quota/error) → `Status = retry`, gap ladder:
   1, 2, 5, 10, 20, 30, 60, 120, 180, 240 minute, uske baad **har 6 ghante**.
4. `processMailQueue` trigger **har 10 minute** chalta hai → pending/retry mails khud nikal jati hain.
5. **30 attempt** (`MAX_MAIL_ATTEMPTS`, Settings se 5–100 tak) ke baad bhi na jaye to `Status = failed`,
   `Notifications` tab me row, aur owner ko alert mail — mail chupchaap gum nahi hoti.
6. Owner ke paas har status mail ki **[Owner copy]** bhi jaati hai (pata rahe kya gaya).
7. Menu **11. Purana data saaf karo** ab `MailQueue` ki 45 din purani `sent` rows bhi hatata hai
   (`retry`/`failed` rows kabhi nahi hatate).

Email kabhi order ko nahi rok sakti: poora email block `try/catch` me hai, aur order row
pehle hi save ho chuki hoti hai.

### Naye endpoint (Apps Script)

| Endpoint | Kaam |
| --- | --- |
| `GET ?action=mail_queue` (+ token) | queue ka hisaab + quota |
| `GET ?action=mail_queue&run=1&force=1&token=…` | queue abhi chalao (retry bhi) |
| `GET ?action=mail_test&to=you@mail.com&token=…` | test email (design dekhne ke liye) |

Menu: **TRENDS tools → 3. Orders → Test email bhejo / Email queue abhi chalao**.

### Settings

| Key | Default | Kaam |
| --- | --- | --- |
| `email_updates` | `true` | `false` karne par customer email band |
| `email_from_name` | `TRENDS YOUNIQUE` | email me bhejne wale ka naam |
| `owner_email` | (khaali) | owner copy + fail alert isi par |
| `mail_max_attempts` | `30` | retry limit (5–100) — 40–50 chahiye to badha lein |

---

## 3. Test (Node me, asli sheet ke bina)

`npm run sheet:test` → **9/9 pass**. Naye test:

- order place → customer ko email (items, ₹ total, brand) + owner copy + queue `sent`
- status `shipped` → nayi email me courier + AWB
- `MailApp` fail → mail **queue me retry**, `sent` nahi; net theek hone par flush → `sent`
- `mail_queue` / `mail_test` endpoint

Self-test me 7 naya email check (quota, subject, step index, HTML, queue write) — **113 check**.

---

## 4. Owner ko kya karna hai (ek baar)

1. `scripts/google-apps-script/trends-sheets.gs` (r18) **poora** copy karke Apps Script me paste.
2. Apps Script me **Run → `setup`** (ek baar permission maangega — allow karein).
3. **Deploy → Manage deployments → Edit → Version: New version → Deploy.**
   URL wahi rehta hai, site ko kuch badalna nahi.
4. Settings tab me `owner_email` bhar dein (owner copy + alert ke liye).
5. Test: menu → **3. Orders → Test email bhejo** → apna email daalein → inbox/spam dekhein.
   (`You do not have permission…` aaye to §5 dekhein — `authorizeMail` Run karna hai.)
6. Ek asli order par check: `MailQueue` tab me `sent` dikhna chahiye.

---

## 5. `You do not have permission to call MailApp.sendEmail` — fix (sirf jab `mail_use_google = true` ho)

Ye error Google ki permission ka hai, code ka bug nahi. Script pehle sirf sheet ke liye
authorize hui thi; email bhejne ke liye alag permission (`script.send_mail`) chahiye,
aur wo **sirf Apps Script editor se Run karne par** maangi jaati hai (menu se nahi).

### Ek baar ka fix (2 minute)

1. Sheet me **Extensions → Apps Script**.
2. Upar function dropdown me **`authorizeMail`** chuniye (naya function hai).
3. **Run** dabaiye.
4. **Review permissions** → apna Google account chuniye.
5. "Google hasn't verified this app" aaye to **Advanced → Go to … (unsafe)** → **Allow**.
6. Sheet par wapas aaiye → menu **TRENDS tools → 3. Orders → Test email bhejo**.
   Ab email chali jayegi. (Popup me "Email permission mil gayi ✔ Aaj ki bachi quota: N" aata hai.)

Agar phir bhi permission na aaye (kabhi Google purani permission yaad rakhta hai):

- **Project Settings → "Show manifest file"** → `appsscript.json` kholein aur isme
  `oauthScopes` list me ye line add karein:
  `"https://www.googleapis.com/auth/script.send_mail"`
  (ya repo ka `scripts/google-apps-script/appsscript.json` poora paste kar dein) → **Save**,
  phir `authorizeMail` dobara Run.
- Ya https://myaccount.google.com/permissions par jaakar is project ki access hata kar
  `authorizeMail` dobara Run karein.

### Mail quota — kitni mail roz

| Account | Roz |
| --- | --- |
| Normal Gmail | ~100 mail |
| Google Workspace | ~1,500 mail |

Har order par 2 mail jaati hain (customer + owner copy). 100 din me ~50 order tak aaram se.
Quota khatam ho jaye to mail `MailQueue` me **retry** par rukti hai (30 tak) aur agle din
khud chali jaati hai — customer ka order ya sheet ka data kabhi nahi rukta.

### Poora order flow isse kaise safe hai

- Order pehle sheet me save hota hai, email uske **baad**.
- Permission/quota/net ki koi bhi error aaye → order banta hai, `MailQueue` me row
  `retry` par rehti hai, aur owner ko alert mail milta hai (usme steps bhi hote hain).
- Permission milne ke baad queue ki bachi hui mail apne aap nikal jaati hai — dobara
  bhejne ki zaroorat nahi (ya menu → "Email queue abhi chalao").

---

## 6. Apni Gmail nahi — free providers + 20+ fallback (r20)

Owner ne saaf kaha: **apni mail id nahi deni, wo use nahi karni**. Isliye email ka
system **provider chain** ban gaya hai.

### Kaam kaise karta hai

Sheets me naya tab **`EmailKeys`** (21 ready rows). Jitni rows me key daalenge, utne
fallback. Mail bhejte waqt code **upar se neeche** try karta hai — ek fail/quota khatam
ho to **agle provider** se chali jaati hai, aur `MailQueue` 30 baar tak retry karti hai.

```
Brevo (slot 1) → Brevo (slot 2) → EmailJS → Resend → Mailjet → Elastic Email → … (21 slots)
```

Har row ka `Status` (ok / fail) aur `Last Error` tab me likha jata hai.

### Customer ko mail kaun bhej sakta hai (apni Gmail diye bina)

| Provider | Free | Key kaise (2-4 minute) |
| --- | --- | --- |
| **Brevo** ⭐ sabse aasan | 300 mail/din | brevo.com → signup → SMTP & API → **API key** → sender email verify → `EmailKeys` me Provider=brevo, Key=API key, **From Email** = wahi verified email |
| EmailJS | 200 mail/mahina | emailjs.com → service + template (jisme `to_email`, `subject`, `message`) → Key=service_id, Key 2=template_id, Key 3=public key |
| Resend | 100 mail/din | resend.com → API key → Key=re_…, From Email = verified |
| Mailjet | 200 mail/din | mailjet.com → API key + secret → Key / Key 2, From Email = verified sender |
| Elastic Email | 100 mail/din | elasticemail.com → API key → From Email = verified |

> **Note:** "From Email" koi bhi verified address ho sakti hai (jaise
> `orders@trendsyounique.fashion` ya koi bhi free mailbox) — **aapki personal Gmail
> zaroori nahi**, aur aapki Gmail ka password kahin nahi dena.

### Web3Forms / FormSubmit ("static form" wale)

Ye **sirf owner ko** mail bhejte hain — Web3Forms ki key jis email par bani ho, mail
wahin jaati hai. Customer ke email id par ye service mail nahi bhej sakti (ye by-design
hai, spam rokne ke liye). Isliye inki jagah ye hai:

- **Owner alert** (order aaya, email fail hui, quota khatam) → Web3Forms / FormSubmit se
  seedha aapke inbox me. `EmailKeys` me 10 Web3Forms + 4 FormSubmit slots ready hain;
  key paste + Enabled = TRUE. (FormSubmit me Key = aapka email id.)
- Customer ki status email → Brevo/EmailJS/Resend/Mailjet/Elastic Email se.

### Google (MailApp) — band by default

`Settings` me `mail_use_google = false` hai, isliye **aapke Google account se koi mail
nahi jaati**. Agar kabhi chahiye to `true` kar dein (us waqt `authorizeMail` Run karna
padega, §5).

### Settings

| Key | Default | Kaam |
| --- | --- | --- |
| `mail_use_google` | `false` | sheet ke Google account se mail (aapki Gmail) — default band |
| `mail_from_email` | (khaali) | email ka "From" address |
| `owner_email` | (khaali) | owner copy / fail alert ka address |
| `mail_max_attempts` | `30` | queue retry limit (5–100) |

### Test

`npm run sheet:test` → **14/14 pass**. Naye test:

- Brevo se customer ko mail (payload me customer ka email, `api-key` header, MailApp use nahi)
- Brevo fail → Resend try → mail chali jati hai (fallback chain)
- saare provider fail → queue `retry` (mail gum nahi hoti)
- Web3Forms se owner alert (access_key, message)

Menu: **3. Orders → Email keys (apni Gmail ke bina)** tab kholta hai,
**Email providers ki sthiti** batata hai kaun chalu hai.
