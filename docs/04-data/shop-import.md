# Owner ki photos → store products (import flow)

Owner `images/` folder me WhatsApp photos daalta hai (naam `IMG-YYYYMMDD-WA####.jpg`).
Unhe site ke products me badalne ke do hi step hain.

## 1. Grouping file: `database/seeds/shop-groups.json`

Ek group = **ek product**. Us dress ki saari photos usi group ke `files` array me.
Alag dress = alag group. Yahi single source of truth hai — naya product add karne
ke liye sirf ye file edit karni hai.

```json
{
  "handle": "meera-mint-green-gota-pearl-kurta-set",
  "title": "Meera Mint Green Gota Pearl Kurta Set",
  "colour": "Mint green",
  "fabric": "Mul cotton",
  "category": "suit-set",
  "collections": ["new-arrivals", "printed-suit-set"],
  "mrp": 269900,
  "files": ["0001", "0002", "0003", "0005", "0013"]
}
```

- `mrp` **paise** me (₹2,699 = 269900). Sale price campaign engine se aati hai
  (Diwali 2026 = MRP ka 25%, yaani flat 75% off), aur har size par wahi price.
- `files` me sirf 4-digit number (`WA0001` ka `0001`) — filename ka poora naam nahi.
- `collections` me site ke collection handles (`new-arrivals`, `printed-suit-set`,
  `suit-set-gown`, `party-wear-gown`, `weddin-collection`, `trends-signature`,
  `lehnga-choli`). Khaali collection par link nahi banta, isliye sahi handle daalein.

## 2. Import script

```bash
node scripts/build-shop-catalog.mjs
```

Kya karta hai:

1. Har photo ko **WebP** (max 1000px wide, quality 78) me convert karta hai aur
   `apps/web/public/images/shop/<handle>/<n>.webp` me likhta hai.
   → Site ki images ab **repo ke andar** hain, kisi bahar ke CDN/GitHub par depend
   nahi karti. `images/` folder delete karne se site par kuch nahi tootta
   (bas dobara import nahi kar paayenge).
2. `database/seeds/catalog.json`, `apps/web/src/data/catalog.json`,
   `apps/admin/src/data/catalog.json` — teeno me `source: "own"` products upsert
   karta hai (handle par match, isliye dobara chalane se duplicate nahi bante).
3. 71 own products, 93 WebP images (~7 MB total, average 75 KB per image).

Uske baad:

```bash
npm run test:all        # unit + integration + db
npm run catalog:verify  # catalogue ke rules (price, images, handles)
npm run build --workspace @liksha/web
```

## Photo quality tips (owner ke liye)

- Ek dress ki 3–5 photos: front, side, back, dupatta close-up, styling shot —
  gallery me yahi order rahega (`files` array ka order).
- Har photo ~1000px+ chaudi ho, natural light me, plain background par.
- Ek photo me ek hi dress — do dresses ki photo group me na daalein.
