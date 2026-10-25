import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ORDER_STEPS, groupOrderUpdates, stepIndex } from "../../apps/web/src/lib/sheet-orders";

/**
 * Order tracking ke **sheet-side** contract:
 *
 *   1. `Order Updates` tab me ek step par 2-3 comment ho sakte hain — site unhe
 *      us step ke neeche dikhati hai (nayi comment pehle), gum nahi karti.
 *   2. Status ka koi bhi likha hua roop (sheet me `Shipped`, `Out for delivery`,
 *      `RTO` …) sahi step par baithta hai — owner ko exact word yaad rakhne ki
 *      zaroorat nahi.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("ek step par 2-3 comment — sab usi group me aate hain, nayi pehle", () => {
  const groups = groupOrderUpdates([
    { at: "2026-10-20T10:00:00Z", status: "packed", message: "Packing ho gayi" },
    { at: "2026-10-21T11:00:00Z", status: "packed", message: "Quality check done" },
    { at: "2026-10-19T09:00:00Z", status: "confirmed", message: "Order confirm" },
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((group) => group.step), [1, 2]);
  const packed = groups[1]!;
  assert.equal(packed.key, "packed");
  assert.equal(packed.items.length, 2);
  assert.equal(packed.items[0]!.message, "Quality check done");
  assert.equal(packed.items[1]!.message, "Packing ho gayi");
});

test("khaali updates — koi group nahi (page crash nahi hota)", () => {
  assert.deepEqual(groupOrderUpdates([]), []);
});

test("sheet me alag words likhe hon to bhi sahi step", () => {
  assert.equal(stepIndex("Out for delivery"), 3);
  assert.equal(stepIndex("Dispatched"), 3);
  assert.equal(stepIndex("RTO"), -1);
  assert.equal(stepIndex("Delivered"), 4);
  assert.equal(stepIndex("Ready for pickup"), 2);
  assert.equal(stepIndex("Label printed"), 2);
  assert.equal(stepIndex("random text"), 0);
});

test("5 step ka order fix hai (placed se delivered)", () => {
  assert.deepEqual([...ORDER_STEPS], ["placed", "confirmed", "packed", "shipped", "delivered"]);
});

test("reviews-import.json me customer photos ke poore https links hain", () => {
  const file = path.join(repoRoot, "apps/web/public/data/reviews-import.json");
  const payload = JSON.parse(readFileSync(file, "utf8")) as {
    rows: { images?: string; photos?: string[] }[];
  };
  const withPhotos = payload.rows.filter((row) => (row.photos ?? []).length > 0);
  assert.ok(withPhotos.length > 100, `photos wale reviews kam hain: ${withPhotos.length}`);
  for (const row of withPhotos.slice(0, 20)) {
    for (const src of row.photos ?? []) assert.match(src, /^https:\/\//);
    assert.equal(row.images, (row.photos ?? []).join(" | "));
  }
});
