import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  dedupeColourGroups,
  filterLocalCatalog,
  resetLocalCatalogCache,
  sortLocalProducts,
} from "../../apps/web/src/lib/local-catalog";
import type { Product } from "../../apps/web/src/types/catalog";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function makeProduct(index: number, overrides: Partial<Product> = {}): Product {
  const price = 50_000 + index * 5_000;
  return {
    handle: `p-${index}`,
    title: `Product ${index}`,
    price,
    compareAtPrice: price * 4,
    images: ["/images/shop/x/1.webp"],
    collections: ["new-arrivals"],
    sizes: ["M"],
    sizePricing: {},
    inStock: true,
    featured: false,
    ...overrides,
  } as Product;
}

const catalog = Array.from({ length: 60 }, (_, index) => makeProduct(index));

test("load more: offset/limit se aage ka page aata hai, duplicate nahi", () => {
  const first = filterLocalCatalog(catalog, { limit: 24 });
  const second = filterLocalCatalog(catalog, { offset: 24, limit: 24 });
  const third = filterLocalCatalog(catalog, { offset: 48, limit: 24 });

  assert.equal(first.data.length, 24);
  assert.equal(second.data.length, 24);
  assert.equal(third.data.length, 12, "aakhri page bacha hua hi hona chahiye");
  assert.equal(first.total, 60);

  const handles = new Set([...first.data, ...second.data, ...third.data].map((p) => p.handle));
  assert.equal(handles.size, 60, "koi product dobara nahi aana chahiye");
});

test("load more: khaali page par phir se pehla page nahi milta", () => {
  const past = filterLocalCatalog(catalog, { offset: 120, limit: 24 });
  assert.equal(past.data.length, 0);
  assert.equal(past.total, 60);
});

test("collection filter sirf usi collection ke products deta hai", () => {
  const list = [
    makeProduct(1, { collections: ["sale"] }),
    makeProduct(2, { collections: ["new-arrivals"] }),
    makeProduct(3, { collections: ["sale", "new-arrivals"] }),
  ];
  const sale = filterLocalCatalog(list, { handle: "sale" });
  assert.deepEqual(sale.data.map((p) => p.handle).sort(), ["p-1", "p-3"]);
  assert.equal(sale.total, 2);
});

test("price buckets wahi hain jo API me hain", () => {
  const list = [
    makeProduct(1, { price: 49_900 }),
    makeProduct(2, { price: 50_000 }),
    makeProduct(3, { price: 79_900 }),
    makeProduct(4, { price: 80_000 }),
    makeProduct(5, { price: 120_000 }),
  ];
  assert.deepEqual(filterLocalCatalog(list, { price: "under-500" }).data.map((p) => p.handle), ["p-1"]);
  assert.deepEqual(filterLocalCatalog(list, { price: "500-800" }).data.map((p) => p.handle), ["p-2", "p-3"]);
  assert.deepEqual(filterLocalCatalog(list, { price: "800-1200" }).data.map((p) => p.handle), ["p-4"]);
  assert.deepEqual(filterLocalCatalog(list, { price: "above-1200" }).data.map((p) => p.handle), ["p-5"]);
});

test("sort: price low/high aur discount", () => {
  const low = sortLocalProducts(catalog, "price-low");
  assert.ok(low[0].price <= low[low.length - 1].price);
  const high = sortLocalProducts(catalog, "price-high");
  assert.ok(high[0].price >= high[high.length - 1].price);
});

test("ek colour group ka sirf ek card", () => {
  const grouped = [
    makeProduct(1, { handle: "g-1", colourGroup: "g" } as Partial<Product>),
    makeProduct(2, { handle: "g-2", colourGroup: "g" } as Partial<Product>),
    makeProduct(3, { handle: "solo" }),
  ];
  assert.equal(dedupeColourGroups(grouped).length, 2);
});

test("search: title/colour/fabric par multi-word match", () => {
  const list = [
    makeProduct(1, { title: "Meera Mint Green Kurta Set", color: "Mint Green", fabric: "Mul Cotton" }),
    makeProduct(2, { title: "Ruhi Wine Anarkali", color: "Wine", fabric: "Georgette" }),
  ];
  assert.deepEqual(filterLocalCatalog(list, { q: "mint kurta" }).data.map((p) => p.handle), ["p-1"]);
  assert.equal(filterLocalCatalog(list, { q: "wine" }).total, 1);
  assert.equal(filterLocalCatalog(list, { q: "nothing-here" }).total, 0);
});

test("regression: readJson() ka object seedha array maan kar check nahi hota", () => {
  // 25 Oct ka bug — `const all = await readJson(...); Array.isArray(all)` hamesha
  // false tha, isliye static hosting par "Load more" error deta tha.
  for (const file of [
    "apps/web/src/components/collection-browser.tsx",
    "apps/web/src/components/product-grid-client.tsx",
    "apps/web/src/lib/catalog-page.ts",
  ]) {
    const source = readFileSync(resolve(root, file), "utf8");
    const badRead = /const\s+(\w+)\s*=\s*await\s+readJson<[^>]*>\([^)]*\);\s*\n\s*if\s*\(!Array\.isArray\(\1\)/.exec(
      source,
    );
    assert.equal(badRead, null, `${file}: readJson ka .data use karein, poora object nahi`);
  }
});

test("static hosting: API 404 ho to catalog-lite se page aata hai (Load more fix)", async () => {
  const { fetchCatalogPage } = await import("../../apps/web/src/lib/catalog-page");
  resetLocalCatalogCache();
  const originalFetch = globalThis.fetch;
  const local = Array.from({ length: 30 }, (_, index) => makeProduct(index));
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/products")) {
      // GitHub Pages / Netlify static par API route hi nahi hota → 404 HTML
      return new Response("<!doctype html><title>404</title>", { status: 404 });
    }
    if (url.includes("catalog-lite.json")) {
      return new Response(JSON.stringify(local), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  try {
    const page = await fetchCatalogPage({ handle: "new-arrivals", offset: 24, limit: 24 });
    assert.equal(page.total, 30);
    assert.equal(page.data.length, 6, "aakhri page me bache hue products aane chahiye");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("static hosting: API na ho aur catalog bhi na mile to saaf error (silent blank nahi)", async () => {
  const { fetchCatalogPage } = await import("../../apps/web/src/lib/catalog-page");
  const originalFetch = globalThis.fetch;
  resetLocalCatalogCache();
  globalThis.fetch = (async () => new Response("nope", { status: 500 })) as typeof fetch;
  try {
    await assert.rejects(() => fetchCatalogPage({ offset: 0, limit: 24 }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("local (static) count server ke count se match karta hai — har collection", async () => {
  const { buildCatalogLite } = await import("../../scripts/build-catalog-lite.mjs");
  const seed = JSON.parse(readFileSync(resolve(root, "database/seeds/catalog.json"), "utf8")) as {
    products: Product[];
    colourGroups?: Record<string, { handle: string }>;
    collections: { handle: string }[];
  };
  const groups = seed.colourGroups ?? {};
  const lite = buildCatalogLite(seed as never) as Product[];

  const serverListed = seed.products.filter(
    (product) =>
      !(product as Product & { colourGroup?: string | null }).colourGroup ||
      groups[(product as Product & { colourGroup?: string | null }).colourGroup!]?.handle === product.handle,
  );

  for (const collection of seed.collections) {
    const server = serverListed.filter((product) => product.collections.includes(collection.handle)).length;
    const local = filterLocalCatalog(lite, { handle: collection.handle, limit: 100_000 }).total;
    assert.equal(local, server, `${collection.handle}: local ${local} vs server ${server}`);
  }
});
