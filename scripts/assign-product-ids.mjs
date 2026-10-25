#!/usr/bin/env node
/**
 * assign-product-ids.mjs — har product ko ek **stable id** deta hai (jaise 1042).
 *
 * Kyun: owner sheet me review likhta hai — product ko handle se pehchanana
 * mushkil hai (handle lambe hote hain aur kabhi badal bhi jaate hain). Isliye
 * har product ki ek chhoti numeric id hai jo kabhi badalti nahi:
 *
 *   - pehle se jinke paas `id` hai unhe **chhua nahi jaata**
 *   - naye products ko max id ke baad wali agli ids milti hain (1001 se shuru)
 *   - ids catalog ke order me nahi, `publishedAt` (purana pehle) se assign hoti
 *     hain taaki list me naya product aane se purani ids shift na hon
 *
 * Usage: node scripts/assign-product-ids.mjs [--write]
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const FILES = [
  "database/seeds/catalog.json",
  "apps/web/src/data/catalog.json",
  "apps/admin/src/data/catalog.json",
];

const START = 1001;
const write = process.argv.includes("--write");

/** master list — teeno files me same ids rahen, isliye ek hi pass me decide hote hain */
const assignments = new Map(); // handle -> id
const taken = new Set();

for (const file of FILES) {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
  for (const product of data.products ?? []) {
    if (product.id) {
      assignments.set(product.handle, String(product.id));
      taken.add(String(product.id));
    }
  }
}

let next = START;
function nextId() {
  while (taken.has(String(next))) next += 1;
  const id = String(next);
  taken.add(id);
  next += 1;
  return id;
}

const base = JSON.parse(fs.readFileSync(path.join(ROOT, FILES[0]), "utf8"));
const pending = (base.products ?? [])
  .filter((product) => !assignments.has(product.handle))
  .sort((a, b) => String(a.publishedAt ?? "").localeCompare(String(b.publishedAt ?? "")) || a.handle.localeCompare(b.handle));

for (const product of pending) assignments.set(product.handle, nextId());

let added = 0;
let updated = 0;
for (const file of FILES) {
  const full = path.join(ROOT, file);
  const data = JSON.parse(fs.readFileSync(full, "utf8"));
  let changed = false;
  for (const product of data.products ?? []) {
    const id = assignments.get(product.handle);
    if (!id || product.id === id) continue;
    if (!product.id) added += 1;
    else updated += 1;
    product.id = id;
    changed = true;
  }
  if (changed) {
    if (write) fs.writeFileSync(full, `${JSON.stringify(data, null, 1)}\n`, "utf8");
    console.log(`${file}: ${(data.products ?? []).length} products`);
  }
}

const total = (base.products ?? []).length;
console.log(
  write
    ? `✅ ${total} products ke paas id hai — ${added} naye, ${updated} badle; range ${Math.min(...[...taken].map(Number))}–${Math.max(...[...taken].map(Number))}`
    : `ℹ️  dry run — ${added} naye ids milenge (--write lagaiye)`,
);
