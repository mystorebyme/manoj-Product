#!/usr/bin/env node
/**
 * Duplicate listing audit + fix.
 *
 * Problem (owner ki shikayat: "image mismatch"): source stores (likshaclothing +
 * thestoreofbufani) me ek hi dress do ya teen naam se listed hai — kabhi
 * `-copy`, kabhi `6301`/Shopify id ke saath, kabhi poora naya naam
 * (jaise `light-pink-anarkali-suit-set` aur `pista-colour-anarkali-suit-set`).
 * Site par wahi photos do products me dikhti hain, isliye customer ko lagta hai
 * ki kis product ki image kis ki hai — galat.
 *
 * Ye script **photo fingerprint** (file ka naam, extension/`?width` ignore)
 * se same-shoot products dhundhti hai aur ek hi rakhti hai:
 *
 *   1. sabse zyada photos, phir
 *   2. sabse zyada reviews, phir
 *   3. sabse saaf title (`copy-of`, `-copy`, Shopify id number = penalty)
 *
 * Baaki products catalogue se hata diye jaate hain aur `overrides.hidden` me
 * likh diye jaate hain — taaki dobara build me wapas na aayein.
 * Colour index aur review aggregates bhi prune hote hain (dead links na rahein).
 *
 * Usage:
 *   node scripts/fix-duplicate-listings.mjs            # audit print
 *   node scripts/fix-duplicate-listings.mjs --write    # fix karke likho
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CATALOGS = [
  "database/seeds/catalog.json",
  "apps/web/src/data/catalog.json",
  "apps/admin/src/data/catalog.json",
];
const OVERRIDES = path.join(ROOT, "database/seeds/admin/overrides.json");
const COLOUR_INDEX = path.join(ROOT, "apps/web/src/data/colour-index.json");
const AGGREGATES = path.join(ROOT, "apps/web/src/data/review-aggregates.json");

const WRITE = process.argv.includes("--write");
/** kitni photos share hon to "ek hi dress" maana jaye */
const MIN_SHARED = 2;

/** file ka stem — extension, `?v=`, trailing size copy hata do */
const stem = (src) =>
  String(src)
    .split("?")[0]
    .split("/")
    .pop()
    .toLowerCase()
    .replace(/\.(jpg|jpeg|png|webp|avif)$/, "")
    .replace(/_(\d{2,3})x(\d{2,3})$/, "");

/** local photos `1.webp`, `2.webp` hain — unse fingerprint nahi banti */
const isFingerprintable = (name) => /[a-z]/.test(name.replace(/^img/, "")) || name.length > 4;

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, CATALOGS[0]), "utf8"));
const products = catalog.products;

/** stem → [product handle] */
const owners = new Map();
for (const product of products) {
  for (const src of product.images ?? []) {
    const name = stem(src);
    if (!/^https?:/.test(String(src))) continue; // local folders apna hi product hain
    if (!isFingerprintable(name)) continue;
    if (!owners.has(name)) owners.set(name, new Set());
    owners.get(name).add(product.handle);
  }
}

/** product pair → shared stem count */
const pairs = new Map();
for (const [name, handles] of owners) {
  if (handles.size < 2) continue;
  const list = [...handles].sort();
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const key = `${list[i]}|${list[j]}`;
      pairs.set(key, (pairs.get(key) ?? 0) + 1);
    }
  }
}

const byHandle = new Map(products.map((product) => [product.handle, product]));
const titlePenalty = (title) => {
  const text = String(title).toLowerCase();
  let penalty = 0;
  if (text.includes("copy")) penalty += 5;
  if (/\d{6,}/.test(text)) penalty += 4;
  if (text.length > 90) penalty += 3;
  if (/\b(copy|duplicate)\b/.test(text)) penalty += 2;
  return penalty;
};
/** gallery + asli reviews dono matter karte hain */
const score = (product) => (product.images?.length ?? 0) * 5 + Math.min(product.reviewCount ?? 0, 50) * 3;
const rank = (product) => score(product) + (product.inStock ? 2 : 0);

/**
 * Ek hi dress ke do listing: score se best chunte hain, par agar doosri listing
 * kareeb hai (85%+) aur uska title saaf hai, to **saaf title** wali jeetati hai
 * (owner ka rule: "clean titles").
 */
function pickKeep(members) {
  const sorted = [...members].sort((a, b) => rank(b) - rank(a));
  const best = sorted[0];
  const close = sorted.filter((product) => rank(product) >= rank(best) * 0.85);
  close.sort(
    (a, b) =>
      titlePenalty(a.title) - titlePenalty(b.title) ||
      rank(b) - rank(a) ||
      String(a.title).length - String(b.title).length,
  );
  return close[0] ?? best;
}

/** union-find: ek hi dress ke saare listings ek group me */
const parent = new Map();
const find = (handle) => {
  let current = handle;
  while (parent.get(current) !== current) current = parent.get(current);
  return current;
};
const union = (a, b) => {
  const rootA = find(a);
  const rootB = find(b);
  if (rootA !== rootB) parent.set(rootB, rootA);
};
for (const handle of byHandle.keys()) parent.set(handle, handle);
for (const [key, count] of pairs) {
  if (count < MIN_SHARED) continue;
  const [a, b] = key.split("|");
  union(a, b);
}

const groups = new Map();
for (const handle of byHandle.keys()) {
  const root = find(handle);
  if (!groups.has(root)) groups.set(root, []);
  groups.get(root).push(handle);
}

const dropped = [];
console.log(`\nphoto fingerprints: ${owners.size} | shared pairs (>=${MIN_SHARED} photos): ${[...pairs.values()].filter((n) => n >= MIN_SHARED).length}\n`);
for (const handles of [...groups.values()].filter((list) => list.length > 1)) {
  const members = handles.map((handle) => byHandle.get(handle));
  const keep = pickKeep(members);
  console.log(`KEEP  ${keep.handle}  (${keep.images.length} photos, ${keep.reviewCount ?? 0} reviews)`);
  for (const product of members.filter((item) => item.handle !== keep.handle)) {
    const shared = (product.images ?? []).filter((src) => owners.get(stem(src))?.size > 1).length;
    console.log(`  drop ${product.handle}  (${product.images.length} photos, ${shared} shared, ${product.reviewCount ?? 0} reviews)`);
    dropped.push({ handle: product.handle, keptBy: keep.handle });
  }
}

/** sirf 1 photo share karne wale — manual review ke liye */
const weak = [...pairs.entries()].filter(([, count]) => count < MIN_SHARED);
if (weak.length) {
  console.log(`\nweak (1 photo shared — manually dekhein): ${weak.length}`);
  for (const [key, count] of weak.slice(0, 12)) {
    const [a, b] = key.split("|");
    console.log(`  ${a}  ↔  ${b}`);
  }
}

if (!WRITE) {
  console.log(`\n${dropped.length} duplicate listings mili — likhne ke liye --write`);
  process.exit(0);
}

const removed = new Set(dropped.map((item) => item.handle));
const keepByDropped = new Map(dropped.map((item) => [item.handle, item.keptBy]));

for (const relative of CATALOGS) {
  const file = path.join(ROOT, relative);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.products = data.products.filter((product) => !removed.has(product.handle));
  for (const collection of data.collections ?? []) {
    collection.productCount = data.products.filter((product) => product.collections?.includes(collection.handle)).length;
  }
  // colour groups: dropped handle ki jagah kept handle
  for (const group of Object.values(data.colourGroups ?? {})) {
    if (!Array.isArray(group?.members)) continue;
    group.members = [...new Set(group.members.map((handle) => keepByDropped.get(handle) ?? handle))].filter(
      (handle) => !removed.has(handle),
    );
  }
  // meta counts bhi sync (warna stale numbers reh jaate hain)
  const liveSource = (product) => product.source !== "extra" && product.source !== "own";
  data.meta = {
    ...(data.meta ?? {}),
    productCount: data.products.length,
    liveProductCount: data.products.filter(liveSource).length,
    extraProductCount: data.products.filter((product) => product.source === "extra").length,
    ownProductCount: data.products.filter((product) => product.source === "own").length,
    listedProductCount: data.products.filter((product) => product.collections?.length).length,
    imageCount: data.products.reduce((sum, product) => sum + (product.images?.length ?? 0), 0),
    colourGroupCount: Object.keys(data.colourGroups ?? {}).length,
    duplicateListingsRemoved: (data.meta?.duplicateListingsRemoved ?? 0) + dropped.length,
  };
  fs.writeFileSync(file, `${JSON.stringify(data, null, 1)}\n`);
  console.log(`updated ${relative} → ${data.products.length} products`);
}

/** overrides.hidden — dobara build me wapas na aayein */
const overrides = JSON.parse(fs.readFileSync(OVERRIDES, "utf8"));
const hidden = new Set(overrides.hidden ?? []);
for (const item of dropped) hidden.add(item.handle);
overrides.hidden = [...hidden].sort();
overrides.meta = {
  ...(overrides.meta ?? {}),
  duplicateListingsFixedAt: new Date().toISOString(),
  duplicateListingsFixed: dropped.length,
};
fs.writeFileSync(OVERRIDES, `${JSON.stringify(overrides, null, 2)}\n`);
console.log(`overrides.hidden: ${overrides.hidden.length} entries`);

/** colour index + review aggregates prune */
if (fs.existsSync(COLOUR_INDEX)) {
  const index = JSON.parse(fs.readFileSync(COLOUR_INDEX, "utf8"));
  const remaining = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, CATALOGS[0]), "utf8")).products.map((product) => product.handle));
  const mapDropped = (handle) => keepByDropped.get(handle) ?? handle;

  // colour-index ka shape: { groups: { groupHandle: { handle, colours: [{name, handle}] } }, byHandle }
  const groups = index.groups ?? {};
  for (const [key, group] of Object.entries(groups)) {
    const colours = (group.colours ?? [])
      .map((colour) => ({ ...colour, handle: mapDropped(colour.handle) }))
      .filter((colour) => remaining.has(colour.handle));
    // duplicate colour (same handle) ek hi baar
    const seenColour = new Set();
    group.colours = colours.filter((colour) => {
      if (seenColour.has(colour.handle)) return false;
      seenColour.add(colour.handle);
      return true;
    });
    if (group.colours.length < 2) delete groups[key];
  }
  index.groups = groups;

  // byHandle ka shape: handle → group handle (string)
  const byHandle = {};
  for (const [key, group] of Object.entries(groups)) {
    for (const colour of group.colours ?? []) byHandle[colour.handle] = key;
  }
  index.byHandle = byHandle;
  fs.writeFileSync(COLOUR_INDEX, `${JSON.stringify(index, null, 1)}\n`);
  console.log(`colour-index pruned → ${Object.keys(groups).length} colour groups`);
}

if (fs.existsSync(AGGREGATES)) {
  const aggregates = JSON.parse(fs.readFileSync(AGGREGATES, "utf8"));
  for (const handle of removed) delete aggregates.products?.[handle];
  fs.writeFileSync(AGGREGATES, `${JSON.stringify(aggregates, null, 1)}\n`);
  console.log("review-aggregates pruned");
}

fs.writeFileSync(
  path.join(ROOT, "database/seeds/admin/duplicate-listings.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), minSharedPhotos: MIN_SHARED, dropped }, null, 2)}\n`,
);
console.log(`\n${dropped.length} duplicate listings hataye gaye`);
