#!/usr/bin/env node
/**
 * Reviews → Google Sheet import file.
 *
 * Site ke saare **asli** (Trustoo sync) reviews ko ek chhoti JSON me export karta
 * hai: `apps/web/public/data/reviews-import.json`
 *
 * Owner ise Google Sheet me ek baar me daal sakta hai:
 *   Sheet → menu **TRENDS tools → Import all reviews**
 * (Apps Script `importAllReviews()` khud is URL ko padhta hai, rows append karta
 * hai, duplicate skip karta hai — 1690 rows bhi ek click me.)
 *
 * Usage: node scripts/reviews-sync/export-for-sheet.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const REVIEWS = path.join(ROOT, "database/seeds/reviews/reviews.json");
const CATALOG = path.join(ROOT, "database/seeds/catalog.json");
const OUT_DIR = path.join(ROOT, "apps/web/public/data");
const OUT = path.join(OUT_DIR, "reviews-import.json");

const clean = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const reviews = JSON.parse(fs.readFileSync(REVIEWS, "utf8"));
const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
const titles = new Map(catalog.products.map((product) => [product.handle, product.title]));

const rows = [];
const seen = new Set();
for (const [handle, block] of Object.entries(reviews.products ?? {})) {
  for (const review of block.reviews ?? []) {
    const body = clean(review.body, 600);
    if (!body) continue;
    const key = `${handle}::${body.toLowerCase()}`;
    if (seen.has(key)) continue; // ek hi review do baar nahi
    seen.add(key);
    rows.push({
      timestamp: review.date ? `${review.date}T00:00:00Z` : "",
      handle,
      product: titles.get(handle) ?? "",
      name: clean(review.author, 40) || "Customer",
      rating: Math.max(1, Math.min(5, Math.round(Number(review.rating) || 5))),
      title: clean(review.title, 80),
      body,
      status: "publish",
      source: "trustoo",
    });
  }
}

rows.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      meta: {
        note: "Google Sheet import file — scripts/reviews-sync/export-for-sheet.mjs se banti hai. Sheet me menu: TRENDS tools → Import all reviews.",
        generatedAt: new Date().toISOString(),
        source: reviews.meta?.source ?? "trustoo",
        rows: rows.length,
      },
      rows,
    },
    null,
    0,
  ),
);

const bytes = fs.statSync(OUT).size;
console.log(`reviews-import.json: ${rows.length} rows, ${Math.round(bytes / 1024)} KB → ${path.relative(ROOT, OUT)}`);
