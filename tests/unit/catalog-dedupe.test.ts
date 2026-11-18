import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const catalog = JSON.parse(readFileSync(resolve(root, "database/seeds/catalog.json"), "utf8")) as {
  meta: { productCount: number; listedProductCount: number; extraProductCount: number };
  products: { handle: string; images: string[]; source: string; collections: string[] }[];
};

const signature = (product: { images: string[] }) =>
  product.images
    .slice(0, 3)
    .map((src) => src.split("/").slice(-2).join("/"))
    .join("|");

test("ek hi photos wale do products catalogue me nahi hain", () => {
  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const product of catalog.products) {
    const key = signature(product);
    if (!key) continue;
    const previous = seen.get(key);
    if (previous) duplicates.push(`${previous} <> ${product.handle}`);
    else seen.set(key, product.handle);
  }
  assert.deepEqual(duplicates, [], `duplicate designs: ${duplicates.join(", ")}`);
});

test("catalogue meta counts products array se match karte hain", () => {
  assert.equal(catalog.meta.productCount, catalog.products.length);
  assert.equal(
    catalog.meta.extraProductCount,
    catalog.products.filter((product) => product.source === "extra").length,
  );
  assert.ok(catalog.meta.listedProductCount > 0 && catalog.meta.listedProductCount <= catalog.products.length);
});

test("catalog-lite (client cards) seed se match karta hai — stale index nahi", async () => {
  const { buildCatalogLite } = await import("../../scripts/build-catalog-lite.mjs");
  const lite = buildCatalogLite(catalog as never) as { handle: string; title: string; price: number }[];
  assert.equal(lite.length, catalog.products.length);
  const seedByHandle = new Map(catalog.products.map((product) => [product.handle, product]));
  for (const card of lite) {
    const seed = seedByHandle.get(card.handle);
    assert.ok(seed, `catalog-lite me extra product: ${card.handle}`);
    assert.equal(card.title, seed!.title, `${card.handle}: title mismatch`);
    assert.equal(card.price, seed!.price, `${card.handle}: price mismatch`);
  }
  // hataye gaye duplicate products wapas na aayein
  assert.ok(!lite.some((card) => card.handle.includes("8228836")));
});
