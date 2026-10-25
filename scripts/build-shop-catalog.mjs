#!/usr/bin/env node
/**
 * build-shop-catalog.mjs — owner ke WhatsApp photos se apne products banata hai.
 *
 * Kya karta hai:
 *   1. `database/seeds/shop-groups.json` padhta hai (ek group = ek product, uski saari
 *      photos usi dress ki).
 *   2. Har photo ko **WebP** me convert karta hai, max 1000px wide, aur
 *      `apps/web/public/images/shop/<handle>/<n>.webp` me likhta hai.
 *      → site ke andar se serve hoti hai, `images/` folder delete karne se kuch nahi tootta,
 *        aur GitHub par 150kB JPEG ki jagah ~60kB WebP jaata hai.
 *   3. Catalogue (`database/seeds/catalog.json` + web/admin copies) me `source: "own"`
 *      products upsert karta hai — price = MRP ka 25% (Diwali 75% off), har size par
 *      same price, sizes XS–3XL.
 *
 * Chalaiye:  node scripts/build-shop-catalog.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_DIR = path.join(ROOT, "images");
const OUT_DIR = path.join(ROOT, "apps/web/public/images/shop");
const GROUPS_FILE = path.join(ROOT, "database/seeds/shop-groups.json");
const CATALOG_FILES = [
  "database/seeds/catalog.json",
  "apps/web/src/data/catalog.json",
  "apps/admin/src/data/catalog.json",
];

const SIZES = ["XS [34]", "S [36]", "M [38]", "L [40]", "XL [42]", "2XL [44]", "3XL [46]"];
const CAMPAIGN_DISCOUNT = 75;
const MAX_WIDTH = 1000;

const groupsFile = JSON.parse(fs.readFileSync(GROUPS_FILE, "utf8"));
const groups = groupsFile.groups;

/** MRP ka 25% (poore rupee) — campaign engine jaisa hi formula */
function salePrice(mrpPaise) {
  return Math.max(100, Math.round((mrpPaise * (100 - CAMPAIGN_DISCOUNT)) / 100 / 100) * 100);
}

function sourceFile(code) {
  const match = fs
    .readdirSync(SRC_DIR)
    .find((name) => name.endsWith(`${code}.jpg`) || name.endsWith(`-WA${code}.jpg`));
  if (!match) throw new Error(`image nahi mili: ${code}`);
  return path.join(SRC_DIR, match);
}

const products = [];
let converted = 0;

for (const group of groups) {
  const dir = path.join(OUT_DIR, group.handle);
  fs.mkdirSync(dir, { recursive: true });
  const images = [];

  let index = 1;
  for (const code of group.files) {
    const src = sourceFile(code);
    const out = path.join(dir, `${index}.webp`);
    await sharp(src)
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 78, effort: 5 })
      .toFile(out);
    images.push(`/images/shop/${group.handle}/${index}.webp`);
    index += 1;
    converted += 1;
  }

  const price = salePrice(group.mrp);
  const sizePricing = Object.fromEntries(
    // Flat 75% off — har size par wahi price (owner: "sabhi ki price 75% MRP se")
    SIZES.map((size) => [size, { price, compareAtPrice: group.mrp, available: true }]),
  );

  const fabric = group.fabric;
  // fabric ke hisaab se comfortable, sach wali baat (har product par same filler nahi)
  const fabricNote = {
    "Mul Cotton": "Mul cotton — soft, breathable, poora din comfortable",
    "Silk Blend": "Silk blend — halka sheen, shaadi aur function ke liye perfect",
    Georgette: "Georgette — flowy drape, light on the shoulder",
    Organza: "Organza — crisp sheer finish, dupatta me extra grace",
  }[fabric] ?? `${fabric} — light aur comfortable`;
  const silhouette =
    group.category === "anarkali"
      ? "Anarkali kurta with churidar and matching dupatta"
      : "Kurta, pant/plazzo aur dupatta — teen piece set";
  const details = [
    `${silhouette} (${fabric})`,
    `Colour: ${group.colour}`,
    fabricNote,
    "Hand-finished in limited runs, Jaipur atelier",
    "Care: gentle hand wash, iron on low heat",
  ];

  products.push({
    handle: group.handle,
    sourceHandle: group.handle,
    title: group.title,
    price,
    compareAtPrice: group.mrp,
    images,
    collections: group.collections,
    category: group.category,
    productType: "Suit set",
    fabric,
    color: group.colour,
    sizes: SIZES,
    sizePricing,
    details,
    description: `${group.title}. ${details.join(". ")}.`,
    descriptionHtml: `<p>${group.title}</p><ul>${details.map((line) => `<li>${line}</li>`).join("")}</ul>`,
    source: "own",
    rating: 0,
    reviewCount: 0,
    inStock: true,
    featured: group.collections.includes("new-arrivals"),
    publishedAt: new Date().toISOString(),
  });
}

for (const file of CATALOG_FILES) {
  const full = path.join(ROOT, file);
  const catalog = JSON.parse(fs.readFileSync(full, "utf8"));
  const byHandle = new Map(products.map((product) => [product.handle, product]));
  const kept = (catalog.products ?? []).filter((product) => !byHandle.has(product.handle));
  catalog.products = [...products, ...kept];
  catalog.meta.productCount = catalog.products.length;
  catalog.meta.ownProductCount = catalog.products.filter((product) => product.source === "own").length;
  catalog.meta.imageCount = catalog.products.reduce((sum, product) => sum + (product.images?.length ?? 0), 0);
  fs.writeFileSync(full, `${JSON.stringify(catalog, null, 1)}\n`, "utf8");
  console.log(`${file}: ${catalog.products.length} products (${catalog.meta.ownProductCount} own)`);
}

console.log(`✅ ${groups.length} products, ${converted} images → WebP (${OUT_DIR.replace(ROOT, ".")})`);
