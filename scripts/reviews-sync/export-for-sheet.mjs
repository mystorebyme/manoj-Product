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
const DUPES = path.join(ROOT, "database/seeds/admin/duplicate-listings.json");

const clean = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const reviews = JSON.parse(fs.readFileSync(REVIEWS, "utf8"));
const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
const titles = new Map(catalog.products.map((product) => [product.handle, product.title]));

/**
 * Duplicate listing hataane par uska handle catalog se nikal jaata hai.
 * Uske reviews **us product par** jaane chahiye jo bacha hai — warna review
 * kisi bhi page par nahi dikhta. Mapping: scripts/fix-duplicate-listings.mjs
 * (`database/seeds/admin/duplicate-listings.json` → dropped[].keptBy).
 */
const remap = new Map();
if (fs.existsSync(DUPES)) {
  const report = JSON.parse(fs.readFileSync(DUPES, "utf8"));
  for (const entry of report.dropped ?? []) {
    if (entry?.handle && entry?.keptBy) remap.set(entry.handle, entry.keptBy);
  }
}

/** chain (A → B → C) bhi resolve ho jaye */
function resolveHandle(handle) {
  let current = handle;
  for (let guard = 0; guard < 10 && remap.has(current); guard += 1) current = remap.get(current);
  if (titles.has(current)) return current;
  // Shopify id tail / "copy of" wale purane handle — base product se milao
  const guesses = [
    current.replace(/-\d{8,}$/, ""),
    current.replace(/^copy-of-/, ""),
    current.replace(/^copy-of-/, "").replace(/-\d{8,}$/, ""),
  ];
  return guesses.find((guess) => titles.has(guess)) ?? current;
}

const rows = [];
const seen = new Set();
for (const [handle, block] of Object.entries(reviews.products ?? {})) {
  const target = resolveHandle(handle);
  for (const review of block.reviews ?? []) {
    const body = clean(review.body, 600);
    if (!body) continue;
    const key = `${target}::${body.toLowerCase()}`;
    if (seen.has(key)) continue; // ek hi review do baar nahi
    seen.add(key);
    rows.push({
      timestamp: review.date ? `${review.date}T00:00:00Z` : "",
      handle: target,
      product: titles.get(target) ?? titles.get(handle) ?? "",
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

const unknown = rows.filter((row) => !titles.has(row.handle));
const bytes = fs.statSync(OUT).size;
if (remap.size) console.log(`duplicate listings: ${remap.size} handles surviving product par remap hue`);
if (unknown.length) console.log(`WARNING: ${unknown.length} rows ka handle catalog me nahi hai`);
console.log(`reviews-import.json: ${rows.length} rows, ${Math.round(bytes / 1024)} KB → ${path.relative(ROOT, OUT)}`);
