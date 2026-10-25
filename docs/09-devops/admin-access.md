# Admin access — Netlify + domain (pehle aur baad, dono)

> Chhota jawab: **Netlify par admin nahi hota.** Netlify par jo site chalti hai wo
> *static export* hai (`dist/` — sirf HTML/CSS/JS). Admin ek alag **Node app** hai
> (`apps/admin`: login, server actions, file writes). Isliye:
>
> | URL | Result |
> | --- | --- |
> | `https://treand.netlify.app/admin` | ❌ 404 |
> | `https://trendsyounique.fashion/admin` | ❌ 404 (domain lagne ke baad bhi) |
> | `http://localhost:3001/login` | ✅ admin (aapke laptop par) |
>
> Ye bug nahi, design hai — admin ko public internet par rakhna hi nahi hai.
> Customer site Netlify par, admin aapke laptop par (ya alag private host par).

---

## 1. Roz ka kaam: orders/messages ke liye admin ki zaroorat hi nahi

Customer site ka **har detail seedha Google Sheet** me jaata hai (Orders, Items,
Enquiries, Messages, Newsletter, Reviews). Isliye:

- **Orders dekhna / dispatch / status** → Sheet app (mobile par bhi) + WhatsApp
- **Naya product, photo, price, stock** → admin panel (neeche section 2)

Matlab domain lagne se pehle ya baad — order handling me koi farak nahi padta.

---

## 2. Admin apne laptop se (aaj se, free, domain se pehle aur baad same)

Sirf ek baar setup (5 min):

```bash
git clone https://github.com/mystorebyme/manoj-Product.git
cd manoj-Product
git checkout arena/e13f4af5-manoj-product
npm ci
```

**Roz** admin kholna:

```bash
# Mac / Linux
ADMIN_PASSWORD='ApnaPassword123' npm run dev:admin

# Windows PowerShell
$env:ADMIN_PASSWORD="ApnaPassword123"; npm run dev:admin
```

Phir browser me: **http://localhost:3001/login**

| Field | Value |
| --- | --- |
| Email | `admin@trendsyounique.com` (badalna ho to `ADMIN_EMAIL` env se) |
| Password | jo aapne `ADMIN_PASSWORD` me diya |

> `npm run dev:admin` = development mode. Production (`next start`) me default
> password band ho jaata hai — wahin `ADMIN_PASSWORD` dena zaroori hai.

### Admin me kya-kya chalta hai (local)
Products (title, price, size-wise price, stock, **photo order/main image**, naya
product + photo upload), collections (title + **circle photo**), banners, coupons,
reviews, sheet page, aur **Publish** (catalogue rebuild).

### Edit ke baad site par kaise pahunchega
```bash
git add -A
git commit -m "admin: <kya badla>"
git push
```
Netlify auto-deploy karega (2–3 min) → `trendsyounique.fashion` par naya content.
Photo upload `apps/web/public/images/shop/<handle>/` me jaata hai, isliye push ke
saath hi live ho jaata hai.

### "Main laptop par nahi hoon" — tab?
Sheet + WhatsApp se orders chalaayein. Product/photo badalna ho to laptop wale
setup se. (Mobile se admin chalane ke liye section 3.)

---

## 3. 24×7 admin (optional) — Render par, private subdomain

Agar aapko phone/laptop ke bina bhi admin chahiye:

1. Render → **New → Blueprint** → `render.yaml` (repo me pehle se hai, branch
   `arena/e13f4af5-manoj-product`).
2. `ADMIN_PASSWORD` (sync: false) dashboard me set karein.
3. Admin URL milega: `https://trends-younique-admin.onrender.com/login`
4. Chaho to subdomain jod dein: `admin.trendsyounique.fashion` →
   Render → Settings → Custom Domain → CNAME.

Zaroori baatein:

- **Free plan par persistent disk nahi hota** → admin ke edits (`overrides.json`) aur
  photo uploads redeploy par ud sakte hain. Paid **Starter + Disk**
  (`/var/data`, `DATA_DIR=/var/data`) lein to data rehta hai.
- Admin ko kabhi Netlify ke public URL par mat rakhein — wahan login na hone se
  koi bhi ghus sakta hai.
- `ADMIN_PASSWORD` + `ADMIN_SESSION_SECRET` strong rakhein; panel `noindex` hai
  aur har login audit log me jaata hai.

---

## 4. Domain se pehle vs baad — ek nazar me

| | **Domain se pehle** (`treand.netlify.app`) | **Domain ke baad** (`trendsyounique.fashion`) |
| --- | --- | --- |
| Customer site | `treand.netlify.app` | `trendsyounique.fashion` |
| Sheet (orders/messages) | same sheet | same sheet |
| Admin | `localhost:3001` | `localhost:3001` — **bilkul same** |
| Admin par domain ka asar | koi nahi | koi nahi |

Admin ka URL aapke laptop ka hai, website ke domain ka nahi. Isliye domain shift
hone se admin par kuch nahi badalta — na login, na data, na rights.

---

## 5. FAQ

**Q. `trendsyounique.fashion/admin` kholein to?**
404 aayega — aur aana chahiye. Wahan admin rakhna security risk hai (static site par
login protect hi nahi hota).

**Q. Admin ka URL share kar sakte hain staff ko?**
Local admin sirf aapke laptop par chalta hai. Staff ko dena ho to Render wala admin
+ alag staff login (Settings → Staff) use karein.

**Q. Admin me orders khaali dikh rahe hain?**
Local admin `.data/orders.json` padhta hai; asli orders Sheets me hain. Orders page
sirf tab bharta hai jab `STORE_API_URL` + `ADMIN_API_TOKEN` set ho (Render setup).
Roz ka source of truth **Sheet** hai.

**Q. Password bhool gaye?**
`ADMIN_PASSWORD` change karke dobara start karein — bas. (Session 30 din chalta hai,
isliye purana cookie hata dein: browser me site data clear.)
