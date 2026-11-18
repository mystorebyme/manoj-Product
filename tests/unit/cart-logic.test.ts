import test from "node:test";
import assert from "node:assert/strict";
import {
  addToCart,
  cartKey,
  cartTotals,
  mergeCarts,
  removeFromCart,
  updateQuantity,
  type CartLine,
} from "../../apps/web/src/lib/cart-logic";

/**
 * Live site ka bug: "Add to cart dabaya par cart khaali".
 *
 * Wajah: naya item add karte waqt limit check `lines` array par hota tha
 * **`lines.length` index** par — us index par koi line hi nahi hoti, isliye
 * check hamesha fail hota tha aur item cart me jaata hi nahi tha.
 * Ye tests usi ko pakadte hain.
 */

const anarkali = {
  handle: "rose-noir-anarkali",
  title: "Rose Noir Anarkali",
  price: 349_900,
  compareAtPrice: 499_900,
  image: "/x.jpg",
  size: "M",
  colour: "Wine",
};

test("naya item cart me add hota hai (khaali cart se)", () => {
  const result = addToCart([], anarkali);
  assert.equal(result.changed, true);
  assert.equal(result.notice, null);
  assert.equal(result.lines.length, 1);
  assert.equal(result.lines[0]?.handle, anarkali.handle);
  assert.equal(result.lines[0]?.quantity, 1);
  assert.equal(result.lines[0]?.key, cartKey("rose-noir-anarkali", "M"));
});

test("doosra item add karne par dono cart me rehte hain, naya upar", () => {
  const first = addToCart([], anarkali);
  const second = addToCart(first.lines, { ...anarkali, handle: "ivory-suit", size: "S", price: 249_900 });
  assert.equal(second.lines.length, 2);
  assert.equal(second.lines[0]?.handle, "ivory-suit");
  assert.equal(second.lines[1]?.handle, "rose-noir-anarkali");
});

test("wahi item dobara add karne par quantity badhti hai (duplicate line nahi)", () => {
  const first = addToCart([], anarkali);
  const second = addToCart(first.lines, anarkali);
  assert.equal(second.lines.length, 1);
  assert.equal(second.lines[0]?.quantity, 2);
});

test("quantity 1 ke saath add karne par bhi line quantity 1 hi rahe", () => {
  const result = addToCart([], anarkali, 1);
  assert.equal(result.lines[0]?.quantity, 1);
});

test("per-line limit (10) par add rukta hai, cart waisa hi rehta hai", () => {
  const start = addToCart([], anarkali, 10);
  const blocked = addToCart(start.lines, anarkali, 1);
  assert.equal(blocked.changed, false);
  assert.match(String(blocked.notice), /max 10 piece/i);
  assert.equal(blocked.lines[0]?.quantity, 10);
});

test("XL size par 30 tak allowed (bulk)", () => {
  const start = addToCart([], { ...anarkali, size: "XL" }, 30);
  assert.equal(start.lines[0]?.quantity, 30);
  const blocked = addToCart(start.lines, { ...anarkali, size: "XL" }, 1);
  assert.equal(blocked.changed, false);
});

test("poore order ka cap 15 pieces — uske baad add nahi hota", () => {
  let lines: CartLine[] = [];
  lines = addToCart(lines, { ...anarkali, size: "M" }, 10).lines;
  lines = addToCart(lines, { ...anarkali, handle: "b", size: "S" }, 5).lines;
  assert.equal(cartTotals(lines).count, 15);
  const blocked = addToCart(lines, { ...anarkali, handle: "c", size: "L" }, 1);
  assert.equal(blocked.changed, false);
  assert.match(String(blocked.notice), /max 15 piece/i);
});

test("quantity badhana +10 se zyada na ho", () => {
  const start = addToCart([], anarkali, 3);
  const up = updateQuantity(start.lines, start.lines[0]!.key, 9);
  assert.equal(up.lines[0]?.quantity, 9);
  const blocked = updateQuantity(up.lines, up.lines[0]!.key, 11);
  assert.equal(blocked.changed, false);
  assert.equal(blocked.lines[0]?.quantity, 9);
});

test("quantity 0 karne par line hat jaati hai", () => {
  const start = addToCart([], anarkali, 2);
  const zero = updateQuantity(start.lines, start.lines[0]!.key, 0);
  assert.equal(zero.lines.length, 0);
});

test("remove se line hat jaati hai, baaki cart safe", () => {
  const a = addToCart([], anarkali);
  const b = addToCart(a.lines, { ...anarkali, handle: "ivory", size: "S" });
  const removed = removeFromCart(b.lines, b.lines[0]!.key);
  assert.equal(removed.lines.length, 1);
  assert.equal(removed.lines[0]?.handle, "rose-noir-anarkali");
});

test("storage merge: naya add kiya item purani list se nahi udta", () => {
  const added = addToCart([], { ...anarkali, handle: "new-item" }).lines;
  const stored = addToCart([], anarkali).lines;
  const merged = mergeCarts(added, stored);
  assert.equal(merged.length, 2, "dono items bache rahne chahiye");
  assert.ok(merged.some((line) => line.handle === "new-item"));
});

test("merge poore order ke cap (15) se zyada nahi jaata", () => {
  const a = addToCart([], { ...anarkali, size: "M" }, 10).lines;
  const b = addToCart([], { ...anarkali, handle: "other", size: "S" }, 10).lines;
  const merged = mergeCarts(a, b);
  assert.ok(cartTotals(merged).count <= 15, `count ${cartTotals(merged).count} > 15`);
});
