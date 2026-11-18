import test from "node:test";
import assert from "node:assert/strict";
import {
  QUANTITY_LIMITS,
  checkCartQuantity,
  checkLineQuantity,
  isBulkSize,
  lineLimit,
  orderLimit,
  createOrderSchema,
} from "@liksha/validation";

/**
 * Quantity limits — owner ka rule:
 *   ek item (ek size) 10 · XL+ 30 · poora order 15 (sirf XL+ order ho to 30)
 */

test("isBulkSize: XL aur usse bade sizes bulk hain", () => {
  for (const size of ["XL", "XXL", "2XL", "3XL", "XXXL", "4XL", "XL [42]"]) {
    assert.equal(isBulkSize(size), true, `${size} bulk hona chahiye`);
  }
  for (const size of ["XS", "S", "M", "L", "Free Size", ""]) {
    assert.equal(isBulkSize(size), false, `${size} bulk nahi hona chahiye`);
  }
});

test("lineLimit: normal 10, bulk 30", () => {
  assert.equal(lineLimit("M"), 10);
  assert.equal(lineLimit("XL"), 30);
  assert.equal(lineLimit(undefined), 10);
});

test("orderLimit: mixed order 15 pieces, poora XL+ order 30", () => {
  assert.equal(orderLimit([{ size: "M" }, { size: "XL" }]), 15);
  assert.equal(orderLimit([{ size: "XL" }, { size: "2XL" }]), 30);
});

test("line quantity 10 tak allowed, 11 par saaf message", () => {
  const lines = [{ size: "M", quantity: 1 }];
  assert.equal(checkLineQuantity(lines, 0, 10).ok, true);
  const rejected = checkLineQuantity(lines, 0, 11);
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.match(rejected.message, /max 10/);
});

test("XL par 30 tak allowed (bulk), 31 reject", () => {
  const lines = [{ size: "XL", quantity: 1 }];
  assert.equal(checkLineQuantity(lines, 0, 25).ok, true);
  assert.equal(checkLineQuantity(lines, 0, 31).ok, false);
});

test("poore cart me 15 pieces se zyada nahi", () => {
  const lines = [
    { size: "M", quantity: 8 },
    { size: "L", quantity: 7 },
  ];
  assert.equal(checkCartQuantity(lines).ok, true);
  const rejected = checkCartQuantity([
    { size: "M", quantity: 8 },
    { size: "L", quantity: 8 },
  ]);
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.match(rejected.message, /max 15/);
});

test("mixed cart me XL bulk limit ka faayda nahi milta", () => {
  const rejected = checkCartQuantity([
    { size: "M", quantity: 5 },
    { size: "XL", quantity: 12 },
  ]);
  assert.equal(rejected.ok, false);
});

test("sirf XL+ ka order 30 pieces tak ja sakta hai", () => {
  assert.equal(
    checkCartQuantity([
      { size: "XL", quantity: 15 },
      { size: "XXL", quantity: 15 },
    ]).ok,
    true,
  );
});

test("createOrderSchema bhi wahi limits lagata hai", () => {
  const base = {
    customerName: "Test Customer",
    email: "test@example.com",
    phone: "9876543210",
    address: "12 MG Road, near temple gate",
    city: "Jaipur",
    state: "Rajasthan",
    pincode: "302001",
  };
  const tooManySmall = createOrderSchema.safeParse({
    ...base,
    items: [{ handle: "demo", size: "M", quantity: 11 }],
  });
  assert.equal(tooManySmall.success, false);

  const bulk = createOrderSchema.safeParse({
    ...base,
    items: [{ handle: "demo", size: "XL", quantity: 20 }],
  });
  assert.equal(bulk.success, true);

  const tooManyTotal = createOrderSchema.safeParse({
    ...base,
    items: [
      { handle: "demo", size: "S", quantity: 10 },
      { handle: "demo2", size: "M", quantity: 6 },
    ],
  });
  assert.equal(tooManyTotal.success, false);
});

test("owner default numbers wahi hain (10 / 30 / 15)", () => {
  assert.equal(QUANTITY_LIMITS.perItem, 10);
  assert.equal(QUANTITY_LIMITS.perItemBulk, 30);
  assert.equal(QUANTITY_LIMITS.perOrder, 15);
});
