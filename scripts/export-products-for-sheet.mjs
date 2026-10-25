#!/usr/bin/env node
/**
 * export-products-for-sheet.mjs — saare products ki list Google Sheet ke liye.
 *
 * Do file banti hain (dono site par public):
 *   apps/web/public/data/products-sheet.csv   → Sheet me `=IMPORTDATA(...)` se
 *                                               poori list khud bhar jaati hai
 *   apps/web/public/data/products-sheet.json  → Apps Script / backup ke liye
 *
 * Columns: ID · Handle · Title · Price · MRP · Main Image · Images · Image count ·
 *          Collections · URL
 *
 * `Images` me product ki **saari photos ke poore link** hote hain (` | ` se alag),
 * isliye owner ko har image ka URL sheet me hi mil jaata hai. Photo badalni/hatani ho
 * to `ProductImages` tab (ya `MainImage`) ka use hota hai — wahan se site turant
 * badal jaati hai.
 *
 * Usage: node scripts/export-products-for-sheet.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CATALOG = path.join(ROOT, "database/seeds/catalog.json");
const OUT_DIR = path.join(ROOT, "apps/web/public/data");
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://trendsyounique.fashion";

const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
const products = [...(catalog.products ?? [])].sort(
  (a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")),
);

/** local path → poora public URL (sheet me clickable link) */
function absolute(src) {
  if (!src) return "";
  return src.startsWith("/") ? `${SITE}${src}` : src;
}

/** product ki saari photos, ` | ` se alag — sheet me seedha padhne layak */
function allImages(product) {
  return (product.images ?? []).map(absolute).filter(Boolean).join(" | ");
}

const rows = products.map((product) => {
  const primary = product.images?.[0] ?? "";
  return {
    id: String(product.id ?? ""),
    handle: product.handle,
    title: product.title,
    price: Math.round((product.price ?? 0) / 100),
    mrp: product.compareAtPrice ? Math.round(product.compareAtPrice / 100) : "",
    // local photo (`/images/shop/…`) → poora URL, warna sheet me link kaam nahi karta
    image: absolute(primary),
    // saari photos ke poore link — ` | ` se alag (admin inhe sheet me hi dekh sakta hai)
    images: allImages(product),
    imageCount: product.images?.length ?? 0,
    collections: (product.collections ?? []).join(" | "),
    url: `${SITE}/products/${product.handle}/`,
  };
});

const header = [
  "ID",
  "Handle",
  "Title",
  "Price",
  "MRP",
  "Main Image",
  "Images",
  "Image count",
  "Collections",
  "URL",
];

/** CSV (RFC 4180) — sheet ka IMPORTDATA isi ko padhta hai */
function csvCell(value) {
  const text = String(value ?? "").replace(/\r?\n/g, " ").trim();
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const csv = [
  header,
  ...rows.map((row) => [
    row.id,
    row.handle,
    row.title,
    row.price,
    row.mrp,
    row.image,
    row.images,
    row.imageCount,
    row.collections,
    row.url,
  ]),
]
  .map((line) => line.map(csvCell).join(","))
  .join("\n");

/**
 * `products-images.csv` — **har image ki ek row** (ID + Handle + Title + Position + link).
 * Isse sheet me har product ki saari photos (5 ho ya 20) ID ke saath dikh jaati hain.
 * Sheet ka `ImagesAll` tab isi ko `IMPORTDATA` karta hai.
 */
const imageRows = [];
for (const [index, product] of products.entries()) {
  const id = String(product.id ?? "");
  (product.images ?? []).forEach((src, position) => {
    const url = absolute(src);
    if (url) imageRows.push([id, product.handle, product.title, position + 1, url]);
  });
  // product list order barabar rahe — `index` sirf loop ke liye
  void index;
}

const imageHeader = ["ID", "Handle", "Title", "Position", "Image"];
const imagesCsv = [imageHeader, ...imageRows]
  .map((line) => line.map(csvCell).join(","))
  .join("\n");

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "products-images.csv"), `${imagesCsv}\n`, "utf8");
fs.writeFileSync(
  path.join(OUT_DIR, "products-images.json"),
  `${JSON.stringify(
    {
      meta: {
        note: "Har product ki saari images (ID ke saath) — scripts/export-products-for-sheet.mjs",
        generatedAt: new Date().toISOString(),
        images: imageRows.length,
        columns: imageHeader,
      },
      rows: imageRows,
    },
    null,
    0,
  )}\n`,
  "utf8",
);
fs.writeFileSync(path.join(OUT_DIR, "products-sheet.csv"), `${csv}\n`, "utf8");
fs.writeFileSync(
  path.join(OUT_DIR, "products-sheet.json"),
  `${JSON.stringify(
    {
      meta: {
        note: "Google Sheet ke Products tab ke liye — scripts/export-products-for-sheet.mjs",
        generatedAt: new Date().toISOString(),
        products: rows.length,
        columns: header,
      },
      // Apps Script `ProductImages` tab bharne ke liye — handle → saari image links
      images: Object.fromEntries(
        products.map((product) => [product.handle, (product.images ?? []).map(absolute).filter(Boolean)]),
      ),
      // handle → product ID (sheet me har row ke saath id lagane ke liye)
      ids: Object.fromEntries(products.map((product) => [product.handle, String(product.id ?? "")])),
      products: rows,
    },
    null,
    0,
  )}\n`,
  "utf8",
);

console.log(
  `products-sheet: ${rows.length} products, ${imageRows.length} image links, ` +
    `${Math.round(Buffer.byteLength(csv) / 1024)} KB → apps/web/public/data/products-sheet.{csv,json} + products-images.{csv,json}`,
);
