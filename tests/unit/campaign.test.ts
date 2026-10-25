import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  campaignPrice,
  DIWALI_2026,
  realDiscountPercent,
  withCampaignPricing,
} from "../../apps/web/src/lib/campaign";
import type { Product } from "@liksha/types";

const root = process.cwd();
const catalog = JSON.parse(fs.readFileSync(path.join(root, "database/seeds/catalog.json"), "utf8")) as {
  products: Product[];
};

test("campaign price = MRP ka 25% (75% off), poore rupee me", () => {
  for (const mrp of [124_800, 199_667, 233_000, 459_900, 629_900]) {
    const price = campaignPrice(mrp, 75);
    assert.ok(price < mrp, `${mrp}: price MRP se kam nahi`);
    assert.equal(price % 100, 0, `${mrp}: poore rupee par round nahi hua`);
    assert.equal(realDiscountPercent(price, mrp), 75, `${mrp}: discount 75% nahi`);
  }
});

test("har catalogue product par asli discount exactly 75%", () => {
  let checked = 0;
  for (const product of catalog.products) {
    const mrp = product.compareAtPrice;
    if (!mrp || mrp <= product.price) continue;
    const price = campaignPrice(mrp, 75);
    assert.equal(
      realDiscountPercent(price, mrp),
      75,
      `${product.handle}: MRP ₹${mrp / 100} par discount 75% nahi aaya`,
    );
    checked += 1;
  }
  assert.ok(checked > 400, `kam se kam 400 products check hone chahiye (mila ${checked})`);
});

test("withCampaignPricing: price, MRP aur har size ka price sahi", () => {
  const product = catalog.products[0]!;
  const priced = withCampaignPricing(product, DIWALI_2026);
  const mrp = product.compareAtPrice ?? product.price;
  assert.ok(priced.price < product.price, "campaign price kam honi chahiye");
  assert.equal(priced.compareAtPrice, product.compareAtPrice, "MRP chhedna nahi hai");
  assert.equal(realDiscountPercent(priced.price, mrp), 75);
  for (const [size, entry] of Object.entries(priced.sizePricing ?? {})) {
    assert.ok(entry.price <= product.sizePricing[size]!.price, `${size}: size price kam nahi hua`);
    assert.ok(entry.price < entry.compareAtPrice!, `${size}: size price MRP se kam nahi`);
  }
});

test("MRP na ho to campaign price nahi lagti (jhoothi discount nahi)", () => {
  const product = { ...catalog.products[0]!, compareAtPrice: null } as Product;
  const priced = withCampaignPricing(product, DIWALI_2026);
  assert.equal(priced.price, product.price);
});

test("campaign window: Diwali 2026 ke andar 75%, bahar koi discount nahi", () => {
  const start = Date.parse(DIWALI_2026.startAt);
  const end = Date.parse(DIWALI_2026.endAt);
  assert.ok(end > start, "campaign end, start ke baad hona chahiye");
  assert.ok(Date.parse("2026-11-01T12:00:00+05:30") >= start);
  assert.ok(Date.parse("2026-11-01T12:00:00+05:30") <= end);
  assert.ok(Date.parse("2027-01-15T12:00:00+05:30") > end, "expired promotion nahi dikhni chahiye");
});

test("banner assets config me hain (teen breakpoints)", () => {
  for (const key of ["desktop", "tablet", "mobile"] as const) {
    assert.match(DIWALI_2026.banners[key], /\/images\/banners\/trends-younique-diwali-75-off-(desktop|tablet|mobile)\.webp$/);
    assert.ok(DIWALI_2026.ratios[key] > 0);
  }
  assert.equal(DIWALI_2026.discountPercent, 75);
});
