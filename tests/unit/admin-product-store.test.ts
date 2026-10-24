import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Admin product store — size-wise pricing + sheet row.
 *
 * Test apna alag `DATA_DIR` use karta hai, isliye dev ka `.data/` chheda nahi jaata.
 */
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "trends-store-"));
process.env.DATA_DIR = tempDir;

import {
  deleteProduct,
  getAdminProduct,
  normaliseSizes,
  productSheetRow,
  saveProduct,
  toCatalogProduct,
} from "../../packages/product-store/index.ts";

function seed(overrides: Record<string, unknown> = {}) {
  const result = saveProduct({
    handle: "test-size-price-anarkali",
    title: "Test Size Price Anarkali",
    price: 249_900,
    compareAtPrice: 349_900,
    images: ["/api/uploads/test-front.jpg"],
    colours: ["Wine", "Ivory"],
    sizes: [
      { size: "S", stock: 4 },
      { size: "M", stock: 3 },
      { size: "XL", stock: 2, price: 289_900 },
    ],
    description: "Silk anarkali.",
    collection: "new-arrivals",
    status: "published",
    ...overrides,
  } as never);
  assert.equal(result.ok, true, !result.ok ? result.error : "");
  return result.ok ? result.product : null;
}

test("size-wise price storefront tak pahunchta hai, baaki sizes base price lete hain", () => {
  const record = seed();
  assert.ok(record);
  const catalog = toCatalogProduct(record!);
  assert.equal(catalog.sizePricing?.S?.price, 249_900);
  assert.equal(catalog.sizePricing?.M?.price, 249_900);
  assert.equal(catalog.sizePricing?.XL?.price, 289_900, "XL ka apna price hona chahiye");
  assert.equal(catalog.sizePricing?.S?.available, true);
});

test("stock 0 = size unavailable (sold out size cart me nahi jaata)", () => {
  const record = seed();
  assert.ok(record);
  const catalog = toCatalogProduct(record!);
  assert.equal(catalog.sizePricing?.M?.available, true);
  assert.equal(catalog.sizes.length, 3);
});

test("Products sheet row me size ka apna price dikhta hai", () => {
  const record = seed();
  assert.ok(record);
  const row = productSheetRow(record!);
  assert.equal(row["Product name"], "Test Size Price Anarkali");
  assert.equal(row["Price ₹"], 2499);
  assert.match(String(row.Sizes), /XL \(2 @2899\)/);
  assert.match(String(row.Sizes), /S \(4\)/);
  assert.equal(row.Stock, 9);
});

test("normaliseSizes duplicate size hatata hai aur price paise me rakhta hai", () => {
  const sizes = normaliseSizes([
    { size: "m", stock: 2, price: 199_900 },
    { size: "M", stock: 5 },
    { size: "XL", stock: 1, price: 0 },
  ]);
  assert.deepEqual(sizes, [
    { size: "M", stock: 2, price: 199_900 },
    { size: "XL", stock: 1, price: null },
  ]);
});

test("product delete hone par store se hat jaata hai", () => {
  seed();
  assert.ok(getAdminProduct("test-size-price-anarkali"));
  deleteProduct("test-size-price-anarkali");
  assert.equal(getAdminProduct("test-size-price-anarkali"), null);
});
