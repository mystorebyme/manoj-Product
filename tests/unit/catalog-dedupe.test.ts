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
