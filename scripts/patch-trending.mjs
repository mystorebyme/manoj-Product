#!/usr/bin/env node
/**
 * Trending edit — 10 real best-sellers ko "trending" collection me daalta hai.
 *
 * Kyun: owner ne 10 trending products maange (har ek me 2–3+ images). Source
 * store ka `trending` collection sirf 4–5 products ka tha, isliye site par
 * "Trendy Anarkali Sets" rail patli lag rahi thi.
 *
 * Chunnav **asli data** se hota hai (banaya hua kuch nahi):
 *   - customer reviews ka count + rating (Trustoo sync)
 *   - stock me hona
 *   - kam se kam 3 images (gallery me 2–3 se zyada photos dikhein)
 *   - ek jaisa lagne wale duplicates nahi (colour + title family alag)
 *
 * Script seed catalog + site/admin ke generated catalog, teeno ko update karti
 * hai (build script chalane ki zaroorat nahi — baaki data waisa hi rehta hai).
 *
 * Usage: node scripts/patch-trending.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CATALOGS = [
  "database/seeds/catalog.json",
  "apps/web/src/data/catalog.json",
  "apps/admin/src/data/catalog.json",
];
const targetArg = process.argv.slice(2).find((arg) => /^\d+$/.test(arg));
const TARGET = targetArg ? Number(targetArg) : 10;
const dryRun = process.argv.includes("--dry-run");

const SEED = path.join(ROOT, CATALOGS[0]);
const catalog = JSON.parse(fs.readFileSync(SEED, "utf8"));

const normalise = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** pehle se trending me hain — unhe chhedna nahi */
const alreadyTrending = catalog.products.filter((product) => product.collections?.includes("trending"));

const candidates = catalog.products
  .filter((product) => {
    if (product.collections?.includes("trending")) return false;
    if (!product.inStock) return false;
    if (!Array.isArray(product.images) || product.images.length < 3) return false;
    if (!(product.price > 0)) return false;
    if ((product.reviewCount ?? 0) < 1) return false;
    if ((product.rating ?? 0) < 4) return false;
    return true;
  })
  .sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0) || (b.rating ?? 0) - (a.rating ?? 0));

/**
 * Ek hi family / colour ka doosra product dobara na aaye, aur **same photo**
 * kisi doosre product me na ho (cross-store duplicates: live + extra store me
 * ek hi shoot `.jpg` aur `.webp` dono naam se aata hai).
 */
const families = new Set();
const photoNames = new Set();
/** extension bhi hata do — ek hi shoot `.jpg` aur `.webp` dono se aata hai */
const photoName = (src) =>
  String(src)
    .split("?")[0]
    .split("/")
    .pop()
    .toLowerCase()
    .replace(/\.(jpg|jpeg|png|webp|avif)$/, "")
    .replace(/[_\-]\d+$/, "");
for (const product of alreadyTrending) {
  for (const src of product.images ?? []) photoNames.add(photoName(src));
}
const picked = [];
for (const product of candidates) {
  const family = normalise(product.title).split(" ").slice(0, 3).join(" ");
  if (families.has(family)) continue;
  const names = (product.images ?? []).map(photoName);
  if (names.some((name) => photoNames.has(name))) continue;
  families.add(family);
  for (const name of names) photoNames.add(name);
  picked.push(product);
  if (picked.length >= TARGET) break;
}

console.log(`already trending: ${alreadyTrending.length}`);
for (const product of picked) {
  console.log(`  + ${product.handle}  (${product.reviewCount} reviews, ${product.rating}★, ${product.images.length} images)`);
}

if (dryRun) {
  console.log("dry run — kuch likha nahi gaya");
  process.exit(0);
}
if (picked.length < TARGET) {
  console.error(`sirf ${picked.length} products mile — kuch na kuch reh gaya, script rok diya`);
  process.exit(1);
}

/** Owner ke rule: "clean titles" — copy-of / shopify id / * wale naam saaf */
const TITLE_FIX = {
  "copy-of-aniska-white-embroidered-georgette-anarkali-fully-stitched-suit-set":
    "Aniska White Embroidered Georgette Anarkali Set",
  "nehas-premium-anarkali-suit-set": "Neha's Premium Anarkali Suit Set",
  "aarushi-heavy-pure-cinon-silk-gown": "Aarushi Heavy Pure Chinon Silk Gown",
  "manyata-maroon-red-embroidered-georgette-suit-set": "Manyata Maroon Embroidered Georgette Suit Set",
  "whispering-breeze-georgette-embroidered-suit-set-td-107-7287175708804":
    "Whispering Breeze Embroidered Georgette Suit Set",
  "sanayas-black-embroidered-georgette-suit-set": "Sanaya's Black Embroidered Georgette Suit Set",
  "trendy-off-white-suit-set-with-embroidery-and-sequnce-work-7287143530628":
    "Trendy Off-White Embroidered Sequin Suit Set",
  "orange-shades-premium-quality-anarkali-suit-set": "Orange Shades Premium Anarkali Suit Set",
  "prachis-red-havy-vichitra-royal-elegant-suit-set-copy": "Prachi's Red Heavy Vichitra Royal Suit Set",
  "green-bandhej-maslin-anarkali-suit-set-td-141-copy": "Green Bandhej Muslin Anarkali Suit Set",
  "minisa-designer-embroidered-zari-sequins-work-gown": "Minisa Designer Zari Sequin Embroidered Gown",
};

const pickedHandles = new Set(picked.map((product) => product.handle));

for (const relative of CATALOGS) {
  const file = path.join(ROOT, relative);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const product of data.products) {
    if (!pickedHandles.has(product.handle)) continue;
    product.collections = [...new Set([...(product.collections ?? []), "trending"])].sort();
    product.featured = true;
    if (TITLE_FIX[product.handle]) product.title = TITLE_FIX[product.handle];
  }
  const trending = (data.collections ?? []).find((collection) => collection.handle === "trending");
  if (trending) {
    trending.productCount = data.products.filter((product) => product.collections?.includes("trending")).length;
    const hero = picked[0];
    if (hero?.images?.[0]) trending.image = hero.images[0];
    trending.subtitle = "Top rated this week";
  }
  fs.writeFileSync(file, `${JSON.stringify(data, null, 1)}\n`);
  console.log(`updated ${relative}`);
}

/** override me bhi wahi collection image (test + admin dono match karein) */
const overridesFile = path.join(ROOT, "database/seeds/admin/overrides.json");
const overrides = JSON.parse(fs.readFileSync(overridesFile, "utf8"));
const seedTrending = (catalog.collections ?? []).find((collection) => collection.handle === "trending");
if (seedTrending) {
  overrides.collections = overrides.collections ?? {};
  overrides.collections.trending = { ...(overrides.collections.trending ?? {}), image: seedTrending.image };
  fs.writeFileSync(overridesFile, `${JSON.stringify(overrides, null, 2)}\n`);
}

const reviewTotals = picked.reduce((sum, product) => sum + (product.reviewCount ?? 0), 0);
fs.writeFileSync(
  path.join(ROOT, "database/seeds/admin/trending-edit.json"),
  `${JSON.stringify(
    {
      updatedAt: new Date().toISOString(),
      note: "scripts/patch-trending.mjs — trending collection me chune gaye best-sellers (review count + rating se)",
      totalReviews: reviewTotals,
      products: picked.map((product) => ({
        handle: product.handle,
        title: product.title,
        images: product.images.length,
        reviewCount: product.reviewCount,
        rating: product.rating,
      })),
    },
    null,
    2,
  )}\n`,
);
console.log(`trending now: ${alreadyTrending.length + picked.length} products, ${reviewTotals} real reviews`);
