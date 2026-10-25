import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * Owner ne 26 Oct ko photo choices di thi:
 *   • Meera — main image **chair par baithe hue** wali (4.webp)
 *   • Ruhi  — main image **chair par baithe hue** wali (5.webp)
 *   • home ke circles — poori dress dikhne wali photo (close-up nahi)
 *
 * Ye test unhe pin karta hai, taaki nightly catalogue rebuild ya koi script
 * inhe chup-chaap wapas na badal de. Photo ka order `overrides.json` me bhi hai
 * (build-catalog wahi apply karta hai).
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => JSON.parse(readFileSync(resolve(root, file), "utf8"));

type Seed = {
  products: { handle: string; images: string[] }[];
  collections: { handle: string; image: string }[];
};

const seed = read("database/seeds/catalog.json") as Seed;
const overrides = read("database/seeds/admin/overrides.json") as {
  products: Record<string, { images?: string[] }>;
  collections: Record<string, { image?: string }>;
};

const product = (handle: string) => seed.products.find((item) => item.handle === handle)!;

test("Meera — main image chair wali photo hai", () => {
  assert.equal(
    product("meera-mint-green-gota-pearl-kurta-set").images[0],
    "/images/shop/meera-mint-green-gota-pearl-kurta-set/4.webp",
  );
  assert.deepEqual(
    overrides.products["meera-mint-green-gota-pearl-kurta-set"]?.images?.[0],
    product("meera-mint-green-gota-pearl-kurta-set").images[0],
    "override aur seed ka main image same hona chahiye",
  );
});

test("Ruhi — main image chair wali photo hai", () => {
  assert.equal(
    product("ruhi-wine-anarkali-floral-sleeve-set").images[0],
    "/images/shop/ruhi-wine-anarkali-floral-sleeve-set/5.webp",
  );
  assert.deepEqual(
    overrides.products["ruhi-wine-anarkali-floral-sleeve-set"]?.images?.[0],
    product("ruhi-wine-anarkali-floral-sleeve-set").images[0],
  );
});

test("overrides me product ke saare images seed se match karte hain", () => {
  for (const [handle, patch] of Object.entries(overrides.products)) {
    if (!patch.images) continue;
    assert.deepEqual(patch.images, product(handle).images, `${handle}: override vs seed images`);
  }
});

test("home ke circles ki photo local aur poori dress dikhane wali hai", () => {
  const HOME_CIRCLES = [
    "party-wear-gown",
    "lehnga-choli",
    "printed-suit-set",
    "new-arrivals",
    "trends-signature",
    "sale",
    "weddin-collection",
  ];
  for (const handle of HOME_CIRCLES) {
    const collection = seed.collections.find((item) => item.handle === handle);
    assert.ok(collection, `${handle} collection missing`);
    assert.match(collection!.image, /^\/images\/shop\//, `${handle}: local photo honi chahiye`);
    const file = resolve(root, "apps/web/public", collection!.image.replace(/^\//, ""));
    assert.ok(existsSync(file), `${handle}: photo file missing — ${collection!.image}`);
  }
});

test("har collection (jiski photo dikhti hai) ki image file maujood hai", () => {
  for (const collection of seed.collections) {
    if (!collection.image) continue;
    if (!collection.image.startsWith("/images/")) continue;
    const file = resolve(root, "apps/web/public", collection.image.replace(/^\//, ""));
    assert.ok(existsSync(file), `${collection.handle}: ${collection.image} missing`);
  }
});

test("collection overrides seed ke image se match karte hain", () => {
  for (const [handle, patch] of Object.entries(overrides.collections)) {
    if (!patch.image) continue;
    const collection = seed.collections.find((item) => item.handle === handle);
    if (!collection) continue;
    assert.equal(collection.image, patch.image, `${handle}: override vs seed image`);
  }
});
